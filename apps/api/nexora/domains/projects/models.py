from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nexora.domains.agents.models import Agent
    from nexora.domains.auth.models import User
    from nexora.domains.organizations.models import Company

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import NexoraBase
from nexora.core.enums import Priority, ProjectStatus, TaskStatus


class Project(NexoraBase):
    """A company-level initiative with objectives, milestones, and deadlines."""

    __tablename__ = "projects"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[Priority] = mapped_column(
        SAEnum(Priority, name="project_priority"), default=Priority.MEDIUM, nullable=False
    )
    status: Mapped[ProjectStatus] = mapped_column(
        SAEnum(ProjectStatus, name="project_status"), default=ProjectStatus.DRAFT, nullable=False
    )
    milestones: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    company: Mapped[Company] = relationship("Company", back_populates="projects")  # noqa: F821
    owner: Mapped[User] = relationship("User", foreign_keys=[owner_id], lazy="select")  # noqa: F821
    tasks: Mapped[list[Task]] = relationship(
        "Task", back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name}>"


class Task(NexoraBase):
    """A unit of work within a Project, optionally assigned to an Agent."""

    __tablename__ = "tasks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[Priority] = mapped_column(
        SAEnum(Priority, name="task_priority"), default=Priority.MEDIUM, nullable=False
    )
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="task_status"), default=TaskStatus.PENDING, nullable=False
    )

    # Task dependency graph (list of task IDs that must complete first)
    dependencies: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    resource_requirements: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    expected_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project: Mapped[Project] = relationship("Project", back_populates="tasks")
    company: Mapped[Company] = relationship("Company")  # noqa: F821
    assigned_agent: Mapped[Agent | None] = relationship(
        "Agent", back_populates="tasks", lazy="select"
    )  # noqa: F821

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title} status={self.status}>"
