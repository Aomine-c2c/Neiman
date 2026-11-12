"""
CTO & Autonomous Supervisor API Router.
Provides endpoints for:
- Directives intake & autonomous task decomposition.
- Proactive initiative generation & CEO decision gate.
- Continuous development lifecycle supervisor controls (Play / Pause / Tick).
- Real-time agent execution telemetry traces.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_manager, require_member, require_viewer
from nexora.database import get_db
from nexora.domains.agents.cto_service import CTOService
from nexora.domains.agents.schemas import (
    AuditLogResponse,
    CTODirectiveRequest,
    CTODirectiveResponse,
    CTOProposalDecisionRequest,
    CTOProposalResponse,
    ExecutiveThreadResponse,
    ExecutiveThreadSendRequest,
    SupervisorStatusResponse,
    SupervisorToggleRequest,
)
from nexora.domains.agents.service import AgentService
from nexora.domains.agents.supervisor import ContinuousSupervisor, is_supervisor_daemon_running
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user

router = APIRouter(prefix="/companies/{company_id}/cto", tags=["CTO & Autonomous Supervisor"])

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/status", response_model=dict[str, Any])
async def get_cto_status(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Get active CTO agent status, workforce stats, and proposal queues."""
    return await CTOService(db).get_cto_status(company_id)


@router.post("/directive", response_model=CTODirectiveResponse, status_code=status.HTTP_201_CREATED)
async def intake_directive(
    company_id: uuid.UUID,
    body: CTODirectiveRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Issue high-level engineering directive to the CTO Agent.
    The CTO analyzes the goal, decomposes it into subtasks, and delegates to employee agents.
    """
    return await CTOService(db).intake_directive(company_id, body)


@router.get("/proposals", response_model=list[CTOProposalResponse])
async def list_proposals(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List proactive engineering and architectural proposals formulated by the CTO."""
    svc = CTOService(db)
    return await svc.generate_proposals_if_empty(company_id)


@router.post("/proposals/{proposal_id}/decide", response_model=CTOProposalResponse)
async def decide_proposal(
    company_id: uuid.UUID,
    proposal_id: uuid.UUID,
    body: CTOProposalDecisionRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """
    CEO Approval Gate: Approve and delegate proposal to workforce, or dismiss it.
    """
    return await CTOService(db).decide_proposal(company_id, proposal_id, body)


@router.get("/supervisor/status", response_model=SupervisorStatusResponse)
async def get_supervisor_status(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Get status of the continuous development lifecycle supervisor daemon."""
    state = ContinuousSupervisor(db).get_status(company_id)
    svc = CTOService(db)
    await svc.get_cto_status(company_id)

    tasks = await svc.task_repo.list_by_company(company_id)
    from nexora.core.enums import TaskStatus

    pending = len([t for t in tasks if t.status == TaskStatus.PENDING])
    in_progress = len([t for t in tasks if t.status == TaskStatus.IN_PROGRESS])
    completed = len([t for t in tasks if t.status == TaskStatus.COMPLETED])

    return SupervisorStatusResponse(
        company_id=company_id,
        is_running=state.is_running,
        state=state.state,
        active_cycle=state.active_cycle,
        last_tick_at=state.last_tick_at.isoformat() if state.last_tick_at else None,
        pending_tasks_count=pending,
        in_progress_tasks_count=in_progress,
        completed_tasks_count=completed,
        active_task=state.active_task,
        is_daemon_active=is_supervisor_daemon_running(company_id),
        recent_events=state.recent_events[:10],
    )


@router.post("/supervisor/toggle", response_model=SupervisorStatusResponse)
async def toggle_supervisor(
    company_id: uuid.UUID,
    body: SupervisorToggleRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Toggle continuous supervisor lifecycle: PLAY, PAUSE, or TICK."""
    supervisor = ContinuousSupervisor(db)
    supervisor.toggle(company_id, body.action)
    if body.action.upper() == "TICK":
        await supervisor.run_cycle(company_id, force=True)

    return await get_supervisor_status(company_id, current_user, db)


@router.post("/supervisor/tick", response_model=dict[str, Any])
async def trigger_supervisor_tick(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Manually advance one development lifecycle cycle on the workforce backlog."""
    supervisor = ContinuousSupervisor(db)
    return await supervisor.run_cycle(company_id, force=True)


@router.get("/telemetry/{agent_id}", response_model=list[AuditLogResponse])
async def get_agent_live_telemetry(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Fetch live 10-step execution audit telemetry trace for an agent."""
    return await AgentService(db).list_audits(agent_id, company_id)


@router.get("/threads", response_model=list[ExecutiveThreadResponse])
async def list_executive_threads(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List persistent executive email threads, multi-agent delegations, and council deliberations."""
    return await CTOService(db).list_executive_threads(company_id)


@router.post("/threads/message", response_model=ExecutiveThreadResponse, status_code=status.HTTP_201_CREATED)
async def send_executive_thread_message(
    company_id: uuid.UUID,
    body: ExecutiveThreadSendRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Send an email-style message to the CTO (with automatic squad delegation & agent replies) or directly to any specialist agent."""
    return await CTOService(db).send_executive_thread_message(company_id, body)


class CTOHireAgentRequest(BaseModel):
    name: str
    role_title: str
    slug: str
    hire_type: str = "temporary"
    external_runtime: str | None = None
    capabilities: list[str] = []
    mcp_servers: list[str] = []
    worktree_scope: str | None = None
    soul_markdown: str | None = None
    skills_markdown: str | None = None


@router.post("/hire", status_code=status.HTTP_201_CREATED)
async def cto_hire_agent(
    company_id: uuid.UUID,
    body: CTOHireAgentRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """CTO dynamic hiring & external agent proxy provisioning within the 33-agent cap."""
    return await CTOService(db).hire_agent(
        company_id,
        name=body.name,
        role_title=body.role_title,
        slug=body.slug,
        hire_type=body.hire_type,
        external_runtime=body.external_runtime,
        capabilities=body.capabilities,
        mcp_servers=body.mcp_servers,
        worktree_scope=body.worktree_scope,
        soul_markdown=body.soul_markdown,
        skills_markdown=body.skills_markdown,
    )


class CTOPromptEnhanceRequest(BaseModel):
    prompt: str
    context: str | None = None


@router.post("/enhance-prompt", status_code=status.HTTP_200_OK)
async def enhance_cto_prompt(
    company_id: uuid.UUID,
    body: CTOPromptEnhanceRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Enhance a raw CEO prompt into a crisp engineering directive for Solomon (CTO)."""
    return await CTOService(db).enhance_prompt(company_id, body.prompt, body.context)


