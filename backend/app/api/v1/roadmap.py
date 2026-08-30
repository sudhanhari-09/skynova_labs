"""Roadmap items (Phase 4).

Prioritized, quarter-tagged product roadmap. Grouped views are assembled by the
frontend; the API exposes flat CRUD + statuses.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import RoadmapItem, Product


router = APIRouter(prefix="/admin/roadmap", tags=["admin-roadmap"])


class RoadmapItemCreate(BaseModel):
    product_id: Optional[int] = None
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    status: str = "BACKLOG"
    priority: str = "MEDIUM"
    category: str = "FEATURE"
    target_quarter: Optional[str] = None
    due_date: Optional[datetime] = None
    display_order: int = 0


class RoadmapItemUpdate(BaseModel):
    product_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    target_quarter: Optional[str] = None
    due_date: Optional[datetime] = None
    display_order: Optional[int] = None


class RoadmapItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    category: str
    target_quarter: Optional[str] = None
    due_date: Optional[datetime] = None
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


STATUSES = ["BACKLOG", "PLANNED", "IN_PROGRESS", "COMPLETED"]
PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
CATEGORIES = ["FEATURE", "IMPROVEMENT", "RESEARCH", "INFRASTRUCTURE"]


def build_response(db: Session, item: RoadmapItem) -> RoadmapItemResponse:
    product = db.query(Product).get(item.product_id) if item.product_id else None
    return RoadmapItemResponse(
        id=item.id,
        product_id=item.product_id,
        product_name=product.name if product else None,
        title=item.title,
        description=item.description,
        status=item.status,
        priority=item.priority,
        category=item.category,
        target_quarter=item.target_quarter,
        due_date=item.due_date,
        display_order=item.display_order,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.post("/", response_model=RoadmapItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    data: RoadmapItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("roadmaps")),
):
    if data.status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    if data.priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {data.priority}")
    if data.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {data.category}")

    item = RoadmapItem(
        product_id=data.product_id,
        title=data.title,
        description=data.description,
        status=data.status,
        priority=data.priority,
        category=data.category,
        target_quarter=data.target_quarter,
        due_date=data.due_date,
        display_order=data.display_order,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return build_response(db, item)


@router.get("/", response_model=List[RoadmapItemResponse])
def list_items(
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    product_id: Optional[int] = None,
    target_quarter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("roadmaps")),
):
    query = db.query(RoadmapItem)
    if status_filter:
        query = query.filter(RoadmapItem.status == status_filter)
    if priority:
        query = query.filter(RoadmapItem.priority == priority)
    if product_id:
        query = query.filter(RoadmapItem.product_id == product_id)
    if target_quarter:
        query = query.filter(RoadmapItem.target_quarter == target_quarter)

    items = query.order_by(
        RoadmapItem.display_order.asc(), RoadmapItem.due_date.asc().nulls_last(), RoadmapItem.created_at.desc()
    ).all()
    return [build_response(db, i) for i in items]


@router.get("/quarters", response_model=List[str])
def list_quarters(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("roadmaps")),
):
    rows = db.query(RoadmapItem.target_quarter).filter(RoadmapItem.target_quarter.isnot(None)).distinct().all()
    quarters = sorted({r[0] for r in rows if r[0]}, reverse=True)
    return quarters


@router.get("/{item_id}", response_model=RoadmapItemResponse)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("roadmaps")),
):
    item = db.query(RoadmapItem).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    return build_response(db, item)


@router.patch("/{item_id}", response_model=RoadmapItemResponse)
def update_item(
    item_id: int,
    data: RoadmapItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("roadmaps")),
):
    item = db.query(RoadmapItem).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, values in (("status", STATUSES), ("priority", PRIORITIES), ("category", CATEGORIES)):
        if field in update_data and update_data[field] not in values:
            raise HTTPException(status_code=400, detail=f"Invalid {field}: {update_data[field]}")

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return build_response(db, item)


@router.delete("/{item_id}", status_code=200)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("roadmaps")),
):
    item = db.query(RoadmapItem).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    db.delete(item)
    db.commit()
    return {"detail": "Roadmap item deleted"}