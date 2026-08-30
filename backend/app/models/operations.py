"""Phase 3 (business operations) and Phase 4 (product management) models.

Kept separate from `models/auth.py` so earlier migration history stays intact.
Relationships use string references so the SafeKit/declarative registry can
resolve them across modules.
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON,
    Numeric, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from .base import TimeStampedModel, utcnow


# ============================================================
# Phase 3 – Billing & Payments
# ============================================================

class Invoice(TimeStampedModel):
    __tablename__ = "invoices"

    invoice_number = Column(String, unique=True, index=True, nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
    issue_date = Column(DateTime, nullable=False, default=utcnow)
    due_date = Column(DateTime, nullable=True)
    currency = Column(String, default="USD", nullable=False)
    subtotal = Column(Numeric(14, 2), default=0, nullable=False)
    discount = Column(Numeric(14, 2), default=0, nullable=False)
    discount_type = Column(String, default="percentage", nullable=False)  # percentage | amount
    tax = Column(Numeric(14, 2), default=0, nullable=False)
    total = Column(Numeric(14, 2), default=0, nullable=False)
    amount_paid = Column(Numeric(14, 2), default=0, nullable=False)
    secure_reference = Column(String, unique=True, index=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    # Relationships
    contract = relationship("Contract", foreign_keys=[contract_id])
    project = relationship("Project", foreign_keys=[project_id])
    quotation = relationship("Quotation", foreign_keys=[quotation_id])
    lead = relationship("Lead", foreign_keys=[lead_id])
    contact = relationship("Contact", foreign_keys=[contact_id])
    client = relationship("Client", foreign_keys=[client_id])
    creator = relationship("User", foreign_keys=[created_by])
    invoice_items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(TimeStampedModel):
    __tablename__ = "invoice_items"

    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    item_type = Column(String, nullable=False)  # Design, Development, Testing, Deployment, Service, Product, Other
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit = Column(String, nullable=True)  # hour(s), day(s), license, unit
    unit_price = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0, nullable=False)
    tax = Column(Numeric(12, 2), default=0, nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

    invoice = relationship("Invoice", back_populates="invoice_items")


class Payment(TimeStampedModel):
    __tablename__ = "payments"

    payment_number = Column(String, unique=True, index=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    customer_name = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String, default="USD", nullable=False)
    method = Column(String, nullable=False)  # CARD, BANK_TRANSFER, CASH, CHEQUE, ONLINE, OTHER
    reference = Column(String, nullable=True)
    status = Column(String, default="SUCCEEDED", nullable=False)  # PENDING, SUCCEEDED, FAILED, REFUNDED
    paid_at = Column(DateTime, nullable=True)
    received_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    meta = Column("metadata", JSON, nullable=True)  # gateway payload, notes

    invoice = relationship("Invoice", back_populates="payments")
    contract = relationship("Contract", foreign_keys=[contract_id])
    project = relationship("Project", foreign_keys=[project_id])
    receiver = relationship("User", foreign_keys=[received_by])

    def __init__(self, **kwargs):
        if "metadata" in kwargs:
            kwargs["meta"] = kwargs.pop("metadata")
        super().__init__(**kwargs)


# ============================================================
# Phase 3 – Support
# ============================================================

class SupportTicket(TimeStampedModel):
    __tablename__ = "support_tickets"

    ticket_number = Column(String, unique=True, index=True, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="OPEN", nullable=False)  # OPEN, IN_PROGRESS, WAITING, RESOLVED, CLOSED
    priority = Column(String, default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, URGENT
    category = Column(String, nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    contact_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    sla_due_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    contact = relationship("Contact", foreign_keys=[contact_id])
    project = relationship("Project", foreign_keys=[project_id])
    contract = relationship("Contract", foreign_keys=[contract_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    creator = relationship("User", foreign_keys=[created_by])
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan")


class SupportMessage(TimeStampedModel):
    __tablename__ = "support_messages"

    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True, nullable=False)

    ticket = relationship("SupportTicket", back_populates="messages")
    author = relationship("User", foreign_keys=[author_id])


# ============================================================
# Phase 3 – Notifications
# ============================================================

class Notification(TimeStampedModel):
    __tablename__ = "notifications"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    notification_type = Column(String, default="GENERAL", nullable=False)  # GENERAL, INVOICE, PAYMENT, SUPPORT, CONTRACT, PROJECT, AUTOMATION
    related_entity = Column(String, nullable=True)
    related_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime, nullable=True)

    recipient = relationship("User", foreign_keys=[user_id])

    def mark_read(self, ts=None):
        from datetime import datetime
        self.is_read = True
        self.read_at = ts or datetime.utcnow()


# ============================================================
# Phase 3 – Calendar
# ============================================================

class CalendarEvent(TimeStampedModel):
    __tablename__ = "calendar_events"

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String, default="MEETING", nullable=False)  # MEETING, CALL, DEADLINE, MILESTONE, FOLLOW_UP, OTHER
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=True)
    all_day = Column(Boolean, default=False, nullable=False)
    location = Column(String, nullable=True)
    participant_ids = Column(JSON, nullable=True)  # list of user ids
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    related_entity = Column(String, nullable=True)  # project, lead, ticket, invoice
    related_id = Column(Integer, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])


# ============================================================
# Phase 3 – Workflow Automation
# ============================================================

class AutomationRule(TimeStampedModel):
    __tablename__ = "automation_rules"

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    trigger_event = Column(String, nullable=False)
    # NEW_LEAD, QUOTATION_SENT, CONTRACT_SENT, CONTRACT_ACCEPTED,
    # INVOICE_SENT, INVOICE_OVERDUE, PAYMENT_RECEIVED, SUPPORT_TICKET_CREATED
    condition = Column(JSON, nullable=True)
    action = Column(JSON, nullable=True)  # {"channels": ["email", "whatsapp"], "template": "..."}
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    runs = relationship("AutomationRun", back_populates="rule", cascade="all, delete-orphan")


class AutomationRun(TimeStampedModel):
    __tablename__ = "automation_runs"

    rule_id = Column(Integer, ForeignKey("automation_rules.id"), nullable=False)
    trigger_event = Column(String, nullable=False)
    related_entity = Column(String, nullable=True)
    related_id = Column(Integer, nullable=True)
    status = Column(String, default="PENDING", nullable=False)  # PENDING, SUCCESS, FAILED
    channels = Column(JSON, nullable=True)  # ["email", "whatsapp"]
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    rule = relationship("AutomationRule", back_populates="runs")


# ============================================================
# Phase 4 – Product Management
# ============================================================

class Product(TimeStampedModel):
    __tablename__ = "products"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    status = Column(String, default="CONCEPT", nullable=False)  # IDEA, RESEARCH, PROTOTYPE, MVP, BETA, LAUNCHED, GROWING, MAINTENANCE, RETIRED
    current_version = Column(String, nullable=True)
    platform = Column(JSON, nullable=True)  # ["web", "mobile", "api", ...]
    tags = Column(JSON, nullable=True)
    problem_solved = Column(Text, nullable=True)
    industry = Column(String, nullable=True)
    pricing = Column(JSON, nullable=True)  # {model, price, currency, tiers}
    launch_date = Column(DateTime, nullable=True)
    product_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    related_projects = Column(JSON, nullable=True)
    related_research = Column(JSON, nullable=True)
    related_experiments = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    product_owner = relationship("User", foreign_keys=[product_owner_id])
    versions = relationship("ProductVersion", back_populates="product", cascade="all, delete-orphan")
    releases = relationship("ProductRelease", back_populates="product", cascade="all, delete-orphan")
    roadmap_items = relationship("RoadmapItem", back_populates="product", cascade="all, delete-orphan")
    features = relationship("ProductFeature", back_populates="product", cascade="all, delete-orphan")


class ProductVersion(TimeStampedModel):
    __tablename__ = "product_versions"

    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    version = Column(String, nullable=False)  # semver: 1.0.0
    name = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    changelog = Column(Text, nullable=True)
    status = Column(String, default="PLANNED", nullable=False)  # PLANNED, IN_PROGRESS, BETA, RELEASED, ARCHIVED
    release_date = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    product = relationship("Product", back_populates="versions")
    creator = relationship("User", foreign_keys=[created_by])


class ProductRelease(TimeStampedModel):
    __tablename__ = "product_releases"

    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("product_versions.id"), nullable=True)
    name = Column(String, nullable=False)
    release_notes = Column(Text, nullable=True)
    status = Column(String, default="SCHEDULED", nullable=False)  # SCHEDULED, IN_PROGRESS, RELEASED, ROLLED_BACK
    environment = Column(String, default="PRODUCTION", nullable=False)  # PRODUCTION, STAGING
    scheduled_for = Column(DateTime, nullable=True)
    released_at = Column(DateTime, nullable=True)
    rolled_back_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    product = relationship("Product", back_populates="releases")
    version = relationship("ProductVersion", foreign_keys=[version_id])
    creator = relationship("User", foreign_keys=[created_by])


class RoadmapItem(TimeStampedModel):
    __tablename__ = "roadmap_items"

    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="BACKLOG", nullable=False)  # BACKLOG, PLANNED, IN_PROGRESS, COMPLETED
    priority = Column(String, default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    category = Column(String, default="FEATURE", nullable=False)  # FEATURE, IMPROVEMENT, RESEARCH, INFRASTRUCTURE
    target_quarter = Column(String, nullable=True)  # "2026-Q1"
    due_date = Column(DateTime, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    product = relationship("Product", back_populates="roadmap_items")
    creator = relationship("User", foreign_keys=[created_by])


class Prototype(TimeStampedModel):
    __tablename__ = "prototypes"

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    prototype_type = Column(String, default="SOFTWARE", nullable=False)  # UI, PHYSICAL, SOFTWARE, CONCEPT, OTHER
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, IN_PROGRESS, ITERATING, APPROVED, ARCHIVED
    storage_key = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    project = relationship("Project", foreign_keys=[project_id])
    product = relationship("Product", foreign_keys=[product_id])
    creator = relationship("User", foreign_keys=[created_by])


# ============================================================
# Feature Flags
# ============================================================

class FeatureFlag(TimeStampedModel):
    __tablename__ = "feature_flags"

    key = Column(String, unique=True, index=True, nullable=False)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    scope = Column(String, default="ADMIN", nullable=False)  # GLOBAL, ADMIN, PUBLIC
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class FeatureFlagAuditLog(TimeStampedModel):
    """Audit trail for feature flag changes (who toggled what and when)."""
    __tablename__ = "feature_flag_audit_logs"

    flag_id = Column(Integer, ForeignKey("feature_flags.id"), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    field = Column(String, nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)

    flag = relationship("FeatureFlag")
    actor = relationship("User", foreign_keys=[changed_by])