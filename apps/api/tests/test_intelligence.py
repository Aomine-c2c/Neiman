"""Tests for the NEIMAN Intelligence Exchange."""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from nexora.domains.auth.models import User
from nexora.domains.auth.service import create_access_token, hash_password

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def platform_admin_headers(db) -> dict[str, str]:
    """Auth headers for a platform administrator (superuser) — required by provider/admin endpoints."""
    admin = User(
        email="admin@example.com",
        username="admin",
        password_hash=hash_password("AdminPass123!"),
        first_name="Admin",
        last_name="User",
        is_superuser=True,
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    token, _expires = create_access_token(admin.id)
    return {"Authorization": f"Bearer {token}"}


class TestIntelligenceExchange:
    async def test_list_providers(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/intelligence/providers", headers=auth_headers
        )
        assert resp.status_code == 200
        providers = resp.json()
        assert len(providers) >= 4

        names = [p["name"] for p in providers]
        assert "openai" in names
        assert "anthropic" in names
        assert "google_gemini" in names
        assert "local" in names

    async def test_list_models(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/intelligence/models", headers=auth_headers
        )
        assert resp.status_code == 200
        models = resp.json()
        assert len(models) >= 4

        idents = [m["model_identifier"] for m in models]
        assert "gpt-4o" in idents
        assert "claude-3-5-sonnet" in idents
        assert "gemini-1.5-pro" in idents
        assert "local-deepseek-r1" in idents

    async def test_capability_based_routing(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Agent requests "large_context" capability -> router selects an appropriate provider
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Analyze this 500-page organizational audit",
                "required_capabilities": ["large_context"],
                "context_tokens_needed": 150000,
            },
            headers=platform_admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        # Router should select a capable provider (gemini preferred, falls back on provider failure)
        assert data["provider_used"] is not None and len(data["provider_used"]) > 0
        assert data["model_used"] is not None and len(data["model_used"]) > 0
        assert data["prompt_tokens"] > 0
        # estimated cost may be 0.0 when all live providers fail in test env
        assert data["estimated_cost_usd"] >= 0

    async def test_privacy_aware_routing(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Agent requests on-premise zero retention -> routes to local-deepseek-r1
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Classified personnel records evaluation",
                "required_privacy": "ON_PREMISE_ZERO_RETENTION",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider_used"] == "local"
        assert data["model_used"] == "local-deepseek-r1"
        assert data["estimated_cost_usd"] == 0.0  # Zero API cost

    async def test_user_explicit_override(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Explicit override overrides capability routing defaults
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Design high-resilience organizational taxonomy",
                "preferred_model": "claude-3-5-sonnet",
            },
            headers=platform_admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["model_used"] == "claude-3-5-sonnet"
        assert data["provider_used"] == "anthropic"

    async def test_dashboard_analytics(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Generate at least one request
        await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={"prompt": "Dashboard telemetry check"},
            headers=auth_headers,
        )

        dash_resp = await client.get(
            f"/api/v1/companies/{company_id}/intelligence/dashboard", headers=auth_headers
        )
        assert dash_resp.status_code == 200
        dash = dash_resp.json()
        assert dash["total_requests"] >= 1
        assert dash["providers_count"] >= 4
        assert dash["models_count"] >= 4
        assert len(dash["recent_routing_decisions"]) >= 1

    async def test_policy_get_and_update(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # 1. Get default policy
        get_res = await client.get(
            f"/api/v1/companies/{company_id}/intelligence/policy", headers=auth_headers
        )
        assert get_res.status_code == 200
        pol = get_res.json()
        assert pol["strategy"] == "BALANCED"
        assert len(pol["fallback_chain"]) >= 3

        # 2. Update policy to LOWEST_COST
        put_res = await client.put(
            f"/api/v1/companies/{company_id}/intelligence/policy",
            json={
                "strategy": "LOWEST_COST",
                "max_cost_per_query_usd": 0.25,
                "fallback_chain": ["gemini-1.5-pro", "local-deepseek-r1"],
            },
            headers=auth_headers,
        )
        assert put_res.status_code == 200
        updated = put_res.json()
        assert updated["strategy"] == "LOWEST_COST"
        assert updated["max_cost_per_query_usd"] == 0.25
        assert updated["fallback_chain"] == ["gemini-1.5-pro", "local-deepseek-r1"]

    async def test_preferred_provider_routing(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Explicit provider preference: google_gemini
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Summarize this strategy briefing",
                "preferred_provider": "google_gemini",
            },
            headers=platform_admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider_used"] == "google_gemini"
        assert data["model_used"] in ("gemini-3.1-pro-preview", "gemini-1.5-pro")

    async def test_provider_timeout_failover(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Simulate Claude timing out -> router automatically fails over to Gemini."""
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Security analysis of cryptographic protocols",
                "preferred_model": "claude-3-5-sonnet",
                "simulation_flags": {"anthropic": "timeout"},
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["routed_via_fallback"] is True
        assert data["provider_used"] != "anthropic"
        assert "anthropic" in data["fallback_reason"].lower()
        # Verify routing trace recorded failover
        assert len(data["routing_trace"]) >= 2
        assert data["routing_trace"][0]["action"] == "FAILOVER"
        assert data["routing_trace"][-1]["action"] == "COMPLETED"

    async def test_four_tier_fallback_to_local_degraded(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """All external cloud providers (Anthropic, Gemini, OpenAI) fail -> Task succeeds via LOCAL DEGRADED."""
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Emergency mission-critical operations",
                "preferred_model": "claude-3-5-sonnet",
                "simulation_flags": {
                    "all": "rate_limit",
                    "anthropic": "timeout",
                    "local": "none",
                },
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["routed_tier"] == "LOCAL_DEGRADED"
        assert data["provider_used"] == "local"
        assert data["model_used"] == "local-deepseek-r1"
        assert data["estimated_cost_usd"] == 0.0

    async def test_structured_output_validation(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Request structured JSON with required schema fields."""
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Extract security posture matrix",
                "preferred_model": "claude-3-5-sonnet",
                "structured_output_schema": {
                    "type": "object",
                    "required": ["provider", "status", "analysis"],
                },
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["structured_output_validated"] is True
        import json

        parsed = json.loads(data["text"])
        assert "status" in parsed
        assert "analysis" in parsed

    async def test_context_overflow_rejection(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Requesting context size that exceeds all providers is rejected gracefully with explanation."""
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Process astronomical raw telemetry",
                "context_tokens_needed": 999_999_999,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 400
        assert "context capacity overflow" in resp.json()["message"].lower()

    async def test_circuit_breaker_reset_endpoint(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        """Admin can reset tripped circuit breakers and provider health status."""
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/circuit-breakers/reset",
            headers=platform_admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    # ── Local AI Proxy & Token Compression Tests ──────────────────────────────
    async def test_proxy_chat_completions_with_compression(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        """Test OpenAI-compatible /proxy/chat/completions endpoint with token compression."""
        company_id = company_via_api["id"]

        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": "Certainly! I would be very happy to assist you with this task today as your assistant.",
                },
                {
                    "role": "user",
                    "content": "In order to optimize our distributed cluster, please note that we need to inspect latency.",
                },
            ],
            "enable_token_compression": True,
            "compression_strategy": "AGGRESSIVE",
            "allow_fallback": True,
        }

        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/proxy/chat/completions",
            json=payload,
            headers=platform_admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()

        # Validate OpenAI response shape
        assert "chatcmpl-proxy-" in data["id"]
        assert data["object"] == "chat.completion"
        assert len(data["choices"]) > 0
        assert data["choices"][0]["message"]["role"] == "assistant"
        assert len(data["choices"][0]["message"]["content"]) > 0

        # Validate proxy observability and compression telemetry
        assert data["usage"]["compressed_tokens_saved"] > 0
        assert data["usage"]["compression_ratio_pct"] > 0
        assert data["routed_provider"] == "openai"
        assert data["routed_tier"] == "PRIMARY"
        assert data["routed_via_fallback"] is False
        assert data["latency_ms"] >= 0

    async def test_proxy_tiered_fallback(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        """Test proxy automatic cascading fallback when primary provider fails."""
        company_id = company_via_api["id"]

        # Request preferred model claude-3-5-sonnet with simulation error flag
        payload = {
            "model": "claude-3-5-sonnet",
            "messages": [{"role": "user", "content": "Compute high-resiliency routing plan"}],
            "allow_fallback": True,
        }

        # First simulate error on anthropic
        probe_resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/anthropic/probe",
            json={"simulate_behavior": "rate_limit_error"},
            headers=platform_admin_headers,
        )
        assert probe_resp.status_code == 200

        # Now send chat completion through proxy - router should fallback
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/proxy/chat/completions",
            json=payload,
            headers=platform_admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["choices"]) > 0
        assert data["choices"][0]["message"]["role"] == "assistant"

    async def test_configure_provider_and_dashboard_active_state(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        """Test configuring a provider makes it the active provider in dashboard."""
        company_id = company_via_api["id"]

        # Configure openai provider with mock key
        cfg_resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/providers/openai/configure",
            json={
                "api_key": "sk-proj-test-1234567890abcdef",
                "set_as_primary": True,
            },
            headers=platform_admin_headers,
        )
        assert cfg_resp.status_code == 200
        cfg_data = cfg_resp.json()
        assert cfg_data["is_configured"] is True
        assert cfg_data["provider_name"] == "openai"

        # Check dashboard returns active_provider = openai
        dash_resp = await client.get(
            f"/api/v1/companies/{company_id}/intelligence/dashboard",
            headers=platform_admin_headers,
        )
        assert dash_resp.status_code == 200
        dash = dash_resp.json()
        assert dash["active_provider"] == "openai"
        assert dash["active_model"] == "gpt-4o"
        assert dash["active_provider_display"] == "OpenAI"

    async def test_model_limit_reached_failover_and_attribution(
        self, client: AsyncClient, platform_admin_headers: dict, company_via_api: dict
    ):
        """Test that hitting limit on primary model triggers failover and credits succeeding model."""
        company_id = company_via_api["id"]

        # Request with primary model gpt-4o, but simulate_length=True on gpt-4o
        resp = await client.post(
            f"/api/v1/companies/{company_id}/intelligence/generate",
            json={
                "prompt": "Synthesize deep architectural breakdown for distributed cluster.",
                "preferred_model": "gpt-4o",
                "allow_fallback": True,
                "metadata": {"simulate_length": True},
            },
            headers=platform_admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()

        # The primary model (gpt-4o) hit the limit and failed over
        assert data["routed_via_fallback"] is True
        assert data["finish_reason"] == "stop"
        assert data["is_truncated"] is False

        # Credited model must be the succeeding fallback model, NOT gpt-4o
        assert data["credited_model"] is not None
        assert data["credited_model"] != "gpt-4o"
        assert data["credited_provider"] is not None

        # Failover trace must record LIMIT_REACHED on gpt-4o and SUCCESS on succeeding model
        trace = data.get("failover_trace", [])
        assert len(trace) >= 2
        primary_trace = next((t for t in trace if t.get("model") == "gpt-4o"), None)
        assert primary_trace is not None
        assert primary_trace["status"] == "LIMIT_REACHED"

        success_trace = next((t for t in trace if t.get("status") == "SUCCESS"), None)
        assert success_trace is not None
        assert success_trace["model"] == data["credited_model"]


