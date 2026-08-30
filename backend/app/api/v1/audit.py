"""Audit logs (spec §65 admin area / §58 RBAC auditability) - read-only."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import AuditLog
from app.models.auth import User


router = APIRouter(prefix="/admin/audit", tags=["audit"])


def _log_dict(l: AuditLog) -> dict:
    actor_name = None
    if l.actor:
        actor_name = (l.actor.first_name + " " + l.actor.last_name).strip() or l.actor.email
    return {
        "id": l.id,
        "user_id": l.user_id,
        "actor": actor_name,
        "action": l.action,
        "module": l.module,
        "entity_type": l.entity_type,
        "entity_id": l.entity_id,
        "old_value": l.old_value,
        "new_value": l.new_value,
        "request_ip": l.request_ip,
        "request_method": l.request_method,
        "request_path": l.request_path,
        "user_agent": l.user_agent,
        "timestamp": l.timestamp,
    }


@router.get("/")
def list_audit_logs(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
                    module: Optional[str] = None, action: Optional[str] = None,
                    entity_type: Optional[str] = None, user_id: Optional[int] = None,
                    skip: int = 0, limit: int = 100):
    q = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if module:
        q = q.filter(AuditLog.module == module)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    logs = q.offset(skip).limit(limit).all()
    return {"count": len(logs), "items": [_log_dict(l) for l in logs]}


@router.get("/stats")
def audit_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    from sqlalchemy import func
    rows = db.query(AuditLog.action, func.count(AuditLog.id)).group_by(AuditLog.action).all()
    modules = db.query(AuditLog.module, func.count(AuditLog.id)).group_by(AuditLog.module).all()
    return {
        "total": db.query(AuditLog).count(),
        "by_action": {a: c for a, c in rows},
        "by_module": {m: c for m, c in modules},
    }