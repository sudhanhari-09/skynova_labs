"""Analytics: dashboard overview, financial summary and command-center search."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.auth import (Project, Contract, Quotation, Lead, User, Contact,
                             Activity, Task, Milestone)
from app.models.operations import (Invoice, Payment, SupportTicket, Product,
                                   AutomationRun, CalendarEvent)
from app.models.spec import (Client, Service, Technology, Industry, BlogPost,
                             ResearchProject, Experiment, BuildLog,
                             ComponentItem, Supplier, KnowledgeArticle,
                             AutomationEvent, EmailLog, WhatsappLog, AuditLog,
                             TeamMember)


router = APIRouter(prefix="/analytics", tags=["analytics"])
search_router = APIRouter(prefix="/command-center", tags=["command-center"])


def _money(v) -> Optional[float]:
    return float(v) if v is not None else 0.0


@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return {
        "counts": {
            "projects": db.query(Project).count(),
            "active_projects": db.query(Project).filter(Project.status.in_(
                ["RESEARCH", "PLANNING", "PROTOTYPE", "DEVELOPMENT", "TESTING"])).count(),
            "quotations": db.query(Quotation).count(),
            "contracts": db.query(Contract).count(),
            "invoices": db.query(Invoice).count(),
            "pending_invoices": db.query(Invoice).filter(Invoice.status.in_(["SENT", "PARTIALLY_PAID", "OVERDUE"])).count(),
            "leads": db.query(Lead).count(),
            "clients": db.query(Client).count(),
            "products": db.query(Product).count(),
            "support_tickets": db.query(SupportTicket).count(),
            "open_tickets": db.query(SupportTicket).filter(SupportTicket.status.in_(["OPEN", "IN_PROGRESS", "WAITING"])).count(),
            "tasks_todo": db.query(Task).filter(Task.status == "TODO").count(),
            "tasks_in_progress": db.query(Task).filter(Task.status == "IN_PROGRESS").count(),
            "services": db.query(Service).filter(Service.is_active == True).count(),  # noqa: E712
            "technologies": db.query(Technology).filter(Technology.is_active == True).count(),  # noqa: E712
            "knowledge_articles": db.query(KnowledgeArticle).count(),
        },
        "revenue": {
            "total_paid": round(db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
                Payment.status == "SUCCEEDED").scalar(), 2),
            "invoices_outstanding": round(db.query(func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0))
                                          .scalar(), 2),
        },
        "people": {
            "users": db.query(User).count(),
            "contacts": db.query(Contact).count(),
            "team_members": db.query(TeamMember).count(),
        },
    }


@router.get("/financials")
def financial_summary(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    total_invoiced = db.query(func.coalesce(func.sum(Invoice.total), 0)).scalar()
    total_paid = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.status == "SUCCEEDED").scalar()
    amount_due = db.query(func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0)).scalar()

    # Quotation overall positions
    accepted_quotes = db.query(Quotation).filter(Quotation.status == "ACCEPTED").all()
    quote_total = sum(_money(q.total) for q in accepted_quotes)

    projects = db.query(Project).all()
    project_cost = sum(_money(p.actual_cost) for p in projects)
    project_value = sum(_money(p.selling_value) or _money(p.full_budget) or _money(p.customer_budget) for p in projects)

    by_status = dict(
        db.query(Invoice.status, func.count(Invoice.id)).group_by(Invoice.status).all()
    )
    return {
        "summary": {
            "total_invoiced": round(total_invoiced, 2),
            "total_paid": round(total_paid, 2),
            "amount_due": round(amount_due, 2),
            "accepted_quotations_value": round(quote_total, 2),
            "project_actual_cost": round(project_cost, 2),
            "project_selling_value": round(project_value, 2),
            "gross_margin": round(project_value - project_cost, 2),
        },
        "invoices_by_status": by_status,
        "payments_by_method": dict(
            db.query(Payment.method, func.count(Payment.id)).group_by(Payment.method).all()
        ),
    }


@router.get("/projects")
def project_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return {
        "by_status": dict(db.query(Project.status, func.count(Project.id)).group_by(Project.status).all()),
        "tasks_by_status": dict(db.query(Task.status, func.count(Task.id)).group_by(Task.status).all()),
        "milestones": {
            "total": db.query(Milestone).count(),
            "completed": db.query(Milestone).filter(Milestone.status == "COMPLETED").count(),
        },
        "automation_runs": {
            "success": db.query(AutomationRun).filter(AutomationRun.status == "SUCCESS").count(),
            "failed": db.query(AutomationRun).filter(AutomationRun.status == "FAILED").count(),
            "pending": db.query(AutomationRun).filter(AutomationRun.status == "PENDING").count(),
        },
    }


@router.get("/comms")
def comms_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return {
        "emails": {
            "total": db.query(EmailLog).count(),
            "sent": db.query(EmailLog).filter(EmailLog.status == "SENT").count(),
            "simulated": db.query(EmailLog).filter(EmailLog.status == "SIMULATED").count(),
        },
        "whatsapp": {
            "total": db.query(WhatsappLog).count(),
            "sent": db.query(WhatsappLog).filter(WhatsappLog.status == "SENT").count(),
            "simulated": db.query(WhatsappLog).filter(WhatsappLog.status == "SIMULATED").count(),
        },
        "audit_events": db.query(AuditLog).count(),
        "automation_events_pending": db.query(AutomationEvent).filter(AutomationEvent.consumed == False).count(),  # noqa: E712
        "calendar_events": db.query(CalendarEvent).count(),
    }


@search_router.get("/search")
def global_search(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
                  q: str = "", limit: int = 8):
    """Cross-module search for the command-center style admin landing."""
    term = q.strip()
    if not term:
        return {"query": term, "results": []}
    like = f"%{term}%"

    results = []

    def push(kind, label, sub, link, pk):
        results.append({"type": kind, "label": label, "sub": sub, "link": link, "id": pk})

    for p in db.query(Project).filter(Project.title.ilike(like)).limit(limit):
        push("projects", p.title, p.project_number, f"/admin/projects/{p.id}", p.id)
    for c in db.query(Client).filter(Client.name.ilike(like)).limit(limit):
        push("clients", c.name, c.company or c.email, f"/admin/clients/{c.id}", c.id)
    for l in db.query(Lead).filter(Lead.lead_number.ilike(like)).limit(limit):
        push("leads", l.lead_number, l.contact.email if l.contact else "", f"/admin/leads/{l.id}", l.id)
    for qut in db.query(Quotation).filter(Quotation.quotation_number.ilike(like)).limit(limit):
        push("quotations", qut.quotation_number, qut.title, f"/admin/quotations/{qut.id}", qut.id)
    for inv in db.query(Invoice).filter(Invoice.invoice_number.ilike(like)).limit(limit):
        push("invoices", inv.invoice_number, inv.title, f"/admin/invoices/{inv.id}", inv.id)
    for p in db.query(Product).filter(Product.name.ilike(like)).limit(limit):
        push("products", p.name, p.status, f"/admin/products/{p.id}", p.id)
    for t in db.query(SupportTicket).filter(SupportTicket.ticket_number.ilike(like)).limit(limit):
        push("support", t.ticket_number, t.subject, f"/admin/support/{t.id}", t.id)
    for a in db.query(KnowledgeArticle).filter(KnowledgeArticle.title.ilike(like)).limit(limit):
        push("knowledge", a.title, a.visibility, f"/admin/knowledge/{a.id}", a.id)
    for c in db.query(ComponentItem).filter(ComponentItem.sku.ilike(like) | ComponentItem.name.ilike(like)).limit(limit):
        push("components", c.name, c.sku, f"/admin/inventory/components/{c.id}", c.id)
    for u in db.query(User).filter(User.email.ilike(like) | User.first_name.ilike(like)).limit(limit):
        push("users", u.email, (u.first_name or "") + " " + (u.last_name or ""), f"/admin/users/{u.id}?tab=users", u.id)

    return {"query": term, "count": len(results), "results": results}