"""Notification + automation dispatch service.

- create_notification: in-app notification rows.
- dispatch_event: runs active automation rules whose trigger matches, then
  performs the configured channels (email / WhatsApp).

Email/WhatsApp sending goes through app.services.email_service / .whatsapp_service,
which record a log row for every attempt (SIMULATED unless a real provider is
configured) so automation never blocks the primary flow in local development.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.operations import (
    Notification, AutomationRule, AutomationRun,
)
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp
from app.services.audit import record_event


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    body: Optional[str] = None,
    notification_type: str = "GENERAL",
    related_entity: Optional[str] = None,
    related_id: Optional[int] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        related_entity=related_entity,
        related_id=related_id,
    )
    db.add(notification)
    db.flush()
    return notification


def _send_email(to_email: str, subject: str, body: str) -> bool:
    """Send via SMTP when configured. Returns True on success/false when
    environment is not configured (simulated)."""
    if not settings.smtp_host or settings.smtp_host == "smtp.example.com":
        return False
    try:
        from email.mime.text import MIMEText
        import smtplib
        msg = MIMEText(body or "", "plain")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_user or "no-reply@projectlabs.local"
        msg["To"] = to_email
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_user:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception:
        return False


def _send_whatsapp(phone: str, message: str) -> bool:
    """Send via a WhatsApp Business API key when configured.

    Without a provider configured this returns False (simulated) so rules do not
    fail in local development.
    """
    if not settings.whatsapp_api_key:
        return False
    # Provider integration point: POST to the configured WhatsApp Business API
    # endpoint using settings.whatsapp_api_key. Kept as a documented stub so the
    # platform can connect to a live provider in production.
    return False


def apply_rule(db: Session, rule: AutomationRule, entity: str, entity_id: int, payload: dict) -> AutomationRun:
    """Execute a single automation rule against an event payload."""
    run = AutomationRun(
        rule_id=rule.id,
        trigger_event=rule.trigger_event,
        related_entity=entity,
        related_id=entity_id,
        status="PENDING",
        channels=[],
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.flush()

    # Evaluate conditions before executing the rule
    from app.services.conditions import evaluate
    if not evaluate(rule.condition, payload):
        run.status = "SKIPPED"
        run.completed_at = datetime.utcnow()
        db.flush()
        return run

    action = rule.action or {}
    channels = action.get("channels") or ["email"]
    recipients = action.get("recipients") or []

    dispatched = []
    errors = []

    # Simple template substitution for the notification text.
    template = action.get("template", "")
    subject = (template or "").format(**payload) if template else action.get("subject", rule.name)

    for channel in channels:
        if channel == "email":
            to = recipients[0] if recipients else (payload.get("email") or payload.get("to_email"))
            if to:
                log = send_email(db, to, subject, template or subject, related_entity=entity, related_id=entity_id)
                dispatched.append(f"email:{log.status.lower()}")
        elif channel == "whatsapp":
            phone = payload.get("phone") or payload.get("to_phone")
            if phone:
                log = send_whatsapp(db, phone, template or subject, related_entity=entity, related_id=entity_id)
                dispatched.append(f"whatsapp:{log.status.lower()}")

    # Always record an in-app notification for the rule target so admins see it.
    if recipients:
        for r in recipients[:3]:
            try:
                create_notification(
                    db,
                    user_id=int(r),
                    title=f"{rule.name} fired",
                    body=template or subject,
                    notification_type="AUTOMATION",
                    related_entity=entity,
                    related_id=entity_id,
                )
            except (TypeError, ValueError):
                continue

    run.status = "SUCCESS" if not errors else "FAILED"
    run.channels = dispatched
    run.error = "; ".join(errors) if errors else None
    run.completed_at = datetime.utcnow()
    db.flush()
    return run


def dispatch_event(
    db: Session,
    trigger_event: str,
    related_entity: str,
    related_id: int,
    payload: dict,
) -> list:
    """Record the automation event and run every active matching rule."""
    record_event(db, trigger_event, related_entity, related_id, payload)
    rules = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.trigger_event == trigger_event,
            AutomationRule.is_active == True,  # noqa: E712
        )
        .all()
    )
    runs = []
    for rule in rules:
        try:
            runs.append(apply_rule(db, rule, related_entity, related_id, payload))
        except Exception as exc:  # never let automation break the primary flow
            db.rollback()
            run = AutomationRun(
                rule_id=rule.id,
                trigger_event=trigger_event,
                related_entity=related_entity,
                related_id=related_id,
                status="FAILED",
                error=str(exc),
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
            )
            db.add(run)
            db.flush()
            runs.append(run)
    db.flush()
    return runs