"""Persistent activity feed records."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from nexora.core.base import HyphenatedUUID, UUIDBase


class ActivityEventRecord(UUIDBase):
    """Tenant-scoped durable activity event used to hydrate feed clients."""

    __tablename__ = "activity_events"
    __table_args__ = (
        Index("ix_activity_events_company_timestamp", "company_id", "timestamp"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        HyphenatedUUID, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    agent_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    department_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
