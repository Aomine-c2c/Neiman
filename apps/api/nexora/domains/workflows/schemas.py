"""Workflow Pydantic schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from nexora.core.enums import WorkflowStatus, WorkflowTriggerType


class WorkflowStep(BaseModel):
    id: str = Field(description="Unique step identifier within the workflow")
    type: str = Field(
        description="Step type: TRIGGER, AGENT, TOOL, APPROVAL, VALIDATION, SUCCESS, etc."
    )
    name: str
    config: dict = Field(default_factory=dict)
    next_step_id: str | None = None
    next_step_ids: list[str] | None = None
    position: dict | None = None
    condition: dict | None = None


class WorkflowCondition(BaseModel):
    id: str
    expression: str
    true_step_id: str
    false_step_id: str


class ApprovalConfig(BaseModel):
    required_role: str = "MANAGER"
    timeout_hours: int = 24
    on_timeout: str = "escalate"  # escalate | auto_approve | auto_reject


class CompletionCriteria(BaseModel):
    all_steps_completed: bool = True
    success_condition: str | None = None


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    trigger_type: WorkflowTriggerType = WorkflowTriggerType.MANUAL
    trigger_config: dict = Field(default_factory=dict)
    steps: list[WorkflowStep] = Field(default_factory=list)
    agents: list[uuid.UUID] = Field(default_factory=list)
    tools: list[dict] = Field(default_factory=list)
    conditions: list[WorkflowCondition] = Field(default_factory=list)
    approvals: ApprovalConfig = Field(default_factory=ApprovalConfig)
    completion_criteria: CompletionCriteria = Field(default_factory=CompletionCriteria)


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    trigger_type: WorkflowTriggerType | None = None
    trigger_config: dict | None = None
    steps: list[WorkflowStep] | None = None
    agents: list[uuid.UUID] | None = None
    tools: list[dict] | None = None
    conditions: list[WorkflowCondition] | None = None
    approvals: ApprovalConfig | None = None
    completion_criteria: CompletionCriteria | None = None
    status: WorkflowStatus | None = None


class WorkflowResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    description: str | None
    trigger_type: WorkflowTriggerType
    trigger_config: dict
    steps: list
    agents: list
    tools: list
    conditions: list
    approvals: dict
    completion_criteria: dict
    status: WorkflowStatus
    created_at: datetime
    updated_at: datetime


# -------------------------------------------------------------
# WORKFLOW EXECUTION SCHEMAS
# -------------------------------------------------------------
class WorkflowExecutionTriggerRequest(BaseModel):
    title: str | None = None
    input_payload: dict = Field(default_factory=dict)
    override_agent_ids: dict[str, uuid.UUID] | None = None
    max_retries: int = Field(default=3, ge=0, le=10)
    timeout_seconds: int = Field(default=3600, ge=1, le=86400)


class WorkflowExecutionStepResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    step_id: str
    step_name: str
    step_type: str
    step_index: int
    agent_id: uuid.UUID | None = None
    agent_name: str | None = None
    tool_name: str | None = None
    status: str
    input_data: dict
    output_data: dict
    error_message: str | None = None
    retries_attempted: int
    duration_ms: float
    created_at: datetime


class WorkflowExecutionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    workflow_id: uuid.UUID
    company_id: uuid.UUID
    triggered_by_user_id: uuid.UUID | None = None
    triggered_by_agent_id: uuid.UUID | None = None
    title: str
    status: str
    current_step_id: str | None = None
    current_step_name: str | None = None
    current_step_index: int
    total_steps: int
    input_payload: dict
    state_payload: dict
    output_payload: dict
    error_message: str | None = None
    retries_count: int
    max_retries: int
    timeout_seconds: int
    duration_ms: float
    pending_approval_id: uuid.UUID | None = None
    pending_escalation_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    step_records: list[WorkflowExecutionStepResponse] = Field(default_factory=list)
