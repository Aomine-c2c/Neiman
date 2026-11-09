"""Project and Task API routers."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_member, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.projects.schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    WorkspaceInspectionResult,
    WorkspaceInspectRequest,
)
from nexora.domains.projects.service import ProjectService, TaskService

router = APIRouter(tags=["Projects"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

project_router = APIRouter(prefix="/companies/{company_id}/projects")
task_router = APIRouter(prefix="/companies/{company_id}/projects/{project_id}/tasks")
company_task_router = APIRouter(prefix="/companies/{company_id}/tasks")


@project_router.post("/inspect", response_model=WorkspaceInspectionResult)
async def inspect_workspace(
    company_id: uuid.UUID,
    body: WorkspaceInspectRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    from nexora.domains.projects.inspector import WorkspaceInspector

    return WorkspaceInspector.inspect(body.path)


@project_router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    company_id: uuid.UUID,
    body: ProjectCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    return await ProjectService(db).create(company_id, current_user.id, **body.model_dump())


@project_router.get("", response_model=list[ProjectResponse])
async def list_projects(
    company_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await ProjectService(db).list(company_id)


@project_router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await ProjectService(db).get(project_id, company_id)


@project_router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    body: ProjectUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    return await ProjectService(db).update(
        project_id, company_id, **body.model_dump(exclude_none=True)
    )


@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    await ProjectService(db).delete(project_id, company_id, current_user.id)


@task_router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    body: TaskCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    return await TaskService(db).create(project_id, company_id, **body.model_dump())


@task_router.get("", response_model=list[TaskResponse])
async def list_tasks(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await TaskService(db).list(project_id, company_id)


@task_router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await TaskService(db).get(task_id, company_id, project_id)


@task_router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: TaskUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    return await TaskService(db).update(
        task_id, company_id, project_id, **body.model_dump(exclude_none=True)
    )


@task_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    company_id: uuid.UUID,
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    await TaskService(db).delete(task_id, company_id, project_id)


@company_task_router.get("", response_model=list[TaskResponse])
async def list_company_tasks(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    return await TaskService(db).list_by_company(company_id)


router.include_router(project_router)
router.include_router(task_router)
router.include_router(company_task_router)
