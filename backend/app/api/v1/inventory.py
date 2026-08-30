"""Inventory: components, suppliers and stock movements (spec §51 / §52).

Movements are immutable ledger entries that adjust component stock levels.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import ComponentItem, Supplier, InventoryMovement, ProjectComponent
from app.services.audit import log_action


router = APIRouter(prefix="/inventory", tags=["inventory"])
admin_router = APIRouter(prefix="/admin/inventory", tags=["inventory"])
move_router = APIRouter(prefix="/inventory/movements", tags=["inventory"])


class SupplierPayload(BaseModel):
    name: str
    company: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: str
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    status: str = "ACTIVE"
    notes: Optional[str] = None


class ComponentPayload(BaseModel):
    sku: str
    name: str
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    model_no: Optional[str] = None
    description: Optional[str] = None
    supplier_id: Optional[int] = None
    purchase_price: float = 0
    selling_price: float = 0
    current_stock: int = 0
    minimum_stock: int = 0
    unit: str = "unit"
    storage_location: Optional[str] = None
    datasheet_url: Optional[str] = None
    image_url: Optional[str] = None
    specifications: Optional[dict] = None
    notes: Optional[str] = None
    status: str = "ACTIVE"


class MovementPayload(BaseModel):
    component_id: int
    movement_type: str
    quantity: int
    unit_cost: Optional[float] = None
    project_id: Optional[int] = None
    reference_number: Optional[str] = None
    note: Optional[str] = None


def _supplier_dict(s: Supplier) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "company": s.company,
        "contact": s.contact,
        "email": s.email,
        "phone": s.phone,
        "address": s.address,
        "payment_terms": s.payment_terms,
        "status": s.status,
        "notes": s.notes,
        "created_at": s.created_at,
    }


def _component_dict(c: ComponentItem) -> dict:
    return {
        "id": c.id,
        "sku": c.sku,
        "name": c.name,
        "category": c.category,
        "manufacturer": c.manufacturer,
        "model_no": c.model_no,
        "description": c.description,
        "supplier_id": c.supplier_id,
        "purchase_price": float(c.purchase_price or 0),
        "selling_price": float(c.selling_price or 0),
        "current_stock": c.current_stock,
        "minimum_stock": c.minimum_stock,
        "unit": c.unit,
        "storage_location": c.storage_location,
        "datasheet_url": c.datasheet_url,
        "image_url": c.image_url,
        "specifications": c.specifications or {},
        "notes": c.notes,
        "status": c.status,
        "low_stock": c.minimum_stock > 0 and c.current_stock <= c.minimum_stock,
        "created_at": c.created_at,
    }


def _movement_dict(m: InventoryMovement) -> dict:
    return {
        "id": m.id,
        "component_id": m.component_id,
        "movement_type": m.movement_type,
        "quantity": m.quantity,
        "unit_cost": float(m.unit_cost) if m.unit_cost is not None else None,
        "project_id": m.project_id,
        "reference_number": m.reference_number,
        "note": m.note,
        "created_by": m.created_by,
        "created_at": m.created_at,
    }


def _get_supplier(db: Session, sid: int) -> Supplier:
    s = db.query(Supplier).get(sid)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return s


def _get_component(db: Session, cid: int) -> ComponentItem:
    c = db.query(ComponentItem).get(cid)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component not found")
    return c


# ---------------- Suppliers ----------------

@admin_router.get("/suppliers")
def list_suppliers(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_supplier_dict(s) for s in db.query(Supplier).order_by(Supplier.name).all()]


@admin_router.post("/suppliers", status_code=status.HTTP_201_CREATED)
def create_supplier(data: SupplierPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    s = Supplier(**data.model_dump(exclude_unset=True))
    db.add(s)
    db.flush()
    log_action(db, current_user["id"], "create", "inventory", "supplier", s.id, new_value={"name": s.name})
    db.commit()
    db.refresh(s)
    return _supplier_dict(s)


@admin_router.patch("/suppliers/{supplier_id}")
def update_supplier(supplier_id: int, data: SupplierPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    s = _get_supplier(db, supplier_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return _supplier_dict(s)


@admin_router.delete("/suppliers/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    s = _get_supplier(db, supplier_id)
    db.delete(s)
    db.commit()
    return {"detail": "Supplier deleted"}


# ---------------- Components ----------------

@router.get("/components", tags=["inventory"])
def list_components(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
                    category: Optional[str] = None, low_stock: bool = False):
    q = db.query(ComponentItem)
    if category:
        q = q.filter(ComponentItem.category == category)
    components = q.order_by(ComponentItem.name).all()
    result = [_component_dict(c) for c in components]
    if low_stock:
        result = [c for c in result if c["low_stock"]]
    return result


@router.get("/components/{component_id}")
def get_component(component_id: int, db: Session = Depends(get_db),
                  current_user: dict = Depends(get_current_user_dict)):
    return _component_dict(_get_component(db, component_id))


@admin_router.post("/components", status_code=status.HTTP_201_CREATED)
def create_component(data: ComponentPayload, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    if db.query(ComponentItem).filter(ComponentItem.sku == data.sku).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")
    c = ComponentItem(**data.model_dump(exclude_unset=True))
    db.add(c)
    db.flush()
    log_action(db, current_user["id"], "create", "inventory", "component", c.id, new_value={"sku": c.sku})
    db.commit()
    db.refresh(c)
    return _component_dict(c)


@admin_router.patch("/components/{component_id}")
def update_component(component_id: int, data: ComponentPayload, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    c = _get_component(db, component_id)
    old_stock = c.current_stock
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    log_action(db, current_user["id"], "update", "inventory", "component", c.id,
               new_value={"sku": c.sku}, old_value={"current_stock": old_stock})
    db.commit()
    db.refresh(c)
    return _component_dict(c)


@admin_router.delete("/components/{component_id}")
def delete_component(component_id: int, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    c = _get_component(db, component_id)
    linked = db.query(ProjectComponent).filter(ProjectComponent.component_id == c.id).count()
    if linked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot delete: component is used in {linked} project(s)")
    db.delete(c)
    db.commit()
    return {"detail": "Component deleted"}


# ---------------- Movements (ledger) ----------------

@move_router.post("/", status_code=status.HTTP_201_CREATED)
def create_movement(data: MovementPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    component = _get_component(db, data.component_id)
    if data.quantity == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity cannot be zero")

    movement = InventoryMovement(
        component_id=component.id,
        movement_type=data.movement_type,
        quantity=data.quantity,
        unit_cost=data.unit_cost,
        project_id=data.project_id,
        reference_number=data.reference_number,
        note=data.note,
        created_by=current_user["id"],
    )

    if data.movement_type in ("STOCK_IN", "DEALLOCATION"):
        component.current_stock += data.quantity
    elif data.movement_type in ("STOCK_OUT", "ALLOCATION"):
        if component.current_stock < data.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient stock")
        component.current_stock -= data.quantity
    elif data.movement_type == "ADJUSTMENT":
        component.current_stock = data.quantity  # absolute adjustment
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown movement type")

    db.add(movement)
    db.flush()
    log_action(db, current_user["id"], "movement", "inventory", "movement", movement.id,
               new_value={"component": component.sku, "type": data.movement_type, "qty": data.quantity})
    db.commit()
    db.refresh(movement)
    return {**_movement_dict(movement), "new_stock": component.current_stock}


@move_router.get("/")
def list_movements(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
                   component_id: Optional[int] = None, project_id: Optional[int] = None, limit: int = 100):
    q = db.query(InventoryMovement).order_by(InventoryMovement.created_at.desc())
    if component_id:
        q = q.filter(InventoryMovement.component_id == component_id)
    if project_id:
        q = q.filter(InventoryMovement.project_id == project_id)
    return [_movement_dict(m) for m in q.limit(limit).all()]


@router.get("/summary", tags=["inventory"])
def inventory_summary(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    components = db.query(ComponentItem).all()
    total_units = sum((c.current_stock or 0) for c in components)
    low_stock = sum(1 for c in components if c.minimum_stock and c.current_stock <= c.minimum_stock)
    inventory_value = sum(float(c.purchase_price or 0) * (c.current_stock or 0) for c in components)
    return {
        "components_count": len(components),
        "total_units_in_stock": total_units,
        "low_stock_count": low_stock,
        "inventory_value": round(inventory_value, 2),
        "suppliers_count": db.query(Supplier).count(),
    }