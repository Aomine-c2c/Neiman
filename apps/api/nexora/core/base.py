"""Base SQLAlchemy model with UUID PK, timestamps, and soft-delete."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from nexora.database import Base


class HyphenatedUUID(TypeDecorator):
    """
    SQLite-compatible UUID storage as hyphenated strings (36 chars).

    Stores:  '8d73d915-2ebe-43c2-8680-8bda642d501e'
    Returns:  uuid.UUID instance in Python.

    This TypeDecorator ensures that bind parameters are always sent as
    hyphenated strings and result values are always parsed back to UUID objects,
    making it compatible with data seeded before the default CHAR(32) behaviour
    was introduced.
    """

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        # Accept plain string; normalise to hyphenated form if needed
        s = str(value).strip()
        if len(s) == 32 and "-" not in s:
            return str(uuid.UUID(s))
        return s

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return uuid.UUID(str(value))
        except (ValueError, AttributeError):
            return None


class CreatedAtMixin:
    """Adds created_at timestamp to any model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class TimestampMixin(CreatedAtMixin):
    """Adds created_at and updated_at to any model."""

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class SoftDeleteMixin:
    """Adds soft-delete fields. Hard DELETE is forbidden on protected entities."""

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UUIDBase(Base):
    """Abstract base with UUID primary key stored as hyphenated string in SQLite."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(HyphenatedUUID, primary_key=True, default=uuid.uuid4)


class UUIDCreatedAtBase(UUIDBase, CreatedAtMixin):
    """Abstract base with UUID primary key and created_at timestamp."""

    __abstract__ = True


class UUIDTimestampBase(UUIDBase, TimestampMixin):
    """Abstract base with UUID primary key and timestamps, without soft-delete."""

    __abstract__ = True


class NexoraBase(UUIDBase, TimestampMixin, SoftDeleteMixin):
    """Full-featured base: UUID PK + timestamps + soft-delete."""

    __abstract__ = True
