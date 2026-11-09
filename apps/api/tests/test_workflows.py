"""Tests for the Workflows domain."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestWorkflows:
    async def test_create_workflow_draft(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows",
            json={
                "name": "Onboarding Workflow",
                "trigger_type": "MANUAL",
                "steps": [
                    {"id": "step1", "type": "agent_run", "name": "Welcome Email", "config": {}},
                    {
                        "id": "step2",
                        "type": "human_approval",
                        "name": "Manager Review",
                        "config": {},
                    },
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Onboarding Workflow"
        assert data["status"] == "DRAFT"
        assert len(data["steps"]) == 2

    async def test_cannot_activate_empty_workflow(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/workflows",
            json={"name": "Empty Workflow"},
            headers=auth_headers,
        )
        workflow_id = create.json()["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/{workflow_id}/activate",
            headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_activate_workflow_with_steps(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/workflows",
            json={
                "name": "Ready Workflow",
                "steps": [{"id": "s1", "type": "agent_run", "name": "Do work"}],
            },
            headers=auth_headers,
        )
        workflow_id = create.json()["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/{workflow_id}/activate",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ACTIVE"

    async def test_trigger_and_observe_canonical_pipeline(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/workflows",
            json={
                "name": "Software Requirement Pipeline",
                "trigger_type": "MANUAL",
                "steps": [
                    {
                        "id": "step1",
                        "type": "AGENT",
                        "name": "Product Agent Analyzes",
                        "config": {"agent": "Product Agent"},
                    },
                    {
                        "id": "step2",
                        "type": "PARALLEL",
                        "name": "Engineers Implement",
                        "config": {"tasks": [{"name": "Backend"}, {"name": "Frontend"}]},
                    },
                    {
                        "id": "step3",
                        "type": "TOOL",
                        "name": "QA Tests",
                        "config": {"tool_name": "pytest_runner"},
                    },
                    {
                        "id": "step4",
                        "type": "APPROVAL",
                        "name": "CTO Deployment Gate",
                        "config": {"risk_level": "HIGH"},
                    },
                ],
            },
            headers=auth_headers,
        )
        assert create.status_code == 201
        workflow_id = create.json()["id"]

        # Trigger execution
        exec_resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/{workflow_id}/execute",
            json={
                "title": "Feature Requirement Run #1",
                "input_payload": {"spec": "User audit logging"},
            },
            headers=auth_headers,
        )
        assert exec_resp.status_code == 201
        exec_data = exec_resp.json()
        assert exec_data["title"] == "Feature Requirement Run #1"
        assert exec_data["total_steps"] == 4
        # Since step4 is an APPROVAL gate, execution should pause at step4
        assert exec_data["status"] == "WAITING_APPROVAL"
        assert exec_data["current_step_id"] == "step4"
        assert exec_data["pending_approval_id"] is not None
        assert len(exec_data["step_records"]) >= 4

        # Verify step provenance
        step_names = [sr["step_name"] for sr in exec_data["step_records"]]
        assert "Product Agent Analyzes" in step_names
        assert "Engineers Implement" in step_names
        assert "QA Tests" in step_names
        assert "CTO Deployment Gate" in step_names

    async def test_programmatic_seo_page_factory_execution(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # List workflows — The Programmatic SEO Page Factory is auto-seeded
        list_resp = await client.get(
            f"/api/v1/companies/{company_id}/workflows",
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        workflows = list_resp.json()
        seo_wf = next((w for w in workflows if w["name"] == "The Programmatic SEO Page Factory"), None)
        assert seo_wf is not None
        assert len(seo_wf["steps"]) == 6
        assert seo_wf["status"] == "ACTIVE"

        # Verify components & skills presence
        step_skills = [s.get("config", {}).get("skill") for s in seo_wf["steps"] if s.get("type") in ("AGENT", "SKILL")]
        assert "programmatic-seo" in step_skills
        assert "content-research-writer" in step_skills
        assert "schema" in step_skills

        step_tools = [s.get("config", {}).get("tool_name") for s in seo_wf["steps"] if s.get("type") == "TOOL"]
        assert "firecrawl_scrape_page" in step_tools
        assert "sanity_mutate_document" in step_tools
        assert "gsc_inspect_url" in step_tools

        # Trigger execution of The Programmatic SEO Page Factory
        exec_resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/{seo_wf['id']}/execute",
            json={
                "title": "Programmatic SEO Batch Run #101",
                "input_payload": {
                    "target_niche": "Headless CMS Performance Benchmarks",
                    "domain": "https://example.com",
                },
            },
            headers=auth_headers,
        )
        assert exec_resp.status_code == 201
        data = exec_resp.json()
        assert data["total_steps"] == 6
        assert data["status"] == "COMPLETED"
        assert len(data["step_records"]) == 6
        for rec in data["step_records"]:
            assert rec["status"] == "COMPLETED"
