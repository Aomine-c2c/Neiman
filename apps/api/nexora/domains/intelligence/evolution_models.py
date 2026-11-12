"""
Performance and Evolution Engine Models.

Implements:
1. Performance Metrics & Custom KPIs:
   - Multidimensional metrics across: Company, Department, Project, Workflow, Role, Agent, Model/Provider, Task.
   - Core metrics: completion rate, failure rate, cycle time, resource efficiency, cost, rework, quality, human intervention, escalation frequency, provider reliability, task success.
   - Expected vs Actual outcome tracking.
   - Custom KPI definitions per company/industry.

2. Evolution Engine & Organizational Adaptation:
   - Never arbitrary self-modification. Controlled, observable improvement.
   - Follows strict lifecycle:
     OBSERVE -> DIAGNOSE -> PROPOSE -> SIMULATE -> EVALUATE -> VALIDATE -> APPROVE -> DEPLOY -> MONITOR -> ROLLBACK.
   - Immutable organizational snapshots before change.
   - Rollback treated as valuable learning information.
"""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, Float, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from nexora.core.base import UUIDCreatedAtBase, UUIDTimestampBase
from nexora.core.enums import (
    AdaptationStage,
    AdaptationStatus,
    AdaptationType,
    PerformanceDimension,
)

if TYPE_CHECKING:
    pass


class PerformanceMetricRecord(UUIDCreatedAtBase):
    """
    Immutable observation metric tracking actual vs expected outcomes
    across 8 distinct organizational dimensions.
    """

    __tablename__ = "performance_metric_records"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    dimension: Mapped[PerformanceDimension] = mapped_column(
        SAEnum(PerformanceDimension, name="performance_dimension"), nullable=False, index=True
    )
    target_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, comment="UUID or slug of agent/dept/workflow/model"
    )
    target_name: Mapped[str] = mapped_column(String(255), nullable=False)

    metric_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="e.g. completion_rate, failure_rate, cycle_time_ms, cost_usd, quality_score",
    )

    actual_value: Mapped[float] = mapped_column(Float, nullable=False)
    expected_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(50), default="ratio", nullable=False)

    sample_size: Mapped[int] = mapped_column(default=1, nullable=False)
    evidence: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False, comment="Contextual evidence, logs, benchmark trace"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CustomKPIDefinition(UUIDTimestampBase):
    """
    Custom Key Performance Indicator definition configured per company & industry.
    """

    __tablename__ = "custom_kpi_definitions"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)

    dimension: Mapped[PerformanceDimension] = mapped_column(
        SAEnum(PerformanceDimension, name="kpi_performance_dimension"), nullable=False
    )
    metric_key: Mapped[str] = mapped_column(String(100), nullable=False)
    target_benchmark: Mapped[float] = mapped_column(Float, nullable=False)
    warning_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(50), default="%", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class OrganizationalSnapshot(UUIDCreatedAtBase):
    """
    Immutable state snapshot of organizational structure, agent configs,
    system prompts, workflows, and resource allocations prior to adaptation.
    """

    __tablename__ = "organizational_snapshots"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    snapshot_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="Complete serialized organization state (agents, prompts, routing, workflows)",
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)


class OrganizationalAdaptation(UUIDTimestampBase):
    """
    Controlled organizational adaptation in the Evolution Engine.
    Requires simulated validation and human approval before deployment.
    Preserves rollback information as valuable learning data.
    """

    __tablename__ = "organizational_adaptations"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    adaptation_type: Mapped[AdaptationType] = mapped_column(
        SAEnum(AdaptationType, name="adaptation_type"), nullable=False
    )
    stage: Mapped[AdaptationStage] = mapped_column(
        SAEnum(AdaptationStage, name="adaptation_stage"),
        default=AdaptationStage.PROPOSE,
        nullable=False,
    )
    status: Mapped[AdaptationStatus] = mapped_column(
        SAEnum(AdaptationStatus, name="adaptation_status"),
        default=AdaptationStatus.PROPOSED,
        nullable=False,
        index=True,
    )

    # Observation & Diagnosis
    trigger_diagnosis: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Identified bottleneck, failure, or waste"
    )
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False, comment="Multidimensional performance evidence"
    )

    # State Diff
    previous_state: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False, comment="State prior to adaptation"
    )
    proposed_state: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False, comment="Target state modification"
    )

    # Risk & Improvement Expectations
    expected_improvement: Mapped[str] = mapped_column(Text, nullable=False)
    risk_assessment: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(50), default="MEDIUM", nullable=False)

    # Simulation & Lab Validation
    simulation_results: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Monte Carlo / synthetic execution results in Lab",
    )
    validation_passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Approval & Deployment
    snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizational_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deployed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Post-Deployment Monitoring & Learning
    actual_result: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False, comment="Observed metrics post-deployment"
    )
    rollback_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    learning_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Knowledge acquired from this evolution trial (even if rolled back)",
    )


class SimulationScenario(UUIDTimestampBase):
    """
    An experimental organizational simulation scenario (e.g. Simulation A, Simulation B, Simulation C)
    branching from the current organization. Allows testing alternative agent structures, model routing,
    workflows, resource allocations, policies, and strategies against controlled workloads.
    """

    __tablename__ = "simulation_scenarios"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Base vs Simulated Organization Configuration
    baseline_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Snapshot of active organization (agents, budget, routing)",
    )
    simulated_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Modified parameters: agent count/specs, model routing, workflows, budget cap, policies",
    )

    # Workload profile for benchmark
    workload_profile: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Specification of synthetic/replayed tasks, query volume, and concurrency",
    )

    # Status & Promotion
    status: Mapped[str] = mapped_column(
        String(50),
        default="DRAFT",
        nullable=False,
        comment="DRAFT | RUNNING | EVALUATED | PROMOTED | ARCHIVED",
    )
    is_promoted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    promoted_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    promoted_by: Mapped[str | None] = mapped_column(String(255), nullable=True)


class SimulationRun(UUIDCreatedAtBase):
    """
    A single controlled execution trial of a SimulationScenario against workload.
    Results are strictly labeled as experimental results, not guaranteed future outcomes.
    """

    __tablename__ = "simulation_runs"

    scenario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("simulation_scenarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_label: Mapped[str] = mapped_column(String(255), nullable=False)

    # Execution telemetry
    workload_tasks_count: Mapped[int] = mapped_column(default=50, nullable=False)
    tasks_succeeded: Mapped[int] = mapped_column(default=0, nullable=False)
    tasks_failed: Mapped[int] = mapped_column(default=0, nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Comparative Metrics (Simulated vs Baseline)
    metrics_comparison: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Direct comparison: cost delta, latency delta, throughput, failure rate, quality score",
    )

    # Experimental Disclaimers & Notes
    experimental_disclaimer: Mapped[str] = mapped_column(
        Text,
        default="EXPERIMENTAL SIMULATION ONLY: Results represent synthetic modeled performance and are not guaranteed future production outcomes.",
        nullable=False,
    )
    insights: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
