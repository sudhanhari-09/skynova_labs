"""WhatsApp templates + delivery logs (spec §55 messaging)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import WhatsappTemplate, WhatsappLog
from app.services.whatsapp_service import send_whatsapp
from app.services.audit import log_action


router = APIRouter(prefix="/admin/whatsapp", tags=["whatsapp"])
send_router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class TemplatePayload(BaseModel):
    name: str
    body: str
    variables: Optional[List[str]] = None
    is_active: bool = True


class SendPayload(BaseModel):
    phone: str
    message: str
    template_name: Optional[str] = None


def _template_dict(t: WhatsappTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "body": t.body,
        "variables": t.variables or [],
        "is_active": t.is_active,
        "created_at": t.created_at,
    }


def _log_dict(l: WhatsappLog) -> dict:
    return {
        "id": l.id,
        "phone": l.phone,
        "template_id": l.template_id,
        "status": l.status,
        "provider": l.provider,
        "error": l.error,
        "message_id": l.message_id,
        "wa_id": l.wa_id,
        "related_entity": l.related_entity,
        "related_id": l.related_id,
        "timestamp": l.timestamp,
    }


@router.get("/templates")
def list_templates(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_template_dict(t) for t in db.query(WhatsappTemplate).order_by(WhatsappTemplate.name).all()]


@router.post("/templates", status_code=status.HTTP_201_CREATED)
def create_template(data: TemplatePayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    t = WhatsappTemplate(**data.model_dump(exclude_unset=True))
    db.add(t)
    db.flush()
    log_action(db, current_user["id"], "create", "whatsapp", "template", t.id, new_value={"name": t.name})
    db.commit()
    db.refresh(t)
    return _template_dict(t)


@router.patch("/templates/{template_id}")
def update_template(template_id: int, data: TemplatePayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    t = db.query(WhatsappTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    db.commit()
    return _template_dict(t)


@router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    t = db.query(WhatsappTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"detail": "Template deleted"}


@router.get("/logs")
def list_logs(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
              limit: int = 100):
    logs = db.query(WhatsappLog).order_by(WhatsappLog.timestamp.desc()).limit(limit).all()
    return [_log_dict(l) for l in logs]


@send_router.post("/send")
def send_whatsapp_endpoint(data: SendPayload, db: Session = Depends(get_db),
                           current_user: dict = Depends(get_current_user_dict)):
    log = send_whatsapp(db, data.phone, data.message, template_slug=data.template_name)
    db.commit()
    return _log_dict(log)