"""Research projects (spec §40 R&D pipeline) with public + admin endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import ResearchProject
from app.services.audit import log_action
from app.services.validation import validate_name, validate_slug


# ── Date validation ──────────────────────────────────────────────
_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def _validate_yyyy_mm_dd_date(value: object) -> object:
    """Validate a date value is in strict YYYY-MM-DD format with exact 4-digit year."""
    if value is None or value == "":
        return value
    if isinstance(value, str):
        m = _DATE_RE.match(value.strip())
        if not m:
            raise ValueError("Please enter a valid date in YYYY-MM-DD format.")
        year_s, month_s, day_s = m.group(1), m.group(2), m.group(3)
        year, month, day = int(year_s), int(month_s), int(day_s)
        if month < 1 or month > 12:
            raise ValueError("Please enter a valid date.")
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if (year % 4 == 0 and year % 100 != 0) or year % 400 == 0:
            days_in_month[1] = 29
        if day < 1 or day > days_in_month[month - 1]:
            raise ValueError("Please enter a valid date.")
    elif isinstance(value, datetime):
        pass
    else:
        raise ValueError("Please enter a valid date in YYYY-MM-DD format.")
    return value


router = APIRouter(prefix="/research", tags=["research"])
admin_router = APIRouter(prefix="/admin/research", tags=["research"])


class ResearchPayload(BaseModel):
    title: str
    slug: Optional[str] = None
    category: Optional[str] = None
    industry: Optional[str] = None
    abstract: Optional[str] = None
    description: Optional[str] = None
    objectives: Optional[str] = None
    methodology: Optional[str] = None
    results: Optional[str] = None
    technologies: Optional[List[str]] = None
    researchers: Optional[List[dict]] = None
    publication_links: Optional[List[str]] = None
    status: str = "PROPOSED"
    start_date: Optional[datetime] = Field(None, description="Start date in YYYY-MM-DD format or ISO datetime")
    end_date: Optional[datetime] = Field(None, description="End date in YYYY-MM-DD format or ISO datetime")
    is_public: bool = True
    related_project_ids: Optional[List[int]] = None
    related_experiment_ids: Optional[List[int]] = None
    related_product_ids: Optional[List[int]] = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def validate_date_fields(cls, v: object) -> object:
        return _validate_yyyy_mm_dd_date(v)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        return validate_name(v)

    @field_validator("slug")
    @classmethod
    def validate_slug_field(cls, v):
        if v is None:
            return v
        return validate_slug(v)


def _serialize(r: ResearchProject) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "slug": r.slug,
        "category": r.category,
        "industry": r.industry,
        "abstract": r.abstract,
        "description": r.description,
        "objectives": r.objectives,
        "methodology": r.methodology,
        "results": r.results,
        "technologies": r.technologies or [],
        "researchers": r.researchers or [],
        "publication_links": r.publication_links or [],
        "status": r.status,
        "start_date": r.start_date,
        "end_date": r.end_date,
        "is_public": r.is_public,
        "related_project_ids": r.related_project_ids or [],
        "related_experiment_ids": r.related_experiment_ids or [],
        "related_product_ids": r.related_product_ids or [],
        "created_at": r.created_at,
    }


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _get(db: Session, rid: int) -> ResearchProject:
    r = db.query(ResearchProject).get(rid)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research not found")
    return r


@router.get("/")
def list_research(db: Session = Depends(get_db), industry: Optional[str] = None, status_filter: Optional[str] = None):
    q = db.query(ResearchProject).filter(ResearchProject.is_public == True)  # noqa: E712
    if industry:
        q = q.filter(ResearchProject.industry == industry)
    if status_filter:
        q = q.filter(ResearchProject.status == status_filter)
    return [_serialize(r) for r in q.order_by(ResearchProject.created_at.desc()).all()]


@router.get("/{slug}")
def get_research(slug: str, db: Session = Depends(get_db)):
    r = db.query(ResearchProject).filter(ResearchProject.slug == slug).first()
    if not r or not r.is_public:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research not found")
    return _serialize(r)


@admin_router.get("/")
def admin_list_research(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_serialize(r) for r in db.query(ResearchProject).order_by(ResearchProject.created_at.desc()).all()]


@admin_router.post("/", status_code=status.HTTP_201_CREATED)
def create_research(data: ResearchPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    r = ResearchProject(**data.model_dump(exclude_unset=True))
    r.slug = r.slug or _slugify(r.title)
    db.add(r)
    db.flush()
    log_action(db, current_user["id"], "create", "research", "research", r.id, new_value={"slug": r.slug})
    db.commit()
    db.refresh(r)
    return _serialize(r)


@admin_router.patch("/{research_id}")
def update_research(research_id: int, data: ResearchPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    r = _get(db, research_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(r, field, value)
    log_action(db, current_user["id"], "update", "research", "research", r.id, new_value={"slug": r.slug})
    db.commit()
    db.refresh(r)
    return _serialize(r)


@admin_router.delete("/{research_id}")
def delete_research(research_id: int, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    r = _get(db, research_id)
    log_action(db, current_user["id"], "delete", "research", "research", r.id, new_value={"slug": r.slug})
    db.delete(r)
    db.commit()
    return {"detail": "Research deleted"}