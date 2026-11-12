"""Comprehensive tests for project and task auto-seeding across first setup and blueprint instantiation."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestProjectsAndTasksSeeding:
    async def test_software_development_company_instantiation_seeds_projects_and_tasks(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Verify instantiating the Software Development Company blueprint provisions 3 projects and 13 assigned tasks."""
        instantiate_req = {
            "company_name": "Synthetix Autonomous Dev Labs",
        }
        res = await client.post(
            "/api/v1/blueprints/software_development_company/instantiate",
            json=instantiate_req,
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        company_id = data["company_id"]

        assert data["projects_created"] == 3
        assert data["tasks_created"] == 13
        assert data["agents_created"] == 13

        # 1. Verify projects list
        proj_res = await client.get(
            f"/api/v1/companies/{company_id}/projects",
            headers=auth_headers,
        )
        assert proj_res.status_code == 200
        projects = proj_res.json()
        assert len(projects) == 3

        project_names = {p["name"] for p in projects}
        assert "Core Platform Architecture & API Gateway Mesh" in project_names
        assert "Autonomous Web & Desktop Command Cockpit" in project_names
        assert "Continuous Delivery & Swarm Orchestration" in project_names

        # 2. Verify agents list to cross-check task assignments
        agents_res = await client.get(
            f"/api/v1/companies/{company_id}/agents",
            headers=auth_headers,
        )
        assert agents_res.status_code == 200
        agents = agents_res.json()
        agent_id_to_name = {a["id"]: a["name"] for a in agents}
        assert len(agents) == 13

        # 3. Verify all 13 tasks across the 3 projects
        total_tasks = []
        for p in projects:
            tasks_res = await client.get(
                f"/api/v1/companies/{company_id}/projects/{p['id']}/tasks",
                headers=auth_headers,
            )
            assert tasks_res.status_code == 200
            p_tasks = tasks_res.json()
            total_tasks.extend(p_tasks)

        assert len(total_tasks) == 13

        # Check every task has an assigned agent from the 11 coding agents
        assigned_agent_names = set()
        for t in total_tasks:
            assert t["assigned_agent_id"] is not None
            assert t["assigned_agent_id"] in agent_id_to_name
            assigned_agent_names.add(agent_id_to_name[t["assigned_agent_id"]])
            assert t["status"] in ["PENDING", "IN_PROGRESS", "COMPLETED"]
            assert t["priority"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            assert t["title"] is not None
            assert len(t["title"]) > 0

        # All 13 agents must have at least one assigned task
        expected_agent_names = {
            "Autonomous CTO Agent",
            "Product Spec Agent",
            "Lead Architect Agent",
            "Scrum Master Agent",
            "Backend Engineer Agent",
            "Frontend Engineer Agent",
            "Database Engineer Agent",
            "Code Reviewer Agent",
            "Security Sentinel Agent",
            "QA Automation Agent",
            "SRE Guard Agent",
            "DevOps Release Agent",
            "Technical Writer Agent",
        }
        assert assigned_agent_names == expected_agent_names

    async def test_ensure_default_projects_for_empty_company_is_idempotent(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Verify querying projects for an empty company auto-seeds 3 default projects and does not duplicate on repeat."""
        company_id = company_via_api["id"]

        # First fetch: company currently has 0 projects, should auto-seed
        first_res = await client.get(
            f"/api/v1/companies/{company_id}/projects",
            headers=auth_headers,
        )
        assert first_res.status_code == 200
        first_projects = first_res.json()
        assert len(first_projects) == 3

        # Second fetch: verify idempotency, must still return the same 3 projects
        second_res = await client.get(
            f"/api/v1/companies/{company_id}/projects",
            headers=auth_headers,
        )
        assert second_res.status_code == 200
        second_projects = second_res.json()
        assert len(second_projects) == 3

        first_ids = {p["id"] for p in first_projects}
        second_ids = {p["id"] for p in second_projects}
        assert first_ids == second_ids
