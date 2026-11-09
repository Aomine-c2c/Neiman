"""Workflow API router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_manager, require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.workflows.schemas import (
    WorkflowCreate,
    WorkflowExecutionResponse,
    WorkflowExecutionTriggerRequest,
    WorkflowResponse,
    WorkflowUpdate,
)
from nexora.domains.workflows.service import WorkflowService

router = APIRouter(prefix="/companies/{company_id}/workflows", tags=["Workflows"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    company_id: uuid.UUID,
    body: WorkflowCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    return await WorkflowService(db).create(company_id, **body.model_dump())


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await WorkflowService(db).list(company_id)


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    company_id: uuid.UUID,
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await WorkflowService(db).get(workflow_id, company_id)


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    company_id: uuid.UUID,
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    return await WorkflowService(db).update(
        workflow_id, company_id, **body.model_dump(exclude_none=True)
    )


@router.post("/{workflow_id}/activate", response_model=WorkflowResponse)
async def activate_workflow(
    company_id: uuid.UUID,
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    return await WorkflowService(db).activate(workflow_id, company_id)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    company_id: uuid.UUID,
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    await WorkflowService(db).delete(workflow_id, company_id)


# -------------------------------------------------------------
# WORKFLOW EXECUTION ENDPOINTS (Observability & Engine Control)
# -------------------------------------------------------------


@router.post(
    "/{workflow_id}/execute",
    response_model=WorkflowExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_workflow(
    company_id: uuid.UUID,
    workflow_id: uuid.UUID,
    body: WorkflowExecutionTriggerRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Triggers an orchestrated workflow execution run."""
    return await WorkflowService(db).trigger_execution(
        workflow_id=workflow_id,
        company_id=company_id,
        title=body.title,
        input_payload=body.input_payload,
        triggered_by_user_id=current_user.id,
        max_retries=body.max_retries,
        timeout_seconds=body.timeout_seconds,
    )


@router.get("/{workflow_id}/executions", response_model=list[WorkflowExecutionResponse])
async def list_workflow_executions(
    company_id: uuid.UUID,
    workflow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    _: None = Depends(require_viewer()),
):
    """Lists executions for a specific workflow."""
    return await WorkflowService(db).list_executions(
        company_id=company_id,
        workflow_id=workflow_id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get("/executions/{execution_id}", response_model=WorkflowExecutionResponse)
async def get_workflow_execution(
    company_id: uuid.UUID,
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves full observable state of a workflow execution, including audit step records."""
    return await WorkflowService(db).get_execution(execution_id, company_id)


@router.post("/executions/{execution_id}/resume", response_model=WorkflowExecutionResponse)
async def resume_workflow_execution(
    company_id: uuid.UUID,
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Resumes a paused workflow execution (e.g. after approval or resource allocation)."""
    return await WorkflowService(db).resume_execution(execution_id, company_id)


@router.post("/executions/{execution_id}/cancel", response_model=WorkflowExecutionResponse)
async def cancel_workflow_execution(
    company_id: uuid.UUID,
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Cancels an in-flight workflow execution."""
    return await WorkflowService(db).cancel_execution(execution_id, company_id)
