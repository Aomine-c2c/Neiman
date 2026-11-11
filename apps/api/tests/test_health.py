"""Health and orchestration probe behavior."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_liveness_readiness_and_health_report_healthy_database(client: AsyncClient) -> None:
    liveness = await client.get("/livez")
    readiness = await client.get("/readyz")
    health = await client.get("/health")

    assert liveness.status_code == 200
    assert liveness.json()["status"] == "ok"
    assert readiness.status_code == 200
    assert readiness.json()["components"]["database"] == "ok"
    assert health.status_code == 200
    assert health.json()["components"]["database"] == "ok"


@pytest.mark.asyncio
async def test_readiness_returns_503_when_database_query_fails(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import nexora.main

    class UnavailableSession:
        async def __aenter__(self) -> "UnavailableSession":
            return self

        async def __aexit__(self, exc_type, exc_value, traceback) -> None:
            return None

        async def execute(self, statement) -> None:
            raise ConnectionError("database credentials must not be returned to clients")

    @asynccontextmanager
    async def unavailable_session() -> AsyncIterator[UnavailableSession]:
        session = UnavailableSession()
        try:
            yield session
        finally:
            await session.__aexit__(None, None, None)

    monkeypatch.setattr(nexora.main, "get_session_factory", lambda: unavailable_session)

    response = await client.get("/readyz")

    assert response.status_code == 503
    assert response.json() == {"detail": "Service dependencies are unavailable"}
    assert "database credentials" not in response.text


@pytest.mark.asyncio
async def test_detailed_health_returns_503_without_leaking_database_error(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import nexora.main

    class UnavailableSession:
        async def __aenter__(self) -> "UnavailableSession":
            return self

        async def __aexit__(self, exc_type, exc_value, traceback) -> None:
            return None

        async def execute(self, statement) -> None:
            raise ConnectionError("private database endpoint")

    @asynccontextmanager
    async def unavailable_session() -> AsyncIterator[UnavailableSession]:
        session = UnavailableSession()
        try:
            yield session
        finally:
            await session.__aexit__(None, None, None)

    monkeypatch.setattr(nexora.main, "get_session_factory", lambda: unavailable_session)

    response = await client.get("/health")

    assert response.status_code == 503
    assert response.json()["status"] == "error"
    assert response.json()["components"]["database"] == "error"
    assert "private database endpoint" not in response.text
