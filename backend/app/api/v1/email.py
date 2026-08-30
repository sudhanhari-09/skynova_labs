"""Email templates + delivery logs (spec §44 notification → email integration)."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import EmailTemplate, EmailLog
from app.services.email_service import send_email
from app.services.audit import log_action


router = APIRouter(prefix="/admin/email", tags=["email"])
admin_router = router
send_router = APIRouter(prefix="/email", tags=["email"])


class TemplatePayload(BaseModel):
    name: str
    slug: Optional[str] = None
    subject: str
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: bool = True


class SendEmailPayload(BaseModel):
    recipient: str
    subject: str
    body: str
    template_slug: Optional[str] = None


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _template_dict(t: EmailTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "subject": t.subject,
        "body_html": t.body_html,
        "body_text": t.body_text,
        "variables": t.variables or [],
        "is_active": t.is_active,
        "created_at": t.created_at,
    }


def _log_dict(l: EmailLog) -> dict:
    return {
        "id": l.id,
        "recipient": l.recipient,
        "template_id": l.template_id,
        "subject": l.subject,
        "status": l.status,
        "provider": l.provider,
        "error": l.error,
        "message_id": l.message_id,
        "related_entity": l.related_entity,
        "related_id": l.related_id,
        "email_timestamp": l.email_timestamp,
    }


@admin_router.get("/templates")
def list_templates(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_template_dict(t) for t in db.query(EmailTemplate).order_by(EmailTemplate.name).all()]


@admin_router.post("/templates", status_code=status.HTTP_201_CREATED)
def create_template(data: TemplatePayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    t = EmailTemplate(**data.model_dump(exclude_unset=True))
    t.slug = t.slug or _slugify(t.name)
    db.add(t)
    db.flush()
    log_action(db, current_user["id"], "create", "email", "template", t.id, new_value={"slug": t.slug})
    db.commit()
    db.refresh(t)
    return _template_dict(t)


@admin_router.patch("/templates/{template_id}")
def update_template(template_id: int, data: TemplatePayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    t = db.query(EmailTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    db.commit()
    return _template_dict(t)


@admin_router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    t = db.query(EmailTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"detail": "Template deleted"}


@admin_router.get("/logs")
def list_logs(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
              limit: int = 100):
    logs = db.query(EmailLog).order_by(EmailLog.email_timestamp.desc()).limit(limit).all()
    return [_log_dict(l) for l in logs]


@send_router.post("/send")
def send_email_endpoint(data: SendEmailPayload, db: Session = Depends(get_db),
                        current_user: dict = Depends(get_current_user_dict)):
    log = send_email(db, data.recipient, data.subject, data.body, template_slug=data.template_slug)
    db.commit()
    return _log_dict(log)