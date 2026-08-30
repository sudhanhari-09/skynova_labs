from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import (
    TechnicalAnalysis, Lead, User, Activity
)
from app.core.config import settings
from app.api.deps import get_current_user_dict
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


router = APIRouter(prefix="/admin/technical-analyses", tags=["admin-technical-analyses"])


# Pydantic Schemas

class TechnicalAnalysisCreate(BaseModel):
    lead_id: int
    prepared_by: int
    business_requirement: Optional[str] = None
    technical_requirement: Optional[str] = None
    proposed_solution: Optional[str] = None
    architecture_notes: Optional[str] = None
    technologies: Optional[List[str]] = None
    integrations: Optional[List[str]] = None
    infrastructure_requirements: Optional[List[str]] = None
    security_requirements: Optional[str] = None
    assumptions: Optional[str] = None
    dependencies: Optional[List[str]] = None
    risks: Optional[List[dict]] = None
    constraints: Optional[List[dict]] = None
    notes: Optional[str] = None
    status: str = "DRAFT"


class TechnicalAnalysisUpdate(BaseModel):
    business_requirement: Optional[str] = None
    technical_requirement: Optional[str] = None
    proposed_solution: Optional[str] = None
    architecture_notes: Optional[str] = None
    technologies: Optional[List[str]] = None
    integrations: Optional[List[str]] = None
    infrastructure_requirements: Optional[List[str]] = None
    security_requirements: Optional[str] = None
    assumptions: Optional[str] = None
    dependencies: Optional[List[str]] = None
    risks: Optional[List[dict]] = None
    constraints: Optional[List[dict]] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class TechnicalAnalysisResponse(BaseModel):
    id: int
    lead_id: int
    prepared_by: Optional[int] = None
    business_requirement: Optional[str] = None
    technical_requirement: Optional[str] = None
    proposed_solution: Optional[str] = None
    architecture_notes: Optional[str] = None
    technologies: Optional[List[str]] = None
    integrations: Optional[List[str]] = None
    infrastructure_requirements: Optional[List[str]] = None
    security_requirements: Optional[str] = None
    assumptions: Optional[str] = None
    dependencies: Optional[List[str]] = None
    risks: Optional[List[dict]] = None
    constraints: Optional[List[dict]] = None
    notes: Optional[str] = None
    status: str
    created_by: Optional[int] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


@router.post("/", response_model=TechnicalAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def create_technical_analysis(
    data: TechnicalAnalysisCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Create a technical analysis for a lead."""
    
    # Validate lead exists
    lead = db.query(Lead).get(data.lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    
    # Permission check: current_user provided via Depends(get_current_active_user)
    
    technical_analysis = TechnicalAnalysis(
        lead_id=data.lead_id,
        prepared_by=current_user["id"],
        business_requirement=data.business_requirement,
        technical_requirement=data.technical_requirement,
        proposed_solution=data.proposed_solution,
        architecture_notes=data.architecture_notes,
        technologies=data.technologies,
        integrations=data.integrations,
        infrastructure_requirements=data.infrastructure_requirements,
        security_requirements=data.security_requirements,
        assumptions=data.assumptions,
        dependencies=data.dependencies,
        risks=data.risks,
        constraints=data.constraints,
        notes=data.notes,
        status=data.status,
    )
    db.add(technical_analysis)
    db.flush()
    
    # Create activity: Technical Analysis Created
    activity = Activity(
        activity_type="technical_analysis_created",
        title="Technical Analysis Created",
        description=f"Technical analysis created for lead {lead.lead_number}",
        lead_id=lead.id,
        performed_by=current_user["id"],
        metadata={"analysis_id": technical_analysis.id, "status": technical_analysis.status},
    )
    db.add(activity)
    
    # Update lead status to TECHNICAL_ANALYSIS if it was in ESTIMATION
    if lead.status == "ESTIMATION":
        lead.status = "TECHNICAL_ANALYSIS"
    
    db.commit()
    db.refresh(technical_analysis)
    
    return TechnicalAnalysisResponse(
        id=technical_analysis.id,
        lead_id=technical_analysis.lead_id,
        prepared_by=technical_analysis.prepared_by,
        business_requirement=technical_analysis.business_requirement,
        technical_requirement=technical_analysis.technical_requirement,
        proposed_solution=technical_analysis.proposed_solution,
        architecture_notes=technical_analysis.architecture_notes,
        technologies=technical_analysis.technologies,
        integrations=technical_analysis.integrations,
        infrastructure_requirements=technical_analysis.infrastructure_requirements,
        security_requirements=technical_analysis.security_requirements,
        assumptions=technical_analysis.assumptions,
        dependencies=technical_analysis.dependencies,
        risks=technical_analysis.risks,
        constraints=technical_analysis.constraints,
        notes=technical_analysis.notes,
        status=technical_analysis.status,
        created_by=technical_analysis.created_by,
        approved_by=technical_analysis.approved_by,
        approved_at=technical_analysis.approved_at,
        reviewed_by=technical_analysis.reviewed_by,
        reviewed_at=technical_analysis.reviewed_at,
        created_at=technical_analysis.created_at,
        updated_at=technical_analysis.updated_at,
    )


@router.get("/{analysis_id}", response_model=TechnicalAnalysisResponse)
async def get_technical_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific technical analysis."""
    analysis = db.query(TechnicalAnalysis).get(analysis_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technical analysis not found",
        )
    
    return TechnicalAnalysisResponse(
        id=analysis.id,
        lead_id=analysis.lead_id,
        prepared_by=analysis.prepared_by,
        business_requirement=analysis.business_requirement,
        technical_requirement=analysis.technical_requirement,
        proposed_solution=analysis.proposed_solution,
        architecture_notes=analysis.architecture_notes,
        technologies=analysis.technologies,
        integrations=analysis.integrations,
        infrastructure_requirements=analysis.infrastructure_requirements,
        security_requirements=analysis.security_requirements,
        assumptions=analysis.assumptions,
        dependencies=analysis.dependencies,
        risks=analysis.risks,
        constraints=analysis.constraints,
        notes=analysis.notes,
        status=analysis.status,
        created_by=analysis.created_by,
        approved_by=analysis.approved_by,
        approved_at=analysis.approved_at,
        reviewed_by=analysis.reviewed_by,
        reviewed_at=analysis.reviewed_at,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )


@router.patch("/{analysis_id}", response_model=TechnicalAnalysisResponse)
async def update_technical_analysis(
    analysis_id: int,
    data: TechnicalAnalysisUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Update a technical analysis."""
    analysis = db.query(TechnicalAnalysis).get(analysis_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technical analysis not found",
        )
    
    old_status = analysis.status
    
    # Update fields if provided
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(analysis, field, value)
    
    # If status changed to APPROVED
    if data.status and data.status == "APPROVED" and old_status != "APPROVED":
        analysis.status = "APPROVED"
        analysis.approved_by = current_user["id"]
        analysis.approved_at = datetime.utcnow()
        
        # Update lead status if moving from TECHNICAL_ANALYSIS to ESTIMATION
        if analysis.lead_id:
            lead = db.query(Lead).get(analysis.lead_id)
            if lead and lead.status == "TECHNICAL_ANALYSIS":
                lead.status = "ESTIMATION"
    
    # Create activity: Updated
    activity = Activity(
        activity_type="technical_analysis_updated",
        title="Technical Analysis Updated",
        description=f"Technical analysis {analysis.id} updated",
        lead_id=analysis.lead_id,
        performed_by=current_user["id"],
        metadata={"old_status": old_status, "new_status": analysis.status},
    )
    db.add(activity)
    
    db.commit()
    db.refresh(analysis)
    
    return TechnicalAnalysisResponse(
        id=analysis.id,
        lead_id=analysis.lead_id,
        prepared_by=analysis.prepared_by,
        business_requirement=analysis.business_requirement,
        technical_requirement=analysis.technical_requirement,
        proposed_solution=analysis.proposed_solution,
        architecture_notes=analysis.architecture_notes,
        technologies=analysis.technologies,
        integrations=analysis.integrations,
        infrastructure_requirements=analysis.infrastructure_requirements,
        security_requirements=analysis.security_requirements,
        assumptions=analysis.assumptions,
        dependencies=analysis.dependencies,
        risks=analysis.risks,
        constraints=analysis.constraints,
        notes=analysis.notes,
        status=analysis.status,
        created_by=analysis.created_by,
        approved_by=analysis.approved_by,
        approved_at=analysis.approved_at,
        reviewed_by=analysis.reviewed_by,
        reviewed_at=analysis.reviewed_at,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )