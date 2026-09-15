"""Add PostgreSQL sequences for atomic lead_number and request_number generation.

Revision ID: 20240118_sequences
Revises: 20240117_phase3_phase4
Create Date: 2026-09-06
"""
from alembic import op
import sqlalchemy as sa

revision = "20240118_sequences"
down_revision = "20240117_phase3_phase4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create sequence for PL-L-{NNNNNN} lead numbers
    op.execute(
        "CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 87"
    )
    # Create sequence for PL-Q-{NNNNNN} request numbers
    op.execute(
        "CREATE SEQUENCE IF NOT EXISTS request_number_seq START 7"
    )


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS lead_number_seq")
    op.execute("DROP SEQUENCE IF EXISTS request_number_seq")
