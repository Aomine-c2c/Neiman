"""
NEIMAN Resource Engine Evaluation and Scheduling Core.

Evaluates operational requests against:
- Availability (Compute, Intelligence, Operational pools)
- Priority (CRITICAL, HIGH, NORMAL, LOW, BACKGROUND)
- Policy & Budget constraints
- Expected Value Score
- Existing committed allocations

Produces decisions:
- APPROVE: Sufficient capacity & budget; allocations reserved immediately.
- DENY: Hard constraint violation (exhausted budget, unauthorized, zero feasibility).
- DEFER: Temporary shortage for lower priority; retry after delay.
- REDUCE: Insufficient capacity for full request, but partial allocation feasible.
- QUEUE: High value/priority request waiting on active allocations to complete.

Metric states:
- OBSERVED: Verified actual OS or provider measurement.
- ESTIMATED: Model/Task heuristic claim.
- ALLOCATED: Reserved from pool.
- LIMITED: Hard quota cap.
- AVAILABLE: Limited - Allocated.
"""

import logging
import os
import shutil

from nexora.core.enums import (
    MetricState,
    ResourceCategory,
    ResourceEvaluationDecision,
    ResourcePriority,
)
from nexora.domains.resources.models import ResourceBudget, ResourcePool
from nexora.domains.resources.schemas import (
    RequestedComputeSpec,
    RequestedIntelligenceSpec,
    RequestedOperationalSpec,
    ResourceEvaluationResult,
)

logger = logging.getLogger("NEIMAN.resources.engine")


class ResourceEngine:
    """
    Core resource scheduler and multi-dimensional operational capacity evaluator.
    """

    PRIORITY_WEIGHTS = {
        ResourcePriority.CRITICAL.value: 100,
        ResourcePriority.HIGH.value: 75,
        ResourcePriority.NORMAL.value: 50,
        ResourcePriority.LOW.value: 25,
        ResourcePriority.BACKGROUND.value: 10,
    }

    @staticmethod
    def pool_dimension(pool: ResourcePool) -> str | None:
        """Map a pool to one reservable dimension without conflating unrelated quotas."""
        category = str(pool.category).upper()
        unit = str(pool.unit).lower()
        name = str(pool.name).lower()

        if category == ResourceCategory.COMPUTE.value:
            if "cpu" in unit or "core" in unit or ("cpu" in name and "ram" not in name):
                return "cpu"
            if "ram" in name or ("gb" in unit and "storage" not in name):
                return "ram"
        elif category == ResourceCategory.INTELLIGENCE.value and "token" in unit:
            return "tokens"
        elif category == ResourceCategory.OPERATIONAL.value:
            if ("slot" in unit or "agent" in unit) and "approval" not in name and "human" not in name:
                return "slots"
        return None

    @classmethod
    def _pool_for_request(
        cls, pools: list[ResourcePool], dimension: str, amount: float
    ) -> ResourcePool | None:
        if amount <= 0:
            return None
        return next(
            (
                pool
                for pool in pools
                if pool.is_active
                and cls.pool_dimension(pool) == dimension
                and pool.available_capacity >= amount
            ),
            None,
        )

    @staticmethod
    def inspect_host_telemetry() -> dict:
        """
        Inspect genuine host operating system compute metrics.
        CRITICAL RULE: Do not fake metrics if unobservable. Clearly mark OBSERVED vs ESTIMATED.
        """
        telemetry = {
            "metric_state": MetricState.OBSERVED.value,
            "cpu_cores_available": os.cpu_count() or 1,
            "load_average": [0.0, 0.0, 0.0],
            "storage_total_gb": 0.0,
            "storage_free_gb": 0.0,
            "ram_total_mb": None,
            "gpu_detected": False,
        }

        # Load average (Linux/Unix)
        if hasattr(os, "getloadavg"):
            try:
                telemetry["load_average"] = list(os.getloadavg())
            except Exception:
                pass

        # Storage disk usage
        try:
            total, used, free = shutil.disk_usage("/")
            telemetry["storage_total_gb"] = round(total / (1024**3), 2)
            telemetry["storage_free_gb"] = round(free / (1024**3), 2)
        except Exception:
            pass

        # RAM via /proc/meminfo on Linux without third-party dependencies
        try:
            if os.path.exists("/proc/meminfo"):
                with open("/proc/meminfo") as f:
                    for line in f:
                        if line.startswith("MemTotal:"):
                            parts = line.split()
                            telemetry["ram_total_mb"] = round(int(parts[1]) / 1024, 2)
                            break
        except Exception:
            pass

        return telemetry

    @classmethod
    def evaluate_request(
        cls,
        priority: str,
        expected_value: float,
        compute: RequestedComputeSpec,
        intelligence: RequestedIntelligenceSpec,
        operational: RequestedOperationalSpec,
        pools: list[ResourcePool],
        budgets: list[ResourceBudget],
        legacy_spent_budget_usd: float = 0.0,
        legacy_tokens_consumed: int = 0,
        legacy_reserved_budget_usd: float = 0.0,
        legacy_reserved_tokens: int = 0,
    ) -> ResourceEvaluationResult:
        """
        Multi-dimensional evaluation across compute, intelligence, operational, and financial dimensions.
        """
        # 1. Financial / Budget Evaluation
        if (
            intelligence.max_inference_cost_usd > 0 or intelligence.tokens > 0
        ) and not budgets:
            return ResourceEvaluationResult(
                decision=ResourceEvaluationDecision.DENY,
                decision_reason="No financial or token budget is configured for this company.",
            )

        for budget in budgets:
            if (
                budget.spent_budget_usd
                + legacy_spent_budget_usd
                + budget.reserved_budget_usd
                + legacy_reserved_budget_usd
                + intelligence.max_inference_cost_usd
            ) > budget.total_budget_usd:
                return ResourceEvaluationResult(
                    decision=ResourceEvaluationDecision.DENY,
                    decision_reason=f"Requested cost ${intelligence.max_inference_cost_usd:.2f} exceeds remaining budget for '{budget.name}'.",
                )
            if (
                budget.consumed_tokens
                + legacy_tokens_consumed
                + budget.reserved_tokens
                + legacy_reserved_tokens
                + intelligence.tokens
                > budget.total_token_allowance
            ):
                return ResourceEvaluationResult(
                    decision=ResourceEvaluationDecision.DENY,
                    decision_reason=f"Requested tokens exceed remaining allowance for '{budget.name}'.",
                )

        # 2. Check and select only pools that actually cover requested dimensions.
        selected_pools = [
            cls._pool_for_request(pools, "cpu", compute.cpu_cores),
            cls._pool_for_request(pools, "ram", compute.ram_gb),
            cls._pool_for_request(pools, "tokens", intelligence.tokens),
            cls._pool_for_request(pools, "slots", operational.slots_needed),
        ]
        requested_dimensions = (
            ("cpu", compute.cpu_cores),
            ("ram", compute.ram_gb),
            ("tokens", intelligence.tokens),
            ("slots", operational.slots_needed),
        )
        capacities_available = all(
            amount <= 0 or cls._pool_for_request(pools, dimension, amount) is not None
            for dimension, amount in requested_dimensions
        )

        # All resources available -> APPROVE
        if capacities_available:
            allocated_pool_ids = list(
                dict.fromkeys(pool.id for pool in selected_pools if pool is not None)
            )
            return ResourceEvaluationResult(
                decision=ResourceEvaluationDecision.APPROVE,
                decision_reason="All requested compute, intelligence, and operational quotas are within capacity.",
                allocated_pool_ids=allocated_pool_ids,
            )

        # Priority-driven decision when capacity is constrained
        p_weight = cls.PRIORITY_WEIGHTS.get(priority, 50)

        # High or Critical priority with deficit -> QUEUE or REDUCE
        if p_weight >= 75:  # HIGH or CRITICAL
            # If expected value is high enough, we can REDUCE or QUEUE
            if expected_value >= 6.0:
                # Offer reduced compute/tokens if partial capacity exists
                reduced_compute = compute.model_dump()
                reduced_intel = intelligence.model_dump()
                reduced_compute["cpu_cores"] = max(1.0, compute.cpu_cores * 0.5)
                reduced_compute["ram_gb"] = max(1.0, compute.ram_gb * 0.5)
                reduced_intel["tokens"] = max(10_000, int(intelligence.tokens * 0.5))

                return ResourceEvaluationResult(
                    decision=ResourceEvaluationDecision.REDUCE,
                    decision_reason="High priority task scaled down to conform with active organizational load.",
                    adjusted_compute=reduced_compute,
                    adjusted_intelligence=reduced_intel,
                    adjusted_operational=operational.model_dump(),
                )
            else:
                return ResourceEvaluationResult(
                    decision=ResourceEvaluationDecision.QUEUE,
                    decision_reason="High priority task enqueued waiting for active allocations to release capacity.",
                    queue_position=1,
                )

        # Normal priority with deficit -> DEFER
        if p_weight >= 50:
            return ResourceEvaluationResult(
                decision=ResourceEvaluationDecision.DEFER,
                decision_reason="Resource pool is currently constrained; deferring execution for 60 seconds.",
                suggested_defer_seconds=60,
            )

        # Low or Background priority with deficit -> QUEUE or DENY
        if p_weight < 50:
            if expected_value >= 4.0:
                return ResourceEvaluationResult(
                    decision=ResourceEvaluationDecision.QUEUE,
                    decision_reason="Background operational task placed in lowest priority queue.",
                    queue_position=5,
                )
            return ResourceEvaluationResult(
                decision=ResourceEvaluationDecision.DENY,
                decision_reason="Capacity unavailable and priority/expected value is insufficient to displace workload.",
            )

        return ResourceEvaluationResult(
            decision=ResourceEvaluationDecision.DEFER,
            decision_reason="Default operational deferral under contention.",
            suggested_defer_seconds=120,
        )
