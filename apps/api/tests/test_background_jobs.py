"""Tests for durable background job queue, retries, stale lock recovery, and API."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.jobs.models import JobStatus
from nexora.domains.jobs.service import BackgroundJobService, register_job_handler


@pytest.mark.asyncio
async def test_job_enqueue_process_complete(db: AsyncSession):
    svc = BackgroundJobService(db)
    cid = uuid.uuid4()
    job = await svc.enqueue(
        company_id=cid,
        job_type="noop",
        payload={"msg": "hello"},
        priority=5,
    )
    assert job.status == JobStatus.PENDING.value

    processed = await svc.process_one("worker-1")
    assert processed is not None
    assert processed.id == job.id
    assert processed.status == JobStatus.COMPLETED.value
    assert processed.attempts == 1
    assert processed.result == {"ok": True, "echo": {"msg": "hello"}}
    assert processed.locked_by is None


@pytest.mark.asyncio
async def test_job_retry_and_terminal_failure(db: AsyncSession):
    async def _always_fail(_db, _job):
        raise RuntimeError("transient upstream outage")

    register_job_handler("test_always_fail", _always_fail)
    svc = BackgroundJobService(db)
    job = await svc.enqueue(job_type="test_always_fail", max_attempts=2)

    first = await svc.process_one("worker-1")
    assert first is not None
    assert first.status == JobStatus.PENDING.value
    assert first.attempts == 1
    assert "transient upstream outage" in (first.error or "")

    # Make due immediately for second attempt
    first.run_after = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
    await db.flush()

    second = await svc.process_one("worker-1")
    assert second is not None
    assert second.status == JobStatus.FAILED.value
    assert second.attempts == 2


@pytest.mark.asyncio
async def test_reclaim_stale_locks_and_cancel(db: AsyncSession):
    svc = BackgroundJobService(db)
    job = await svc.enqueue(job_type="noop", max_attempts=3)
    claimed = await svc.claim_next_job("dead-worker")
    assert claimed is not None
    assert claimed.status == JobStatus.RUNNING.value

    # Backdate lock timestamp to simulate worker crash
    claimed.locked_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=600)
    await db.flush()

    reclaimed = await svc.reclaim_stale_jobs(stale_after_seconds=300)
    assert reclaimed == 1
    await db.refresh(claimed)
    assert claimed.status == JobStatus.PENDING.value
    assert claimed.locked_by is None

    cancelled = await svc.cancel_job(claimed.id)
    assert cancelled is not None
    assert cancelled.status == JobStatus.CANCELLED.value


@pytest.mark.asyncio
async def test_jobs_api_endpoints(
    client: AsyncClient, auth_headers: dict, company_via_api: dict
):
    cid = company_via_api["id"]

    enq = await client.post(
        f"/api/v1/companies/{cid}/jobs/",
        json={"job_type": "noop", "payload": {"task": "smoke"}, "priority": 10},
        headers=auth_headers,
    )
    assert enq.status_code == 201
    job_id = enq.json()["id"]
    assert enq.json()["status"] == "PENDING"

    listing = await client.get(f"/api/v1/companies/{cid}/jobs/", headers=auth_headers)
    assert listing.status_code == 200
    assert any(j["id"] == job_id for j in listing.json())

    tick = await client.post(
        f"/api/v1/companies/{cid}/jobs/worker/tick",
        headers=auth_headers,
    )
    assert tick.status_code == 200
    assert tick.json()["processed"] is True
    assert tick.json()["job"]["status"] == "COMPLETED"

    detail = await client.get(
        f"/api/v1/companies/{cid}/jobs/{job_id}", headers=auth_headers
    )
    assert detail.status_code == 200
    assert detail.json()["result"] == {"ok": True, "echo": {"task": "smoke"}}

    # Cancelling an already-completed job returns 409
    cancel_completed = await client.post(
        f"/api/v1/companies/{cid}/jobs/{job_id}/cancel", headers=auth_headers
    )
    assert cancel_completed.status_code == 409
