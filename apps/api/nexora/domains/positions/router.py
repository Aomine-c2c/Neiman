"""
REST API Router for NEIMAN Organizational Positions & Governance Foundation.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.positions.schemas import (
    CompanyConstitutionSpec,
    CompanyGovernancePolicySpec,
    PositionDefinition,
    RuntimeActionRequest,
    RuntimeEvaluationResult,
)
from nexora.domains.positions.service import PositionService

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(
    prefix="/companies/{company_id}/positions",
    tags=["Organizational Positions & Governance"],
)


class AssignPositionRequest(BaseModel):
    is_human: bool = Field(..., description="Whether assigned actor is human or autonomous agent")
    agent_id: uuid.UUID | None = Field(default=None, description="Agent ID if is_human is False")
    user_id: uuid.UUID | None = Field(default=None, description="User ID if is_human is True")


@router.get("", response_model=list[PositionDefinition])
async def list_positions(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Lists all 13 canonical organizational positions."""
    return PositionService(db).list_positions()


@router.get("/constitution/shared", response_model=CompanyConstitutionSpec)
async def get_shared_constitution(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves the shared Company Constitution defining organizational ethics and red lines."""
    return PositionService(db).get_constitution()


@router.get("/policies/shared", response_model=CompanyGovernancePolicySpec)
async def get_shared_policies(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves the shared corporate governance policies and escalation matrix."""
    return PositionService(db).get_governance_policies()


@router.get("/history/changes", response_model=list[dict[str, Any]])
async def get_position_change_history(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves the cryptographic version change history and SHA-256 hashes of all positions."""
    return PositionService(db).get_change_history()


@router.get("/{position_key}", response_model=PositionDefinition)
async def get_position_definition(
    company_id: uuid.UUID,
    position_key: str,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves the complete specification, permissions, responsibilities, and evaluation rubrics for a position."""
    return PositionService(db).get_position(position_key)


@router.post("/evaluate-action", response_model=RuntimeEvaluationResult)
async def evaluate_runtime_action(
    company_id: uuid.UUID,
    request: RuntimeActionRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Evaluates whether an agent action or tool invocation is permitted by the runtime permission enforcer.
    Enforces deny-by-default, constitution red lines, and human-only CEO rules.
    """
    request.company_id = company_id
    return PositionService(db).evaluate_action(request)


@router.post("/{position_key}/assign", status_code=status.HTTP_200_OK)
async def assign_actor_to_position(
    company_id: uuid.UUID,
    position_key: str,
    body: AssignPositionRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """
    Assigns a human or agent to an organizational position.
    Strictly enforces that the CEO position can only be assigned to the human owner.
    """
    target_user_id = body.user_id if body.user_id is not None else (current_user.id if body.is_human else None)
    return PositionService(db).validate_and_assign_position(
        company_id=company_id,
        position_key=position_key,
        is_human=body.is_human,
        membership_role="OWNER" if current_user.id == target_user_id else "MEMBER",
        agent_id=body.agent_id,
        user_id=target_user_id,
    )
