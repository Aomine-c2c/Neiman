"""Pydantic schemas for NEIMAN Company Blueprints and Build My Company generation."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# -------------------------------------------------------------
# BLUEPRINT DEFINITION SCHEMAS
# -------------------------------------------------------------
class BlueprintCompanyDefinition(BaseModel):
    name: str
    mission: str
    vision: str
    industry: str
    dna: dict[str, Any] = Field(default_factory=dict)


class BlueprintDepartment(BaseModel):
    name: str
    purpose: str


class BlueprintRole(BaseModel):
    department_name: str
    title: str
    responsibilities: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    authority: str = "EXECUTE"
    autonomy_level: int = 3


class BlueprintAgent(BaseModel):
    name: str
    role_title: str
    department_name: str
    system_instructions: str
    responsibilities: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    tools: list[dict[str, Any]] = Field(default_factory=list)
    autonomy_level: int = 3
    intelligence_config: dict[str, Any] = Field(default_factory=dict)
    resource_limits: dict[str, Any] = Field(default_factory=dict)


class BlueprintWorkflow(BaseModel):
    name: str
    description: str
    trigger_type: str = "MANUAL"
    steps: list[dict[str, Any]] = Field(default_factory=list)


class BlueprintPolicy(BaseModel):
    name: str
    description: str
    scope: str = "COMPANY"
    rules: list[dict[str, Any]] = Field(default_factory=list)
    enforcement_level: str = "SOFT"


class BlueprintConstitution(BaseModel):
    mission: str
    values: list[str] = Field(default_factory=list)
    operating_principles: list[str] = Field(default_factory=list)
    prohibited_actions: list[str] = Field(default_factory=list)
    approval_requirements: list[str] = Field(default_factory=list)
    security_rules: list[str] = Field(default_factory=list)
    financial_rules: list[str] = Field(default_factory=list)
    data_rules: list[str] = Field(default_factory=list)
    autonomy_boundaries: dict[str, Any] = Field(default_factory=dict)
    escalation_rules: list[str] = Field(default_factory=list)


# -------------------------------------------------------------
# COMPLETE BLUEPRINT SCHEMAS
# -------------------------------------------------------------
class CompanyBlueprintCreate(BaseModel):
    key: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=255)
    tagline: str
    description: str
    category: str
    icon: str = "building"
    company_definition: dict[str, Any]
    departments: list[dict[str, Any]] = Field(default_factory=list)
    roles: list[dict[str, Any]] = Field(default_factory=list)
    agents: list[dict[str, Any]] = Field(default_factory=list)
    workflows: list[dict[str, Any]] = Field(default_factory=list)
    policies: list[dict[str, Any]] = Field(default_factory=list)
    constitution: dict[str, Any] = Field(default_factory=dict)
    recommended_tools: list[dict[str, Any]] = Field(default_factory=list)
    intelligence_requirements: dict[str, Any] = Field(default_factory=dict)
    resource_policies: dict[str, Any] = Field(default_factory=dict)
    kpis: list[dict[str, Any]] = Field(default_factory=list)
    approval_rules: list[dict[str, Any]] = Field(default_factory=list)
    default_autonomy: int = Field(default=3, ge=0, le=5)
    escalation_rules: list[dict[str, Any]] = Field(default_factory=list)
    estimated_monthly_cost_usd: float = 0.0
    metadata_tags: list[str] = Field(default_factory=list)


class CompanyBlueprintUpdate(BaseModel):
    name: str | None = None
    tagline: str | None = None
    description: str | None = None
    category: str | None = None
    icon: str | None = None
    company_definition: dict[str, Any] | None = None
    departments: list[dict[str, Any]] | None = None
    roles: list[dict[str, Any]] | None = None
    agents: list[dict[str, Any]] | None = None
    workflows: list[dict[str, Any]] | None = None
    policies: list[dict[str, Any]] | None = None
    constitution: dict[str, Any] | None = None
    recommended_tools: list[dict[str, Any]] | None = None
    intelligence_requirements: dict[str, Any] | None = None
    resource_policies: dict[str, Any] | None = None
    kpis: list[dict[str, Any]] | None = None
    approval_rules: list[dict[str, Any]] | None = None
    default_autonomy: int | None = None
    escalation_rules: list[dict[str, Any]] | None = None
    estimated_monthly_cost_usd: float | None = None
    metadata_tags: list[str] | None = None


class CompanyBlueprintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    name: str
    tagline: str
    description: str
    category: str
    icon: str
    is_system_template: bool
    version: int
    company_definition: dict[str, Any]
    departments: list[dict[str, Any]]
    roles: list[dict[str, Any]]
    agents: list[dict[str, Any]]
    workflows: list[dict[str, Any]]
    policies: list[dict[str, Any]]
    constitution: dict[str, Any]
    recommended_tools: list[dict[str, Any]]
    intelligence_requirements: dict[str, Any]
    resource_policies: dict[str, Any]
    kpis: list[dict[str, Any]]
    approval_rules: list[dict[str, Any]]
    default_autonomy: int
    escalation_rules: list[dict[str, Any]]
    estimated_monthly_cost_usd: float
    metadata_tags: list[str]
    created_at: datetime
    updated_at: datetime


# -------------------------------------------------------------
# INSTANTIATION SCHEMAS
# -------------------------------------------------------------
class InstantiateBlueprintRequest(BaseModel):
    company_name: str | None = None
    industry_override: str | None = None
    customizations: dict[str, Any] = Field(default_factory=dict)


class InstantiateBlueprintResponse(BaseModel):
    company_id: uuid.UUID
    company_name: str
    slug: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    company_status: str
    departments_created: int
    roles_created: int
    agents_created: int
    workflows_created: int
    policies_created: int
    constitution_established: bool
    projects_created: int = 0
    tasks_created: int = 0
    status: str
    message: str


# -------------------------------------------------------------
# BUILD MY COMPANY (NATURAL LANGUAGE SYNTHESIS)
# -------------------------------------------------------------
class BuildMyCompanyRequest(BaseModel):
    description: str = Field(
        ..., min_length=10, description="Natural language description of the company to build"
    )
    target_budget_monthly_usd: float | None = None
    preferred_autonomy_level: int | None = Field(None, ge=0, le=5)


class BuildMyCompanyProposalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    prompt: str
    status: str
    proposed_blueprint: dict[str, Any]
    estimated_operating_cost: dict[str, Any]
    risks_identified: list[dict[str, Any]]
    generation_stages: dict[str, Any]
    simulation_results: dict[str, Any]
    human_approval_requirements: list[dict[str, Any]]
    estimated_operational_complexity: str
    instantiated_company_id: uuid.UUID | None = None
    created_at: datetime


class ProposalUpdateRequest(BaseModel):
    proposed_blueprint: dict[str, Any] | None = None
    target_budget_monthly_usd: float | None = None
    preferred_autonomy_level: int | None = None


class ProposalSimulateRequest(BaseModel):
    test_workload_size: int = Field(default=30, ge=5, le=200)
    concurrency_level: int = Field(default=4, ge=1, le=20)


class ProposalInstantiateRequest(BaseModel):
    approved_by: str = Field(default="Executive Sponsor", max_length=255)
    confirmation_statement: str = Field(
        default="I have reviewed the synthesized organizational design, simulation results, policies, and risks.",
        max_length=500,
    )
    custom_company_name: str | None = None
    customizations: dict[str, Any] = Field(default_factory=dict)


class SaveAsTemplateRequest(BaseModel):
    company_id: uuid.UUID
    template_key: str
    template_name: str
    description: str
    category: str = "Custom"
