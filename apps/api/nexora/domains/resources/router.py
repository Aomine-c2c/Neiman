"""
REST API Router for NEIMAN Resource Engine.
Endpoints for:
- Resource Pools & Quotas
- Resource Budgets
- Request Evaluation & Scheduling
- Active Allocations & Releases
- Telemetry & Usage Records
- Resource Control Center Analytics
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_member
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.resources.schemas import (
    ResourceAllocationResponse,
    ResourceBudgetCreate,
    ResourceBudgetResponse,
    ResourceControlCenterResponse,
    ResourcePoolCreate,
    ResourcePoolResponse,
    ResourceReleaseRequest,
    ResourceRequestCreate,
    ResourceRequestResponse,
    ResourceUsageRecordCreate,
    ResourceUsageRecordResponse,
)
from nexora.domains.resources.service import ResourceService

router = APIRouter(prefix="/companies/{company_id}/resources", tags=["Resources"])


@router.get("/pools", response_model=list[ResourcePoolResponse])
async def list_pools(
    company_id: uuid.UUID,
    category: str | None = Query(
        None, description="COMPUTE | INTELLIGENCE | FINANCIAL | OPERATIONAL"
    ),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    service = ResourceService(db)
    return await service.list_pools(company_id, category=category)


@router.post("/pools", response_model=ResourcePoolResponse, status_code=status.HTTP_201_CREATED)
async def create_pool(
    company_id: uuid.UUID,
    data: ResourcePoolCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    service = ResourceService(db)
    return await service.create_pool(company_id, data)


@router.get("/budgets", response_model=list[ResourceBudgetResponse])
async def list_budgets(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    service = ResourceService(db)
    return await service.list_budgets(company_id)


@router.post("/budgets", response_model=ResourceBudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    company_id: uuid.UUID,
    data: ResourceBudgetCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    service = ResourceService(db)
    return await service.create_budget(company_id, data)


@router.post("/requests", response_model=dict, status_code=status.HTTP_201_CREATED)
async def submit_resource_request(
    company_id: uuid.UUID,
    data: ResourceRequestCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    """
    Submit a task or agent resource request.
    The engine evaluates priority, availability, budget, expected value,
    and returns APPROVE, DENY, DEFER, REDUCE, or QUEUE with immediate reservations if approved.
    """
    service = ResourceService(db)
    req, eval_result = await service.submit_and_evaluate_request(company_id, data)
    return {
        "request": ResourceRequestResponse.model_validate(req),
        "evaluation": eval_result.model_dump(),
    }


@router.get("/requests", response_model=list[ResourceRequestResponse])
async def list_resource_requests(
    company_id: uuid.UUID,
    decision: str | None = Query(None, description="APPROVE | DENY | DEFER | REDUCE | QUEUE"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    service = ResourceService(db)
    return await service.list_requests(company_id, decision=decision, limit=limit)


@router.get("/allocations", response_model=list[ResourceAllocationResponse])
async def list_allocations(
    company_id: uuid.UUID,
    status: str | None = Query(None, description="ACTIVE | RELEASED | REVOKED | EXPIRED"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    service = ResourceService(db)
    return await service.list_allocations(company_id, status=status)


@router.post("/allocations/{allocation_id}/release", response_model=ResourceAllocationResponse)
async def release_allocation(
    company_id: uuid.UUID,
    allocation_id: uuid.UUID,
    data: ResourceReleaseRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    service = ResourceService(db)
    return await service.release_allocation(company_id, allocation_id)


@router.post(
    "/usage", response_model=ResourceUsageRecordResponse, status_code=status.HTTP_201_CREATED
)
async def record_usage_metric(
    company_id: uuid.UUID,
    data: ResourceUsageRecordCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    """
    Record observed or estimated resource telemetry.
    """
    service = ResourceService(db)
    return await service.track_usage(company_id, data)


@router.get("/control-center", response_model=ResourceControlCenterResponse)
async def get_resource_control_center(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_member()),
):
    """
    Control Center dashboard providing complete visibility into:
    - Limited, Allocated, Available, and Observed capacity
    - Bottlenecks & Queued requests
    - Real Host compute telemetry
    - Budget consumption
    - Provider usage breakdown
    - Expensive tasks
    """
    service = ResourceService(db)
    return await service.get_control_center_overview(company_id)
