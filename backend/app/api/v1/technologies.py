"""Technologies module (spec §36) with public reads and admin CRUD."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import Technology
from app.services.audit import log_action


router = APIRouter(prefix="/technologies", tags=["technologies"])
admin_router = APIRouter(prefix="/admin/technologies", tags=["technologies"])


class TechnologyPayload(BaseModel):
    name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    is_public: bool = True
    is_active: bool = True
    display_order: Optional[int] = 0


def _serialize(t: Technology) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "category": t.category,
        "logo_url": t.logo_url,
        "description": t.description,
        "version": t.version,
        "is_public": t.is_public,
        "is_active": t.is_active,
        "display_order": t.display_order,
        "created_at": t.created_at,
    }


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _get(db: Session, tid: int) -> Technology:
    t = db.query(Technology).get(tid)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technology not found")
    return t


@router.get("/")
def list_technologies(db: Session = Depends(get_db), category: Optional[str] = None):
    q = db.query(Technology).filter(Technology.is_public == True, Technology.is_active == True)  # noqa: E712
    if category:
        q = q.filter(Technology.category == category)
    return [_serialize(t) for t in q.order_by(Technology.display_order, Technology.name).all()]


@router.get("/{slug}")
def get_technology(slug: str, db: Session = Depends(get_db)):
    t = db.query(Technology).filter(Technology.slug == slug).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technology not found")
    return _serialize(t)


@admin_router.get("/")
def admin_list_technologies(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_serialize(t) for t in db.query(Technology).order_by(Technology.display_order, Technology.name).all()]


@admin_router.post("/", status_code=status.HTTP_201_CREATED)
def create_technology(data: TechnologyPayload, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    t = Technology(**data.model_dump(exclude_unset=True))
    t.slug = t.slug or _slugify(t.name)
    db.add(t)
    db.flush()
    log_action(db, current_user["id"], "create", "technologies", "technology", t.id, new_value={"name": t.name})
    db.commit()
    db.refresh(t)
    return _serialize(t)


@admin_router.patch("/{technology_id}")
def update_technology(technology_id: int, data: TechnologyPayload, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    t = _get(db, technology_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    log_action(db, current_user["id"], "update", "technologies", "technology", t.id, new_value={"name": t.name})
    db.commit()
    db.refresh(t)
    return _serialize(t)


@admin_router.delete("/{technology_id}")
def delete_technology(technology_id: int, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    t = _get(db, technology_id)
    log_action(db, current_user["id"], "delete", "technologies", "technology", t.id, new_value={"name": t.name})
    db.delete(t)
    db.commit()
    return {"detail": "Technology deleted"}