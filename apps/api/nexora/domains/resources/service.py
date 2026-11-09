"""
Resource Engine Service.
Orchestrates requests, allocations, real usage tracking, and the Resource Control Center.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    AllocationStatus,
    MetricState,
    ResourceCategory,
    ResourceEvaluationDecision,
)
from nexora.domains.resources.engine import ResourceEngine
from nexora.domains.resources.models import (
    ResourceAllocation,
    ResourceBudget,
    ResourcePool,
    ResourceRequest,
    ResourceUsageRecord,
)
from nexora.domains.resources.repository import ResourceRepository
from nexora.domains.resources.schemas import (
    CapacityOverviewItem,
    ExpensiveTaskSummary,
    ProviderUsageMetric,
    ResourceBottleneckItem,
    ResourceBudgetCreate,
    ResourceBudgetResponse,
    ResourceControlCenterResponse,
    ResourceEvaluationResult,
    ResourcePoolCreate,
    ResourceRequestCreate,
    ResourceUsageRecordCreate,
)
from nexora.exceptions import BusinessRuleError, NotFoundError


class ResourceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ResourceRepository(db)

    # -------------------------------------------------------------
    # DEFAULT POOLS SEEDER
    # -------------------------------------------------------------
    async def ensure_default_pools(self, company_id: uuid.UUID) -> list[ResourcePool]:
        pools = await self.repo.list_pools(company_id)
        if pools:
            return pools

        # Create baseline realistic pools
        default_configs = [
            (
                "Core Compute Cluster (CPU)",
                ResourceCategory.COMPUTE.value,
                32.0,
                "cores",
                "Physical and virtual worker CPU threads",
            ),
            (
                "Cluster Memory Pool (RAM)",
                ResourceCategory.COMPUTE.value,
                64.0,
                "GB",
                "Total accessible high-speed system memory",
            ),
            (
                "Intelligence Token Quota",
                ResourceCategory.INTELLIGENCE.value,
                10_000_000.0,
                "tokens",
                "Monthly shared LLM generation tokens",
            ),
            (
                "Agent Execution Slots",
                ResourceCategory.OPERATIONAL.value,
                16.0,
                "slots",
                "Concurrent agent process slots",
            ),
            (
                "Human Approval Bandwidth",
                ResourceCategory.OPERATIONAL.value,
                10.0,
                "slots",
                "Concurrent pending executive decision slots",
            ),
        ]

        created = []
        for name, category, capacity, unit, desc in default_configs:
            pool = await self.repo.create_pool(
                company_id=company_id,
                name=name,
                category=category,
                total_capacity=capacity,
                unit=unit,
                description=desc,
            )
            created.append(pool)
        return created

    async def ensure_default_budgets(self, company_id: uuid.UUID) -> list[ResourceBudget]:
        budgets = await self.repo.list_budgets(company_id)
        if budgets:
            return budgets

        default_budget = await self.create_budget(
            company_id=company_id,
            data=ResourceBudgetCreate(
                name="Default Operational Budget",
                fiscal_period="MONTHLY",
                total_budget_usd=5000.0,
                total_token_allowance=10_000_000,
                alert_threshold_percent=80.0,
            ),
        )
        return [default_budget]

    # -------------------------------------------------------------
    # POOLS & BUDGETS
    # -------------------------------------------------------------
    async def create_pool(self, company_id: uuid.UUID, data: ResourcePoolCreate) -> ResourcePool:
        return await self.repo.create_pool(
            company_id=company_id,
            name=data.name,
            category=data.category.value,
            total_capacity=data.total_capacity,
            unit=data.unit,
            description=data.description,
        )

    async def list_pools(
        self, company_id: uuid.UUID, category: str | None = None
    ) -> list[ResourcePool]:
        await self.ensure_default_pools(company_id)
        return await self.repo.list_pools(company_id, category)

    async def create_budget(
        self, company_id: uuid.UUID, data: ResourceBudgetCreate
    ) -> ResourceBudget:
        return await self.repo.create_budget(
            company_id=company_id,
            name=data.name,
            total_budget_usd=data.total_budget_usd,
            total_token_allowance=data.total_token_allowance,
            department_id=data.department_id,
            project_id=data.project_id,
            fiscal_period=data.fiscal_period,
            alert_threshold_percent=data.alert_threshold_percent,
        )

    async def list_budgets(self, company_id: uuid.UUID) -> list[ResourceBudgetResponse]:
        budgets = await self.repo.list_budgets(company_id)
        legacy = await self.repo.get_legacy_budget_totals(company_id)
        responses = []
        for budget in budgets:
            spent = budget.spent_budget_usd + float(legacy["spent_usd"])
            consumed = budget.consumed_tokens + int(legacy["spent_tokens"])
            reserved = budget.reserved_budget_usd + float(legacy["reserved_usd"])
            reserved_tokens = budget.reserved_tokens + int(legacy["reserved_tokens"])
            exhausted_limits = []
            if budget.total_budget_usd > 0:
                exhausted_limits.append(spent + reserved >= budget.total_budget_usd)
            if budget.total_token_allowance > 0:
                exhausted_limits.append(
                    consumed + reserved_tokens >= budget.total_token_allowance
                )
            response = ResourceBudgetResponse.model_validate(budget).model_copy(
                update={
                    "spent_budget_usd": spent,
                    "reserved_budget_usd": reserved,
                    "remaining_budget_usd": max(
                        0.0, budget.total_budget_usd - spent - reserved
                    ),
                    "consumed_tokens": consumed,
                    "reserved_tokens": reserved_tokens,
                    "remaining_tokens": max(
                        0,
                        budget.total_token_allowance - consumed - reserved_tokens,
                    ),
                    "is_exhausted": not exhausted_limits or all(exhausted_limits),
                }
            )
            responses.append(response)
        return responses

    # -------------------------------------------------------------
    # REQUEST & EVALUATION
    # -------------------------------------------------------------
    async def submit_and_evaluate_request(
        self, company_id: uuid.UUID, data: ResourceRequestCreate
    ) -> tuple[ResourceRequest, ResourceEvaluationResult]:
        from sqlalchemy import select

        from nexora.domains.agents.models import Agent
        from nexora.domains.organizations.models import Department
        from nexora.domains.projects.models import Project, Task

        task = None
        if data.task_id:
            task_result = await self.db.execute(
                select(Task).where(
                    Task.id == data.task_id,
                    Task.company_id == company_id,
                )
            )
            task = task_result.scalars().first()
            if task is None:
                raise NotFoundError("Referenced task was not found in this company.")
            if task.project_id:
                project_result = await self.db.execute(
                    select(Project).where(
                        Project.id == task.project_id,
                        Project.company_id == company_id,
                    )
                )
                if project_result.scalars().first() is None:
                    raise BusinessRuleError("The task is linked to an invalid company project.")

        requested_agent_id = data.agent_id or (task.assigned_agent_id if task else None)
        if requested_agent_id:
            agent_result = await self.db.execute(
                select(Agent).where(
                    Agent.id == requested_agent_id,
                    Agent.company_id == company_id,
                )
            )
            agent = agent_result.scalars().first()
            if agent is None:
                raise NotFoundError("Referenced agent was not found in this company.")
            if agent.department_id:
                department_result = await self.db.execute(
                    select(Department).where(
                        Department.id == agent.department_id,
                        Department.company_id == company_id,
                    )
                )
                if department_result.scalars().first() is None:
                    raise BusinessRuleError("The agent is linked to an invalid company department.")
        else:
            agent = None
        if (
            data.agent_id
            and task
            and task.assigned_agent_id
            and data.agent_id != task.assigned_agent_id
        ):
            raise BusinessRuleError("The resource request agent does not match the task assignment.")

        # Serialize competing reservations for this company on databases that
        # support row locks. SQLite ignores FOR UPDATE and serializes writes.
        await self.ensure_default_pools(company_id)
        await self.ensure_default_budgets(company_id)
        pools = await self.repo.list_pools(company_id, for_update=True)
        company_budgets = await self.repo.list_budgets(company_id, for_update=True)
        project_id = task.project_id if task else None
        department_id = agent.department_id if agent else None
        budgets = [
            budget
            for budget in company_budgets
            if (budget.project_id is None or budget.project_id == project_id)
            and (budget.department_id is None or budget.department_id == department_id)
        ]
        legacy_budget_totals = await self.repo.get_legacy_budget_totals(company_id)

        # 1. Evaluate via Resource Engine
        eval_result = ResourceEngine.evaluate_request(
            priority=data.priority.value,
            expected_value=data.expected_value_score,
            compute=data.requested_compute,
            intelligence=data.requested_intelligence,
            operational=data.requested_operational,
            pools=pools,
            budgets=budgets,
            legacy_spent_budget_usd=float(legacy_budget_totals["spent_usd"]),
            legacy_tokens_consumed=int(legacy_budget_totals["spent_tokens"]),
            legacy_reserved_budget_usd=float(legacy_budget_totals["reserved_usd"]),
            legacy_reserved_tokens=int(legacy_budget_totals["reserved_tokens"]),
        )

        # 2. Persist Request
        req = await self.repo.create_request(
            company_id=company_id,
            agent_id=requested_agent_id,
            task_id=data.task_id,
            priority=data.priority.value,
            justification=data.justification,
            requested_compute=data.requested_compute.model_dump(),
            requested_intelligence=data.requested_intelligence.model_dump(),
            requested_operational=data.requested_operational.model_dump(),
            applicable_budget_ids=[budget.id for budget in budgets],
        )

        await self.repo.update_request_decision(
            request=req,
            decision=eval_result.decision.value,
            reason=eval_result.decision_reason,
        )

        # 3. If Approved, allocate reservations
        if eval_result.decision == ResourceEvaluationDecision.APPROVE:
            reserved_cost = float(data.requested_intelligence.max_inference_cost_usd)
            reserved_tokens = int(data.requested_intelligence.tokens)
            req.budget_accounting_managed = True
            if reserved_cost > 0 or reserved_tokens > 0:
                req.budget_reservation_active = True
                for budget in budgets:
                    await self.repo.adjust_budget_reservation(
                        budget,
                        usd_delta=reserved_cost,
                        token_delta=reserved_tokens,
                    )
            # Reserve only the selected pool for each requested resource dimension.
            selected_pool_ids = set(eval_result.allocated_pool_ids)
            for pool in pools:
                if pool.id not in selected_pool_ids:
                    continue
                dimension = ResourceEngine.pool_dimension(pool)
                alloc_amt = {
                    "cpu": data.requested_compute.cpu_cores,
                    "ram": data.requested_compute.ram_gb,
                    "tokens": data.requested_intelligence.tokens,
                    "slots": data.requested_operational.slots_needed,
                }.get(dimension, 0)
                if alloc_amt <= 0:
                    continue
                await self.repo.create_allocation(
                    company_id, pool.id, req.id, float(alloc_amt), pool.unit
                )
                await self.repo.update_pool_capacity(pool, allocated_delta=float(alloc_amt))

        return req, eval_result

    async def list_requests(
        self, company_id: uuid.UUID, decision: str | None = None, limit: int = 50
    ) -> list[ResourceRequest]:
        return await self.repo.list_requests(company_id, decision=decision, limit=limit)

    # -------------------------------------------------------------
    # ALLOCATIONS & RELEASES
    # -------------------------------------------------------------
    async def list_allocations(
        self, company_id: uuid.UUID, status: str | None = None
    ) -> list[ResourceAllocation]:
        return await self.repo.list_allocations(company_id, status=status)

    async def release_allocation(
        self, company_id: uuid.UUID, allocation_id: uuid.UUID
    ) -> ResourceAllocation:
        alloc = await self.repo.get_allocation(allocation_id, company_id, for_update=True)
        if not alloc:
            raise NotFoundError("ResourceAllocation not found.")

        if alloc.status == AllocationStatus.RELEASED.value:
            return alloc

        # Release pool reservation
        pool = await self.repo.get_pool(alloc.pool_id, company_id, for_update=True)
        if pool:
            await self.repo.update_pool_capacity(pool, allocated_delta=-alloc.allocated_amount)
        released = await self.repo.release_allocation(alloc)
        request = await self.repo.get_request(alloc.request_id, company_id, for_update=True)
        if request and request.budget_reservation_active:
            if await self.repo.count_active_allocations(request.id) == 0:
                requested_intel = request.requested_intelligence or {}
                remaining_cost = max(
                    0.0,
                    float(requested_intel.get("max_inference_cost_usd", 0) or 0)
                    - request.actual_cost_usd,
                )
                remaining_tokens = max(
                    0,
                    int(requested_intel.get("tokens", 0) or 0) - request.actual_tokens,
                )
                budgets = await self.repo.list_budgets(
                    company_id,
                    for_update=True,
                    budget_ids=[uuid.UUID(str(value)) for value in request.applicable_budget_ids],
                )
                for budget in budgets:
                    await self.repo.adjust_budget_reservation(
                        budget,
                        usd_delta=-remaining_cost,
                        token_delta=-remaining_tokens,
                    )
                request.budget_reservation_active = False
                await self.db.flush()

        return released

    # -------------------------------------------------------------
    # USAGE TRACKING (OBSERVED vs ESTIMATED)
    # -------------------------------------------------------------
    async def track_usage(
        self, company_id: uuid.UUID, data: ResourceUsageRecordCreate
    ) -> ResourceUsageRecord:
        alloc = await self.repo.get_allocation(data.allocation_id, company_id, for_update=True)
        if not alloc:
            raise NotFoundError("Referenced ResourceAllocation does not exist.")

        pool = await self.repo.get_pool(alloc.pool_id, company_id, for_update=True)
        request = await self.repo.get_request(alloc.request_id, company_id, for_update=True)
        metric = data.resource_type.strip().lower()

        # Only add telemetry to pools when its unit matches that pool's dimension.
        if pool and data.metric_state == MetricState.OBSERVED:
            dimension = ResourceEngine.pool_dimension(pool)
            matches_dimension = (
                (dimension == "cpu" and metric == "cpu_cores")
                or (dimension == "tokens" and metric in {"token", "tokens"})
                or (dimension == "slots" and metric in {"slot", "slots"})
                or (dimension == "ram" and metric in {"memory_mb", "ram_gb"})
            )
            if matches_dimension:
                observed_delta = data.amount
                if dimension == "ram" and metric == "memory_mb" and "gb" in pool.unit.lower():
                    observed_delta /= 1024.0
                await self.repo.update_pool_capacity(pool, observed_delta=observed_delta)

        # Observed spend replaces the matching part of the outstanding estimate
        # while preserving spend history after the allocation is released.
        if request and data.metric_state == MetricState.OBSERVED:
            requested_intel = request.requested_intelligence or {}
            cost_delta = data.amount if metric == "cost_usd" else 0.0
            token_delta = int(data.amount) if metric in {"token", "tokens"} else 0
            if cost_delta > 0 or token_delta > 0:
                budgets = []
                if request.budget_accounting_managed:
                    budgets = await self.repo.list_budgets(
                        company_id,
                        for_update=True,
                        budget_ids=[
                            uuid.UUID(str(value))
                            for value in request.applicable_budget_ids
                        ],
                    )
                    if not budgets:
                        raise BusinessRuleError(
                            "Cannot settle observed inference usage without its configured budget."
                        )
                old_actual_cost = request.actual_cost_usd
                old_actual_tokens = request.actual_tokens
                request.actual_cost_usd += cost_delta
                request.actual_tokens += token_delta
                if request.budget_accounting_managed:
                    reserve_cost_delta = min(
                        cost_delta,
                        max(
                            0.0,
                            float(requested_intel.get("max_inference_cost_usd", 0) or 0)
                            - old_actual_cost,
                        ),
                    )
                    reserve_token_delta = min(
                        token_delta,
                        max(
                            0,
                            int(requested_intel.get("tokens", 0) or 0) - old_actual_tokens,
                        ),
                    )
                    for budget in budgets:
                        await self.repo.record_budget_expenditure(
                            budget,
                            usd_spent=cost_delta,
                            tokens_consumed=token_delta,
                        )
                        if request.budget_reservation_active and (
                            reserve_cost_delta > 0 or reserve_token_delta > 0
                        ):
                            await self.repo.adjust_budget_reservation(
                                budget,
                                usd_delta=-reserve_cost_delta,
                                token_delta=-reserve_token_delta,
                            )

        # Record usage
        return await self.repo.record_usage(
            company_id=company_id,
            allocation_id=data.allocation_id,
            resource_type=data.resource_type,
            amount=data.amount,
            unit=data.unit,
            metric_state=data.metric_state.value,
            agent_id=data.agent_id,
            task_id=data.task_id,
            details=data.details,
        )

    # -------------------------------------------------------------
    # RESOURCE CONTROL CENTER ANALYTICS
    # -------------------------------------------------------------
    async def get_control_center_overview(
        self, company_id: uuid.UUID
    ) -> ResourceControlCenterResponse:
        pools = await self.list_pools(company_id)
        budgets = await self.list_budgets(company_id)
        allocations = await self.list_allocations(company_id, status=AllocationStatus.ACTIVE.value)
        queued_requests = await self.repo.list_requests(
            company_id, decision=ResourceEvaluationDecision.QUEUE.value
        )
        usage_records = await self.repo.list_usage_records(company_id, limit=200)

        # 1. Capacity overview items
        capacity_items = []
        bottlenecks = []
        for p in pools:
            util = (
                (p.allocated_capacity / p.total_capacity * 100.0) if p.total_capacity > 0 else 0.0
            )
            capacity_items.append(
                CapacityOverviewItem(
                    category=p.category,
                    unit=p.unit,
                    limited_capacity=p.total_capacity,
                    allocated_capacity=p.allocated_capacity,
                    available_capacity=p.available_capacity,
                    observed_usage=p.observed_usage,
                    utilization_percentage=round(util, 1),
                )
            )

            # Bottleneck detection
            if util >= 80.0:
                bottlenecks.append(
                    ResourceBottleneckItem(
                        pool_id=p.id,
                        pool_name=p.name,
                        category=p.category,
                        utilization_percentage=round(util, 1),
                        queued_requests_count=len(queued_requests),
                        severity="CRITICAL" if util >= 95.0 else "HIGH",
                        recommendation=f"Scale quota or defer non-critical batch jobs to relieve {p.name}.",
                    )
                )

        # 2. Budget Consumption
        total_budget = sum(b.total_budget_usd for b in budgets)
        total_spent = sum(b.spent_budget_usd for b in budgets)
        total_reserved = sum(b.reserved_budget_usd for b in budgets)
        total_token_allowance = sum(b.total_token_allowance for b in budgets)
        total_tokens_consumed = sum(b.consumed_tokens for b in budgets)
        total_tokens_reserved = sum(b.reserved_tokens for b in budgets)
        budget_summary = {
            "total_budget_usd": round(total_budget, 2),
            "spent_budget_usd": round(total_spent, 2),
            "reserved_budget_usd": round(total_reserved, 2),
            "remaining_budget_usd": round(max(0.0, total_budget - total_spent - total_reserved), 2),
            "total_token_allowance": total_token_allowance,
            "consumed_tokens": total_tokens_consumed,
            "reserved_tokens": total_tokens_reserved,
            "remaining_tokens": max(
                0, total_token_allowance - total_tokens_consumed - total_tokens_reserved
            ),
            "burn_rate_percent": round((total_spent / total_budget * 100.0), 1)
            if total_budget > 0
            else 0.0,
            "budgets_count": len(budgets),
        }

        # 3. Expensive Tasks (aggregate from usage records)
        task_aggregates: dict[uuid.UUID, dict] = {}
        for rec in usage_records:
            if rec.task_id is None:
                continue
            tid = rec.task_id
            if tid not in task_aggregates:
                details = rec.details or {}
                task_aggregates[tid] = {
                    "task_id": tid,
                    "task_title": details.get("task_title", "Untitled Task"),
                    "agent_name": details.get("agent_name"),
                    "cost_usd": 0.0,
                    "tokens_consumed": 0,
                    "cpu_duration_seconds": 0.0,
                }
            if rec.resource_type == "cost_usd":
                task_aggregates[tid]["cost_usd"] += rec.amount
            elif rec.resource_type == "tokens":
                task_aggregates[tid]["tokens_consumed"] += int(rec.amount)
            elif rec.resource_type == "duration_seconds":
                task_aggregates[tid]["cpu_duration_seconds"] += rec.amount

        expensive_tasks = [
            ExpensiveTaskSummary(**agg)
            for agg in sorted(
                task_aggregates.values(),
                key=lambda x: x["cost_usd"],
                reverse=True,
            )[:5]
        ]

        # 4. Provider Usage (aggregate from usage records)
        provider_aggregates: dict[str, dict] = {}
        for rec in usage_records:
            details = rec.details or {}
            provider_name = details.get("provider_name")
            if not provider_name:
                continue
            if provider_name not in provider_aggregates:
                provider_aggregates[provider_name] = {
                    "provider_name": provider_name,
                    "total_tokens": 0,
                    "total_cost_usd": 0.0,
                    "request_count": 0,
                }
            if rec.resource_type == "tokens":
                provider_aggregates[provider_name]["total_tokens"] += int(rec.amount)
            elif rec.resource_type == "cost_usd":
                provider_aggregates[provider_name]["total_cost_usd"] += rec.amount
            provider_aggregates[provider_name]["request_count"] += 1

        provider_usage = [
            ProviderUsageMetric(**agg)
            for agg in sorted(
                provider_aggregates.values(),
                key=lambda x: x["total_cost_usd"],
                reverse=True,
            )
        ]

        # Host telemetry (OBSERVED, never faked)
        host_telemetry = ResourceEngine.inspect_host_telemetry()

        return ResourceControlCenterResponse(
            company_id=company_id,
            generated_at=datetime.now(UTC),
            capacities=capacity_items,
            budget_consumption=budget_summary,
            active_allocations_count=len(allocations),
            queued_requests_count=len(queued_requests),
            bottlenecks=bottlenecks,
            expensive_tasks=expensive_tasks,
            provider_usage=provider_usage,
            system_host_telemetry=host_telemetry,
        )
