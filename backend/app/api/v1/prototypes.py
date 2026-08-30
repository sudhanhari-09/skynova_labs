"""Prototypes (Phase 4).

Central registry of hardware/software prototypes with artifact links and
iteration status.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User, Project
from app.models.operations import Prototype, Product


router = APIRouter(prefix="/admin/prototypes", tags=["admin-prototypes"])


class PrototypeCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    project_id: Optional[int] = None
    product_id: Optional[int] = None
    prototype_type: str = "SOFTWARE"
    status: str = "DRAFT"
    storage_key: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class PrototypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[int] = None
    product_id: Optional[int] = None
    prototype_type: Optional[str] = None
    status: Optional[str] = None
    storage_key: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class PrototypeResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    product_id: Optional[int] = None
    project_name: Optional[str] = None
    product_name: Optional[str] = None
    prototype_type: str
    status: str
    storage_key: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


TYPES = ["UI", "PHYSICAL", "SOFTWARE", "CONCEPT", "OTHER"]
STATUSES = ["DRAFT", "IN_PROGRESS", "ITERATING", "APPROVED", "ARCHIVED"]


def build_response(db: Session, proto: Prototype) -> PrototypeResponse:
    project = db.query(Project).get(proto.project_id) if proto.project_id else None
    product = db.query(Product).get(proto.product_id) if proto.product_id else None
    return PrototypeResponse(
        id=proto.id,
        name=proto.name,
        description=proto.description,
        project_id=proto.project_id,
        product_id=proto.product_id,
        project_name=project.name if project else None,
        product_name=product.name if product else None,
        prototype_type=proto.prototype_type,
        status=proto.status,
        storage_key=proto.storage_key,
        image_url=proto.image_url,
        notes=proto.notes,
        created_at=proto.created_at,
        updated_at=proto.updated_at,
    )


@router.post("/", response_model=PrototypeResponse, status_code=status.HTTP_201_CREATED)
def create_prototype(
    data: PrototypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("prototypes")),
):
    if data.prototype_type not in TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid prototype_type: {data.prototype_type}")
    if data.status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")

    proto = Prototype(
        name=data.name,
        description=data.description,
        project_id=data.project_id,
        product_id=data.product_id,
        prototype_type=data.prototype_type,
        status=data.status,
        storage_key=data.storage_key,
        image_url=data.image_url,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(proto)
    db.commit()
    db.refresh(proto)
    return build_response(db, proto)


@router.get("/", response_model=List[PrototypeResponse])
def list_prototypes(
    status_filter: Optional[str] = None,
    prototype_type: Optional[str] = None,
    project_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("prototypes")),
):
    query = db.query(Prototype)
    if status_filter:
        query = query.filter(Prototype.status == status_filter)
    if prototype_type:
        query = query.filter(Prototype.prototype_type == prototype_type)
    if project_id:
        query = query.filter(Prototype.project_id == project_id)
    if product_id:
        query = query.filter(Prototype.product_id == product_id)

    prototypes = query.order_by(Prototype.created_at.desc()).all()
    return [build_response(db, p) for p in prototypes]


@router.get("/{proto_id}", response_model=PrototypeResponse)
def get_prototype(
    proto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("prototypes")),
):
    proto = db.query(Prototype).get(proto_id)
    if not proto:
        raise HTTPException(status_code=404, detail="Prototype not found")
    return build_response(db, proto)


@router.patch("/{proto_id}", response_model=PrototypeResponse)
def update_prototype(
    proto_id: int,
    data: PrototypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("prototypes")),
):
    proto = db.query(Prototype).get(proto_id)
    if not proto:
        raise HTTPException(status_code=404, detail="Prototype not found")

    update_data = data.model_dump(exclude_unset=True)
    if "prototype_type" in update_data and update_data["prototype_type"] not in TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid prototype_type: {update_data['prototype_type']}")
    if "status" in update_data and update_data["status"] not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")

    for field, value in update_data.items():
        setattr(proto, field, value)

    db.commit()
    db.refresh(proto)
    return build_response(db, proto)


@router.delete("/{proto_id}", status_code=200)
def delete_prototype(
    proto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("prototypes")),
):
    proto = db.query(Prototype).get(proto_id)
    if not proto:
        raise HTTPException(status_code=404, detail="Prototype not found")
    name = proto.name
    db.delete(proto)
    db.commit()
    return {"detail": f"Prototype '{name}' deleted"}