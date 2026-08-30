"""WhatsApp service: Evolution API delivery when configured, WhatsappLog always.

Uses the Evolution API (spec §55) when EVOLUTION_API_URL / EVOLUTION_API_KEY /
EVOLUTION_INSTANCE are configured; otherwise messages are recorded as SIMULATED
so local development keeps working without a provider.
"""
from datetime import datetime
from typing import Optional
import urllib.request
import urllib.error
import json

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.spec import WhatsappLog, WhatsappTemplate


def get_template(db: Session, slug: str) -> Optional[WhatsappTemplate]:
    return db.query(WhatsappTemplate).filter(WhatsappTemplate.name == slug).first()


def _send_whatsapp(phone: str, message: str) -> bool:
    """POST to the Evolution API instance. True only on real delivery."""
    if not settings.evolution_api_url or not settings.evolution_instance:
        return False
    try:
        url = f"{settings.evolution_api_url.rstrip('/')}/message/sendText/{settings.evolution_instance}"
        data = json.dumps({"number": phone, "text": message}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "apikey": settings.evolution_api_key or settings.evolution_instance,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200 or resp.status == 201
    except (urllib.error.URLError, OSError):
        return False


def send_whatsapp(
    db: Session,
    phone: str,
    message: str,
    template_slug: Optional[str] = None,
    related_entity: Optional[str] = None,
    related_id: Optional[int] = None,
) -> WhatsappLog:
    """Send a WhatsApp message and record it on the whatsapp_logs table."""
    template = get_template(db, template_slug) if template_slug else None
    if template and template.variables:
        try:
            message = message.format(**template.variables)
        except (KeyError, ValueError):
            pass

    sent = _send_whatsapp(phone, message)
    status = "SENT" if sent else "SIMULATED"
    log = WhatsappLog(
        phone=phone,
        template_id=template.id if template else None,
        status=status,
        provider="evolution" if sent else "simulated",
        related_entity=related_entity,
        related_id=related_id,
        timestamp=datetime.utcnow(),
    )
    db.add(log)
    db.flush()
    return log