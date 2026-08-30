"""Build logs (spec §3 project provenance) with public + admin endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import BuildLog
from app.services.audit import log_action


router = APIRouter(prefix="/build-logs", tags=["build-logs"])
admin_router = APIRouter(prefix="/admin/build-logs", tags=["build-logs"])


class BuildLogPayload(BaseModel):
    title: str
    project_id: Optional[int] = None
    entry_date: Optional[datetime] = None
    description: Optional[str] = None
    technologies: Optional[List[str]] = None
    is_public: bool = True
    entry_type: str = "PROGRESS"


def _serialize(b: BuildLog) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        "project_id": b.project_id,
        "entry_date": b.entry_date,
        "description": b.description,
        "technologies": b.technologies or [],
        "is_public": b.is_public,
        "entry_type": b.entry_type,
        "author_id": b.author_id,
        "created_at": b.created_at,
    }


def _get(db: Session, bid: int) -> BuildLog:
    b = db.query(BuildLog).get(bid)
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Build log not found")
    return b


@router.get("/")
def list_build_logs(db: Session = Depends(get_db), project_id: Optional[int] = None, limit: int = 50):
    q = db.query(BuildLog).filter(BuildLog.is_public == True)  # noqa: E712
    if project_id:
        q = q.filter(BuildLog.project_id == project_id)
    return [_serialize(b) for b in q.order_by(BuildLog.entry_date.desc()).limit(limit).all()]


@router.get("/{build_log_id}")
def get_build_log(build_log_id: int, db: Session = Depends(get_db)):
    b = _get(db, build_log_id)
    if not b.is_public:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Build log not found")
    return _serialize(b)


@admin_router.get("/")
def admin_list_build_logs(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_serialize(b) for b in db.query(BuildLog).order_by(BuildLog.entry_date.desc()).all()]


@admin_router.post("/", status_code=status.HTTP_201_CREATED)
def create_build_log(data: BuildLogPayload, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    b = BuildLog(**data.model_dump(exclude_unset=True))
    b.author_id = current_user["id"]
    b.entry_date = b.entry_date or datetime.utcnow()
    db.add(b)
    db.flush()
    log_action(db, current_user["id"], "create", "build-logs", "build_log", b.id, new_value={"title": b.title})
    db.commit()
    db.refresh(b)
    return _serialize(b)


@admin_router.patch("/{build_log_id}")
def update_build_log(build_log_id: int, data: BuildLogPayload, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    b = _get(db, build_log_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(b, field, value)
    db.commit()
    db.refresh(b)
    return _serialize(b)


@admin_router.delete("/{build_log_id}")
def delete_build_log(build_log_id: int, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    b = _get(db, build_log_id)
    db.delete(b)
    db.commit()
    return {"detail": "Build log deleted"}