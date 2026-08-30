from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()


def utcnow():
    return datetime.utcnow()


class TimeStampedModel(Base):
    __abstract__ = True
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow)