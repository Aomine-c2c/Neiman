"""
Pydantic schemas and contracts for NEIMAN Organizational Positions & Governance Foundation.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AutonomyTier(int, Enum):
    LEVEL_0_OBSERVE = 0
    LEVEL_1_RECOMMEND = 1
    LEVEL_2_EXECUTE_WITH_APPROVAL = 2
    LEVEL_3_EXECUTE_WITHIN_POLICY = 3
    LEVEL_4_AUTONOMOUS_OPERATOR = 4
    LEVEL_5_EXECUTIVE_OWNER = 5


class ResourceQuota(BaseModel):
    max_daily_tokens: int = Field(default=500_000, description="Daily ceiling for LLM inference tokens")
    max_parallel_tasks: int = Field(default=3, description="Maximum concurrent tasks executed")
    max_spend_usd: float = Field(default=25.0, description="Daily budget limit in USD")


class PositionPermissionGrant(BaseModel):
    allowed_tools: list[str] = Field(default_factory=list, description="Permitted tool identifiers")
    denied_tools: list[str] = Field(default_factory=list, description="Explicitly forbidden tools")
    allowed_actions: list[str] = Field(default_factory=list, description="Authorized action categories")
    denied_actions: list[str] = Field(default_factory=list, description="Explicitly forbidden action categories")
    max_autonomy_level: int = Field(default=2, ge=0, le=5, description="Maximum autonomy tier for this position")
    network_egress_allowed: bool = Field(default=False, description="Whether outbound network requests are permitted")
    can_access_pii: bool = Field(default=False, description="Permission to access unmasked user data")
    can_modify_infrastructure: bool = Field(default=False, description="Permission to create or destroy cloud resources")
    can_execute_arbitrary_shell: bool = Field(default=False, description="Permission to invoke terminal commands")
    requires_human_approval_for: list[str] = Field(
        default_factory=list,
        description="Actions requiring explicit human CEO/manager approval before execution",
    )
    resource_quota: ResourceQuota = Field(default_factory=ResourceQuota)


class PositionResponsibilitiesSpec(BaseModel):
    inputs: list[str] = Field(default_factory=list, description="Expected operational inputs and artifacts")
    outputs: list[str] = Field(default_factory=list, description="Delivered operational outputs and artifacts")
    core_duties: list[str] = Field(default_factory=list, description="Primary duties and recurring workflows")
    deliverables: list[str] = Field(default_factory=list, description="Specific tangible deliverables")
    decision_rights: list[str] = Field(default_factory=list, description="Autonomous decision boundaries")
    escalation_triggers: list[str] = Field(
        default_factory=list, description="Conditions mandating immediate escalation up the chain"
    )


class PositionKPIMetric(BaseModel):
    name: str
    target: str
    measurement_frequency: str = "weekly"
    description: str


class PositionEvaluationSpec(BaseModel):
    kpis: list[PositionKPIMetric] = Field(default_factory=list, description="Measurable performance indicators")
    quality_rubrics: list[str] = Field(default_factory=list, description="Quality standards and review criteria")
    failure_conditions: list[str] = Field(
        default_factory=list, description="Unacceptable failure states, errors, or anti-patterns"
    )
    red_lines: list[str] = Field(
        default_factory=list, description="Violations leading to immediate suspension or remediation"
    )
    review_cadence: str = "monthly"


class PositionSoulSpec(BaseModel):
    archetype: str
    worldview: str
    cognitive_style: str
    communication_style: str
    behavioral_principles: list[str] = Field(default_factory=list)
    decision_boundaries: list[str] = Field(default_factory=list)


class PositionDefinition(BaseModel):
    position_key: str = Field(..., description="Unique position slug, e.g., 'ceo', 'cto'")
    title: str = Field(..., description="Display title, e.g., 'Chief Technology Officer'")
    department: str = Field(..., description="Organizational department, e.g., 'Executive Leadership'")
    is_human_only: bool = Field(default=False, description="True if position is strictly reserved for human owner")
    reports_to: str | None = Field(default=None, description="Position key of direct reporting manager")
    default_autonomy_level: int = Field(default=2, ge=0, le=5)

    # Structured specifications
    permissions: PositionPermissionGrant = Field(default_factory=PositionPermissionGrant)
    responsibilities: PositionResponsibilitiesSpec = Field(default_factory=PositionResponsibilitiesSpec)
    evaluation: PositionEvaluationSpec = Field(default_factory=PositionEvaluationSpec)
    soul: PositionSoulSpec | None = None

    # Raw markdown content for prompts and display
    soul_markdown: str = ""
    skills_markdown: str = ""
    responsibilities_markdown: str = ""
    permissions_markdown: str = ""
    evaluation_markdown: str = ""

    # Versioning & Integrity
    content_hashes: dict[str, str] = Field(default_factory=dict, description="SHA-256 hash per source file")
    composite_hash: str = Field("", description="SHA-256 hash of entire position definition bundle")
    version: int = Field(default=1, description="Version number incremented on content changes")

    model_config = ConfigDict(extra="ignore")


class CompanyConstitutionSpec(BaseModel):
    mission: str
    values: list[str] = Field(default_factory=list)
    operating_principles: list[str] = Field(default_factory=list)
    prohibited_actions: list[str] = Field(default_factory=list)
    approval_requirements: list[str] = Field(default_factory=list)
    global_autonomy_ceiling: int = Field(default=4, ge=0, le=5)
    data_sovereignty_rules: list[str] = Field(default_factory=list)
    content_hash: str = ""
    raw_markdown: str = ""


class CompanyGovernancePolicySpec(BaseModel):
    policy_name: str
    version: int = 1
    rules: list[str] = Field(default_factory=list)
    security_controls: list[str] = Field(default_factory=list)
    escalation_matrix: dict[str, str] = Field(default_factory=dict)
    content_hash: str = ""
    raw_markdown: str = ""


# -------------------------------------------------------------
# RUNTIME ACTION & EVALUATION CONTRACTS
# -------------------------------------------------------------

class RuntimeActionRequest(BaseModel):
    company_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    position_key: str
    actor_is_human: bool = False
    actor_user_id: uuid.UUID | None = None
    action_name: str
    tool_name: str | None = None
    target_resource: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    declared_autonomy_level: int = 2
    estimated_cost_usd: float = 0.0


class RuntimeEvaluationResult(BaseModel):
    permitted: bool
    requires_human_approval: bool = False
    reason: str
    effective_autonomy_level: int
    matched_policy_clause: str | None = None
    audit_signature: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
