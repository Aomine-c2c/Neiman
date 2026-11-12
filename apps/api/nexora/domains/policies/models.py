import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import NexoraBase
from nexora.core.enums import EnforcementLevel, PolicyScope, PolicyStatus

if TYPE_CHECKING:
    from nexora.domains.organizations.models import Company


class Policy(NexoraBase):
    """
    A formal rule or constraint governing behavior within the organization.
    Policies can target the whole company, a department, specific agents,
    projects, or workflows — at varying enforcement strengths.
    """

    __tablename__ = "policies"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Scope
    scope: Mapped[PolicyScope] = mapped_column(
        SAEnum(PolicyScope, name="policy_scope"), default=PolicyScope.COMPANY, nullable=False
    )
    scope_id: Mapped[uuid.UUID | None] = mapped_column(
        nullable=True,
        index=True,
        comment="Specific entity this policy applies to (dept_id, agent_id, etc.)",
    )

    # The actual rules
    rules: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="List of rule objects: {id, name, condition, action, priority}",
    )

    enforcement_level: Mapped[EnforcementLevel] = mapped_column(
        SAEnum(EnforcementLevel, name="enforcement_level"),
        default=EnforcementLevel.SOFT,
        nullable=False,
    )
    status: Mapped[PolicyStatus] = mapped_column(
        SAEnum(PolicyStatus, name="policy_status"),
        default=PolicyStatus.DRAFT,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="policies")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Policy id={self.id} name={self.name} scope={self.scope}>"
