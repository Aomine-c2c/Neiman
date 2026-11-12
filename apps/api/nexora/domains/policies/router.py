"""Policy API router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.policies.schemas import PolicyCreate, PolicyResponse, PolicyUpdate
from nexora.domains.policies.service import PolicyService

router = APIRouter(prefix="/companies/{company_id}/policies", tags=["Policies"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    company_id: uuid.UUID,
    body: PolicyCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    return await PolicyService(db).create(company_id, **body.model_dump())


@router.get("", response_model=list[PolicyResponse])
async def list_policies(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await PolicyService(db).list(company_id)


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    company_id: uuid.UUID,
    policy_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await PolicyService(db).get(policy_id, company_id)


@router.patch("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    company_id: uuid.UUID,
    policy_id: uuid.UUID,
    body: PolicyUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    return await PolicyService(db).update(
        policy_id, company_id, **body.model_dump(exclude_none=True)
    )


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    company_id: uuid.UUID,
    policy_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    await PolicyService(db).delete(policy_id, company_id)
