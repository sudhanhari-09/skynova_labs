"""Master Build Specification v2.0 — remaining domain models.

Covers the §66 database domains that were not part of the original Phase 1-4
models: clients, content/CMS, R&D, inventory, knowledge, automation events/logs,
email/whatsapp, pricing, audit, security sessions, public forms and more.

All classes extend TimeStampedModel; cross-module relationships use string
references resolved by the declarative registry, consistent with the existing
models files.
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON,
    Numeric, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from .base import TimeStampedModel


# ============================================================
# Identity / CRM
# ============================================================

class Client(TimeStampedModel):
    __tablename__ = "clients"

    name = Column(String, nullable=False)
    company = Column(String, nullable=True)
    email = Column(String, index=True, nullable=True)
    phone = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    website = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False)  # ACTIVE, INACTIVE, PROSPECT
    communication_history = Column(JSON, nullable=True)  # lightweight log entries

    contacts = relationship("Contact", back_populates="client")
    quotations = relationship("Quotation", back_populates="client")


class LeadActivity(TimeStampedModel):
    __tablename__ = "lead_activities"

    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    activity_type = Column(String, nullable=False)  # note, email, call, meeting, status_change
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    meta = Column("metadata", JSON, nullable=True)

    lead = relationship("Lead", foreign_keys=[lead_id])
    contact = relationship("Contact", foreign_keys=[contact_id])
    performer = relationship("User", foreign_keys=[performed_by])

    def __init__(self, **kwargs):
        if "metadata" in kwargs:
            kwargs["meta"] = kwargs.pop("metadata")
        super().__init__(**kwargs)


# ============================================================
# Sales: pricing
# ============================================================

class PricingItem(TimeStampedModel):
    __tablename__ = "pricing"

    entity_type = Column(String, nullable=False)  # component, service, project_package, custom
    entity_name = Column(String, nullable=False)
    entity_ref = Column(Integer, nullable=True)  # optional related component/service/project
    price = Column(Numeric(14, 2), nullable=False)
    currency = Column(String, default="USD", nullable=False)
    discount = Column(Numeric(14, 2), default=0, nullable=False)
    tax = Column(Numeric(14, 2), default=0, nullable=False)
    margin_percent = Column(Numeric(8, 2), nullable=True)
    labour_hours = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    valid_from = Column(DateTime, nullable=True)
    valid_to = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# ============================================================
# Projects: project components + documents
# ============================================================

class ProjectComponent(TimeStampedModel):
    __tablename__ = "project_components"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_cost = Column(Numeric(14, 2), nullable=False)
    unit_selling = Column(Numeric(14, 2), nullable=False)
    discount = Column(Numeric(14, 2), default=0, nullable=False)
    tax = Column(Numeric(14, 2), default=0, nullable=False)
    total = Column(Numeric(14, 2), nullable=False)  # (qty * unit_selling) - discount + tax
    notes = Column(Text, nullable=True)

    project = relationship("Project", back_populates="components")
    component = relationship("ComponentItem", back_populates="project_links")


class ProjectDocument(TimeStampedModel):
    __tablename__ = "project_documents"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    size = Column(Integer, nullable=True)
    storage_key = Column(String, nullable=True)
    category = Column(String, default="DOCUMENT", nullable=False)
    is_internal = Column(Boolean, default=True, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    version = Column(String, default="1", nullable=False)

    project = relationship("Project", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])


# ============================================================
# R&D: research, experiments, build logs
# ============================================================

class ResearchProject(TimeStampedModel):
    __tablename__ = "research"

    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    abstract = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    objectives = Column(Text, nullable=True)
    methodology = Column(Text, nullable=True)
    results = Column(Text, nullable=True)
    technologies = Column(JSON, nullable=True)
    researchers = Column(JSON, nullable=True)  # [{name, role}]
    documents = Column(JSON, nullable=True)  # [{name, url}]
    images = Column(JSON, nullable=True)
    videos = Column(JSON, nullable=True)
    publication_links = Column(JSON, nullable=True)
    status = Column(String, default="PROPOSED", nullable=False)  # PROPOSED, ACTIVE, COMPLETED, PUBLISHED, ARCHIVED
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    related_project_ids = Column(JSON, nullable=True)
    related_experiment_ids = Column(JSON, nullable=True)
    related_product_ids = Column(JSON, nullable=True)

    __table_args__ = (Index("ix_research_status", "status"),)


class Experiment(TimeStampedModel):
    __tablename__ = "experiments"

    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    objective = Column(Text, nullable=True)
    hypothesis = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    components = Column(JSON, nullable=True)
    technologies = Column(JSON, nullable=True)
    procedure = Column(Text, nullable=True)
    observations = Column(Text, nullable=True)
    results = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    next_step = Column(String, nullable=True)
    status = Column(String, default="PLANNED", nullable=False)  # PLANNED, RUNNING, TESTING, SUCCESSFUL, FAILED, ARCHIVED
    images = Column(JSON, nullable=True)
    videos = Column(JSON, nullable=True)
    documents = Column(JSON, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    project = relationship("Project", foreign_keys=[project_id])
    research_ids = Column(JSON, nullable=True)

    __table_args__ = (Index("ix_experiments_status", "status"),)


class BuildLog(TimeStampedModel):
    __tablename__ = "build_logs"

    title = Column(String, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    entry_date = Column(DateTime, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    description = Column(Text, nullable=True)
    technologies = Column(JSON, nullable=True)
    images = Column(JSON, nullable=True)
    videos = Column(JSON, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    entry_type = Column(String, default="PROGRESS", nullable=False)  # MILESTONE, PROGRESS, TESTING, RELEASE

    project = relationship("Project", foreign_keys=[project_id])
    author = relationship("User", foreign_keys=[author_id])


# ============================================================
# Inventory: components, suppliers, movements
# ============================================================

class ComponentItem(TimeStampedModel):
    __tablename__ = "components"

    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    manufacturer = Column(String, nullable=True)
    model_no = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    purchase_price = Column(Numeric(14, 2), default=0, nullable=False)
    selling_price = Column(Numeric(14, 2), default=0, nullable=False)
    current_stock = Column(Integer, default=0, nullable=False)
    minimum_stock = Column(Integer, default=0, nullable=False)
    unit = Column(String, default="unit", nullable=False)
    storage_location = Column(String, nullable=True)
    datasheet_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    specifications = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False)  # ACTIVE, DISCONTINUED, OUT_OF_STOCK

    supplier = relationship("Supplier", back_populates="components")
    movements = relationship("InventoryMovement", back_populates="component", cascade="all, delete-orphan")
    project_links = relationship("ProjectComponent", back_populates="component", cascade="all, delete-orphan")


class Supplier(TimeStampedModel):
    __tablename__ = "suppliers"

    name = Column(String, nullable=False)
    company = Column(String, nullable=True)
    contact = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    payment_terms = Column(String, nullable=True)
    purchase_history = Column(JSON, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False)
    notes = Column(Text, nullable=True)

    components = relationship("ComponentItem", back_populates="supplier")


class InventoryMovement(TimeStampedModel):
    __tablename__ = "inventory_movements"

    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    movement_type = Column(String, nullable=False)  # STOCK_IN, STOCK_OUT, ADJUSTMENT, ALLOCATION, DEALLOCATION
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(14, 2), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    reference_number = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    component = relationship("ComponentItem", back_populates="movements")
    project = relationship("Project", foreign_keys=[project_id])


# ============================================================
# Content / CMS
# ============================================================

class CMSPage(TimeStampedModel):
    __tablename__ = "pages"

    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    content = Column(Text, nullable=True)
    seo_title = Column(String, nullable=True)
    meta_description = Column(String, nullable=True)
    meta_keywords = Column(String, nullable=True)
    canonical_url = Column(String, nullable=True)
    og_title = Column(String, nullable=True)
    og_description = Column(String, nullable=True)
    og_image = Column(String, nullable=True)
    robots = Column(String, nullable=True)  # index,noindex/follow,nofollow
    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)
    is_homepage = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    sections = relationship("PageSection", back_populates="page", cascade="all, delete-orphan")


class PageSection(TimeStampedModel):
    __tablename__ = "page_sections"

    page_id = Column(Integer, ForeignKey("pages.id"), nullable=False)
    section_key = Column(String, nullable=False)
    title = Column(String, nullable=True)
    subtitle = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    cta_text = Column(String, nullable=True)
    cta_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    background = Column(String, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    visibility = Column(String, default="PUBLIC", nullable=False)  # PUBLIC, AUTHENTICATED, ADMIN
    meta = Column("metadata", JSON, nullable=True)

    page = relationship("CMSPage", back_populates="sections")

    def __init__(self, **kwargs):
        if "metadata" in kwargs:
            kwargs["meta"] = kwargs.pop("metadata")
        super().__init__(**kwargs)


class BlogPost(TimeStampedModel):
    __tablename__ = "blog_posts"

    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    excerpt = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    category = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)
    cover_image = Column(String, nullable=True)
    is_published = Column(Boolean, default=False, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)
    seo_title = Column(String, nullable=True)
    meta_description = Column(String, nullable=True)
    canonical_url = Column(String, nullable=True)
    og_title = Column(String, nullable=True)
    og_description = Column(String, nullable=True)
    og_image = Column(String, nullable=True)
    related_project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    related_research_id = Column(Integer, nullable=True)

    author = relationship("User", foreign_keys=[author_id])
    related_project = relationship("Project", foreign_keys=[related_project_id])


class Faq(TimeStampedModel):
    __tablename__ = "faqs"

    question = Column(String, nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)


class Testimonial(TimeStampedModel):
    __tablename__ = "testimonials"

    name = Column(String, nullable=False)
    role = Column(String, nullable=True)
    company = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)
    image_url = Column(String, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)


class TeamMember(TimeStampedModel):
    __tablename__ = "team_members"

    name = Column(String, nullable=False)
    position = Column(String, nullable=True)
    department = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    skills = Column(JSON, nullable=True)
    technologies = Column(JSON, nullable=True)
    availability = Column(String, nullable=True)  # available, partial, full
    photo_url = Column(String, nullable=True)
    email = Column(String, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)


class Partner(TimeStampedModel):
    __tablename__ = "partners"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=True)
    logo_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    website_url = Column(String, nullable=True)
    partner_type = Column(String, nullable=True)  # industry, academic, technology, hardware, investor
    display_order = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)


class Achievement(TimeStampedModel):
    __tablename__ = "achievements"

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    achievement_date = Column(DateTime, nullable=True)
    category = Column(String, nullable=True)
    metric = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    is_featured = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)


class NavigationItem(TimeStampedModel):
    __tablename__ = "navigation_items"

    label = Column(String, nullable=False)
    url = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("navigation_items.id"), nullable=True)
    location = Column(String, default="header", nullable=False)  # header, footer, about, labs, solutions
    display_order = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)

    parent = relationship("NavigationItem", remote_side="NavigationItem.id")


# ============================================================
# Website: settings + themes + media
# ============================================================

class WebsiteSetting(TimeStampedModel):
    __tablename__ = "website_settings"

    key = Column(String, unique=True, index=True, nullable=False)
    value_type = Column(String, default="string", nullable=False)  # string, json, bool, int
    value_text = Column(Text, nullable=True)
    value_json = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)


class Theme(TimeStampedModel):
    __tablename__ = "themes"

    name = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    palette = Column(JSON, nullable=True)  # {background, surface, text, secondary, primary, accent, borders}
    fonts = Column(JSON, nullable=True)
    ui = Column(JSON, nullable=True)  # {button_radius, card_radius, border_style, shadows, spacing}
    layout = Column(JSON, nullable=True)  # {navbar, footer, homepage_order}
    appearance = Column(String, default="light", nullable=False)  # light, dark
    is_preset = Column(Boolean, default=False, nullable=False)


class MediaItem(TimeStampedModel):
    __tablename__ = "media"

    file_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size = Column(Integer, nullable=True)
    storage_key = Column(String, nullable=False)
    public_url = Column(String, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    related_entity = Column(String, nullable=True)
    related_id = Column(Integer, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)

    uploader = relationship("User", foreign_keys=[uploaded_by])


# ============================================================
# Services / Technologies / Industries
# ============================================================

class Service(TimeStampedModel):
    __tablename__ = "services"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    starting_price = Column(Numeric(14, 2), nullable=True)
    pricing_model = Column(String, nullable=True)  # fixed, hourly, retainer, custom
    features = Column(JSON, nullable=True)
    technologies = Column(JSON, nullable=True)
    image_url = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)


class Technology(TimeStampedModel):
    __tablename__ = "technologies"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    version = Column(String, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)


class Industry(TimeStampedModel):
    __tablename__ = "industries"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    problems_solved = Column(JSON, nullable=True)
    related_services = Column(JSON, nullable=True)
    related_technologies = Column(JSON, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)


# ============================================================
# Knowledge base
# ============================================================

class KnowledgeCategory(TimeStampedModel):
    __tablename__ = "knowledge_categories"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)

    articles = relationship("KnowledgeArticle", back_populates="category")


class KnowledgeArticle(TimeStampedModel):
    __tablename__ = "knowledge_articles"

    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("knowledge_categories.id"), nullable=True)
    content = Column(Text, nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    tags = Column(JSON, nullable=True)
    related_project_id = Column(Integer, nullable=True)
    related_technology = Column(String, nullable=True)
    visibility = Column(String, default="INTERNAL", nullable=False)  # INTERNAL, PUBLIC
    version = Column(String, default="1", nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)

    category = relationship("KnowledgeCategory", back_populates="articles")
    author = relationship("User", foreign_keys=[author_id])


# ============================================================
# Automation events + logs
# ============================================================

class AutomationEvent(TimeStampedModel):
    __tablename__ = "automation_events"

    event_type = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(Integer, nullable=True)
    payload = Column(JSON, nullable=True)
    occurred_at = Column(DateTime, nullable=False)
    consumed = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class AutomationLog(TimeStampedModel):
    __tablename__ = "automation_logs"

    rule_id = Column(Integer, ForeignKey("automation_rules.id"), nullable=True)
    event_id = Column(Integer, ForeignKey("automation_events.id"), nullable=True)
    status = Column(String, nullable=False)  # SUCCESS, FAILED, SKIPPED
    detail = Column(Text, nullable=True)
    executed_at = Column(DateTime, nullable=False)

    rule = relationship("AutomationRule")
    event = relationship("AutomationEvent")


# ============================================================
# Email / WhatsApp
# ============================================================

class EmailTemplate(TimeStampedModel):
    __tablename__ = "email_templates"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    subject = Column(String, nullable=False)
    body_html = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)
    variables = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class EmailLog(TimeStampedModel):
    __tablename__ = "email_logs"

    recipient = Column(String, nullable=False)
    template_id = Column(Integer, ForeignKey("email_templates.id"), nullable=True)
    subject = Column(String, nullable=True)
    status = Column(String, nullable=False)  # SENT, FAILED, SIMULATED
    provider = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    message_id = Column(String, nullable=True)
    related_entity = Column(String, nullable=True)
    related_id = Column(Integer, nullable=True)
    email_timestamp = Column(DateTime, nullable=False)


class WhatsappTemplate(TimeStampedModel):
    __tablename__ = "whatsapp_templates"

    name = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    variables = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class WhatsappLog(TimeStampedModel):
    __tablename__ = "whatsapp_logs"

    phone = Column(String, nullable=False)
    template_id = Column(Integer, ForeignKey("whatsapp_templates.id"), nullable=True)
    status = Column(String, nullable=False)  # SENT, FAILED, DELIVERED, SIMULATED
    provider = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    message_id = Column(String, nullable=True)
    wa_id = Column(String, nullable=True)
    related_entity = Column(String, nullable=True)
    related_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, nullable=False)


# ============================================================
# Audit + Security
# ============================================================

class AuditLog(TimeStampedModel):
    __tablename__ = "audit_logs"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    module = Column(String, nullable=True)
    entity_type = Column(String, nullable=True)
    entity_id = Column(Integer, nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    request_ip = Column(String, nullable=True)
    request_method = Column(String, nullable=True)
    request_path = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    timestamp = Column(DateTime, nullable=False)

    actor = relationship("User", foreign_keys=[user_id])


class TokenSession(TimeStampedModel):
    """Server-side refresh-token registry for revocation (spec §57)."""
    __tablename__ = "token_sessions"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    refresh_token_hash = Column(String, index=True, nullable=False)
    jti = Column(String, index=True, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_ip = Column(String, nullable=True)
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class LoginAttempt(TimeStampedModel):
    __tablename__ = "login_attempts"

    email = Column(String, index=True, nullable=False)
    successful = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String, nullable=True)
    attempted_at = Column(DateTime, nullable=False)

    __table_args__ = (Index("ix_login_attempts_email_time", "email", "attempted_at"),)


# ============================================================
# Products: features
# ============================================================

class ProductFeature(TimeStampedModel):
    __tablename__ = "product_features"

    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="PLANNED", nullable=False)  # PLANNED, ACTIVE, FUTURE, COMPLETED
    priority = Column(String, default="MEDIUM", nullable=False)
    target_quarter = Column(String, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)

    product = relationship("Product", back_populates="features")


# ============================================================
# Case studies
# ============================================================

class CaseStudy(TimeStampedModel):
    __tablename__ = "case_studies"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    problem = Column(Text, nullable=True)
    challenge = Column(Text, nullable=True)
    research = Column(Text, nullable=True)
    approach = Column(Text, nullable=True)
    prototype = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    technologies = Column(JSON, nullable=True)
    development_process = Column(Text, nullable=True)
    results = Column(Text, nullable=True)
    impact = Column(Text, nullable=True)
    timeline = Column(JSON, nullable=True)
    team = Column(JSON, nullable=True)
    cover_image = Column(String, nullable=True)
    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)
    seo_title = Column(String, nullable=True)
    meta_description = Column(String, nullable=True)

    project = relationship("Project", foreign_keys=[project_id])


# ============================================================
# Public forms
# ============================================================

class NewsletterSubscriber(TimeStampedModel):
    __tablename__ = "newsletter_subscribers"

    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    source = Column(String, nullable=True)  # website, blog, project_submission
    subscribed_at = Column(DateTime, nullable=False)


class PublicSubmission(TimeStampedModel):
    """Catch-all for public forms: contact, start-project, collaboration,
    newsletter and project submissions. Each submission can become a lead/CRM
    activity through the same pipeline used by quote requests."""
    __tablename__ = "public_submissions"

    form_type = Column(String, nullable=False)  # contact, start_project, collaboration, project_submission, support
    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    company = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    collaboration_type = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    preferred_technology = Column(String, nullable=True)
    budget = Column(String, nullable=True)
    timeline = Column(String, nullable=True)
    idea = Column(Text, nullable=True)
    problem = Column(Text, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    meta = Column("metadata", JSON, nullable=True)
    created_ip = Column(String, nullable=True)
    converted_lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)

    def __init__(self, **kwargs):
        if "metadata" in kwargs:
            kwargs["meta"] = kwargs.pop("metadata")
        super().__init__(**kwargs)