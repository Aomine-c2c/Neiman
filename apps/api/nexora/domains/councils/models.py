"""
Agent Council & Deliberation Models.

Supports:
- Temporary or permanent councils of agents assembled to evaluate problems
- Multi-perspective, multi-provider independent reviews
- Formal stages: PROPOSAL -> INDEPENDENT REVIEW -> OBJECTIONS -> DISCUSSION -> SYNTHESIS -> DECISION -> RECORD
- Deep dissent tracking: recording disagreements as valuable organizational knowledge
- Synthesis agent decision proposals and linkage to official Decision records
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import UUIDTimestampBase
from nexora.core.enums import CouncilType, DeliberationStage, DeliberationStatus

if TYPE_CHECKING:
    from nexora.domains.agents.models import Agent
    from nexora.domains.decisions.models import Decision
    from nexora.domains.organizations.models import Company


class AgentCouncil(UUIDTimestampBase):
    """
    An Agent Council is a temporary or permanent group of agents assembled
    to deliberate on complex problems (e.g., Architecture Council, Security Board, Ethics Panel).
    """

    __tablename__ = "agent_councils"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    charter: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Mandate, scope, and evaluation principles"
    )
    council_type: Mapped[str] = mapped_column(
        String(50), default=CouncilType.PERMANENT.value, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Synthesis Agent (Lead/Chair who coordinates and produces final decision proposals)
    synthesis_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )

    # Council members configuration: list of dicts:
    # [{"agent_id": uuid, "role_title": "Security Engineer", "perspective": "Vulnerability & Threat Modeling", "preferred_model": "claude-3-5-sonnet"}]
    members: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    company: Mapped["Company"] = relationship("Company", lazy="select")
    synthesis_agent: Mapped["Agent | None"] = relationship("Agent", lazy="select")
    deliberations: Mapped[list["CouncilDeliberation"]] = relationship(
        "CouncilDeliberation",
        back_populates="council",
        cascade="all, delete-orphan",
        order_by="CouncilDeliberation.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<AgentCouncil id={self.id} name='{self.name}'>"


class CouncilDeliberation(UUIDTimestampBase):
    """
    A specific deliberation instance run by a council addressing an organizational problem.
    Cycles through: PROPOSAL -> INDEPENDENT REVIEW -> OBJECTIONS -> DISCUSSION -> SYNTHESIS -> DECISION -> RECORD.
    """

    __tablename__ = "council_deliberations"

    council_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_councils.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    problem_statement: Mapped[str] = mapped_column(Text, nullable=False)
    context_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    current_stage: Mapped[str] = mapped_column(
        String(50), default=DeliberationStage.PROPOSAL.value, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default=DeliberationStatus.PENDING.value, nullable=False, index=True
    )

    # Deliberation Output Artefacts
    proposals: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False, comment="Submitted candidate proposals"
    )
    independent_reviews: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Reviews from participants: evidence, risks, assumptions, confidence, objections",
    )
    objections: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Explicit objections raised with severity and rationale",
    )
    discussion_threads: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Multi-agent and human discussion rounds addressing objections",
    )
    synthesis_proposal: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, comment="Structured proposal synthesized by synthesis agent"
    )
    final_decision: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Disagreements preserved as valuable organizational knowledge
    # [{topic, dissenting_agents, dissenting_models, argument, counter_argument, mitigation}]
    disagreements_recorded: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False
    )

    # Linkage to official Decision record & Memory
    decision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True
    )

    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    council: Mapped["AgentCouncil"] = relationship("AgentCouncil", back_populates="deliberations")
    decision: Mapped["Decision | None"] = relationship("Decision", lazy="select")

    def __repr__(self) -> str:
        return f"<CouncilDeliberation id={self.id} title='{self.title}' status={self.status}>"
