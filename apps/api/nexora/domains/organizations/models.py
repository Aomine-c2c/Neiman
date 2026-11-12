"""
Organization domain models.

Entities: Company, OrganizationalDNA, Department, OrgRole, CompanyMember
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nexora.domains.agents.models import Agent
    from nexora.domains.auth.models import User
    from nexora.domains.decisions.models import Decision
    from nexora.domains.policies.models import Policy
    from nexora.domains.projects.models import Project
    from nexora.domains.workflows.models import Workflow

from sqlalchemy import (
    JSON,
    Boolean,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

import nexora.domains.auth.models  # noqa: F401
from nexora.core.base import NexoraBase, TimestampMixin, UUIDBase
from nexora.core.enums import (
    AutonomyLevel,
    CommunicationStyle,
    CompanyStatus,
    DecisionStyle,
    DepartmentStatus,
    InnovationLevel,
    MembershipRole,
    QualityThreshold,
    ResourceStrategy,
    RiskTolerance,
    RoleAuthority,
)


class Company(NexoraBase):
    """
    The top-level organizational entity in NEIMAN.
    Everything — departments, agents, projects — belongs to a Company.
    """

    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mission: Mapped[str | None] = mapped_column(Text, nullable=True)
    vision: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[CompanyStatus] = mapped_column(
        SAEnum(CompanyStatus, name="company_status"), default=CompanyStatus.ACTIVE, nullable=False
    )

    # Owner (the user who created this company)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Relationships
    owner: Mapped[User] = relationship("User", back_populates="owned_companies", lazy="select")  # noqa: F821
    dna: Mapped[OrganizationalDNA | None] = relationship(
        "OrganizationalDNA",
        back_populates="company",
        uselist=False,
        lazy="select",
        cascade="all, delete-orphan",
    )
    departments: Mapped[list[Department]] = relationship(
        "Department", back_populates="company", lazy="select"
    )
    members: Mapped[list[CompanyMember]] = relationship(
        "CompanyMember", back_populates="company", lazy="select", cascade="all, delete-orphan"
    )
    agents: Mapped[list[Agent]] = relationship("Agent", back_populates="company", lazy="select")  # noqa: F821
    projects: Mapped[list[Project]] = relationship(
        "Project", back_populates="company", lazy="select"
    )  # noqa: F821
    workflows: Mapped[list[Workflow]] = relationship(
        "Workflow", back_populates="company", lazy="select"
    )  # noqa: F821
    policies: Mapped[list[Policy]] = relationship(
        "Policy", back_populates="company", lazy="select"
    )  # noqa: F821
    decisions: Mapped[list[Decision]] = relationship(
        "Decision", back_populates="company", lazy="select"
    )  # noqa: F821

    def __repr__(self) -> str:
        return f"<Company id={self.id} name={self.name}>"


class OrganizationalDNA(UUIDBase, TimestampMixin):
    """
    The operating philosophy and behavioral parameters of a Company.
    This defines how the organization thinks, decides, and operates —
    which in turn shapes how its AI agents behave.
    """

    __tablename__ = "organizational_dna"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    operating_philosophy: Mapped[str | None] = mapped_column(Text, nullable=True)
    innovation_level: Mapped[InnovationLevel] = mapped_column(
        SAEnum(InnovationLevel, name="innovation_level"),
        default=InnovationLevel.MODERATE,
        nullable=False,
    )
    autonomy_level: Mapped[AutonomyLevel] = mapped_column(
        SAEnum(AutonomyLevel, name="autonomy_level"),
        default=AutonomyLevel.BALANCED,
        nullable=False,
    )
    risk_tolerance: Mapped[RiskTolerance] = mapped_column(
        SAEnum(RiskTolerance, name="risk_tolerance"),
        default=RiskTolerance.MODERATE,
        nullable=False,
    )
    quality_threshold: Mapped[QualityThreshold] = mapped_column(
        SAEnum(QualityThreshold, name="quality_threshold"),
        default=QualityThreshold.STANDARD,
        nullable=False,
    )
    decision_style: Mapped[DecisionStyle] = mapped_column(
        SAEnum(DecisionStyle, name="decision_style"),
        default=DecisionStyle.CONSULTATIVE,
        nullable=False,
    )
    communication_style: Mapped[CommunicationStyle] = mapped_column(
        SAEnum(CommunicationStyle, name="communication_style"),
        default=CommunicationStyle.SEMI_FORMAL,
        nullable=False,
    )
    resource_strategy: Mapped[ResourceStrategy] = mapped_column(
        SAEnum(ResourceStrategy, name="resource_strategy"),
        default=ResourceStrategy.BALANCED,
        nullable=False,
    )

    # Relationship
    company: Mapped[Company] = relationship("Company", back_populates="dna")

    def __repr__(self) -> str:
        return f"<OrganizationalDNA company_id={self.company_id}>"


class Department(NexoraBase):
    """
    A functional unit within a Company.
    Departments can be nested (parent/child) and own Roles.
    """

    __tablename__ = "departments"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[DepartmentStatus] = mapped_column(
        SAEnum(DepartmentStatus, name="department_status"),
        default=DepartmentStatus.ACTIVE,
        nullable=False,
    )

    # Self-referential parent (nullable = top-level department)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Optional manager (a User within the company)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    company: Mapped[Company] = relationship("Company", back_populates="departments")
    parent: Mapped[Department | None] = relationship(
        "Department", remote_side="Department.id", back_populates="children"
    )
    children: Mapped[list[Department]] = relationship("Department", back_populates="parent")
    roles: Mapped[list[OrgRole]] = relationship(
        "OrgRole", back_populates="department", cascade="all, delete-orphan"
    )
    manager: Mapped[User | None] = relationship("User", foreign_keys=[manager_id], lazy="select")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Department id={self.id} name={self.name}>"


class OrgRole(NexoraBase):
    """
    A role definition within a Department.
    OrgRoles define what capabilities and authority a position carries.
    Agents are assigned to OrgRoles.
    """

    __tablename__ = "org_roles"

    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    responsibilities: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    capabilities: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    authority: Mapped[RoleAuthority] = mapped_column(
        SAEnum(RoleAuthority, name="role_authority"),
        default=RoleAuthority.READ,
        nullable=False,
    )
    required_skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    autonomy_level: Mapped[AutonomyLevel] = mapped_column(
        SAEnum(AutonomyLevel, name="role_autonomy_level"),
        default=AutonomyLevel.GUIDED,
        nullable=False,
    )

    # Relationships
    department: Mapped[Department] = relationship("Department", back_populates="roles")
    company: Mapped[Company] = relationship("Company")
    agents: Mapped[list[Agent]] = relationship("Agent", back_populates="role", lazy="select")  # noqa: F821

    def __repr__(self) -> str:
        return f"<OrgRole id={self.id} title={self.title}>"


class CompanyMember(UUIDBase, TimestampMixin):
    """
    Junction table: User ↔ Company membership with role.
    A user can be a member of multiple companies with different roles.
    """

    __tablename__ = "company_members"
    __table_args__ = (UniqueConstraint("company_id", "user_id", name="uq_company_member"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MembershipRole] = mapped_column(
        SAEnum(MembershipRole, name="membership_role"),
        default=MembershipRole.MEMBER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    company: Mapped[Company] = relationship("Company", back_populates="members")
    user: Mapped[User] = relationship("User", back_populates="memberships")  # noqa: F821

    def __repr__(self) -> str:
        return f"<CompanyMember user={self.user_id} company={self.company_id} role={self.role}>"
