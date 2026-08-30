"""Components, suppliers and inventory movements.

These tables already live in `models/spec.py` (registered in `Base.metadata`
as soon as the app package is imported). They are re-exported here under this
module's canonical names — `Component` is an alias for the existing
`ComponentItem` model mapping the `components` table — so the component router
and Alembic autogenerate have a single consistent entry point.
"""
from app.models.spec import (  # noqa: F401
    ComponentItem as Component,
    Supplier,
    InventoryMovement,
)