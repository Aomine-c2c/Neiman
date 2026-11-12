"""
REST API Router for NEIMAN Procedural Skills & Playbooks Hub.
"""

from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.skills.schemas import (
    SkillCreateCustomRequest,
    SkillImportGitRequest,
    SkillResponse,
    SkillSyncResponse,
)
from nexora.domains.skills.service import SkillsService

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(prefix="/companies/{company_id}/skills", tags=["Skills & Playbooks Hub"])


@router.get("", response_model=list[SkillResponse])
async def list_skills(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Lists all procedural skills and playbooks discovered on disk with squad role bindings."""
    service = SkillsService(db)
    return await service.list_skills()


@router.post("/sync-disk", response_model=SkillSyncResponse)
async def sync_disk_skills_to_squad(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Scans .agents/skills and binds procedural playbooks directly to specialized squad agents."""
    service = SkillsService(db)
    return await service.sync_disk_skills_to_squad(company_id)


@router.post("/import-git", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def import_git_skill(
    company_id: uuid.UUID,
    body: SkillImportGitRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Clones a remote git skill repository into .agents/skills with security checks."""
    service = SkillsService(db)
    try:
        return await service.import_git_skill(body)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to import git skill: {str(exc)}",
        )


@router.post("/create-custom", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_skill(
    company_id: uuid.UUID,
    body: SkillCreateCustomRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Creates a custom SKILL.md playbook file on disk with role-binding registration."""
    service = SkillsService(db)
    try:
        return await service.create_custom_skill(body)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create custom skill: {str(exc)}",
        )

