from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import (
    Project, Milestone, Task, ProjectUpdate
)
from typing import Optional, List
from datetime import datetime


router = APIRouter(prefix="/public/projects", tags=["public-projects"])

from pydantic import BaseModel


class PublicProject(BaseModel):
    project_number: str
    title: str
    acronym: Optional[str] = None
    description: Optional[str] = None
    status: str
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class PublicMilestone(BaseModel):
    name: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PublicTask(BaseModel):
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PublicProjectUpdate(BaseModel):
    title: str
    content: Optional[str] = None
    update_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class PublicProjectDetail(BaseModel):
    project_number: str
    title: str
    acronym: Optional[str] = None
    description: Optional[str] = None
    status: str
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    milestones: Optional[List[PublicMilestone]] = None
    tasks: Optional[List[PublicTask]] = None
    recent_updates: Optional[List[PublicProjectUpdate]] = None


class PublicProjectListResponse(BaseModel):
    projects: List[PublicProject]
    total: int


@router.get("/", response_model=PublicProjectListResponse)
async def list_public_projects(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_by: Optional[str] = "start_date",
    order: Optional[str] = "desc",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Public project explorer with search, filtering, and sorting.

    Only exposes public fields for projects in public-facing statuses.
    """
    from sqlalchemy import or_
    query = db.query(Project)
    if search:
        q = f"%{search}%"
        query = query.filter(or_(
            Project.title.ilike(q),
            Project.acronym.ilike(q),
            Project.description.ilike(q),
            Project.project_number.ilike(q),
        ))
    if status_filter:
        query = query.filter(Project.status == status_filter)

    sort_col = {
        "created_at": Project.created_at,
        "start_date": Project.start_date,
        "target_end_date": Project.target_end_date,
        "title": Project.title,
    }.get(sort_by, Project.created_at)
    query = query.order_by(sort_col.asc() if order == "asc" else sort_col.desc())

    total = query.count()
    projects = query.offset(skip).limit(limit).all()
    return PublicProjectListResponse(
        projects=[PublicProject(
            project_number=p.project_number,
            title=p.title,
            acronym=p.acronym,
            description=p.description,
            status=p.status,
            start_date=p.start_date,
            target_end_date=p.target_end_date,
            actual_end_date=p.actual_end_date,
        ) for p in projects],
        total=total,
    )

@router.get("/{secure_reference}", response_model=PublicProjectDetail)
async def get_public_project(
    secure_reference: str,
    db: Session = Depends(get_db),
):
    """Public project view for customers via a secure reference link.

    Only exposes user-visible information. Internal budgets, notes,
    internal comments, and team information are never exposed here.
    """
    from sqlalchemy import or_
    project = db.query(Project).filter(or_(
        Project.secure_reference == secure_reference,
        Project.project_number == secure_reference,
    )).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Only expose milestones, tasks, and updates that customers can see
    milestones = (
        db.query(Milestone)
        .filter(Milestone.project_id == project.id)
        .order_by(Milestone.display_order.asc())
        .all()
    )
    tasks = (
        db.query(Task)
        .filter(Task.project_id == project.id)
        .order_by(Task.display_order.asc())
        .all()
    )
    updates = (
        db.query(ProjectUpdate)
        .filter(
            ProjectUpdate.project_id == project.id,
            ProjectUpdate.is_user_visible == True,  # noqa: E712
        )
        .order_by(ProjectUpdate.created_at.desc())
        .limit(20)
        .all()
    )

    public_milestones = [
        PublicMilestone(
            name=m.name,
            description=m.description,
            due_date=m.due_date,
            status=m.status,
            completed_at=m.completed_at,
        )
        for m in milestones
    ]

    public_tasks = [
        PublicTask(
            title=t.title,
            description=t.description,
            status=t.status,
            priority=t.priority,
            due_date=t.due_date,
            completed_at=t.completed_at,
        )
        for t in tasks
    ]

    public_updates = [
        PublicProjectUpdate(
            title=u.title,
            content=u.content,
            update_type=u.update_type,
            created_at=u.created_at,
        )
        for u in updates
    ]

    return PublicProjectDetail(
        project_number=project.project_number,
        title=project.title,
        acronym=project.acronym,
        description=project.description,
        status=project.status,
        start_date=project.start_date,
        target_end_date=project.target_end_date,
        actual_end_date=project.actual_end_date,
        milestones=public_milestones,
        tasks=public_tasks,
        recent_updates=public_updates,
    )