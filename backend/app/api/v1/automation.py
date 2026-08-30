"""Workflow automation (Phase 3).

Manage automation rules and inspect run history. Rules execute in real time via
`services/notifications.dispatch_event` whenever a matching business event fires.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import AutomationRule, AutomationRun
from app.services.audit import log_action


router = APIRouter(prefix="/admin/automation", tags=["admin-automation"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RuleCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    trigger_event: str = Field(..., min_length=1)
    condition: Optional[dict] = None
    action: dict = Field(default_factory=dict)
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_event: Optional[str] = None
    condition: Optional[dict] = None
    action: Optional[dict] = None
    is_active: Optional[bool] = None


class RuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    trigger_event: str
    condition: Optional[dict] = None
    action: dict
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    runs_count: int = 0
    last_run_status: Optional[str] = None

    class Config:
        from_attributes = True


class RunResponse(BaseModel):
    id: int
    rule_id: int
    rule_name: Optional[str] = None
    trigger_event: str
    related_entity: Optional[str] = None
    related_id: Optional[int] = None
    status: str
    channels: Optional[list] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RunListResponse(BaseModel):
    runs: List[RunResponse]
    total: int


TRIGGER_EVENTS = [
    "NEW_LEAD", "QUOTATION_SENT", "CONTRACT_SENT", "CONTRACT_ACCEPTED",
    "INVOICE_SENT", "INVOICE_OVERDUE", "PAYMENT_RECEIVED", "SUPPORT_TICKET_CREATED",
]


def build_rule_response(db: Session, rule: AutomationRule) -> RuleResponse:
    latest = (
        db.query(AutomationRun)
        .filter(AutomationRun.rule_id == rule.id)
        .order_by(AutomationRun.created_at.desc())
        .first()
    )
    runs_count = db.query(AutomationRun).filter(AutomationRun.rule_id == rule.id).count()
    return RuleResponse(
        id=rule.id,
        name=rule.name,
        description=rule.description,
        trigger_event=rule.trigger_event,
        condition=rule.condition,
        action=rule.action,
        is_active=rule.is_active,
        created_by=rule.created_by,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
        runs_count=runs_count,
        last_run_status=latest.status if latest else None,
    )


def build_run_response(db: Session, run: AutomationRun) -> RunResponse:
    rule = db.query(AutomationRule).get(run.rule_id)
    return RunResponse(
        id=run.id,
        rule_id=run.rule_id,
        rule_name=rule.name if rule else None,
        trigger_event=run.trigger_event,
        related_entity=run.related_entity,
        related_id=run.related_id,
        status=run.status,
        channels=run.channels,
        error=run.error,
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/rules", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(
    data: RuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    if data.trigger_event not in TRIGGER_EVENTS:
        raise HTTPException(status_code=400, detail=f"Invalid trigger_event. Must be one of: {', '.join(TRIGGER_EVENTS)}")

    rule = AutomationRule(
        name=data.name,
        description=data.description,
        trigger_event=data.trigger_event,
        condition=data.condition,
        action=data.action,
        is_active=data.is_active,
        created_by=current_user.id,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    log_action(db, current_user.id, "create", "automation", "rule", rule.id, new_value={"name": rule.name, "trigger_event": rule.trigger_event})
    return build_rule_response(db, rule)


@router.get("/rules", response_model=List[RuleResponse])
def list_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    rules = db.query(AutomationRule).order_by(AutomationRule.created_at.desc()).all()
    return [build_rule_response(db, r) for r in rules]


@router.get("/rules/{rule_id}", response_model=RuleResponse)
def get_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    rule = db.query(AutomationRule).get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return build_rule_response(db, rule)


@router.patch("/rules/{rule_id}", response_model=RuleResponse)
def update_rule(
    rule_id: int,
    data: RuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    rule = db.query(AutomationRule).get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = data.model_dump(exclude_unset=True)
    if "trigger_event" in update_data and update_data["trigger_event"] not in TRIGGER_EVENTS:
        raise HTTPException(status_code=400, detail=f"Invalid trigger_event: {update_data['trigger_event']}")

    for field, value in update_data.items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    log_action(db, current_user.id, "update", "automation", "rule", rule.id, new_value=update_data)
    return build_rule_response(db, rule)


@router.delete("/rules/{rule_id}", status_code=200)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    rule = db.query(AutomationRule).get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    log_action(db, current_user.id, "delete", "automation", "rule", rule_id, old_value={"name": rule.name})
    db.delete(rule)
    db.commit()
    return {"detail": "Rule deleted"}


# ---------------------------------------------------------------------------
# Run history
# ---------------------------------------------------------------------------

@router.get("/runs", response_model=RunListResponse)
def list_runs(
    rule_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    trigger_event: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    query = db.query(AutomationRun)
    if rule_id:
        query = query.filter(AutomationRun.rule_id == rule_id)
    if status_filter:
        query = query.filter(AutomationRun.status == status_filter)
    if trigger_event:
        query = query.filter(AutomationRun.trigger_event == trigger_event)

    total = query.count()
    runs = query.order_by(AutomationRun.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return RunListResponse(
        runs=[build_run_response(db, r) for r in runs],
        total=total,
    )


@router.get("/runs/{run_id}", response_model=RunResponse)
def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    run = db.query(AutomationRun).get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return build_run_response(db, run)


# ---------------------------------------------------------------------------
# Automation events (spec §54 event bus)
# ---------------------------------------------------------------------------

class EventResponse(BaseModel):
    id: int
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    payload: Optional[dict] = None
    occurred_at: datetime
    consumed: bool
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    events: List[EventResponse]
    total: int


@router.get("/events", response_model=EventListResponse)
def list_events(
    event_type: Optional[str] = None,
    consumed: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    from app.models.spec import AutomationEvent
    query = db.query(AutomationEvent)
    if event_type:
        query = query.filter(AutomationEvent.event_type == event_type)
    if consumed is not None:
        query = query.filter(AutomationEvent.consumed == consumed)
    total = query.count()
    events = query.order_by(AutomationEvent.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return EventListResponse(events=[EventResponse.model_validate(e) for e in events], total=total)


@router.post("/events/{event_id}/consume")
def consume_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("automation")),
):
    from app.models.spec import AutomationEvent
    event = db.query(AutomationEvent).get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.consumed = True
    db.commit()
    return {"detail": "Event marked as consumed"}