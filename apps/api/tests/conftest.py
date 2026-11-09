"""
Pytest configuration and shared fixtures.

Uses an async SQLite in-memory database for fast, isolated tests.
Each test function gets a fresh database and a fresh HTTP client.
"""

import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from nexora.config import get_settings
from nexora.core.enums import MembershipRole
from nexora.database import Base, get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.service import hash_password
from nexora.domains.organizations.models import Company, CompanyMember
from nexora.main import create_app


def pytest_configure(config):
    """Ensure tests run with auth enabled and clean settings."""
    os.environ["DISABLE_AUTH"] = "false"
    os.environ["ENABLE_SIMULATION_MODE"] = "true"
    os.environ["XDG_CONFIG_HOME"] = "/tmp/neiman_test_xdg"
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def reset_intelligence_depletion():
    """Ensure in-memory model depletion tracker does not leak state across tests."""
    from nexora.domains.intelligence.rotation import ModelDepletionTracker

    ModelDepletionTracker.clear()
    yield
    ModelDepletionTracker.clear()

# ── Test Database Setup ────────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Fresh SQLite engine per test function."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Database session for direct use in tests."""
    from nexora.database import AsyncSessionLocal, set_session_factory

    session_factory = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    set_session_factory(session_factory)
    async with session_factory() as session:
        yield session
    set_session_factory(AsyncSessionLocal)


@pytest_asyncio.fixture(scope="function")
async def client(db_engine) -> AsyncGenerator[AsyncClient, None]:
    """HTTP test client with DB dependency overridden."""
    from nexora.database import AsyncSessionLocal, set_session_factory
    from nexora.domains.agents.supervisor import stop_all_supervisors
    from nexora.domains.intelligence.router_service import _SHARED_REGISTRY

    _SHARED_REGISTRY.reset_to_defaults()

    session_factory = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    set_session_factory(session_factory)

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        try:
            yield ac
        finally:
            _SHARED_REGISTRY.reset_to_defaults()
            await stop_all_supervisors()
            set_session_factory(AsyncSessionLocal)


# ── Entity Fixtures ────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def user(db: AsyncSession) -> User:
    """A plain active user."""
    u = User(
        email="alice@example.com",
        username="alice",
        password_hash=hash_password("TestPass123!"),
        first_name="Alice",
        last_name="Smith",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest_asyncio.fixture
async def user2(db: AsyncSession) -> User:
    """A second user for multi-user tests."""
    u = User(
        email="bob@example.com",
        username="bob",
        password_hash=hash_password("TestPass123!"),
        first_name="Bob",
        last_name="Jones",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest_asyncio.fixture
async def company(db: AsyncSession, user: User) -> Company:
    """A company owned by `user`, with user as OWNER member."""
    c = Company(
        name="Nexora Corp",
        slug="nexora-corp",
        owner_id=user.id,
        description="The future of work",
        industry="Technology",
    )
    db.add(c)
    await db.flush()
    member = CompanyMember(company_id=c.id, user_id=user.id, role=MembershipRole.OWNER)
    db.add(member)
    await db.commit()
    await db.refresh(c)
    return c


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register + login alice, return Authorization headers."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "alice@example.com",
            "username": "alice",
            "password": "TestPass123!",
            "first_name": "Alice",
            "last_name": "Smith",
        },
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "alice@example.com",
            "password": "TestPass123!",
        },
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def company_via_api(client: AsyncClient, auth_headers: dict) -> dict:
    """Create a company via API and return the response JSON."""
    resp = await client.post(
        "/api/v1/companies",
        json={"name": "Nexora Corp", "industry": "Technology"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
