import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import NexoraBase
from nexora.core.enums import DecisionStatus

if TYPE_CHECKING:
    from nexora.domains.auth.models import User
    from nexora.domains.organizations.models import Company


class Decision(NexoraBase):
    """
    A tracked organizational decision with full provenance:
    problem statement, proposals considered, evidence reviewed,
    participants involved, the decision made, and its outcomes.

    This is the organizational memory layer — enabling learning and accountability.
    """

    __tablename__ = "decisions"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Problem framing
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    problem: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Clear statement of the problem being decided"
    )

    # Deliberation
    proposals: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="List of proposals: {id, title, description, pros, cons, proposed_by}",
    )
    evidence: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Supporting evidence: {id, type, source, summary, url}",
    )
    participants: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Decision participants: {user_id, agent_id, role, input}",
    )

    # Outcome
    decision: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="The actual decision that was made"
    )
    rationale: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Why this decision was chosen over alternatives"
    )
    expected_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual_outcome: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Filled in after implementation — enables learning"
    )

    # Metadata
    status: Mapped[DecisionStatus] = mapped_column(
        SAEnum(DecisionStatus, name="decision_status"),
        default=DecisionStatus.OPEN,
        nullable=False,
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="decisions")  # noqa: F821
    decided_by: Mapped["User | None"] = relationship(  # noqa: F821
        "User", foreign_keys=[decided_by_id], lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Decision id={self.id} title={self.title} status={self.status}>"
