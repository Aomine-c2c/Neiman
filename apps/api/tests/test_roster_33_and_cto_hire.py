"""Tests for the 22-agent core roster, 33-agent company cap, and CTO hiring / Hermes proxy."""

import pytest
from httpx import AsyncClient

from nexora.domains.agents.identity_files import load_identity_documents
from nexora.domains.agents.service import AgentService

CORE_22_SLUGS = [
    "cto_agent",
    "cpo_agent",
    "coo_agent",
    "lead_architect_agent",
    "product_spec_agent",
    "ui_ux_designer_agent",
    "research_intel_agent",
    "engineering_lead_agent",
    "backend_engineer_agent",
    "frontend_engineer_agent",
    "database_engineer_agent",
    "ai_ml_engineer_agent",
    "qa_lead_agent",
    "qa_automation_agent",
    "security_sentinel_agent",
    "sre_guard_agent",
    "devops_release_agent",
    "code_reviewer_agent",
    "scrum_master_agent",
    "technical_writer_agent",
    "knowledge_eval_agent",
    "growth_bd_agent",
]


def test_all_22_core_agents_have_soul_and_skills():
    assert len(CORE_22_SLUGS) == 22
    for slug in CORE_22_SLUGS:
        soul, soul_path, skills, skills_path = load_identity_documents(slug)
        assert soul, f"Missing soul.md for {slug}"
        assert skills, f"Missing SKILLS.md for {slug}"
        assert soul_path is not None
        assert skills_path is not None
        if slug == "code_reviewer_agent":
            assert soul.lstrip().startswith("# SOUL SPECIFICATION:")


@pytest.mark.asyncio
async def test_33_agent_cap_and_cto_hire_flows(
    client: AsyncClient, auth_headers: dict, company_via_api: dict
):
    company_id = company_via_api["id"]
    assert AgentService.MAX_COMPANY_AGENTS == 33

    # 1. CTO hires an external Hermes proxy autonomously
    hermes_resp = await client.post(
        f"/api/v1/companies/{company_id}/cto/hire",
        json={
            "name": "Hermes Contractor 1",
            "role_title": "External Research & Code Contractor",
            "slug": "hermes_contractor_1",
            "hire_type": "external",
            "external_runtime": "hermes",
            "capabilities": ["code_generation", "reasoning"],
            "mcp_servers": ["filesystem", "git"],
            "worktree_scope": "worktree/hermes-1",
        },
        headers=auth_headers,
    )
    assert hermes_resp.status_code == 201, hermes_resp.text
    h_data = hermes_resp.json()
    assert h_data["status"] == "AVAILABLE"
    assert h_data["requires_ceo_approval"] is False
    assert h_data["security_lead_auto_audit"] is True

    # 2. CTO proposes a permanent internal hire (requires CEO 1-click approval -> PAUSED)
    perm_resp = await client.post(
        f"/api/v1/companies/{company_id}/cto/hire",
        json={
            "name": "Customer Ops Agent",
            "role_title": "Customer Operations & Support Triage",
            "slug": "customer_ops_agent",
            "hire_type": "permanent",
            "capabilities": ["issue_triage_and_repro"],
        },
        headers=auth_headers,
    )
    assert perm_resp.status_code == 201, perm_resp.text
    p_data = perm_resp.json()
    assert p_data["status"] == "PAUSED"
    assert p_data["requires_ceo_approval"] is True

    # 3. Fill remaining slots up to 33, then verify 34th is rejected
    agents_list = await client.get(f"/api/v1/companies/{company_id}/agents", headers=auth_headers)
    current_count = len(agents_list.json())
    for i in range(current_count, 33):
        r = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": f"Slot Filler {i}"},
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text

    overflow = await client.post(
        f"/api/v1/companies/{company_id}/agents",
        json={"name": "Overflow Agent 34"},
        headers=auth_headers,
    )
    assert overflow.status_code in (400, 409, 422), overflow.text
