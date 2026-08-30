"""Calendar events (Phase 3).

Shared team calendar: events can be linked to projects, leads, tickets and
invoices.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import CalendarEvent


router = APIRouter(prefix="/admin/calendar", tags=["admin-calendar"])


class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    event_type: str = "MEETING"
    starts_at: datetime
    ends_at: Optional[datetime] = None
    all_day: bool = False
    location: Optional[str] = None
    participant_ids: Optional[List[int]] = None
    related_entity: Optional[str] = None
    related_id: Optional[int] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    participant_ids: Optional[List[int]] = None
    related_entity: Optional[str] = None
    related_id: Optional[int] = None


class CalendarEventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    event_type: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    all_day: bool
    location: Optional[str] = None
    participant_ids: Optional[List[int]] = None
    related_entity: Optional[str] = None
    related_id: Optional[int] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


VALID_EVENT_TYPES = ["MEETING", "CALL", "DEADLINE", "MILESTONE", "FOLLOW_UP", "OTHER"]


def build_response(event: CalendarEvent) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        all_day=event.all_day,
        location=event.location,
        participant_ids=event.participant_ids,
        related_entity=event.related_entity,
        related_id=event.related_id,
        created_by=event.created_by,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.post("/", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    data: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("calendar")),
):
    if data.event_type not in VALID_EVENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid event_type: {data.event_type}")
    if data.ends_at and data.ends_at < data.starts_at:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

    event = CalendarEvent(
        title=data.title,
        description=data.description,
        event_type=data.event_type,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        all_day=data.all_day,
        location=data.location,
        participant_ids=data.participant_ids,
        related_entity=data.related_entity,
        related_id=data.related_id,
        created_by=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return build_response(event)


@router.get("/", response_model=List[CalendarEventResponse])
def list_events(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    event_type: Optional[str] = None,
    related_entity: Optional[str] = None,
    related_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("calendar")),
):
    query = db.query(CalendarEvent)
    if start:
        query = query.filter(CalendarEvent.starts_at >= start)
    if end:
        query = query.filter(CalendarEvent.starts_at <= end)
    if event_type:
        query = query.filter(CalendarEvent.event_type == event_type)
    if related_entity:
        query = query.filter(CalendarEvent.related_entity == related_entity)
        if related_id:
            query = query.filter(CalendarEvent.related_id == related_id)

    events = query.order_by(CalendarEvent.starts_at.asc()).all()
    return [build_response(e) for e in events]


@router.get("/{event_id}", response_model=CalendarEventResponse)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("calendar")),
):
    event = db.query(CalendarEvent).get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return build_response(event)


@router.patch("/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: int,
    data: CalendarEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("calendar")),
):
    event = db.query(CalendarEvent).get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = data.model_dump(exclude_unset=True)
    if "event_type" in update_data and update_data["event_type"] not in VALID_EVENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid event_type: {update_data['event_type']}")

    for field, value in update_data.items():
        setattr(event, field, value)

    if event.ends_at and event.starts_at and event.ends_at < event.starts_at:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

    db.commit()
    db.refresh(event)
    return build_response(event)


@router.delete("/{event_id}", status_code=200)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("calendar")),
):
    event = db.query(CalendarEvent).get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"detail": "Event deleted"}


@router.post("/sync-auto")
def sync_auto_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("calendar")),
):
    """Generate FOLLOW_UP calendar events from tasks with due dates and
    overdue invoices, and DEADLINE events from milestones. Idempotent.
    """
    from app.models.auth import Task, Milestone, Invoice

    created = 0
    due_tasks = (
        db.query(Task)
        .filter(Task.due_date != None, Task.status.in_(["TODO", "IN_PROGRESS"]))  # noqa: E711
        .all()
    )
    existing_map = {
        (e.related_entity, e.related_id)
        for e in db.query(CalendarEvent).filter(CalendarEvent.event_type == "FOLLOW_UP").all()
    }
    for task in due_tasks:
        if ("task", task.id) in existing_map:
            continue
        db.add(CalendarEvent(
            title=f"Follow up: {task.title}",
            event_type="FOLLOW_UP",
            starts_at=task.due_date,
            related_entity="task",
            related_id=task.id,
            created_by=current_user.id,
        ))
        created += 1

    for inv in db.query(Invoice).filter(Invoice.status == "OVERDUE").all():
        if ("invoice", inv.id) in existing_map:
            continue
        db.add(CalendarEvent(
            title=f"Invoice overdue: {inv.invoice_number}",
            event_type="FOLLOW_UP",
            starts_at=inv.due_date,
            related_entity="invoice",
            related_id=inv.id,
            created_by=current_user.id,
        ))
        created += 1

    for ms in db.query(Milestone).filter(Milestone.due_date != None, Milestone.status != "COMPLETED").all():  # noqa: E711
        dup = db.query(CalendarEvent).filter(
            CalendarEvent.related_entity == "milestone",
            CalendarEvent.related_id == ms.id,
        ).first()
        if dup:
            dup.starts_at = ms.due_date
            continue
        db.add(CalendarEvent(
            title=f"Milestone due: {ms.name}",
            event_type="DEADLINE",
            starts_at=ms.due_date,
            related_entity="milestone",
            related_id=ms.id,
            created_by=current_user.id,
        ))
        created += 1

    db.commit()
    return {"detail": "Events synced", "created": created}