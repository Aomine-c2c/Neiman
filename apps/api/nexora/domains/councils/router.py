"""
Agent Council & Deliberation API Router.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_manager, require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.councils.quorum_engine import (
    QuorumEngine,
    QuorumResult,
    QuorumVotingModel,
)
from nexora.domains.councils.schemas import (
    AgentCouncilCreate,
    AgentCouncilResponse,
    CouncilDeliberationResponse,
    DeliberationCreate,
    DeliberationDecisionRequest,
)
from nexora.domains.councils.service import CouncilService

router = APIRouter(
    prefix="/companies/{company_id}/councils", tags=["Agent Councils & Deliberation"]
)
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# -------------------------------------------------------------
# COUNCIL CRUD
# -------------------------------------------------------------
@router.post("", response_model=AgentCouncilResponse, status_code=status.HTTP_201_CREATED)
async def create_council(
    company_id: uuid.UUID,
    body: AgentCouncilCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Assembles a new temporary or permanent Agent Council."""
    members_data = [m.model_dump() for m in body.members]
    return await CouncilService(db).create_council(
        company_id=company_id,
        name=body.name,
        charter=body.charter,
        council_type=body.council_type.value,
        synthesis_agent_id=body.synthesis_agent_id,
        members=members_data,
    )


@router.get("", response_model=list[AgentCouncilResponse])
async def list_councils(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Lists all active Agent Councils in the organization."""
    return await CouncilService(db).list_councils(company_id)


@router.get("/{council_id}", response_model=AgentCouncilResponse)
async def get_council(
    company_id: uuid.UUID,
    council_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves full council details, mandate, and member configurations."""
    return await CouncilService(db).get_council(council_id, company_id)


# -------------------------------------------------------------
# DELIBERATION LIFECYCLE
# -------------------------------------------------------------
@router.post(
    "/{council_id}/deliberations",
    response_model=CouncilDeliberationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_deliberation(
    company_id: uuid.UUID,
    council_id: uuid.UUID,
    body: DeliberationCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Submits a complex organizational problem to the council.
    Orchestrates: PROPOSAL -> INDEPENDENT REVIEW -> OBJECTIONS -> DISCUSSION -> SYNTHESIS.
    Disagreements are explicitly captured as organizational knowledge.
    """
    return await CouncilService(db).start_deliberation(
        council_id=council_id,
        company_id=company_id,
        title=body.title,
        problem_statement=body.problem_statement,
        context_data=body.context_data,
        initial_proposals=body.initial_proposals,
        auto_execute=body.auto_execute_deliberation,
    )


@router.get("/deliberations/{deliberation_id}", response_model=CouncilDeliberationResponse)
async def get_deliberation(
    company_id: uuid.UUID,
    deliberation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Retrieves complete multi-perspective deliberation trace, debate threads, and dissent records."""
    return await CouncilService(db).get_deliberation(deliberation_id, company_id)


@router.get("/{council_id}/deliberations", response_model=list[CouncilDeliberationResponse])
async def list_deliberations(
    company_id: uuid.UUID,
    council_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: None = Depends(require_viewer()),
):
    """Lists deliberations conducted by this council."""
    return await CouncilService(db).list_deliberations(
        company_id=company_id,
        council_id=council_id,
        limit=limit,
        offset=offset,
    )


@router.post("/deliberations/{deliberation_id}/decide", response_model=CouncilDeliberationResponse)
async def ratify_deliberation_decision(
    company_id: uuid.UUID,
    deliberation_id: uuid.UUID,
    body: DeliberationDecisionRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """
    Ratifies a synthesized deliberation into an official Decision entity
    and records dissent into permanent Organizational Memory.
    """
    return await CouncilService(db).decide_and_record(
        deliberation_id=deliberation_id,
        company_id=company_id,
        decision_text=body.decision,
        rationale=body.rationale,
        user_id=current_user.id,
        record_in_memory=body.record_in_memory,
    )


# -------------------------------------------------------------
# DYNAMIC QUORUM CONSENSUS ENGINE
# -------------------------------------------------------------
class QuorumEvaluateRequest(BaseModel):
    voting_model: QuorumVotingModel = Field(
        default=QuorumVotingModel.WEIGHTED,
        description="Consensus model: UNANIMOUS, MAJORITY, WEIGHTED, or VETO_ENABLED",
    )
    override_vote: str | None = Field(
        default=None,
        description="Optional manual executive override stance: APPROVE, REJECT, or VETO",
    )


@router.post(
    "/{council_id}/deliberations/{deliberation_id}/quorum",
    response_model=QuorumResult,
    status_code=status.HTTP_200_OK,
)
async def evaluate_deliberation_quorum(
    company_id: uuid.UUID,
    council_id: uuid.UUID,
    deliberation_id: uuid.UUID,
    body: QuorumEvaluateRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """
    Executes a formal roll-call vote under the selected Quorum Voting Model
    (Unanimous, Majority, Seniority-Weighted, or Veto-Enabled).
    Generates immutable ADR, commits dissent to memory, and executes autonomous dispatch.
    """
    engine = QuorumEngine(db)
    return await engine.execute_council_quorum(
        council_id=council_id,
        deliberation_id=deliberation_id,
        company_id=company_id,
        voting_model=body.voting_model,
        override_vote=body.override_vote,
    )


class CTOCouncilDirectiveRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


@router.post(
    "/deliberations/{deliberation_id}/cto-directive",
    response_model=CouncilDeliberationResponse,
    status_code=status.HTTP_200_OK,
)
async def send_cto_council_directive(
    company_id: uuid.UUID,
    deliberation_id: uuid.UUID,
    body: CTOCouncilDirectiveRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Route a CEO directive directly to Solomon (CTO), who decides next council actions & agent replies."""
    from nexora.domains.councils.engine import DeliberationEngine
    from nexora.domains.councils.repository import CouncilRepository
    from nexora.exceptions import NotFoundError

    repo = CouncilRepository(db)
    delib = await repo.get_deliberation(deliberation_id)
    if not delib or delib.company_id != company_id:
        raise NotFoundError(f"Deliberation {deliberation_id} not found.")
    council = await repo.get_council(delib.council_id)
    if not council:
        raise NotFoundError(f"Council {delib.council_id} not found.")

    engine = DeliberationEngine(db)
    updated = await engine.handle_ceo_cto_directive(council, delib, body.message)
    await db.commit()
    return updated
