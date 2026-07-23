from .. import models, schemas
from ._crud import make_crud_router

router = make_crud_router(
    model=models.Invoice, schema_in=schemas.InvoiceBase, schema_out=schemas.InvoiceOut,
    prefix="/invoices", tag="invoices",
)
