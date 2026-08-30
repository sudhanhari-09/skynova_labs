"""Case studies (spec §36 stories) — public + admin."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import CaseStudy
from app.services.audit import log_action


router = APIRouter(prefix="/case-studies", tags=["case-studies"])
admin_router = APIRouter(prefix="/admin/case-studies", tags=["case-studies"])


class CaseStudyPayload(BaseModel):
    project_id: int
    problem: Optional[str] = None
    challenge: Optional[str] = None
    research: Optional[str] = None
    approach: Optional[str] = None
    prototype: Optional[str] = None
    solution: Optional[str] = None
    technologies: Optional[List[str]] = None
    development_process: Optional[str] = None
    results: Optional[str] = None
    impact: Optional[str] = None
    timeline: Optional[List[dict]] = None
    team: Optional[List[dict]] = None
    cover_image: Optional[str] = None
    is_published: bool = False
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None


def _serialize(cs: CaseStudy) -> dict:
    return {
        "id": cs.id,
        "project_id": cs.project_id,
        "project_title": cs.project.title if cs.project else None,
        "problem": cs.problem,
        "challenge": cs.challenge,
        "research": cs.research,
        "approach": cs.approach,
        "prototype": cs.prototype,
        "solution": cs.solution,
        "technologies": cs.technologies or [],
        "development_process": cs.development_process,
        "results": cs.results,
        "impact": cs.impact,
        "timeline": cs.timeline or [],
        "team": cs.team or [],
        "cover_image": cs.cover_image,
        "is_published": cs.is_published,
        "published_at": cs.published_at,
        "seo_title": cs.seo_title,
        "meta_description": cs.meta_description,
        "created_at": cs.created_at,
    }


@router.get("/")
def list_case_studies(db: Session = Depends(get_db)):
    return [_serialize(cs) for cs in db.query(CaseStudy)
            .filter(CaseStudy.is_published == True)  # noqa: E712
            .order_by(CaseStudy.published_at.desc()).all()]


@router.get("/{case_study_id}")
def get_case_study(case_study_id: int, db: Session = Depends(get_db)):
    cs = db.query(CaseStudy).get(case_study_id)
    if not cs or not cs.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case study not found")
    return _serialize(cs)


@admin_router.get("/")
def admin_list(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_serialize(cs) for cs in db.query(CaseStudy).order_by(CaseStudy.created_at.desc()).all()]


@admin_router.post("/", status_code=status.HTTP_201_CREATED)
def create_case_study(data: CaseStudyPayload, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    cs = CaseStudy(**data.model_dump(exclude_unset=True))
    if cs.is_published:
        cs.published_at = datetime.utcnow()
    db.add(cs)
    db.flush()
    log_action(db, current_user["id"], "create", "case-studies", "case_study", cs.id,
               new_value={"project_id": cs.project_id})
    db.commit()
    db.refresh(cs)
    return _serialize(cs)


@admin_router.patch("/{case_study_id}")
def update_case_study(case_study_id: int, data: CaseStudyPayload, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    cs = db.query(CaseStudy).get(case_study_id)
    if not cs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case study not found")
    old_pub = cs.is_published
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cs, field, value)
    if cs.is_published and not old_pub:
        cs.published_at = datetime.utcnow()
    db.commit()
    db.refresh(cs)
    return _serialize(cs)


@admin_router.delete("/{case_study_id}")
def delete_case_study(case_study_id: int, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    cs = db.query(CaseStudy).get(case_study_id)
    if not cs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case study not found")
    db.delete(cs)
    db.commit()
    return {"detail": "Case study deleted"}