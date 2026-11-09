"""Project and Task repositories."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import ProjectStatus, TaskStatus
from nexora.domains.projects.models import Project, Task


class ProjectRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, project_id: uuid.UUID) -> Project | None:
        result = await self.db.execute(
            select(Project).where(Project.id == project_id, Project.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[Project]:
        result = await self.db.execute(
            select(Project)
            .where(Project.company_id == company_id, Project.is_deleted.is_(False))
            .order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(self, company_id: uuid.UUID, owner_id: uuid.UUID, **kwargs) -> Project:
        milestones = kwargs.pop("milestones", [])
        if milestones and hasattr(milestones[0], "model_dump"):
            milestones = [m.model_dump() for m in milestones]
        project = Project(company_id=company_id, owner_id=owner_id, milestones=milestones, **kwargs)
        self.db.add(project)
        await self.db.flush()
        await self.db.refresh(project)
        return project

    async def update(self, project: Project, **kwargs) -> Project:
        milestones = kwargs.pop("milestones", None)
        if milestones is not None:
            if milestones and hasattr(milestones[0], "model_dump"):
                milestones = [m.model_dump() for m in milestones]
            project.milestones = milestones
        for key, value in kwargs.items():
            if value is not None and hasattr(project, key):
                setattr(project, key, value)
        await self.db.flush()
        await self.db.refresh(project)
        return project

    async def soft_delete(self, project: Project) -> None:
        from datetime import UTC, datetime

        project.is_deleted = True
        project.deleted_at = datetime.now(UTC)
        project.status = ProjectStatus.CANCELLED
        await self.db.flush()


class TaskRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, task_id: uuid.UUID) -> Task | None:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_project(self, project_id: uuid.UUID) -> list[Task]:
        result = await self.db.execute(
            select(Task).where(Task.project_id == project_id, Task.is_deleted.is_(False))
        )
        return list(result.scalars().all())

    async def list_by_company(self, company_id: uuid.UUID) -> list[Task]:
        result = await self.db.execute(
            select(Task).where(Task.company_id == company_id, Task.is_deleted.is_(False))
        )
        return list(result.scalars().all())

    async def list_by_agent(self, agent_id: uuid.UUID) -> list[Task]:
        result = await self.db.execute(
            select(Task).where(Task.assigned_agent_id == agent_id, Task.is_deleted.is_(False))
        )
        return list(result.scalars().all())

    async def create(self, project_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Task:
        deps = kwargs.pop("dependencies", [])
        deps = [str(d) for d in deps]
        task = Task(project_id=project_id, company_id=company_id, dependencies=deps, **kwargs)
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def update(self, task: Task, **kwargs) -> Task:
        deps = kwargs.pop("dependencies", None)
        if deps is not None:
            task.dependencies = [str(d) for d in deps]
        for key, value in kwargs.items():
            if value is not None and hasattr(task, key):
                setattr(task, key, value)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def soft_delete(self, task: Task) -> None:
        from datetime import UTC, datetime

        task.is_deleted = True
        task.deleted_at = datetime.now(UTC)
        task.status = TaskStatus.CANCELLED
        await self.db.flush()
