"""
REST API Router for Sandboxed Code Execution Runtime Management.

Endpoints:
- GET /companies/{company_id}/runtime/executions - List recent sandboxed executions
- POST /companies/{company_id}/runtime/execute - Execute Python/Node/Bash code in isolated sandbox
- GET /companies/{company_id}/runtime/metrics - Execution duration, success rate, and AST safety statistics
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_viewer
from nexora.core.sandbox import (
    ExecutionSandbox,
    RuntimeExecutionRecord,
    SandboxExecutionResult,
    SandboxExecutionSpec,
    runtime_manager,
)
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(prefix="/companies/{company_id}/runtime", tags=["Execution Runtime"])


class RuntimeExecuteRequest(BaseModel):
    code: str | None = None
    command: str | None = None
    language: str = Field(default="python", description="python | node | bash")
    timeout_seconds: float = Field(default=30.0, ge=1.0, le=300.0)
    agent_id: str | None = None
    agent_name: str | None = None
    environment_variables: dict[str, str] = Field(default_factory=dict)


class RuntimeMetricsResponse(BaseModel):
    total_executions: int
    blocked_violations: int
    recent_count: int
    success_rate_pct: float
    avg_latency_ms: float
    sandbox_backend: str
    supported_languages: list[str]


@router.get("/executions", response_model=list[RuntimeExecutionRecord])
async def list_runtime_executions(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    language: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    _: None = Depends(require_viewer()),
):
    """List recent executions from the sandbox runtime ledger."""
    return runtime_manager.list_executions(
        company_id=company_id,
        language=language,
        status=status_filter,
        limit=limit,
    )


@router.post("/execute", response_model=SandboxExecutionResult, status_code=status.HTTP_200_OK)
async def execute_in_runtime(
    company_id: uuid.UUID,
    req: RuntimeExecuteRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """
    Executes a code snippet or shell command in the kernel-isolated bubblewrap sandbox.
    Enforces AST pre-validation, secret scrubbing, and resource boundaries.
    """
    sandbox = ExecutionSandbox(company_id=company_id)
    spec = SandboxExecutionSpec(
        code=req.code,
        command=req.command,
        language=req.language,
        timeout_seconds=req.timeout_seconds,
        agent_id=req.agent_id,
        agent_name=req.agent_name or f"{current_user.first_name or 'Operator'}",
        environment_variables=req.environment_variables,
    )
    res = sandbox.execute(spec)
    try:
        from nexora.domains.activity.broadcaster import activity_broadcaster
        from nexora.domains.activity.schemas import ActivityEvent, ActivityEventType, ActivitySeverity

        is_violation = res.status == "VIOLATION"
        event = ActivityEvent(
            company_id=str(company_id),
            event_type=(
                ActivityEventType.RUNTIME_EXECUTION_BLOCKED
                if is_violation
                else ActivityEventType.RUNTIME_EXECUTION_COMPLETED
            ),
            severity=ActivitySeverity.HIGH if is_violation else ActivitySeverity.INFO,
            title=(
                f"Runtime AST Blocked: {res.violation_reason or 'Security Violation'}"
                if is_violation
                else f"Runtime Execution: {spec.language.upper()} ({res.status})"
            ),
            summary=(
                f"Execution {res.execution_id[:8]} halted by AST inspector: {res.violation_reason}"
                if is_violation
                else f"Executed {spec.language} snippet in {res.duration_ms:.1f}ms with exit code {res.exit_code}."
            ),
            agent_id=req.agent_id,
            agent_name=spec.agent_name,
            payload={
                "execution_id": res.execution_id,
                "language": spec.language,
                "status": res.status,
                "exit_code": res.exit_code,
                "duration_ms": res.duration_ms,
            },
        )
        await activity_broadcaster.broadcast(str(company_id), event, session=db)
    except Exception:
        pass
    return res


@router.get("/metrics", response_model=RuntimeMetricsResponse)
async def get_runtime_metrics(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Get aggregate telemetry, quota health, and AST security metrics for this company."""
    return runtime_manager.get_metrics(company_id=company_id)
