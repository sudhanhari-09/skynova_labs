"""Clients module (spec §24/advisory + §66 clients table).

Central CRM entity that links to contacts, quotations, contracts, projects and
invoices via the new client_id columns.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import Client
from app.models.auth import Contact, Quotation, Contract, Project
from app.models.operations import Invoice
from app.services.audit import log_action


router = APIRouter(prefix="/clients", tags=["clients"])


class ClientPayload(BaseModel):
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: str
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: str = "ACTIVE"
    communication_history: Optional[List[dict]] = None


class ClientUpdatePayload(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    communication_history: Optional[List[dict]] = None


def _serialize(db: Session, c: Client) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "company": c.company,
        "email": c.email,
        "phone": c.phone,
        "whatsapp": c.whatsapp,
        "address": c.address,
        "website": c.website,
        "notes": c.notes,
        "status": c.status,
        "communication_history": c.communication_history or [],
        "contacts_count": db.query(Contact).filter(Contact.client_id == c.id).count(),
        "projects_count": db.query(Project).filter(Project.client_id == c.id).count(),
        "quotations_count": db.query(Quotation).filter(Quotation.client_id == c.id).count(),
        "contracts_count": db.query(Contract).filter(Contract.client_id == c.id).count(),
        "invoices_count": db.query(Invoice).filter(Invoice.client_id == c.id).count(),
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def _get_client(db: Session, client_id: int) -> Client:
    c = db.query(Client).get(client_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return c


@router.get("/")
def list_clients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
):
    query = db.query(Client)
    if search:
        like = f"%{search}%"
        query = query.filter(
            Client.name.ilike(like) | (Client.company != None) & Client.company.ilike(like) |
            (Client.email != None) & Client.email.ilike(like)
        )
    if status_filter:
        query = query.filter(Client.status == status_filter)
    clients = query.order_by(Client.created_at.desc()).offset(skip).limit(limit).all()
    return [_serialize(db, c) for c in clients]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_client(
    data: ClientPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    client = Client(
        name=data.name,
        company=data.company,
        email=data.email,
        phone=data.phone,
        whatsapp=data.whatsapp,
        address=data.address,
        website=data.website,
        notes=data.notes,
        status=data.status,
        communication_history=data.communication_history or [],
    )
    db.add(client)
    db.flush()
    log_action(db, current_user["id"], "create", "clients", "client", client.id,
               new_value={"name": client.name})
    db.commit()
    db.refresh(client)
    return _serialize(db, client)


@router.get("/{client_id}")
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    c = _get_client(db, client_id)
    result = _serialize(db, c)
    result["contacts"] = [
        {"id": x.id, "first_name": x.first_name, "last_name": x.last_name, "email": x.email, "phone": x.phone}
        for x in db.query(Contact).filter(Contact.client_id == c.id).all()
    ]
    result["projects"] = [
        {"id": x.id, "project_number": x.project_number, "title": x.title, "status": x.status}
        for x in db.query(Project).filter(Project.client_id == c.id).all()
    ]
    return result


@router.patch("/{client_id}")
def update_client(
    client_id: int,
    data: ClientUpdatePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    c = _get_client(db, client_id)
    old = {"name": c.name, "status": c.status}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    log_action(db, current_user["id"], "update", "clients", "client", c.id,
               old_value=old, new_value={"name": c.name, "status": c.status})
    db.commit()
    db.refresh(c)
    return _serialize(db, c)


@router.get("/{client_id}/communications")
def list_communications(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    c = _get_client(db, client_id)
    return c.communication_history or []


@router.post("/{client_id}/communications")
def add_communication(
    client_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    c = _get_client(db, client_id)
    history = c.communication_history or []
    entry = {
        "type": payload.get("type", "note"),
        "content": payload.get("content", ""),
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": current_user["id"],
    }
    history.append(entry)
    c.communication_history = history
    db.commit()
    return c.communication_history


@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    c = _get_client(db, client_id)
    log_action(db, current_user["id"], "delete", "clients", "client", c.id,
               new_value={"name": c.name})
    db.delete(c)
    db.commit()
    return {"detail": "Client deleted"}