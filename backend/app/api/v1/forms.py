"""Public submission forms (spec §60) + newsletter signup (spec §62).

Every form type is stored on public_submissions so the CRM/sales pipeline can
follow up. Public routes are rate-limited per IP.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import rate_limit, get_current_user_dict
from app.models.spec import PublicSubmission, NewsletterSubscriber
from app.services.audit import log_action


router = APIRouter(prefix="/forms", tags=["public-forms"])
news_router = APIRouter(prefix="/newsletter", tags=["public-forms"])
admin_router = APIRouter(prefix="/admin/submissions", tags=["public-forms"])


class ContactPayload(BaseModel):
    name: str
    email: EmailStr
    phone: str
    subject: Optional[str] = None
    message: str


class StartProjectPayload(BaseModel):
    name: str
    email: EmailStr
    phone: str
    whatsapp: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    preferred_technology: Optional[str] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    idea: str
    expected_outcome: Optional[str] = None


class CollaborationPayload(BaseModel):
    name: str
    email: EmailStr
    phone: str
    company: Optional[str] = None
    collaboration_type: Optional[str] = None
    message: str


class NewsletterPayload(BaseModel):
    email: EmailStr
    name: Optional[str] = None


def _submit(db: Session, form_type: str, payload: dict, request: Request) -> dict:
    sub = PublicSubmission(form_type=form_type, **payload)
    sub.created_ip = request.client.host if request.client else None
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "form_type": form_type, "created_at": sub.created_at}


@router.post("/contact")
def submit_contact(data: ContactPayload, db: Session = Depends(get_db),
                   request: Request = Depends(rate_limit())):
    return _submit(db, "contact", data.model_dump(), request)


@router.post("/start-project")
def submit_start_project(data: StartProjectPayload, db: Session = Depends(get_db),
                         request: Request = Depends(rate_limit())):
    return _submit(db, "start_project", data.model_dump(), request)


@router.post("/collaboration")
def submit_collaboration(data: CollaborationPayload, db: Session = Depends(get_db),
                         request: Request = Depends(rate_limit())):
    return _submit(db, "collaboration", data.model_dump(), request)


@router.post("/project-submission")
def submit_project_idea(data: StartProjectPayload, db: Session = Depends(get_db),
                        request: Request = Depends(rate_limit())):
    return _submit(db, "project_submission", data.model_dump(), request)


@news_router.post("")
def subscribe(data: NewsletterPayload, db: Session = Depends(get_db),
              request: Request = Depends(rate_limit())):
    existing = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == data.email).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
        return {"detail": "Subscribed (already on the list)", "subscribed": True}
    sub = NewsletterSubscriber(email=data.email, name=data.name, is_active=True,
                               source="website", subscribed_at=datetime.utcnow())
    db.add(sub)
    db.commit()
    return {"detail": "Subscribed", "subscribed": True}


@admin_router.get("/")
def list_submissions(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
                     form_type: Optional[str] = None, limit: int = 100):
    q = db.query(PublicSubmission).order_by(PublicSubmission.created_at.desc())
    if form_type:
        q = q.filter(PublicSubmission.form_type == form_type)
    subs = q.limit(limit).all()
    return [
        {
            "id": s.id,
            "form_type": s.form_type,
            "name": s.name,
            "email": s.email,
            "phone": s.phone,
            "company": s.company,
            "subject": s.subject,
            "message": s.message,
            "industry": s.industry,
            "preferred_technology": s.preferred_technology,
            "budget": s.budget,
            "timeline": s.timeline,
            "created_ip": s.created_ip,
            "converted_lead_id": s.converted_lead_id,
            "created_at": s.created_at,
        }
        for s in subs
    ]


@admin_router.get("/newsletter")
def list_newsletter(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
                    limit: int = 200):
    subs = db.query(NewsletterSubscriber).order_by(NewsletterSubscriber.subscribed_at.desc()).limit(limit).all()
    return [
        {"id": s.id, "email": s.email, "name": s.name, "is_active": s.is_active,
         "source": s.source, "subscribed_at": s.subscribed_at}
        for s in subs
    ]


@admin_router.post("/{submission_id}/convert")
def convert_submission(submission_id: int, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user_dict)):
    """Mark a submission as converted to a lead (creates CRM lead)."""
    from datetime import datetime
    from app.models.auth import Contact as ContactModel, Lead
    s = db.query(PublicSubmission).get(submission_id)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    # Upsert contact
    contact = None
    if s.email:
        contact = db.query(ContactModel).filter(ContactModel.email == s.email).first()
    if not contact:
        contact = ContactModel(
            email=s.email or f"{submission_id}@submission.local",
            first_name=(s.name or "Unknown").split(" ")[0],
            last_name=" ".join((s.name or "").split(" ")[1:]),
            phone=s.phone,
            whatsapp=s.whatsapp,
            company_name=s.company,
            notes=s.message,
        )
        db.add(contact)
        db.flush()

    lead = Lead(
        lead_number=f"L-{datetime.utcnow():%Y%m%d}-{submission_id:04d}",
        contact_id=contact.id,
        owner_id=None,
        status="NEW",
        source=s.form_type,
        estimated_budget=s.budget,
        estimated_timeline=s.timeline,
        priority="MEDIUM",
    )
    db.add(lead)
    db.flush()
    s.converted_lead_id = lead.id
    log_action(db, current_user["id"], "convert", "public_forms", "submission", s.id,
               new_value={"lead_id": lead.id})
    db.commit()
    return {"detail": "Submission converted", "lead_id": lead.id}