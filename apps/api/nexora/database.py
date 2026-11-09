"""Async database engine and session factory."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from nexora.config import get_settings

settings = get_settings()

# Create async engine — echo only in dev
# If using SQLite file path, ensure directory exists and path is normalized
db_url = settings.DATABASE_URL
if "~" in db_url or "$" in db_url:
    db_url = os.path.expanduser(os.path.expandvars(db_url))
if "sqlite" in db_url:
    if ":///" in db_url and ":////" not in db_url:
        after_scheme = db_url.split(":///", 1)[-1]
        if (
            after_scheme.startswith("/")
            or after_scheme.startswith("home/")
            or after_scheme.startswith("Users/")
        ):
            cleaned = "/" + after_scheme.lstrip("/")
            prefix = db_url.split(":///", 1)[0]
            db_url = f"{prefix}:////{cleaned.lstrip('/')}"

    if "///" in db_url:
        db_path = db_url.split("///")[-1]
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)


connect_args = {}
engine_options = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}
if "sqlite" in db_url:
    connect_args["timeout"] = 15.0
else:
    engine_options.update(
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_timeout=settings.DATABASE_POOL_TIMEOUT_SECONDS,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )

engine = create_async_engine(
    db_url,
    connect_args=connect_args,
    **engine_options,
)


@event.listens_for(engine.sync_engine, "connect")
def configure_sqlite_connection(dbapi_connection, connection_record):
    """Ensure SQLite has now() scalar function, enables foreign keys, WAL mode, and busy timeout."""
    try:
        from datetime import datetime

        dbapi_connection.create_function("now", 0, lambda: datetime.now(UTC).isoformat())
    except Exception:
        pass

    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=15000")
    except Exception:
        pass
    finally:
        cursor.close()


# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

_session_factory = AsyncSessionLocal


def set_session_factory(factory) -> None:
    """Override session factory (e.g. for testing environments)."""
    global _session_factory
    _session_factory = factory


def get_session_factory():
    """Get active session factory."""
    return _session_factory


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a database session per request."""
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager version of get_db for use outside request scope."""
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
