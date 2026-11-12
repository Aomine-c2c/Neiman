"""Alembic migration environment — async-compatible."""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

import nexora.domains.activity.models  # noqa: F401
import nexora.domains.agents.models  # noqa: F401
import nexora.domains.auth.models  # noqa: F401
import nexora.domains.blueprints.models  # noqa: F401
import nexora.domains.councils.models  # noqa: F401
import nexora.domains.decisions.models  # noqa: F401
import nexora.domains.governance.models  # noqa: F401
import nexora.domains.intelligence.evolution_models  # noqa: F401
import nexora.domains.intelligence.models  # noqa: F401
import nexora.domains.jobs.models  # noqa: F401
import nexora.domains.memory.models  # noqa: F401
import nexora.domains.organizations.models  # noqa: F401
import nexora.domains.policies.models  # noqa: F401
import nexora.domains.projects.models  # noqa: F401
import nexora.domains.resources.models  # noqa: F401
import nexora.domains.workflows.models  # noqa: F401
from alembic import context

# This must be imported so Alembic can discover all table definitions
from nexora.database import Base

# Alembic Config object
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """Read DATABASE_URL from environment, fall back to alembic.ini."""
    import os

    url = os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url", "")
    if "~" in url or "$" in url:
        url = os.path.expanduser(os.path.expandvars(url))
    if "sqlite" in url:
        if ":///" in url and ":////" not in url:
            after_scheme = url.split(":///", 1)[-1]
            if (
                after_scheme.startswith("/")
                or after_scheme.startswith("home/")
                or after_scheme.startswith("Users/")
            ):
                cleaned = "/" + after_scheme.lstrip("/")
                prefix = url.split(":///", 1)[0]
                url = f"{prefix}:////{cleaned.lstrip('/')}"
        if "///" in url:
            db_path = url.split("///")[-1]
            if db_path and db_path != ":memory:":
                from pathlib import Path

                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def reconcile_unversioned_db(connection: Connection) -> None:
    """
    Safeguard against desynchronized or unversioned SQLite databases.
    If schema tables already exist (e.g. `users`) but `alembic_version` is missing,
    empty, or desynchronized, Alembic would otherwise attempt to run 0001_initial_schema
    and fail with 'table users already exists'.
    This function detects the actual schema version present in the database
    and stamps alembic_version accordingly before migrations run.
    """
    from sqlalchemy import inspect, text

    insp = inspect(connection)
    tables = set(insp.get_table_names())

    # If no core tables exist, it is a brand new database; let Alembic run from base.
    if "users" not in tables:
        return

    has_alembic = "alembic_version" in tables
    current_rev: str | None = None
    if has_alembic:
        try:
            res = connection.execute(text("SELECT version_num FROM alembic_version")).fetchall()
            if res and res[0][0]:
                current_rev = str(res[0][0]).strip()
        except Exception:
            current_rev = None

    known_revs = {
        "0001",
        "0002",
        "0003",
        "0004",
        "0005",
        "0006",
        "0007",
        "0008",
        "0009",
        "a2aa9fa5a0fe",
        "b71d8820c4a1",
        "a5bfa04c6572",
        "c83e1091bfa3",
        "d14f2e91bfa4",
        "e63a4c0d9f12",
        "f4b8d1a2c963",
    }

    # If already tracked at a valid known revision, leave it untouched.
    if current_rev and current_rev in known_revs:
        return

    # Infer the highest schema revision present in the database
    if "resource_budgets" in tables and any(
        c["name"] == "reserved_budget_usd"
        for c in insp.get_columns("resource_budgets")
    ):
        detected_rev = "f4b8d1a2c963"
    elif "activity_events" in tables:
        detected_rev = "e63a4c0d9f12"
    elif (
        "custom_kpi_definitions" in tables
        or "organizational_snapshots" in tables
        or "evolution_proposals" in tables
        or "evolution_metrics" in tables
    ):
        detected_rev = "d14f2e91bfa4"
    elif "cto_proposals" in tables:
        detected_rev = "c83e1091bfa3"
    elif "governance_audit_logs" in tables and any(
        c["name"] in ("integrity_signature", "tamper_evident_signature")
        for c in insp.get_columns("governance_audit_logs")
    ):
        detected_rev = "a5bfa04c6572"
    elif "model_providers" in tables and any(
        c["name"] in ("configuration_vault", "is_configured")
        for c in insp.get_columns("model_providers")
    ):
        detected_rev = "b71d8820c4a1"
    elif "model_request_logs" in tables and any(
        c["name"] in ("routed_tier", "circuit_breaker_status")
        for c in insp.get_columns("model_request_logs")
    ):
        detected_rev = "a2aa9fa5a0fe"
    elif "agent_councils" in tables:
        detected_rev = "0009"
    elif "workflow_executions" in tables:
        detected_rev = "0008"
    elif "company_blueprints" in tables:
        detected_rev = "0007"
    elif "governance_proposals" in tables:
        detected_rev = "0006"
    elif "memory_items" in tables:
        detected_rev = "0005"
    elif "resource_pools" in tables:
        detected_rev = "0004"
    elif "agent_memories" in tables:
        detected_rev = "0002"
    elif "agents" in tables:
        detected_rev = "0001"
    else:
        # Partial 0001 state (e.g. only users/companies exist, but agents not yet created)
        detected_rev = None

    if detected_rev:
        if not has_alembic:
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)")
            )
        else:
            connection.execute(text("DELETE FROM alembic_version"))
        connection.execute(
            text(f"INSERT INTO alembic_version (version_num) VALUES ('{detected_rev}')")
        )


def do_run_migrations(connection: Connection) -> None:
    reconcile_unversioned_db(connection)
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    url = get_url()
    engine = create_async_engine(url, poolclass=pool.NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
