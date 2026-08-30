from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import (
    Contract, ContractActivity, Lead, Contact, User, Quotation, Activity,
    Project
)
from app.models.operations import Notification
from app.services.notifications import create_notification, dispatch_event
from app.core.config import settings
from app.api.deps import get_current_user_dict
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timedelta
import secrets


router = APIRouter(prefix="/admin/contracts", tags=["admin-contracts"])


# Pydantic Schemas

class ContractCreate(BaseModel):
    quotation_id: int
    quotation_version: str = "1"
    lead_id: int
    contact_id: int
    title: str = Field(..., min_length=1)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    scope: Optional[str] = None
    deliverables: Optional[str] = None
    payment_terms: Optional[str] = None
    terms_and_conditions: Optional[str] = None


class ContractUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    scope: Optional[str] = None
    deliverables: Optional[str] = None
    payment_terms: Optional[str] = None
    terms_and_conditions: Optional[str] = None


class ContractResponse(BaseModel):
    id: int
    contract_number: str
    quotation_id: Optional[int] = None
    quotation_version: str
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    title: str
    status: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    scope: Optional[str] = None
    deliverables: Optional[str] = None
    payment_terms: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    created_by: Optional[int] = None
    sent_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ContractActivityResponse(BaseModel):
    id: int
    contract_id: int
    activity_type: str
    title: str
    description: Optional[str] = None
    performed_by: Optional[int] = None
    metadata: Optional[dict] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Helper to generate contract number
def generate_contract_number(quotation_id: int, quotation_version: str, db) -> str:
    last_contract = db.query(Contract).order_by(Contract.id.desc()).first()
    if last_contract:
        try:
            last_num = int(last_contract.contract_number.split("-")[-1])
        except (ValueError, IndexError):
            last_num = 0
        new_num = last_num + 1
    else:
        new_num = 1
    return f"PL-CT-{new_num:06d}"


@router.post("/", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    data: ContractCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Create a contract from an accepted quotation."""
    
    # Validate quotation exists and is accepted
    quotation = db.query(Quotation).get(data.quotation_id)
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {data.quotation_id} not found",
        )
    
    # Validate lead/contact exist
    lead = db.query(Lead).get(data.lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {data.lead_id} not found",
        )
    contact = db.query(Contact).get(data.contact_id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact {data.contact_id} not found",
        )
    
    # Generate contract number
    contract_number = generate_contract_number(data.quotation_id, data.quotation_version, db)
    
    contract = Contract(
        contract_number=contract_number,
        quotation_id=data.quotation_id,
        quotation_version=data.quotation_version,
        lead_id=data.lead_id,
        contact_id=data.contact_id,
        title=data.title,
        status="DRAFT",
        scope=data.scope,
        deliverables=data.deliverables,
        payment_terms=data.payment_terms,
        terms_and_conditions=data.terms_and_conditions,
        created_by=current_user["id"],
    )
    db.add(contract)
    
    # Create activity: Contract Created
    activity = Activity(
        activity_type="contract_created",
        title="Contract Created",
        description=f"Contract {contract.contract_number} created from quotation {quotation_id}",
        contract_id=contract.id,
        lead_id=data.lead_id,
        performed_by=current_user["id"],
        metadata={"quotation_id": data.quotation_id, "quotation_version": data.quotation_version},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(contract)

    dispatch_event(
        db,
        "CONTRACT_CREATED",
        "contract",
        contract.id,
        {
            "contract_number": contract.contract_number,
            "title": contract.title,
            "lead_id": contract.lead_id,
            "email": contact.email,
            "to_email": contact.email,
            "phone": contact.phone or contact.whatsapp,
        },
    )
    create_notification(
        db,
        user_id=lead.owner_id or 1,
        title="Contract Created",
        body=f"Contract {contract.contract_number} created from quotation {quotation.quotation_number}",
        notification_type="WORKFLOW",
        related_entity="contract",
        related_id=contract.id,
    )
    db.commit()
    
    return ContractResponse(
        id=contract.id,
        contract_number=contract.contract_number,
        quotation_id=contract.quotation_id,
        quotation_version=contract.quotation_version,
        lead_id=contract.lead_id,
        contact_id=contract.contact_id,
        title=contract.title,
        status=contract.status,
        start_date=contract.start_date,
        end_date=contract.end_date,
        scope=contract.scope,
        deliverables=contract.deliverables,
        payment_terms=contract.payment_terms,
        terms_and_conditions=contract.terms_and_conditions,
        created_by=contract.created_by,
        sent_at=contract.sent_at,
        accepted_at=contract.accepted_at,
        expired_at=contract.expired_at,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


@router.get("/", response_model=List[ContractResponse])
async def list_contracts(
    lead_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List contracts with filtering."""
    query = db.query(Contract)
    if lead_id:
        query = query.filter(Contract.lead_id == lead_id)
    if status:
        query = query.filter(Contract.status == status)
    return query.all()


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific contract."""
    contract = db.query(Contract).get(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    return ContractResponse(
        id=contract.id,
        contract_number=contract.contract_number,
        quotation_id=contract.quotation_id,
        quotation_version=contract.quotation_version,
        lead_id=contract.lead_id,
        contact_id=contract.contact_id,
        title=contract.title,
        status=contract.status,
        start_date=contract.start_date,
        end_date=contract.end_date,
        scope=contract.scope,
        deliverables=contract.deliverables,
        payment_terms=contract.payment_terms,
        terms_and_conditions=contract.terms_and_conditions,
        created_by=contract.created_by,
        sent_at=contract.sent_at,
        accepted_at=contract.accepted_at,
        expired_at=contract.expired_at,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


@router.patch("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Update a contract."""
    contract = db.query(Contract).get(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    
    old_status = contract.status
    
    # Update fields if provided
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contract, field, value)
    
    # If moving from DRAFT to INTERNAL_REVIEW
    if old_status == "DRAFT" and data.status == "INTERNAL_REVIEW" if hasattr(data, 'status') else False:
        contract.status = "INTERNAL_REVIEW"
        
        activity = Activity(
            activity_type="contract_created",  # Simplified
            title="Contract Updated",
            description=f"Contract {contract.contract_number} moved to internal review",
            contract_id=contract.id,
            performed_by=current_user["id"],
        )
        db.add(activity)
    
    # If moving from INTERNAL_REVIEW to SENT
    if old_status == "INTERNAL_REVIEW" and contract.status == "SENT":
        contract.status = "SENT"
        contract.sent_at = datetime.utcnow()
        
        activity = Activity(
            activity_type="contract_sent",
            title="Contract Sent",
            description=f"Contract {contract.contract_number} sent to customer",
            contract_id=contract.id,
            performed_by=current_user["id"],
        )
        db.add(activity)
    
    db.commit()
    db.refresh(contract)
    
    return ContractResponse(
        id=contract.id,
        contract_number=contract.contract_number,
        quotation_id=contract.quotation_id,
        quotation_version=contract.quotation_version,
        lead_id=contract.lead_id,
        contact_id=contract.contact_id,
        title=contract.title,
        status=contract.status,
        start_date=contract.start_date,
        end_date=contract.end_date,
        scope=contract.scope,
        deliverables=contract.deliverables,
        payment_terms=contract.payment_terms,
        terms_and_conditions=contract.terms_and_conditions,
        created_by=contract.created_by,
        sent_at=contract.sent_at,
        accepted_at=contract.accepted_at,
        expired_at=contract.expired_at,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


@router.post("/{contract_id}/send", response_model=ContractResponse)
async def send_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Send a contract to the customer."""
    contract = db.query(Contract).get(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    
    if contract.status != "INTERNAL_REVIEW":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract must be INTERNAL_REVIEW to send. Current: {contract.status}",
        )
    
    old_status = contract.status
    contract.status = "SENT"
    contract.sent_at = datetime.utcnow()
    
    # Create activity: Contract Sent
    activity = Activity(
        activity_type="contract_sent",
        title="Contract Sent",
        description=f"Contract {contract.contract_number} sent to customer",
        contract_id=contract.id,
        lead_id=contract.lead_id,
        performed_by=current_user["id"],
        metadata={"status": "INTERNAL_REVIEW"},
    )
    db.add(activity)
    
    contact = db.query(Contact).get(contract.contact_id) if contract.contact_id else None
    db.commit()
    db.refresh(contract)

    dispatch_event(
        db,
        "CONTRACT_SENT",
        "contract",
        contract.id,
        {
            "contract_number": contract.contract_number,
            "title": contract.title,
            "email": contact.email if contact else None,
            "to_email": contact.email if contact else None,
            "phone": (contact.phone or contact.whatsapp) if contact else None,
        },
    )
    db.commit()
    
    return ContractResponse(
        id=contract.id,
        contract_number=contract.contract_number,
        quotation_id=contract.quotation_id,
        quotation_version=contract.quotation_version,
        lead_id=contract.lead_id,
        contact_id=contract.contact_id,
        title=contract.title,
        status=contract.status,
        start_date=contract.start_date,
        end_date=contract.end_date,
        scope=contract.scope,
        deliverables=contract.deliverables,
        payment_terms=contract.payment_terms,
        terms_and_conditions=contract.terms_and_conditions,
        created_by=contract.created_by,
        sent_at=contract.sent_at,
        accepted_at=contract.accepted_at,
        expired_at=contract.expired_at,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


@router.post("/{contract_id}/accept", response_model=dict)
async def accept_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Customer accepts the contract."""
    contract = db.query(Contract).get(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    
    if contract.status not in ["SENT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract must be SENT to accept. Current: {contract.status}",
        )
    
    old_status = contract.status
    contract.status = "ACCEPTED"
    contract.accepted_at = datetime.utcnow()
    
    # Create activity: Contract Accepted
    activity = Activity(
        activity_type="contract_accepted",
        title="Contract Accepted",
        description=f"Contract {contract.contract_number} accepted by customer",
        contract_id=contract.id,
        lead_id=contract.lead_id,
        performed_by=current_user["id"],
        metadata={"customer_id": current_user.get("id")},
    )
    db.add(activity)
    
    # Update related lead status to WON
    lead = db.query(Lead).get(contract.lead_id) if contract.lead_id else None
    if lead and lead.status != "WON":
        lead.status = "WON"
        db.add(Activity(
            activity_type="status_changed",
            title="Lead Won",
            description=f"Lead {lead.lead_number} marked WON after contract {contract.contract_number} accepted",
            lead_id=lead.id,
            contract_id=contract.id,
            performed_by=current_user["id"],
            metadata={"old_status": old_status, "new_status": "WON"},
        ))
    
    # Contract becomes ACTIVE after acceptance
    contract.status = "ACTIVE"
    
    # Auto-create Project from the accepted contract
    contact = db.query(Contact).get(contract.contact_id) if contract.contact_id else None
    quotation = db.query(Quotation).get(contract.quotation_id) if contract.quotation_id else None
    project = None
    if contract.lead_id:
        existing_project = db.query(Project).filter(Project.contract_id == contract.id).first()
        if not existing_project:
            from datetime import timedelta
            last_project = db.query(Project).order_by(Project.id.desc()).first()
            if last_project:
                try:
                    last_num = int(last_project.project_number.split("-")[-1])
                except (ValueError, IndexError):
                    last_num = 0
                next_num = last_num + 1
            else:
                next_num = 1
            project_number = f"PL-P-{next_num:06d}"
            project = Project(
                project_number=project_number,
                contract_id=contract.id,
                lead_id=contract.lead_id,
                quotation_id=contract.quotation_id,
                title=contract.title,
                description=contract.scope,
                status="PLANNING",
                priority="MEDIUM",
                project_type_id=lead.project_type_id if lead else None,
                subcategory_id=lead.subcategory_id if lead else None,
                start_date=contract.start_date,
                target_end_date=contract.end_date,
                secure_reference=secrets.token_urlsafe(16),
            )
            db.add(project)
            db.flush()
            db.add(Activity(
                activity_type="project_created",
                title="Project Created",
                description=f"Project {project.project_number} auto-created from accepted contract {contract.contract_number}",
                lead_id=contract.lead_id,
                contract_id=contract.id,
                quotation_id=contract.quotation_id,
                performed_by=current_user["id"],
            ))
    
    db.commit()
    db.refresh(contract)
    if project:
        db.refresh(project)

    dispatch_event(
        db,
        "CONTRACT_ACCEPTED",
        "contract",
        contract.id,
        {
            "contract_number": contract.contract_number,
            "title": contract.title,
            "project_id": project.id if project else None,
            "email": contact.email if contact else None,
            "to_email": contact.email if contact else None,
            "phone": (contact.phone or contact.whatsapp) if contact else None,
        },
    )
    create_notification(
        db,
        user_id=(lead.owner_id if lead and lead.owner_id else 1),
        title="Contract Accepted",
        body=f"Contract {contract.contract_number} accepted. Project {project.project_number if project else 'pending'} created.",
        notification_type="WORKFLOW",
        related_entity="contract",
        related_id=contract.id,
    )
    db.commit()
    
    return {
        "detail": "Contract accepted successfully",
        "contract_number": contract.contract_number,
        "accepted_at": contract.accepted_at,
        "status": contract.status,
        "project_number": project.project_number if project else None,
    }


@router.post("/{contract_id}/expire", response_model=dict)
async def expire_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Expire a contract (if not accepted)."""
    contract = db.query(Contract).get(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    
    if contract.status in ["ACCEPTED", "ACTIVE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot expire an accepted or active contract",
        )
    
    old_status = contract.status
    contract.status = "EXPIRED"
    contract.expired_at = datetime.utcnow()
    
    # Create activity: Contract Expired
    activity = Activity(
        activity_type="contract_expired",
        title="Contract Expired",
        description=f"Contract {contract.contract_number} expired",
        contract_id=contract.id,
        lead_id=contract.lead_id,
        performed_by=current_user["id"],
    )
    db.add(activity)
    
    db.commit()
    db.refresh(contract)
    
    return {
        "detail": "Contract expired successfully",
        "contract_number": contract.contract_number,
        "expired_at": contract.expired_at,
        "status": contract.status,
    }