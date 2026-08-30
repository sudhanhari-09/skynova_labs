"""Standalone task management API.

Tasks are primarily managed as a sub-resource of projects; this router
exposes the same operations at the top level so the frontend can work
with tasks across projects without knowing project membership first.
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.auth import Task, ProjectMember, Activity
from app.api.v1.projects import TaskCreate, TaskUpdate, TaskResponse


router = APIRouter(prefix="/admin/tasks", tags=["admin-tasks"])

VALID_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"]


def _serialize(task: Task) -> TaskResponse:
    assignee_name = (
        f"{task.assignee.first_name or ''} {task.assignee.last_name or ''}".strip() or task.assignee.email
        if task.assignee else None
    )
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        milestone_id=task.milestone_id,
        title=task.title,
        description=task.description,
        assignee_id=task.assignee_id,
        assignee_name=assignee_name,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours,
        completed_at=task.completed_at,
        display_order=task.display_order,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _get_task(db: Session, task_id: int) -> Task:
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.get("/", response_model=List[TaskResponse])
def list_tasks(
    project_id: Optional[int] = None,
    milestone_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """List tasks across projects with filters."""
    query = db.query(Task)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if milestone_id:
        query = query.filter(Task.milestone_id == milestone_id)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if priority:
        query = query.filter(Task.priority == priority)
    tasks = query.order_by(Task.due_date.is_(None), Task.due_date.asc(), Task.display_order.asc()).all()
    return [_serialize(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    return _serialize(_get_task(db, task_id))


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Partial update of a task (single source of truth lives in projects.py)."""
    task = _get_task(db, task_id)
    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data:
        if update_data["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {update_data['status']}",
            )

    old_status = task.status
    for field, value in update_data.items():
        setattr(task, field, value)

    if "status" in update_data and update_data["status"] != old_status:
        if update_data["status"] == "DONE" and not task.completed_at:
            task.completed_at = datetime.utcnow()
        if update_data["status"] != "DONE":
            task.completed_at = None
        db.add(Activity(
            activity_type="task_status_changed",
            title="Task Status Changed",
            description=f"Task '{task.title}' status changed from {old_status} to {update_data['status']}",
            performed_by=current_user["id"],
            metadata={"task_id": task.id, "old_status": old_status, "new_status": update_data["status"]},
        ))

    if "assignee_id" in update_data and update_data["assignee_id"] is not None:
        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == task.project_id,
            ProjectMember.user_id == update_data["assignee_id"],
            ProjectMember.status == "ACTIVE",
        ).first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be an active member of this project",
            )

    db.commit()
    db.refresh(task)
    return _serialize(task)


@router.delete("/{task_id}", status_code=status.HTTP_200_OK)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    task = _get_task(db, task_id)
    db.delete(task)
    db.commit()
    return {"detail": "Task deleted"}