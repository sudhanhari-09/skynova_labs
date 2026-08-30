"""Email service: real SMTP delivery when configured, EmailLog recording always.

Emails are always recorded in `email_logs` (status SENT when the external SMTP
send succeeded, SIMULATED when no provider is configured so local development
never breaks, FAILED with the captured error otherwise). Uses the matching
`email_templates` when a template slug is supplied.
"""
from datetime import datetime
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.spec import EmailLog, EmailTemplate


def get_template(db: Session, slug: str) -> Optional[EmailTemplate]:
    return db.query(EmailTemplate).filter(EmailTemplate.slug == slug).first()


def _send_email(to_email: str, subject: str, body: str, html: Optional[str] = None) -> bool:
    """True when the email was actually handed to an SMTP server."""
    if not settings.smtp_host or settings.smtp_host == "smtp.example.com":
        return False
    try:
        msg = MIMEMultipart("alternative") if html else MIMEText(body or "", "plain")
        if html:
            msg.attach(MIMEText(body or "", "plain"))
            msg.attach(MIMEText(html, "html"))
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from or (settings.smtp_user or "no-reply@projectlabs.local")
        msg["To"] = to_email
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_user:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except smtplib.SMTPException as exc:
        settings_last_error = str(exc)
        return False


def send_email(
    db: Session,
    to_email: str,
    subject: str,
    body: str,
    template_slug: Optional[str] = None,
    related_entity: Optional[str] = None,
    related_id: Optional[int] = None,
) -> EmailLog:
    """Send an email and record it on the email_logs table."""
    template = get_template(db, template_slug) if template_slug else None
    html = template.body_html if template else None
    subject = subject or (template.subject if template else "")
    if template and template.variables:
        try:
            rendered = body.format(**template.variables)
        except (KeyError, ValueError):
            rendered = body
        body = rendered

    sent = _send_email(to_email, subject, body, html)
    status = "SENT" if sent else "SIMULATED"
    log = EmailLog(
        recipient=to_email,
        template_id=template.id if template else None,
        subject=subject,
        status=status,
        provider="smtp" if sent else "simulated",
        related_entity=related_entity,
        related_id=related_id,
        email_timestamp=datetime.utcnow(),
    )
    db.add(log)
    db.flush()
    return log