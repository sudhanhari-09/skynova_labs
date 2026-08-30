"""Support tickets & messages (Phase 3).

Internal staff manage tickets created by the platform (or seeded from leads).
Writes fire the SUPPORT_TICKET_CREATED automation event.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import SupportTicket, SupportMessage
from app.services.notifications import create_notification, dispatch_event
from app.services.audit import log_action


router = APIRouter(prefix="/admin/support", tags=["admin-support"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=1)
    description: Optional[str] = None
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT
    category: Optional[str] = None
    contact_id: Optional[int] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    project_id: Optional[int] = None
    contract_id: Optional[int] = None
    assignee_id: Optional[int] = None
    status: str = "OPEN"


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    assignee_id: Optional[int] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


class TicketMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    is_internal: bool = True
    author_name: Optional[str] = None


class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    content: str
    is_internal: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    id: int
    ticket_number: str
    subject: str
    description: Optional[str] = None
    status: str
    priority: str
    category: Optional[str] = None
    contact_id: Optional[int] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    project_id: Optional[int] = None
    contract_id: Optional[int] = None
    assignee_id: Optional[int] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    message_count: int = 0
    messages: List[TicketMessageResponse] = []

    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    tickets: List[TicketResponse]
    total: int


VALID_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]
VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]


def generate_ticket_number(db: Session) -> str:
    count = db.query(SupportTicket).count()
    return f"PL-TKT-{count + 1:06d}"


def build_ticket_response(db: Session, ticket: SupportTicket, include_messages: bool = True) -> TicketResponse:
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.ticket_id == ticket.id)
        .order_by(SupportMessage.created_at.asc())
        .all()
    )
    msgs = [
        TicketMessageResponse(
            id=m.id, ticket_id=m.ticket_id, author_id=m.author_id,
            author_name=m.author_name, content=m.content, is_internal=m.is_internal,
            created_at=m.created_at,
        )
        for m in messages
    ]
    return TicketResponse(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        subject=ticket.subject,
        description=ticket.description,
        status=ticket.status,
        priority=ticket.priority,
        category=ticket.category,
        contact_id=ticket.contact_id,
        contact_name=ticket.contact_name,
        contact_email=ticket.contact_email,
        project_id=ticket.project_id,
        contract_id=ticket.contract_id,
        assignee_id=ticket.assignee_id,
        created_by=ticket.created_by,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        resolved_at=ticket.resolved_at,
        closed_at=ticket.closed_at,
        message_count=len(msgs),
        messages=msgs if include_messages else [],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("support")),
):
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    if data.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {data.priority}")

    ticket = SupportTicket(
        ticket_number=generate_ticket_number(db),
        subject=data.subject,
        description=data.description,
        status=data.status,
        priority=data.priority,
        category=data.category,
        contact_id=data.contact_id,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        project_id=data.project_id,
        contract_id=data.contract_id,
        assignee_id=data.assignee_id,
        created_by=current_user.id,
    )
    db.add(ticket)
    db.flush()
    log_action(db, current_user.id, "create", "support", "ticket", ticket.id,
               new_value={"ticket_number": ticket.ticket_number, "subject": ticket.subject})
    db.commit()
    db.refresh(ticket)

    dispatch_event(
        db,
        "SUPPORT_TICKET_CREATED",
        "support_ticket",
        ticket.id,
        {
            "ticket_number": ticket.ticket_number,
            "subject": ticket.subject,
            "email": ticket.contact_email,
            "to_email": ticket.contact_email,
        },
    )
    db.commit()
    db.refresh(ticket)
    return build_ticket_response(db, ticket)


@router.get("/tickets", response_model=TicketListResponse)
def list_tickets(
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[int] = None,
    project_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("support")),
):
    query = db.query(SupportTicket)
    if status_filter:
        query = query.filter(SupportTicket.status == status_filter)
    if priority:
        query = query.filter(SupportTicket.priority == priority)
    if assignee_id:
        query = query.filter(SupportTicket.assignee_id == assignee_id)
    if project_id:
        query = query.filter(SupportTicket.project_id == project_id)
    if search:
        query = query.filter(
            (SupportTicket.subject.ilike(f"%{search}%"))
            | (SupportTicket.ticket_number.ilike(f"%{search}%"))
            | (SupportTicket.contact_email.ilike(f"%{search}%"))
        )

    total = query.count()
    tickets = query.order_by(SupportTicket.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return TicketListResponse(
        tickets=[build_ticket_response(db, t) for t in tickets],
        total=total,
    )


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("support")),
):
    ticket = db.query(SupportTicket).get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return build_ticket_response(db, ticket)


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("support")),
):
    ticket = db.query(SupportTicket).get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")
    if "priority" in update_data and update_data["priority"] not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {update_data['priority']}")

    for field, value in update_data.items():
        setattr(ticket, field, value)

    if ticket.status == "RESOLVED" and not ticket.resolved_at:
        ticket.resolved_at = datetime.utcnow()
    if ticket.status == "CLOSED" and not ticket.closed_at:
        ticket.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(ticket)
    log_action(db, current_user.id, "update", "support", "ticket", ticket.id, new_value=update_data)
    return build_ticket_response(db, ticket)


@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=status.HTTP_201_CREATED)
def add_ticket_message(
    ticket_id: int,
    data: TicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("support")),
):
    ticket = db.query(SupportTicket).get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    message = SupportMessage(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_name=data.author_name or f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        content=data.content,
        is_internal=data.is_internal,
    )
    db.add(message)

    if ticket.status == "OPEN":
        ticket.status = "IN_PROGRESS"

    db.commit()
    db.refresh(message)
    return TicketMessageResponse(
        id=message.id, ticket_id=message.ticket_id, author_id=message.author_id,
        author_name=message.author_name, content=message.content, is_internal=message.is_internal,
        created_at=message.created_at,
    )


@router.delete("/tickets/{ticket_id}", status_code=200)
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("support")),
):
    ticket = db.query(SupportTicket).get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    number = ticket.ticket_number
    db.delete(ticket)
    db.commit()
    return {"detail": f"Ticket {number} deleted"}