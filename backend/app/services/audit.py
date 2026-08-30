"""Audit + automation-event helpers shared across routers.

- log_action: writes an immutable AuditLog row for every tracked mutation.
- record_event: writes an AutomationEvent that workflow rules can consume.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.spec import AuditLog, AutomationEvent


def log_action(
    db: Session,
    user_id: Optional[int],
    action: str,
    module: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    request=None,
) -> AuditLog:
    """Persist an audit record for a mutating operation."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        module=module,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        request_ip=request.client.host if request and request.client else None,
        request_method=request.method if request else None,
        request_path=request.url.path if request and hasattr(request, "url") else None,
        user_agent=request.headers.get("user-agent") if request and request.headers else None,
        timestamp=datetime.utcnow(),
    )
    db.add(entry)
    db.flush()
    return entry


def record_event(
    db: Session,
    event_type: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    payload: Optional[dict] = None,
    created_by: Optional[int] = None,
    db_import=None,
) -> AutomationEvent:
    """Write an automation event for rule consumption. Caller commits."""
    event = AutomationEvent(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
        occurred_at=datetime.utcnow(),
        created_by=created_by,
    )
    db.add(event)
    db.flush()
    return event