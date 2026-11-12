"""
Tests for the NEIMAN Resource Engine.
Covers:
- Pools and finite capacity tracking (COMPUTE, INTELLIGENCE, FINANCIAL, OPERATIONAL)
- Budgets and expenditure caps
- Multi-dimensional Request evaluation (APPROVE, DENY, DEFER, REDUCE, QUEUE)
- Priorities (CRITICAL, HIGH, NORMAL, LOW, BACKGROUND)
- Active allocations and releasing capacity
- Usage recording distinguishing OBSERVED vs ESTIMATED real telemetry
- Resource Control Center aggregation and non-faked host OS telemetry
"""

import pytest
from httpx import AsyncClient


class TestResourceEngine:
    @pytest.mark.asyncio
    async def test_auto_seed_and_list_pools(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # Initial list triggers default seeder
        res = await client.get(
            f"/api/v1/companies/{company_id}/resources/pools", headers=auth_headers
        )
        assert res.status_code == 200
        pools = res.json()
        assert len(pools) >= 5

        categories = {p["category"] for p in pools}
        assert "COMPUTE" in categories
        assert "INTELLIGENCE" in categories
        assert "OPERATIONAL" in categories

    @pytest.mark.asyncio
    async def test_create_and_manage_budget(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        budget_payload = {
            "name": "Q3 Model Inference & Cloud Budget",
            "fiscal_period": "Q3",
            "total_budget_usd": 5000.0,
            "total_token_allowance": 25_000_000,
            "alert_threshold_percent": 80.0,
        }
        res = await client.post(
            f"/api/v1/companies/{company_id}/resources/budgets",
            json=budget_payload,
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Q3 Model Inference & Cloud Budget"
        assert data["total_budget_usd"] == 5000.0
        assert data["spent_budget_usd"] == 0.0
        assert data["is_exhausted"] is False

    @pytest.mark.asyncio
    async def test_resource_request_approval_flow(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Standard valid request within limits must be APPROVED with allocations committed."""
        company_id = company_via_api["id"]

        req_payload = {
            "priority": "NORMAL",
            "justification": "Run large research analysis.",
            "requested_compute": {
                "cpu_cores": 4.0,
                "ram_gb": 8.0,
                "gpu_required": False,
                "storage_gb": 10.0,
            },
            "requested_intelligence": {
                "tokens": 200_000,
                "api_requests": 15,
                "max_inference_cost_usd": 2.0,
            },
            "requested_operational": {
                "runtime_minutes": 30.0,
                "slots_needed": 1,
            },
            "expected_value_score": 7.0,
        }

        res = await client.post(
            f"/api/v1/companies/{company_id}/resources/requests",
            json=req_payload,
            headers=auth_headers,
        )
        assert res.status_code == 201
        result = res.json()
        assert result["evaluation"]["decision"] == "APPROVE"
        assert result["request"]["decision"] == "APPROVE"

        # Verify active allocations exist
        allocs_res = await client.get(
            f"/api/v1/companies/{company_id}/resources/allocations?status=ACTIVE",
            headers=auth_headers,
        )
        assert allocs_res.status_code == 200
        allocations = allocs_res.json()
        assert len(allocations) > 0

    @pytest.mark.asyncio
    async def test_resource_request_reduction_under_load(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """High priority request under constrained compute capacity gets REDUCED."""
        company_id = company_via_api["id"]

        # Request exceeding default pool (32 cores) with HIGH priority and high ROI
        req_payload = {
            "priority": "HIGH",
            "justification": "Urgent deep neural simulation requiring massive compute.",
            "requested_compute": {
                "cpu_cores": 64.0,  # exceeds available 32
                "ram_gb": 128.0,
            },
            "requested_intelligence": {
                "tokens": 500_000,
                "max_inference_cost_usd": 5.0,
            },
            "requested_operational": {
                "runtime_minutes": 60.0,
                "slots_needed": 1,
            },
            "expected_value_score": 8.5,
        }

        res = await client.post(
            f"/api/v1/companies/{company_id}/resources/requests",
            json=req_payload,
            headers=auth_headers,
        )
        assert res.status_code == 201
        result = res.json()
        assert result["evaluation"]["decision"] == "REDUCE"
        assert result["evaluation"]["adjusted_compute"]["cpu_cores"] == 32.0

    @pytest.mark.asyncio
    async def test_resource_request_defer_or_queue_for_low_priority(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Low/Background request under contention gets QUEUED or DENIED."""
        company_id = company_via_api["id"]

        # Background task with low expected value
        req_payload = {
            "priority": "BACKGROUND",
            "justification": "Routine scraping archive indexing.",
            "requested_compute": {
                "cpu_cores": 48.0,
            },
            "requested_intelligence": {
                "tokens": 50_000,
                "max_inference_cost_usd": 1.0,
            },
            "requested_operational": {
                "runtime_minutes": 10.0,
                "slots_needed": 1,
            },
            "expected_value_score": 2.0,  # Low ROI
        }

        res = await client.post(
            f"/api/v1/companies/{company_id}/resources/requests",
            json=req_payload,
            headers=auth_headers,
        )
        assert res.status_code == 201
        result = res.json()
        assert result["evaluation"]["decision"] == "DENY"

    @pytest.mark.asyncio
    async def test_release_allocation(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Releasing an allocation frees capacity in the pool."""
        company_id = company_via_api["id"]

        # Create request to get allocation
        req_res = await client.post(
            f"/api/v1/companies/{company_id}/resources/requests",
            json={
                "priority": "NORMAL",
                "justification": "Temp allocation for batch.",
                "requested_compute": {"cpu_cores": 2.0},
                "requested_intelligence": {"tokens": 10_000},
                "requested_operational": {"slots_needed": 1},
                "expected_value_score": 5.0,
            },
            headers=auth_headers,
        )
        assert req_res.status_code == 201

        allocs_res = await client.get(
            f"/api/v1/companies/{company_id}/resources/allocations?status=ACTIVE",
            headers=auth_headers,
        )
        allocations = allocs_res.json()
        target_alloc = allocations[0]

        # Release
        rel_res = await client.post(
            f"/api/v1/companies/{company_id}/resources/allocations/{target_alloc['id']}/release",
            json={"reason": "Finished batch run"},
            headers=auth_headers,
        )
        assert rel_res.status_code == 200
        assert rel_res.json()["status"] == "RELEASED"

    @pytest.mark.asyncio
    async def test_record_observed_telemetry_usage(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Track observed telemetry vs estimated telemetry."""
        company_id = company_via_api["id"]

        # Create request first to get valid allocation
        await client.post(
            f"/api/v1/companies/{company_id}/resources/requests",
            json={
                "priority": "NORMAL",
                "justification": "Task telemetry telemetry run",
                "requested_compute": {"cpu_cores": 1.0},
                "requested_intelligence": {"tokens": 5000},
                "requested_operational": {"slots_needed": 1},
                "expected_value_score": 6.0,
            },
            headers=auth_headers,
        )
        allocs_res = await client.get(
            f"/api/v1/companies/{company_id}/resources/allocations?status=ACTIVE",
            headers=auth_headers,
        )
        target_alloc = allocs_res.json()[0]

        # Record real OBSERVED metric
        usage_res = await client.post(
            f"/api/v1/companies/{company_id}/resources/usage",
            json={
                "allocation_id": target_alloc["id"],
                "metric_state": "OBSERVED",
                "resource_type": "cpu_cores",
                "amount": 0.85,
                "unit": "cores",
                "details": {"load_sample_window_sec": 60},
            },
            headers=auth_headers,
        )
        assert usage_res.status_code == 201
        data = usage_res.json()
        assert data["metric_state"] == "OBSERVED"
        assert data["amount"] == 0.85

    @pytest.mark.asyncio
    async def test_resource_control_center_overview(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        """Control Center returns capacity, bottlenecks, host telemetry and budgets."""
        company_id = company_via_api["id"]

        res = await client.get(
            f"/api/v1/companies/{company_id}/resources/control-center",
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()

        # Check required fields
        assert "capacities" in data
        assert "budget_consumption" in data
        assert "bottlenecks" in data
        assert "expensive_tasks" in data
        assert "provider_usage" in data
        assert "system_host_telemetry" in data

        # Host telemetry must be non-faked and marked OBSERVED
        host_telemetry = data["system_host_telemetry"]
        assert host_telemetry["metric_state"] == "OBSERVED"
        assert host_telemetry["cpu_cores_available"] >= 1
