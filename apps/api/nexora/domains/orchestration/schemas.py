"""
Pydantic v2 schemas and typed contracts for NEIMAN Production-Minded Agent Orchestration Core.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class OrchestrationStatus(str, Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    RUNNING = "RUNNING"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMED_OUT = "TIMED_OUT"
    ESCALATED = "ESCALATED"


class MemoryScope(str, Enum):
    AGENT_PRIVATE = "AGENT_PRIVATE"
    PROJECT_SHARED = "PROJECT_SHARED"
    COMPANY_WIDE = "COMPANY_WIDE"


class VerificationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    PENDING_REVIEW = "PENDING_REVIEW"
    ESCALATED = "ESCALATED"


# ---------------------------------------------------------------------------
# 1. TASK & DEPENDENCY GRAPH SCHEMAS
# ---------------------------------------------------------------------------


class OrchestrationTaskSpec(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    capabilities_required: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list, description="IDs of tasks that must complete first")
    input_data: dict[str, Any] = Field(default_factory=dict)
    expected_outcome: str = ""
    priority: int = Field(default=3, ge=1, le=5, description="1=Lowest, 5=Highest/Critical")
    timeout_seconds: int = Field(default=300, ge=1, le=86400)
    max_retries: int = Field(default=3, ge=0, le=10)
    assigned_agent_id: str | None = None
    status: OrchestrationStatus = OrchestrationStatus.PENDING
    result_data: dict[str, Any] = Field(default_factory=dict)


class TaskDependencyGraphSpec(BaseModel):
    graph_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    tasks: list[OrchestrationTaskSpec] = Field(default_factory=list)
    max_concurrency: int = Field(default=4, ge=1, le=32)


class GraphValidationResult(BaseModel):
    is_valid: bool
    has_cycles: bool = False
    cycle_nodes: list[str] = Field(default_factory=list)
    topological_order: list[str] = Field(default_factory=list)
    unreachable_tasks: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 2. TASK CLAIMING SCHEMAS
# ---------------------------------------------------------------------------


class TaskClaimRequest(BaseModel):
    agent_id: str
    agent_name: str
    capabilities: list[str] = Field(default_factory=list)
    max_tasks: int = Field(default=1, ge=1, le=10)
    lease_duration_seconds: int = Field(default=120, ge=10, le=3600)


class TaskClaimResponse(BaseModel):
    success: bool
    claimed_tasks: list[OrchestrationTaskSpec] = Field(default_factory=list)
    lease_expires_at: datetime | None = None
    reason: str = ""


# ---------------------------------------------------------------------------
# 3. CHECKPOINTS & RECOVERABLE EXECUTION STATE
# ---------------------------------------------------------------------------


class DurableExecutionCheckpoint(BaseModel):
    checkpoint_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str
    task_id: str
    step_index: int
    step_name: str
    state_snapshot: dict[str, Any] = Field(default_factory=dict)
    tokens_consumed: int = 0
    cost_usd: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    hash_signature: str = ""


class RecoverableExecutionState(BaseModel):
    run_id: str
    status: OrchestrationStatus
    completed_steps: list[int] = Field(default_factory=list)
    last_checkpoint: DurableExecutionCheckpoint | None = None
    accumulated_state: dict[str, Any] = Field(default_factory=dict)
    total_tokens_consumed: int = 0
    total_cost_usd: float = 0.0
    is_recoverable: bool = True
    recovery_reason: str = ""


# ---------------------------------------------------------------------------
# 4. STRUCTURED TRACEABLE AUTONOMOUS RUNS
# ---------------------------------------------------------------------------


class RunBudget(BaseModel):
    allocated_usd: float = Field(default=5.0, ge=0.0)
    consumed_usd: float = Field(default=0.0, ge=0.0)
    max_tokens: int = Field(default=100_000, ge=1_000)
    consumed_tokens: int = Field(default=0, ge=0)
    is_exhausted: bool = False


class RunAuthority(BaseModel):
    position_key: str
    autonomy_level: int = Field(default=3, ge=1, le=5)
    authorized_by: str = "SYSTEM_GOVERNANCE"
    granted_tools: list[str] = Field(default_factory=list)
    denied_tools: list[str] = Field(default_factory=list)
    allowed_file_paths: list[str] = Field(default_factory=lambda: ["/workspace", "/tmp"])


class RunVerification(BaseModel):
    status: VerificationStatus = VerificationStatus.PENDING_REVIEW
    verifier: str = "AUTONOMOUS_VERIFICATION_PROBE"
    checks_passed: list[str] = Field(default_factory=list)
    score: float = Field(default=1.0, ge=0.0, le=1.0)
    details: dict[str, Any] = Field(default_factory=dict)


class AutonomousRunRecord(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    agent_id: str
    task_id: str
    # 5 Mandated Canonical Pillars: Goal, Budget, Authority, Result, Verification
    goal: str
    budget: RunBudget = Field(default_factory=RunBudget)
    authority: RunAuthority
    result: dict[str, Any] = Field(default_factory=dict)
    verification: RunVerification = Field(default_factory=RunVerification)
    status: OrchestrationStatus = OrchestrationStatus.PENDING
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    duration_ms: float = 0.0
    checkpoints: list[DurableExecutionCheckpoint] = Field(default_factory=list)
    delegation_depth: int = 0
    parent_run_id: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# 5. DELEGATION & ESCALATION SCHEMAS
# ---------------------------------------------------------------------------


class AgentDelegationSpec(BaseModel):
    delegation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parent_run_id: str
    delegator_agent_id: str
    target_agent_id: str
    subtask: OrchestrationTaskSpec
    current_depth: int = Field(default=1, ge=1)
    max_depth: int = Field(default=3, ge=1, le=5)


class EscalationEvent(BaseModel):
    escalation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str
    agent_id: str
    severity: str = "HIGH"  # CRITICAL, HIGH, MEDIUM, LOW
    reason: str
    context_snapshot: dict[str, Any] = Field(default_factory=dict)
    escalated_to: str = "CEO_HUMAN_OWNER"
    status: str = "OPEN"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ---------------------------------------------------------------------------
# 6. DURABLE MEMORY PROVENANCE & RETENTION
# ---------------------------------------------------------------------------


class DurableMemoryItem(BaseModel):
    memory_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    actor_id: str
    task_id: str | None = None
    run_id: str | None = None
    scope: MemoryScope = MemoryScope.PROJECT_SHARED
    content: str
    content_hash: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    importance: float = Field(default=0.7, ge=0.0, le=1.0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = None
    is_tombstoned: bool = False
