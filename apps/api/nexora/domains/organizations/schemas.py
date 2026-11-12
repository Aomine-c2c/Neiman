"""Pydantic schemas for the Organizations domain."""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

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


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    slug = re.sub(r"^-+|-+$", "", slug)
    return slug[:100]


# ── Company ────────────────────────────────────────────────────────────────


class CompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    mission: str | None = None
    vision: str | None = None
    industry: str | None = Field(default=None, max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Company name cannot be blank.")
        return v.strip()


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    mission: str | None = None
    vision: str | None = None
    industry: str | None = Field(default=None, max_length=100)
    status: CompanyStatus | None = None


class CompanyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    mission: str | None
    vision: str | None
    industry: str | None
    status: CompanyStatus
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CompanyDetail(CompanyResponse):
    dna: "DNAResponse | None" = None


# ── Organizational DNA ─────────────────────────────────────────────────────


class DNACreate(BaseModel):
    operating_philosophy: str | None = None
    innovation_level: InnovationLevel = InnovationLevel.MODERATE
    autonomy_level: AutonomyLevel = AutonomyLevel.BALANCED
    risk_tolerance: RiskTolerance = RiskTolerance.MODERATE
    quality_threshold: QualityThreshold = QualityThreshold.STANDARD
    decision_style: DecisionStyle = DecisionStyle.CONSULTATIVE
    communication_style: CommunicationStyle = CommunicationStyle.SEMI_FORMAL
    resource_strategy: ResourceStrategy = ResourceStrategy.BALANCED


class DNAUpdate(BaseModel):
    operating_philosophy: str | None = None
    innovation_level: InnovationLevel | None = None
    autonomy_level: AutonomyLevel | None = None
    risk_tolerance: RiskTolerance | None = None
    quality_threshold: QualityThreshold | None = None
    decision_style: DecisionStyle | None = None
    communication_style: CommunicationStyle | None = None
    resource_strategy: ResourceStrategy | None = None


class DNAResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    operating_philosophy: str | None
    innovation_level: InnovationLevel
    autonomy_level: AutonomyLevel
    risk_tolerance: RiskTolerance
    quality_threshold: QualityThreshold
    decision_style: DecisionStyle
    communication_style: CommunicationStyle
    resource_strategy: ResourceStrategy
    created_at: datetime
    updated_at: datetime


# ── Department ─────────────────────────────────────────────────────────────


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    purpose: str | None = None
    parent_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    purpose: str | None = None
    parent_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    status: DepartmentStatus | None = None


class DepartmentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    purpose: str | None
    parent_id: uuid.UUID | None
    manager_id: uuid.UUID | None
    status: DepartmentStatus
    created_at: datetime
    updated_at: datetime


# ── OrgRole ────────────────────────────────────────────────────────────────


class OrgRoleCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    responsibilities: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    authority: RoleAuthority = RoleAuthority.READ
    required_skills: list[str] = Field(default_factory=list)
    autonomy_level: AutonomyLevel = AutonomyLevel.GUIDED


class OrgRoleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    responsibilities: list[str] | None = None
    capabilities: list[str] | None = None
    authority: RoleAuthority | None = None
    required_skills: list[str] | None = None
    autonomy_level: AutonomyLevel | None = None


class OrgRoleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    department_id: uuid.UUID
    company_id: uuid.UUID
    title: str
    responsibilities: list[str]
    capabilities: list[str]
    authority: RoleAuthority
    required_skills: list[str]
    autonomy_level: AutonomyLevel
    created_at: datetime
    updated_at: datetime


# ── Membership ─────────────────────────────────────────────────────────────


class MemberInvite(BaseModel):
    user_id: uuid.UUID
    role: MembershipRole = MembershipRole.MEMBER


class MemberRoleUpdate(BaseModel):
    role: MembershipRole


class MemberResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    user_id: uuid.UUID
    role: MembershipRole
    is_active: bool
    created_at: datetime
