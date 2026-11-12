"""Durable background job queue service and worker loop."""

import asyncio
import socket
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.database import get_session_factory
from nexora.domains.jobs.models import BackgroundJob, JobStatus

logger = structlog.get_logger(__name__)

JobHandler = Callable[[AsyncSession, BackgroundJob], Awaitable[dict[str, Any] | None]]
_JOB_HANDLERS: dict[str, JobHandler] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def register_job_handler(job_type: str, handler: JobHandler) -> None:
    """Register an async handler for a durable job type."""
    _JOB_HANDLERS[job_type] = handler


async def _handle_noop(db: AsyncSession, job: BackgroundJob) -> dict[str, Any]:
    return {"ok": True, "echo": job.payload}


async def _handle_supervisor_tick(db: AsyncSession, job: BackgroundJob) -> dict[str, Any]:
    from nexora.domains.agents.supervisor import ContinuousSupervisor

    if not job.company_id:
        raise ValueError("supervisor_tick job requires company_id")
    supervisor = ContinuousSupervisor(db=db)
    return await supervisor.run_cycle(job.company_id)


async def _handle_workflow_run(db: AsyncSession, job: BackgroundJob) -> dict[str, Any]:
    from nexora.domains.workflows.service import WorkflowService

    if not job.company_id:
        raise ValueError("workflow_run job requires company_id")
    workflow_id_raw = job.payload.get("workflow_id")
    if not workflow_id_raw:
        raise ValueError("workflow_run job requires payload.workflow_id")
    svc = WorkflowService(db)
    run = await svc.trigger_run(
        company_id=job.company_id,
        workflow_id=uuid.UUID(str(workflow_id_raw)),
        trigger_source=str(job.payload.get("trigger_source") or "durable_worker"),
        input_data=job.payload.get("input_data") or {},
    )
    return {"run_id": str(run.id), "status": str(run.status)}


async def _handle_simulation_run(db: AsyncSession, job: BackgroundJob) -> dict[str, Any]:
    from nexora.domains.simulation.service import SimulationService

    if not job.company_id:
        raise ValueError("simulation_run job requires company_id")
    svc = SimulationService(db)
    scenario = str(job.payload.get("scenario") or "stress_test")
    result = await svc.run_simulation(
        company_id=job.company_id,
        scenario=scenario,
        parameters=job.payload.get("parameters") or {},
    )
    return result if isinstance(result, dict) else {"status": "completed"}


def _ensure_builtin_handlers() -> None:
    if "noop" not in _JOB_HANDLERS:
        register_job_handler("noop", _handle_noop)
    if "supervisor_tick" not in _JOB_HANDLERS:
        register_job_handler("supervisor_tick", _handle_supervisor_tick)
    if "workflow_run" not in _JOB_HANDLERS:
        register_job_handler("workflow_run", _handle_workflow_run)
    if "simulation_run" not in _JOB_HANDLERS:
        register_job_handler("simulation_run", _handle_simulation_run)


class BackgroundJobService:
    """Manages durable job enqueueing, claiming, execution, retries, and stale lock recovery."""

    def __init__(self, db: AsyncSession):
        self.db = db
        _ensure_builtin_handlers()

    async def enqueue(
        self,
        *,
        job_type: str,
        payload: dict[str, Any] | None = None,
        company_id: uuid.UUID | None = None,
        priority: int = 0,
        max_attempts: int = 3,
        delay_seconds: int = 0,
    ) -> BackgroundJob:
        now = _utcnow()
        job = BackgroundJob(
            company_id=company_id,
            job_type=job_type,
            status=JobStatus.PENDING.value,
            priority=priority,
            payload=payload or {},
            max_attempts=max_attempts,
            run_after=now + timedelta(seconds=max(0, delay_seconds)),
        )
        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    async def get_job(self, job_id: uuid.UUID, company_id: uuid.UUID | None = None) -> BackgroundJob | None:
        stmt = select(BackgroundJob).where(BackgroundJob.id == job_id)
        if company_id is not None:
            stmt = stmt.where(BackgroundJob.company_id == company_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_jobs(
        self,
        *,
        company_id: uuid.UUID | None = None,
        status: str | None = None,
        job_type: str | None = None,
        limit: int = 50,
    ) -> list[BackgroundJob]:
        stmt = select(BackgroundJob)
        if company_id is not None:
            stmt = stmt.where(BackgroundJob.company_id == company_id)
        if status:
            stmt = stmt.where(BackgroundJob.status == status)
        if job_type:
            stmt = stmt.where(BackgroundJob.job_type == job_type)
        stmt = stmt.order_by(BackgroundJob.created_at.desc()).limit(min(max(limit, 1), 200))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def cancel_job(
        self, job_id: uuid.UUID, company_id: uuid.UUID | None = None
    ) -> BackgroundJob | None:
        job = await self.get_job(job_id, company_id=company_id)
        if not job:
            return None
        if job.status != JobStatus.PENDING.value:
            raise ValueError(f"Cannot cancel job in status {job.status}")
        job.status = JobStatus.CANCELLED.value
        job.completed_at = _utcnow()
        await self.db.flush()
        await self.db.refresh(job)
        return job

    async def reclaim_stale_jobs(self, stale_after_seconds: int = 300) -> int:
        """Re-queue or fail RUNNING jobs whose worker lock expired."""
        cutoff = _utcnow() - timedelta(seconds=max(1, stale_after_seconds))
        stmt = select(BackgroundJob).where(
            BackgroundJob.status == JobStatus.RUNNING.value,
            BackgroundJob.locked_at.is_not(None),
            BackgroundJob.locked_at < cutoff,
        )
        res = await self.db.execute(stmt)
        stale_jobs = list(res.scalars().all())
        now = _utcnow()
        for job in stale_jobs:
            if job.attempts >= job.max_attempts:
                job.status = JobStatus.FAILED.value
                job.error = job.error or "Worker lock expired after max attempts"
                job.completed_at = now
            else:
                job.status = JobStatus.PENDING.value
                job.run_after = now
            job.locked_by = None
            job.locked_at = None
        if stale_jobs:
            await self.db.flush()
        return len(stale_jobs)

    async def claim_next_job(self, worker_id: str) -> BackgroundJob | None:
        """Atomically claim the highest-priority due PENDING job."""
        now = _utcnow()
        candidate_stmt = (
            select(BackgroundJob)
            .where(
                BackgroundJob.status == JobStatus.PENDING.value,
                BackgroundJob.run_after <= now,
            )
            .order_by(BackgroundJob.priority.desc(), BackgroundJob.created_at.asc())
            .limit(1)
        )
        res = await self.db.execute(candidate_stmt)
        candidate = res.scalar_one_or_none()
        if not candidate:
            return None

        claim_stmt = (
            update(BackgroundJob)
            .where(
                BackgroundJob.id == candidate.id,
                BackgroundJob.status == JobStatus.PENDING.value,
            )
            .values(
                status=JobStatus.RUNNING.value,
                locked_by=worker_id,
                locked_at=now,
                started_at=candidate.started_at or now,
                attempts=candidate.attempts + 1,
                updated_at=now,
            )
        )
        upd_res = await self.db.execute(claim_stmt)
        if (upd_res.rowcount or 0) == 0:
            return None
        await self.db.flush()
        await self.db.refresh(candidate)
        return candidate

    async def process_one(self, worker_id: str | None = None) -> BackgroundJob | None:
        """Claim and execute a single due job with retry/backoff handling."""
        wid = worker_id or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
        job = await self.claim_next_job(wid)
        if not job:
            return None

        handler = _JOB_HANDLERS.get(job.job_type)
        now = _utcnow()
        if handler is None:
            job.status = JobStatus.FAILED.value
            job.error = f"No handler registered for job_type '{job.job_type}'"
            job.locked_by = None
            job.locked_at = None
            job.completed_at = now
            await self.db.flush()
            await self.db.refresh(job)
            return job

        try:
            output = await handler(self.db, job)
            job.status = JobStatus.COMPLETED.value
            job.result = output if isinstance(output, dict) else {"output": output}
            job.error = None
            job.completed_at = _utcnow()
        except Exception as exc:
            logger.warning(
                "NEIMAN_background_job_failed",
                job_id=str(job.id),
                job_type=job.job_type,
                attempts=job.attempts,
                max_attempts=job.max_attempts,
                error=str(exc),
            )
            job.error = str(exc)
            if job.attempts < job.max_attempts:
                backoff_secs = min(300, 2**job.attempts)
                job.status = JobStatus.PENDING.value
                job.run_after = _utcnow() + timedelta(seconds=backoff_secs)
            else:
                job.status = JobStatus.FAILED.value
                job.completed_at = _utcnow()
        finally:
            job.locked_by = None
            job.locked_at = None
            await self.db.flush()
            await self.db.refresh(job)

        return job


class DurableWorkerLoop:
    """In-process async worker loop polling the durable background_jobs table."""

    def __init__(self, poll_interval_seconds: float = 2.0, stale_after_seconds: int = 300):
        self.poll_interval_seconds = poll_interval_seconds
        self.stale_after_seconds = stale_after_seconds
        self.worker_id = f"{socket.gethostname()}-worker"
        self._task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run(), name="neiman-durable-worker")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run(self) -> None:
        session_factory = get_session_factory()
        while not self._stop_event.is_set():
            try:
                async with session_factory() as db:
                    svc = BackgroundJobService(db)
                    await svc.reclaim_stale_jobs(self.stale_after_seconds)
                    job = await svc.process_one(self.worker_id)
                    await db.commit()
                    if job is not None:
                        continue
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("NEIMAN_durable_worker_cycle_error", error=str(exc))

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.poll_interval_seconds)
            except asyncio.TimeoutError:
                continue
