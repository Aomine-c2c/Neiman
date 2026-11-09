"""
Resource Engine Repository.
Handles DB persistence and querying for:
- Resource Pools
- Resource Budgets
- Resource Requests
- Resource Allocations
- Resource Usage Records (OBSERVED & ESTIMATED)
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import case, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import AllocationStatus, MetricState
from nexora.domains.resources.models import (
    ResourceAllocation,
    ResourceBudget,
    ResourcePool,
    ResourceRequest,
    ResourceUsageRecord,
)


class ResourceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------
    # RESOURCE POOLS
    # -------------------------------------------------------------
    async def create_pool(
        self,
        company_id: uuid.UUID,
        name: str,
        category: str,
        total_capacity: float,
        unit: str,
        description: str | None = None,
    ) -> ResourcePool:
        pool = ResourcePool(
            company_id=company_id,
            name=name,
            category=category,
            total_capacity=total_capacity,
            unit=unit,
            description=description,
            allocated_capacity=0.0,
            observed_usage=0.0,
            is_active=True,
        )
        self.db.add(pool)
        await self.db.flush()
        await self.db.refresh(pool)
        return pool

    async def get_pool(
        self, pool_id: uuid.UUID, company_id: uuid.UUID, for_update: bool = False
    ) -> ResourcePool | None:
        stmt = select(ResourcePool).where(
            ResourcePool.id == pool_id,
            ResourcePool.company_id == company_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_pools(
        self,
        company_id: uuid.UUID,
        category: str | None = None,
        for_update: bool = False,
    ) -> list[ResourcePool]:
        stmt = select(ResourcePool).where(ResourcePool.company_id == company_id)
        if category:
            stmt = stmt.where(ResourcePool.category == category)
        stmt = stmt.order_by(ResourcePool.category, ResourcePool.name)
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_pool_capacity(
        self,
        pool: ResourcePool,
        allocated_delta: float = 0.0,
        observed_delta: float = 0.0,
    ) -> ResourcePool:
        pool.allocated_capacity = max(0.0, pool.allocated_capacity + allocated_delta)
        pool.observed_usage = max(0.0, pool.observed_usage + observed_delta)
        await self.db.flush()
        await self.db.refresh(pool)
        return pool

    # -------------------------------------------------------------
    # RESOURCE BUDGETS
    # -------------------------------------------------------------
    async def create_budget(
        self,
        company_id: uuid.UUID,
        name: str,
        total_budget_usd: float,
        total_token_allowance: int = 10_000_000,
        department_id: uuid.UUID | None = None,
        project_id: uuid.UUID | None = None,
        fiscal_period: str = "MONTHLY",
        alert_threshold_percent: float = 80.0,
    ) -> ResourceBudget:
        budget = ResourceBudget(
            company_id=company_id,
            department_id=department_id,
            project_id=project_id,
            name=name,
            fiscal_period=fiscal_period,
            total_budget_usd=total_budget_usd,
            spent_budget_usd=0.0,
            total_token_allowance=total_token_allowance,
            consumed_tokens=0,
            reserved_budget_usd=0.0,
            reserved_tokens=0,
            alert_threshold_percent=alert_threshold_percent,
            is_exhausted=False,
        )
        self._refresh_budget_exhaustion(budget)
        self.db.add(budget)
        await self.db.flush()
        await self.db.refresh(budget)
        return budget

    async def get_budget(
        self, budget_id: uuid.UUID, company_id: uuid.UUID, for_update: bool = False
    ) -> ResourceBudget | None:
        stmt = select(ResourceBudget).where(
            ResourceBudget.id == budget_id,
            ResourceBudget.company_id == company_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def adjust_budget_reservation(
        self,
        budget: ResourceBudget,
        usd_delta: float = 0.0,
        token_delta: int = 0,
    ) -> ResourceBudget:
        budget.reserved_budget_usd = max(0.0, budget.reserved_budget_usd + usd_delta)
        budget.reserved_tokens = max(0, budget.reserved_tokens + token_delta)
        self._refresh_budget_exhaustion(budget)
        await self.db.flush()
        return budget

    @staticmethod
    def _refresh_budget_exhaustion(budget: ResourceBudget) -> None:
        active_limits = []
        if budget.total_budget_usd > 0:
            active_limits.append(
                budget.spent_budget_usd + budget.reserved_budget_usd >= budget.total_budget_usd
            )
        if budget.total_token_allowance > 0:
            active_limits.append(
                budget.consumed_tokens + budget.reserved_tokens >= budget.total_token_allowance
            )
        budget.is_exhausted = not active_limits or all(active_limits)

    async def list_budgets(
        self,
        company_id: uuid.UUID,
        for_update: bool = False,
        budget_ids: list[uuid.UUID] | None = None,
    ) -> list[ResourceBudget]:
        stmt = select(ResourceBudget).where(ResourceBudget.company_id == company_id)
        if budget_ids is not None:
            if not budget_ids:
                return []
            stmt = stmt.where(ResourceBudget.id.in_(budget_ids))
        stmt = stmt.order_by(ResourceBudget.id)
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_legacy_budget_totals(self, company_id: uuid.UUID) -> dict[str, float | int]:
        """Read historical, unledgered approvals without mutating past accounting."""
        observed_usage = (
            select(
                ResourceAllocation.request_id.label("request_id"),
                func.sum(
                    case(
                        (ResourceUsageRecord.resource_type == "cost_usd", ResourceUsageRecord.amount),
                        else_=0.0,
                    )
                ).label("actual_cost_usd"),
                func.sum(
                    case(
                        (
                            ResourceUsageRecord.resource_type.in_(["token", "tokens"]),
                            ResourceUsageRecord.amount,
                        ),
                        else_=0,
                    )
                ).label("actual_tokens"),
            )
            .join(
                ResourceUsageRecord,
                ResourceUsageRecord.allocation_id == ResourceAllocation.id,
            )
            .where(
                ResourceUsageRecord.company_id == company_id,
                ResourceUsageRecord.metric_state == MetricState.OBSERVED.value,
            )
            .group_by(ResourceAllocation.request_id)
            .subquery()
        )
        active_allocations = (
            select(ResourceAllocation.request_id)
            .where(
                ResourceAllocation.company_id == company_id,
                ResourceAllocation.status == AllocationStatus.ACTIVE.value,
            )
            .distinct()
        )
        stmt = (
            select(
                ResourceRequest,
                func.coalesce(observed_usage.c.actual_cost_usd, 0.0),
                func.coalesce(observed_usage.c.actual_tokens, 0),
                exists(active_allocations.where(ResourceAllocation.request_id == ResourceRequest.id)),
            )
            .outerjoin(observed_usage, observed_usage.c.request_id == ResourceRequest.id)
            .where(
                ResourceRequest.company_id == company_id,
                ResourceRequest.decision == "APPROVE",
                ResourceRequest.budget_accounting_managed.is_(False),
            )
        )
        rows = (await self.db.execute(stmt)).all()

        totals: dict[str, float | int] = {
            "spent_usd": 0.0,
            "spent_tokens": 0,
            "reserved_usd": 0.0,
            "reserved_tokens": 0,
        }
        for request, actual_cost, actual_tokens, has_active_allocations in rows:
            actual_cost = float(actual_cost or 0.0)
            actual_tokens = int(actual_tokens or 0)
            totals["spent_usd"] += actual_cost
            totals["spent_tokens"] += actual_tokens
            if has_active_allocations:
                requested = request.requested_intelligence or {}
                totals["reserved_usd"] += max(
                    0.0,
                    float(requested.get("max_inference_cost_usd", 0) or 0) - actual_cost,
                )
                totals["reserved_tokens"] += max(
                    0,
                    int(requested.get("tokens", 0) or 0) - actual_tokens,
                )
        return totals

    async def record_budget_expenditure(
        self,
        budget: ResourceBudget,
        usd_spent: float = 0.0,
        tokens_consumed: int = 0,
    ) -> ResourceBudget:
        budget.spent_budget_usd += usd_spent
        budget.consumed_tokens += tokens_consumed
        self._refresh_budget_exhaustion(budget)
        await self.db.flush()
        await self.db.refresh(budget)
        return budget

    # -------------------------------------------------------------
    # RESOURCE REQUESTS
    # -------------------------------------------------------------
    async def create_request(
        self,
        company_id: uuid.UUID,
        justification: str,
        priority: str,
        requested_compute: dict,
        requested_intelligence: dict,
        requested_operational: dict,
        applicable_budget_ids: list[uuid.UUID],
        agent_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
    ) -> ResourceRequest:
        req = ResourceRequest(
            company_id=company_id,
            agent_id=agent_id,
            task_id=task_id,
            priority=priority,
            justification=justification,
            requested_compute=requested_compute,
            requested_intelligence=requested_intelligence,
            requested_operational=requested_operational,
            applicable_budget_ids=[str(budget_id) for budget_id in applicable_budget_ids],
            decision=None,
            decision_reason=None,
            evaluated_at=None,
        )
        self.db.add(req)
        await self.db.flush()
        await self.db.refresh(req)
        return req

    async def get_request(
        self, request_id: uuid.UUID, company_id: uuid.UUID, for_update: bool = False
    ) -> ResourceRequest | None:
        stmt = select(ResourceRequest).where(
            ResourceRequest.id == request_id,
            ResourceRequest.company_id == company_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_requests(
        self,
        company_id: uuid.UUID,
        decision: str | None = None,
        agent_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[ResourceRequest]:
        stmt = select(ResourceRequest).where(ResourceRequest.company_id == company_id)
        if decision:
            stmt = stmt.where(ResourceRequest.decision == decision)
        if agent_id:
            stmt = stmt.where(ResourceRequest.agent_id == agent_id)
        stmt = stmt.order_by(ResourceRequest.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_request_decision(
        self,
        request: ResourceRequest,
        decision: str,
        reason: str,
    ) -> ResourceRequest:
        request.decision = decision
        request.decision_reason = reason
        request.evaluated_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(request)
        return request

    # -------------------------------------------------------------
    # RESOURCE ALLOCATIONS
    # -------------------------------------------------------------
    async def create_allocation(
        self,
        company_id: uuid.UUID,
        pool_id: uuid.UUID,
        request_id: uuid.UUID,
        amount: float,
        unit: str,
        expires_at: datetime | None = None,
    ) -> ResourceAllocation:
        alloc = ResourceAllocation(
            company_id=company_id,
            pool_id=pool_id,
            request_id=request_id,
            allocated_amount=amount,
            unit=unit,
            status=AllocationStatus.ACTIVE.value,
            expires_at=expires_at,
        )
        self.db.add(alloc)
        await self.db.flush()
        await self.db.refresh(alloc)
        return alloc

    async def get_allocation(
        self, allocation_id: uuid.UUID, company_id: uuid.UUID, for_update: bool = False
    ) -> ResourceAllocation | None:
        stmt = select(ResourceAllocation).where(
            ResourceAllocation.id == allocation_id,
            ResourceAllocation.company_id == company_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def count_active_allocations(self, request_id: uuid.UUID) -> int:
        from sqlalchemy import func

        result = await self.db.execute(
            select(func.count(ResourceAllocation.id)).where(
                ResourceAllocation.request_id == request_id,
                ResourceAllocation.status == AllocationStatus.ACTIVE.value,
            )
        )
        return int(result.scalar_one())

    async def list_allocations(
        self,
        company_id: uuid.UUID,
        status: str | None = None,
    ) -> list[ResourceAllocation]:
        stmt = select(ResourceAllocation).where(ResourceAllocation.company_id == company_id)
        if status:
            stmt = stmt.where(ResourceAllocation.status == status)
        stmt = stmt.order_by(ResourceAllocation.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def release_allocation(self, allocation: ResourceAllocation) -> ResourceAllocation:
        allocation.status = AllocationStatus.RELEASED.value
        allocation.released_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(allocation)
        return allocation

    # -------------------------------------------------------------
    # RESOURCE USAGE RECORDS (OBSERVED & ESTIMATED)
    # -------------------------------------------------------------
    async def record_usage(
        self,
        company_id: uuid.UUID,
        allocation_id: uuid.UUID,
        resource_type: str,
        amount: float,
        unit: str,
        metric_state: str = MetricState.OBSERVED.value,
        agent_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
        details: dict | None = None,
    ) -> ResourceUsageRecord:
        record = ResourceUsageRecord(
            company_id=company_id,
            allocation_id=allocation_id,
            agent_id=agent_id,
            task_id=task_id,
            metric_state=metric_state,
            resource_type=resource_type,
            amount=amount,
            unit=unit,
            details=details or {},
        )
        self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return record

    async def list_usage_records(
        self,
        company_id: uuid.UUID,
        task_id: uuid.UUID | None = None,
        agent_id: uuid.UUID | None = None,
        limit: int = 100,
    ) -> list[ResourceUsageRecord]:
        stmt = select(ResourceUsageRecord).where(ResourceUsageRecord.company_id == company_id)
        if task_id:
            stmt = stmt.where(ResourceUsageRecord.task_id == task_id)
        if agent_id:
            stmt = stmt.where(ResourceUsageRecord.agent_id == agent_id)
        stmt = stmt.order_by(ResourceUsageRecord.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
