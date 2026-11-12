"""
Pydantic Schemas for NEIMAN Resource Engine.
Covers:
- Resource Pools (Capacity limits, allocation, availability)
- Resource Budgets (USD, token budgets, alerts)
- Resource Requests (Compute, Intelligence, Operational, Priority, Justification)
- Resource Allocations (Active reservations, expiry, release)
- Resource Usage Records (OBSERVED vs ESTIMATED real telemetry)
- Resource Control Center Analytics & Bottleneck insights
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from nexora.core.enums import (
    MetricState,
    ResourceCategory,
    ResourceEvaluationDecision,
    ResourcePriority,
)

# ==========================================
# RESOURCE POOL SCHEMAS
# ==========================================


class ResourcePoolCreate(BaseModel):
    name: str = Field(..., max_length=150)
    category: ResourceCategory
    description: str | None = None
    total_capacity: float = Field(..., gt=0.0, description="Total limited capacity quota")
    unit: str = Field(..., max_length=50, description="cores | GB | tokens | USD | slots | minutes")


class ResourcePoolUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    total_capacity: float | None = Field(None, gt=0.0)
    is_active: bool | None = None


class ResourcePoolResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    category: str
    description: str | None
    total_capacity: float
    unit: str
    allocated_capacity: float
    observed_usage: float
    available_capacity: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# RESOURCE BUDGET SCHEMAS
# ==========================================


class ResourceBudgetCreate(BaseModel):
    name: str = Field(..., max_length=150)
    department_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    fiscal_period: str = "MONTHLY"
    total_budget_usd: float = Field(..., ge=0.0)
    total_token_allowance: int = Field(default=10_000_000, ge=0)
    alert_threshold_percent: float = Field(default=80.0, ge=1.0, le=100.0)


class ResourceBudgetUpdate(BaseModel):
    name: str | None = None
    total_budget_usd: float | None = Field(None, ge=0.0)
    total_token_allowance: int | None = Field(None, ge=0)
    alert_threshold_percent: float | None = Field(None, ge=1.0, le=100.0)


class ResourceBudgetResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    department_id: uuid.UUID | None
    project_id: uuid.UUID | None
    name: str
    fiscal_period: str
    total_budget_usd: float
    spent_budget_usd: float
    reserved_budget_usd: float
    remaining_budget_usd: float
    total_token_allowance: int
    consumed_tokens: int
    reserved_tokens: int
    remaining_tokens: int
    alert_threshold_percent: float
    is_exhausted: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# RESOURCE REQUEST & EVALUATION SCHEMAS
# ==========================================


class RequestedComputeSpec(BaseModel):
    cpu_cores: float = Field(default=1.0, ge=0.0)
    ram_gb: float = Field(default=2.0, ge=0.0)
    gpu_required: bool = False
    gpu_count: int = Field(default=0, ge=0)
    storage_gb: float = Field(default=1.0, ge=0.0)
    network_mbps: float = Field(default=10.0, ge=0.0)


class RequestedIntelligenceSpec(BaseModel):
    tokens: int = Field(default=50_000, ge=0)
    api_requests: int = Field(default=10, ge=0)
    max_inference_cost_usd: float = Field(default=1.0, ge=0.0)
    preferred_model: str | None = None
    fallback_allowed: bool = True


class RequestedOperationalSpec(BaseModel):
    runtime_minutes: float = Field(default=15.0, ge=0.0)
    slots_needed: int = Field(default=1, ge=1)
    requires_human_approval: bool = False


class ResourceRequestCreate(BaseModel):
    agent_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    priority: ResourcePriority = ResourcePriority.NORMAL
    justification: str = Field(..., min_length=5, description="Business justification for request")
    requested_compute: RequestedComputeSpec = Field(default_factory=RequestedComputeSpec)
    requested_intelligence: RequestedIntelligenceSpec = Field(
        default_factory=RequestedIntelligenceSpec
    )
    requested_operational: RequestedOperationalSpec = Field(
        default_factory=RequestedOperationalSpec
    )
    expected_value_score: float = Field(
        default=5.0, ge=1.0, le=10.0, description="Expected organizational ROI (1-10)"
    )


class ResourceEvaluationResult(BaseModel):
    decision: ResourceEvaluationDecision
    decision_reason: str
    adjusted_compute: dict[str, Any] | None = None
    adjusted_intelligence: dict[str, Any] | None = None
    adjusted_operational: dict[str, Any] | None = None
    allocated_pool_ids: list[uuid.UUID] = Field(default_factory=list)
    queue_position: int | None = None
    suggested_defer_seconds: int | None = None


class ResourceRequestResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    agent_id: uuid.UUID | None
    task_id: uuid.UUID | None
    priority: str
    justification: str
    requested_compute: dict[str, Any]
    requested_intelligence: dict[str, Any]
    requested_operational: dict[str, Any]
    applicable_budget_ids: list[uuid.UUID]
    decision: str | None
    decision_reason: str | None
    evaluated_at: datetime | None
    actual_cost_usd: float
    actual_tokens: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# RESOURCE ALLOCATION SCHEMAS
# ==========================================


class ResourceAllocationResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    pool_id: uuid.UUID
    request_id: uuid.UUID
    allocated_amount: float
    unit: str
    status: str
    expires_at: datetime | None
    released_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResourceReleaseRequest(BaseModel):
    reason: str = "Task completed successfully"


# ==========================================
# RESOURCE USAGE RECORD (TELEMETRY) SCHEMAS
# ==========================================


class ResourceUsageRecordCreate(BaseModel):
    allocation_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    metric_state: MetricState = MetricState.OBSERVED
    resource_type: str = Field(
        ..., description="cpu_cores | memory_mb | tokens | cost_usd | duration_seconds"
    )
    amount: float = Field(..., ge=0.0)
    unit: str = Field(..., max_length=50)
    details: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_token_amount(self) -> "ResourceUsageRecordCreate":
        if self.resource_type.strip().lower() in {"token", "tokens"} and not self.amount.is_integer():
            raise ValueError("Token usage amount must be a whole number.")
        return self


class ResourceUsageRecordResponse(BaseModel):
    id: uuid.UUID
    allocation_id: uuid.UUID
    company_id: uuid.UUID
    agent_id: uuid.UUID | None
    task_id: uuid.UUID | None
    metric_state: str
    resource_type: str
    amount: float
    unit: str
    details: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# RESOURCE CONTROL CENTER / ANALYTICS SCHEMAS
# ==========================================


class CapacityOverviewItem(BaseModel):
    category: str
    unit: str
    limited_capacity: float
    allocated_capacity: float
    available_capacity: float
    observed_usage: float
    utilization_percentage: float


class ExpensiveTaskSummary(BaseModel):
    task_id: uuid.UUID | None
    task_title: str
    agent_name: str | None
    cost_usd: float
    tokens_consumed: int
    cpu_duration_seconds: float


class ResourceBottleneckItem(BaseModel):
    pool_id: uuid.UUID
    pool_name: str
    category: str
    utilization_percentage: float
    queued_requests_count: int
    severity: str = "NORMAL"  # NORMAL | HIGH | CRITICAL
    recommendation: str


class ProviderUsageMetric(BaseModel):
    provider_name: str
    total_tokens: int
    total_cost_usd: float
    request_count: int


class ResourceControlCenterResponse(BaseModel):
    company_id: uuid.UUID
    generated_at: datetime
    capacities: list[CapacityOverviewItem]
    budget_consumption: dict[str, Any]
    active_allocations_count: int
    queued_requests_count: int
    bottlenecks: list[ResourceBottleneckItem]
    expensive_tasks: list[ExpensiveTaskSummary]
    provider_usage: list[ProviderUsageMetric]
    system_host_telemetry: dict[str, Any]
