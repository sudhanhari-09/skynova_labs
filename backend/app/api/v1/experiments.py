"""Experiments (spec §40 R&D pipeline) with public + admin endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import Experiment
from app.services.audit import log_action


router = APIRouter(prefix="/experiments", tags=["experiments"])
admin_router = APIRouter(prefix="/admin/experiments", tags=["experiments"])


class ExperimentPayload(BaseModel):
    title: str
    slug: Optional[str] = None
    objective: Optional[str] = None
    hypothesis: Optional[str] = None
    description: Optional[str] = None
    components: Optional[List[str]] = None
    technologies: Optional[List[str]] = None
    procedure: Optional[str] = None
    observations: Optional[str] = None
    results: Optional[str] = None
    conclusion: Optional[str] = None
    next_step: Optional[str] = None
    status: str = "PLANNED"
    is_public: bool = True
    project_id: Optional[int] = None
    research_ids: Optional[List[int]] = None


def _serialize(e: Experiment) -> dict:
    return {
        "id": e.id,
        "title": e.title,
        "slug": e.slug,
        "objective": e.objective,
        "hypothesis": e.hypothesis,
        "description": e.description,
        "components": e.components or [],
        "technologies": e.technologies or [],
        "procedure": e.procedure,
        "observations": e.observations,
        "results": e.results,
        "conclusion": e.conclusion,
        "next_step": e.next_step,
        "status": e.status,
        "is_public": e.is_public,
        "project_id": e.project_id,
        "research_ids": e.research_ids or [],
        "created_at": e.created_at,
        "created_by": e.created_by,
    }


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _get(db: Session, eid: int) -> Experiment:
    e = db.query(Experiment).get(eid)
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    return e


@router.get("/")
def list_experiments(db: Session = Depends(get_db), status_filter: Optional[str] = None, project_id: Optional[int] = None, limit: int = 50):
    q = db.query(Experiment).filter(Experiment.is_public == True)  # noqa: E712
    if status_filter:
        q = q.filter(Experiment.status == status_filter)
    if project_id:
        q = q.filter(Experiment.project_id == project_id)
    return [_serialize(e) for e in q.order_by(Experiment.created_at.desc()).limit(limit).all()]


@router.get("/{slug}")
def get_experiment(slug: str, db: Session = Depends(get_db)):
    e = db.query(Experiment).filter(Experiment.slug == slug).first()
    if not e or not e.is_public:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    return _serialize(e)


@admin_router.get("/")
def admin_list_experiments(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_serialize(e) for e in db.query(Experiment).order_by(Experiment.created_at.desc()).all()]


@admin_router.post("/", status_code=status.HTTP_201_CREATED)
def create_experiment(data: ExperimentPayload, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    e = Experiment(**data.model_dump(exclude_unset=True))
    e.slug = e.slug or _slugify(e.title)
    e.created_by = current_user["id"]
    db.add(e)
    db.flush()
    log_action(db, current_user["id"], "create", "experiments", "experiment", e.id, new_value={"slug": e.slug})
    db.commit()
    db.refresh(e)
    return _serialize(e)


@admin_router.patch("/{experiment_id}")
def update_experiment(experiment_id: int, data: ExperimentPayload, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    e = _get(db, experiment_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    log_action(db, current_user["id"], "update", "experiments", "experiment", e.id, new_value={"slug": e.slug})
    db.commit()
    db.refresh(e)
    return _serialize(e)


@admin_router.delete("/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db),
                      current_user: dict = Depends(get_current_user_dict)):
    e = _get(db, experiment_id)
    log_action(db, current_user["id"], "delete", "experiments", "experiment", e.id, new_value={"slug": e.slug})
    db.delete(e)
    db.commit()
    return {"detail": "Experiment deleted"}