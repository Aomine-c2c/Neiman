"""Project and Task Pydantic schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from nexora.core.enums import Priority, ProjectStatus, TaskStatus


class MilestoneSchema(BaseModel):
    title: str
    description: str | None = None
    due_date: datetime | None = None
    completed: bool = False


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    objective: str | None = None
    priority: Priority = Priority.MEDIUM
    milestones: list[MilestoneSchema] = Field(default_factory=list)
    deadline: datetime | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    objective: str | None = None
    priority: Priority | None = None
    status: ProjectStatus | None = None
    milestones: list[MilestoneSchema] | None = None
    deadline: datetime | None = None


class ProjectResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    objective: str | None
    priority: Priority
    status: ProjectStatus
    milestones: list
    deadline: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = None
    assigned_agent_id: uuid.UUID | None = None
    priority: Priority = Priority.MEDIUM
    dependencies: list[uuid.UUID] = Field(default_factory=list)
    resource_requirements: dict = Field(default_factory=dict)
    expected_outcome: str | None = None
    due_date: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    assigned_agent_id: uuid.UUID | None = None
    priority: Priority | None = None
    status: TaskStatus | None = None
    dependencies: list[uuid.UUID] | None = None
    resource_requirements: dict | None = None
    expected_outcome: str | None = None
    due_date: datetime | None = None


class TaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    company_id: uuid.UUID
    assigned_agent_id: uuid.UUID | None
    title: str
    description: str | None
    priority: Priority
    status: TaskStatus
    dependencies: list
    resource_requirements: dict
    expected_outcome: str | None
    due_date: datetime | None
    created_at: datetime
    updated_at: datetime


# ── Workspace & Codebase Inspection Schemas ─────────────────────────────────


class WorkspaceInspectRequest(BaseModel):
    path: str = Field(description="Filesystem path of the target project or workspace to inspect")


class WorkspaceInspectionResult(BaseModel):
    target_path: str
    is_existing_codebase: bool
    project_name: str
    primary_language: str
    detected_frameworks: list[str] = Field(default_factory=list)
    git_remote: str | None = None
    git_branch: str | None = None
    git_commit: str | None = None
    summary: str
    key_components: list[str] = Field(default_factory=list)
    suggested_initiatives: list[str] = Field(default_factory=list)
