"""Unit tests for live intelligence provider probing and circuit breaker resilience."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestIntelligenceProbing:
    async def test_probe_provider_success(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Test successful ping probe against registered provider."""
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/google_gemini/probe",
            json={"timeout_seconds": 5.0},
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["provider"] == "google_gemini"
        assert data["is_healthy"] is True
        assert data["circuit_breaker_status"] == "CLOSED"
        assert data["latency_ms"] >= 0.0
        assert data["consecutive_failures"] == 0
        assert "Probe successful" in data["message"]

    async def test_probe_provider_simulated_faults_and_circuit_breaker_trip(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Test simulating consecutive rate-limit / timeout errors to verify circuit-breaker trips to OPEN."""
        company_id = company_via_api["id"]

        # 1. First simulated fault
        r1 = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/anthropic/probe",
            json={"simulate_error": "rate_limit"},
            headers=auth_headers,
        )
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["consecutive_failures"] == 1
        assert d1["circuit_breaker_status"] == "CLOSED"

        # 2. Second simulated fault
        r2 = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/anthropic/probe",
            json={"simulate_error": "timeout"},
            headers=auth_headers,
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["consecutive_failures"] == 2
        assert d2["circuit_breaker_status"] == "CLOSED"

        # 3. Third simulated fault -> should trip to OPEN
        r3 = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/anthropic/probe",
            json={"simulate_error": "500"},
            headers=auth_headers,
        )
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["consecutive_failures"] == 3
        assert d3["circuit_breaker_status"] == "OPEN"
        assert d3["is_healthy"] is False

        # 4. Subsequent normal probe must fast-fail because circuit breaker is OPEN
        r4 = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/anthropic/probe",
            json={},
            headers=auth_headers,
        )
        assert r4.status_code == 200
        d4 = r4.json()
        assert d4["circuit_breaker_status"] == "OPEN"
        assert d4["is_healthy"] is False
        assert "Fast-failed" in d4["message"]

        # 5. Reset circuit breakers
        r_reset = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/circuit-breakers/reset",
            headers=auth_headers,
        )
        assert r_reset.status_code == 200
        assert r_reset.json()["status"] == "ok"

        # 6. Verify probe is now healthy again
        r5 = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/anthropic/probe",
            json={},
            headers=auth_headers,
        )
        assert r5.status_code == 200
        d5 = r5.json()
        assert d5["circuit_breaker_status"] == "CLOSED"
        assert d5["is_healthy"] is True
        assert d5["consecutive_failures"] == 0
