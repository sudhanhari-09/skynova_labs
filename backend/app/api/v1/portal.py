"""Public client invoice portal (Phase 4).

Unauthenticated, keyed by the invoice's secure_reference. Exposes only the
fields a customer needs and supports online payment records that flow back into
the admin payment ledger.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.operations import Invoice, InvoiceItem, Payment
from app.services.notifications import create_notification, dispatch_event
from app.api.v1.invoices import recompute_totals


router = APIRouter(prefix="/public/invoices", tags=["public-invoices"])


class PortalInvoiceItem(BaseModel):
    item_type: str
    name: str
    description: Optional[str] = None
    quantity: int
    unit: Optional[str] = None
    unit_price: float
    total: float


class PortalInvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    title: str
    status: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    currency: str
    subtotal: float
    discount: float
    tax: float
    total: float
    amount_paid: float
    balance: float
    items: List[PortalInvoiceItem] = []


class PortalPayRequest(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    method: str = "ONLINE"
    metadata: Optional[dict] = None


class PortalPaymentResponse(BaseModel):
    payment_number: str
    amount: float
    currency: str
    status: str
    paid_at: datetime
    invoice_number: str
    invoice_balance: float
    message: str


def build_portal_invoice(db: Session, invoice: Invoice) -> PortalInvoiceResponse:
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

    return PortalInvoiceResponse(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        title=invoice.title,
        status=invoice.status,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        currency=invoice.currency,
        subtotal=float(invoice.subtotal or 0),
        discount=float(invoice.discount or 0),
        tax=float(invoice.tax or 0),
        total=float(invoice.total or 0),
        amount_paid=float(invoice.amount_paid or 0),
        balance=float(balance),
        items=[
            PortalInvoiceItem(
                item_type=i.item_type,
                name=i.name,
                description=i.description,
                quantity=i.quantity,
                unit=i.unit,
                unit_price=float(i.unit_price),
                total=float(i.total),
            )
            for i in items
        ],
    )


@router.get("/{secure_reference}", response_model=PortalInvoiceResponse)
def get_portal_invoice(secure_reference: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.secure_reference == secure_reference).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return build_portal_invoice(db, invoice)


@router.post("/{secure_reference}/pay", response_model=PortalPaymentResponse, status_code=status.HTTP_201_CREATED)
def pay_portal_invoice(secure_reference: str, data: PortalPayRequest, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.secure_reference == secure_reference).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="This invoice has been cancelled")
    if invoice.status == "PAID":
        raise HTTPException(status_code=400, detail="This invoice has already been paid in full")

    payments_total = sum(
        Decimal(str(p.amount)) for p in invoice.payments if p.status == "SUCCEEDED"
    )
    balance = max(Decimal(str(invoice.total)) - payments_total, Decimal("0"))
    if balance <= 0:
        raise HTTPException(status_code=400, detail="This invoice has already been paid in full")

    amount = Decimal(str(data.amount or balance))
    if amount > balance:
        raise HTTPException(status_code=400, detail="Payment amount exceeds the invoice balance")

    payment = Payment(
        payment_number=PaymentNumberGenerator(db).next(),
        invoice_id=invoice.id,
        contract_id=invoice.contract_id,
        project_id=invoice.project_id,
        customer_name=data.customer_name,
        customer_email=data.customer_email or "",
        amount=amount,
        currency=invoice.currency,
        method=data.method if data.method in ("ONLINE", "CARD", "BANK_TRANSFER", "CASH", "CHEQUE", "OTHER") else "ONLINE",
        reference="portal",
        status="SUCCEEDED",
        paid_at=datetime.utcnow(),
        meta=data.metadata,
    )
    db.add(payment)
    db.flush()

    recompute_totals(db, invoice)

    if invoice.created_by:
        create_notification(
            db,
            user_id=invoice.created_by,
            title=f"Online payment received: {payment.payment_number}",
            body=f"Customer paid {invoice.currency} {float(amount):,.2f} via the client portal against {invoice.invoice_number}",
            notification_type="PAYMENT",
            related_entity="invoice",
            related_id=invoice.id,
        )

    dispatch_event(
        db,
        "PAYMENT_RECEIVED",
        "payment",
        payment.id,
        {
            "payment_number": payment.payment_number,
            "amount": float(amount),
            "currency": invoice.currency,
            "invoice_id": invoice.id,
            "email": data.customer_email,
            "to_email": data.customer_email,
        },
    )

    db.commit()
    db.refresh(payment)

    result_balance = max(Decimal(str(invoice.total)) - Decimal(str(invoice.amount_paid or 0)), Decimal("0"))
    return PortalPaymentResponse(
        payment_number=payment.payment_number,
        amount=float(amount),
        currency=payment.currency,
        status=payment.status,
        paid_at=payment.paid_at,
        invoice_number=invoice.invoice_number,
        invoice_balance=float(result_balance),
        message="Payment recorded successfully",
    )


class PaymentNumberGenerator:
    """Inline helper to generate the next payment number."""

    def __init__(self, db: Session):
        self.db = db

    def next(self) -> str:
        count = self.db.query(Payment).count()
        return f"PL-PAY-{count + 1:06d}"