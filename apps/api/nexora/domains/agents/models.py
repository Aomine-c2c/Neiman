"""
Agent domain models:
- Agent (Organizational Employee with full lifecycle, hierarchy, memory, tools)
- AgentMemory (Episodic, Semantic, Procedural knowledge stores)
- AgentCommunication (Structured agent-to-agent protocol: delegation, review, escalation, etc.)
- AgentExecutionAudit (Traceable execution records with 10-step lifecycle provenance)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nexora.domains.organizations.models import Company, Department, OrgRole
    from nexora.domains.projects.models import Task

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

import nexora.domains.organizations.models  # noqa: F401
import nexora.domains.projects.models  # noqa: F401
from nexora.core.base import NexoraBase, TimestampMixin, UUIDBase
from nexora.core.enums import (
    AgentAutonomy,
    AgentMessageType,
    AgentStatus,
    AuditAction,
    ExecutionStatus,
    ExecutionStep,
)


class Agent(NexoraBase):
    """
    An organizational employee entity.
    An agent is NOT simply a chatbot — it is a fully integrated organizational actor with:
    - Identity & persona
    - Role & department assignment
    - Manager & reporting hierarchy (supervises direct reports)
    - Responsibilities & goals
    - Capability-based permissions and tool boundaries
    - Long-term memory store
    - Intelligence provider configuration
    - Resource usage limits & tracking
    - Full 7-stage organizational lifecycle
    - Traceable audit history
    """

    __tablename__ = "agents"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("org_roles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    manager_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    identity: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Persona: tone, style, expertise_areas, avatar_url, bio",
    )
    system_instructions: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Base organizational instructions and operational constraints"
    )

    # Organizational responsibilities and goals
    responsibilities: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="Explicit employee job responsibilities"
    )
    goals: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="Current objectives and key results (OKRs)"
    )

    # Capabilities and Tool Access Control
    capabilities: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="List of capability strings (e.g. data_analysis, code_review, db_query)",
    )
    permissions: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Granular permission grants: {allowed_tools: [...], denied_tools: [...], max_actions_per_task: 10}",
    )
    tools: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Registered tools available to this agent: [{name, description, parameters, risk_level}]",
    )

    # Autonomy and Lifecycle
    autonomy: Mapped[AgentAutonomy] = mapped_column(
        SAEnum(AgentAutonomy, name="agent_autonomy"),
        default=AgentAutonomy.SUPERVISED,
        nullable=False,
    )
    status: Mapped[AgentStatus] = mapped_column(
        SAEnum(AgentStatus, name="agent_status"),
        default=AgentStatus.CREATED,
        nullable=False,
        index=True,
    )

    # Intelligence Provider (Decoupled abstraction)
    intelligence_config: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Provider specs: provider, model, temperature, max_tokens, reasoning_effort",
    )

    # Resource Limits & Quotas
    resource_limits: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "max_tokens_per_call": 8192,
            "max_daily_budget_usd": 10.0,
            "max_concurrent_tasks": 3,
            "timeout_seconds": 120,
            "max_tool_invocations": 15,
        },
        nullable=False,
        comment="Enforced organizational resource constraints",
    )
    resource_usage: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "total_tokens": 0,
            "total_cost_usd": 0.0,
            "total_tool_calls": 0,
            "current_active_tasks": 0,
        },
        nullable=False,
        comment="Aggregated resource consumption metrics",
    )

    # Performance History & Metrics
    performance_metadata: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "tasks_completed": 0,
            "tasks_failed": 0,
            "success_rate": 1.0,
            "avg_duration_ms": 0.0,
            "decisions_participated": 0,
            "last_active_at": None,
        },
        nullable=False,
        comment="Historical performance indicators and evaluations",
    )

    # Relationships
    company: Mapped[Company] = relationship("Company", back_populates="agents")  # noqa: F821
    role: Mapped[OrgRole | None] = relationship("OrgRole", back_populates="agents", lazy="select")  # noqa: F821
    department: Mapped[Department | None] = relationship("Department", lazy="select")  # noqa: F821
    manager: Mapped[Agent | None] = relationship(
        "Agent", remote_side="Agent.id", backref="direct_reports", lazy="select"
    )
    tasks: Mapped[list[Task]] = relationship(
        "Task", back_populates="assigned_agent", lazy="select"
    )  # noqa: F821

    memories: Mapped[list[AgentMemory]] = relationship(
        "AgentMemory", back_populates="agent", cascade="all, delete-orphan", lazy="select"
    )
    sent_messages: Mapped[list[AgentCommunication]] = relationship(
        "AgentCommunication",
        foreign_keys="AgentCommunication.from_agent_id",
        back_populates="from_agent",
        lazy="select",
    )
    received_messages: Mapped[list[AgentCommunication]] = relationship(
        "AgentCommunication",
        foreign_keys="AgentCommunication.to_agent_id",
        back_populates="to_agent",
        lazy="select",
    )
    audit_logs: Mapped[list[AgentExecutionAudit]] = relationship(
        "AgentExecutionAudit", back_populates="agent", cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Agent id={self.id} name={self.name} status={self.status} autonomy={self.autonomy}>"
        )


class AgentMemory(NexoraBase):
    """
    Persistent memory store for an agent.
    Supports episodic memories (what happened during execution),
    semantic memories (learned facts, company knowledge), and
    procedural memories (how to execute specific workflows).
    """

    __tablename__ = "agent_memories"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    memory_type: Mapped[str] = mapped_column(
        String(50),
        default="episodic",
        nullable=False,
        comment="episodic | semantic | procedural | reflection",
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)
    importance: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_accessed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    agent: Mapped[Agent] = relationship("Agent", back_populates="memories")


class AgentCommunication(NexoraBase):
    """
    Structured organizational agent-to-agent communication.
    Supports requests, responses, task delegations, escalations to managers,
    peer reviews, and notifications.
    """

    __tablename__ = "agent_communications"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    message_type: Mapped[AgentMessageType] = mapped_column(
        SAEnum(AgentMessageType, name="agent_message_type"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Structured payload: inputs, arguments, delegation params, review feedback",
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    from_agent: Mapped[Agent] = relationship(
        "Agent", foreign_keys=[from_agent_id], back_populates="sent_messages"
    )
    to_agent: Mapped[Agent | None] = relationship(
        "Agent", foreign_keys=[to_agent_id], back_populates="received_messages"
    )


class AgentExecutionAudit(UUIDBase, TimestampMixin):
    """
    Traceable execution audit trail for every action taken by an Agent.
    Implements full provenance across the 10-step task lifecycle:
    TASK_RECEIVED -> CONTEXT_ASSEMBLY -> PLAN -> RESOURCE_CHECK ->
    INTELLIGENCE_SELECTION -> TOOL_EXECUTION -> RESULT -> VALIDATION ->
    REPORT -> MEMORY_UPDATE.
    """

    __tablename__ = "agent_execution_audits"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    execution_id: Mapped[uuid.UUID] = mapped_column(
        default=uuid.uuid4,
        nullable=False,
        index=True,
        comment="Correlates all 10 steps of a single task execution run",
    )

    action: Mapped[AuditAction] = mapped_column(
        SAEnum(AuditAction, name="agent_audit_action"), nullable=False
    )
    step: Mapped[ExecutionStep | None] = mapped_column(
        SAEnum(ExecutionStep, name="agent_execution_step"), nullable=True
    )
    status: Mapped[ExecutionStatus] = mapped_column(
        SAEnum(ExecutionStatus, name="agent_execution_status"),
        default=ExecutionStatus.SUCCESS,
        nullable=False,
    )

    details: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Detailed telemetry, tool parameters, model inputs/outputs, error logs",
    )
    tokens_consumed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    agent: Mapped[Agent] = relationship("Agent", back_populates="audit_logs")


class CTOProposal(NexoraBase):
    """
    Proactive architecture, feature, security, or performance proposal generated by the CTO Agent.
    Awaiting operator approval before being decomposed and delegated to employee agents.
    """

    __tablename__ = "cto_proposals"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cto_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(
        String(50),
        default="ARCHITECTURE",
        nullable=False,
        comment="ARCHITECTURE, FEATURE, SECURITY, PERFORMANCE, REFACTOR",
    )
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    impact_assessment: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="PROPOSED",
        nullable=False,
        comment="PROPOSED, APPROVED, DISMISSED, COMPLETED",
    )

    # Proposed task decomposition plan: [{title, description, role_target, priority, dependencies}]
    proposed_tasks: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # IDs of created tasks once approved
    delegated_task_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    company: Mapped[Company] = relationship("Company")  # noqa: F821
    cto_agent: Mapped[Agent | None] = relationship("Agent", foreign_keys=[cto_agent_id])

    def __repr__(self) -> str:
        return f"<CTOProposal id={self.id} title={self.title} status={self.status}>"
