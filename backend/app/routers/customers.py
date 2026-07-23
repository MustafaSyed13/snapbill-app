# This file is the full, spelled-out example of the CRUD pattern (Create,
# Read, Update, Delete) that every resource in this API follows. The other
# resources (items, packages, invoices, payments) use a shared helper
# (_crud.py) that does exactly this same pattern without repeating the code.
#
# IMPORTANT SECURITY NOTE: this backend connects to the database using the
# full admin password, not the restricted "anon" key the browser uses. That
# means Postgres's Row Level Security (which protects the browser's direct
# connection) does NOT apply here — this code IS the security boundary now.
# Every query below filters by `user_id == the signed-in user`. If that
# filter were ever missing from a route, that route would leak every user's
# data. Always double check that filter is present when adding a new route.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from ..database import get_db
from ..auth import get_current_user_id
from .. import models, schemas

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    return (db.query(models.Customer)
            .filter(models.Customer.user_id == UUID(user_id))
            .order_by(models.Customer.created_at.desc())
            .all())


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: UUID, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    row = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.user_id == UUID(user_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return row


@router.post("", response_model=schemas.CustomerOut)
def create_customer(payload: schemas.CustomerBase, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    row = models.Customer(user_id=UUID(user_id), **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)  # reloads server-generated fields like id and created_at
    return row


@router.put("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: UUID, payload: schemas.CustomerBase, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    row = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.user_id == UUID(user_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: UUID, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    row = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.user_id == UUID(user_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(row)
    db.commit()
