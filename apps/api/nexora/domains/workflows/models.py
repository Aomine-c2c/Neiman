"""Workflow model — orchestrated multi-step processes."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import NexoraBase, UUIDCreatedAtBase, UUIDTimestampBase
from nexora.core.enums import (
    WorkflowExecutionStatus,
    WorkflowStatus,
    WorkflowStepType,
    WorkflowTriggerType,
)

if TYPE_CHECKING:
    from nexora.domains.organizations.models import Company


class Workflow(NexoraBase):
    """
    A reusable process definition: a sequence of steps, agents, and tools
    that can be triggered manually, on a schedule, or by events.
    """

    __tablename__ = "workflows"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Trigger configuration
    trigger_type: Mapped[WorkflowTriggerType] = mapped_column(
        SAEnum(WorkflowTriggerType, name="workflow_trigger_type"),
        default=WorkflowTriggerType.MANUAL,
        nullable=False,
    )
    trigger_config: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Trigger-specific config: cron expression, webhook URL, event name, etc.",
    )

    # Workflow definition
    steps: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Ordered list of step objects: {id, type, name, config, next_step_id}",
    )
    agents: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="List of agent IDs participating in this workflow",
    )
    tools: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Tool configurations available during workflow execution",
    )
    conditions: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Branching conditions: {id, expression, true_step, false_step}",
    )
    approvals: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Approval gate config: {required_role, timeout_hours, on_timeout}",
    )
    completion_criteria: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="What constitutes a successful workflow completion",
    )

    status: Mapped[WorkflowStatus] = mapped_column(
        SAEnum(WorkflowStatus, name="workflow_status"),
        default=WorkflowStatus.DRAFT,
        nullable=False,
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="workflows")
    executions: Mapped[list["WorkflowExecution"]] = relationship(
        "WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Workflow id={self.id} name={self.name}>"


class WorkflowExecution(UUIDTimestampBase):
    """
    Stateful execution instance of a Workflow.
    Persists current step, state payload, history, resource usage, and observable telemetry.
    Never relies solely on LLM context window memory.
    """

    __tablename__ = "workflow_executions"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    triggered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    triggered_by_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[WorkflowExecutionStatus] = mapped_column(
        SAEnum(WorkflowExecutionStatus, name="workflow_execution_status"),
        default=WorkflowExecutionStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Observable State & Location
    current_step_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_step_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_step_index: Mapped[int] = mapped_column(nullable=False, default=0)
    total_steps: Mapped[int] = mapped_column(nullable=False, default=1)

    # State Data Payloads
    input_payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    state_payload: Mapped[dict] = mapped_column(
        JSON, default=dict, nullable=False, comment="Persistent shared state passed between steps"
    )
    output_payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Execution Parameters & Governance
    retries_count: Mapped[int] = mapped_column(nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(nullable=False, default=3)
    timeout_seconds: Mapped[int] = mapped_column(nullable=False, default=3600)
    duration_ms: Mapped[float] = mapped_column(nullable=False, default=0.0)

    # Active Gates
    pending_approval_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("approval_requests.id", ondelete="SET NULL"), nullable=True
    )
    pending_escalation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("escalation_records.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="executions")
    step_records: Mapped[list["WorkflowExecutionStep"]] = relationship(
        "WorkflowExecutionStep",
        back_populates="execution",
        cascade="all, delete-orphan",
        order_by="WorkflowExecutionStep.step_index",
    )


class WorkflowExecutionStep(UUIDCreatedAtBase):
    """
    Detailed audit log for every step execution within a WorkflowExecution.
    Records agent involved, tools executed, decisions made, approval gates, retries, and errors.
    """

    __tablename__ = "workflow_execution_steps"

    execution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_id: Mapped[str] = mapped_column(String(100), nullable=False)
    step_name: Mapped[str] = mapped_column(String(255), nullable=False)
    step_type: Mapped[WorkflowStepType] = mapped_column(
        SAEnum(WorkflowStepType, name="workflow_step_type"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(nullable=False, default=0)

    # Actors & Resource Tracking
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    agent_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tool_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    status: Mapped[WorkflowExecutionStatus] = mapped_column(
        SAEnum(WorkflowExecutionStatus, name="workflow_execution_step_status"),
        default=WorkflowExecutionStatus.PENDING,
        nullable=False,
    )

    input_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    output_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retries_attempted: Mapped[int] = mapped_column(nullable=False, default=0)
    duration_ms: Mapped[float] = mapped_column(nullable=False, default=0.0)

    execution: Mapped["WorkflowExecution"] = relationship(
        "WorkflowExecution", back_populates="step_records"
    )
