"""
Tests for NEIMAN's Organizational Governance Layer.

Covers:
- Company Constitution (mission, values, operating principles, prohibited actions, approval requirements, security/financial/data rules, autonomy boundaries, escalation rules)
- 6-tier Autonomy Levels (LEVEL 0 - OBSERVE to LEVEL 5 - ADAPTIVE) configurable per company, dept, role, agent, tool, action
- High-risk operations requiring explicit human approval gate
- Consequential Action Audit Viewer (actor, authority, timestamp, action, target, reason, result, autonomy level)
- Escalation Tracking and Resolution
- Prohibited action enforcement (blocking violating actions)
"""

import uuid

import pytest
from httpx import AsyncClient

from nexora.core.enums import GovernanceAutonomyLevel


class TestOrganizationalGovernance:
    @pytest.mark.asyncio
    async def test_get_and_seed_company_constitution(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # View constitution - automatically creates baseline charter
        res = await client.get(
            f"/api/v1/companies/{company_id}/governance/constitution", headers=auth_headers
        )
        assert res.status_code == 200
        const = res.json()
        assert const["mission"]
        assert len(const["values"]) >= 3
        assert len(const["operating_principles"]) >= 3
        assert len(const["prohibited_actions"]) >= 3
        assert len(const["approval_requirements"]) >= 3
        assert len(const["security_rules"]) >= 2
        assert len(const["financial_rules"]) >= 2
        assert len(const["data_rules"]) >= 2
        assert "financial" in const["autonomy_boundaries"]
        assert len(const["escalation_rules"]) >= 1

    @pytest.mark.asyncio
    async def test_autonomy_matrix_and_action_evaluation_levels(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # 1. Evaluate normal allowed action (LEVEL 3 default within policy)
        normal_eval_req = {
            "actor_name": "Senior Analytics Agent",
            "actor_type": "AGENT",
            "action_name": "RUN_DATA_ANALYSIS",
            "target": "CustomerCohortTable",
            "reason": "Quarterly retention metrics computation for executive dashboard",
            "declared_risk_level": "LOW",
        }
        res = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json=normal_eval_req,
            headers=auth_headers,
        )
        assert res.status_code == 200
        eval_data = res.json()
        assert eval_data["allowed"] is True
        assert eval_data["requires_approval"] is False
        assert eval_data["effective_autonomy_level"] == GovernanceAutonomyLevel.LEVEL_3.value

        # 2. Evaluate high-risk operation requiring explicit approval (LEVEL 2)
        high_risk_req = {
            "actor_name": "Finance Ops Agent",
            "actor_type": "AGENT",
            "task_type": "financial",
            "action_name": "EXECUTE_CREDIT_PAYMENT",
            "target": "PaymentGateway:Stripe",
            "reason": "SaaS infrastructure invoice disbursement $1,250",
            "declared_risk_level": "HIGH",
        }
        res_hr = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json=high_risk_req,
            headers=auth_headers,
        )
        assert res_hr.status_code == 200
        hr_data = res_hr.json()
        assert hr_data["allowed"] is False
        assert hr_data["requires_approval"] is True
        assert hr_data["approval_request_id"] is not None

        # 3. Evaluate Constitutionally Prohibited Action (Blocked at Level 0)
        prohibited_req = {
            "actor_name": "Rogue Agent",
            "actor_type": "AGENT",
            "action_name": "EXFILTRATION_DATA",
            "target": "ExternalDropServer",
            "reason": "Exfiltration of sensitive customer data outside authorized boundaries",
            "declared_risk_level": "CRITICAL",
        }
        res_prob = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json=prohibited_req,
            headers=auth_headers,
        )
        assert res_prob.status_code == 200
        prob_data = res_prob.json()
        assert prob_data["allowed"] is False
        assert prob_data["is_prohibited"] is True
        assert prob_data["effective_autonomy_level"] == GovernanceAutonomyLevel.LEVEL_0.value
        assert "prohibited" in prob_data["reason"].lower()

    @pytest.mark.asyncio
    async def test_approval_request_lifecycle_and_decision(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # Trigger high risk payment action requiring approval
        eval_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json={
                "actor_name": "Billing Agent",
                "action_name": "TRANSFER_FUNDS",
                "target": "VendorWireTransfer",
                "reason": "Annual server contract renewal",
                "declared_risk_level": "HIGH",
            },
            headers=auth_headers,
        )
        app_id = eval_res.json()["approval_request_id"]
        assert app_id is not None

        # List pending approvals
        list_res = await client.get(
            f"/api/v1/companies/{company_id}/governance/approvals?status=PENDING",
            headers=auth_headers,
        )
        assert list_res.status_code == 200
        pending_list = list_res.json()
        assert any(a["id"] == app_id for a in pending_list)

        # Inspect approval diff and blast radius
        diff_res = await client.get(
            f"/api/v1/companies/{company_id}/governance/approvals/{app_id}/diff",
            headers=auth_headers,
        )
        assert diff_res.status_code == 200
        diff_data = diff_res.json()
        assert diff_data["approval_id"] == app_id
        assert "diff" in diff_data
        assert "ast_safety" in diff_data
        assert "blast_radius" in diff_data
        assert diff_data["ast_safety"]["status"] == "PASSED"

        # Human Reviewer approves the request
        decide_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/approvals/{app_id}/decision",
            json={
                "decision": "APPROVED",
                "reviewer_notes": "Contract verified with finance leadership.",
            },
            headers=auth_headers,
        )
        assert decide_res.status_code == 200
        decided = decide_res.json()
        assert decided["status"] == "APPROVED"
        assert decided["reviewer_notes"] == "Contract verified with finance leadership."
        assert decided["resolved_at"] is not None

    @pytest.mark.asyncio
    async def test_consequential_action_audit_viewer(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """
        Verify that every consequential action records:
        actor, authority, timestamp, action, target, reason, result, and autonomy_level.
        """
        company_id = company_via_api["id"]

        # Record explicit consequential action
        audit_payload = {
            "actor_name": "DevOps Automation Agent",
            "actor_type": "AGENT",
            "authority": "role:INFRA_ENGINEER",
            "action": "PROMOTE_RELEASE_CONTAINER",
            "target": "k8s-cluster/prod-workloads",
            "reason": "Deployment of approved patch v2.4.1 passing all integration tests",
            "result": "SUCCESS",
            "autonomy_level": 3,
            "risk_level": "MEDIUM",
            "details": {"image_digest": "sha256:abc12345", "verified_checks": 14},
        }

        create_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/audits",
            json=audit_payload,
            headers=auth_headers,
        )
        assert create_res.status_code == 201
        created = create_res.json()
        assert created["actor_name"] == "DevOps Automation Agent"
        assert created["authority"] == "role:INFRA_ENGINEER"
        assert created["action"] == "PROMOTE_RELEASE_CONTAINER"
        assert created["target"] == "k8s-cluster/prod-workloads"
        assert "Deployment of approved patch" in created["reason"]
        assert created["result"] == "SUCCESS"
        assert created["autonomy_level"] == 3

        # Query audit log with filter
        query_res = await client.get(
            f"/api/v1/companies/{company_id}/governance/audits?target_q=k8s-cluster",
            headers=auth_headers,
        )
        assert query_res.status_code == 200
        records = query_res.json()
        assert len(records) >= 1
        assert any(r["target"] == "k8s-cluster/prod-workloads" for r in records)

    @pytest.mark.asyncio
    async def test_escalation_protocol(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # Agent files escalation
        esc_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/escalations",
            json={
                "reason": "Conflicting resource allocation lock",
                "description": "Agent unable to acquire reserved GPU memory slot due to concurrent high-priority job.",
                "severity": "HIGH",
                "context_data": {"conflicting_task_id": str(uuid.uuid4())},
            },
            headers=auth_headers,
        )
        assert esc_res.status_code == 201
        esc = esc_res.json()
        esc_id = esc["id"]
        assert esc["status"] == "OPEN"

        # Resolve escalation
        resolve_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/escalations/{esc_id}/resolve",
            json={
                "status": "RESOLVED",
                "resolution": "Re-queued task into secondary burst cluster slot.",
            },
            headers=auth_headers,
        )
        assert resolve_res.status_code == 200
        resolved = resolve_res.json()
        assert resolved["status"] == "RESOLVED"
        assert "secondary burst cluster" in resolved["resolution"]

    @pytest.mark.asyncio
    async def test_audit_integrity_cryptographic_verification(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Verify that every consequential audit record receives a valid HMAC signature and can be verified."""
        company_id = company_via_api["id"]

        create_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/audits",
            json={
                "actor_name": "Security Audit Bot",
                "authority": "role:SECURITY_OFFICER",
                "action": "REVOKE_API_KEY",
                "target": "vendor-key-vault/gemini-prod",
                "reason": "Routine 90-day cryptographic secret rotation",
                "result": "SUCCESS",
                "autonomy_level": 3,
                "risk_level": "MEDIUM",
                "details": {"key_id": "key-9912", "rotated": True},
            },
            headers=auth_headers,
        )
        assert create_res.status_code == 201
        audit_id = create_res.json()["id"]

        # Call verify endpoint
        verify_res = await client.get(
            f"/api/v1/companies/{company_id}/governance/audits/{audit_id}/verify",
            headers=auth_headers,
        )
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        assert verify_data["verified"] is True
        assert verify_data["signature"]

    @pytest.mark.asyncio
    async def test_approval_stale_invalidation_and_replay_prevention(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """
        Verify that:
        1. Duplicate approvals on already resolved requests are rejected (replay prevention).
        2. Stale approvals with altered parameters/payloads are invalidated and blocked.
        """
        company_id = company_via_api["id"]

        # 1. Propose action needing approval with specific payload
        eval_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json={
                "actor_name": "DevOps Agent",
                "action_name": "DROP_DATABASE_TABLE",
                "target": "prod-orders-db",
                "reason": "Decommission deprecated legacy table",
                "declared_risk_level": "CRITICAL",
                "payload": {"table": "legacy_v1_orders", "drop_cascade": False},
            },
            headers=auth_headers,
        )
        assert eval_res.status_code == 200
        app_id = eval_res.json()["approval_request_id"]
        assert app_id is not None

        # 2. Approve the specific action and payload
        decide_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/approvals/{app_id}/decision",
            json={
                "decision": "APPROVED",
                "reviewer_notes": "CEO authorized legacy table drop without cascade.",
            },
            headers=auth_headers,
        )
        assert decide_res.status_code == 200

        # 3. Replay prevention: duplicate decision on same request must fail
        dup_res = await client.post(
            f"/api/v1/companies/{company_id}/governance/approvals/{app_id}/decision",
            json={
                "decision": "APPROVED",
                "reviewer_notes": "Attempting duplicate approval replay",
            },
            headers=auth_headers,
        )
        assert dup_res.status_code in (400, 422)

        # 4. Same parameters: approved and authorized
        exec_ok = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json={
                "actor_name": "DevOps Agent",
                "action_name": "DROP_DATABASE_TABLE",
                "target": "prod-orders-db",
                "reason": "Decommission deprecated legacy table",
                "declared_risk_level": "CRITICAL",
                "payload": {"table": "legacy_v1_orders", "drop_cascade": False},
            },
            params={"approval_request_id": app_id},
            headers=auth_headers,
        )
        assert exec_ok.status_code == 200
        assert exec_ok.json()["allowed"] is True

        # 5. Stale parameter tampering: payload altered to drop cascade -> MUST BE BLOCKED
        exec_tampered = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json={
                "actor_name": "DevOps Agent",
                "action_name": "DROP_DATABASE_TABLE",
                "target": "prod-orders-db",
                "reason": "Tampered execution attempt with cascade",
                "declared_risk_level": "CRITICAL",
                "payload": {"table": "legacy_v1_orders", "drop_cascade": True},
            },
            params={"approval_request_id": app_id},
            headers=auth_headers,
        )
        assert exec_tampered.status_code == 200
        assert exec_tampered.json()["allowed"] is False
        assert exec_tampered.json()["requires_approval"] is True

    @pytest.mark.asyncio
    async def test_duplicate_pending_approval_requests_are_deduplicated(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Evaluating the exact same pending action/target twice returns the existing PENDING request instead of creating duplicates."""
        company_id = company_via_api["id"]
        req_payload = {
            "actor_name": "Autonomous Supervisor",
            "action_name": "EXECUTE_TASK",
            "target": "Task:47a638fe-8315-4351-9852-75c251c3a0b7",
            "reason": "Assigned task execution",
            "declared_risk_level": "HIGH",
        }

        res1 = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json=req_payload,
            headers=auth_headers,
        )
        res2 = await client.post(
            f"/api/v1/companies/{company_id}/governance/evaluate-action",
            json=req_payload,
            headers=auth_headers,
        )
        assert res1.status_code == 200
        assert res2.status_code == 200
        assert res1.json()["approval_request_id"] == res2.json()["approval_request_id"]

        pending_res = await client.get(
            f"/api/v1/companies/{company_id}/governance/approvals?status=PENDING",
            headers=auth_headers,
        )
        matching = [
            a
            for a in pending_res.json()
            if a["target"] == "Task:47a638fe-8315-4351-9852-75c251c3a0b7"
        ]
        assert len(matching) == 1

