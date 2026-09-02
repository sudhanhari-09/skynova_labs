from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import ProjectType, ProjectSubcategory
from pydantic import BaseModel, Field
from typing import Optional, List


router = APIRouter(prefix="/admin/project-types", tags=["admin-project-types"])


class ProjectTypeResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool
    display_order: int
    
    class Config:
        from_attributes = True


class ProjectTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class ProjectTypeUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class SubcategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class ProjectSubcategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    project_type_id: int
    description: Optional[str] = None
    is_active: bool
    display_order: int

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ProjectTypeResponse])
async def list_project_types(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """List project types."""
    query = db.query(ProjectType)
    if active_only:
        query = query.filter(ProjectType.is_active == True)
    return query.offset(skip).limit(limit).all()


@router.get("/{type_id}", response_model=ProjectTypeResponse)
async def get_project_type(
    type_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific project type."""
    project_type = db.query(ProjectType).get(type_id)
    if not project_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project type not found",
        )
    return ProjectTypeResponse(
        id=project_type.id,
        name=project_type.name,
        slug=project_type.slug,
        description=project_type.description,
        is_active=project_type.is_active,
        display_order=project_type.display_order,
    )


@router.post("/", response_model=ProjectTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_project_type(
    data: ProjectTypeCreate,
    db: Session = Depends(get_db),
):
    """Create a new project type."""
    # Check if slug already exists
    existing = db.query(ProjectType).filter(ProjectType.slug == data.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project type slug already exists",
        )
    
    project_type = ProjectType(
        name=data.name,
        slug=data.slug,
        description=data.description,
        is_active=data.is_active,
        display_order=data.display_order,
    )
    db.add(project_type)
    db.commit()
    db.refresh(project_type)
    
    return ProjectTypeResponse(
        id=project_type.id,
        name=project_type.name,
        slug=project_type.slug,
        description=project_type.description,
        is_active=project_type.is_active,
        display_order=project_type.display_order,
    )


@router.patch("/{type_id}", response_model=ProjectTypeResponse)
async def update_project_type(
    type_id: int,
    data: ProjectTypeUpdate,
    db: Session = Depends(get_db),
):
    """Update a project type."""
    project_type = db.query(ProjectType).get(type_id)
    if not project_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project type not found",
        )
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project_type, field, value)
    
    db.commit()
    db.refresh(project_type)
    
    return ProjectTypeResponse(
        id=project_type.id,
        name=project_type.name,
        slug=project_type.slug,
        description=project_type.description,
        is_active=project_type.is_active,
        display_order=project_type.display_order,
    )


@router.delete("/{type_id}")
async def delete_project_type(
    type_id: int,
    db: Session = Depends(get_db),
):
    """Soft delete a project type (set inactive)."""
    project_type = db.query(ProjectType).get(type_id)
    if not project_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project type not found",
        )
    
    project_type.is_active = False
    db.commit()
    
    return {"detail": "Project type deactivated"}


# Subcategories endpoints

@router.get("/{type_id}/subcategories", response_model=List[ProjectSubcategoryResponse])
async def list_subcategories(
    type_id: int,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """List subcategories for a project type."""
    query = db.query(ProjectSubcategory).filter(ProjectSubcategory.project_type_id == type_id)
    if active_only:
        query = query.filter(ProjectSubcategory.is_active == True)
    return query.all()


@router.post("/{type_id}/subcategories", response_model=ProjectSubcategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_subcategory(
    type_id: int,
    data: SubcategoryCreate,
    db: Session = Depends(get_db),
):
    """Create a subcategory under a project type."""
    # Verify project type exists
    project_type = db.query(ProjectType).get(type_id)
    if not project_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project type not found",
        )
    
    # Check if slug already exists under this project type
    existing = db.query(ProjectSubcategory).filter(
        ProjectSubcategory.slug == data.slug,
        ProjectSubcategory.project_type_id == type_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subcategory slug already exists under this project type",
        )
    
    subcategory = ProjectSubcategory(
        name=data.name,
        slug=data.slug,
        project_type_id=type_id,
        description=data.description,
        is_active=True,
        display_order=0,
    )
    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)
    
    return subcategory