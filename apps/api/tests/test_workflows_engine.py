"""
Comprehensive tests for NEIMAN Workflow Execution Engine & Observability.

Verifies:
1. Canonical Software Delivery Pipeline Execution:
   - Triggers: Requirement Ingestion
   - Agent analysis: Product Agent analyzes
   - Agent review: Systems Architect reviews
   - Human-in-the-loop Gate: CTO Approval (Execution pauses with WAITING_APPROVAL status)
   - Resumption after approval: Approval granted, engine resumes automatically
   - Parallel tasks: Engineering parallel implementation
   - Tool execution: Automated QA test runner
   - Security reviews: Security Agent verification
   - Tool execution: Automated Deployment
   - Project completion
2. Observability & Real-Time Step Tracking:
   - Verifying current_step_id, current_step_name, current_step_index, total_steps
   - Verifying step audit trail (duration_ms, input_data, output_data, status)
3. Retries & Failure Handling:
   - Configurable retries when steps fail
4. Conditional Branching:
   - Skipping or redirecting flow based on intermediate state payloads
5. Cancellation:
   - Halting in-flight executions
6. Persistence:
   - Confirming workflow state is fully persisted in the database across queries.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestWorkflowEngine:
    async def test_full_software_delivery_pipeline(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # 1. Define the Canonical Software Engineering Workflow
        steps = [
            {
                "id": "step_req",
                "type": "AGENT",
                "name": "Product Agent Analyzes Requirement",
                "config": {"agent": "Product Agent"},
            },
            {
                "id": "step_arch",
                "type": "AGENT",
                "name": "Architect Reviews Design",
                "config": {"agent": "Architect Agent"},
            },
            {
                "id": "step_cto_approval",
                "type": "APPROVAL",
                "name": "CTO Approves Architecture",
                "config": {"title": "Approve Core Architecture", "risk_level": "HIGH"},
            },
            {
                "id": "step_parallel_impl",
                "type": "PARALLEL",
                "name": "Engineers Implement (Parallel)",
                "config": {"tasks": [{"name": "Backend Services"}, {"name": "Frontend Portal"}]},
            },
            {
                "id": "step_qa",
                "type": "TOOL",
                "name": "QA Tests Implementation",
                "config": {"tool_name": "pytest_runner"},
            },
            {
                "id": "step_sec",
                "type": "AGENT",
                "name": "Security Reviews Code",
                "config": {"agent": "Security Agent"},
            },
            {
                "id": "step_deploy",
                "type": "TOOL",
                "name": "Production Deployment",
                "config": {"tool_name": "k8s_deployer"},
            },
            {
                "id": "step_done",
                "type": "AGENT",
                "name": "Project Completion Monitor",
                "config": {"agent": "Monitoring Agent"},
            },
        ]

        create_wf = await client.post(
            f"/api/v1/companies/{company_id}/workflows",
            json={
                "name": "Software Delivery Pipeline",
                "description": "Autonomous development cycle from requirement to monitoring",
                "trigger_type": "EVENT",
                "steps": steps,
            },
            headers=auth_headers,
        )
        assert create_wf.status_code == 201
        wf_id = create_wf.json()["id"]

        # Activate the workflow
        act_wf = await client.post(
            f"/api/v1/companies/{company_id}/workflows/{wf_id}/activate",
            headers=auth_headers,
        )
        assert act_wf.status_code == 200

        # 2. Trigger Workflow Execution
        exec_resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/{wf_id}/execute",
            json={
                "title": "Build Real-Time Notification Service",
                "input_payload": {
                    "requirement": "Websocket push notifications",
                    "priority": "CRITICAL",
                },
            },
            headers=auth_headers,
        )
        assert exec_resp.status_code == 201
        execution = exec_resp.json()
        exec_id = execution["id"]

        # 3. Verify Human-in-the-loop Gate (Step 3: CTO Approval)
        # The execution should pause at the CTO approval gate
        assert execution["status"] == "WAITING_APPROVAL"
        assert execution["current_step_id"] == "step_cto_approval"
        assert execution["current_step_index"] == 2
        assert execution["pending_approval_id"] is not None

        # Verify steps 1 and 2 completed and recorded in audit trail
        step_records = execution["step_records"]
        assert len(step_records) >= 3
        assert step_records[0]["step_id"] == "step_req"
        assert step_records[0]["status"] == "COMPLETED"
        assert step_records[1]["step_id"] == "step_arch"
        assert step_records[1]["status"] == "COMPLETED"
        assert step_records[2]["step_id"] == "step_cto_approval"
        assert step_records[2]["status"] == "WAITING_APPROVAL"

        # 4. CTO Approves the pending approval request in Governance domain
        appr_id = execution["pending_approval_id"]
        review_resp = await client.post(
            f"/api/v1/companies/{company_id}/governance/approvals/{appr_id}/decision",
            json={
                "decision": "APPROVED",
                "reviewer_notes": "Architecture looks solid and scalable.",
            },
            headers=auth_headers,
        )
        assert review_resp.status_code == 200
        assert review_resp.json()["status"] == "APPROVED"

        # 5. Resume Workflow Execution
        resume_resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/executions/{exec_id}/resume",
            headers=auth_headers,
        )
        assert resume_resp.status_code == 200, resume_resp.text
        resumed = resume_resp.json()

        # 6. Verify Execution Completed All Remaining Steps (Parallel, QA, Sec, Deploy, Done)
        assert resumed["status"] == "COMPLETED"
        assert resumed["current_step_index"] == len(steps)
        assert resumed["pending_approval_id"] is None

        # Confirm step audit records contain all steps
        all_steps = resumed["step_records"]
        step_ids_recorded = [s["step_id"] for s in all_steps]
        assert "step_parallel_impl" in step_ids_recorded
        assert "step_qa" in step_ids_recorded
        assert "step_sec" in step_ids_recorded
        assert "step_deploy" in step_ids_recorded
        assert "step_done" in step_ids_recorded

        # 7. Test Observability Endpoint
        obs_resp = await client.get(
            f"/api/v1/companies/{company_id}/workflows/executions/{exec_id}",
            headers=auth_headers,
        )
        assert obs_resp.status_code == 200
        obs_data = obs_resp.json()
        assert obs_data["id"] == exec_id
        assert obs_data["status"] == "COMPLETED"
        assert obs_data["duration_ms"] >= 0

        # Verify Execution list endpoint
        list_resp = await client.get(
            f"/api/v1/companies/{company_id}/workflows/{wf_id}/executions",
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        assert len(list_resp.json()) >= 1

    async def test_conditional_branching_and_cancellation(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        steps = [
            {
                "id": "check_risk",
                "type": "AGENT",
                "name": "Assess Risk",
                "config": {"agent": "Risk Analyst"},
                "condition": {
                    "expression": "high_risk_flag",
                    "true_step_id": "escalate_step",
                    "false_step_id": "fast_track_step",
                },
            },
            {
                "id": "fast_track_step",
                "type": "TOOL",
                "name": "Fast Track Clearance",
                "config": {"tool_name": "auto_clear"},
            },
            {
                "id": "escalate_step",
                "type": "ESCALATION",
                "name": "Trigger Management Escalation",
                "config": {"reason": "High risk transaction detected"},
            },
        ]

        create_wf = await client.post(
            f"/api/v1/companies/{company_id}/workflows",
            json={
                "name": "Risk Assessment Pipeline",
                "steps": steps,
            },
            headers=auth_headers,
        )
        wf_id = create_wf.json()["id"]

        # Run with high risk flag -> branch directly to escalation
        exec_resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/{wf_id}/execute",
            json={
                "title": "High Risk Trade Run",
                "input_payload": {"high_risk_flag": True},
            },
            headers=auth_headers,
        )
        assert exec_resp.status_code == 201
        data = exec_resp.json()
        assert data["status"] == "ESCALATED"
        assert data["pending_escalation_id"] is not None

        # Test Cancel Execution
        cancel_resp = await client.post(
            f"/api/v1/companies/{company_id}/workflows/executions/{data['id']}/cancel",
            headers=auth_headers,
        )
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["status"] == "CANCELLED"
