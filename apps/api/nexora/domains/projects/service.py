"""Project and Task services."""

from __future__ import annotations

import builtins
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import Priority, ProjectStatus, TaskStatus
from nexora.domains.organizations.models import Company
from nexora.domains.projects.models import Project, Task
from nexora.domains.projects.repository import ProjectRepository, TaskRepository
from nexora.exceptions import BusinessRuleError, ForbiddenError, NotFoundError

_DEFAULT_PROJECTS = [
    {
        "name": "Platform Foundation",
        "objective": "Establish core infrastructure, security baseline, and shared services for the organization.",
        "priority": "HIGH",
        "tasks": [
            {
                "title": "Provision development environment and CI/CD pipeline",
                "description": "Set up local development tooling, containerized builds, and automated test execution.",
                "priority": "HIGH",
                "status": "PENDING",
            },
            {
                "title": "Implement authentication and RBAC guardrails",
                "description": "Deploy JWT-based authentication with role-based access control across all API surfaces.",
                "priority": "CRITICAL",
                "status": "PENDING",
            },
        ],
    },
    {
        "name": "Product Delivery",
        "objective": "Ship the first customer-facing feature end-to-end, from requirements to production release.",
        "priority": "MEDIUM",
        "tasks": [
            {
                "title": "Define product requirements and acceptance criteria",
                "description": "Collaborate with stakeholders to draft a clear PRD with measurable outcomes.",
                "priority": "MEDIUM",
                "status": "PENDING",
            },
            {
                "title": "Build and verify core feature implementation",
                "description": "Implement the feature with unit tests, integration tests, and code review.",
                "priority": "HIGH",
                "status": "PENDING",
            },
        ],
    },
    {
        "name": "Operational Excellence",
        "objective": "Establish monitoring, observability, and incident response capabilities for production workloads.",
        "priority": "LOW",
        "tasks": [
            {
                "title": "Deploy health checks and uptime monitoring",
                "description": "Instrument all services with health endpoints and real-time telemetry dashboards.",
                "priority": "MEDIUM",
                "status": "PENDING",
            },
            {
                "title": "Create incident response runbook",
                "description": "Document escalation paths, rollback procedures, and post-incident review templates.",
                "priority": "LOW",
                "status": "PENDING",
            },
        ],
    },
]


class ProjectService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ProjectRepository(db)
        self.task_repo = TaskRepository(db)

    async def create(self, company_id: uuid.UUID, owner_id: uuid.UUID, **kwargs) -> Project:
        return await self.repo.create(company_id=company_id, owner_id=owner_id, **kwargs)

    async def get(self, project_id: uuid.UUID, company_id: uuid.UUID) -> Project:
        project = await self.repo.get_by_id(project_id)
        if not project or project.company_id != company_id:
            raise NotFoundError(f"Project {project_id} not found.")
        return project

    async def list(self, company_id: uuid.UUID) -> builtins.list[Project]:
        projects = await self.repo.list_by_company(company_id)
        if not projects:
            projects = await self._seed_default_projects(company_id)
        return projects

    async def _seed_default_projects(self, company_id: uuid.UUID) -> builtins.list[Project]:
        """Auto-seed default projects for a company with no projects. Idempotent: only runs when empty."""
        company_result = await self.db.execute(select(Company).where(Company.id == company_id))
        company = company_result.scalar_one_or_none()
        owner_id = company.owner_id if company else None

        created: builtins.list[Project] = []
        for p_data in _DEFAULT_PROJECTS:
            project = await self.repo.create(
                company_id=company_id,
                owner_id=owner_id,
                name=p_data["name"],
                objective=p_data["objective"],
                priority=Priority[p_data["priority"]],
                status=ProjectStatus.ACTIVE,
            )
            created.append(project)
            for t_data in p_data.get("tasks", []):
                await self.task_repo.create(
                    project_id=project.id,
                    company_id=company_id,
                    title=t_data["title"],
                    description=t_data.get("description"),
                    priority=Priority[t_data["priority"]],
                    status=TaskStatus[t_data["status"]],
                )
        await self.db.flush()
        return created

    async def update(self, project_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Project:
        project = await self.get(project_id, company_id)
        return await self.repo.update(project, **kwargs)

    async def delete(
        self, project_id: uuid.UUID, company_id: uuid.UUID, requesting_user_id: uuid.UUID
    ) -> None:
        project = await self.get(project_id, company_id)
        if project.owner_id != requesting_user_id:
            raise ForbiddenError("Only the project owner can delete it.")
        await self.repo.soft_delete(project)

class TaskService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = TaskRepository(db)
        self.project_repo = ProjectRepository(db)

    async def _validate_task_links(
        self,
        company_id: uuid.UUID,
        project_id: uuid.UUID,
        assigned_agent_id: uuid.UUID | None = None,
        dependencies: list[uuid.UUID] | None = None,
        task_id: uuid.UUID | None = None,
    ) -> None:
        from sqlalchemy import select

        from nexora.domains.agents.models import Agent

        if assigned_agent_id is not None:
            agent_result = await self.db.execute(
                select(Agent.id).where(
                    Agent.id == assigned_agent_id,
                    Agent.company_id == company_id,
                    Agent.is_deleted.is_(False),
                )
            )
            if agent_result.scalar_one_or_none() is None:
                raise NotFoundError("Assigned agent not found in this company.")

        if dependencies is not None:
            dependency_ids = set(dependencies)
            if task_id is not None and task_id in dependency_ids:
                raise BusinessRuleError("A task cannot depend on itself.")
            if len(dependency_ids) != len(dependencies):
                raise BusinessRuleError("Duplicate task dependencies are not allowed.")
            if dependency_ids:
                dependency_result = await self.db.execute(
                    select(Task.id).where(
                        Task.id.in_(dependency_ids),
                        Task.company_id == company_id,
                        Task.project_id == project_id,
                        Task.is_deleted.is_(False),
                    )
                )
                valid_ids = set(dependency_result.scalars().all())
                if valid_ids != dependency_ids:
                    raise NotFoundError("Task dependencies must belong to this project.")

    async def create(self, project_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Task:
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.company_id != company_id:
            raise NotFoundError("Project not found.")
        await self._validate_task_links(
            company_id=company_id,
            project_id=project_id,
            assigned_agent_id=kwargs.get("assigned_agent_id"),
            dependencies=kwargs.get("dependencies", []),
        )
        return await self.repo.create(project_id=project_id, company_id=company_id, **kwargs)

    async def get(
        self, task_id: uuid.UUID, company_id: uuid.UUID, project_id: uuid.UUID
    ) -> Task:
        task = await self.repo.get_by_id(task_id)
        if not task or task.company_id != company_id or task.project_id != project_id:
            raise NotFoundError(f"Task {task_id} not found.")
        return task

    async def list(self, project_id: uuid.UUID, company_id: uuid.UUID) -> builtins.list[Task]:
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.company_id != company_id:
            raise NotFoundError("Project not found.")
        return await self.repo.list_by_project(project_id)

    async def list_by_company(self, company_id: uuid.UUID) -> builtins.list[Task]:
        return await self.repo.list_by_company(company_id)

    async def update(
        self, task_id: uuid.UUID, company_id: uuid.UUID, project_id: uuid.UUID, **kwargs
    ) -> Task:
        task = await self.get(task_id, company_id, project_id)
        await self._validate_task_links(
            company_id=company_id,
            project_id=project_id,
            assigned_agent_id=kwargs.get("assigned_agent_id"),
            dependencies=kwargs.get("dependencies"),
            task_id=task_id,
        )
        return await self.repo.update(task, **kwargs)

    async def delete(
        self, task_id: uuid.UUID, company_id: uuid.UUID, project_id: uuid.UUID
    ) -> None:
        task = await self.get(task_id, company_id, project_id)
        await self.repo.soft_delete(task)
