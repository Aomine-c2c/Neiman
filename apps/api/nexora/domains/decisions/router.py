"""Decision API router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_manager, require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.decisions.schemas import (
    DecisionCreate,
    DecisionOutcome,
    DecisionResolve,
    DecisionResponse,
    DecisionUpdate,
)
from nexora.domains.decisions.service import DecisionService

router = APIRouter(prefix="/companies/{company_id}/decisions", tags=["Decisions"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=DecisionResponse, status_code=status.HTTP_201_CREATED)
async def create_decision(
    company_id: uuid.UUID,
    body: DecisionCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    return await DecisionService(db).create(company_id, **body.model_dump())


@router.get("", response_model=list[DecisionResponse])
async def list_decisions(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await DecisionService(db).list(company_id)


@router.get("/{decision_id}", response_model=DecisionResponse)
async def get_decision(
    company_id: uuid.UUID,
    decision_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await DecisionService(db).get(decision_id, company_id)


@router.patch("/{decision_id}", response_model=DecisionResponse)
async def update_decision(
    company_id: uuid.UUID,
    decision_id: uuid.UUID,
    body: DecisionUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    return await DecisionService(db).update(
        decision_id, company_id, **body.model_dump(exclude_none=True)
    )


@router.post("/{decision_id}/resolve", response_model=DecisionResponse)
async def resolve_decision(
    company_id: uuid.UUID,
    decision_id: uuid.UUID,
    body: DecisionResolve,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    return await DecisionService(db).resolve(
        decision_id=decision_id,
        company_id=company_id,
        decided_by_id=current_user.id,
        decision_text=body.decision,
        rationale=body.rationale,
        expected_outcome=body.expected_outcome,
    )


@router.post("/{decision_id}/outcome", response_model=DecisionResponse)
async def record_outcome(
    company_id: uuid.UUID,
    decision_id: uuid.UUID,
    body: DecisionOutcome,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    return await DecisionService(db).record_outcome(decision_id, company_id, body.actual_outcome)


@router.delete("/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_decision(
    company_id: uuid.UUID,
    decision_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    await DecisionService(db).delete(decision_id, company_id)
