"""Project components (spec §53 cost tracking) + project documents.

Components track the parts used by a project with cost/selling per line; documents
store internal/public files attached to a project.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import ProjectComponent, ProjectDocument, ComponentItem
from app.models.auth import Project
from app.services.audit import log_action


router = APIRouter(prefix="/projects/{project_id}", tags=["project-resources"])


class ProjectComponentPayload(BaseModel):
    component_id: int
    quantity: int = 1
    unit_cost: Optional[float] = None
    unit_selling: Optional[float] = None
    discount: float = 0
    tax: float = 0
    notes: Optional[str] = None


class DocumentPayload(BaseModel):
    title: str
    file_name: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    storage_key: Optional[str] = None
    category: str = "DOCUMENT"
    is_internal: bool = True
    version: str = "1"


def _get_project(db: Session, pid: int) -> Project:
    p = db.query(Project).get(pid)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return p


def _component_line_dict(pc: ProjectComponent) -> dict:
    return {
        "id": pc.id,
        "project_id": pc.project_id,
        "component_id": pc.component_id,
        "sku": pc.component.sku if pc.component else None,
        "component_name": pc.component.name if pc.component else None,
        "quantity": pc.quantity,
        "unit_cost": float(pc.unit_cost or 0),
        "unit_selling": float(pc.unit_selling or 0),
        "discount": float(pc.discount or 0),
        "tax": float(pc.tax or 0),
        "total": float(pc.total or 0),
        "notes": pc.notes,
    }


@router.get("/components")
def list_project_components(project_id: int, db: Session = Depends(get_db),
                            current_user: dict = Depends(get_current_user_dict)):
    _get_project(db, project_id)
    rows = db.query(ProjectComponent).filter(ProjectComponent.project_id == project_id).all()
    return [_component_line_dict(r) for r in rows]


@router.post("/components", status_code=status.HTTP_201_CREATED)
def add_project_component(project_id: int, data: ProjectComponentPayload,
                          db: Session = Depends(get_db),
                          current_user: dict = Depends(get_current_user_dict)):
    project = _get_project(db, project_id)
    component = db.query(ComponentItem).get(data.component_id)
    if not component:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component not found")

    unit_cost = Decimal(str(data.unit_cost)) if data.unit_cost is not None else (component.purchase_price or 0)
    unit_selling = Decimal(str(data.unit_selling)) if data.unit_selling is not None else (component.selling_price or 0)
    discount = Decimal(str(data.discount or 0))
    tax = Decimal(str(data.tax or 0))
    quantity = Decimal(int(data.quantity or 1))
    total = (quantity * unit_selling) - discount + tax

    line = ProjectComponent(
        project_id=project.id,
        component_id=component.id,
        quantity=int(data.quantity or 1),
        unit_cost=unit_cost,
        unit_selling=unit_selling,
        discount=discount,
        tax=tax,
        total=total,
        notes=data.notes,
    )
    db.add(line)
    db.flush()
    log_action(db, current_user["id"], "create", "projects", "project_component", line.id,
               new_value={"project": project.project_number, "sku": component.sku})
    db.commit()
    db.refresh(line)
    return _component_line_dict(line)


@router.patch("/components/{component_line_id}")
def update_project_component(project_id: int, component_line_id: int, data: ProjectComponentPayload,
                             db: Session = Depends(get_db),
                             current_user: dict = Depends(get_current_user_dict)):
    line = db.query(ProjectComponent).get(component_line_id)
    if not line or line.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component line not found")

    if data.quantity is not None:
        line.quantity = data.quantity
    if data.unit_cost is not None:
        line.unit_cost = Decimal(str(data.unit_cost))
    if data.unit_selling is not None:
        line.unit_selling = Decimal(str(data.unit_selling))
    if data.discount is not None:
        line.discount = Decimal(str(data.discount))
    if data.tax is not None:
        line.tax = Decimal(str(data.tax))
    if data.notes is not None:
        line.notes = data.notes
    line.total = (line.quantity * line.unit_selling) - line.discount + line.tax

    # Recompute project actual cost from components + recursion-safe totals.
    project = _get_project(db, project_id)
    total_cost = sum(
        (r.quantity * r.unit_cost) for r in db.query(ProjectComponent).filter(ProjectComponent.project_id == project_id)
    )
    project.actual_cost = total_cost

    db.commit()
    db.refresh(line)
    return _component_line_dict(line)


@router.delete("/components/{component_line_id}")
def remove_project_component(project_id: int, component_line_id: int,
                             db: Session = Depends(get_db),
                             current_user: dict = Depends(get_current_user_dict)):
    line = db.query(ProjectComponent).get(component_line_id)
    if not line or line.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component line not found")
    db.delete(line)
    db.commit()
    return {"detail": "Component removed from project"}


# ---------------- Documents ----------------

@router.get("/documents")
def list_project_documents(project_id: int, db: Session = Depends(get_db),
                           current_user: dict = Depends(get_current_user_dict)):
    _get_project(db, project_id)
    docs = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "file_name": d.file_name,
            "mime_type": d.mime_type,
            "size": d.size,
            "storage_key": d.storage_key,
            "category": d.category,
            "is_internal": d.is_internal,
            "version": d.version,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at,
        }
        for d in docs
    ]


@router.post("/documents", status_code=status.HTTP_201_CREATED)
def add_project_document(project_id: int, data: DocumentPayload,
                         db: Session = Depends(get_db),
                         current_user: dict = Depends(get_current_user_dict)):
    _get_project(db, project_id)
    doc = ProjectDocument(project_id=project_id, uploaded_by=current_user["id"],
                          **data.model_dump(exclude_unset=True))
    db.add(doc)
    db.flush()
    log_action(db, current_user["id"], "create", "projects", "project_document", doc.id,
               new_value={"title": doc.title})
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "title": doc.title, "file_name": doc.file_name}


@router.delete("/documents/{document_id}")
def remove_project_document(project_id: int, document_id: int,
                            db: Session = Depends(get_db),
                            current_user: dict = Depends(get_current_user_dict)):
    doc = db.query(ProjectDocument).get(document_id)
    if not doc or doc.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"detail": "Document removed"}