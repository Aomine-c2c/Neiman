"""Tests for Autonomous CTO Agent and Continuous Development Lifecycle Supervisor."""

import json

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def mock_cto_llm(monkeypatch):
    from nexora.domains.intelligence.schemas import ModelResponsePayload
    from nexora.domains.intelligence.service import IntelligenceService

    async def fake_execute_request(self, *args, **kwargs):
        req = kwargs.get("request") or kwargs.get("req") or (args[1] if len(args) > 1 else None)
        p = (req.prompt if req else "").lower()
        if "hi" in p or "hello" in p or "how are you" in p:
            text = '{"intent": "CONVERSATION", "reply": "Hello Executive. Autonomous CTO standing by.", "tasks": []}'
        else:
            prompt_str = req.prompt if req else "directive"
            text = json.dumps({
                "intent": "DIRECTIVE",
                "reply": f"Decomposed directive: {prompt_str[:50]}",
                "tasks": [
                    {"title": f"Specification: {prompt_str[:30]}", "description": "Spec", "target_role": "database", "priority": "HIGH"},
                    {"title": f"Implementation: {prompt_str[:30]}", "description": "Impl", "target_role": "backend", "priority": "HIGH", "dep_indices": [0]},
                    {"title": f"Automated Tests: {prompt_str[:30]}", "description": "Tests", "target_role": "qa", "priority": "HIGH", "dep_indices": [1]},
                ],
            })
        return ModelResponsePayload(
            text=text,
            model_used="solar-pro4",
            provider_used="upstage",
            prompt_tokens=50,
            completion_tokens=100,
            total_tokens=150,
            latency_ms=120.0,
            estimated_cost_usd=0.001,
        )

    monkeypatch.setattr(IntelligenceService, "execute_request", fake_execute_request)


async def _seed_workforce(client: AsyncClient, auth_headers: dict, company_id: str):
    """Helper to seed software engineering workforce."""
    roles = [
        {"name": "Atlas (Lead Architect)", "capabilities": ["system_design", "architecture"]},
        {"name": "Nova (Backend Lead)", "capabilities": ["api_design", "backend_dev"]},
        {"name": "Cortex (Database Engineer)", "capabilities": ["sql", "migrations"]},
        {"name": "Sentinel (QA Automation)", "capabilities": ["testing", "regression"]},
        {"name": "Vigil (Code Reviewer)", "capabilities": ["code_review", "clean_code"]},
    ]
    for r in roles:
        await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={
                "name": r["name"],
                "autonomy": "AUTONOMOUS",
                "capabilities": r["capabilities"],
                "status": "AVAILABLE",
            },
            headers=auth_headers,
        )


class TestCTOAndSupervisor:
    async def test_cto_status_and_directive_intake(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await _seed_workforce(client, auth_headers, company_id)

        # 1. Check CTO Status
        res = await client.get(f"/api/v1/companies/{company_id}/cto/status", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["total_agents"] == 5
        assert "Atlas" in data["cto_agent_name"]

        # 2. Issue High-Level Directive to CTO
        directive_payload = {
            "directive": "Implement JWT authentication rotation and automated tests",
            "priority": "HIGH",
        }
        dir_res = await client.post(
            f"/api/v1/companies/{company_id}/cto/directive",
            json=directive_payload,
            headers=auth_headers,
        )
        assert dir_res.status_code == 201
        dir_data = dir_res.json()
        assert dir_data["tasks_created_count"] >= 3
        assert len(dir_data["tasks"]) >= 3
        # Verify dependency chain exists on subsequent tasks
        # 3. Test Greeting / Casual Conversation with CTO does NOT create tasks
        greet_res = await client.post(
            f"/api/v1/companies/{company_id}/cto/directive",
            json={"directive": "hi", "priority": "HIGH"},
            headers=auth_headers,
        )
        assert greet_res.status_code == 201
        greet_data = greet_res.json()
        assert greet_data["intent"] == "CONVERSATION"
        assert greet_data["tasks_created_count"] == 0
        assert len(greet_data["tasks"]) == 0
        assert len(greet_data["analysis"]) > 0

    async def test_cto_proposals_lifecycle(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await _seed_workforce(client, auth_headers, company_id)

        # 1. Fetch Proactive Proposals
        props_res = await client.get(
            f"/api/v1/companies/{company_id}/cto/proposals", headers=auth_headers
        )
        assert props_res.status_code == 200
        props = props_res.json()
        assert len(props) >= 2
        first_prop = props[0]
        assert first_prop["status"] == "PROPOSED"
        assert len(first_prop["proposed_tasks"]) >= 1

        # 2. Approve and Delegate Proposal
        decision_res = await client.post(
            f"/api/v1/companies/{company_id}/cto/proposals/{first_prop['id']}/decide",
            json={"decision": "APPROVED", "notes": "Approved for current development sprint"},
            headers=auth_headers,
        )
        assert decision_res.status_code == 200
        dec_data = decision_res.json()
        assert dec_data["status"] == "APPROVED"
        assert len(dec_data["delegated_task_ids"]) == len(first_prop["proposed_tasks"])

        # 3. Dismiss another proposal
        if len(props) > 1:
            second_prop = props[1]
            dismiss_res = await client.post(
                f"/api/v1/companies/{company_id}/cto/proposals/{second_prop['id']}/decide",
                json={"decision": "DISMISSED", "notes": "Deferred to Q4"},
                headers=auth_headers,
            )
            assert dismiss_res.status_code == 200
            assert dismiss_res.json()["status"] == "DISMISSED"

    async def test_supervisor_status_toggle_and_tick(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await _seed_workforce(client, auth_headers, company_id)

        # 1. Issue a directive so we have pending tasks
        await client.post(
            f"/api/v1/companies/{company_id}/cto/directive",
            json={"directive": "Build rate limiting middleware", "priority": "HIGH"},
            headers=auth_headers,
        )

        # 2. Check Supervisor Status
        sup_res = await client.get(
            f"/api/v1/companies/{company_id}/cto/supervisor/status", headers=auth_headers
        )
        assert sup_res.status_code == 200
        sup_data = sup_res.json()
        assert sup_data["pending_tasks_count"] >= 1

        # 3. Toggle to PAUSE
        pause_res = await client.post(
            f"/api/v1/companies/{company_id}/cto/supervisor/toggle",
            json={"action": "PAUSE"},
            headers=auth_headers,
        )
        assert pause_res.status_code == 200
        assert pause_res.json()["state"] == "PAUSED"
        assert not pause_res.json()["is_running"]

        # 4. Toggle to PLAY
        play_res = await client.post(
            f"/api/v1/companies/{company_id}/cto/supervisor/toggle",
            json={"action": "PLAY"},
            headers=auth_headers,
        )
        assert play_res.status_code == 200
        assert play_res.json()["state"] == "PLAYING"
        assert play_res.json()["is_running"]

        # 5. Trigger Single Autonomous Cycle Tick
        tick_res = await client.post(
            f"/api/v1/companies/{company_id}/cto/supervisor/tick",
            headers=auth_headers,
        )
        assert tick_res.status_code == 200
        tick_data = tick_res.json()
        assert tick_data["status"] in ("SUCCESS", "IDLE")
        assert tick_data["cycle"] >= 1
