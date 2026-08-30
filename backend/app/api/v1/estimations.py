from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import (
    Estimation, EstimationItem, Lead, User, Activity
)
from app.core.config import settings
from app.api.deps import get_current_user_dict
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


router = APIRouter(prefix="/admin/estimations", tags=["admin-estimations"])


# Pydantic Schemas

class EstimationItemForm(BaseModel):
    item_type: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    unit: Optional[str] = None
    unit_price: Decimal = Field(decimal_places=2, ge=0)
    discount: Decimal = Field(default=Decimal('0'), decimal_places=2, ge=0)
    tax: Decimal = Field(default=Decimal('0'), decimal_places=2, ge=0)


class EstimationCreate(BaseModel):
    lead_id: int
    prepared_by: int
    assumptions: Optional[str] = None
    notes: Optional[str] = None


class EstimationUpdate(BaseModel):
    status: Optional[str] = None  # DRAFT, IN_REVIEW, APPROVED, REJECTED
    assumptions: Optional[str] = None
    notes: Optional[str] = None


class EstimationResponse(BaseModel):
    id: int
    lead_id: int
    status: str
    prepared_by: Optional[int] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    assumptions: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EstimationItemResponse(BaseModel):
    id: int
    item_type: str
    name: str
    description: Optional[str] = None
    quantity: int
    unit: Optional[str] = None
    unit_price: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    display_order: int
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Helper: calculate estimation total
def calculate_estimation_total(items: List[EstimationItemForm]) -> Decimal:
    total = Decimal('0')
    for item in items:
        item_total = (item.unit_price * item.quantity) - item.discount + item.tax
        total += item_total
    return total.quantize(Decimal('0.01'))


@router.post("/", response_model=EstimationResponse, status_code=status.HTTP_201_CREATED)
async def create_estimation(
    data: EstimationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Create an estimation for a lead."""
    
    # Validate lead exists
    lead = db.query(Lead).get(data.lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    estimation = Estimation(
        lead_id=data.lead_id,
        status="DRAFT",
        prepared_by=current_user["id"],
        assumptions=data.assumptions,
        notes=data.notes,
    )
    db.add(estimation)
    db.flush()
    
    # Create activity: Estimation Created
    activity = Activity(
        activity_type="estimation_created",
        title="Estimation Created",
        description=f"Estimation created for lead {lead.lead_number}",
        lead_id=lead.id,
        performed_by=current_user["id"],
        metadata={"estimation_id": estimation.id, "status": "DRAFT"},
    )
    db.add(activity)
    
    # Update lead status from TECHNICAL_ANALYSIS to ESTIMATION
    if lead.status == "TECHNICAL_ANALYSIS":
        lead.status = "ESTIMATION"
    
    db.commit()
    db.refresh(estimation)
    
    return EstimationResponse(
        id=estimation.id,
        lead_id=estimation.lead_id,
        status=estimation.status,
        prepared_by=estimation.prepared_by,
        approved_by=estimation.approved_by,
        approved_at=estimation.approved_at,
        assumptions=estimation.assumptions,
        notes=estimation.notes,
        created_at=estimation.created_at,
        updated_at=estimation.updated_at,
    )


@router.get("/{estimation_id}", response_model=EstimationResponse)
async def get_estimation(
    estimation_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific estimation."""
    estimation = db.query(Estimation).get(estimation_id)
    if not estimation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found",
        )
    
    return EstimationResponse(
        id=estimation.id,
        lead_id=estimation.lead_id,
        status=estimation.status,
        prepared_by=estimation.prepared_by,
        approved_by=estimation.approved_by,
        approved_at=estimation.approved_at,
        assumptions=estimation.assumptions,
        notes=estimation.notes,
        created_at=estimation.created_at,
        updated_at=estimation.updated_at,
    )


@router.patch("/{estimation_id}", response_model=EstimationResponse)
async def update_estimation(
    estimation_id: int,
    data: EstimationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Update an estimation."""
    estimation = db.query(Estimation).get(estimation_id)
    if not estimation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found",
        )
    
    old_status = estimation.status
    
    # Update fields if provided
    if data.status:
        estimation.status = data.status
    
    if data.assumptions is not None:
        estimation.assumptions = data.assumptions
    
    if data.notes is not None:
        estimation.notes = data.notes
    
    # If moving to APPROVED
    if data.status == "APPROVED" and old_status != "APPROVED":
        estimation.approved_by = current_user["id"]
        estimation.approved_at = datetime.utcnow()
        
        # Create activity: Approved
        activity = Activity(
            activity_type="estimation_approved",
            title="Estimation Approved",
            description=f"Estimation {estimation.id} approved",
            lead_id=estimation.lead_id,
            performed_by=current_user["id"],
            metadata={"old_status": old_status, "new_status": "APPROVED"},
        )
        db.add(activity)
    
    # If moving from DRAFT/IN_REVIEW to APPROVED, update lead
    if estimation.status == "APPROVED" and old_status != "APPROVED":
        # Lead can now move to QUOTATION_PREPARATION
        pass
    
    db.commit()
    db.refresh(estimation)
    
    return EstimationResponse(
        id=estimation.id,
        lead_id=estimation.lead_id,
        status=estimation.status,
        prepared_by=estimation.prepared_by,
        approved_by=estimation.approved_by,
        approved_at=estimation.approved_at,
        assumptions=estimation.assumptions,
        notes=estimation.notes,
        created_at=estimation.created_at,
        updated_at=estimation.updated_at,
    )


@router.post("/{estimation_id}/approve", response_model=EstimationResponse)
async def approve_estimation(
    estimation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Approve an estimation."""
    estimation = db.query(Estimation).get(estimation_id)
    if not estimation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found",
        )
    
    if estimation.status not in ["DRAFT", "IN_REVIEW"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estimation must be DRAFT or IN_REVIEW to approve. Current: {estimation.status}",
        )
    
    old_status = estimation.status
    estimation.status = "APPROVED"
    estimation.approved_by = current_user["id"]
    estimation.approved_at = datetime.utcnow()
    
    # Create activity: Approved
    activity = Activity(
        activity_type="estimation_approved",
        title="Estimation Approved",
        description=f"Estimation {estimation.id} approved",
        lead_id=estimation.lead_id,
        performed_by=current_user["id"],
        metadata={"old_status": old_status, "new_status": "APPROVED"},
    )
    db.add(activity)
    
    # Update lead status to allow quotation preparation
    if estimation.lead_id:
        lead = db.query(Lead).get(estimation.lead_id)
        if lead and lead.status == "ESTIMATION":
            # Lead can now move to QUOTATION_PREPARATION
            pass
    
    db.commit()
    db.refresh(estimation)
    
    return EstimationResponse(
        id=estimation.id,
        lead_id=estimation.lead_id,
        status=estimation.status,
        prepared_by=estimation.prepared_by,
        approved_by=estimation.approved_by,
        approved_at=estimation.approved_at,
        assumptions=estimation.assumptions,
        notes=estimation.notes,
        created_at=estimation.created_at,
        updated_at=estimation.updated_at,
    )


@router.post("/{estimation_id}/items", response_model=EstimationItemResponse)
async def create_estimation_item(
    estimation_id: int,
    data: EstimationItemForm,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Create an estimation line item."""
    estimation = db.query(Estimation).get(estimation_id)
    if not estimation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found",
        )
    
    # Calculate total for this item
    item_total = (data.unit_price * data.quantity) - data.discount + data.tax
    
    item = EstimationItem(
        estimation_id=estimation_id,
        item_type=data.item_type,
        name=data.name,
        description=data.description,
        quantity=data.quantity,
        unit=data.unit,
        unit_price=data.unit_price,
        discount=data.discount,
        tax=data.tax,
        total=item_total,
        display_order=estimation.items.__len__() if hasattr(estimation, 'items') else 0,
        notes=data.notes,
    )
    db.add(item)
    
    # Recalculate estimation total
    # In production, would sum all items
    
    # Create activity: Item Added
    activity = Activity(
        activity_type="estimation_item_added",
        title="Estimation Item Added",
        description=f"Estimation item '{data.name}' added to estimation {estimation.id}",
        lead_id=estimation.lead_id,
        performed_by=current_user["id"],
        metadata={"item_id": item.id, "item_type": data.item_type},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(item)
    
    return EstimationItemResponse(
        id=item.id,
        item_type=item.item_type,
        name=item.name,
        description=item.description,
        quantity=item.quantity,
        unit=item.unit,
        unit_price=item.unit_price,
        discount=item.discount,
        tax=item.tax,
        total=item.total,
        display_order=item.display_order,
        notes=item.notes,
        created_at=item.created_at,
    )