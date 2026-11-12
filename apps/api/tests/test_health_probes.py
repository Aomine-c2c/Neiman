"""Unit and integration tests for liveness, readiness, and health probes."""

from contextlib import asynccontextmanager
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from nexora.main import create_app


@pytest.mark.asyncio
async def test_liveness_probes_return_200():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/livez", "/health/live"):
            resp = await client.get(path)
            assert resp.status_code == 200
            body = resp.json()
            assert body["status"] == "ok"
            assert body["service"] == "NEIMAN"
            assert "version" in body


@pytest.mark.asyncio
async def test_readiness_and_health_probes_return_200_when_db_ok(client: AsyncClient):
    for path in ("/readyz", "/health/ready", "/health", "/api/v1/health"):
        resp = await client.get(path)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["components"]["database"] == "ok"


@pytest.mark.asyncio
async def test_readiness_and_health_probes_return_503_when_db_unavailable():
    @asynccontextmanager
    async def _broken_session():
        raise RuntimeError("database connection refused")
        yield  # pragma: no cover

    app = create_app()
    transport = ASGITransport(app=app)
    with patch("nexora.main.get_session_factory", return_value=_broken_session):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            for path in ("/readyz", "/health/ready"):
                resp = await client.get(path)
                assert resp.status_code == 503

            health_resp = await client.get("/health")
            assert health_resp.status_code == 503
            health_body = health_resp.json()
            assert health_body["status"] == "error"
            assert health_body["components"]["database"] == "error"
