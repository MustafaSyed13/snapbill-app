from .. import models, schemas
from ._crud import make_crud_router

router = make_crud_router(
    model=models.Package, schema_in=schemas.PackageBase, schema_out=schemas.PackageOut,
    prefix="/packages", tag="packages",
)
