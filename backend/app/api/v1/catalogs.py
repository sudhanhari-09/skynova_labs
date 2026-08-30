"""Admin catalogs: foundational lookup entities, expenses and audit log.

Simple CRUD (list + create + update) for clients, services, technologies,
industries, components, suppliers, inventory movements and expenses, plus a
read-only audit log endpoint.

The catalog entities map to the existing `app.models.spec` tables (surface
models in `app.models.catalogs` / `app.models.component`); `Expense` is the one
genuinely new table.
"""
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.catalogs import Client, Service, Technology, Industry, Expense, AuditLog
from app.models.component import Component, Supplier, InventoryMovement
from app.api.deps import get_current_user_dict


router = APIRouter(prefix="/admin/catalogs", tags=["admin-catalogs"])


# ============================================================
# Shared schema base
# ============================================================

class CatalogItem(BaseModel):
    class Config:
        from_attributes = True


# ============================================================
# Clients
# ============================================================

class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    company: Optional[str] = None
    email: Optional[str] = None
    phone: str
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: str = "ACTIVE"


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class ClientResponse(CatalogItem):
    id: int
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


# ============================================================
# Services
# ============================================================

class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    starting_price: float = 0
    pricing_model: Optional[str] = None
    features: Optional[Any] = None
    technologies: Optional[Any] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    is_public: bool = True
    is_active: bool = True
    display_order: int = 0


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    starting_price: Optional[float] = None
    pricing_model: Optional[str] = None
    features: Optional[Any] = None
    technologies: Optional[Any] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class ServiceResponse(CatalogItem):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    category: Optional[str] = None
    starting_price: float
    pricing_model: Optional[str] = None
    features: Optional[Any] = None
    technologies: Optional[Any] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    is_public: bool
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


# ============================================================
# Technologies
# ============================================================

class TechnologyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    is_public: bool = True
    is_active: bool = True
    display_order: int = 0


class TechnologyUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class TechnologyResponse(CatalogItem):
    id: int
    name: str
    slug: str
    category: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    is_public: bool
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


# ============================================================
# Industries
# ============================================================

class IndustryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    image_url: Optional[str] = None
    problems_solved: Optional[Any] = None
    related_services: Optional[Any] = None
    related_technologies: Optional[Any] = None
    is_public: bool = True
    is_active: bool = True
    display_order: int = 0


class IndustryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    problems_solved: Optional[Any] = None
    related_services: Optional[Any] = None
    related_technologies: Optional[Any] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class IndustryResponse(CatalogItem):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    problems_solved: Optional[Any] = None
    related_services: Optional[Any] = None
    related_technologies: Optional[Any] = None
    is_public: bool
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


# ============================================================
# Components
# ============================================================

class ComponentCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
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
    specifications: Optional[Any] = None
    notes: Optional[str] = None
    status: str = "ACTIVE"


class ComponentUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    model_no: Optional[str] = None
    description: Optional[str] = None
    supplier_id: Optional[int] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    current_stock: Optional[int] = None
    minimum_stock: Optional[int] = None
    unit: Optional[str] = None
    storage_location: Optional[str] = None
    datasheet_url: Optional[str] = None
    image_url: Optional[str] = None
    specifications: Optional[Any] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class ComponentResponse(CatalogItem):
    id: int
    sku: str
    name: str
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    model_no: Optional[str] = None
    description: Optional[str] = None
    supplier_id: Optional[int] = None
    purchase_price: float
    selling_price: float
    current_stock: int
    minimum_stock: int
    unit: str
    storage_location: Optional[str] = None
    datasheet_url: Optional[str] = None
    image_url: Optional[str] = None
    specifications: Optional[Any] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


# ============================================================
# Suppliers
# ============================================================

class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    company: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: str
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    purchase_history: Optional[Any] = None
    status: str = "ACTIVE"
    notes: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    purchase_history: Optional[Any] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class SupplierResponse(CatalogItem):
    id: int
    name: str
    company: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    purchase_history: Optional[Any] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# Inventory movements
# ============================================================

class InventoryMovementCreate(BaseModel):
    component_id: int = Field(...)
    movement_type: str = "IN"
    quantity: int = 0
    unit_cost: Optional[float] = None
    project_id: Optional[int] = None
    reference_number: Optional[str] = None
    note: Optional[str] = None
    created_by: Optional[int] = None


class InventoryMovementUpdate(BaseModel):
    component_id: Optional[int] = None
    movement_type: Optional[str] = None
    quantity: Optional[int] = None
    unit_cost: Optional[float] = None
    project_id: Optional[int] = None
    reference_number: Optional[str] = None
    note: Optional[str] = None
    created_by: Optional[int] = None


class InventoryMovementResponse(CatalogItem):
    id: int
    component_id: int
    movement_type: str
    quantity: int
    unit_cost: Optional[float] = None
    project_id: Optional[int] = None
    reference_number: Optional[str] = None
    note: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# Expenses
# ============================================================

class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    amount: float = 0
    category: Optional[str] = None
    project_id: Optional[int] = None
    incurred_at: Optional[datetime] = None
    paid_by: Optional[int] = None
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    project_id: Optional[int] = None
    incurred_at: Optional[datetime] = None
    paid_by: Optional[int] = None
    notes: Optional[str] = None


class ExpenseResponse(CatalogItem):
    id: int
    title: str
    amount: float
    category: Optional[str] = None
    project_id: Optional[int] = None
    incurred_at: Optional[datetime] = None
    paid_by: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# Generic list/create/update registration per entity
# ============================================================

def _register_crud(model, path, create_schema, update_schema, response_schema, entity_label):
    @router.get(f"/{path}", response_model=List[response_schema])
    def list_items(
        skip: int = 0,
        limit: int = 100,
        active_only: bool = False,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user_dict),
    ):
        query = db.query(model)
        if active_only and hasattr(model, "is_active"):
            query = query.filter(model.is_active == True)
        return query.order_by(model.created_at.desc()).offset(skip).limit(limit).all()

    @router.post(f"/{path}", response_model=response_schema, status_code=status.HTTP_201_CREATED)
    def create_item(
        data: create_schema,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user_dict),
    ):
        item = model(**data.model_dump())
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @router.patch(f"/{path}/{{item_id}}", response_model=response_schema)
    def update_item(
        item_id: int,
        data: update_schema,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user_dict),
    ):
        item = db.query(model).get(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_label} not found",
            )
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        db.commit()
        db.refresh(item)
        return item


_register_crud(Client, "clients", ClientCreate, ClientUpdate, ClientResponse, "Client")
_register_crud(Service, "services", ServiceCreate, ServiceUpdate, ServiceResponse, "Service")
_register_crud(Technology, "technologies", TechnologyCreate, TechnologyUpdate, TechnologyResponse, "Technology")
_register_crud(Industry, "industries", IndustryCreate, IndustryUpdate, IndustryResponse, "Industry")
_register_crud(Component, "components", ComponentCreate, ComponentUpdate, ComponentResponse, "Component")
_register_crud(Supplier, "suppliers", SupplierCreate, SupplierUpdate, SupplierResponse, "Supplier")
_register_crud(InventoryMovement, "inventory-movements", InventoryMovementCreate, InventoryMovementUpdate, InventoryMovementResponse, "Inventory movement")
_register_crud(Expense, "expenses", ExpenseCreate, ExpenseUpdate, ExpenseResponse, "Expense")


# ============================================================
# Audit log
# ============================================================

audit_logs_router = APIRouter(prefix="/admin/audit-logs", tags=["admin-audit-logs"])


class AuditLogResponse(CatalogItem):
    id: int
    user_id: Optional[int] = None
    action: str
    module: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    request_ip: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


@audit_logs_router.get("", response_model=List[AuditLogResponse])
async def list_audit_logs(
    entity_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """List audit log entries, optionally filtered by entity type."""
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()