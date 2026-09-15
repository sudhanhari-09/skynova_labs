from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db import get_db
from app.models.auth import (
    QuoteRequest, Contact, Lead, ProjectType, ProjectSubcategory,
    RequirementQuestion, UserRole, RolePermission, Activity
)
from app.models.operations import Notification
from app.services.notifications import create_notification, dispatch_event
from app.services.numbers import next_request_number, next_lead_number
from app.core.config import settings
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_core import PydanticCustomError
from typing import Optional, List
from datetime import datetime, timedelta, date
import logging

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/admin/quote-requests", tags=["admin-quote-requests"])


# Pydantic Schemas - Public (for submission)

class QuoteRequestPublicCreate(BaseModel):
    project_type_name: str
    subcategory_name: str
    project_type_slug: str
    subcategory_slug: str
    name: str
    email: EmailStr
    phone: str
    whatsapp: str
    company_name: Optional[str] = None
    designation: Optional[str] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    target_audience: Optional[str] = None
    existing_system: Optional[str] = None
    expected_launch: Optional[str] = None
    detailed_requirements: Optional[str] = None
    source: Optional[str] = "website"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise PydanticCustomError('value_error', 'Please enter a valid name.')
        if len(v) > 150:
            raise PydanticCustomError('value_error', 'Name must be 150 characters or fewer.')
        import re
        if re.fullmatch(r'\d+', v):
            raise PydanticCustomError('value_error', 'Please enter a valid name (not just numbers).')
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise PydanticCustomError('value_error', 'Please enter a valid phone number.')
        import re
        if not re.fullmatch(r"[+]?[\d\s\-().]{7,20}", v):
            raise PydanticCustomError('value_error', 'Please enter a valid phone number.')
        return v

    @field_validator("whatsapp")
    @classmethod
    def validate_whatsapp(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise PydanticCustomError('value_error', 'Please enter a valid WhatsApp number.')
        import re
        if not re.fullmatch(r"[+]?[\d\s\-().]{7,20}", v):
            raise PydanticCustomError('value_error', 'Please enter a valid WhatsApp number.')
        return v

    @field_validator("budget")
    @classmethod
    def validate_budget(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()
        import re
        if not re.fullmatch(r"[1-9]\d{0,10}", v):
            raise PydanticCustomError('value_error', 'Please enter a valid budget amount in INR.')
        num = int(v)
        if num < 1 or num > 99999999999:
            raise PydanticCustomError('value_error', 'Please enter a valid budget amount in INR.')
        return v

    @field_validator("timeline")
    @classmethod
    def validate_timeline(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()
        import re
        if not re.fullmatch(r"[1-9]\d{0,2}", v):
            raise PydanticCustomError('value_error', 'Please enter a valid timeline in months.')
        num = int(v)
        if num < 1 or num > 120:
            raise PydanticCustomError('value_error', 'Please enter a valid timeline in months.')
        return v

    @field_validator("expected_launch")
    @classmethod
    def validate_expected_launch(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        import re
        m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", v.strip())
        if not m:
            raise PydanticCustomError('value_error', 'Please enter a valid date in YYYY-MM-DD format.')
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 1900 or year > 2100:
            raise PydanticCustomError('value_error', 'Please enter a valid date in YYYY-MM-DD format.')
        if month < 1 or month > 12:
            raise PydanticCustomError('value_error', 'Please enter a valid date in YYYY-MM-DD format.')
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if (year % 4 == 0 and year % 100 != 0) or year % 400 == 0:
            days_in_month[1] = 29
        if day < 1 or day > days_in_month[month - 1]:
            raise PydanticCustomError('value_error', 'Please enter a valid date in YYYY-MM-DD format.')
        # Reject past dates — the expected_launch must be a future date
        try:
            input_date = datetime(year, month, day)
            if input_date <= datetime.utcnow():
                raise PydanticCustomError('value_error', 'Please enter a future date.')
        except ValueError:
            raise PydanticCustomError('value_error', 'Please enter a valid date in YYYY-MM-DD format.')
        return v.strip()

    @field_validator("company_name", "designation")
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()
        if len(v) < 2:
            raise PydanticCustomError('value_error', 'Please enter a valid text.')
        return v

    @field_validator("target_audience", "existing_system")
    @classmethod
    def validate_optional_long_text(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()
        if len(v) < 2:
            raise PydanticCustomError('value_error', 'Please enter a valid text.')
        return v

    @field_validator("detailed_requirements")
    @classmethod
    def validate_requirements(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            raise PydanticCustomError('value_error', 'Please enter your requirements.')
        v = v.strip()
        if len(v) < 10:
            raise PydanticCustomError('value_error', 'Please provide more detail in your requirements (at least 10 characters).')
        return v


class QuoteRequestPublicResponse(BaseModel):
    id: int
    request_number: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Pydantic Schemas - Internal (CRM)

class QuoteRequestFilter(BaseModel):
    status: Optional[str] = None
    project_type_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    owner_id: Optional[int] = None
    priority: Optional[str] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None


class QuoteRequestUpdate(BaseModel):
    status: Optional[str] = None
    project_type_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    target_audience: Optional[str] = None
    existing_system: Optional[str] = None
    expected_launch: Optional[datetime] = None
    detailed_requirements: Optional[str] = None


@router.post("/", response_model=QuoteRequestPublicResponse, status_code=status.HTTP_201_CREATED)
async def create_quote_request(
    data: QuoteRequestPublicCreate,
    db: Session = Depends(get_db),
):
    """Create a quote request from public submission."""
    
    # Validate project type exists and is active
    project_type = db.query(ProjectType).filter(
        ProjectType.slug == data.project_type_slug,
        ProjectType.is_active == True
    ).first()
    if not project_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project type",
        )
    
    # Validate subcategory exists, is active, and belongs to this project type
    subcategory = db.query(ProjectSubcategory).filter(
        ProjectSubcategory.slug == data.subcategory_slug,
        ProjectSubcategory.is_active == True,
        ProjectSubcategory.project_type_id == project_type.id
    ).first()
    if not subcategory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subcategory for this project type",
        )
    
    # Check for existing contact with same email (normalize email for dedup)
    normalized_email = data.email.strip().lower() if data.email else ""
    contact = db.query(Contact).filter(Contact.email == normalized_email).first()
    if not contact:
        name_parts = (data.name or "").strip().split()
        contact = Contact(
            email=normalized_email,
            first_name=name_parts[0] if name_parts else "",
            last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
            phone=(data.phone or "").strip() or None,
            whatsapp=(data.whatsapp or "").strip() or None,
            company_name=(data.company_name or "").strip() or None,
            designation=(data.designation or "").strip() or None,
        )
        db.add(contact)
        db.flush()
    else:
        # Update existing contact with latest info from the submission
        if data.phone and data.phone.strip():
            contact.phone = data.phone.strip()
        if data.whatsapp and data.whatsapp.strip():
            contact.whatsapp = data.whatsapp.strip()
        if data.company_name and data.company_name.strip():
            contact.company_name = data.company_name.strip()
        if data.designation and data.designation.strip():
            contact.designation = data.designation.strip()
    
    # Create QuoteRequest — generate unique request number atomically
    request_number = next_request_number(db)
    quote_request = QuoteRequest(
        request_number=request_number,
        project_type_id=project_type.id,
        subcategory_id=subcategory.id,
        name=data.name.strip() if data.name else "",
        email=data.email.strip().lower() if data.email else "",
        phone=data.phone.strip() if data.phone else None,
        whatsapp=data.whatsapp.strip() if data.whatsapp else None,
        company_name=data.company_name.strip() if data.company_name else None,
        designation=data.designation.strip() if data.designation else None,
        budget=data.budget.strip() if data.budget else None,
        timeline=data.timeline.strip() if data.timeline else None,
        target_audience=data.target_audience.strip() if data.target_audience else None,
        existing_system=data.existing_system.strip() if data.existing_system else None,
        expected_launch=datetime.strptime(data.expected_launch, "%Y-%m-%d") if data.expected_launch else None,
        detailed_requirements=data.detailed_requirements.strip() if data.detailed_requirements else None,
        status="NEW",
        source=data.source or "website",
    )
    db.add(quote_request)
    db.flush()
    
    # Create Lead — generate unique lead number atomically
    lead_number = next_lead_number(db)
    lead = Lead(
        lead_number=lead_number,
        contact_id=contact.id,
        quote_request_id=quote_request.id,
        project_type_id=project_type.id,
        subcategory_id=subcategory.id,
        status="NEW",
        priority="MEDIUM",
        source=data.source or "website",
        estimated_budget=data.budget.strip() if data.budget else None,
        estimated_timeline=data.timeline.strip() if data.timeline else None,
    )
    db.add(lead)
    db.flush()
    
    # Create Activity: Lead Created
    activity = Activity(
        activity_type="lead_created",
        title="Lead Created",
        description=f"Quote request {quote_request.request_number} created lead {lead.lead_number}",
        lead_id=lead.id,
        quote_request_id=quote_request.id,
        performed_by=None,  # System-generated
        metadata={"source": data.source or "website"},
    )
    db.add(activity)
    
    # Create Follow-Up: Initial follow-up
    from app.models.auth import FollowUp
    due_date = datetime.utcnow() + timedelta(days=3)
    followup = FollowUp(
        title="Initial follow-up on quote request",
        description=f"Follow up on quote request {quote_request.request_number}",
        due_at=due_date,
        status="PENDING",
        lead_id=lead.id,
        created_by=None,
    )
    db.add(followup)
    
    db.commit()
    db.refresh(quote_request)
    db.refresh(lead)

    # Customer confirmation + automation on submission
    try:
        dispatch_event(
            db,
            "QUOTE_REQUEST_CREATED",
            "quote_request",
            quote_request.id,
            {
                "request_number": quote_request.request_number,
                "name": data.name,
                "email": data.email,
                "to_email": data.email,
                "phone": data.phone,
                "source": data.source or "website",
            },
        )
        create_notification(
            db,
            user_id=1,
            title="New Quote Request",
            body=f"New quote request {quote_request.request_number} from {data.email}",
            notification_type="WORKFLOW",
            related_entity="quote_request",
            related_id=quote_request.id,
        )
        db.commit()
        db.refresh(quote_request)
    except Exception:
        db.rollback()
    
    return QuoteRequestPublicResponse(
        id=quote_request.id,
        request_number=quote_request.request_number,
        status=quote_request.status,
        created_at=quote_request.created_at,
    )


@router.get("/", response_model=List[QuoteRequestPublicResponse])
async def list_quote_requests(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List quote requests with filtering (admin only)."""
    query = db.query(QuoteRequest)
    if status:
        query = query.filter(QuoteRequest.status == status)
    return query.offset(skip).limit(limit).all()


@router.get("/{quote_request_id}", response_model=QuoteRequestPublicResponse)
async def get_quote_request(
    quote_request_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific quote request."""
    quote_request = db.query(QuoteRequest).get(quote_request_id)
    if not quote_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote request not found",
        )
    return QuoteRequestPublicResponse(
        id=quote_request.id,
        request_number=quote_request.request_number,
        status=quote_request.status,
        created_at=quote_request.created_at,
    )


@router.patch("/{quote_request_id}", response_model=QuoteRequestPublicResponse)
async def update_quote_request(
    quote_request_id: int,
    data: QuoteRequestUpdate,
    db: Session = Depends(get_db),
):
    """Update a quote request (admin only)."""
    quote_request = db.query(QuoteRequest).get(quote_request_id)
    if not quote_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote request not found",
        )
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(quote_request, field, value)
    
    db.commit()
    db.refresh(quote_request)
    
    return QuoteRequestPublicResponse(
        id=quote_request.id,
        request_number=quote_request.request_number,
        status=quote_request.status,
        created_at=quote_request.created_at,
    )
