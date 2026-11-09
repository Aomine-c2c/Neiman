"""
Pydantic Schemas for NEIMAN Organizational Performance & Evolution Engine.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from nexora.core.enums import (
    AdaptationStage,
    AdaptationStatus,
    AdaptationType,
    PerformanceDimension,
)


# -------------------------------------------------------------
# PERFORMANCE SCHEMAS
# -------------------------------------------------------------
class PerformanceMetricCreate(BaseModel):
    dimension: PerformanceDimension
    target_id: str
    target_name: str
    metric_name: str
    actual_value: float
    expected_value: float | None = None
    unit: str = "ratio"
    sample_size: int = 1
    evidence: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


class PerformanceMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    dimension: PerformanceDimension
    target_id: str
    target_name: str
    metric_name: str
    actual_value: float
    expected_value: float | None
    unit: str
    sample_size: int
    evidence: dict[str, Any]
    notes: str | None
    created_at: datetime


class CustomKPICreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    industry: str | None = None
    dimension: PerformanceDimension
    metric_key: str
    target_benchmark: float
    warning_threshold: float | None = None
    unit: str = "%"


class CustomKPIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    description: str | None
    industry: str | None
    dimension: PerformanceDimension
    metric_key: str
    target_benchmark: float
    warning_threshold: float | None
    unit: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PerformanceDimensionSummary(BaseModel):
    dimension: PerformanceDimension
    completion_rate_pct: float
    failure_rate_pct: float
    avg_cycle_time_ms: float
    resource_efficiency_score: float
    cost_usd: float
    rework_count: int
    quality_score: float
    human_interventions: int
    escalation_frequency: int
    provider_reliability_pct: float
    task_success_rate_pct: float
    breakdown_by_target: list[dict[str, Any]] = Field(default_factory=list)


# -------------------------------------------------------------
# EVOLUTION ENGINE SCHEMAS
# -------------------------------------------------------------
class OrganizationalSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    reason: str
    snapshot_data: dict[str, Any]
    version: int
    created_at: datetime


class AdaptationProposeRequest(BaseModel):
    title: str = Field(min_length=5, max_length=255)
    adaptation_type: AdaptationType
    trigger_diagnosis: str = Field(min_length=10)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    previous_state: dict[str, Any] = Field(default_factory=dict)
    proposed_state: dict[str, Any] = Field(default_factory=dict)
    expected_improvement: str = Field(min_length=10)
    risk_assessment: str = Field(min_length=10)
    risk_level: str = "MEDIUM"


class AdaptationSimulateRequest(BaseModel):
    synthetic_task_count: int = Field(default=20, ge=5, le=100)
    stress_multiplier: float = Field(default=1.5, ge=1.0, le=5.0)


class AdaptationApproveRequest(BaseModel):
    reviewer_notes: str = "Approved for evolutionary deployment"


class AdaptationRollbackRequest(BaseModel):
    rollback_reason: str = Field(min_length=10)
    learning_notes: str = Field(min_length=10)


class OrganizationalAdaptationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    title: str
    adaptation_type: AdaptationType
    stage: AdaptationStage
    status: AdaptationStatus
    trigger_diagnosis: str
    evidence: list[dict[str, Any]]
    previous_state: dict[str, Any]
    proposed_state: dict[str, Any]
    expected_improvement: str
    risk_assessment: str
    risk_level: str
    simulation_results: dict[str, Any]
    validation_passed: bool
    snapshot_id: uuid.UUID | None = None
    approved_by: str | None = None
    deployed_at: str | None = None
    actual_result: dict[str, Any]
    rollback_reason: str | None = None
    learning_notes: str | None = None
    created_at: datetime
    updated_at: datetime


# ==========================================
# SIMULATION LAB SCHEMAS
# ==========================================


class SimulationScenarioCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    simulated_config: dict[str, Any] = Field(
        default_factory=dict,
        description="Alternative agent structures, model routing, workflows, resource allocation, policies, strategies",
    )
    workload_profile: dict[str, Any] = Field(
        default_factory=lambda: {
            "tasks_count": 50,
            "concurrency": 5,
            "profile_type": "BALANCED_ENTERPRISE",
        },
        description="Controlled workload to run against the configuration",
    )


class SimulationScenarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    description: str | None = None
    is_active: bool
    baseline_config: dict[str, Any]
    simulated_config: dict[str, Any]
    workload_profile: dict[str, Any]
    status: str
    is_promoted: bool
    promoted_at: str | None = None
    promoted_by: str | None = None
    created_at: datetime
    updated_at: datetime


class SimulationRunRequest(BaseModel):
    run_label: str = Field(default="Controlled Benchmark Trial", max_length=255)
    workload_tasks_count: int = Field(default=50, ge=1, le=500)
    concurrency_level: int = Field(default=5, ge=1, le=50)


class SimulationRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scenario_id: uuid.UUID
    company_id: uuid.UUID
    run_label: str
    workload_tasks_count: int
    tasks_succeeded: int
    tasks_failed: int
    duration_ms: float
    metrics_comparison: dict[str, Any]
    experimental_disclaimer: str
    insights: list[str]
    created_at: datetime


class SimulationPromoteRequest(BaseModel):
    approver: str = Field(default="System Admin / Executive", max_length=255)
    notes: str | None = None
