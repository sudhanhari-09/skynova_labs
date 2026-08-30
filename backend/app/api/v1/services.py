"""Services module (spec §36: services & solutions library) with public reads and
admin CRUD."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import Service
from app.services.audit import log_action


router = APIRouter(prefix="/services", tags=["services"])
admin_router = APIRouter(prefix="/admin/services", tags=["services"])


class ServicePayload(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    starting_price: Optional[float] = None
    pricing_model: Optional[str] = None
    features: Optional[List[str]] = None
    technologies: Optional[List[str]] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    is_public: bool = True
    is_active: bool = True
    display_order: Optional[int] = 0


def _serialize(s: Service) -> dict:
    price = float(s.starting_price) if s.starting_price is not None else None
    return {
        "id": s.id,
        "name": s.name,
        "slug": s.slug,
        "description": s.description,
        "category": s.category,
        "starting_price": price,
        "pricing_model": s.pricing_model,
        "features": s.features or [],
        "technologies": s.technologies or [],
        "image_url": s.image_url,
        "icon": s.icon,
        "is_public": s.is_public,
        "is_active": s.is_active,
        "display_order": s.display_order,
        "created_at": s.created_at,
    }


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _get(db: Session, sid: int) -> Service:
    s = db.query(Service).get(sid)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return s


@router.get("/")
def list_services(db: Session = Depends(get_db), category: Optional[str] = None):
    q = db.query(Service).filter(Service.is_public == True, Service.is_active == True)  # noqa: E712
    if category:
        q = q.filter(Service.category == category)
    return [_serialize(s) for s in q.order_by(Service.display_order, Service.name).all()]


@router.get("/{slug}")
def get_service(slug: str, db: Session = Depends(get_db)):
    s = db.query(Service).filter(Service.slug == slug).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return _serialize(s)


@admin_router.get("/")
def admin_list_services(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_serialize(s) for s in db.query(Service).order_by(Service.display_order, Service.name).all()]


@admin_router.post("/", status_code=status.HTTP_201_CREATED)
def create_service(data: ServicePayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    s = Service(**data.model_dump(exclude_unset=True))
    s.slug = s.slug or _slugify(s.name)
    db.add(s)
    db.flush()
    log_action(db, current_user["id"], "create", "services", "service", s.id, new_value={"name": s.name})
    db.commit()
    db.refresh(s)
    return _serialize(s)


@admin_router.patch("/{service_id}")
def update_service(service_id: int, data: ServicePayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    s = _get(db, service_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    log_action(db, current_user["id"], "update", "services", "service", s.id, new_value={"name": s.name})
    db.commit()
    db.refresh(s)
    return _serialize(s)


@admin_router.delete("/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    s = _get(db, service_id)
    log_action(db, current_user["id"], "delete", "services", "service", s.id, new_value={"name": s.name})
    db.delete(s)
    db.commit()
    return {"detail": "Service deleted"}