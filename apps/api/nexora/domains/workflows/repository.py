from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nexora.domains.workflows.models import WorkflowExecution, WorkflowExecutionStep

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import WorkflowStatus
from nexora.domains.workflows.models import Workflow


class WorkflowRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, workflow_id: uuid.UUID) -> Workflow | None:
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id, Workflow.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[Workflow]:
        result = await self.db.execute(
            select(Workflow)
            .where(Workflow.company_id == company_id, Workflow.is_deleted.is_(False))
            .order_by(Workflow.name)
        )
        return list(result.scalars().all())

    def _serialize_kwargs(self, kwargs: dict) -> dict:
        """Convert any Pydantic models in kwargs to dicts."""
        for key, value in kwargs.items():
            if hasattr(value, "model_dump"):
                kwargs[key] = value.model_dump()
            elif isinstance(value, list) and value and hasattr(value[0], "model_dump"):
                kwargs[key] = [
                    v.model_dump() if hasattr(v, "model_dump") else str(v) for v in value
                ]
            elif isinstance(value, list):
                kwargs[key] = [str(v) if isinstance(v, uuid.UUID) else v for v in value]
        return kwargs

    async def create(self, company_id: uuid.UUID, **kwargs) -> Workflow:
        kwargs = self._serialize_kwargs(kwargs)
        workflow = Workflow(company_id=company_id, **kwargs)
        self.db.add(workflow)
        await self.db.flush()
        await self.db.refresh(workflow)
        return workflow

    async def update(self, workflow: Workflow, **kwargs) -> Workflow:
        kwargs = self._serialize_kwargs(kwargs)
        for key, value in kwargs.items():
            if value is not None and hasattr(workflow, key):
                setattr(workflow, key, value)
        await self.db.flush()
        await self.db.refresh(workflow)
        return workflow

    async def soft_delete(self, workflow: Workflow) -> None:
        from datetime import UTC, datetime

        workflow.is_deleted = True
        workflow.deleted_at = datetime.now(UTC)
        workflow.status = WorkflowStatus.ARCHIVED
        await self.db.flush()


class WorkflowExecutionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_execution(
        self,
        workflow_id: uuid.UUID,
        company_id: uuid.UUID,
        title: str,
        total_steps: int,
        input_payload: dict,
        state_payload: dict,
        triggered_by_user_id: uuid.UUID | None = None,
        triggered_by_agent_id: uuid.UUID | None = None,
        max_retries: int = 3,
        timeout_seconds: int = 3600,
    ) -> WorkflowExecution:
        from nexora.core.enums import WorkflowExecutionStatus
        from nexora.domains.workflows.models import WorkflowExecution

        execution = WorkflowExecution(
            workflow_id=workflow_id,
            company_id=company_id,
            title=title,
            status=WorkflowExecutionStatus.PENDING,
            current_step_index=0,
            total_steps=total_steps,
            input_payload=input_payload,
            state_payload=state_payload,
            output_payload={},
            triggered_by_user_id=triggered_by_user_id,
            triggered_by_agent_id=triggered_by_agent_id,
            max_retries=max_retries,
            timeout_seconds=timeout_seconds,
        )
        self.db.add(execution)
        await self.db.flush()
        await self.db.refresh(execution)
        return execution

    async def get_execution(
        self, execution_id: uuid.UUID, company_id: uuid.UUID
    ) -> WorkflowExecution | None:
        from sqlalchemy.orm import selectinload

        from nexora.domains.workflows.models import WorkflowExecution

        stmt = (
            select(WorkflowExecution)
            .where(
                WorkflowExecution.id == execution_id,
                WorkflowExecution.company_id == company_id,
            )
            .options(selectinload(WorkflowExecution.step_records))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_pending_approval(
        self, approval_id: uuid.UUID, company_id: uuid.UUID
    ) -> WorkflowExecution | None:
        from sqlalchemy.orm import selectinload

        from nexora.domains.workflows.models import WorkflowExecution

        stmt = (
            select(WorkflowExecution)
            .where(
                WorkflowExecution.pending_approval_id == approval_id,
                WorkflowExecution.company_id == company_id,
            )
            .options(selectinload(WorkflowExecution.step_records))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_executions(
        self,
        company_id: uuid.UUID,
        workflow_id: uuid.UUID | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[WorkflowExecution]:
        from sqlalchemy.orm import selectinload

        from nexora.domains.workflows.models import WorkflowExecution

        stmt = select(WorkflowExecution).where(WorkflowExecution.company_id == company_id)
        if workflow_id:
            stmt = stmt.where(WorkflowExecution.workflow_id == workflow_id)
        if status:
            stmt = stmt.where(WorkflowExecution.status == status)
        stmt = (
            stmt.options(selectinload(WorkflowExecution.step_records))
            .order_by(WorkflowExecution.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def record_step(
        self,
        execution_id: uuid.UUID,
        step_id: str,
        step_name: str,
        step_type: str,
        step_index: int,
        status: str,
        input_data: dict,
        output_data: dict,
        agent_id: uuid.UUID | None = None,
        agent_name: str | None = None,
        tool_name: str | None = None,
        error_message: str | None = None,
        retries_attempted: int = 0,
        duration_ms: float = 0.0,
    ) -> WorkflowExecutionStep:
        from nexora.core.enums import WorkflowExecutionStatus, WorkflowStepType
        from nexora.domains.workflows.models import WorkflowExecutionStep

        step = WorkflowExecutionStep(
            execution_id=execution_id,
            step_id=step_id,
            step_name=step_name,
            step_type=getattr(WorkflowStepType, step_type, WorkflowStepType.AGENT),
            step_index=step_index,
            status=getattr(WorkflowExecutionStatus, status, WorkflowExecutionStatus.COMPLETED),
            input_data=input_data,
            output_data=output_data,
            agent_id=agent_id,
            agent_name=agent_name,
            tool_name=tool_name,
            error_message=error_message,
            retries_attempted=retries_attempted,
            duration_ms=duration_ms,
        )
        self.db.add(step)
        await self.db.flush()
        await self.db.refresh(step)
        return step
