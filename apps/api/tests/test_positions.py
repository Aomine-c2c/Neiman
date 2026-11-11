"""
Comprehensive Test Suite for NEIMAN Organizational Positions & Governance Foundation.

Validates:
1. Exact 13 canonical positions loading with all 5 substantive documents (SOUL, SKILLS, RESPONSIBILITIES, PERMISSIONS, EVALUATION).
2. Schema validation, SHA-256 content hashing, and version change history.
3. Policy inheritance from shared Company Constitution and Governance Policies.
4. CEO position human-only invariant (autonomous agents strictly forbidden).
5. Runtime permission enforcer: deny-by-default, prohibited actions, autonomy ceilings, and approval gating.
6. REST API endpoint contracts.
"""

import uuid

import pytest
from httpx import AsyncClient

from nexora.core.enums import MembershipRole
from nexora.domains.positions.enforcer import (
    RuntimePositionPermissionEnforcer,
)
from nexora.domains.positions.loader import (
    CANONICAL_POSITIONS,
    PositionLoader,
)
from nexora.domains.positions.schemas import (
    PositionDefinition,
    RuntimeActionRequest,
)
from nexora.exceptions import PermissionDeniedError


class TestPositionLoadingAndSchema:
    def test_canonical_positions_count(self):
        """Proves exactly 13 canonical positions exist."""
        assert len(CANONICAL_POSITIONS) == 13
        expected = {
            "ceo",
            "coo",
            "cto",
            "cpo",
            "software_architect",
            "engineering_lead",
            "ui_ux_design_lead",
            "qa_verification_lead",
            "devops_infrastructure_lead",
            "security_governance_lead",
            "research_intelligence_lead",
            "business_development_growth_lead",
            "knowledge_evaluation_evolution_lead",
        }
        assert set(CANONICAL_POSITIONS) == expected

    def test_load_all_positions_schema_validity(self):
        """Proves all 13 positions load with non-empty documents, valid schemas, and SHA-256 hashes."""
        loader = PositionLoader()
        positions = loader.load_all_positions()
        assert len(positions) == 13

        for key, pos in positions.items():
            assert isinstance(pos, PositionDefinition)
            assert pos.position_key == key
            assert len(pos.title) > 0
            assert len(pos.department) > 0

            # Verify all 5 documents are non-empty
            assert len(pos.soul_markdown) > 50, f"SOUL.md too short for {key}"
            assert len(pos.skills_markdown) > 50, f"SKILLS.md too short for {key}"
            assert len(pos.responsibilities_markdown) > 50, f"RESPONSIBILITIES.md too short for {key}"
            assert len(pos.permissions_markdown) > 50, f"PERMISSIONS.md too short for {key}"
            assert len(pos.evaluation_markdown) > 50, f"EVALUATION.md too short for {key}"

            # Verify hashes
            assert len(pos.content_hashes) == 5
            for fname, h in pos.content_hashes.items():
                assert len(h) == 64, f"Hash for {fname} in {key} is invalid SHA-256"
            assert len(pos.composite_hash) == 64

            # Verify structured permissions
            assert isinstance(pos.permissions.allowed_tools, list)
            assert isinstance(pos.permissions.denied_tools, list)
            assert isinstance(pos.permissions.allowed_actions, list)
            assert isinstance(pos.permissions.denied_actions, list)
            assert 0 <= pos.permissions.max_autonomy_level <= 5

    def test_change_history_tracking(self):
        """Proves position loads record change history and audit digests."""
        loader = PositionLoader()
        loader.load_all_positions()
        history = loader.get_change_history()
        assert len(history) >= 13
        assert all("composite_hash" in h for h in history)
        assert all("position_key" in h for h in history)


class TestCompanyConstitutionAndInheritance:
    def test_load_constitution(self):
        """Proves shared Company Constitution loads with mission, ethics, and prohibited red lines."""
        loader = PositionLoader()
        const = loader.load_company_constitution()
        assert "autonomous" in const.mission.lower()
        assert len(const.values) >= 5
        assert len(const.prohibited_actions) >= 7
        assert "ACTION_EXFILTRATE_DATA" in const.prohibited_actions
        assert "ACTION_DROP_PRODUCTION_DATABASE" in const.prohibited_actions
        assert "ACTION_AUTONOMOUS_CEO_ASSUMPTION" in const.prohibited_actions
        assert len(const.approval_requirements) >= 5
        assert len(const.content_hash) == 64

    def test_policy_inheritance_cascades_prohibitions(self):
        """Proves positions inherit company constitution prohibited actions into their denied actions."""
        loader = PositionLoader()
        pos = loader.load_position("engineering_lead")
        # Should have inherited company prohibitions
        assert "ACTION_EXFILTRATE_DATA" in pos.permissions.denied_actions
        assert "ACTION_DROP_PRODUCTION_DATABASE" in pos.permissions.denied_actions
        assert "ACTION_TAMPER_AUDIT_LOGS" in pos.permissions.denied_actions

    def test_non_human_positions_capped_at_level_4(self):
        """Proves non-human positions cannot exceed the Level 4 autonomy ceiling."""
        loader = PositionLoader()
        positions = loader.load_all_positions()
        for key, pos in positions.items():
            if not pos.is_human_only:
                assert pos.permissions.max_autonomy_level <= 4, f"{key} exceeds Level 4 ceiling"


class TestCEOPositionHumanOnlyInvariant:
    def test_ceo_is_human_only(self):
        """Proves CEO position has is_human_only=True and reports to None."""
        loader = PositionLoader()
        ceo = loader.load_position("ceo")
        assert ceo.is_human_only is True
        assert ceo.reports_to is None
        assert ceo.permissions.max_autonomy_level == 5

    def test_enforcer_rejects_agent_assignment_to_ceo(self):
        """Proves enforcer strictly rejects assigning an AI agent to the CEO position."""
        enforcer = RuntimePositionPermissionEnforcer()
        valid, reason = enforcer.verify_position_assignment("ceo", is_human=False)
        assert valid is False
        assert "strictly reserved for the human owner" in reason

        with pytest.raises(PermissionDeniedError) as exc_info:
            enforcer.assert_position_assignment("ceo", is_human=False)
        assert "strictly reserved for the human owner" in str(exc_info.value)

    def test_enforcer_rejects_non_owner_human_as_ceo(self):
        """Proves enforcer rejects a non-owner human from assuming CEO."""
        enforcer = RuntimePositionPermissionEnforcer()
        valid, reason = enforcer.verify_position_assignment(
            "ceo", is_human=True, membership_role=MembershipRole.MEMBER
        )
        assert valid is False
        assert "Only the company owner" in reason

    def test_enforcer_accepts_human_owner_as_ceo(self):
        """Proves enforcer accepts a human with OWNER role as CEO."""
        enforcer = RuntimePositionPermissionEnforcer()
        valid, reason = enforcer.verify_position_assignment(
            "ceo", is_human=True, membership_role=MembershipRole.OWNER
        )
        assert valid is True
        assert reason is None


class TestRuntimePermissionEnforcer:
    def test_autonomous_ceo_usurpation_blocked(self):
        """Proves enforcer blocks autonomous agents attempting to execute actions as CEO."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="ceo",
            actor_is_human=False,
            action_name="AUTHORIZE_BUDGET",
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is False
        assert "Autonomous agents are forbidden" in res.reason
        assert res.matched_policy_clause == "ACTION_AUTONOMOUS_CEO_ASSUMPTION"

    def test_company_prohibited_action_blocked(self):
        """Proves enforcer blocks actions violating Company Constitution red lines."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="engineering_lead",
            actor_is_human=False,
            action_name="ACTION_EXFILTRATE_DATA",
            tool_name="git_worktree_create_and_manage",
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is False
        assert "Company Constitution Violation" in res.reason

    def test_destructive_database_pattern_blocked(self):
        """Proves enforcer blocks actions matching dangerous DB destruction patterns."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="software_architect",
            actor_is_human=False,
            action_name="RUN_MIGRATION",
            tool_name="alembic_migration_generate_and_test",
            target_resource="drop table users cascade",
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is False
        assert "prohibited pattern" in res.reason.lower()

    def test_deny_by_default_undeclared_tool_blocked(self):
        """Proves enforcer blocks tools not explicitly granted to the position."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="engineering_lead",
            actor_is_human=False,
            action_name="MINE_CRYPTO",
            tool_name="unauthorized_crypto_mining_daemon",
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is False
        assert "Least Privilege Violation" in res.reason

    def test_explicitly_denied_tool_blocked(self):
        """Proves enforcer blocks tools specifically denied for a position."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="coo",
            actor_is_human=False,
            action_name="PUSH_CODE",
            tool_name="codebase_direct_push",
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is False
        assert "explicitly denied" in res.reason

    def test_autonomy_ceiling_exceeded_blocked(self):
        """Proves enforcer blocks requests exceeding the position's maximum autonomy level."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="engineering_lead",
            actor_is_human=False,
            action_name="WRITE_CODE",
            tool_name="codebase_file_write_and_edit",
            declared_autonomy_level=5,  # Ceiling is 3
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is False
        assert "exceeds position ceiling" in res.reason

    def test_high_risk_approval_required(self):
        """Proves operations flagged for human approval return requires_human_approval=True."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="devops_infrastructure_lead",
            actor_is_human=False,
            action_name="DEPLOY_PRODUCTION",
            tool_name="docker_build_and_package",
            target_resource="Executing production deployment",
            declared_autonomy_level=3,
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is True
        assert res.requires_human_approval is True
        assert "Requires explicit human approval" in res.reason

    def test_fully_authorized_action_permitted(self):
        """Proves legitimate, bounded tool calls within policy are authorized."""
        enforcer = RuntimePositionPermissionEnforcer()
        req = RuntimeActionRequest(
            company_id=uuid.uuid4(),
            position_key="engineering_lead",
            actor_is_human=False,
            action_name="WRITE_CODE",
            tool_name="codebase_file_write_and_edit",
            declared_autonomy_level=3,
        )
        res = enforcer.authorize_action(req)
        assert res.permitted is True
        assert res.requires_human_approval is False
        assert "fully authorized" in res.reason
        assert len(res.audit_signature) == 64


@pytest.mark.asyncio
class TestPositionsAPIEndpoints:
    async def test_list_positions_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Proves GET /positions returns all 13 positions."""
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/positions", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 13
        keys = {p["position_key"] for p in data}
        assert "ceo" in keys
        assert "cto" in keys
        assert "software_architect" in keys
        assert "knowledge_evaluation_evolution_lead" in keys

    async def test_get_single_position_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Proves GET /positions/{key} returns detailed definition and documents."""
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/positions/cto", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["position_key"] == "cto"
        assert data["title"] == "Chief Technology Officer"
        assert len(data["soul_markdown"]) > 0
        assert len(data["skills_markdown"]) > 0
        assert len(data["responsibilities_markdown"]) > 0
        assert len(data["permissions_markdown"]) > 0
        assert len(data["evaluation_markdown"]) > 0

    async def test_get_shared_constitution_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Proves GET /positions/constitution/shared returns corporate constitution."""
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/positions/constitution/shared",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["mission"]) > 0
        assert "ACTION_EXFILTRATE_DATA" in data["prohibited_actions"]

    async def test_get_shared_policies_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Proves GET /positions/policies/shared returns corporate governance policies."""
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/positions/policies/shared",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "escalation_matrix" in data
        assert data["escalation_matrix"]["cto"] == "ceo"

    async def test_get_change_history_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Proves GET /positions/history/changes returns cryptographic hashes audit trail."""
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/positions/history/changes",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 13
        assert all("composite_hash" in h for h in data)

    async def test_evaluate_action_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Proves POST /positions/evaluate-action runs runtime permission evaluation."""
        company_id = company_via_api["id"]
        # Legitimate action
        eval_resp = await client.post(
            f"/api/v1/companies/{company_id}/positions/evaluate-action",
            json={
                "company_id": str(company_id),
                "position_key": "engineering_lead",
                "actor_is_human": False,
                "action_name": "WRITE_CODE",
                "tool_name": "codebase_file_write_and_edit",
                "declared_autonomy_level": 3,
            },
            headers=auth_headers,
        )
        assert eval_resp.status_code == 200
        data = eval_resp.json()
        assert data["permitted"] is True
        assert len(data["audit_signature"]) == 64

        # Blocked action
        blocked_resp = await client.post(
            f"/api/v1/companies/{company_id}/positions/evaluate-action",
            json={
                "company_id": str(company_id),
                "position_key": "engineering_lead",
                "actor_is_human": False,
                "action_name": "ACTION_DROP_PRODUCTION_DATABASE",
                "tool_name": "git_worktree_create_and_manage",
            },
            headers=auth_headers,
        )
        assert blocked_resp.status_code == 200
        blocked_data = blocked_resp.json()
        assert blocked_data["permitted"] is False
        assert "Constitution Violation" in blocked_data["reason"]

    async def test_assign_position_endpoint_enforces_ceo_human_only(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Proves POST /positions/{key}/assign rejects assigning an agent as CEO."""
        company_id = company_via_api["id"]
        fake_agent_id = str(uuid.uuid4())

        # Attempt to assign agent as CEO -> Must be rejected (403)
        bad_resp = await client.post(
            f"/api/v1/companies/{company_id}/positions/ceo/assign",
            json={"is_human": False, "agent_id": fake_agent_id},
            headers=auth_headers,
        )
        assert bad_resp.status_code == 403
        err_msg = bad_resp.json().get("message", bad_resp.json().get("detail", ""))
        assert "strictly reserved for the human owner" in err_msg

        # Assigning human owner as CEO -> Must succeed (200)
        good_resp = await client.post(
            f"/api/v1/companies/{company_id}/positions/ceo/assign",
            json={"is_human": True},
            headers=auth_headers,
        )
        assert good_resp.status_code == 200
        data = good_resp.json()
        assert data["position_key"] == "ceo"
        assert data["actor_type"] == "HUMAN"
