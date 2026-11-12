"""Comprehensive tests for the Multi-Agent Organizational Platform."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAgentBasics:
    async def test_create_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={
                "name": "Research Agent",
                "autonomy": "SUPERVISED",
                "capabilities": ["web_search", "summarize"],
                "system_instructions": "You are a research assistant.",
                "intelligence_config": {
                    "provider": "openai",
                    "model": "gpt-4o",
                    "temperature": 0.3,
                },
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Research Agent"
        assert data["autonomy"] == "SUPERVISED"
        assert "web_search" in data["capabilities"]
        assert data["status"] in ("CREATED", "CONFIGURED", "AVAILABLE")

    async def test_list_agents(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await client.post(
            f"/api/v1/companies/{company_id}/agents", json={"name": "Agent A"}, headers=auth_headers
        )
        await client.post(
            f"/api/v1/companies/{company_id}/agents", json={"name": "Agent B"}, headers=auth_headers
        )
        resp = await client.get(f"/api/v1/companies/{company_id}/agents", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Original"},
            headers=auth_headers,
        )
        agent_id = create.json()["id"]
        resp = await client.patch(
            f"/api/v1/companies/{company_id}/agents/{agent_id}",
            json={"autonomy": "AUTONOMOUS", "name": "Updated"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["autonomy"] == "AUTONOMOUS"
        assert resp.json()["name"] == "Updated"

    async def test_delete_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "ToDelete"},
            headers=auth_headers,
        )
        agent_id = create.json()["id"]
        del_resp = await client.delete(
            f"/api/v1/companies/{company_id}/agents/{agent_id}", headers=auth_headers
        )
        assert del_resp.status_code == 204
        get_resp = await client.get(
            f"/api/v1/companies/{company_id}/agents/{agent_id}", headers=auth_headers
        )
        assert get_resp.status_code == 404

    async def test_agent_not_found(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = await client.get(
            f"/api/v1/companies/{company_id}/agents/{fake_id}", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_agent_default_autonomy(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Default Agent"},
            headers=auth_headers,
        )
        assert resp.json()["autonomy"] == "SUPERVISED"

    async def test_agent_identity_config(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={
                "name": "Persona Agent",
                "identity": {
                    "tone": "friendly",
                    "style": "creative",
                    "expertise_areas": ["marketing", "copywriting"],
                },
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["identity"]["tone"] == "friendly"


class TestAgentLifecycle:
    async def test_lifecycle_transitions(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # 1. Create -> CREATED
        res = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Lifecycle Agent"},
            headers=auth_headers,
        )
        agent_id = res.json()["id"]
        assert res.json()["status"] == "CREATED"

        # 2. Transition CREATED -> CONFIGURED
        t1 = await client.post(
            f"/api/v1/companies/{company_id}/agents/{agent_id}/transition",
            json={"status": "CONFIGURED", "reason": "Configured tools and system prompt"},
            headers=auth_headers,
        )
        assert t1.status_code == 200
        assert t1.json()["status"] == "CONFIGURED"

        # 3. Transition CONFIGURED -> AVAILABLE
        t2 = await client.post(
            f"/api/v1/companies/{company_id}/agents/{agent_id}/transition",
            json={"status": "AVAILABLE", "reason": "Ready for assignment"},
            headers=auth_headers,
        )
        assert t2.status_code == 200
        assert t2.json()["status"] == "AVAILABLE"

        # 4. Transition AVAILABLE -> PAUSED
        t3 = await client.post(
            f"/api/v1/companies/{company_id}/agents/{agent_id}/transition",
            json={"status": "PAUSED", "reason": "Maintenance window"},
            headers=auth_headers,
        )
        assert t3.status_code == 200
        assert t3.json()["status"] == "PAUSED"

        # 5. Invalid transition: PAUSED directly to WORKING should be rejected
        inv = await client.post(
            f"/api/v1/companies/{company_id}/agents/{agent_id}/transition",
            json={"status": "WORKING"},
            headers=auth_headers,
        )
        assert inv.status_code == 400


class TestAgentHierarchyAndCollaboration:
    async def test_manager_subordinate_hierarchy(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Create Manager Agent
        mgr_resp = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Lead Architect Agent"},
            headers=auth_headers,
        )
        mgr_id = mgr_resp.json()["id"]

        # Create Worker Agent reporting to Manager Agent
        worker_resp = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Frontend Worker Agent", "manager_agent_id": mgr_id},
            headers=auth_headers,
        )
        assert worker_resp.status_code == 201
        assert worker_resp.json()["manager_agent_id"] == mgr_id

        # Profile check should reflect hierarchy
        profile = await client.get(
            f"/api/v1/companies/{company_id}/agents/{worker_resp.json()['id']}/profile",
            headers=auth_headers,
        )
        assert profile.status_code == 200
        assert profile.json()["manager_name"] == "Lead Architect Agent"

    async def test_cannot_be_own_manager(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        agent = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Self Manager Attempt"},
            headers=auth_headers,
        )
        aid = agent.json()["id"]
        resp = await client.patch(
            f"/api/v1/companies/{company_id}/agents/{aid}",
            json={"manager_agent_id": aid},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_task_delegation(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        mgr = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "PM Agent"},
            headers=auth_headers,
        )
        sub = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Coder Agent"},
            headers=auth_headers,
        )

        # Create project and task
        proj = await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={"name": "Nexus Launch"},
            headers=auth_headers,
        )
        task = await client.post(
            f"/api/v1/companies/{company_id}/projects/{proj.json()['id']}/tasks",
            json={"title": "Implement auth middleware"},
            headers=auth_headers,
        )

        del_resp = await client.post(
            f"/api/v1/companies/{company_id}/agents/{mgr.json()['id']}/delegate",
            params={
                "to_agent_id": sub.json()["id"],
                "task_id": task.json()["id"],
                "instructions": "Implement standard Bearer token verification.",
            },
            headers=auth_headers,
        )
        assert del_resp.status_code == 200
        msg = del_resp.json()
        assert msg["message_type"] == "DELEGATION"
        assert "Implement auth middleware" in msg["subject"]

    async def test_problem_escalation(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        mgr = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Director Agent"},
            headers=auth_headers,
        )
        worker = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Junior Agent", "manager_agent_id": mgr.json()["id"]},
            headers=auth_headers,
        )

        esc = await client.post(
            f"/api/v1/companies/{company_id}/agents/{worker.json()['id']}/escalate",
            params={"problem": "Database schema locked by migration process"},
            headers=auth_headers,
        )
        assert esc.status_code == 200
        data = esc.json()
        assert data["message_type"] == "ESCALATION"
        assert data["to_agent_id"] == mgr.json()["id"]

        # Worker agent should now be in BLOCKED state
        w_curr = await client.get(
            f"/api/v1/companies/{company_id}/agents/{worker.json()['id']}", headers=auth_headers
        )
        assert w_curr.json()["status"] == "BLOCKED"


class TestAgentExecutionLifecycleAndAudits:
    async def test_10_step_execution_lifecycle(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Setup agent with tools and permissions
        agent = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={
                "name": "Full Lifecycle Worker",
                "capabilities": ["code_generation", "unit_test"],
                "permissions": {"allowed_tools": ["unit_test"]},
                "tools": [{"name": "unit_test", "description": "Runs test suites"}],
                "resource_limits": {"max_daily_budget_usd": 15.0},
            },
            headers=auth_headers,
        )
        aid = agent.json()["id"]
        # Transition to AVAILABLE
        await client.post(
            f"/api/v1/companies/{company_id}/agents/{aid}/transition",
            json={"status": "AVAILABLE"},
            headers=auth_headers,
        )

        proj = await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={"name": "Test Exec Suite"},
            headers=auth_headers,
        )
        task = await client.post(
            f"/api/v1/companies/{company_id}/projects/{proj.json()['id']}/tasks",
            json={"title": "Run test suite", "expected_outcome": "All tests pass"},
            headers=auth_headers,
        )

        exec_resp = await client.post(
            f"/api/v1/companies/{company_id}/agents/{aid}/execute",
            json={"task_id": task.json()["id"]},
            headers=auth_headers,
        )
        assert exec_resp.status_code == 200
        result = exec_resp.json()
        assert result["final_status"] == "SUCCESS"
        assert len(result["steps"]) == 10

        steps_order = [s["step"] for s in result["steps"]]
        expected_steps = [
            "TASK_RECEIVED",
            "CONTEXT_ASSEMBLY",
            "PLAN",
            "RESOURCE_CHECK",
            "INTELLIGENCE_SELECTION",
            "TOOL_EXECUTION",
            "RESULT",
            "VALIDATION",
            "REPORT",
            "MEMORY_UPDATE",
        ]
        assert steps_order == expected_steps

        # Verify audits were stored
        audits_resp = await client.get(
            f"/api/v1/companies/{company_id}/agents/{aid}/audits", headers=auth_headers
        )
        assert audits_resp.status_code == 200
        assert len(audits_resp.json()) >= 10

    async def test_task_execution_truncated_fails_and_remains_pending(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Test that truncated/limit reached tasks are never marked COMPLETED and revert to PENDING."""
        company_id = company_via_api["id"]

        agent = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={
                "name": "Limit Tester",
                "capabilities": ["reasoning"],
                "intelligence_config": {"provider": "openai", "model": "gpt-4o"},
            },
            headers=auth_headers,
        )
        aid = agent.json()["id"]
        await client.patch(
            f"/api/v1/companies/{company_id}/agents/{aid}",
            json={"status": "AVAILABLE"},
            headers=auth_headers,
        )

        proj = await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={"name": "Failover Project"},
            headers=auth_headers,
        )
        task = await client.post(
            f"/api/v1/companies/{company_id}/projects/{proj.json()['id']}/tasks",
            json={"title": "Exhaustive Simulation Task", "expected_outcome": "Complete analysis"},
            headers=auth_headers,
        )
        tid = task.json()["id"]

        # Simulate execution failure / truncation by simulating rate limit / error
        exec_resp = await client.post(
            f"/api/v1/companies/{company_id}/agents/{aid}/execute",
            json={
                "task_id": tid,
                "input_data": {
                    "simulation_flags": {
                        "openai": "rate_limit",
                        "anthropic": "rate_limit",
                        "google_gemini": "rate_limit",
                        "local": "rate_limit",
                        "poolside": "rate_limit",
                        "arcee": "rate_limit",
                        "xiaomimimo": "rate_limit",
                        "minimax": "rate_limit",
                        "upstage": "rate_limit",
                    }
                },
            },
            headers=auth_headers,
        )
        # Execution must fail (e.g. 400 or 500)
        assert exec_resp.status_code in (400, 422, 500)

        # Crucial Rule: Task MUST NOT be marked COMPLETED. It must be in PENDING awaiting refresh!
        task_check = await client.get(
            f"/api/v1/companies/{company_id}/projects/{proj.json()['id']}/tasks/{tid}",
            headers=auth_headers,
        )
        assert task_check.status_code == 200
        assert task_check.json()["status"] == "PENDING"


    async def test_memory_persistence(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        agent = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Memory Agent"},
            headers=auth_headers,
        )
        aid = agent.json()["id"]

        mem_resp = await client.post(
            f"/api/v1/companies/{company_id}/agents/{aid}/memories",
            json={
                "memory_type": "semantic",
                "key": "company_mission",
                "content": "NEIMAN is building the autonomous organization OS.",
                "importance": 3.0,
            },
            headers=auth_headers,
        )
        assert mem_resp.status_code == 201
        assert mem_resp.json()["key"] == "company_mission"

        list_resp = await client.get(
            f"/api/v1/companies/{company_id}/agents/{aid}/memories", headers=auth_headers
        )
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

    async def test_documentation_specialist_agent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """
        Verify the Documentation Specialist Agent:
        1. Automatically instantiates the DocuForge-Arch agent & role in Engineering
        2. Generates machine-optimized markdown references for coding agents
        3. Updates files on disk and syncs knowledge base memory
        """
        company_id = company_via_api["id"]

        gen_resp = await client.post(
            f"/api/v1/companies/{company_id}/agents/docs/generate?commit_to_disk=true",
            headers=auth_headers,
        )
        assert gen_resp.status_code == 200
        report = gen_resp.json()
        assert report["status"] == "SUCCESS"
        assert report["agent_name"] == "DocuForge-Arch"
        assert len(report["sections"]) >= 3
        assert report["total_tokens_generated"] > 0
        assert any("AGENTS_REFERENCE.md" in f for f in report["files_updated"])

        # Check agent was created in the company
        agents_resp = await client.get(
            f"/api/v1/companies/{company_id}/agents", headers=auth_headers
        )
        assert agents_resp.status_code == 200
        agent_names = [a["name"] for a in agents_resp.json()]
        assert "DocuForge-Arch" in agent_names
