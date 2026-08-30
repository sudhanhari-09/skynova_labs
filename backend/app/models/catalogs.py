"""Catalogs: foundational lookup entities, expenses and the audit log.

The client/service/technology/industry/audit-log tables already live in
`models/spec.py` (registered in `Base.metadata` as soon as the app package is
imported). They are re-exported here under this module's canonical names so the
catalogs router and Alembic autogenerate have a single consistent entry point,
while `Expense` (a genuinely missing table) is defined here for the first time.
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON,
    Numeric, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from .base import TimeStampedModel, utcnow


# ============================================================
# Re-exported from `models/spec.py` (tables already in the metadata)
# ============================================================

from app.models.spec import (  # noqa: E402,F401
    Client,
    Service,
    Technology,
    Industry,
    AuditLog,
)


# ============================================================
# Expenses (new table)
# ============================================================

class Expense(TimeStampedModel):
    __tablename__ = "expenses"

    title = Column(String, nullable=False)
    amount = Column(Numeric(14, 2), default=0, nullable=False)
    category = Column(String, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    incurred_at = Column(DateTime, nullable=True)
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    project = relationship("Project", foreign_keys=[project_id])
    payer = relationship("User", foreign_keys=[paid_by])