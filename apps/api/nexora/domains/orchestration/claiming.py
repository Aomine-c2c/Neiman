"""
Atomic Task Claiming Engine with Concurrency Guards, Lease Management,
and Duplicate Job Prevention.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime, timedelta
from typing import Any

from nexora.domains.orchestration.schemas import (
    OrchestrationStatus,
    OrchestrationTaskSpec,
    TaskClaimRequest,
    TaskClaimResponse,
)


class AtomicTaskClaimer:
    """
    Guarantees that tasks are claimed atomically by qualified agents,
    preventing race conditions, duplicate execution, and runaway concurrency.
    """

    def __init__(self, max_concurrent_per_agent: int = 3, max_concurrent_per_company: int = 20) -> None:
        self.max_concurrent_per_agent = max_concurrent_per_agent
        self.max_concurrent_per_company = max_concurrent_per_company
        self._lock = threading.Lock()
        # task_id -> {"agent_id": str, "lease_expires_at": datetime, "company_id": str}
        self._active_leases: dict[str, dict[str, Any]] = {}

    def cleanup_expired_leases(self) -> list[str]:
        """Revokes leases that have exceeded their heartbeat / duration."""
        now = datetime.now(UTC)
        expired_tasks: list[str] = []
        with self._lock:
            for task_id, lease in list(self._active_leases.items()):
                if now > lease["lease_expires_at"]:
                    expired_tasks.append(task_id)
                    del self._active_leases[task_id]
        return expired_tasks

    def get_agent_active_count(self, agent_id: str) -> int:
        now = datetime.now(UTC)
        with self._lock:
            return sum(
                1
                for lease in self._active_leases.values()
                if lease["agent_id"] == agent_id and now <= lease["lease_expires_at"]
            )

    def get_company_active_count(self, company_id: str) -> int:
        now = datetime.now(UTC)
        with self._lock:
            return sum(
                1
                for lease in self._active_leases.values()
                if lease.get("company_id") == company_id and now <= lease["lease_expires_at"]
            )

    def claim_task(
        self,
        candidate_tasks: list[OrchestrationTaskSpec],
        request: TaskClaimRequest,
        company_id: str,
    ) -> TaskClaimResponse:
        """
        Atomically inspects candidate tasks, evaluates capability matching,
        verifies concurrency boundaries, and grants a time-bounded lease.
        """
        self.cleanup_expired_leases()

        with self._lock:
            # Check company-wide concurrency
            active_company = sum(
                1
                for lease in self._active_leases.values()
                if lease.get("company_id") == company_id
            )
            if active_company >= self.max_concurrent_per_company:
                return TaskClaimResponse(
                    success=False,
                    reason=f"Company concurrency ceiling reached ({active_company}/{self.max_concurrent_per_company}).",
                )

            # Check agent concurrency
            active_agent = sum(
                1
                for lease in self._active_leases.values()
                if lease["agent_id"] == request.agent_id
            )
            if active_agent >= self.max_concurrent_per_agent:
                return TaskClaimResponse(
                    success=False,
                    reason=f"Agent '{request.agent_name}' concurrency ceiling reached ({active_agent}/{self.max_concurrent_per_agent}).",
                )

            now = datetime.now(UTC)
            lease_expiry = now + timedelta(seconds=request.lease_duration_seconds)
            claimed: list[OrchestrationTaskSpec] = []
            remaining_quota = min(request.max_tasks, self.max_concurrent_per_agent - active_agent)

            for task in candidate_tasks:
                if len(claimed) >= remaining_quota:
                    break

                # Prevent duplicate claiming of already claimed/running tasks
                if task.id in self._active_leases:
                    continue
                if task.status in (OrchestrationStatus.CLAIMED, OrchestrationStatus.RUNNING, OrchestrationStatus.COMPLETED):
                    continue

                # Capability match verification
                req_caps = set(task.capabilities_required)
                agent_caps = set(request.capabilities)
                if not req_caps.issubset(agent_caps):
                    # Agent lacks required capabilities for this task
                    continue

                # Grant atomic lease
                self._active_leases[task.id] = {
                    "agent_id": request.agent_id,
                    "lease_expires_at": lease_expiry,
                    "company_id": company_id,
                }
                task.status = OrchestrationStatus.CLAIMED
                task.assigned_agent_id = request.agent_id
                claimed.append(task)

            if not claimed:
                return TaskClaimResponse(
                    success=False,
                    reason="No unblocked tasks matching agent capabilities and availability.",
                )

            return TaskClaimResponse(
                success=True,
                claimed_tasks=claimed,
                lease_expires_at=lease_expiry,
                reason=f"Successfully claimed {len(claimed)} task(s).",
            )

    def release_task(self, task_id: str) -> bool:
        """Releases the lease when a task completes, fails, or is cancelled."""
        with self._lock:
            if task_id in self._active_leases:
                del self._active_leases[task_id]
                return True
            return False
