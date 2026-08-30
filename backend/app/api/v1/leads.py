from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import (
    Lead, Contact, User, ProjectType, ProjectSubcategory,
    Activity, FollowUp, LeadNote, Attachment, QuoteRequest
)
from app.services.notifications import create_notification, dispatch_event
from app.core.config import settings
from app.api.deps import get_current_user_dict
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


router = APIRouter(prefix="/admin/leads", tags=["admin-leads"])


# Pydantic Schemas

class LeadStatusUpdate(BaseModel):
    status: str


class LeadPriorityUpdate(BaseModel):
    priority: str


class LeadAssign(BaseModel):
    owner_id: int


class LeadNoteCreate(BaseModel):
    content: str


class FollowUpCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_at: datetime


class LeadResponse(BaseModel):
    id: int
    lead_number: str
    status: str
    priority: str
    contact_name: str
    contact_email: str
    project_type: Optional[str] = None
    subcategory: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime
    next_follow_up_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class LeadListResponse(BaseModel):
    leads: List[LeadResponse]
    total: int


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead_from_quote(
    quote_request_id: int,
    db: Session = Depends(get_db),
):
    """Create a lead from an existing quote request."""
    
    quote_request = db.query(QuoteRequest).get(quote_request_id)
    if not quote_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote request not found",
        )
    
    contact = db.query(Contact).filter(Contact.id == quote_request.contact_id).first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contact not found for this quote request",
        )
    
    # Check if lead already exists
    existing_lead = db.query(Lead).filter(Lead.quote_request_id == quote_request_id).first()
    if existing_lead:
        return LeadResponse(
            id=existing_lead.id,
            lead_number=existing_lead.lead_number,
            status=existing_lead.status,
            priority=existing_lead.priority,
            contact_name=f"{contact.first_name} {contact.last_name}",
            contact_email=contact.email,
            project_type=existing_lead.project_type.name if existing_lead.project_type else None,
            subcategory=existing_lead.subcategory.name if existing_lead.subcategory else None,
            owner_name=existing_lead.owner.name if existing_lead.owner else None,
            created_at=existing_lead.created_at,
            next_follow_up_at=existing_lead.next_follow_up_at,
        )
    
    # Create lead
    lead_number = f"PL-L-{quote_request.id:06d}"
    
    lead = Lead(
        lead_number=lead_number,
        contact_id=contact.id,
        quote_request_id=quote_request.id,
        project_type_id=quote_request.project_type_id,
        subcategory_id=quote_request.subcategory_id,
        status="NEW",
        priority="MEDIUM",
        source=quote_request.source or "website",
        estimated_budget=quote_request.budget,
        estimated_timeline=quote_request.timeline,
    )
    db.add(lead)
    
    # Create Activity: Lead Created
    activity = Activity(
        activity_type="lead_created",
        title="Lead Created",
        description=f"Lead {lead.lead_number} created from quote request {quote_request.request_number}",
        lead_id=lead.id,
        quote_request_id=quote_request.id,
        performed_by=None,
        metadata={"source": quote_request.source or "website"},
    )
    db.add(activity)
    
    # Create Follow-Up: Initial follow-up
    from app.models.auth import FollowUp as FollowUpModel
    from datetime import timedelta
    due_date = datetime.utcnow() + timedelta(days=3)
    followup = FollowUpModel(
        title="Initial follow-up on lead",
        description=f"Follow up on lead {lead.lead_number}",
        due_at=due_date,
        status="PENDING",
        lead_id=lead.id,
        created_by=None,
    )
    db.add(followup)
    
    db.commit()
    db.refresh(lead)

    dispatch_event(
        db,
        "LEAD_STATUS_CHANGED",
        "lead",
        lead.id,
        {
            "lead_number": lead.lead_number,
            "old_status": old_status,
            "new_status": data.status,
            "email": lead.contact.email if lead.contact else None,
            "to_email": lead.contact.email if lead.contact else None,
        },
    )
    create_notification(
        db,
        user_id=(lead.owner_id or 1),
        title="Lead Status Changed",
        body=f"Lead {lead.lead_number} changed from {old_status} to {data.status}",
        notification_type="WORKFLOW",
        related_entity="lead",
        related_id=lead.id,
    )
    db.commit()
    db.refresh(lead)
    
    return LeadResponse(
        id=lead.id,
        lead_number=lead.lead_number,
        status=lead.status,
        priority=lead.priority,
        contact_name=f"{lead.contact.first_name} {lead.contact.last_name}" if lead.contact else "Unknown",
        contact_email=lead.contact.email if lead.contact else "",
        project_type=lead.project_type.name if lead.project_type else None,
        subcategory=lead.subcategory.name if lead.subcategory else None,
        owner_name=lead.owner.name if lead.owner else None,
        created_at=lead.created_at,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.get("/", response_model=LeadListResponse)
async def list_leads(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    project_type_id: Optional[int] = None,
    owner_id: Optional[int] = None,
    contact_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List leads with filtering."""
    query = db.query(Lead)
    
    if status:
        query = query.filter(Lead.status == status)
    if priority:
        query = query.filter(Lead.priority == priority)
    if project_type_id:
        query = query.filter(Lead.project_type_id == project_type_id)
    if owner_id:
        query = query.filter(Lead.owner_id == owner_id)
    if contact_email:
        query = query.join(Contact).filter(Contact.email.contains(contact_email))
    
    total = query.count()
    leads = query.offset(skip).limit(limit).all()
    
    result_leads = []
    for lead in leads:
        contact = db.query(Contact).get(lead.contact_id)
        result_leads.append(LeadResponse(
            id=lead.id,
            lead_number=lead.lead_number,
            status=lead.status,
            priority=lead.priority,
            contact_name=f"{contact.first_name} {contact.last_name}" if contact else "Unknown",
            contact_email=contact.email if contact else "",
            project_type=lead.project_type.name if lead.project_type else None,
            subcategory=lead.subcategory.name if lead.subcategory else None,
            owner_name=lead.owner.name if lead.owner else None,
            created_at=lead.created_at,
            next_follow_up_at=lead.next_follow_up_at,
        ))
    
    return LeadListResponse(leads=result_leads, total=total)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific lead."""
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    contact = db.query(Contact).get(lead.contact_id)
    
    return LeadResponse(
        id=lead.id,
        lead_number=lead.lead_number,
        status=lead.status,
        priority=lead.priority,
        contact_name=f"{contact.first_name} {contact.last_name}" if contact else "Unknown",
        contact_email=contact.email if contact else "",
        project_type=lead.project_type.name if lead.project_type else None,
        subcategory=lead.subcategory.name if lead.subcategory else None,
        owner_name=lead.owner.name if lead.owner else None,
        created_at=lead.created_at,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.patch("/{lead_id}/status", response_model=LeadResponse)
async def update_lead_status(
    lead_id: int,
    data: LeadStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update lead status."""
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    # Full documented lead pipeline
    valid_statuses = [
        "NEW", "CONTACTED", "QUALIFIED", "REQUIREMENT_COLLECTED",
        "TECHNICAL_ANALYSIS", "ESTIMATION", "QUOTATION_PREPARATION",
        "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST",
    ]
    if data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Valid: {valid_statuses}",
        )
    
    old_status = lead.status
    lead.status = data.status
    
    # Create activity on status change
    from app.models.auth import Activity
    activity = Activity(
        activity_type="status_changed",
        title="Status Changed",
        description=f"Lead {lead.lead_number} status changed from {old_status} to {data.status}",
        lead_id=lead.id,
        performed_by=None,
        metadata={"old_value": old_status, "new_value": data.status},
    )
    db.add(activity)
    
    # Update next follow-up based on status
    status_followup_map = {
        "NEW": 3,
        "CONTACTED": 5,
        "QUALIFIED": 7,
        "REQUIREMENT_COLLECTED": 7,
        "TECHNICAL_ANALYSIS": 10,
        "ESTIMATION": 14,
        "QUOTATION_PREPARATION": 7,
        "QUOTATION_SENT": 7,
        "NEGOTIATION": 5,
        "WON": None,
        "LOST": None,
    }
    days = status_followup_map.get(data.status)
    from datetime import timedelta
    if days is not None:
        lead.next_follow_up_at = datetime.utcnow() + timedelta(days=days)
    else:
        lead.next_follow_up_at = None
    
    db.commit()
    db.refresh(lead)
    
    return LeadResponse(
        id=lead.id,
        lead_number=lead.lead_number,
        status=lead.status,
        priority=lead.priority,
        contact_name=f"{lead.contact.first_name} {lead.contact.last_name}" if lead.contact else "Unknown",
        contact_email=lead.contact.email if lead.contact else "",
        project_type=lead.project_type.name if lead.project_type else None,
        subcategory=lead.subcategory.name if lead.subcategory else None,
        owner_name=lead.owner.name if lead.owner else None,
        created_at=lead.created_at,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.patch("/{lead_id}/priority", response_model=LeadResponse)
async def update_lead_priority(
    lead_id: int,
    data: LeadPriorityUpdate,
    db: Session = Depends(get_db),
):
    """Update lead priority."""
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    valid_priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"]
    if data.priority not in valid_priorities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid priority. Valid: {valid_priorities}",
        )
    
    old_priority = lead.priority
    lead.priority = data.priority
    
    # Create activity on priority change
    activity = Activity(
        activity_type="priority_changed",
        title="Priority Changed",
        description=f"Lead {lead.lead_number} priority changed from {old_priority} to {data.priority}",
        lead_id=lead.id,
        performed_by=None,
        metadata={"old_value": old_priority, "new_value": data.priority},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(lead)
    
    return LeadResponse(
        id=lead.id,
        lead_number=lead.lead_number,
        status=lead.status,
        priority=lead.priority,
        contact_name=f"{lead.contact.first_name} {lead.contact.last_name}" if lead.contact else "Unknown",
        contact_email=lead.contact.email if lead.contact else "",
        project_type=lead.project_type.name if lead.project_type else None,
        subcategory=lead.subcategory.name if lead.subcategory else None,
        owner_name=lead.owner.name if lead.owner else None,
        created_at=lead.created_at,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.patch("/{lead_id}/assign", response_model=LeadResponse)
async def assign_lead(
    lead_id: int,
    data: LeadAssign,
    db: Session = Depends(get_db),
):
    """Assign lead to a user."""
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    # Check if target user exists and has appropriate role
    from app.models.auth import User as UserModel
    target_user = db.query(UserModel).get(data.owner_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user not found",
        )
    
    old_owner_id = lead.owner_id
    lead.owner_id = data.owner_id
    
    # Create activity on assignment
    activity = Activity(
        activity_type="lead_assigned",
        title="Lead Assigned",
        description=f"Lead {lead.lead_number} assigned to {target_user.email}",
        lead_id=lead.id,
        performed_by=None,
        metadata={"old_owner_id": old_owner_id, "new_owner_id": data.owner_id},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(lead)
    
    return LeadResponse(
        id=lead.id,
        lead_number=lead.lead_number,
        status=lead.status,
        priority=lead.priority,
        contact_name=f"{lead.contact.first_name} {lead.contact.last_name}" if lead.contact else "Unknown",
        contact_email=lead.contact.email if lead.contact else "",
        project_type=lead.project_type.name if lead.project_type else None,
        subcategory=lead.subcategory.name if lead.subcategory else None,
        owner_name=lead.owner.name if lead.owner else None,
        created_at=lead.created_at,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.patch("/{lead_id}/notes", response_model=LeadResponse)
async def add_lead_note(
    lead_id: int,
    data: LeadNoteCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),  # Placeholder - would be real auth in production
):
    """Add an internal note to a lead."""
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    from app.models.auth import LeadNote
    note = LeadNote(
        content=data.content,
        author_id=current_user["id"],
        lead_id=lead_id,
    )
    db.add(note)
    
    # Create activity
    activity = Activity(
        activity_type="note_added",
        title="Note Added",
        description=f"Note added to lead {lead.lead_number}",
        lead_id=lead.id,
        performed_by=current_user["id"],
        metadata={"note_id": note.id},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(lead)
    
    return LeadResponse(
        id=lead.id,
        lead_number=lead.lead_number,
        status=lead.status,
        priority=lead.priority,
        contact_name=f"{lead.contact.first_name} {lead.contact.last_name}" if lead.contact else "Unknown",
        contact_email=lead.contact.email if lead.contact else "",
        project_type=lead.project_type.name if lead.project_type else None,
        subcategory=lead.subcategory.name if lead.subcategory else None,
        owner_name=lead.owner.name if lead.owner else None,
        created_at=lead.created_at,
        next_follow_up_at=lead.next_follow_up_at,
    )


@router.patch("/{lead_id}/followups", response_model=LeadResponse)
async def create_follow_up(
    lead_id: int,
    data: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),  # Placeholder
):
    """Create a follow-up for a lead."""
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    from app.models.auth import FollowUp
    due_at = data.due_at if data.due_at else datetime.utcnow() + __import__('datetime').timedelta(days=3)
    
    followup = FollowUp(
        title=data.title,
        description=data.description,
        due_at=due_at,
        status="PENDING",
        lead_id=lead_id,
        created_by=current_user["id"],
    )
    db.add(followup)
    
    # Create activity
    activity = Activity(
        activity_type="followup_created",
        title="Follow-up Created",
        description=f"Follow-up '{data.title}' created for lead {lead.lead_number}",
        lead_id=lead.id,
        performed_by=current_user["id"],
        metadata={"followup_id": followup.id},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(lead)
    
    return LeadResponse(
        id=lead.id,
        lead_number=lead.lead_number,
        status=lead.status,
        priority=lead.priority,
        contact_name=f"{lead.contact.first_name} {lead.contact.last_name}" if lead.contact else "Unknown",
        contact_email=lead.contact.email if lead.contact else "",
        project_type=lead.project_type.name if lead.project_type else None,
        subcategory=lead.subcategory.name if lead.subcategory else None,
        owner_name=lead.owner.name if lead.owner else None,
        created_at=lead.created_at,
        next_follow_up_at=lead.next_follow_up_at,
    )