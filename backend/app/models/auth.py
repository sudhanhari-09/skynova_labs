from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Index, UniqueConstraint, Numeric
)
from sqlalchemy.orm import relationship
from .base import TimeStampedModel, utcnow


class User(TimeStampedModel):
    __tablename__ = "users"

    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # Security (spec §57): password reset + login-attempt lockout
    password_reset_token_hash = Column(String, nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    login_attempt_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)

    # Relationships
    roles = relationship("Role", secondary="user_roles", back_populates="users")

    @property
    def permissions(self):
        """Flattened list of Permission objects from all assigned roles."""
        collected = []
        seen = set()
        for role in self.roles:
            for perm in role.permissions:
                if perm.id not in seen:
                    seen.add(perm.id)
                    collected.append(perm)
        return collected


class Role(TimeStampedModel):
    __tablename__ = "roles"

    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    permissions = relationship("Permission", secondary="role_permissions", back_populates="roles")
    users = relationship("User", secondary="user_roles", back_populates="roles")


class Permission(TimeStampedModel):
    __tablename__ = "permissions"

    name = Column(String, unique=True, index=True, nullable=False)
    resource = Column(String, nullable=False)
    action = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")


class UserRole(TimeStampedModel):
    __tablename__ = "user_roles"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )


class RolePermission(TimeStampedModel):
    __tablename__ = "role_permissions"

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


# Phase 2 Models

class QuoteRequest(TimeStampedModel):
    __tablename__ = "quote_requests"

    request_number = Column(String, unique=True, index=True, nullable=False)
    project_type_id = Column(Integer, ForeignKey("project_types.id"), nullable=True)
    subcategory_id = Column(Integer, ForeignKey("project_subcategories.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    budget = Column(String, nullable=True)
    timeline = Column(String, nullable=True)
    target_audience = Column(Text, nullable=True)
    existing_system = Column(Text, nullable=True)
    expected_launch = Column(DateTime, nullable=True)
    detailed_requirements = Column(Text, nullable=True)
    status = Column(String, default="NEW", nullable=False)
    source = Column(String, nullable=True)  # "website", "email", "phone", etc.
    submitted_at = Column(DateTime, nullable=True)

    # Relationships
    project_type = relationship("ProjectType", foreign_keys=[project_type_id])
    subcategory = relationship("ProjectSubcategory", foreign_keys=[subcategory_id])
    contact = relationship("Contact", foreign_keys=[contact_id], uselist=False, back_populates="quote_request")
    lead = relationship("Lead", foreign_keys="Lead.quote_request_id", uselist=False, back_populates="quote_request")
    activities = relationship("Activity", back_populates="quote_request")
    follow_ups = relationship("FollowUp", back_populates="quote_request")
    notes = relationship("LeadNote", back_populates="quote_request")
    attachments = relationship(
        "Attachment",
        primaryjoin="and_(Attachment.related_entity == 'quote_request', "
                    "foreign(Attachment.related_id) == QuoteRequest.id)",
        foreign_keys="Attachment.related_id",
        viewonly=True,
    )


class Contact(TimeStampedModel):
    __tablename__ = "contacts"

    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    quote_request = relationship("QuoteRequest", foreign_keys="QuoteRequest.contact_id", back_populates="contact", uselist=False)
    lead = relationship("Lead", foreign_keys="Lead.contact_id", back_populates="contact", uselist=False)
    quotations = relationship("Quotation", back_populates="contact")
    contracts = relationship("Contract", back_populates="contact")
    client = relationship("Client", foreign_keys="Contact.client_id", back_populates="contacts")
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)


class Lead(TimeStampedModel):
    __tablename__ = "leads"

    lead_number = Column(String, unique=True, index=True, nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    quote_request_id = Column(Integer, ForeignKey("quote_requests.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    project_type_id = Column(Integer, ForeignKey("project_types.id"), nullable=True)
    subcategory_id = Column(Integer, ForeignKey("project_subcategories.id"), nullable=True)
    status = Column(String, default="NEW", nullable=False)
    priority = Column(String, default="MEDIUM", nullable=False)
    source = Column(String, nullable=True)
    estimated_budget = Column(String, nullable=True)
    estimated_timeline = Column(String, nullable=True)
    next_follow_up_at = Column(DateTime, nullable=True)
    qualified_at = Column(DateTime, nullable=True)
    lost_reason = Column(Text, nullable=True)

    # Relationships
    contact = relationship("Contact", back_populates="lead")
    quote_request = relationship("QuoteRequest", back_populates="lead", uselist=False)
    owner = relationship("User", foreign_keys=[owner_id])
    project_type = relationship("ProjectType", foreign_keys=[project_type_id])
    subcategory = relationship("ProjectSubcategory", foreign_keys=[subcategory_id])
    activities = relationship("Activity", back_populates="lead")
    follow_ups = relationship("FollowUp", back_populates="lead")
    notes = relationship("LeadNote", back_populates="lead")
    attachments = relationship(
        "Attachment",
        primaryjoin="and_(Attachment.related_entity == 'lead', "
                    "foreign(Attachment.related_id) == Lead.id)",
        foreign_keys="Attachment.related_id",
        viewonly=True,
    )
    projects = relationship("Project", back_populates="lead")
    technical_analysis = relationship("TechnicalAnalysis", back_populates="lead", uselist=False)
    estimations = relationship("Estimation", back_populates="lead")
    quotations = relationship("Quotation", back_populates="lead")
    contracts = relationship("Contract", back_populates="lead")


class ProjectType(TimeStampedModel):
    __tablename__ = "project_types"

    name = Column(String, unique=True, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)

    # Relationships
    project_subcategories = relationship("ProjectSubcategory", back_populates="project_type")
    quote_requests = relationship("QuoteRequest", back_populates="project_type")
    leads = relationship("Lead", back_populates="project_type")
    projects = relationship("Project", back_populates="project_type")


class ProjectSubcategory(TimeStampedModel):
    __tablename__ = "project_subcategories"

    name = Column(String, unique=True, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    project_type_id = Column(Integer, ForeignKey("project_types.id"), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)

    # Relationships
    project_type = relationship("ProjectType", back_populates="project_subcategories")
    requirement_questions = relationship("RequirementQuestion", back_populates="project_subcategory")
    projects = relationship("Project", back_populates="subcategory")


class RequirementQuestion(TimeStampedModel):
    __tablename__ = "requirement_questions"

    question = Column(Text, nullable=False)
    field_key = Column(String, nullable=False)
    field_type = Column(String, nullable=False)  # text, textarea, number, select, multi-select, radio, checkbox, date, url
    is_required = Column(Boolean, default=True, nullable=False)
    options = Column(JSON, nullable=True)  # for select/radio/checkbox
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    project_type_id = Column(Integer, ForeignKey("project_types.id"), nullable=True)
    subcategory_id = Column(Integer, ForeignKey("project_subcategories.id"), nullable=True)

    # Relationships
    project_type = relationship("ProjectType", foreign_keys=[project_type_id])
    project_subcategory = relationship("ProjectSubcategory", back_populates="requirement_questions")


class Activity(TimeStampedModel):
    __tablename__ = "activities"

    activity_type = Column(String, nullable=False)  # lead_created, lead_assigned, status_changed, note_added, followup_created, followup_completed, requirement_updated, contact_updated, priority_changed
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    quote_request_id = Column(Integer, ForeignKey("quote_requests.id"), nullable=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True)
    meta = Column("metadata", JSON, nullable=True)  # old_value, new_value, field_name, etc. ("metadata" is reserved in Declarative API)

    # Relationships
    lead = relationship("Lead", back_populates="activities")
    quote_request = relationship("QuoteRequest", back_populates="activities")
    quotation = relationship("Quotation", back_populates="activities")
    contract = relationship("Contract", back_populates="activities")
    performed_by_user = relationship("User", foreign_keys=[performed_by])

    def __init__(self, **kwargs):
        # Redirect historical "metadata" kwarg to the mapped "meta" attribute
        if "metadata" in kwargs:
            kwargs["meta"] = kwargs.pop("metadata")
        super().__init__(**kwargs)


class LeadNote(TimeStampedModel):
    __tablename__ = "lead_notes"

    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    quote_request_id = Column(Integer, ForeignKey("quote_requests.id"), nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="notes")
    quote_request = relationship("QuoteRequest", back_populates="notes")
    author = relationship("User", foreign_keys=[author_id])


class FollowUp(TimeStampedModel):
    __tablename__ = "follow_ups"

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_at = Column(DateTime, nullable=False)
    status = Column(String, default="PENDING", nullable=False)  # PENDING, COMPLETED, CANCELLED
    completed_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    quote_request_id = Column(Integer, ForeignKey("quote_requests.id"), nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="follow_ups")
    quote_request = relationship("QuoteRequest", back_populates="follow_ups")
    created_by_user = relationship("User", foreign_keys=[created_by])


class Attachment(TimeStampedModel):
    __tablename__ = "attachments"

    file_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size = Column(Integer, nullable=True)  # in bytes
    storage_key = Column(String, nullable=False)  # S3 key or internal path
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    related_entity = Column(String, nullable=False)  # "quote_request", "lead", etc.
    related_id = Column(Integer, nullable=False)  # ID of the related entity

    # Relationships
    uploader = relationship("User", foreign_keys=[uploaded_by])

    @staticmethod
    def _for(entity: str, entity_id: int):
        """Query helper for polymorphic attachments."""
        return (Attachment.related_entity == entity) & (Attachment.related_id == entity_id)


# Phase 3 Models

class TechnicalAnalysis(TimeStampedModel):
    __tablename__ = "technical_analyses"

    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    prepared_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    business_requirement = Column(Text, nullable=True)
    technical_requirement = Column(Text, nullable=True)
    proposed_solution = Column(Text, nullable=True)
    architecture_notes = Column(Text, nullable=True)
    technologies = Column(JSON, nullable=True)  # e.g., ["React", "Python", "PostgreSQL"]
    integrations = Column(JSON, nullable=True)  # e.g., ["Stripe", "AWS API"]
    infrastructure_requirements = Column(JSON, nullable=True)
    security_requirements = Column(String, nullable=True)  # e.g., "GDPR, SOC2"
    assumptions = Column(Text, nullable=True)
    dependencies = Column(JSON, nullable=True)  # e.g., ["API A", "Service B"]
    risks = Column(JSON, nullable=True)  # List of risk objects
    constraints = Column(JSON, nullable=True)  # List of constraint objects
    notes = Column(Text, nullable=True)
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, IN_REVIEW, APPROVED
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="technical_analysis")
    preparer = relationship("User", foreign_keys=[prepared_by])
    approver = relationship("User", foreign_keys=[approved_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class Estimation(TimeStampedModel):
    __tablename__ = "estimations"

    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, IN_REVIEW, APPROVED, REJECTED
    prepared_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    assumptions = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="estimations")
    preparer = relationship("User", foreign_keys=[prepared_by])
    approver = relationship("User", foreign_keys=[approved_by])
    estimation_items = relationship("EstimationItem", back_populates="estimation", cascade="all, delete-orphan")


class EstimationItem(TimeStampedModel):
    __tablename__ = "estimation_items"

    estimation_id = Column(Integer, ForeignKey("estimations.id"), nullable=False)
    item_type = Column(String, nullable=False)  # "Design", "Development", "Testing", "Deployment", "Other"
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit = Column(String, nullable=True)  # "hours", "days", "license", etc.
    unit_price = Column(Numeric(12, 2), nullable=False)  # Decimal for financial safety
    discount = Column(Numeric(12, 2), default=0, nullable=False)
    tax = Column(Numeric(12, 2), default=0, nullable=False)
    total = Column(Numeric(12, 2), nullable=False)  # (unit_price * quantity) - discount + tax
    display_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    estimation = relationship("Estimation", back_populates="estimation_items")


class Quotation(TimeStampedModel):
    __tablename__ = "quotations"

    quotation_number = Column(String, unique=True, index=True, nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    title = Column(String, nullable=False)
    version = Column(String, default="1", nullable=False)
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, INTERNAL_REVIEW, APPROVED, SENT, VIEWED, ACCEPTED
    currency = Column(String, default="USD", nullable=False)
    subtotal = Column(Numeric(14, 2), default=0, nullable=False)  # Decimal
    discount = Column(Numeric(14, 2), default=0, nullable=False)  # Decimal
    discount_type = Column(String, default="percentage", nullable=False)  # "percentage" or "amount"
    tax = Column(Numeric(14, 2), default=0, nullable=False)  # Decimal
    total = Column(Numeric(14, 2), default=0, nullable=False)  # Decimal
    validity_days = Column(Integer, default=30, nullable=False)  # Default 30 days
    valid_until = Column(DateTime, nullable=True)
    estimated_timeline = Column(String, nullable=True)  # e.g., "6-8 weeks"
    payment_terms = Column(Text, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    customer_message = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    viewed_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    quotation_version_reference = Column(String, nullable=True)  # e.g., "PL-Q-000001-V1"
    previous_version = Column(String, nullable=True)  # Track previous version

    # Relationships
    lead = relationship("Lead", back_populates="quotations")
    contact = relationship("Contact", back_populates="quotations")
    client = relationship("Client", foreign_keys=[client_id], back_populates="quotations")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    quotation_items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")
    quotation_versions = relationship("QuotationVersion", back_populates="quotation", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="quotation")
    projects = relationship("Project", back_populates="quotation")
    comments = relationship("QuotationComment", back_populates="quotation")
    contracts = relationship("Contract", back_populates="quotation")


class QuotationItem(TimeStampedModel):
    __tablename__ = "quotation_items"

    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=False)
    item_type = Column(String, nullable=False)  # e.g., "Design", "Development", "Testing", "Deployment"
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit = Column(String, nullable=True)  # "hours", "license", "per seat", etc.
    unit_price = Column(Numeric(12, 2), nullable=False)  # Decimal for financial safety
    discount = Column(Numeric(12, 2), default=0, nullable=False)  # Decimal
    tax = Column(Numeric(12, 2), default=0, nullable=False)  # Decimal
    total = Column(Numeric(12, 2), nullable=False)  # Decimal: (unit_price * quantity) - discount + tax
    display_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    quotation = relationship("Quotation", back_populates="quotation_items")


class QuotationVersion(TimeStampedModel):
    __tablename__ = "quotation_versions"

    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=False)
    version_number = Column(String, nullable=False)  # e.g., "1", "2", "3"
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, INTERNAL_REVIEW, APPROVED
    effective_from = Column(DateTime, nullable=False)  # When this version becomes effective
    effective_until = Column(DateTime, nullable=True)  # When this version is superseded
    notes = Column(Text, nullable=True)  # Change log / what changed

    # Relationships
    quotation = relationship("Quotation", back_populates="quotation_versions")


class QuotationComment(TimeStampedModel):
    __tablename__ = "quotation_comments"

    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True, nullable=False)  # True = internal only, False = customer-visible
    parent_comment_id = Column(Integer, ForeignKey("quotation_comments.id"), nullable=True)  # For threaded comments

    # Relationships
    quotation = relationship("Quotation", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    parent_comment = relationship("QuotationComment", remote_side="QuotationComment.id")


class Contract(TimeStampedModel):
    __tablename__ = "contracts"

    contract_number = Column(String, unique=True, index=True, nullable=False)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    quotation_version = Column(String, nullable=False)  # e.g., "1"
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    title = Column(String, nullable=False)
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, INTERNAL_REVIEW, SENT, ACCEPTED, ACTIVE
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    scope = Column(Text, nullable=True)
    deliverables = Column(Text, nullable=True)
    payment_terms = Column(Text, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    expired_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=True, default=utcnow)

    # Relationships
    quotation = relationship("Quotation", back_populates="contracts")
    lead = relationship("Lead", back_populates="contracts")
    contact = relationship("Contact", back_populates="contracts")
    client = relationship("Client", foreign_keys=[client_id])
    creator = relationship("User", foreign_keys=[created_by])
    activities = relationship("Activity", back_populates="contract")
    contract_activities = relationship("ContractActivity", back_populates="contract")
    projects = relationship("Project", back_populates="contract")


class ContractActivity(TimeStampedModel):
    __tablename__ = "contract_activities"

    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    activity_type = Column(String, nullable=False)  # "created", "sent", "accepted", "expired"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    meta = Column("metadata", JSON, nullable=True)  # e.g., {"secure_reference": "..."}

    # Relationships
    contract = relationship("Contract", back_populates="contract_activities")
    performer = relationship("User", foreign_keys=[performed_by])

    def __init__(self, **kwargs):
        # Redirect historical "metadata" kwarg to the mapped "meta" attribute
        if "metadata" in kwargs:
            kwargs["meta"] = kwargs.pop("metadata")
        super().__init__(**kwargs)


# Phase 4 Models

class Project(TimeStampedModel):
    __tablename__ = "projects"

    project_number = Column(String, unique=True, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    title = Column(String, nullable=False)
    acronym = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    # Public-facing project story (spec §3): problem/challenge/solution + showcase fields
    problem = Column(Text, nullable=True)
    challenge = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    features = Column(JSON, nullable=True)
    technologies = Column(JSON, nullable=True)
    demo_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    documentation_url = Column(String, nullable=True)
    featured = Column(Boolean, default=False, nullable=False)
    is_public_visible = Column(Boolean, default=True, nullable=False)
    industry = Column(String, nullable=True)
    category = Column(String, nullable=True)
    status = Column(String, default="PLANNING", nullable=False)  # CONCEPT, RESEARCH, PLANNING, PROTOTYPE, DEVELOPMENT, TESTING, COMPLETED, LIVE, MAINTENANCE, ARCHIVED
    priority = Column(String, default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    project_type_id = Column(Integer, ForeignKey("project_types.id"), nullable=True)
    subcategory_id = Column(Integer, ForeignKey("project_subcategories.id"), nullable=True)
    start_date = Column(DateTime, nullable=True)
    target_end_date = Column(DateTime, nullable=True)
    actual_end_date = Column(DateTime, nullable=True)
    full_budget = Column(Numeric(14, 2), nullable=True)
    reserved_budget = Column(Numeric(14, 2), nullable=True)
    customer_budget = Column(Numeric(14, 2), nullable=True)
    actual_cost = Column(Numeric(14, 2), nullable=True)
    selling_value = Column(Numeric(14, 2), nullable=True)
    currency = Column(String, default="USD", nullable=False)
    secure_reference = Column(String, unique=True, index=True, nullable=False)  # For customer-facing views
    notes = Column(Text, nullable=True)

    # Relationships
    contract = relationship("Contract", back_populates="projects")
    lead = relationship("Lead", back_populates="projects")
    quotation = relationship("Quotation", back_populates="projects")
    client = relationship("Client", foreign_keys=[client_id])
    manager = relationship("User", foreign_keys=[manager_id])
    project_type = relationship("ProjectType", back_populates="projects")
    subcategory = relationship("ProjectSubcategory", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    updates = relationship("ProjectUpdate", back_populates="project", cascade="all, delete-orphan")
    components = relationship("ProjectComponent", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(TimeStampedModel):
    __tablename__ = "project_members"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)  # PROJECT_MANAGER, DEVELOPER, DESIGNER, QA, DEVOPS, ANALYST, ...
    is_lead = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)  # ACTIVE, INACTIVE, REMOVED
    joined_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )

    # Relationships
    project = relationship("Project", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


class Milestone(TimeStampedModel):
    __tablename__ = "milestones"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    status = Column(String, default="PENDING", nullable=False)  # PENDING, IN_PROGRESS, COMPLETED, DELAYED
    completed_at = Column(DateTime, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="milestones")
    tasks = relationship("Task", back_populates="milestone", cascade="all, delete-orphan")


class Task(TimeStampedModel):
    __tablename__ = "tasks"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="TODO", nullable=False)  # TODO, IN_PROGRESS, BLOCKED, IN_REVIEW, DONE
    priority = Column(String, default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    due_date = Column(DateTime, nullable=True)
    estimated_hours = Column(Numeric(8, 2), nullable=True)
    actual_hours = Column(Numeric(8, 2), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    milestone = relationship("Milestone", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id])
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")


class TaskComment(TimeStampedModel):
    __tablename__ = "task_comments"

    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])


class ProjectUpdate(TimeStampedModel):
    __tablename__ = "project_updates"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    update_type = Column(String, default="GENERAL", nullable=False)  # GENERAL, STATUS_CHANGE, MILESTONE, TASK, CLIENT
    status = Column(String, nullable=True)  # e.g., project status snapshot at time of update
    is_internal = Column(Boolean, default=True, nullable=False)
    is_user_visible = Column(Boolean, default=False, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="updates")
    author = relationship("User", foreign_keys=[author_id])