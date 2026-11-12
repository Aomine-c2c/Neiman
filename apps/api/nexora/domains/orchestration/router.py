"""
FastAPI Router for NEIMAN Agent Orchestration Core.
Provides REST endpoints for DAG execution, atomic task claiming,
resilience recovery, and audit event inspection.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.orchestration.schemas import (
    AutonomousRunRecord,
    GraphValidationResult,
    OrchestrationTaskSpec,
    RecoverableExecutionState,
    RunAuthority,
    RunBudget,
    TaskClaimRequest,
    TaskClaimResponse,
    TaskDependencyGraphSpec,
)
from nexora.domains.orchestration.service import OrchestrationService

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(
    prefix="/companies/{company_id}/orchestration",
    tags=["Agent Orchestration Core"],
)


class TriggerRunRequest(BaseModel):
    agent_id: str
    task: OrchestrationTaskSpec
    authority: RunAuthority
    budget: RunBudget | None = None
    override_model: str | None = None


class ClaimTaskPayload(BaseModel):
    request: TaskClaimRequest
    candidate_tasks: list[OrchestrationTaskSpec]


class ExecuteGraphRequest(BaseModel):
    spec: TaskDependencyGraphSpec
    agent_id: str
    authority: RunAuthority
    budget: RunBudget | None = None


@router.post("/runs", response_model=AutonomousRunRecord, status_code=status.HTTP_201_CREATED)
async def trigger_autonomous_run(
    company_id: uuid.UUID,
    body: TriggerRunRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Triggers an autonomous task execution run under strict orchestration governance.
    Every run produces a traceable goal, budget, authority, result, and verification status.
    """
    return await OrchestrationService(db).trigger_run(
        company_id=company_id,
        agent_id=body.agent_id,
        task=body.task,
        authority=body.authority,
        budget=body.budget,
        override_model=body.override_model,
    )


@router.get("/runs", response_model=list[AutonomousRunRecord])
async def list_autonomous_runs(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Lists all autonomous runs for the company."""
    return OrchestrationService(db).list_runs(company_id)


@router.get("/runs/{run_id}", response_model=AutonomousRunRecord)
async def get_autonomous_run(
    company_id: uuid.UUID,
    run_id: str,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves full telemetry, checkpoints, and verification for an autonomous run."""
    return OrchestrationService(db).get_run(run_id)


@router.post("/runs/{run_id}/recover", response_model=RecoverableExecutionState)
async def recover_interrupted_run(
    company_id: uuid.UUID,
    run_id: str,
    current_user: CurrentUser,
    db: DB,
    total_steps: int = 3,
    _: None = Depends(require_member()),
):
    """Recovers an interrupted or crashed run using its cryptographic checkpoints."""
    return OrchestrationService(db).recover_run(run_id, total_steps=total_steps)


@router.post("/tasks/claim", response_model=TaskClaimResponse)
async def claim_tasks_atomically(
    company_id: uuid.UUID,
    body: ClaimTaskPayload,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Atomically claims unblocked tasks matching agent capabilities and concurrency ceilings.
    Prevents duplicate job processing.
    """
    return OrchestrationService(db).claim_tasks(
        company_id=company_id,
        request=body.request,
        candidate_tasks=body.candidate_tasks,
    )


@router.post("/graph/validate", response_model=GraphValidationResult)
async def validate_task_graph(
    company_id: uuid.UUID,
    spec: TaskDependencyGraphSpec,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Validates a task dependency graph for circular references (cycles) and topological ordering."""
    return OrchestrationService(db).validate_graph(spec)


@router.post("/graph/execute", response_model=dict[str, Any])
async def execute_task_graph(
    company_id: uuid.UUID,
    body: ExecuteGraphRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Executes a full task dependency DAG tier-by-tier with output data pipelining."""
    return await OrchestrationService(db).execute_graph(
        company_id=company_id,
        spec=body.spec,
        agent_id=body.agent_id,
        authority=body.authority,
        budget=body.budget,
    )


@router.get("/events", response_model=list[dict[str, Any]])
async def list_orchestration_events(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = 50,
    _: None = Depends(require_viewer()),
):
    """Retrieves immutable orchestration event logs."""
    return OrchestrationService(db).list_events(limit=limit)
