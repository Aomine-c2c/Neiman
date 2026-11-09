"""
FastAPI Router for Organizational Performance & Evolution Engine.

Endpoints:
- POST /companies/{id}/performance/metrics (Record performance observation)
- GET /companies/{id}/performance/metrics (List metrics across dimensions)
- GET /companies/{id}/performance/summary (Multidimensional evidence summary)
- POST /companies/{id}/performance/kpis (Create custom KPI)
- GET /companies/{id}/performance/kpis (List custom KPIs)

Evolution Engine & Evolution Lab Endpoints:
- GET /companies/{id}/evolution/snapshots (List immutable organizational snapshots)
- POST /companies/{id}/evolution/snapshots (Create manual snapshot)
- POST /companies/{id}/evolution/propose (Propose organizational adaptation)
- GET /companies/{id}/evolution/adaptations (List adaptations)
- GET /companies/{id}/evolution/adaptations/{id} (Inspect adaptation)
- POST /companies/{id}/evolution/adaptations/{id}/simulate (Simulate in Evolution Lab)
- POST /companies/{id}/evolution/adaptations/{id}/approve (Approve & deploy adaptation)
- POST /companies/{id}/evolution/adaptations/{id}/rollback (Rollback adaptation & record learning)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import AdaptationStatus, PerformanceDimension
from nexora.core.permissions import require_admin, require_manager, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.intelligence.evolution_schemas import (
    AdaptationApproveRequest,
    AdaptationProposeRequest,
    AdaptationRollbackRequest,
    AdaptationSimulateRequest,
    CustomKPICreate,
    CustomKPIResponse,
    OrganizationalAdaptationResponse,
    OrganizationalSnapshotResponse,
    PerformanceMetricCreate,
    PerformanceMetricResponse,
    SimulationPromoteRequest,
    SimulationRunRequest,
    SimulationRunResponse,
    SimulationScenarioCreate,
    SimulationScenarioResponse,
)
from nexora.domains.intelligence.evolution_service import EvolutionService

router = APIRouter(prefix="/companies/{company_id}", tags=["Performance & Evolution Engine"])

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# =========================================================================
# 1. PERFORMANCE & CUSTOM KPIS
# =========================================================================
@router.post(
    "/performance/metrics",
    response_model=PerformanceMetricResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_performance_metric(
    company_id: uuid.UUID,
    data: PerformanceMetricCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Record a performance metric with actual vs expected outcome."""
    service = EvolutionService(db)
    return await service.record_metric(company_id, data)


@router.get("/performance/metrics", response_model=list[PerformanceMetricResponse])
async def list_performance_metrics(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    dimension: PerformanceDimension | None = Query(None),
    target_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    _: None = Depends(require_viewer()),
):
    """List recorded multidimensional performance metrics."""
    service = EvolutionService(db)
    return await service.list_metrics(company_id, dimension, target_id, limit)


@router.get("/performance/summary")
async def get_performance_summary(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """
    Get comprehensive multidimensional evidence summary across all 8 dimensions:
    Company, Department, Project, Workflow, Role, Agent, Model/Provider, Task.
    """
    service = EvolutionService(db)
    return await service.get_multidimensional_summary(company_id)


@router.post(
    "/performance/kpis",
    response_model=CustomKPIResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_custom_kpi(
    company_id: uuid.UUID,
    data: CustomKPICreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Define a custom KPI for the company/industry."""
    service = EvolutionService(db)
    return await service.create_custom_kpi(company_id, data)


@router.get("/performance/kpis", response_model=list[CustomKPIResponse])
async def list_custom_kpis(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List custom KPIs configured for this organization."""
    service = EvolutionService(db)
    return await service.list_custom_kpis(company_id)


# =========================================================================
# 2. EVOLUTION ENGINE & EVOLUTION LAB
# =========================================================================
@router.get("/evolution/snapshots", response_model=list[OrganizationalSnapshotResponse])
async def list_organizational_snapshots(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List immutable organizational snapshots."""
    service = EvolutionService(db)
    return await service.list_snapshots(company_id)


@router.post(
    "/evolution/snapshots",
    response_model=OrganizationalSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_organizational_snapshot(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    name: str = Query(..., min_length=2),
    reason: str = Query(..., min_length=5),
    _: None = Depends(require_admin()),
):
    """Create a manual immutable snapshot before significant changes."""
    service = EvolutionService(db)
    return await service.create_snapshot(company_id, name, reason)


@router.post(
    "/evolution/propose",
    response_model=OrganizationalAdaptationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def propose_adaptation(
    company_id: uuid.UUID,
    data: AdaptationProposeRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """
    PROPOSE: Propose a controlled organizational adaptation based on observed performance.
    Does NOT modify the live organization.
    """
    service = EvolutionService(db)
    return await service.propose_adaptation(company_id, data)


@router.get("/evolution/adaptations", response_model=list[OrganizationalAdaptationResponse])
async def list_adaptations(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    status_filter: AdaptationStatus | None = Query(None, alias="status"),
    _: None = Depends(require_viewer()),
):
    """List evolutionary adaptations."""
    service = EvolutionService(db)
    return await service.list_adaptations(company_id, status=status_filter)


@router.get(
    "/evolution/adaptations/{adaptation_id}",
    response_model=OrganizationalAdaptationResponse,
)
async def get_adaptation(
    company_id: uuid.UUID,
    adaptation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Inspect adaptation details, simulation outputs, and state diff."""
    service = EvolutionService(db)
    return await service.get_adaptation(company_id, adaptation_id)


@router.post(
    "/evolution/adaptations/{adaptation_id}/simulate",
    response_model=OrganizationalAdaptationResponse,
)
async def simulate_adaptation_in_lab(
    company_id: uuid.UUID,
    adaptation_id: uuid.UUID,
    data: AdaptationSimulateRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """
    SIMULATE: Run controlled stress tests and Monte Carlo simulations in the Evolution Lab.
    """
    service = EvolutionService(db)
    return await service.simulate_in_lab(
        company_id=company_id,
        adaptation_id=adaptation_id,
        synthetic_task_count=data.synthetic_task_count,
        stress_multiplier=data.stress_multiplier,
    )


@router.post(
    "/evolution/adaptations/{adaptation_id}/approve",
    response_model=OrganizationalAdaptationResponse,
)
async def approve_and_deploy_adaptation(
    company_id: uuid.UUID,
    adaptation_id: uuid.UUID,
    data: AdaptationApproveRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """
    APPROVE & DEPLOY: Takes an immutable snapshot, deploys the adaptation, and starts active monitoring.
    """
    service = EvolutionService(db)
    return await service.approve_and_deploy(
        company_id=company_id,
        adaptation_id=adaptation_id,
        reviewer_notes=data.reviewer_notes,
    )


@router.post(
    "/evolution/adaptations/{adaptation_id}/rollback",
    response_model=OrganizationalAdaptationResponse,
)
async def rollback_adaptation(
    company_id: uuid.UUID,
    adaptation_id: uuid.UUID,
    data: AdaptationRollbackRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """
    ROLLBACK: Reverts organization to snapshot and records lessons learned into Organizational Memory.
    """
    service = EvolutionService(db)
    return await service.rollback_adaptation(
        company_id=company_id,
        adaptation_id=adaptation_id,
        rollback_reason=data.rollback_reason,
        learning_notes=data.learning_notes,
    )


# =========================================================================
# 3. NEIMAN SIMULATION LAB (Simulated Copies, Workloads, Comparison & Promotion)
# =========================================================================
@router.post(
    "/simulation/scenarios",
    response_model=SimulationScenarioResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_simulation_scenario(
    company_id: uuid.UUID,
    data: SimulationScenarioCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """
    Creates a simulated copy of an organization with alternative structures, routing, workflows, or policies.
    """
    service = EvolutionService(db)
    return await service.create_simulation_scenario(company_id=company_id, data=data)


@router.get(
    "/simulation/scenarios",
    response_model=list[SimulationScenarioResponse],
)
async def list_simulation_scenarios(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """
    Lists all simulation scenarios for a company (seeds default Simulations A, B, and C if empty).
    """
    service = EvolutionService(db)
    return await service.list_simulation_scenarios(company_id=company_id)


@router.get(
    "/simulation/scenarios/{scenario_id}",
    response_model=SimulationScenarioResponse,
)
async def get_simulation_scenario(
    company_id: uuid.UUID,
    scenario_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """
    Fetches detailed configuration for a specific simulation scenario.
    """
    service = EvolutionService(db)
    return await service.get_simulation_scenario(company_id=company_id, scenario_id=scenario_id)


@router.post(
    "/simulation/scenarios/{scenario_id}/run",
    response_model=SimulationRunResponse,
)
async def run_simulation_benchmark(
    company_id: uuid.UUID,
    scenario_id: uuid.UUID,
    data: SimulationRunRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """
    Runs a controlled workload against the simulated configuration and compares metrics with baseline.
    Results are strictly labeled as experimental results.
    """
    service = EvolutionService(db)
    return await service.run_simulation_benchmark(
        company_id=company_id, scenario_id=scenario_id, req=data
    )


@router.post(
    "/simulation/scenarios/{scenario_id}/promote",
    response_model=SimulationScenarioResponse,
)
async def promote_simulation_scenario(
    company_id: uuid.UUID,
    scenario_id: uuid.UUID,
    data: SimulationPromoteRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """
    Promotes a validated simulation configuration into the real organization after approval.
    Creates an immutable pre-promotion snapshot to ensure zero-risk reversibility.
    """
    service = EvolutionService(db)
    return await service.promote_simulation_scenario(
        company_id=company_id, scenario_id=scenario_id, req=data
    )
