from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import (
    Quotation, QuotationItem, QuotationVersion, QuotationComment,
    Lead, Contact, User, Activity, Contract
)
from app.models.operations import Notification
from app.services.notifications import create_notification, dispatch_event
from app.api.deps import get_current_user_dict
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timedelta


router = APIRouter(prefix="/admin/quotations", tags=["admin-quotations"])


# Pydantic Schemas

class QuotationItemForm(BaseModel):
    item_type: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    unit: Optional[str] = None
    unit_price: Decimal = Field(decimal_places=2, ge=0)
    discount: Decimal = Field(default=0, decimal_places=2, ge=0)
    tax: Decimal = Field(default=0, decimal_places=2, ge=0)


class QuotationCreate(BaseModel):
    lead_id: int
    contact_id: Optional[int] = None
    title: str = Field(..., min_length=1)
    currency: str = "USD"
    validity_days: int = 30
    payment_terms: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    customer_message: Optional[str] = None


class QuotationUpdate(BaseModel):
    title: Optional[str] = None
    currency: Optional[str] = None
    validity_days: Optional[int] = None
    payment_terms: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    customer_message: Optional[str] = None


class QuotationResponse(BaseModel):
    id: int
    quotation_number: str
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    title: str
    version: str
    status: str
    currency: str
    subtotal: Decimal
    discount: Decimal
    discount_type: str
    tax: Decimal
    total: Decimal
    validity_days: int
    valid_until: Optional[datetime] = None
    estimated_timeline: Optional[str] = None
    payment_terms: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    customer_message: Optional[str] = None
    created_by: Optional[int] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    quotation_version_reference: Optional[str] = None
    previous_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items_count: int = 0
    
    class Config:
        from_attributes = True


class QuotationVersionCreate(BaseModel):
    version_number: str = "1"
    status: str = "DRAFT"
    notes: Optional[str] = None


class QuotationCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)
    is_internal: bool = True


# Helper function to calculate quotation totals
def calculate_quotation_totals(items: List[QuotationItem]) -> dict:
    subtotal = Decimal('0')
    total_discount = Decimal('0')
    total_tax = Decimal('0')
    total_total = Decimal('0')
    
    for item in items:
        item_subtotal = item.unit_price * item.quantity
        item_discount = item.discount
        item_tax = item.tax
        item_total = item_subtotal - item_discount + item_tax
        
        subtotal += item_subtotal
        total_discount += item_discount
        total_tax += item_tax
        total_total += item_total
    
    return {
        "subtotal": subtotal.quantize(Decimal('0.01')),
        "discount": total_discount.quantize(Decimal('0.01')),
        "tax": total_tax.quantize(Decimal('0.01')),
        "total": total_total.quantize(Decimal('0.01')),
    }


@router.post("/", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def create_quotation(
    data: QuotationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),  # Placeholder - real auth in production
):
    """Create a new quotation linked to a lead."""
    
    # Validate lead exists
    lead = db.query(Lead).get(data.lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    # Validate contact if provided
    if data.contact_id:
        contact = db.query(Contact).get(data.contact_id)
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found",
            )
    
    # Generate quotation number: PL-Q-XXXXXX-V{version}
    last_quotation = db.query(Quotation).order_by(Quotation.id.desc()).first()
    if last_quotation:
        last_num = int(last_quotation.quotation_number.split("-")[-1].split("V")[-1])
        new_num = last_num + 1
        quotation_number = f"PL-Q-{last_quotation.quotation_number.split('-')[1]}-V{new_num}"
    else:
        new_num = 1
        quotation_number = f"PL-Q-000001-V1"
    
    # Calculate totals from items (if items provided later) or set to 0
    quotation = Quotation(
        quotation_number=quotation_number,
        lead_id=data.lead_id,
        contact_id=data.contact_id,
        title=data.title,
        version="1",
        status="DRAFT",
        currency=data.currency,
        subtotal=Decimal('0'),
        discount=Decimal('0'),
        discount_type="percentage",
        tax=Decimal('0'),
        total=Decimal('0'),
        validity_days=data.validity_days,
        valid_until=datetime.utcnow() + timedelta(days=data.validity_days),
        payment_terms=data.payment_terms,
        terms_and_conditions=data.terms_and_conditions,
        customer_message=data.customer_message,
        created_by=current_user["id"],
    )
    db.add(quotation)
    db.flush()
    
    # Create activity: Quotation Created
    activity = Activity(
        activity_type="quotation_created",
        title="Quotation Created",
        description=f"Quotation {quotation.quotation_number} created for lead {lead.lead_number}",
        quotation_id=quotation.id,
        lead_id=lead.id,
        performed_by=current_user["id"],
        metadata={"version": "1", "title": data.title},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(quotation)
    
    return QuotationResponse(
        id=quotation.id,
        quotation_number=quotation.quotation_number,
        lead_id=quotation.lead_id,
        contact_id=quotation.contact_id,
        title=quotation.title,
        version=quotation.version,
        status=quotation.status,
        currency=quotation.currency,
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        tax=quotation.tax,
        total=quotation.total,
        validity_days=quotation.validity_days,
        valid_until=quotation.valid_until,
        estimated_timeline=quotation.estimated_timeline,
        payment_terms=quotation.payment_terms,
        terms_and_conditions=quotation.terms_and_conditions,
        customer_message=quotation.customer_message,
        created_by=quotation.created_by,
        approved_by=quotation.approved_by,
        approved_at=quotation.approved_at,
        sent_at=quotation.sent_at,
        viewed_at=quotation.viewed_at,
        accepted_at=quotation.accepted_at,
        rejected_at=quotation.rejected_at,
        quotation_version_reference=quotation.quotation_version_reference,
        previous_version=quotation.previous_version,
        created_at=quotation.created_at,
        updated_at=quotation.updated_at,
    )


@router.get("/", response_model=List[QuotationResponse])
async def list_quotations(
    lead_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List quotations with filtering."""
    query = db.query(Quotation)
    if lead_id:
        query = query.filter(Quotation.lead_id == lead_id)
    if status:
        query = query.filter(Quotation.status == status)
    return query.offset(skip).limit(limit).all()


@router.get("/{quotation_id}", response_model=QuotationResponse)
async def get_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific quotation."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    # Load items count
    items_count = db.query(QuotationItem).filter(QuotationItem.quotation_id == quotation_id).count()
    
    return QuotationResponse(
        id=quotation.id,
        quotation_number=quotation.quotation_number,
        lead_id=quotation.lead_id,
        contact_id=quotation.contact_id,
        title=quotation.title,
        version=quotation.version,
        status=quotation.status,
        currency=quotation.currency,
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        tax=quotation.tax,
        total=quotation.total,
        validity_days=quotation.validity_days,
        valid_until=quotation.valid_until,
        estimated_timeline=quotation.estimated_timeline,
        payment_terms=quotation.payment_terms,
        terms_and_conditions=quotation.terms_and_conditions,
        customer_message=quotation.customer_message,
        created_by=quotation.created_by,
        approved_by=quotation.approved_by,
        approved_at=quotation.approved_at,
        sent_at=quotation.sent_at,
        viewed_at=quotation.viewed_at,
        accepted_at=quotation.accepted_at,
        rejected_at=quotation.rejected_at,
        quotation_version_reference=quotation.quotation_version_reference,
        previous_version=quotation.previous_version,
        created_at=quotation.created_at,
        updated_at=quotation.updated_at,
        items_count=items_count,
    )


@router.patch("/{quotation_id}", response_model=QuotationResponse)
async def update_quotation(
    quotation_id: int,
    data: QuotationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Update a quotation."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    # If moving from DRAFT to INTERNAL_REVIEW
    old_status = quotation.status
    if old_status == "DRAFT" and data.status == "INTERNAL_REVIEW":
        quotation.status = "INTERNAL_REVIEW"
        quotation.approved_by = current_user["id"]
        quotation.approved_at = datetime.utcnow()
        
        # Create activity: Submitted for review
        activity = Activity(
            activity_type="quotation_submitted",
            title="Quotation Submitted for Review",
            description=f"Quotation {quotation.quotation_number} submitted for internal review",
            quotation_id=quotation.id,
            lead_id=quotation.lead_id,
            performed_by=current_user["id"],
            metadata={"old_status": old_status, "new_status": "INTERNAL_REVIEW"},
        )
        db.add(activity)
    
    # If moving from INTERNAL_REVIEW to APPROVED
    if old_status == "INTERNAL_REVIEW" and data.status == "APPROVED":
        quotation.status = "APPROVED"
        quotation.approved_by = current_user["id"]
        quotation.approved_at = datetime.utcnow()
        
        # Create activity: Approved
        activity = Activity(
            activity_type="quotation_approved",
            title="Quotation Approved",
            description=f"Quotation {quotation.quotation_number} approved for sending",
            quotation_id=quotation.id,
            lead_id=quotation.lead_id,
            performed_by=current_user["id"],
            metadata={"old_status": old_status, "new_status": "APPROVED"},
        )
        db.add(activity)
    
    # If moving from APPROVED to SENT
    if old_status == "APPROVED" and data.status == "SENT":
        quotation.status = "SENT"
        quotation.sent_at = datetime.utcnow()
        
        # Create activity: Sent
        activity = Activity(
            activity_type="quotation_sent",
            title="Quotation Sent",
            description=f"Quotation {quotation.quotation_number} sent to customer",
            quotation_id=quotation.id,
            lead_id=quotation.lead_id,
            performed_by=current_user["id"],
            metadata={"status": "APPROVED"},
        )
        db.add(activity)
    
    # Update fields if provided
    update_data = data.model_dump(exclude_unset=True, exclude={"status"})
    for field, value in update_data.items():
        setattr(quotation, field, value)
    
    # Recalculate totals if items changed (basic recalculation)
    # In production, this would recompute from quotation_items
    
    db.commit()
    db.refresh(quotation)
    
    return QuotationResponse(
        id=quotation.id,
        quotation_number=quotation.quotation_number,
        lead_id=quotation.lead_id,
        contact_id=quotation.contact_id,
        title=quotation.title,
        version=quotation.version,
        status=quotation.status,
        currency=quotation.currency,
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        tax=quotation.tax,
        total=quotation.total,
        validity_days=quotation.validity_days,
        valid_until=quotation.valid_until,
        estimated_timeline=quotation.estimated_timeline,
        payment_terms=quotation.payment_terms,
        terms_and_conditions=quotation.terms_and_conditions,
        customer_message=quotation.customer_message,
        created_by=quotation.created_by,
        approved_by=quotation.approved_by,
        approved_at=quotation.approved_at,
        sent_at=quotation.sent_at,
        viewed_at=quotation.viewed_at,
        accepted_at=quotation.accepted_at,
        rejected_at=quotation.rejected_at,
        quotation_version_reference=quotation.quotation_version_reference,
        previous_version=quotation.previous_version,
        created_at=quotation.created_at,
        updated_at=quotation.updated_at,
    )


@router.post("/{quotation_id}/create-version", response_model=QuotationResponse)
async def create_quotation_version(
    quotation_id: int,
    data: QuotationVersionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Create a new version of a quotation."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    # Create new version
    new_version_num = str(int(quotation.version) + 1) if quotation.version else "2"
    
    # Copy current quotation items to new version
    # In a full implementation, this would create a QuotationVersion record
    # and potentially copy items with possible modifications
    
    quotation.version = new_version_num
    quotation.previous_version = quotation.quotation_version_reference
    quotation.quotation_version_reference = f"PL-Q-{quotation.quotation_number.split('-')[1]}-V{new_version_num}"
    quotation.status = "DRAFT"  # New version starts as DRAFT
    
    # Create activity: Version Created
    activity = Activity(
        activity_type="quotation_version_created",
        title="Quotation Version Created",
        description=f"Quotation {quotation.quotation_number} version {new_version_num} created",
        quotation_id=quotation.id,
        lead_id=quotation.lead_id,
        performed_by=current_user["id"],
        metadata={"new_version": new_version_num, "previous_version": quotation.previous_version},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(quotation)
    
    return QuotationResponse(
        id=quotation.id,
        quotation_number=quotation.quotation_number,
        lead_id=quotation.lead_id,
        contact_id=quotation.contact_id,
        title=quotation.title,
        version=quotation.version,
        status=quotation.status,
        currency=quotation.currency,
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        tax=quotation.tax,
        total=quotation.total,
        validity_days=quotation.validity_days,
        valid_until=quotation.valid_until,
        estimated_timeline=quotation.estimated_timeline,
        payment_terms=quotation.payment_terms,
        terms_and_conditions=quotation.terms_and_conditions,
        customer_message=quotation.customer_message,
        created_by=quotation.created_by,
        approved_by=quotation.approved_by,
        approved_at=quotation.approved_at,
        sent_at=quotation.sent_at,
        viewed_at=quotation.viewed_at,
        accepted_at=quotation.accepted_at,
        rejected_at=quotation.rejected_at,
        quotation_version_reference=quotation.quotation_version_reference,
        previous_version=quotation.previous_version,
        created_at=quotation.created_at,
        updated_at=quotation.updated_at,
    )


@router.post("/{quotation_id}/approve", response_model=QuotationResponse)
async def approve_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Approve a quotation for sending."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    if quotation.status != "INTERNAL_REVIEW":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation must be in INTERNAL_REVIEW status to approve. Current: {quotation.status}",
        )
    
    old_status = quotation.status
    quotation.status = "APPROVED"
    quotation.approved_by = current_user["id"]
    quotation.approved_at = datetime.utcnow()
    
    # Create activity: Approved
    activity = Activity(
        activity_type="quotation_approved",
        title="Quotation Approved",
        description=f"Quotation {quotation.quotation_number} approved",
        quotation_id=quotation.id,
        lead_id=quotation.lead_id,
        performed_by=current_user["id"],
        metadata={"old_status": old_status, "new_status": "APPROVED"},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(quotation)
    
    return QuotationResponse(
        id=quotation.id,
        quotation_number=quotation.quotation_number,
        lead_id=quotation.lead_id,
        contact_id=quotation.contact_id,
        title=quotation.title,
        version=quotation.version,
        status=quotation.status,
        currency=quotation.currency,
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        tax=quotation.tax,
        total=quotation.total,
        validity_days=quotation.validity_days,
        valid_until=quotation.valid_until,
        estimated_timeline=quotation.estimated_timeline,
        payment_terms=quotation.payment_terms,
        terms_and_conditions=quotation.terms_and_conditions,
        customer_message=quotation.customer_message,
        created_by=quotation.created_by,
        approved_by=quotation.approved_by,
        approved_at=quotation.approved_at,
        sent_at=quotation.sent_at,
        viewed_at=quotation.viewed_at,
        accepted_at=quotation.accepted_at,
        rejected_at=quotation.rejected_at,
        quotation_version_reference=quotation.quotation_version_reference,
        previous_version=quotation.previous_version,
        created_at=quotation.created_at,
        updated_at=quotation.updated_at,
    )


@router.post("/{quotation_id}/send", response_model=QuotationResponse)
async def send_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Send an approved quotation to the customer."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    if quotation.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation must be APPROVED to send. Current: {quotation.status}",
        )
    
    old_status = quotation.status
    quotation.status = "SENT"
    quotation.sent_at = datetime.utcnow()
    
    # Create activity: Sent
    activity = Activity(
        activity_type="quotation_sent",
        title="Quotation Sent",
        description=f"Quotation {quotation.quotation_number} sent to customer",
        quotation_id=quotation.id,
        lead_id=quotation.lead_id,
        performed_by=current_user["id"],
        metadata={"status": "APPROVED"},
    )
    db.add(activity)
    
    contact = db.query(Contact).get(quotation.contact_id) if quotation.contact_id else None
    db.commit()
    db.refresh(quotation)

    dispatch_event(
        db,
        "QUOTATION_SENT",
        "quotation",
        quotation.id,
        {
            "quotation_number": quotation.quotation_number,
            "title": quotation.title,
            "total": str(quotation.total),
            "email": contact.email if contact else None,
            "to_email": contact.email if contact else None,
            "phone": (contact.phone or contact.whatsapp) if contact else None,
        },
    )
    create_notification(
        db,
        user_id=current_user["id"],
        title="Quotation Sent",
        body=f"Quotation {quotation.quotation_number} sent to customer",
        notification_type="WORKFLOW",
        related_entity="quotation",
        related_id=quotation.id,
    )
    db.commit()
    
    return QuotationResponse(
        id=quotation.id,
        quotation_number=quotation.quotation_number,
        lead_id=quotation.lead_id,
        contact_id=quotation.contact_id,
        title=quotation.title,
        version=quotation.version,
        status=quotation.status,
        currency=quotation.currency,
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        tax=quotation.tax,
        total=quotation.total,
        validity_days=quotation.validity_days,
        valid_until=quotation.valid_until,
        estimated_timeline=quotation.estimated_timeline,
        payment_terms=quotation.payment_terms,
        terms_and_conditions=quotation.terms_and_conditions,
        customer_message=quotation.customer_message,
        created_by=quotation.created_by,
        approved_by=quotation.approved_by,
        approved_at=quotation.approved_at,
        sent_at=quotation.sent_at,
        viewed_at=quotation.viewed_at,
        accepted_at=quotation.accepted_at,
        rejected_at=quotation.rejected_at,
        quotation_version_reference=quotation.quotation_version_reference,
        previous_version=quotation.previous_version,
        created_at=quotation.created_at,
        updated_at=quotation.updated_at,
    )


@router.post("/{quotation_id}/view", response_model=QuotationResponse)
async def mark_quotation_viewed(
    quotation_id: int,
    db: Session = Depends(get_db),
):
    """Record that the customer viewed the quotation."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    if quotation.status not in ["SENT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation must be SENT to mark viewed. Current: {quotation.status}",
        )
    old_status = quotation.status
    quotation.status = "VIEWED"
    quotation.viewed_at = datetime.utcnow()
    db.add(Activity(
        activity_type="quotation_viewed",
        title="Quotation Viewed",
        description=f"Quotation {quotation.quotation_number} viewed by customer",
        quotation_id=quotation.id,
        lead_id=quotation.lead_id,
        metadata={"old_status": old_status, "new_status": "VIEWED"},
    ))
    db.commit()
    db.refresh(quotation)
    return QuotationResponse(
        id=quotation.id,
        quotation_number=quotation.quotation_number,
        lead_id=quotation.lead_id,
        contact_id=quotation.contact_id,
        title=quotation.title,
        version=quotation.version,
        status=quotation.status,
        currency=quotation.currency,
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        discount_type=quotation.discount_type,
        tax=quotation.tax,
        total=quotation.total,
        validity_days=quotation.validity_days,
        valid_until=quotation.valid_until,
        estimated_timeline=quotation.estimated_timeline,
        payment_terms=quotation.payment_terms,
        terms_and_conditions=quotation.terms_and_conditions,
        customer_message=quotation.customer_message,
        created_by=quotation.created_by,
        approved_by=quotation.approved_by,
        approved_at=quotation.approved_at,
        sent_at=quotation.sent_at,
        viewed_at=quotation.viewed_at,
        accepted_at=quotation.accepted_at,
        rejected_at=quotation.rejected_at,
        quotation_version_reference=quotation.quotation_version_reference,
        previous_version=quotation.previous_version,
        created_at=quotation.created_at,
        updated_at=quotation.updated_at,
    )


@router.get("/{quotation_id}/pdf")
async def quotation_pdf(
    quotation_id: int,
    db: Session = Depends(get_db),
):
    """Return a branded PDF of the quotation."""
    from fastapi.responses import Response
    from app.services.pdf import quotation_pdf_bytes
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    items = db.query(QuotationItem).filter(QuotationItem.quotation_id == quotation.id).all()
    contact = db.query(Contact).get(quotation.contact_id) if quotation.contact_id else None
    lead = db.query(Lead).get(quotation.lead_id) if quotation.lead_id else None
    customer_lines = []
    if contact:
        customer_lines.append(("Customer", f"{contact.first_name} {contact.last_name}".strip()))
        customer_lines.append(("Email", contact.email or "N/A"))
        customer_lines.append(("Phone", contact.phone or "N/A"))
    if lead:
        customer_lines.append(("Lead", lead.lead_number))

    filename = f"quotation-{quotation.quotation_number}.pdf"
    pdf = quotation_pdf_bytes(
        quotation_number=quotation.quotation_number,
        version=quotation.version or 1,
        title=quotation.title,
        issued_date=str(quotation.created_at.date()) if quotation.created_at else "",
        valid_until=str(quotation.valid_until.date()) if quotation.valid_until else "N/A",
        status=quotation.status,
        customer_lines=customer_lines,
        items=[{
            "name": i.name,
            "quantity": i.quantity,
            "unit_price": i.unit_price,
            "discount": i.discount,
            "tax": i.tax,
            "total": i.total,
        } for i in items],
        subtotal=float(quotation.subtotal or 0),
        discount=float(quotation.discount or 0),
        tax=float(quotation.tax or 0),
        total=float(quotation.total or 0),
        currency=quotation.currency or "USD",
        payment_terms=quotation.payment_terms,
        customer_message=quotation.customer_message,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{quotation_id}/accept", response_model=dict)
async def accept_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Customer accepts the quotation."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    if quotation.status not in ["SENT", "VIEWED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation must be SENT or VIEWED to accept. Current: {quotation.status}",
        )
    
    old_status = quotation.status
    quotation.status = "ACCEPTED"
    quotation.accepted_at = datetime.utcnow()
    
    # Create activity: Accepted
    activity = Activity(
        activity_type="quotation_accepted",
        title="Quotation Accepted",
        description=f"Quotation {quotation.quotation_number} accepted by customer",
        quotation_id=quotation.id,
        lead_id=quotation.lead_id,
        performed_by=current_user["id"],
        metadata={"customer_id": current_user.get("id")},
    )
    db.add(activity)
    
    # Update related lead status to WON
    lead = db.query(Lead).get(quotation.lead_id) if quotation.lead_id else None
    if lead and lead.status != "WON":
        lead.status = "WON"

    # Auto-create a Contract from the accepted quotation (idempotent)
    contract = None
    if quotation.lead_id:
        existing_contract = db.query(Contract).filter(Contract.quotation_id == quotation.id).first()
        if not existing_contract:
            last_contract = db.query(Contract).order_by(Contract.id.desc()).first()
            if last_contract:
                try:
                    last_num = int(last_contract.contract_number.split("-")[-1])
                except (ValueError, IndexError):
                    last_num = 0
                next_num = last_num + 1
            else:
                next_num = 1
            contract_number = f"PL-CT-{next_num:06d}"
            contact_id = quotation.contact_id or (lead.contact_id if lead else None)
            contract = Contract(
                contract_number=contract_number,
                quotation_id=quotation.id,
                quotation_version=quotation.version or "1",
                lead_id=quotation.lead_id,
                contact_id=contact_id,
                title=quotation.title,
                status="DRAFT",
                payment_terms=quotation.payment_terms,
                terms_and_conditions=quotation.terms_and_conditions,
                created_by=current_user["id"],
            )
            db.add(contract)
            db.flush()
            db.add(Activity(
                activity_type="contract_created",
                title="Contract Created",
                description=f"Contract {contract.contract_number} auto-created from accepted quotation {quotation.quotation_number}",
                quotation_id=quotation.id,
                lead_id=quotation.lead_id,
                contract_id=contract.id,
                performed_by=current_user["id"],
            ))
    
    contact = db.query(Contact).get(quotation.contact_id) if quotation.contact_id else None
    db.commit()
    db.refresh(quotation)

    dispatch_event(
        db,
        "QUOTATION_ACCEPTED",
        "quotation",
        quotation.id,
        {
            "quotation_number": quotation.quotation_number,
            "title": quotation.title,
            "contract_number": contract.contract_number if contract else None,
            "email": contact.email if contact else None,
            "to_email": contact.email if contact else None,
            "phone": (contact.phone or contact.whatsapp) if contact else None,
        },
    )
    create_notification(
        db,
        user_id=(lead.owner_id if lead and lead.owner_id else current_user["id"]),
        title="Quotation Accepted",
        body=f"Quotation {quotation.quotation_number} accepted. Contract {contract.contract_number if contract else 'pending'} created.",
        notification_type="WORKFLOW",
        related_entity="quotation",
        related_id=quotation.id,
    )
    db.commit()
    
    return {
        "detail": "Quotation accepted successfully",
        "quotation_number": quotation.quotation_number,
        "accepted_at": quotation.accepted_at,
        "status": quotation.status,
        "contract_number": contract.contract_number if contract else None,
    }


@router.post("/{quotation_id}/reject", response_model=dict)
async def reject_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
    # In a real app, would accept optional comment from request body
):
    """Customer rejects the quotation."""
    quotation = db.query(Quotation).get(quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    if quotation.status not in ["SENT", "VIEWED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation must be SENT or VIEWED to reject. Current: {quotation.status}",
        )
    
    old_status = quotation.status
    quotation.status = "REJECTED"
    quotation.rejected_at = datetime.utcnow()
    
    # Create activity: Rejected
    activity = Activity(
        activity_type="quotation_rejected",
        title="Quotation Rejected",
        description=f"Quotation {quotation.quotation_number} rejected by customer",
        quotation_id=quotation.id,
        lead_id=quotation.lead_id,
        performed_by=current_user["id"],
        metadata={"reason": "Customer rejection"},
    )
    db.add(activity)
    
    # Could also update lead status to LOST
    if quotation.lead_id:
        lead = db.query(Lead).get(quotation.lead_id)
        if lead:
            lead.status = "LOST"
            lead.lost_reason = "Customer rejected quotation"
    
    db.commit()
    db.refresh(quotation)
    
    return {
        "detail": "Quotation rejected successfully",
        "quotation_number": quotation.quotation_number,
        "rejected_at": quotation.rejected_at,
        "status": quotation.status,
    }