"""Pydantic schemas for Agents and Multi-Agent infrastructure."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from nexora.core.enums import (
    AgentAutonomy,
    AgentMessageType,
    AgentStatus,
    AuditAction,
    ExecutionStatus,
    ExecutionStep,
)


class AgentIdentity(BaseModel):
    tone: str = "professional"
    style: str = "analytical"
    expertise_areas: list[str] = Field(default_factory=list)
    avatar_url: str | None = None
    bio: str | None = None


class IntelligenceConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, gt=0)
    system_prompt_addendum: str | None = None
    reasoning_effort: str | None = None


class ResourceLimits(BaseModel):
    max_tokens_per_call: int = 8192
    max_daily_budget_usd: float = 10.0
    max_concurrent_tasks: int = 3
    timeout_seconds: int = 120
    max_tool_invocations: int = 15


class ResourceUsage(BaseModel):
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    total_tool_calls: int = 0
    current_active_tasks: int = 0


class PerformanceMetadata(BaseModel):
    tasks_completed: int = 0
    tasks_failed: int = 0
    success_rate: float = 1.0
    avg_duration_ms: float = 0.0
    decisions_participated: int = 0
    last_active_at: datetime | None = None


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    role_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    manager_agent_id: uuid.UUID | None = None
    identity: AgentIdentity = Field(default_factory=AgentIdentity)
    system_instructions: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    permissions: dict = Field(default_factory=dict)
    tools: list[dict] = Field(default_factory=list)
    autonomy: AgentAutonomy = AgentAutonomy.SUPERVISED
    intelligence_config: IntelligenceConfig = Field(default_factory=IntelligenceConfig)
    resource_limits: ResourceLimits = Field(default_factory=ResourceLimits)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    role_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    manager_agent_id: uuid.UUID | None = None
    identity: AgentIdentity | None = None
    system_instructions: str | None = None
    responsibilities: list[str] | None = None
    goals: list[str] | None = None
    capabilities: list[str] | None = None
    permissions: dict | None = None
    tools: list[dict] | None = None
    autonomy: AgentAutonomy | None = None
    status: AgentStatus | None = None
    intelligence_config: IntelligenceConfig | None = None
    resource_limits: ResourceLimits | None = None


class AgentStatusTransition(BaseModel):
    status: AgentStatus
    reason: str | None = None


class AgentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    role_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    manager_agent_id: uuid.UUID | None = None
    name: str
    identity: dict
    system_instructions: str | None = None
    responsibilities: list = Field(default_factory=list)
    goals: list = Field(default_factory=list)
    capabilities: list = Field(default_factory=list)
    permissions: dict = Field(default_factory=dict)
    tools: list = Field(default_factory=list)
    autonomy: AgentAutonomy
    status: AgentStatus
    intelligence_config: dict
    resource_limits: dict = Field(default_factory=dict)
    resource_usage: dict = Field(default_factory=dict)
    performance_metadata: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AgentProfileResponse(BaseModel):
    """Rich organizational employee profile view for frontend inspection."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    status: AgentStatus
    autonomy: AgentAutonomy

    role_title: str | None = None
    department_name: str | None = None
    manager_name: str | None = None
    manager_id: uuid.UUID | None = None

    identity: dict
    system_instructions: str | None
    responsibilities: list
    goals: list
    capabilities: list
    permissions: dict
    tools: list
    intelligence_config: dict
    resource_limits: dict
    resource_usage: dict
    performance_metadata: dict

    current_task: dict | None = None
    recent_communications: list[dict] = Field(default_factory=list)
    recent_decisions: list[dict] = Field(default_factory=list)
    recent_audits: list[dict] = Field(default_factory=list)
    memories: list[dict] = Field(default_factory=list)


# ── Memory Schemas ──────────────────────────────────────────────────────────


class MemoryCreate(BaseModel):
    memory_type: str = Field(
        default="episodic", description="episodic | semantic | procedural | reflection"
    )
    key: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    metadata: dict = Field(default_factory=dict)
    importance: float = Field(default=1.0, ge=0.0, le=5.0)


class MemoryResponse(BaseModel):
    model_config = {"from_attributes": True, "populate_by_name": True}

    id: uuid.UUID
    agent_id: uuid.UUID
    company_id: uuid.UUID
    memory_type: str
    key: str
    content: str
    metadata_: dict = Field(default_factory=dict, serialization_alias="metadata")
    importance: float
    access_count: int
    last_accessed_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ── Communication Schemas ───────────────────────────────────────────────────


class MessageCreate(BaseModel):
    to_agent_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    message_type: AgentMessageType = AgentMessageType.REQUEST
    subject: str = Field(min_length=2, max_length=255)
    body: str = Field(min_length=2)
    payload: dict = Field(default_factory=dict)


class MessageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    from_agent_id: uuid.UUID
    to_agent_id: uuid.UUID | None
    task_id: uuid.UUID | None
    message_type: AgentMessageType
    subject: str
    body: str
    payload: dict
    is_read: bool
    resolved: bool
    created_at: datetime
    updated_at: datetime


# ── Task Execution Schemas ──────────────────────────────────────────────────


class TaskExecutionRequest(BaseModel):
    task_id: uuid.UUID
    input_data: dict = Field(default_factory=dict)
    override_model: str | None = None


class ExecutionStepRecord(BaseModel):
    step: ExecutionStep
    status: ExecutionStatus
    details: dict = Field(default_factory=dict)
    duration_ms: float = 0.0


class TaskExecutionResult(BaseModel):
    execution_id: uuid.UUID
    task_id: uuid.UUID
    agent_id: uuid.UUID
    final_status: ExecutionStatus
    steps: list[ExecutionStepRecord]
    result: dict = Field(default_factory=dict)
    tokens_consumed: int = 0
    cost_usd: float = 0.0
    total_duration_ms: float = 0.0


# ── Audit Trail Schemas ─────────────────────────────────────────────────────


class AuditLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    agent_id: uuid.UUID
    company_id: uuid.UUID
    task_id: uuid.UUID | None
    execution_id: uuid.UUID
    action: AuditAction
    step: ExecutionStep | None
    status: ExecutionStatus
    details: dict
    tokens_consumed: int
    cost_usd: float
    duration_ms: float
    created_at: datetime


# ── CTO & Autonomous Supervisor Schemas ─────────────────────────────────────


class CTODirectiveRequest(BaseModel):
    directive: str = Field(
        min_length=1, max_length=2000, description="Operator command/goal for the CTO Agent"
    )
    priority: str = Field(default="HIGH", description="Priority level: LOW, MEDIUM, HIGH, URGENT")
    target_repo: str | None = Field(
        default=None, description="Optional target workspace repository path"
    )
    auto_delegate: bool = Field(
        default=True, description="Whether to automatically dispatch unblocked tasks"
    )
    project_id: uuid.UUID | None = Field(
        default=None, description="Optional target project ID to link tasks"
    )


class CTODirectiveResponse(BaseModel):
    directive: str
    cto_agent_name: str
    analysis: str
    tasks_created_count: int
    tasks: list[dict] = Field(default_factory=list)
    intent: str = Field(default="DIRECTIVE", description="CONVERSATION or DIRECTIVE")
    summary: str | None = None


class CTOProposalResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    cto_agent_id: uuid.UUID | None
    title: str
    category: str
    rationale: str
    impact_assessment: str
    status: str
    proposed_tasks: list[dict] = Field(default_factory=list)
    delegated_task_ids: list[str] = Field(default_factory=list)
    created_at: datetime


class CTOProposalDecisionRequest(BaseModel):
    decision: str = Field(description="APPROVED or DISMISSED")
    notes: str | None = Field(default=None, description="Operator supervisory notes")


class SupervisorStatusResponse(BaseModel):
    company_id: uuid.UUID
    is_running: bool
    state: str
    active_cycle: int
    last_tick_at: str | None
    pending_tasks_count: int
    in_progress_tasks_count: int
    completed_tasks_count: int
    active_task: dict[str, Any] | None = None
    is_daemon_active: bool = False
    recent_events: list[dict] = Field(default_factory=list)


class SupervisorToggleRequest(BaseModel):
    action: str = Field(description="PLAY, PAUSE, or TICK")


# ── Executive Email Thread & Multi-Agent Delegation Schemas ─────────────────


class ExecutiveThreadMessageItem(BaseModel):
    id: str
    thread_id: str
    sender_id: str | None = None
    sender_name: str
    sender_role: str
    to_name: str
    to_role: str
    cc_names: list[str] = Field(default_factory=list)
    subject: str
    body: str
    message_type: str = Field(default="MESSAGE", description="OPERATOR | CTO_DELEGATION | AGENT_REPLY | COUNCIL_REVIEW")
    stance: str | None = None
    confidence: float | None = None
    delegated_tasks: list[dict[str, Any]] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    created_at: str


class ExecutiveThreadResponse(BaseModel):
    thread_id: str
    subject: str
    thread_type: str = Field(default="CTO_DIRECTIVE", description="CTO_DIRECTIVE | AGENT_DIRECT | COUNCIL_DEBATE")
    status: str = Field(default="ACTIVE", description="ACTIVE | DELEGATED | DELIBERATING | RESOLVED")
    participants: list[dict[str, str]] = Field(default_factory=list)
    messages: list[ExecutiveThreadMessageItem] = Field(default_factory=list)
    spec_summary: str | None = None
    technical_rationale: str | None = None
    extracted_tasks: list[dict[str, Any]] = Field(default_factory=list)
    disagreements: list[dict[str, str]] = Field(default_factory=list)
    adr_status: str = "ACTIVE"
    deliberation_id: str | None = None
    updated_at: str


class ExecutiveThreadSendRequest(BaseModel):
    thread_id: str | None = None
    subject: str | None = None
    target_agent_id: uuid.UUID | None = None
    cc_agent_ids: list[uuid.UUID] = Field(default_factory=list)
    body: str = Field(min_length=1, max_length=4000)
    priority: str = Field(default="HIGH")
    auto_delegate: bool = Field(default=True)

