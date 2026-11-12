"""
Tests for NEIMAN Skills & Playbooks Domain.
Verifies disk discovery, role-specific playbook binding, and custom creation.
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.main import app
from nexora.domains.agents.models import Agent
from nexora.domains.organizations.models import Company
from nexora.domains.skills.service import SkillsService, ROLE_SKILL_MAP


@pytest.mark.asyncio
async def test_list_skills_discovers_disk_playbooks(db: AsyncSession):
    service = SkillsService(db)
    skills = await service.list_skills()
    assert len(skills) >= 28
    skill_names = {s.name for s in skills}
    assert "docker-containerization" in skill_names
    assert "kubernetes-ops" in skill_names
    assert "devsecops-sentinel" in skill_names
    assert "sql-migration-audit" in skill_names

    # Verify role bindings exist on key playbooks
    sql_skill = next(s for s in skills if s.name == "sql-migration-audit")
    assert "Lead Database Engineer" in sql_skill.bound_roles


@pytest.mark.asyncio
async def test_sync_skills_to_squad(db: AsyncSession, company: Company):
    company_id = company.id

    # Seed an architect and db agent
    arch_agent = Agent(
        id=uuid.uuid4(),
        company_id=company_id,
        name="Lead System Architect",
        responsibilities=["System architecture"],
        goals=["Maintain architectural boundary purity"],
        capabilities=["code:review"],
        permissions={},
        tools=[],
        autonomy="AUTONOMOUS",
        status="AVAILABLE",
        identity={"role": "Lead System Architect"},
        intelligence_config={},
        resource_limits={},
        resource_usage={},
        performance_metadata={},
    )
    db_agent = Agent(
        id=uuid.uuid4(),
        company_id=company_id,
        name="Lead Database Engineer",
        responsibilities=["PostgreSQL optimization"],
        goals=["Reversible schema migrations"],
        capabilities=["sql:execute"],
        permissions={},
        tools=[],
        autonomy="AUTONOMOUS",
        status="AVAILABLE",
        identity={"role": "Lead Database Engineer"},
        intelligence_config={},
        resource_limits={},
        resource_usage={},
        performance_metadata={},
    )
    db.add(arch_agent)
    db.add(db_agent)
    await db.commit()

    service = SkillsService(db)
    sync_res = await service.sync_disk_skills_to_squad(company_id)

    assert sync_res.total_skills_discovered >= 28
    assert sync_res.skills_bound_to_roles > 0
    assert "Lead System Architect" in sync_res.roles_updated
    assert "Lead Database Engineer" in sync_res.roles_updated

    # Verify capabilities updated on agent
    assert any("catch-arch-rot" in cap for cap in arch_agent.capabilities)
    assert any("sql-migration-audit" in cap for cap in db_agent.capabilities)


@pytest.mark.asyncio
async def test_skills_rest_endpoints(client: AsyncClient, company: Company, auth_headers: dict[str, str]):
    # Test GET list skills
    resp = await client.get(f"/api/v1/companies/{company.id}/skills", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 28

    # Test POST sync-disk
    sync_resp = await client.post(f"/api/v1/companies/{company.id}/skills/sync-disk", headers=auth_headers)
    assert sync_resp.status_code == 200
    sync_data = sync_resp.json()
    assert "total_skills_discovered" in sync_data

    # Test POST create-custom skill
    custom_name = f"test-playbook-{uuid.uuid4().hex[:6]}"
    create_resp = await client.post(
        f"/api/v1/companies/{company.id}/skills/create-custom",
        headers=auth_headers,
        json={
            "skill_name": custom_name,
            "display_name": "Test Custom Playbook",
            "category": "Testing",
            "content": "# Test Custom Playbook\n\nProcedural test guidelines.",
            "bind_role": "QA Automation Agent",
        },
    )
    assert create_resp.status_code == 201
    custom_data = create_resp.json()
    assert custom_data["name"] == custom_name
    assert "QA Automation Agent" in custom_data["bound_roles"]
