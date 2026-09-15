"""Atomic unique number generation using PostgreSQL sequences."""
from sqlalchemy.orm import Session
from sqlalchemy import text


def next_lead_number(db: Session) -> str:
    """Generate the next unique lead number: PL-L-{NNNNNN}.

    Uses a PostgreSQL sequence for atomic, concurrency-safe generation.
    """
    result = db.execute(text("SELECT nextval('lead_number_seq')"))
    seq_val = result.scalar()
    return f"PL-L-{seq_val:06d}"


def next_request_number(db: Session) -> str:
    """Generate the next unique quote request number: PL-Q-{NNNNNN}.

    Uses a PostgreSQL sequence for atomic, concurrency-safe generation.
    """
    result = db.execute(text("SELECT nextval('request_number_seq')"))
    seq_val = result.scalar()
    return f"PL-Q-{seq_val:06d}"
