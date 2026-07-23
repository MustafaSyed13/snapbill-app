from .. import models, schemas
from ._crud import make_crud_router

router = make_crud_router(
    model=models.Item, schema_in=schemas.ItemBase, schema_out=schemas.ItemOut,
    prefix="/items", tag="items",
)
