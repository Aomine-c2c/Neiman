"""
FastAPI Router for External Autonomous Agents (Hermes, Muse, Devin, AutoGen, Custom).

Endpoints:
- GET /companies/{company_id}/external-agents - List all registered external agents
- POST /companies/{company_id}/external-agents - Register a new external agent
- PATCH /companies/{company_id}/external-agents/{agent_id}/toggle - Toggle agent active state
- POST /companies/{company_id}/external-agents/dispatch - Dispatch a task to an external agent
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.external_agents import (
    ExternalAgentConfig,
    ExternalAgentDispatchSpec,
    ExternalAgentExecutionTelemetry,
    external_agent_registry,
)
from nexora.core.permissions import require_admin, require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.exceptions import NotFoundError

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(
    prefix="/companies/{company_id}/external-agents", tags=["External Agents Gateway"]
)


class ToggleExternalAgentRequest(BaseModel):
    is_active: bool


@router.get("", response_model=list[ExternalAgentConfig])
async def list_external_agents(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List all registered external agents (Hermes, Muse, Devin, AutoGen, etc.)."""
    return external_agent_registry.list_agents()


@router.post("", response_model=ExternalAgentConfig, status_code=status.HTTP_201_CREATED)
async def register_external_agent(
    company_id: uuid.UUID,
    config: ExternalAgentConfig,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Register a new external autonomous agent connector."""
    return external_agent_registry.register_agent(config)


@router.patch("/{agent_id}/toggle")
async def toggle_external_agent(
    company_id: uuid.UUID,
    agent_id: str,
    req: ToggleExternalAgentRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Enable or disable an external agent."""
    success = external_agent_registry.toggle_agent(agent_id, req.is_active)
    if not success:
        raise NotFoundError(f"External agent '{agent_id}' not found.")
    return {"agent_id": agent_id, "is_active": req.is_active}


@router.post("/dispatch", response_model=ExternalAgentExecutionTelemetry)
async def dispatch_external_agent(
    company_id: uuid.UUID,
    spec: ExternalAgentDispatchSpec,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Dispatch a mission or task to an external agent with observable telemetry."""
    spec.company_id = company_id
    return await external_agent_registry.dispatch(spec)
