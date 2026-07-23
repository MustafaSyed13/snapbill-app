from fastapi import Depends
from sqlalchemy.orm import Session
from uuid import UUID

from ..database import get_db
from ..auth import get_current_user_id
from .. import models, schemas
from ._crud import make_crud_router

router = make_crud_router(
    model=models.Payment, schema_in=schemas.PaymentBase, schema_out=schemas.PaymentOut,
    prefix="/payments", tag="payments",
)


# Extra route beyond the standard CRUD set: "give me just the payments for this invoice".
@router.get("/for-invoice/{invoice_id}", response_model=list[schemas.PaymentOut])
def payments_for_invoice(invoice_id: UUID, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    return (db.query(models.Payment)
            .filter(models.Payment.user_id == UUID(user_id), models.Payment.invoice_id == invoice_id)
            .order_by(models.Payment.date.desc())
            .all())
