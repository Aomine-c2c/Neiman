"""
Service layer for NEIMAN Autonomous Agent Orchestration Core.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.orchestration.engine import AutonomousOrchestrationEngine
from nexora.domains.orchestration.graph import TaskDependencyGraphManager
from nexora.domains.orchestration.schemas import (
    AutonomousRunRecord,
    GraphValidationResult,
    OrchestrationTaskSpec,
    RecoverableExecutionState,
    RunAuthority,
    RunBudget,
    TaskClaimRequest,
    TaskClaimResponse,
    TaskDependencyGraphSpec,
)
from nexora.exceptions import NotFoundError

# Global singleton engine instance for persistent runtime state across requests
_ORCHESTRATION_ENGINE: AutonomousOrchestrationEngine | None = None


def get_orchestration_engine() -> AutonomousOrchestrationEngine:
    global _ORCHESTRATION_ENGINE
    if _ORCHESTRATION_ENGINE is None:
        _ORCHESTRATION_ENGINE = AutonomousOrchestrationEngine()
    return _ORCHESTRATION_ENGINE


class OrchestrationService:
    def __init__(self, db: AsyncSession | None = None):
        self.db = db
        self.engine = get_orchestration_engine()

    def validate_graph(self, spec: TaskDependencyGraphSpec) -> GraphValidationResult:
        mgr = TaskDependencyGraphManager(spec)
        return mgr.validate_graph()

    def claim_tasks(
        self,
        company_id: uuid.UUID,
        request: TaskClaimRequest,
        candidate_tasks: list[OrchestrationTaskSpec],
    ) -> TaskClaimResponse:
        return self.engine.claimer.claim_task(
            candidate_tasks=candidate_tasks,
            request=request,
            company_id=str(company_id),
        )

    async def trigger_run(
        self,
        company_id: uuid.UUID,
        agent_id: str,
        task: OrchestrationTaskSpec,
        authority: RunAuthority,
        budget: RunBudget | None = None,
        override_model: str | None = None,
    ) -> AutonomousRunRecord:
        return await self.engine.execute_task_run(
            company_id=str(company_id),
            agent_id=agent_id,
            task=task,
            authority=authority,
            budget=budget,
            override_model=override_model,
        )

    async def execute_graph(
        self,
        company_id: uuid.UUID,
        spec: TaskDependencyGraphSpec,
        agent_id: str,
        authority: RunAuthority,
        budget: RunBudget | None = None,
    ) -> dict[str, Any]:
        mgr = TaskDependencyGraphManager(spec)
        return await self.engine.execute_dependency_graph(
            company_id=str(company_id),
            graph_manager=mgr,
            agent_id=agent_id,
            authority=authority,
            budget=budget,
        )

    def get_run(self, run_id: str) -> AutonomousRunRecord:
        run = self.engine.get_run(run_id)
        if not run:
            raise NotFoundError(f"Autonomous run '{run_id}' not found.")
        return run

    def recover_run(self, run_id: str, total_steps: int = 3) -> RecoverableExecutionState:
        return self.engine.recover_interrupted_run(run_id, total_steps=total_steps)

    def list_runs(self, company_id: uuid.UUID) -> list[AutonomousRunRecord]:
        return self.engine.list_runs(str(company_id))

    def list_events(self, limit: int = 50) -> list[dict[str, Any]]:
        return self.engine.event_bus.get_events(limit=limit)
