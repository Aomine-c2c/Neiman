"""
Comprehensive pytest test suite for NEIMAN Company Blueprints and 'Build My Company'.

Covers:
- Auto-seeding of all 10 core organizational blueprints:
  1. Software Development Company
  2. Forex Trading Company
  3. Marketing Agency
  4. Social Media Company
  5. Cybersecurity Company
  6. Research Organization
  7. E-commerce Company
  8. Game Studio
  9. IT Services Company
  10. Education Organization
- Blueprint customization before activation
- Blueprint Duplication, Export (JSON), and Import (JSON)
- Instantiating a blueprint into a live, fully-populated operational Company:
  (Company, DNA, Departments, OrgRoles, Autonomous Agents, Workflows, Policies, Constitution, Governance)
- Saving an existing running company as a reusable template
- 'Build My Company':
  Natural language synthesis generating a proposed blueprint with departments, agents, workflows,
  operating cost estimate, risks identified, and missing capabilities without immediate activation.
- Approving and instantiating the synthesized company proposal.
"""

import uuid

import pytest
from httpx import AsyncClient


class TestCompanyBlueprints:
    @pytest.mark.asyncio
    async def test_list_and_seed_10_system_blueprints(
        self, client: AsyncClient, auth_headers: dict
    ):
        res = await client.get("/api/v1/blueprints", headers=auth_headers)
        assert res.status_code == 200
        bps = res.json()
        assert len(bps) >= 10

        keys = {b["key"] for b in bps}
        expected_keys = [
            "software_development_company",
            "forex_trading_company",
            "marketing_agency",
            "social_media_company",
            "cybersecurity_company",
            "research_organization",
            "ecommerce_company",
            "game_studio",
            "it_services_company",
            "education_organization",
        ]
        for ek in expected_keys:
            assert ek in keys, f"Missing system blueprint: {ek}"

        # Check detail of one blueprint (e.g. software_development_company)
        sw_bp = next(b for b in bps if b["key"] == "software_development_company")
        assert len(sw_bp["departments"]) >= 3
        assert len(sw_bp["roles"]) >= 3
        assert len(sw_bp["agents"]) >= 3
        assert len(sw_bp["workflows"]) >= 1
        assert len(sw_bp["policies"]) >= 1
        assert sw_bp["constitution"]["mission"]
        assert sw_bp["default_autonomy"] == 3
        assert sw_bp["estimated_monthly_cost_usd"] >= 0

    @pytest.mark.asyncio
    async def test_blueprint_customization_duplicate_export_import(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Fetch blueprint
        res = await client.get("/api/v1/blueprints/marketing_agency", headers=auth_headers)
        assert res.status_code == 200
        bp = res.json()
        bp_id = bp["id"]

        # 2. Duplicate blueprint
        dup_res = await client.post(f"/api/v1/blueprints/{bp_id}/duplicate", headers=auth_headers)
        assert dup_res.status_code == 201
        duplicated = dup_res.json()
        assert "(Copy)" in duplicated["name"]
        dup_id = duplicated["id"]

        # 3. Customize duplicated blueprint before activation
        custom_name = "HyperScale AI Marketing"
        patch_res = await client.patch(
            f"/api/v1/blueprints/{dup_id}",
            json={"name": custom_name, "default_autonomy": 4},
            headers=auth_headers,
        )
        assert patch_res.status_code == 200
        patched = patch_res.json()
        assert patched["name"] == custom_name
        assert patched["default_autonomy"] == 4

        # 4. Export blueprint JSON
        export_res = await client.get(f"/api/v1/blueprints/{dup_id}/export", headers=auth_headers)
        assert export_res.status_code == 200
        exported = export_res.json()
        assert exported["name"] == custom_name

        # 5. Import blueprint JSON
        exported["key"] = f"imported-custom-{uuid.uuid4().hex[:6]}"
        exported["name"] = "Imported Scale Marketing"
        import_res = await client.post(
            "/api/v1/blueprints/import", json=exported, headers=auth_headers
        )
        assert import_res.status_code == 201
        imported = import_res.json()
        assert imported["name"] == "Imported Scale Marketing"

    @pytest.mark.asyncio
    async def test_instantiate_blueprint_into_real_company(
        self, client: AsyncClient, auth_headers: dict
    ):
        """
        Instantiate Cybersecurity Company blueprint and verify that real database records are created:
        Company, DNA, Departments, OrgRoles, Employee Agents, Workflows, Policies, Constitution, and Governance.
        """
        req_payload = {
            "company_name": "CyberShield Autonomous Defense",
        }
        res = await client.post(
            "/api/v1/blueprints/cybersecurity_company/instantiate",
            json=req_payload,
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        company_id = data["company_id"]
        assert data["company_name"] == "CyberShield Autonomous Defense"
        assert data["departments_created"] >= 3
        assert data["roles_created"] >= 3
        assert data["agents_created"] >= 3
        assert data["workflows_created"] >= 1
        assert data["policies_created"] >= 1
        assert data["constitution_established"] is True

        # Verify agents can be listed via agent domain
        agent_res = await client.get(f"/api/v1/companies/{company_id}/agents", headers=auth_headers)
        assert agent_res.status_code == 200
        agents = agent_res.json()
        assert len(agents) >= 3
        agent_names = {a["name"] for a in agents}
        assert "Threat Hunter Agent" in agent_names
        assert "SOC Analyst Agent" in agent_names

        # Verify company constitution is active
        const_res = await client.get(
            f"/api/v1/companies/{company_id}/governance/constitution", headers=auth_headers
        )
        assert const_res.status_code == 200
        const = const_res.json()
        assert const["mission"]
        assert len(const["security_rules"]) >= 1

    @pytest.mark.asyncio
    async def test_save_company_as_template(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        save_req = {
            "company_id": company_id,
            "template_key": f"template-NEIMAN-{uuid.uuid4().hex[:6]}",
            "template_name": "Nexora Enterprise Standard Template",
            "description": "Harvested baseline company template for fast cloning",
            "category": "Technology",
        }
        res = await client.post(
            "/api/v1/blueprints/save-template", json=save_req, headers=auth_headers
        )
        assert res.status_code == 201
        tpl = res.json()
        assert tpl["key"] == save_req["template_key"]
        assert tpl["name"] == "Nexora Enterprise Standard Template"

    @pytest.mark.asyncio
    async def test_build_my_company_natural_language_synthesis_and_approval(
        self, client: AsyncClient, auth_headers: dict
    ):
        """
        Tests the complete natural-language organization generator workflow:
        USER DESCRIPTION
        -> REQUIREMENT ANALYSIS
        -> INDUSTRY IDENTIFICATION
        -> ORGANIZATIONAL DESIGN
        -> DEPARTMENT GENERATION
        -> ROLE GENERATION
        -> AGENT GENERATION
        -> WORKFLOW GENERATION
        -> POLICY GENERATION
        -> RESOURCE MODEL
        -> INTELLIGENCE REQUIREMENTS
        -> RISK ANALYSIS
        -> COMPANY BLUEPRINT

        Then:
        - Modify everything (user customizes mission, agents, workflows, budget)
        - SIMULATE (dry run controlled benchmark)
        - REVIEW (audit results & metrics)
        - APPROVE & INSTANTIATE (never silently activates without explicit user confirmation)
        """
        # User prompt from request
        prompt = "I want to create a software company that builds agricultural management systems for small farmers in Africa."

        # 1. Synthesis Request
        res = await client.post(
            "/api/v1/blueprints/build-my-company",
            json={
                "description": prompt,
                "target_budget_monthly_usd": 250.0,
                "preferred_autonomy_level": 3,
            },
            headers=auth_headers,
        )
        assert res.status_code == 201
        proposal = res.json()
        proposal_id = proposal["id"]
        assert proposal["status"] == "PROPOSED"
        assert proposal["instantiated_company_id"] is None

        # Verify 12-step stages are tracked
        stages = proposal["generation_stages"]
        assert "user_description" in stages
        assert "requirement_analysis" in stages
        assert "industry_identification" in stages
        assert "agricultural" in stages["industry_identification"].lower()
        assert "department_generation" in stages
        assert "role_generation" in stages
        assert "agent_generation" in stages
        assert "workflow_generation" in stages
        assert "policy_generation" in stages
        assert "resource_model" in stages
        assert "intelligence_requirements" in stages
        assert "risk_analysis" in stages

        # Verify displayed items
        bp = proposal["proposed_blueprint"]
        assert "Agri" in bp["name"]
        assert bp["company_definition"]["mission"]
        assert len(bp["departments"]) >= 3
        assert len(bp["roles"]) >= 3
        assert len(bp["agents"]) >= 3
        assert len(bp["workflows"]) >= 2
        assert len(bp["policies"]) >= 2
        assert "intelligence_requirements" in bp
        assert "resource_policies" in bp
        assert proposal["estimated_operational_complexity"] in ["LOW", "MODERATE", "HIGH"]
        assert len(proposal["risks_identified"]) >= 1
        assert len(proposal["human_approval_requirements"]) >= 1

        # 2. USER MODIFIES EVERYTHING (e.g. adjusts mission, budget, and adds an agent responsibility)
        bp_modified = dict(bp)
        bp_modified["name"] = "AgriSila Pan-Africa Technologies"
        bp_modified["company_definition"]["mission"] = (
            "Scaling food security and fair-trade market access for 500k smallholders."
        )

        patch_res = await client.patch(
            f"/api/v1/blueprints/build-my-company/{proposal_id}",
            json={
                "proposed_blueprint": bp_modified,
                "target_budget_monthly_usd": 300.0,
                "preferred_autonomy_level": 4,
            },
            headers=auth_headers,
        )
        assert patch_res.status_code == 200
        patched_data = patch_res.json()
        assert patched_data["proposed_blueprint"]["name"] == "AgriSila Pan-Africa Technologies"
        assert patched_data["estimated_operating_cost"]["total_monthly_usd"] == 300.0

        # 3. SIMULATE (Runs a controlled dry-run benchmark against the proposed organization)
        sim_res = await client.post(
            f"/api/v1/blueprints/build-my-company/{proposal_id}/simulate",
            json={"test_workload_size": 25, "concurrency_level": 5},
            headers=auth_headers,
        )
        assert sim_res.status_code == 200
        sim_data = sim_res.json()
        assert sim_data["status"] == "SIMULATED"
        sim_results = sim_data["simulation_results"]
        assert sim_results["test_workload_size"] == 25
        assert sim_results["simulated_tasks_succeeded"] >= 24
        assert "EXPERIMENTAL SIMULATION RESULTS" in sim_results["dry_run_disclaimer"]

        # 4. REVIEW -> APPROVE -> INSTANTIATE
        inst_res = await client.post(
            f"/api/v1/blueprints/build-my-company/{proposal_id}/instantiate",
            json={
                "approved_by": "Founder & Managing Director",
                "confirmation_statement": "I have reviewed the synthesized organizational design, simulation results, policies, and risks.",
                "custom_company_name": "AgriSila Pan-Africa Technologies",
            },
            headers=auth_headers,
        )
        assert inst_res.status_code == 201
        inst_data = inst_res.json()
        assert inst_data["company_name"] == "AgriSila Pan-Africa Technologies"
        assert inst_data["agents_created"] >= 3
        assert inst_data["status"] == "INSTANTIATED"

        # Verify proposal marked INSTANTIATED with reference to created company
        check_prop = await client.get(
            f"/api/v1/blueprints/build-my-company/{proposal_id}", headers=auth_headers
        )
        assert check_prop.status_code == 200
        assert check_prop.json()["status"] == "INSTANTIATED"
        assert check_prop.json()["instantiated_company_id"] == inst_data["company_id"]
