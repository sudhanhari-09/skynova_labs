"""Invoice management (Phase 3).

CRUD + line items + financial aggregation + status workflow.
All admin operations require authentication and the `invoices` feature flag.
"""
import secrets
from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import Invoice, InvoiceItem
from app.services.notifications import create_notification


router = APIRouter(prefix="/admin/invoices", tags=["admin-invoices"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InvoiceItemCreate(BaseModel):
    item_type: str = "Service"
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    quantity: int = 1
    unit: Optional[str] = None
    unit_price: float = Field(..., ge=0)
    discount: float = 0
    tax: float = 0
    display_order: int = 0
    notes: Optional[str] = None


class InvoiceItemUpdate(BaseModel):
    item_type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    display_order: Optional[int] = None
    notes: Optional[str] = None


class InvoiceCreate(BaseModel):
    title: str = Field(..., min_length=1)
    contract_id: Optional[int] = None
    project_id: Optional[int] = None
    quotation_id: Optional[int] = None
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    description: Optional[str] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    currency: str = "USD"
    discount: float = 0
    discount_type: str = "percentage"  # percentage | amount
    tax: float = 0
    notes: Optional[str] = None
    items: List[InvoiceItemCreate] = []


class InvoiceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    currency: Optional[str] = None
    discount: Optional[float] = None
    discount_type: Optional[str] = None
    tax: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class InvoiceItemResponse(BaseModel):
    id: int
    invoice_id: int
    item_type: str
    name: str
    description: Optional[str] = None
    quantity: int
    unit: Optional[str] = None
    unit_price: float
    discount: float
    tax: float
    total: float
    display_order: int
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    contract_id: Optional[int] = None
    project_id: Optional[int] = None
    quotation_id: Optional[int] = None
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    currency: str
    subtotal: float
    discount: float
    discount_type: str
    tax: float
    total: float
    amount_paid: float
    balance: float
    secure_reference: str
    notes: Optional[str] = None
    sent_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items_count: int = 0
    payments_total: float = 0
    items: List[InvoiceItemResponse] = []

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    invoices: List[InvoiceResponse]
    total: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_STATUSES = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]
VALID_DISCOUNT_TYPES = ["percentage", "amount"]


def generate_invoice_number(db: Session) -> str:
    count = db.query(Invoice).count()
    return f"PL-INV-{count + 1:06d}"


def _item_total(unit_price: float, quantity: int, discount: float, tax: float) -> Decimal:
    subtotal = Decimal(str(unit_price)) * Decimal(str(quantity))
    return (subtotal - Decimal(str(discount)) + Decimal(str(tax))).quantize(Decimal("0.01"))


def recompute_totals(db: Session, invoice: Invoice) -> Invoice:
    """Recompute subtotal/discount/tax/total/balance and auto-advance status."""
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
    subtotal = sum((Decimal(str(i.unit_price)) * Decimal(str(i.quantity))) for i in items)
    discount_raw = Decimal(str(invoice.discount))
    if invoice.discount_type == "percentage":
        discount = (subtotal * discount_raw / Decimal(100)).quantize(Decimal("0.01"))
    else:
        discount = discount_raw.quantize(Decimal("0.01"))
    tax = Decimal(str(invoice.tax)).quantize(Decimal("0.01"))
    total = (subtotal - discount + tax).quantize(Decimal("0.01"))

    payments_total = sum(
        Decimal(str(p.amount))
        for p in invoice.payments
        if p.status == "SUCCEEDED"
    )

    invoice.subtotal = subtotal
    invoice.discount = discount
    invoice.tax = tax
    invoice.total = total
    invoice.amount_paid = payments_total

    # Status auto-advance (manual OVERDUE / DRAFT / SENT are preserved).
    if invoice.status == "CANCELLED":
        pass
    elif total > 0 and payments_total >= total:
        invoice.status = "PAID"
        invoice.paid_at = invoice.paid_at or datetime.utcnow()
    elif payments_total > 0:
        invoice.status = "PARTIALLY_PAID"
        invoice.paid_at = None
    elif invoice.status == "PAID":
        invoice.status = "DRAFT"
        invoice.paid_at = None

    return invoice


def build_invoice_response(db: Session, invoice: Invoice, include_items: bool = True) -> InvoiceResponse:
    items = (
        db.query(InvoiceItem)
        .filter(InvoiceItem.invoice_id == invoice.id)
        .order_by(InvoiceItem.display_order.asc(), InvoiceItem.id.asc())
        .all()
    )
    payments_total = sum(
        Decimal(str(p.amount)) for p in invoice.payments if p.status == "SUCCEEDED"
    )
    balance = max(Decimal(str(invoice.total)) - payments_total, Decimal("0"))

    item_responses = [
        InvoiceItemResponse(
            id=i.id,
            invoice_id=i.invoice_id,
            item_type=i.item_type,
            name=i.name,
            description=i.description,
            quantity=i.quantity,
            unit=i.unit,
            unit_price=float(i.unit_price),
            discount=float(i.discount),
            tax=float(i.tax),
            total=float(i.total),
            display_order=i.display_order,
            notes=i.notes,
        )
        for i in items
    ]

    return InvoiceResponse(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        contract_id=invoice.contract_id,
        project_id=invoice.project_id,
        quotation_id=invoice.quotation_id,
        lead_id=invoice.lead_id,
        contact_id=invoice.contact_id,
        title=invoice.title,
        description=invoice.description,
        status=invoice.status,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        currency=invoice.currency,
        subtotal=float(invoice.subtotal or 0),
        discount=float(invoice.discount or 0),
        discount_type=invoice.discount_type,
        tax=float(invoice.tax or 0),
        total=float(invoice.total or 0),
        amount_paid=float(invoice.amount_paid or 0),
        balance=float(balance),
        secure_reference=invoice.secure_reference,
        notes=invoice.notes,
        sent_at=invoice.sent_at,
        paid_at=invoice.paid_at,
        cancelled_at=invoice.cancelled_at,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        items_count=len(item_responses),
        payments_total=float(payments_total),
        items=item_responses if include_items else [],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    if data.discount_type not in VALID_DISCOUNT_TYPES:
        raise HTTPException(status_code=400, detail="discount_type must be 'percentage' or 'amount'")

    invoice = Invoice(
        invoice_number=generate_invoice_number(db),
        title=data.title,
        description=data.description,
        contract_id=data.contract_id,
        project_id=data.project_id,
        quotation_id=data.quotation_id,
        lead_id=data.lead_id,
        contact_id=data.contact_id,
        status="DRAFT",
        issue_date=data.issue_date or datetime.utcnow(),
        due_date=data.due_date,
        currency=data.currency,
        discount=data.discount,
        discount_type=data.discount_type,
        tax=data.tax,
        total=0,
        secure_reference=secrets.token_urlsafe(16),
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(invoice)
    db.flush()

    for i in data.items:
        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            item_type=i.item_type,
            name=i.name,
            description=i.description,
            quantity=i.quantity,
            unit=i.unit,
            unit_price=i.unit_price,
            discount=i.discount,
            tax=i.tax,
            total=_item_total(i.unit_price, i.quantity, i.discount, i.tax),
            display_order=i.display_order,
            notes=i.notes,
        )
        db.add(invoice_item)

    recompute_totals(db, invoice)
    db.commit()
    db.refresh(invoice)
    return build_invoice_response(db, invoice)


@router.get("/", response_model=InvoiceListResponse)
def list_invoices(
    status_filter: Optional[str] = None,
    project_id: Optional[int] = None,
    contract_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    query = db.query(Invoice)
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    if project_id:
        query = query.filter(Invoice.project_id == project_id)
    if contract_id:
        query = query.filter(Invoice.contract_id == contract_id)
    if lead_id:
        query = query.filter(Invoice.lead_id == lead_id)
    if contact_id:
        query = query.filter(Invoice.contact_id == contact_id)
    if search:
        query = query.filter(
            (Invoice.invoice_number.ilike(f"%{search}%")) | (Invoice.title.ilike(f"%{search}%"))
        )

    total = query.count()
    invoices = query.order_by(Invoice.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return InvoiceListResponse(
        invoices=[build_invoice_response(db, inv) for inv in invoices],
        total=total,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return build_invoice_response(db, invoice)


@router.get("/{invoice_id}/pdf")
def invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    """Return a branded PDF download of the invoice."""
    from fastapi.responses import Response
    from app.services.pdf import invoice_pdf_bytes
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id)\
        .order_by(InvoiceItem.display_order.asc()).all()
    pdf = invoice_pdf_bytes(
        invoice_number=invoice.invoice_number,
        title=invoice.title,
        status=invoice.status,
        issued_date=str(invoice.issue_date.date()) if invoice.issue_date else "",
        due_date=str(invoice.due_date.date()) if invoice.due_date else "",
        customer_lines=[],
        items=[{
            "description": i.name or i.description or "",
            "quantity": i.quantity,
            "unit_price": i.unit_price,
            "discount": i.discount,
            "tax": i.tax,
            "total": i.total,
        } for i in items],
        subtotal=float(invoice.subtotal or 0),
        discount=float(invoice.discount or 0),
        tax=float(invoice.tax or 0),
        total=float(invoice.total or 0),
        currency=invoice.currency or "USD",
        notes=invoice.notes,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-{invoice.invoice_number}.pdf"'},
    )


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")
    if "discount_type" in update_data and update_data["discount_type"] not in VALID_DISCOUNT_TYPES:
        raise HTTPException(status_code=400, detail="discount_type must be 'percentage' or 'amount'")

    for field, value in update_data.items():
        setattr(invoice, field, value)

    recompute_totals(db, invoice)
    db.commit()
    db.refresh(invoice)
    return build_invoice_response(db, invoice)


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
def send_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Invoice must be DRAFT to send. Current: {invoice.status}")

    invoice.status = "SENT"
    invoice.sent_at = invoice.sent_at or datetime.utcnow()
    recompute_totals(db, invoice)
    db.commit()
    db.refresh(invoice)
    return build_invoice_response(db, invoice)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status in ("PAID", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel an invoice with status {invoice.status}")

    invoice.status = "CANCELLED"
    invoice.cancelled_at = invoice.cancelled_at or datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return build_invoice_response(db, invoice)


@router.post("/{invoice_id}/recompute", response_model=InvoiceResponse)
def recompute_invoice_totals(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    recompute_totals(db, invoice)
    db.commit()
    db.refresh(invoice)
    return build_invoice_response(db, invoice)


# ---------------------------------------------------------------------------
# Invoice line items
# ---------------------------------------------------------------------------

@router.post("/{invoice_id}/items", response_model=InvoiceItemResponse, status_code=status.HTTP_201_CREATED)
def add_invoice_item(
    invoice_id: int,
    data: InvoiceItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status in ("PAID", "CANCELLED"):
        raise HTTPException(status_code=400, detail="Cannot modify items on a paid/cancelled invoice")

    item = InvoiceItem(
        invoice_id=invoice.id,
        item_type=data.item_type,
        name=data.name,
        description=data.description,
        quantity=data.quantity,
        unit=data.unit,
        unit_price=data.unit_price,
        discount=data.discount,
        tax=data.tax,
        total=_item_total(data.unit_price, data.quantity, data.discount, data.tax),
        display_order=data.display_order,
        notes=data.notes,
    )
    db.add(item)
    db.flush()
    recompute_totals(db, invoice)
    db.commit()
    db.refresh(item)
    return InvoiceItemResponse(
        id=item.id, invoice_id=item.invoice_id, item_type=item.item_type,
        name=item.name, description=item.description, quantity=item.quantity,
        unit=item.unit, unit_price=float(item.unit_price), discount=float(item.discount),
        tax=float(item.tax), total=float(item.total), display_order=item.display_order,
        notes=item.notes,
    )


@router.patch("/{invoice_id}/items/{item_id}", response_model=InvoiceItemResponse)
def update_invoice_item(
    invoice_id: int,
    item_id: int,
    data: InvoiceItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    item = db.query(InvoiceItem).filter(InvoiceItem.id == item_id, InvoiceItem.invoice_id == invoice_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Invoice item not found")
    if invoice.status in ("PAID", "CANCELLED"):
        raise HTTPException(status_code=400, detail="Cannot modify items on a paid/cancelled invoice")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.total = _item_total(item.unit_price, item.quantity, item.discount, item.tax)
    db.flush()
    recompute_totals(db, invoice)
    db.commit()
    db.refresh(item)
    return InvoiceItemResponse(
        id=item.id, invoice_id=item.invoice_id, item_type=item.item_type,
        name=item.name, description=item.description, quantity=item.quantity,
        unit=item.unit, unit_price=float(item.unit_price), discount=float(item.discount),
        tax=float(item.tax), total=float(item.total), display_order=item.display_order,
        notes=item.notes,
    )


@router.delete("/{invoice_id}/items/{item_id}", status_code=200)
def delete_invoice_item(
    invoice_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    item = db.query(InvoiceItem).filter(InvoiceItem.id == item_id, InvoiceItem.invoice_id == invoice_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Invoice item not found")
    if invoice.status in ("PAID", "CANCELLED"):
        raise HTTPException(status_code=400, detail="Cannot modify items on a paid/cancelled invoice")

    db.delete(item)
    recompute_totals(db, invoice)
    db.commit()
    return {"detail": "Invoice item deleted"}


@router.delete("/{invoice_id}", status_code=200)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("invoices")),
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status in ("SENT", "PAID", "PARTIALLY_PAID"):
        raise HTTPException(status_code=400, detail="Cannot delete a sent or paid invoice")

    number = invoice.invoice_number
    db.delete(invoice)
    db.commit()
    return {"detail": f"Invoice {number} deleted"}