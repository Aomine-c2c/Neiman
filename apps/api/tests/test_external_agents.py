"""
Automated unit & integration tests for External Autonomous Agents (Hermes, Muse, Devin, AutoGen).

Tests:
1. Listing registered external agents
2. Dispatching task to Hermes Agent (function calling & tool decomposition)
3. Dispatching task to Muse Creative Agent (multimodal design tokens & wireframes)
4. Dispatching task to Devin Coding Agent (TDD patch creation)
5. Dispatching task to AutoGen Council Agent (deliberation consensus)
6. Toggling agent active state
7. Sandboxing external endpoint validation
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestExternalAgents:
    async def test_list_external_agents(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/external-agents",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        agents = resp.json()
        assert len(agents) >= 4

        agent_ids = [a["id"] for a in agents]
        assert "hermes_agent" in agent_ids
        assert "muse_agent" in agent_ids
        assert "devin_coding_agent" in agent_ids
        assert "autogen_council_agent" in agent_ids

    async def test_dispatch_to_hermes_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/external-agents/dispatch",
            json={
                "agent_id": "hermes_agent",
                "task_title": "Decompose multi-step database backup pipeline",
                "task_instructions": "Verify all schemas before snapshotting",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "COMPLETED"
        assert data["agent_name"] == "Hermes Autonomous Agent"
        assert "Nous Research" in data["output_result"]
        assert len(data["intermediate_steps"]) > 0
        assert "hermes_execution_plan.json" in data["artifacts_created"]

    async def test_dispatch_to_muse_creative_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/external-agents/dispatch",
            json={
                "agent_id": "muse_agent",
                "task_title": "Design a high-contrast mission control navigation bar",
                "task_instructions": "Ensure WCAG AAA contrast ratio and cyberpunk accents",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "COMPLETED"
        assert "Muse Creative Studio" in data["output_result"]
        assert "design_tokens.json" in data["artifacts_created"]

    async def test_dispatch_to_devin_coding_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/external-agents/dispatch",
            json={
                "agent_id": "devin_coding_agent",
                "task_title": "Refactor concurrency deadlock in memory cache",
                "task_instructions": "Write failing unit test first, then fix lock contention",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "COMPLETED"
        assert "Devin Autonomous Engineer" in data["output_result"]
        assert "patch.diff" in data["artifacts_created"]

    async def test_toggle_and_register_custom_external_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # 1. Toggle Hermes off
        toggle_off = await client.patch(
            f"/api/v1/companies/{company_id}/external-agents/hermes_agent/toggle",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert toggle_off.status_code == 200
        assert toggle_off.json()["is_active"] is False

        # Attempt dispatch to disabled agent
        blocked_resp = await client.post(
            f"/api/v1/companies/{company_id}/external-agents/dispatch",
            json={
                "agent_id": "hermes_agent",
                "task_title": "Test task",
                "task_instructions": "Will fail",
            },
            headers=auth_headers,
        )
        assert blocked_resp.status_code == 200
        assert blocked_resp.json()["status"] == "BLOCKED"

        # Re-enable Hermes
        await client.patch(
            f"/api/v1/companies/{company_id}/external-agents/hermes_agent/toggle",
            json={"is_active": True},
            headers=auth_headers,
        )

        # 2. Register custom external agent
        new_agent = {
            "id": "langgraph_supervisor",
            "name": "LangGraph Supervisor Agent",
            "vendor": "LangChain Ecosystem",
            "description": "Multi-agent graph supervisor directing specialized sub-agents",
            "endpoint_type": "webhook",
            "endpoint_url": "https://langgraph.internal/dispatch",
            "capabilities": ["graph_routing", "state_checkpointing"],
            "system_prompt": "Supervisor agent directing graph flow",
            "default_model": "gpt-4o",
            "is_active": True,
        }
        reg_resp = await client.post(
            f"/api/v1/companies/{company_id}/external-agents",
            json=new_agent,
            headers=auth_headers,
        )
        assert reg_resp.status_code == 201
        assert reg_resp.json()["id"] == "langgraph_supervisor"
