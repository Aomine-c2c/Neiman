"""
NEIMAN Organizational Memory System Models.
Treats memory not as simple chat history, but as structured, contextual,
permission-scoped, domain-separated organizational intelligence assets:

Domains:
1. COMPANY
2. DEPARTMENT
3. AGENT
4. PROJECT
5. CUSTOMER
6. DECISION
7. POLICY
8. EXPERIMENT
9. FAILURE
10. KNOWLEDGE_BASE

Metadata:
- source, owner, scope, permissions, confidence, timestamp, relevance, provenance, retention policy.

Decision Records:
- problem, options, evidence, decision, rationale, participants, expected outcome, actual outcome, lessons learned.
"""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from nexora.domains.agents.models import Agent
    from nexora.domains.organizations.models import Company, Department
    from nexora.domains.projects.models import Project

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import NexoraBase
from nexora.core.enums import (
    MemoryScope,
    ProvenanceType,
    RetentionPolicy,
)


class MemoryItem(NexoraBase):
    """
    A discrete unit of organizational memory belonging to one of the 10 domains.
    Includes full provenance, permission scopes, confidence score, and retention.
    """

    __tablename__ = "memory_items"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    domain: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(
        String(50), default=MemoryScope.INTERNAL.value, nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Associated entities for relational scoping
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Provenance & Ownership
    provenance_type: Mapped[str] = mapped_column(
        String(50), default=ProvenanceType.HUMAN_INPUT.value, nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Originating actor, system component, API, or doc reference",
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Intelligence & Confidence metrics
    confidence: Mapped[float] = mapped_column(
        Float, default=1.0, nullable=False, comment="Reliability / confidence score 0.0 to 1.0"
    )
    relevance_score: Mapped[float] = mapped_column(
        Float, default=1.0, nullable=False, comment="Dynamic organizational relevance score"
    )
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_accessed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Access control permissions list: e.g. ["role:ADMIN", "dept:engineering", "agent:*"]
    required_permissions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Lifecycle & Retention
    retention_policy: Mapped[str] = mapped_column(
        String(50), default=RetentionPolicy.PERMANENT.value, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Tags & metadata
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", lazy="select")  # noqa: F821
    department: Mapped["Department | None"] = relationship("Department", lazy="select")  # noqa: F821
    agent: Mapped["Agent | None"] = relationship("Agent", lazy="select")  # noqa: F821
    project: Mapped["Project | None"] = relationship("Project", lazy="select")  # noqa: F821


class DecisionRecord(NexoraBase):
    """
    Rich organizational decision memory.
    Preserves:
    - problem
    - options considered
    - evidence reviewed
    - decision made
    - rationale
    - participants (humans & agents)
    - expected outcome
    - actual outcome
    - lessons learned
    """

    __tablename__ = "memory_decision_records"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    problem: Mapped[str] = mapped_column(Text, nullable=False)

    options: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="[{id, title, description, pros, cons, impact_score}]",
    )
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False, comment="[{source, claim, verified, url_or_ref}]"
    )
    participants: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="[{name, role, identity_type: USER|AGENT, stance}]",
    )

    decision: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)

    expected_outcome: Mapped[str] = mapped_column(Text, nullable=False)
    actual_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    lessons_learned: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Links
    decided_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decided_by_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    memory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("memory_items.id", ondelete="SET NULL"), nullable=True
    )

    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class KnowledgeEntity(NexoraBase):
    """
    Named entity or concept in the Organizational Knowledge Graph.
    Can represent agents, tools, policies, systems, services, or internal assets.
    """

    __tablename__ = "knowledge_entities"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, default="CONCEPT"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class KnowledgeRelation(NexoraBase):
    """
    Directed semantic triple relation between two KnowledgeEntities:
    [Subject] --(predicate)--> [Object] with weight and provenance.
    """

    __tablename__ = "knowledge_relations"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relation_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    provenance: Mapped[str | None] = mapped_column(String(255), nullable=True)
