from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import ProjectType, ProjectSubcategory, RequirementQuestion
from pydantic import BaseModel, Field
from typing import Optional, List
import json


router = APIRouter(prefix="/admin/requirement-questions", tags=["admin-requirement-questions"])


class QuestionResponse(BaseModel):
    id: int
    question: str
    field_key: str
    field_type: str
    is_required: bool
    options: Optional[List[str]] = None
    display_order: int
    is_active: bool
    project_type_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    question: str = Field(..., min_length=1)
    field_key: str = Field(..., min_length=1, max_length=100)
    field_type: str = Field(..., pattern="^(text|textarea|number|select|multi-select|radio|checkbox|date|url)$")
    is_required: bool = True
    options: Optional[List[str]] = None
    display_order: int = 0
    project_type_id: Optional[int] = None
    subcategory_id: Optional[int] = None


class QuestionUpdate(BaseModel):
    question: Optional[str] = None
    field_key: Optional[str] = None
    field_type: Optional[str] = None
    is_required: Optional[bool] = None
    options: Optional[List[str]] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_questions(
    project_type_id: Optional[int] = None,
    subcategory_id: Optional[int] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """List requirement questions, filtered by type/subcategory."""
    query = db.query(RequirementQuestion)
    if project_type_id:
        query = query.filter(RequirementQuestion.project_type_id == project_type_id)
    if subcategory_id:
        query = query.filter(RequirementQuestion.subcategory_id == subcategory_id)
    if active_only:
        query = query.filter(RequirementQuestion.is_active == True)
    return query.order_by(RequirementQuestion.display_order).all()


@router.get("/by-subcategory/{subcategory_id}")
async def questions_by_subcategory(
    subcategory_id: int,
    db: Session = Depends(get_db),
):
    """Get all questions for a specific subcategory."""
    questions = db.query(RequirementQuestion).filter(
        RequirementQuestion.subcategory_id == subcategory_id,
        RequirementQuestion.is_active == True
    ).order_by(RequirementQuestion.display_order).all()
    return questions


@router.get("/by-type/{type_id}")
async def questions_by_type(
    type_id: int,
    db: Session = Depends(get_db),
):
    """Get all questions for a specific project type."""
    questions = db.query(RequirementQuestion).filter(
        RequirementQuestion.project_type_id == type_id,
        RequirementQuestion.is_active == True
    ).order_by(RequirementQuestion.display_order).all()
    return questions


@router.post("/", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    db: Session = Depends(get_db),
):
    """Create a requirement question."""
    # Validate that at least one of project_type or subcategory is provided
    if not data.project_type_id and not data.subcategory_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either project_type_id or subcategory_id must be provided",
        )
    
    # If subcategory_id is provided, validate it belongs to the project_type
    if data.project_type_id and data.subcategory_id:
        subcategory = db.query(ProjectSubcategory).filter(
            ProjectSubcategory.id == data.subcategory_id,
            ProjectSubcategory.project_type_id == data.project_type_id
        ).first()
        if not subcategory:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subcategory does not belong to the specified project type",
            )
    
    question = RequirementQuestion(
        question=data.question,
        field_key=data.field_key,
        field_type=data.field_type,
        is_required=data.is_required,
        options=data.options,
        display_order=data.display_order,
        is_active=data.is_active,
        project_type_id=data.project_type_id,
        subcategory_id=data.subcategory_id,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    
    return QuestionResponse(
        id=question.id,
        question=question.question,
        field_key=question.field_key,
        field_type=question.field_type,
        is_required=question.is_required,
        options=question.options,
        display_order=question.display_order,
        is_active=question.is_active,
        project_type_id=question.project_type_id,
        subcategory_id=question.subcategory_id,
    )


@router.patch("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: int,
    data: QuestionUpdate,
    db: Session = Depends(get_db),
):
    """Update a requirement question."""
    question = db.query(RequirementQuestion).get(question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    
    db.commit()
    db.refresh(question)
    
    return QuestionResponse(
        id=question.id,
        question=question.question,
        field_key=question.field_key,
        field_type=question.field_type,
        is_required=question.is_required,
        options=question.options,
        display_order=question.display_order,
        is_active=question.is_active,
        project_type_id=question.project_type_id,
        subcategory_id=question.subcategory_id,
    )


@router.patch("/{question_id}/toggle")
async def toggle_question(
    question_id: int,
    db: Session = Depends(get_db),
):
    """Toggle question active status."""
    question = db.query(RequirementQuestion).get(question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    
    question.is_active = not question.is_active
    db.commit()
    
    return {"detail": f"Question {'activated' if question.is_active else 'deactivated'}"}


@router.get("/field-types")
async def list_field_types():
    """List supported field types."""
    return {
        "field_types": [
            "text",
            "textarea",
            "number",
            "select",
            "multi-select",
            "radio",
            "checkbox",
            "date",
            "url"
        ]
    }