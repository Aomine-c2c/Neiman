"""
Tests for NEIMAN Organizational Performance Tracking and Evolution Engine.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestPerformanceAndEvolutionEngine:
    async def test_performance_metrics_and_custom_kpi_lifecycle(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # 1. Record Multidimensional Performance Metrics
        metric_resp = await client.post(
            f"/api/v1/companies/{company_id}/performance/metrics",
            json={
                "dimension": "AGENT",
                "target_id": "architect-agent-01",
                "target_name": "Chief Architect Agent",
                "metric_name": "completion_rate",
                "actual_value": 98.5,
                "expected_value": 95.0,
                "unit": "%",
                "sample_size": 40,
                "evidence": {"tasks_evaluated": 40, "passed": 39},
                "notes": "Consistently exceeds target completion rates",
            },
            headers=auth_headers,
        )
        assert metric_resp.status_code == 201
        metric_data = metric_resp.json()
        assert metric_data["metric_name"] == "completion_rate"
        assert metric_data["actual_value"] == 98.5

        # 2. Define Custom KPI for the Company
        kpi_resp = await client.post(
            f"/api/v1/companies/{company_id}/performance/kpis",
            json={
                "name": "Zero-Drift Constitutional Compliance",
                "description": "Percentage of agent tool calls executing within defined policy boundaries",
                "industry": "Enterprise Software",
                "dimension": "COMPANY",
                "metric_key": "constitutional_compliance_pct",
                "target_benchmark": 99.9,
                "warning_threshold": 98.0,
                "unit": "%",
            },
            headers=auth_headers,
        )
        assert kpi_resp.status_code == 201
        kpi_data = kpi_resp.json()
        assert kpi_data["target_benchmark"] == 99.9

        # 3. Retrieve Multidimensional Evidence Summary
        summary_resp = await client.get(
            f"/api/v1/companies/{company_id}/performance/summary",
            headers=auth_headers,
        )
        assert summary_resp.status_code == 200
        summary = summary_resp.json()
        assert "dimensions" in summary
        assert "COMPANY" in summary["dimensions"]
        assert "AGENT" in summary["dimensions"]
        assert "MODEL_PROVIDER" in summary["dimensions"]
        assert "WORKFLOW" in summary["dimensions"]

    async def test_evolution_engine_lifecycle_and_rollback(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # 1. OBSERVE & PROPOSE: Create an adaptation to address provider bottleneck
        prop_resp = await client.post(
            f"/api/v1/companies/{company_id}/evolution/propose",
            json={
                "title": "Optimize Code Synthesis Model Routing",
                "adaptation_type": "CHANGE_MODEL_ROUTING",
                "trigger_diagnosis": "High token expenditure and periodic 429 rate spikes detected on sonnet-3.5 during unit test generation.",
                "evidence": [
                    {"metric": "cycle_time_ms", "observed": 3200, "target": 1500},
                    {"metric": "cost_usd", "observed": 142.50},
                ],
                "previous_state": {"model_identifier": "claude-3-5-sonnet"},
                "proposed_state": {"model_identifier": "gemini-1.5-pro"},
                "expected_improvement": "40% latency reduction and 35% cost savings without loss of test pass rate.",
                "risk_assessment": "Low risk. Fallback retains Sonnet on schema validation error.",
                "risk_level": "LOW",
            },
            headers=auth_headers,
        )
        assert prop_resp.status_code == 201
        adaptation = prop_resp.json()
        adaptation_id = adaptation["id"]
        assert adaptation["stage"] == "PROPOSE"
        assert adaptation["status"] == "PROPOSED"

        # 2. SIMULATE: Run controlled tests in the Evolution Lab
        sim_resp = await client.post(
            f"/api/v1/companies/{company_id}/evolution/adaptations/{adaptation_id}/simulate",
            json={"synthetic_task_count": 25, "stress_multiplier": 1.5},
            headers=auth_headers,
        )
        assert sim_resp.status_code == 200
        sim_data = sim_resp.json()
        assert sim_data["status"] == "VALIDATED"
        assert sim_data["stage"] == "VALIDATE"
        assert sim_data["validation_passed"] is True
        assert "cost_savings_pct" in sim_data["simulation_results"]

        # 3. APPROVE & DEPLOY: Human in loop authorizes; engine takes snapshot and activates
        app_resp = await client.post(
            f"/api/v1/companies/{company_id}/evolution/adaptations/{adaptation_id}/approve",
            json={"reviewer_notes": "Validated in Evolution Lab. Zero regressions observed."},
            headers=auth_headers,
        )
        assert app_resp.status_code == 200
        app_data = app_resp.json()
        assert app_data["status"] == "DEPLOYED"
        assert app_data["stage"] == "MONITOR"
        assert app_data["snapshot_id"] is not None

        # Verify Snapshot was created
        snaps_resp = await client.get(
            f"/api/v1/companies/{company_id}/evolution/snapshots",
            headers=auth_headers,
        )
        assert snaps_resp.status_code == 200
        assert len(snaps_resp.json()) >= 1

        # 4. ROLLBACK: Revert adaptation and record learning into Organizational Memory
        rollback_resp = await client.post(
            f"/api/v1/companies/{company_id}/evolution/adaptations/{adaptation_id}/rollback",
            json={
                "rollback_reason": "Gemini produced subtle type annotation differences in legacy TS contracts.",
                "learning_notes": "Preserve Claude for strict legacy typing tasks; route greenfield modules to Gemini.",
            },
            headers=auth_headers,
        )
        assert rollback_resp.status_code == 200
        rb_data = rollback_resp.json()
        assert rb_data["status"] == "ROLLED_BACK"
        assert rb_data["stage"] == "ROLLBACK"
        assert rb_data["learning_notes"] is not None

        # Verify learning recorded in Memory
        mem_resp = await client.get(
            f"/api/v1/companies/{company_id}/memory/search?q=Evolution",
            headers=auth_headers,
        )
        assert mem_resp.status_code == 200
        memories = mem_resp.json()
        assert len(memories) >= 1
        assert "evolution" in memories[0]["tags"]

    @pytest.mark.asyncio
    async def test_simulation_lab_workflow(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        """
        Tests the complete NEIMAN Simulation Lab lifecycle:
        1. List scenarios (seeds Simulation A, B, and C).
        2. Create a custom simulation scenario.
        3. Run controlled synthetic workload benchmark against simulated configuration.
        4. Assert comparative measurable metrics and explicit experimental disclaimer.
        5. Promote validated simulation scenario to real organization with approval.
        """
        # 1. List scenarios - should auto-seed Simulations A, B, and C
        list_resp = await client.get(
            f"/api/v1/companies/{company_id}/simulation/scenarios",
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        scenarios = list_resp.json()
        assert len(scenarios) >= 3
        scenario_names = [s["name"] for s in scenarios]
        assert any("Simulation A" in name for name in scenario_names)
        assert any("Simulation B" in name for name in scenario_names)
        assert any("Simulation C" in name for name in scenario_names)

        sim_a = next(s for s in scenarios if "Simulation A" in s["name"])
        assert sim_a["simulated_config"]["agent_count"] == 35

        # 2. Run benchmark on Simulation A
        run_resp = await client.post(
            f"/api/v1/companies/{company_id}/simulation/scenarios/{sim_a['id']}/run",
            json={
                "run_label": "High-Throughput Workload Trial",
                "workload_tasks_count": 40,
                "concurrency_level": 6,
            },
            headers=auth_headers,
        )
        assert run_resp.status_code == 200
        run_data = run_resp.json()
        assert run_data["workload_tasks_count"] == 40
        assert run_data["tasks_succeeded"] > 0
        assert "EXPERIMENTAL SIMULATION RESULTS ONLY" in run_data["experimental_disclaimer"]
        assert "deltas" in run_data["metrics_comparison"]
        assert "cost_delta_pct" in run_data["metrics_comparison"]["deltas"]

        # 3. Promote Simulation A into the live organization
        promote_resp = await client.post(
            f"/api/v1/companies/{company_id}/simulation/scenarios/{sim_a['id']}/promote",
            json={
                "approver": "Chief Operations Officer",
                "notes": "Cost-optimized routing validated via Simulation A benchmark; approved for production roll-out.",
            },
            headers=auth_headers,
        )
        assert promote_resp.status_code == 200
        promoted_data = promote_resp.json()
        assert promoted_data["is_promoted"] is True
        assert promoted_data["status"] == "PROMOTED"
        assert promoted_data["promoted_by"] == "Chief Operations Officer"

        # Verify pre-promotion snapshot was taken
        snaps_resp = await client.get(
            f"/api/v1/companies/{company_id}/evolution/snapshots",
            headers=auth_headers,
        )
        assert snaps_resp.status_code == 200
        snaps = snaps_resp.json()
        assert any("Pre-promotion safety snapshot" in s["reason"] for s in snaps)
