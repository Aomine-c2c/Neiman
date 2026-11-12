"""API router for durable background jobs."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
from nexora.domains.jobs.schemas import (
    BackgroundJobResponse,
    JobEnqueueRequest,
    WorkerTickResponse,
)
from nexora.domains.jobs.service import BackgroundJobService

router = APIRouter(prefix="/companies/{company_id}/jobs", tags=["Jobs"])


@router.post("/", response_model=BackgroundJobResponse, status_code=status.HTTP_201_CREATED)
async def enqueue_job(
    company_id: uuid.UUID,
    body: JobEnqueueRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Enqueue a durable background job for asynchronous execution."""
    svc = BackgroundJobService(db)
    job = await svc.enqueue(
        company_id=company_id,
        job_type=body.job_type,
        payload=body.payload,
        priority=body.priority,
        max_attempts=body.max_attempts,
        delay_seconds=body.delay_seconds,
    )
    await db.commit()
    return job


@router.get("/", response_model=list[BackgroundJobResponse])
async def list_jobs(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    status_filter: str | None = Query(default=None, alias="status"),
    job_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _: None = Depends(require_viewer()),
):
    """List durable background jobs for the company."""
    return await BackgroundJobService(db).list_jobs(
        company_id=company_id,
        status=status_filter,
        job_type=job_type,
        limit=limit,
    )


@router.get("/{job_id}", response_model=BackgroundJobResponse)
async def get_job(
    company_id: uuid.UUID,
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieve status and result of a durable background job."""
    job = await BackgroundJobService(db).get_job(job_id, company_id=company_id)
    if not job:
        raise HTTPException(status_code=404, detail="Background job not found")
    return job


@router.post("/{job_id}/cancel", response_model=BackgroundJobResponse)
async def cancel_job(
    company_id: uuid.UUID,
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Cancel a pending durable background job."""
    try:
        job = await BackgroundJobService(db).cancel_job(job_id, company_id=company_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not job:
        raise HTTPException(status_code=404, detail="Background job not found")
    await db.commit()
    return job


@router.post("/worker/tick", response_model=WorkerTickResponse)
async def trigger_worker_tick(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Reclaim stale locks and execute one due background job immediately."""
    svc = BackgroundJobService(db)
    reclaimed = await svc.reclaim_stale_jobs()
    job = await svc.process_one()
    await db.commit()
    return WorkerTickResponse(
        processed=job is not None,
        job=job,
        reclaimed_stale_count=reclaimed,
    )
