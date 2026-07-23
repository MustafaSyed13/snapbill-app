# A "router" groups related endpoints together. FastAPI's main.py will
# mount this one under the path prefix /business.
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from ..database import get_db
from ..auth import get_current_user_id
from .. import models, schemas

router = APIRouter(prefix="/business", tags=["business"])


@router.get("", response_model=schemas.BusinessOut | None)
def get_business(db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    return db.query(models.Business).filter(models.Business.user_id == UUID(user_id)).first()


@router.put("", response_model=schemas.BusinessOut)
def save_business(payload: schemas.BusinessBase, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    row = db.query(models.Business).filter(models.Business.user_id == UUID(user_id)).first()
    if row:
        for field, value in payload.model_dump().items():
            setattr(row, field, value)
    else:
        row = models.Business(user_id=UUID(user_id), **payload.model_dump())
        db.add(row)
    db.commit()
    db.refresh(row)
    return row
