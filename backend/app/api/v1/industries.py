"""Industries module (spec §36) with public reads and admin CRUD."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import Industry
from app.services.audit import log_action


router = APIRouter(prefix="/industries", tags=["industries"])
admin_router = APIRouter(prefix="/admin/industries", tags=["industries"])


class IndustryPayload(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    problems_solved: Optional[List[str]] = None
    related_services: Optional[List[str]] = None
    related_technologies: Optional[List[str]] = None
    is_public: bool = True
    is_active: bool = True
    display_order: Optional[int] = 0


def _serialize(i: Industry) -> dict:
    return {
        "id": i.id,
        "name": i.name,
        "slug": i.slug,
        "description": i.description,
        "image_url": i.image_url,
        "problems_solved": i.problems_solved or [],
        "related_services": i.related_services or [],
        "related_technologies": i.related_technologies or [],
        "is_public": i.is_public,
        "is_active": i.is_active,
        "display_order": i.display_order,
        "created_at": i.created_at,
    }


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _get(db: Session, iid: int) -> Industry:
    i = db.query(Industry).get(iid)
    if not i:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Industry not found")
    return i


@router.get("/")
def list_industries(db: Session = Depends(get_db)):
    q = db.query(Industry).filter(Industry.is_public == True, Industry.is_active == True)  # noqa: E712
    return [_serialize(i) for i in q.order_by(Industry.display_order, Industry.name).all()]


@router.get("/{slug}")
def get_industry(slug: str, db: Session = Depends(get_db)):
    i = db.query(Industry).filter(Industry.slug == slug).first()
    if not i:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Industry not found")
    return _serialize(i)


@admin_router.get("/")
def admin_list_industries(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_serialize(i) for i in db.query(Industry).order_by(Industry.display_order, Industry.name).all()]


@admin_router.post("/", status_code=status.HTTP_201_CREATED)
def create_industry(data: IndustryPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    i = Industry(**data.model_dump(exclude_unset=True))
    i.slug = i.slug or _slugify(i.name)
    db.add(i)
    db.flush()
    log_action(db, current_user["id"], "create", "industries", "industry", i.id, new_value={"name": i.name})
    db.commit()
    db.refresh(i)
    return _serialize(i)


@admin_router.patch("/{industry_id}")
def update_industry(industry_id: int, data: IndustryPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    i = _get(db, industry_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(i, field, value)
    log_action(db, current_user["id"], "update", "industries", "industry", i.id, new_value={"name": i.name})
    db.commit()
    db.refresh(i)
    return _serialize(i)


@admin_router.delete("/{industry_id}")
def delete_industry(industry_id: int, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    i = _get(db, industry_id)
    log_action(db, current_user["id"], "delete", "industries", "industry", i.id, new_value={"name": i.name})
    db.delete(i)
    db.commit()
    return {"detail": "Industry deleted"}