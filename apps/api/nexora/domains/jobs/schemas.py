"""Pydantic schemas for durable background jobs."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class JobEnqueueRequest(BaseModel):
    job_type: str = Field(min_length=1, max_length=100)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=0, ge=-100, le=100)
    max_attempts: int = Field(default=3, ge=1, le=10)
    delay_seconds: int = Field(default=0, ge=0, le=86400)


class BackgroundJobResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID | None = None
    job_type: str
    status: str
    priority: int
    payload: dict[str, Any]
    result: dict[str, Any] | None = None
    error: str | None = None
    attempts: int
    max_attempts: int
    run_after: datetime
    locked_by: str | None = None
    locked_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkerTickResponse(BaseModel):
    processed: bool
    job: BackgroundJobResponse | None = None
    reclaimed_stale_count: int = 0
