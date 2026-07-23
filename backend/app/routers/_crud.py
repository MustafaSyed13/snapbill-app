# Builds a router with the exact same list/get/create/update/delete routes as
# customers.py, for any model — so items/packages/invoices/payments don't
# need to repeat that code four more times. Read customers.py first if this
# is your first time through; this is the same logic, just parameterized.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from ..database import get_db
from ..auth import get_current_user_id


def make_crud_router(*, model, schema_in, schema_out, prefix, tag, extra_filter=None):
    router = APIRouter(prefix=prefix, tags=[tag])

    def scoped(db, user_id):
        q = db.query(model).filter(model.user_id == UUID(user_id))
        return extra_filter(q) if extra_filter else q

    @router.get("", response_model=list[schema_out])
    def list_all(db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
        return scoped(db, user_id).order_by(model.created_at.desc()).all()

    @router.get("/{item_id}", response_model=schema_out)
    def get_one(item_id: UUID, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
        row = scoped(db, user_id).filter(model.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail=f"{tag[:-1].capitalize()} not found")
        return row

    @router.post("", response_model=schema_out)
    def create(payload: schema_in, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
        row = model(user_id=UUID(user_id), **payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @router.put("/{item_id}", response_model=schema_out)
    def update(item_id: UUID, payload: schema_in, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
        row = scoped(db, user_id).filter(model.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail=f"{tag[:-1].capitalize()} not found")
        for field, value in payload.model_dump().items():
            setattr(row, field, value)
        db.commit()
        db.refresh(row)
        return row

    @router.delete("/{item_id}", status_code=204)
    def delete(item_id: UUID, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
        row = scoped(db, user_id).filter(model.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail=f"{tag[:-1].capitalize()} not found")
        db.delete(row)
        db.commit()

    return router
