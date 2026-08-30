"""Payment management (Phase 3).

Payments attach to invoices (or record standalone receipts). Successfully
recorded payments update the invoice balance and fire the PAYMENT_RECEIVED
automation event.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import Payment, Invoice
from app.services.notifications import create_notification, dispatch_event
from app.services.audit import log_action
from app.api.v1.invoices import recompute_totals


router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])


class PaymentCreate(BaseModel):
    invoice_id: Optional[int] = None
    contract_id: Optional[int] = None
    project_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    amount: float = Field(..., gt=0)
    currency: str = "USD"
    method: str = Field(..., description="CARD, BANK_TRANSFER, CASH, CHEQUE, ONLINE, OTHER")
    reference: Optional[str] = None
    status: str = "SUCCEEDED"  # PENDING, SUCCEEDED, FAILED, REFUNDED
    paid_at: Optional[datetime] = None
    metadata: Optional[dict] = None


class PaymentUpdate(BaseModel):
    status: Optional[str] = None
    reference: Optional[str] = None
    method: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    payment_number: str
    invoice_id: Optional[int] = None
    contract_id: Optional[int] = None
    project_id: Optional[int] = None
    invoice_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    amount: float
    currency: str
    method: str
    reference: Optional[str] = None
    status: str
    paid_at: Optional[datetime] = None
    received_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    payments: List[PaymentResponse]
    total: int


VALID_PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]


def generate_payment_number(db: Session) -> str:
    count = db.query(Payment).count()
    return f"PL-PAY-{count + 1:06d}"


def build_payment_response(db: Session, payment: Payment) -> PaymentResponse:
    invoice_number = None
    if payment.invoice:
        invoice_number = payment.invoice.invoice_number
    return PaymentResponse(
        id=payment.id,
        payment_number=payment.payment_number,
        invoice_id=payment.invoice_id,
        contract_id=payment.contract_id,
        project_id=payment.project_id,
        invoice_number=invoice_number,
        customer_name=payment.customer_name,
        customer_email=payment.customer_email,
        amount=float(payment.amount),
        currency=payment.currency,
        method=payment.method,
        reference=payment.reference,
        status=payment.status,
        paid_at=payment.paid_at,
        received_by=payment.received_by,
        created_at=payment.created_at,
        updated_at=payment.updated_at,
    )


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("payments")),
):
    if data.status not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    if data.method not in ["CARD", "BANK_TRANSFER", "CASH", "CHEQUE", "ONLINE", "OTHER"]:
        raise HTTPException(status_code=400, detail=f"Invalid method: {data.method}")

    invoice = None
    if data.invoice_id:
        invoice = db.query(Invoice).get(data.invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

    # For card/online payments, attempt real gateway charge
    payment_status = data.status
    gateway_ref = data.reference
    if data.method in ("CARD", "ONLINE"):
        from app.services.payment_gateway import create_payment as gw_charge
        gw_status, gw_provider, gw_id = gw_charge(
            amount=data.amount,
            currency=data.currency,
            customer_name=data.customer_name,
            customer_email=data.customer_email,
            description=f"Payment for {invoice.invoice_number}" if invoice else None,
            metadata={"invoice_id": data.invoice_id} if data.invoice_id else None,
        )
        if gw_status == "FAILED":
            payment_status = "FAILED"
        elif gw_status == "SUCCEEDED":
            payment_status = "SUCCEEDED"
        else:
            payment_status = data.status  # simulated: use requested status
        if gw_id:
            gateway_ref = gw_id

    payment = Payment(
        payment_number=generate_payment_number(db),
        invoice_id=data.invoice_id,
        contract_id=data.contract_id or (invoice.contract_id if invoice and data.invoice_id else None),
        project_id=data.project_id or (invoice.project_id if invoice and data.invoice_id else None),
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        amount=data.amount,
        currency=data.currency,
        method=data.method,
        reference=gateway_ref,
        status=payment_status,
        paid_at=data.paid_at or datetime.utcnow(),
        received_by=current_user.id,
        meta=data.metadata,
    )
    db.add(payment)
    db.flush()

    if invoice and payment_status == "SUCCEEDED":
        recompute_totals(db, invoice)
        if invoice.created_by and invoice.created_by != current_user.id:
            create_notification(
                db,
                user_id=invoice.created_by,
                title=f"Payment received: {payment.payment_number}",
                body=f"Payment of {data.currency} {float(data.amount):,.2f} recorded against {invoice.invoice_number}",
                notification_type="PAYMENT",
                related_entity="invoice",
                related_id=invoice.id,
            )
    elif invoice and payment_status == "REFUNDED":
        recompute_totals(db, invoice)

    db.flush()
    dispatch_event(
        db,
        "PAYMENT_RECEIVED",
        "payment",
        payment.id,
        {
            "payment_number": payment.payment_number,
            "amount": float(data.amount),
            "currency": data.currency,
            "invoice_id": data.invoice_id,
            "email": data.customer_email,
            "to_email": data.customer_email,
        },
    )
    db.commit()
    db.refresh(payment)
    log_action(db, current_user.id, "create", "payments", "payment", payment.id,
               new_value={"payment_number": payment.payment_number, "amount": float(data.amount), "status": payment_status})
    return build_payment_response(db, payment)


@router.get("/", response_model=PaymentListResponse)
def list_payments(
    invoice_id: Optional[int] = None,
    contract_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    method: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("payments")),
):
    query = db.query(Payment)
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    if contract_id:
        query = query.filter(Payment.contract_id == contract_id)
    if status_filter:
        query = query.filter(Payment.status == status_filter)
    if method:
        query = query.filter(Payment.method == method)

    total = query.count()
    payments = query.order_by(Payment.paid_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaymentListResponse(
        payments=[build_payment_response(db, p) for p in payments],
        total=total,
    )


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("payments")),
):
    payment = db.query(Payment).get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return build_payment_response(db, payment)


@router.patch("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("payments")),
):
    payment = db.query(Payment).get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")

    for field, value in update_data.items():
        setattr(payment, field, value)

    if payment.invoice:
        recompute_totals(db, payment.invoice)

    db.commit()
    db.refresh(payment)
    log_action(db, current_user.id, "update", "payments", "payment", payment.id, new_value=update_data)
    return build_payment_response(db, payment)


@router.delete("/{payment_id}", status_code=200)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("payments")),
):
    payment = db.query(Payment).get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    number = payment.payment_number
    invoice = payment.invoice
    db.delete(payment)
    if invoice:
        recompute_totals(db, invoice)
    log_action(db, current_user.id, "delete", "payments", "payment", payment_id, old_value={"payment_number": number})
    db.commit()
    return {"detail": f"Payment {number} deleted"}