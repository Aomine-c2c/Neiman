"""
NEIMAN Resource Engine Models.
Treats organizational resources as finite operational assets across:
- COMPUTE: CPU cores, RAM GB, GPU, storage GB, network bandwidth
- INTELLIGENCE: model tokens, API requests, provider quotas, inference capacity
- FINANCIAL: API spending, cloud spending, project budgets
- OPERATIONAL: agent capacity, execution slots, human approval capacity, time (minutes)

Distinguishes metric states: OBSERVED, ESTIMATED, ALLOCATED, LIMITED, AVAILABLE.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nexora.domains.organizations.models import Company

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import NexoraBase, TimestampMixin, UUIDBase


class ResourcePool(NexoraBase):
    """
    A company-wide or department-wide pool of finite capacity for a resource category.
    Example: 'Production Compute Cluster', 'Q3 Intelligence Token Pool', 'Ops Approval Slots'.
    """

    __tablename__ = "resource_pools"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Capacity limits (LIMITED)
    total_capacity: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Total quota/capacity: e.g. 32 (cores), 64 (GB), 5000000 (tokens), 1000.0 (USD)",
    )
    unit: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="cores | GB | tokens | USD | slots | minutes"
    )

    # Current dynamic state
    allocated_capacity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    observed_usage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    company: Mapped["Company"] = relationship("Company", lazy="select")  # noqa: F821
    allocations: Mapped[list["ResourceAllocation"]] = relationship(
        "ResourceAllocation", back_populates="pool", cascade="all, delete-orphan", lazy="select"
    )

    @property
    def available_capacity(self) -> float:
        return max(0.0, self.total_capacity - self.allocated_capacity)


class ResourceBudget(NexoraBase):
    """
    Financial and token operational budgets assigned to projects, departments, or agents.
    """

    __tablename__ = "resource_budgets"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(50), default="MONTHLY", nullable=False)

    # Spending limits (USD)
    total_budget_usd: Mapped[float] = mapped_column(Float, nullable=False)
    spent_budget_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reserved_budget_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Intelligence Token limits
    total_token_allowance: Mapped[int] = mapped_column(Integer, default=10_000_000, nullable=False)
    consumed_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    alert_threshold_percent: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    is_exhausted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    @property
    def remaining_budget_usd(self) -> float:
        return max(0.0, self.total_budget_usd - self.spent_budget_usd - self.reserved_budget_usd)

    @property
    def remaining_tokens(self) -> int:
        return max(0, self.total_token_allowance - self.consumed_tokens - self.reserved_tokens)


class ResourceRequest(UUIDBase, TimestampMixin):
    """
    A formal request submitted by an Agent or Task to allocate operational assets.
    Example: 4 CPU cores, 8GB RAM, 200k tokens, 30 minutes runtime, $2 max inference cost.
    """

    __tablename__ = "resource_requests"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    priority: Mapped[str] = mapped_column(String(50), default="NORMAL", nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)

    # Requirements specification (ESTIMATED)
    requested_compute: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="e.g. {'cpu_cores': 4, 'ram_gb': 8, 'gpu_required': False, 'storage_gb': 10}",
    )
    requested_intelligence: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="e.g. {'tokens': 200000, 'max_inference_cost_usd': 2.0, 'preferred_model': 'gpt-4o'}",
    )
    requested_operational: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="e.g. {'runtime_minutes': 30, 'slots_needed': 1}",
    )
    applicable_budget_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Decision evaluation result: APPROVE | DENY | DEFER | REDUCE | QUEUE
    decision: Mapped[str | None] = mapped_column(String(50), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actual_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    budget_reservation_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    budget_accounting_managed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Resulting allocations
    allocations: Mapped[list["ResourceAllocation"]] = relationship(
        "ResourceAllocation", back_populates="request", cascade="all, delete-orphan", lazy="select"
    )


class ResourceAllocation(NexoraBase):
    """
    Active committed reservation of a resource pool to a specific request / task.
    """

    __tablename__ = "resource_allocations"

    pool_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resource_pools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resource_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    allocated_amount: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)

    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    pool: Mapped["ResourcePool"] = relationship("ResourcePool", back_populates="allocations")
    request: Mapped["ResourceRequest"] = relationship(
        "ResourceRequest", back_populates="allocations"
    )
    usage_records: Mapped[list["ResourceUsageRecord"]] = relationship(
        "ResourceUsageRecord",
        back_populates="allocation",
        cascade="all, delete-orphan",
        lazy="select",
    )


class ResourceUsageRecord(UUIDBase, TimestampMixin):
    """
    Actual observed usage of an allocated resource (OBSERVED).
    Clearly demarcates observed real system telemetry vs estimated claims.
    """

    __tablename__ = "resource_usage_records"

    allocation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resource_allocations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    metric_state: Mapped[str] = mapped_column(
        String(50), default="OBSERVED", nullable=False, comment="OBSERVED | ESTIMATED"
    )
    resource_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="cpu_cores | memory_mb | tokens | cost_usd | duration_seconds",
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    allocation: Mapped["ResourceAllocation"] = relationship(
        "ResourceAllocation", back_populates="usage_records"
    )
