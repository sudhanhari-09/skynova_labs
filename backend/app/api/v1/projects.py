from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db import get_db
from app.models.auth import (
    Project, ProjectMember, Milestone, Task, TaskComment, ProjectUpdate,
    Lead, Contact, User, Contract, Quotation, Activity
)
from app.models.operations import Notification
from app.services.notifications import create_notification, dispatch_event
from app.core.config import settings
from app.api.deps import get_current_user_dict
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import secrets


router = APIRouter(prefix="/admin/projects", tags=["admin-projects"])


# ============================================================
# Pydantic Schemas
# ============================================================

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1)
    acronym: Optional[str] = None
    description: Optional[str] = None
    contract_id: Optional[int] = None
    lead_id: Optional[int] = None
    quotation_id: Optional[int] = None
    priority: str = "MEDIUM"
    manager_id: Optional[int] = None
    project_type_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    full_budget: Optional[float] = None
    reserved_budget: Optional[float] = None
    customer_budget: Optional[float] = None
    currency: str = "USD"
    notes: Optional[str] = None


class ProjectUpdatePatch(BaseModel):
    title: Optional[str] = None
    acronym: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    manager_id: Optional[int] = None
    project_type_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    full_budget: Optional[float] = None
    reserved_budget: Optional[float] = None
    customer_budget: Optional[float] = None
    currency: Optional[str] = None
    notes: Optional[str] = None


class ProjectStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1)


class ProjectAssignManager(BaseModel):
    manager_id: int


class ProjectResponse(BaseModel):
    id: int
    project_number: str
    contract_id: Optional[int] = None
    lead_id: Optional[int] = None
    quotation_id: Optional[int] = None
    title: str
    acronym: Optional[str] = None
    description: Optional[str] = None
    status: str
    priority: str
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    contract_number: Optional[str] = None
    lead_number: Optional[str] = None
    contact_name: Optional[str] = None
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    full_budget: Optional[float] = None
    reserved_budget: Optional[float] = None
    customer_budget: Optional[float] = None
    currency: str
    secure_reference: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tasks_count: int = 0
    tasks_done: int = 0
    members_count: int = 0
    milestones_count: int = 0

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int


class ProjectMemberCreate(BaseModel):
    user_id: int
    role: str = "DEVELOPER"
    is_lead: bool = False


class ProjectMemberUpdate(BaseModel):
    role: Optional[str] = None
    is_lead: Optional[bool] = None
    status: Optional[str] = None


class ProjectMemberResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    role: str
    is_lead: bool
    status: str
    joined_at: Optional[datetime] = None
    user_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MilestoneCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    display_order: int = 0


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    display_order: Optional[int] = None


class MilestoneResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str
    completed_at: Optional[datetime] = None
    display_order: int
    created_at: datetime
    tasks_count: int = 0

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    milestone_id: Optional[int] = None
    assignee_id: Optional[int] = None
    priority: str = "MEDIUM"
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    display_order: int = 0


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    milestone_id: Optional[int] = None
    assignee_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    display_order: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    project_id: int
    milestone_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    completed_at: Optional[datetime] = None
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)
    is_internal: bool = True


class TaskCommentResponse(BaseModel):
    id: int
    task_id: int
    author_id: int
    author_name: Optional[str] = None
    content: str
    is_internal: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectUpdateCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: Optional[str] = None
    update_type: str = "GENERAL"
    is_internal: bool = True
    is_user_visible: bool = False


class ProjectUpdateResponse(BaseModel):
    id: int
    project_id: int
    author_id: int
    author_name: Optional[str] = None
    title: str
    content: Optional[str] = None
    update_type: str
    status: Optional[str] = None
    is_internal: bool
    is_user_visible: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Helpers
# ============================================================

def generate_project_number(db: Session) -> str:
    last_project = db.query(Project).order_by(Project.id.desc()).first()
    if last_project and last_project.project_number.startswith("PL-P-"):
        try:
            last_num = int(last_project.project_number.split("-")[-1])
            return f"PL-P-{last_num + 1:06d}"
        except (ValueError, IndexError):
            pass
    count = db.query(Project).count()
    return f"PL-P-{count + 1:06d}"


def generate_secure_reference() -> str:
    return secrets.token_urlsafe(16)


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


def get_milestone_or_404(db: Session, milestone_id: int, project_id: int) -> Milestone:
    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id,
        Milestone.project_id == project_id,
    ).first()
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )
    return milestone


def get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return task


def build_project_response(db: Session, project: Project) -> ProjectResponse:
    manager_name = None
    if project.manager:
        manager_name = f"{project.manager.first_name or ''} {project.manager.last_name or ''}".strip() or project.manager.email

    contract_number = project.contract.contract_number if project.contract else None
    lead_number = project.lead.lead_number if project.lead else None

    contact_name = None
    if project.lead and project.lead.contact:
        contact_name = f"{project.lead.contact.first_name} {project.lead.contact.last_name}"
    elif project.contract and project.contract.contact:
        contact_name = f"{project.contract.contact.first_name} {project.contract.contact.last_name}"

    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    tasks_count = len(tasks)
    tasks_done = sum(1 for t in tasks if t.status == "DONE")
    members_count = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.status == "ACTIVE",
    ).count()
    milestones_count = db.query(Milestone).filter(Milestone.project_id == project.id).count()

    return ProjectResponse(
        id=project.id,
        project_number=project.project_number,
        contract_id=project.contract_id,
        lead_id=project.lead_id,
        quotation_id=project.quotation_id,
        title=project.title,
        acronym=project.acronym,
        description=project.description,
        status=project.status,
        priority=project.priority,
        manager_id=project.manager_id,
        manager_name=manager_name,
        contract_number=contract_number,
        lead_number=lead_number,
        contact_name=contact_name,
        start_date=project.start_date,
        target_end_date=project.target_end_date,
        actual_end_date=project.actual_end_date,
        full_budget=project.full_budget,
        reserved_budget=project.reserved_budget,
        customer_budget=project.customer_budget,
        currency=project.currency,
        secure_reference=project.secure_reference,
        notes=project.notes,
        created_at=project.created_at,
        updated_at=project.updated_at,
        tasks_count=tasks_count,
        tasks_done=tasks_done,
        members_count=members_count,
        milestones_count=milestones_count,
    )


# ============================================================
# Project CRUD
# ============================================================

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),  # Placeholder - real auth in production
):
    """Create a new project from a contract, lead, or quotation."""
    if data.lead_id:
        lead = db.query(Lead).get(data.lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found",
            )
    if data.contract_id:
        contract = db.query(Contract).get(data.contract_id)
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contract not found",
            )
        existing = db.query(Project).filter(Project.contract_id == data.contract_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A project already exists for this contract ({existing.project_number})",
            )
    if data.quotation_id:
        quotation = db.query(Quotation).get(data.quotation_id)
        if not quotation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quotation not found",
            )
    if data.manager_id:
        manager = db.query(User).get(data.manager_id)
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned manager not found",
            )

    project_number = generate_project_number(db)

    project = Project(
        project_number=project_number,
        contract_id=data.contract_id,
        lead_id=data.lead_id,
        quotation_id=data.quotation_id,
        title=data.title,
        acronym=data.acronym,
        description=data.description,
        status="PLANNING",
        priority=data.priority,
        manager_id=data.manager_id,
        project_type_id=data.project_type_id,
        subcategory_id=data.subcategory_id,
        start_date=data.start_date,
        target_end_date=data.target_end_date,
        full_budget=data.full_budget,
        reserved_budget=data.reserved_budget,
        customer_budget=data.customer_budget,
        currency=data.currency,
        secure_reference=generate_secure_reference(),
        notes=data.notes,
    )
    db.add(project)
    db.flush()

    # Create activity: Project Created
    activity = Activity(
        activity_type="project_created",
        title="Project Created",
        description=f"Project {project.project_number} created",
        performed_by=current_user["id"],
        metadata={"lead_id": data.lead_id, "contract_id": data.contract_id},
    )
    db.add(activity)

    db.commit()
    db.refresh(project)

    return build_project_response(db, project)


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    manager_id: Optional[int] = None,
    contract_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    """List projects with filtering and pagination."""
    query = db.query(Project)

    if status_filter:
        query = query.filter(Project.status == status_filter)
    if priority:
        query = query.filter(Project.priority == priority)
    if manager_id:
        query = query.filter(Project.manager_id == manager_id)
    if contract_id:
        query = query.filter(Project.contract_id == contract_id)
    if lead_id:
        query = query.filter(Project.lead_id == lead_id)
    if search:
        query = query.filter(
            or_(
                Project.title.ilike(f"%{search}%"),
                Project.project_number.ilike(f"%{search}%"),
                Project.acronym.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    projects = (
        query.order_by(Project.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ProjectListResponse(
        projects=[build_project_response(db, p) for p in projects],
        total=total,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific project with summary counts."""
    project = get_project_or_404(db, project_id)
    return build_project_response(db, project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    data: ProjectUpdatePatch,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Update a project's details."""
    project = get_project_or_404(db, project_id)

    update_data = data.model_dump(exclude_unset=True)
    old_status = project.status

    for field, value in update_data.items():
        setattr(project, field, value)

    # Validate status value
    if "status" in update_data and update_data["status"] not in [
        "PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED",
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {update_data['status']}",
        )

    # Track status change
    if "status" in update_data and update_data["status"] != old_status:
        project_update = ProjectUpdate(
            project_id=project.id,
            author_id=current_user["id"],
            title=f"Status changed to {update_data['status']}",
            content=f"Project status changed from {old_status} to {update_data['status']}",
            update_type="STATUS_CHANGE",
            status=update_data["status"],
            is_internal=True,
            is_user_visible=True,
        )
        db.add(project_update)

        activity = Activity(
            activity_type="project_status_changed",
            title="Project Status Changed",
            description=f"Project {project.project_number} status changed from {old_status} to {update_data['status']}",
            performed_by=current_user["id"],
            metadata={"old_status": old_status, "new_status": update_data["status"]},
        )
        db.add(activity)

    db.commit()
    db.refresh(project)

    return build_project_response(db, project)


@router.post("/{project_id}/status", response_model=ProjectResponse)
async def change_project_status(
    project_id: int,
    data: ProjectStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Change a project's status with activity tracking."""
    project = get_project_or_404(db, project_id)

    valid_statuses = ["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "TESTING", "LIVE", "MAINTENANCE", "ARCHIVED"]
    if data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    old_status = project.status
    project.status = data.status

    if data.status == "COMPLETED":
        project.actual_end_date = datetime.utcnow()

    project_update = ProjectUpdate(
        project_id=project.id,
        author_id=current_user["id"],
        title=f"Status changed to {data.status}",
        content=f"Project status changed from {old_status} to {data.status}",
        update_type="STATUS_CHANGE",
        status=data.status,
        is_internal=True,
        is_user_visible=True,
    )
    db.add(project_update)

    activity = Activity(
        activity_type="project_status_changed",
        title="Project Status Changed",
        description=f"Project {project.project_number} status changed from {old_status} to {data.status}",
        performed_by=current_user["id"],
        metadata={"old_status": old_status, "new_status": data.status},
    )
    db.add(activity)

    db.commit()
    db.refresh(project)

    # Notify + automate customer status changes
    contact = None
    if project.lead_id:
        lead = db.query(Lead).get(project.lead_id)
        if lead and lead.contact_id:
            contact = db.query(Contact).get(lead.contact_id)
    dispatch_event(
        db,
        "PROJECT_STATUS_CHANGED",
        "project",
        project.id,
        {
            "project_number": project.project_number,
            "title": project.title,
            "old_status": old_status,
            "new_status": data.status,
            "email": contact.email if contact else None,
            "to_email": contact.email if contact else None,
            "phone": (contact.phone or contact.whatsapp) if contact else None,
        },
    )
    create_notification(
        db,
        user_id=(project.manager_id or 1),
        title="Project Status Changed",
        body=f"Project {project.project_number} changed from {old_status} to {data.status}",
        notification_type="WORKFLOW",
        related_entity="project",
        related_id=project.id,
    )
    db.commit()
    db.refresh(project)

    return build_project_response(db, project)


@router.post("/{project_id}/assign-manager", response_model=ProjectResponse)
async def assign_project_manager(
    project_id: int,
    data: ProjectAssignManager,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Assign a project manager to a project."""
    project = get_project_or_404(db, project_id)

    manager = db.query(User).get(data.manager_id)
    if not manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manager not found",
        )

    old_manager_name = project.manager.email if project.manager else "None"
    project.manager_id = data.manager_id

    project_update = ProjectUpdate(
        project_id=project.id,
        author_id=current_user["id"],
        title="Project manager assigned",
        content=f"Project manager assigned: {manager.first_name or ''} {manager.last_name or ''}".strip() or manager.email,
        update_type="GENERAL",
        status=project.status,
        is_internal=True,
        is_user_visible=False,
    )
    db.add(project_update)

    activity = Activity(
        activity_type="project_manager_assigned",
        title="Project Manager Assigned",
        description=f"Project {project.project_number} manager assigned (was: {old_manager_name})",
        performed_by=current_user["id"],
        metadata={"old_manager_id": None, "new_manager_id": data.manager_id},
    )
    db.add(activity)

    db.commit()
    db.refresh(project)

    return build_project_response(db, project)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    """Delete a project (cascade deletes members, milestones, tasks, updates)."""
    project = get_project_or_404(db, project_id)
    project_number = project.project_number
    db.delete(project)
    db.commit()
    return {"detail": f"Project {project_number} deleted"}


# ============================================================
# Project Members
# ============================================================

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def list_project_members(
    project_id: int,
    db: Session = Depends(get_db),
):
    """List members of a project."""
    project = get_project_or_404(db, project_id)
    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project.id)
        .order_by(ProjectMember.is_lead.desc(), ProjectMember.joined_at.asc())
        .all()
    )
    result = []
    for m in members:
        user_name = f"{m.user.first_name or ''} {m.user.last_name or ''}".strip() or m.user.email if m.user else None
        result.append(
            ProjectMemberResponse(
                id=m.id,
                project_id=m.project_id,
                user_id=m.user_id,
                role=m.role,
                is_lead=m.is_lead,
                status=m.status,
                joined_at=m.joined_at,
                user_name=user_name,
                created_at=m.created_at,
            )
        )
    return result


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: int,
    data: ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Add a team member to a project."""
    project = get_project_or_404(db, project_id)

    user = db.query(User).get(data.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == data.user_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project",
        )

    member = ProjectMember(
        project_id=project.id,
        user_id=data.user_id,
        role=data.role,
        is_lead=data.is_lead,
        status="ACTIVE",
        joined_at=datetime.utcnow(),
    )
    db.add(member)

    activity = Activity(
        activity_type="project_member_added",
        title="Team Member Added",
        description=f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
        performed_by=current_user["id"],
        metadata={"project_id": project.id, "user_id": data.user_id, "role": data.role},
    )
    db.add(activity)

    db.commit()
    db.refresh(member)

    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
        is_lead=member.is_lead,
        status=member.status,
        joined_at=member.joined_at,
        user_name=user_name,
        created_at=member.created_at,
    )


@router.patch("/{project_id}/members/{member_id}", response_model=ProjectMemberResponse)
async def update_project_member(
    project_id: int,
    member_id: int,
    data: ProjectMemberUpdate,
    db: Session = Depends(get_db),
):
    """Update a project member's role or status."""
    get_project_or_404(db, project_id)

    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id,
        ProjectMember.project_id == project_id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project member not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    db.commit()
    db.refresh(member)

    user_name = f"{member.user.first_name or ''} {member.user.last_name or ''}".strip() or member.user.email if member.user else None
    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
        is_lead=member.is_lead,
        status=member.status,
        joined_at=member.joined_at,
        user_name=user_name,
        created_at=member.created_at,
    )


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_200_OK)
async def remove_project_member(
    project_id: int,
    member_id: int,
    db: Session = Depends(get_db),
):
    """Remove a member from a project."""
    get_project_or_404(db, project_id)

    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id,
        ProjectMember.project_id == project_id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project member not found",
        )

    db.delete(member)
    db.commit()
    return {"detail": "Project member removed"}


# ============================================================
# Milestones
# ============================================================

@router.get("/{project_id}/milestones", response_model=List[MilestoneResponse])
async def list_milestones(
    project_id: int,
    db: Session = Depends(get_db),
):
    """List milestones for a project."""
    project = get_project_or_404(db, project_id)
    milestones = (
        db.query(Milestone)
        .filter(Milestone.project_id == project.id)
        .order_by(Milestone.display_order.asc(), Milestone.due_date.asc())
        .all()
    )
    result = []
    for m in milestones:
        tasks_count = db.query(Task).filter(Task.milestone_id == m.id).count()
        result.append(
            MilestoneResponse(
                id=m.id,
                project_id=m.project_id,
                name=m.name,
                description=m.description,
                due_date=m.due_date,
                status=m.status,
                completed_at=m.completed_at,
                display_order=m.display_order,
                created_at=m.created_at,
                tasks_count=tasks_count,
            )
        )
    return result


@router.post("/{project_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    project_id: int,
    data: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Create a milestone for a project."""
    project = get_project_or_404(db, project_id)

    milestone = Milestone(
        project_id=project.id,
        name=data.name,
        description=data.description,
        due_date=data.due_date,
        status="PENDING",
        display_order=data.display_order,
    )
    db.add(milestone)

    project_update = ProjectUpdate(
        project_id=project.id,
        author_id=current_user["id"],
        title=f"Milestone added: {data.name}",
        content=data.description,
        update_type="MILESTONE",
        status=project.status,
        is_internal=True,
        is_user_visible=True,
    )
    db.add(project_update)

    db.commit()
    db.refresh(milestone)

    return MilestoneResponse(
        id=milestone.id,
        project_id=milestone.project_id,
        name=milestone.name,
        description=milestone.description,
        due_date=milestone.due_date,
        status=milestone.status,
        completed_at=milestone.completed_at,
        display_order=milestone.display_order,
        created_at=milestone.created_at,
        tasks_count=0,
    )


@router.patch("/{project_id}/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    project_id: int,
    milestone_id: int,
    data: MilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Update a milestone, including its status."""
    project = get_project_or_404(db, project_id)
    milestone = get_milestone_or_404(db, milestone_id, project.id)

    update_data = data.model_dump(exclude_unset=True)
    old_status = milestone.status

    for field, value in update_data.items():
        setattr(milestone, field, value)

    if "status" in update_data:
        if update_data["status"] not in ["PENDING", "IN_PROGRESS", "COMPLETED", "DELAYED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {update_data['status']}",
            )
        if update_data["status"] == "COMPLETED" and not milestone.completed_at:
            milestone.completed_at = datetime.utcnow()
        if update_data["status"] != "COMPLETED":
            milestone.completed_at = None

        if update_data["status"] != old_status:
            project_update = ProjectUpdate(
                project_id=project.id,
                author_id=current_user["id"],
                title=f"Milestone '{milestone.name}' is {update_data['status']}",
                content=None,
                update_type="MILESTONE",
                status=project.status,
                is_internal=True,
                is_user_visible=True,
            )
            db.add(project_update)

    db.commit()
    db.refresh(milestone)

    tasks_count = db.query(Task).filter(Task.milestone_id == milestone.id).count()
    return MilestoneResponse(
        id=milestone.id,
        project_id=milestone.project_id,
        name=milestone.name,
        description=milestone.description,
        due_date=milestone.due_date,
        status=milestone.status,
        completed_at=milestone.completed_at,
        display_order=milestone.display_order,
        created_at=milestone.created_at,
        tasks_count=tasks_count,
    )


@router.delete("/{project_id}/milestones/{milestone_id}", status_code=status.HTTP_200_OK)
async def delete_milestone(
    project_id: int,
    milestone_id: int,
    db: Session = Depends(get_db),
):
    """Delete a milestone (its tasks are also deleted)."""
    project = get_project_or_404(db, project_id)
    milestone = get_milestone_or_404(db, milestone_id, project.id)
    db.delete(milestone)
    db.commit()
    return {"detail": "Milestone deleted"}


# ============================================================
# Tasks
# ============================================================

@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: int,
    milestone_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List tasks for a project with filters."""
    project = get_project_or_404(db, project_id)
    query = db.query(Task).filter(Task.project_id == project.id)

    if milestone_id:
        query = query.filter(Task.milestone_id == milestone_id)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if status_filter:
        query = query.filter(Task.status == status_filter)

    tasks = query.order_by(Task.display_order.asc(), Task.due_date.asc()).all()

    result = []
    for t in tasks:
        assignee_name = f"{t.assignee.first_name or ''} {t.assignee.last_name or ''}".strip() or t.assignee.email if t.assignee else None
        result.append(
            TaskResponse(
                id=t.id,
                project_id=t.project_id,
                milestone_id=t.milestone_id,
                title=t.title,
                description=t.description,
                assignee_id=t.assignee_id,
                assignee_name=assignee_name,
                status=t.status,
                priority=t.priority,
                due_date=t.due_date,
                estimated_hours=t.estimated_hours,
                actual_hours=t.actual_hours,
                completed_at=t.completed_at,
                display_order=t.display_order,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )
    return result


@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Create a task within a project (optionally under a milestone)."""
    project = get_project_or_404(db, project_id)

    if data.milestone_id:
        get_milestone_or_404(db, data.milestone_id, project.id)

    if data.assignee_id:
        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == data.assignee_id,
            ProjectMember.status == "ACTIVE",
        ).first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be an active member of this project",
            )

    task = Task(
        project_id=project.id,
        milestone_id=data.milestone_id,
        title=data.title,
        description=data.description,
        assignee_id=data.assignee_id,
        status="TODO",
        priority=data.priority,
        due_date=data.due_date,
        estimated_hours=data.estimated_hours,
        display_order=data.display_order,
    )
    db.add(task)
    db.flush()

    activity = Activity(
        activity_type="task_created",
        title="Task Created",
        description=f"Task '{task.title}' created in project {project.project_number}",
        performed_by=current_user["id"],
        metadata={"project_id": project.id, "task_id": task.id, "milestone_id": task.milestone_id},
    )
    db.add(activity)

    db.commit()
    db.refresh(task)

    assignee_name = f"{task.assignee.first_name or ''} {task.assignee.last_name or ''}".strip() or task.assignee.email if task.assignee else None
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        milestone_id=task.milestone_id,
        title=task.title,
        description=task.description,
        assignee_id=task.assignee_id,
        assignee_name=assignee_name,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours,
        completed_at=task.completed_at,
        display_order=task.display_order,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.patch("/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: int,
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Update a task, including status changes and assignment."""
    project = get_project_or_404(db, project_id)
    task = get_task_or_404(db, task_id)

    if task.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this project",
        )

    update_data = data.model_dump(exclude_unset=True)
    old_status = task.status

    for field, value in update_data.items():
        setattr(task, field, value)

    if "status" in update_data:
        if update_data["status"] not in ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {update_data['status']}",
            )
        if update_data["status"] == "DONE" and not task.completed_at:
            task.completed_at = datetime.utcnow()
        if update_data["status"] != "DONE":
            task.completed_at = None

        if update_data["status"] != old_status:
            activity = Activity(
                activity_type="task_status_changed",
                title="Task Status Changed",
                description=f"Task '{task.title}' status changed from {old_status} to {update_data['status']}",
                performed_by=current_user["id"],
                metadata={"task_id": task.id, "old_status": old_status, "new_status": update_data["status"]},
            )
            db.add(activity)

    if "assignee_id" in update_data and update_data["assignee_id"] is not None:
        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == update_data["assignee_id"],
            ProjectMember.status == "ACTIVE",
        ).first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be an active member of this project",
            )

    db.commit()
    db.refresh(task)

    assignee_name = f"{task.assignee.first_name or ''} {task.assignee.last_name or ''}".strip() or task.assignee.email if task.assignee else None
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        milestone_id=task.milestone_id,
        title=task.title,
        description=task.description,
        assignee_id=task.assignee_id,
        assignee_name=assignee_name,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours,
        completed_at=task.completed_at,
        display_order=task.display_order,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_200_OK)
async def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
):
    """Delete a task."""
    project = get_project_or_404(db, project_id)
    task = get_task_or_404(db, task_id)

    if task.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this project",
        )

    db.delete(task)
    db.commit()
    return {"detail": "Task deleted"}


# ============================================================
# Task Comments
# ============================================================

@router.get("/{project_id}/tasks/{task_id}/comments", response_model=List[TaskCommentResponse])
async def list_task_comments(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
):
    """List comments on a task."""
    project = get_project_or_404(db, project_id)
    task = get_task_or_404(db, task_id)

    if task.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this project",
        )

    comments = db.query(TaskComment).filter(TaskComment.task_id == task.id).order_by(TaskComment.created_at.asc()).all()

    result = []
    for c in comments:
        author_name = f"{c.author.first_name or ''} {c.author.last_name or ''}".strip() or c.author.email if c.author else None
        result.append(
            TaskCommentResponse(
                id=c.id,
                task_id=c.task_id,
                author_id=c.author_id,
                author_name=author_name,
                content=c.content,
                is_internal=c.is_internal,
                created_at=c.created_at,
            )
        )
    return result


@router.post("/{project_id}/tasks/{task_id}/comments", response_model=TaskCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_task_comment(
    project_id: int,
    task_id: int,
    data: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Add a comment to a task."""
    project = get_project_or_404(db, project_id)
    task = get_task_or_404(db, task_id)

    if task.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this project",
        )

    comment = TaskComment(
        task_id=task.id,
        author_id=current_user["id"],
        content=data.content,
        is_internal=data.is_internal,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    author = db.query(User).get(current_user["id"])
    author_name = f"{author.first_name or ''} {author.last_name or ''}".strip() or author.email if author else None
    return TaskCommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author_name=author_name,
        content=comment.content,
        is_internal=comment.is_internal,
        created_at=comment.created_at,
    )


# ============================================================
# Project Updates (Progress Log)
# ============================================================

@router.get("/{project_id}/updates", response_model=List[ProjectUpdateResponse])
async def list_project_updates(
    project_id: int,
    user_visible_only: bool = False,
    db: Session = Depends(get_db),
):
    """List progress updates for a project."""
    project = get_project_or_404(db, project_id)

    query = db.query(ProjectUpdate).filter(ProjectUpdate.project_id == project.id)
    if user_visible_only:
        query = query.filter(ProjectUpdate.is_user_visible == True)

    updates = query.order_by(ProjectUpdate.created_at.desc()).all()

    result = []
    for u in updates:
        author_name = f"{u.author.first_name or ''} {u.author.last_name or ''}".strip() or u.author.email if u.author else None
        result.append(
            ProjectUpdateResponse(
                id=u.id,
                project_id=u.project_id,
                author_id=u.author_id,
                author_name=author_name,
                title=u.title,
                content=u.content,
                update_type=u.update_type,
                status=u.status,
                is_internal=u.is_internal,
                is_user_visible=u.is_user_visible,
                created_at=u.created_at,
            )
        )
    return result


@router.post("/{project_id}/updates", response_model=ProjectUpdateResponse, status_code=status.HTTP_201_CREATED)
async def create_project_update(
    project_id: int,
    data: ProjectUpdateCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    """Post a progress update for a project."""
    project = get_project_or_404(db, project_id)

    project_update = ProjectUpdate(
        project_id=project.id,
        author_id=current_user["id"],
        title=data.title,
        content=data.content,
        update_type=data.update_type,
        status=project.status,
        is_internal=data.is_internal,
        is_user_visible=data.is_user_visible,
    )
    db.add(project_update)

    activity = Activity(
        activity_type="project_update_added",
        title="Project Update Added",
        description=data.title,
        performed_by=current_user["id"],
        metadata={"project_id": project.id, "update_id": project_update.id},
    )
    db.add(activity)

    db.commit()
    db.refresh(project_update)

    author = db.query(User).get(current_user["id"])
    author_name = f"{author.first_name or ''} {author.last_name or ''}".strip() or author.email if author else None
    return ProjectUpdateResponse(
        id=project_update.id,
        project_id=project_update.project_id,
        author_id=project_update.author_id,
        author_name=author_name,
        title=project_update.title,
        content=project_update.content,
        update_type=project_update.update_type,
        status=project_update.status,
        is_internal=project_update.is_internal,
        is_user_visible=project_update.is_user_visible,
        created_at=project_update.created_at,
    )