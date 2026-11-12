"""Tests for Parallel Worker Dispatch Pool in ContinuousSupervisor."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_parallel_worker_dispatch_pool(
    client: AsyncClient, auth_headers: dict, company_via_api: dict
):
    company_id = company_via_api["id"]

    # 1. Create two distinct agents
    a1_res = await client.post(
        f"/api/v1/companies/{company_id}/agents",
        json={
            "name": "Worker Alpha",
            "autonomy": "AUTONOMOUS",
            "capabilities": ["code_generation"],
            "status": "AVAILABLE",
        },
        headers=auth_headers,
    )
    assert a1_res.status_code == 201
    agent_1_id = a1_res.json()["id"]

    a2_res = await client.post(
        f"/api/v1/companies/{company_id}/agents",
        json={
            "name": "Worker Beta",
            "autonomy": "AUTONOMOUS",
            "capabilities": ["qa_testing"],
            "status": "AVAILABLE",
        },
        headers=auth_headers,
    )
    assert a2_res.status_code == 201
    agent_2_id = a2_res.json()["id"]

    # 2. Create a project
    proj_res = await client.post(
        f"/api/v1/companies/{company_id}/projects",
        json={"name": "Parallel Engine Verification", "status": "ACTIVE"},
        headers=auth_headers,
    )
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    # 3. Create two independent tasks assigned to agent 1 and agent 2
    t1_res = await client.post(
        f"/api/v1/companies/{company_id}/projects/{proj_id}/tasks",
        json={
            "title": "Task One - Generate Middleware",
            "description": "Generate token bucket rate limiter middleware",
            "assigned_agent_id": agent_1_id,
            "priority": "HIGH",
            "dependencies": [],
        },
        headers=auth_headers,
    )
    assert t1_res.status_code == 201

    t2_res = await client.post(
        f"/api/v1/companies/{company_id}/projects/{proj_id}/tasks",
        json={
            "title": "Task Two - Verify Schema Isolation",
            "description": "Run schema isolation integrity checks",
            "assigned_agent_id": agent_2_id,
            "priority": "HIGH",
            "dependencies": [],
        },
        headers=auth_headers,
    )
    assert t2_res.status_code == 201

    # 4. Trigger single cycle tick
    tick_res = await client.post(
        f"/api/v1/companies/{company_id}/cto/supervisor/tick",
        headers=auth_headers,
    )
    assert tick_res.status_code == 200
    data = tick_res.json()

    # 5. Verify both tasks executed concurrently in parallel dispatch pool
    assert data["status"] == "SUCCESS"
    assert len(data["executed_tasks"]) == 2
    executed_titles = [t["title"] for t in data["executed_tasks"]]
    assert "Task One - Generate Middleware" in executed_titles
    assert "Task Two - Verify Schema Isolation" in executed_titles
