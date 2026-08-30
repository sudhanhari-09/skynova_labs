from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import (
    QuoteRequest, Contact, Lead, ProjectType, ProjectSubcategory,
    RequirementQuestion, UserRole, RolePermission, Activity
)
from app.models.operations import Notification
from app.services.notifications import create_notification, dispatch_event
from app.core.config import settings
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


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
    
    # Check for existing contact with same email
    contact = db.query(Contact).filter(Contact.email == data.email).first()
    if not contact:
        contact = Contact(
            email=data.email,
            first_name=data.name.split()[-1] if data.name else "",
            last_name=" ".join(data.name.split()[:-1]) if data.name else "",
            phone=data.phone,
            whatsapp=data.whatsapp,
            company_name=data.company_name,
            designation=data.designation,
        )
        db.add(contact)
        db.flush()
    
    # Create QuoteRequest
    # Generate request number: PL-Q-XXXXXX
    last_request = db.query(QuoteRequest).order_by(QuoteRequest.id.desc()).first()
    if last_request:
        last_num = int(last_request.request_number.split("-")[-1])
        new_num = last_num + 1
    else:
        new_num = 1
    
    request_number = f"PL-Q-{new_num:06d}"
    
    quote_request = QuoteRequest(
        request_number=request_number,
        project_type_id=project_type.id,
        subcategory_id=subcategory.id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        whatsapp=data.whatsapp,
        company_name=data.company_name,
        designation=data.designation,
        budget=data.budget,
        timeline=data.timeline,
        target_audience=data.target_audience,
        existing_system=data.existing_system,
        expected_launch=data.expected_launch,
        detailed_requirements=data.detailed_requirements,
        status="NEW",
        source=data.source or "website",
    )
    db.add(quote_request)
    db.flush()
    
    # Create Lead linked to QuoteRequest
    last_lead = db.query(Lead).order_by(Lead.id.desc()).first()
    if last_lead:
        last_lead_num = int(last_lead.lead_number.split("-")[-1])
        new_lead_num = last_lead_num + 1
    else:
        new_lead_num = 1
    
    lead_number = f"PL-L-{new_lead_num:06d}"
    
    lead = Lead(
        lead_number=lead_number,
        contact_id=contact.id,
        quote_request_id=quote_request.id,
        project_type_id=project_type.id,
        subcategory_id=subcategory.id,
        status="NEW",
        priority="MEDIUM",
        source=data.source or "website",
        estimated_budget=data.budget,
        estimated_timeline=data.timeline,
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
    due_date = datetime.utcnow() + __import__('datetime').timedelta(days=3)
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