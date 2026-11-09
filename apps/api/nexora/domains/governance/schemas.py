"""Pydantic schemas for NEIMAN Organizational Governance Layer."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from nexora.core.enums import (
    ApprovalStatus,
    EscalationStatus,
    GovernanceRiskLevel,
)


# -------------------------------------------------------------
# COMPANY CONSTITUTION SCHEMAS
# -------------------------------------------------------------
class CompanyConstitutionCreate(BaseModel):
    mission: str = Field(..., min_length=5, description="Core mission statement")
    values: list[str] = Field(default_factory=list, description="Core values and ethics")
    operating_principles: list[str] = Field(default_factory=list, description="Guiding principles")
    prohibited_actions: list[str] = Field(
        default_factory=list, description="Explicitly forbidden actions"
    )
    approval_requirements: list[str] = Field(
        default_factory=list, description="Thresholds requiring human approval"
    )
    security_rules: list[str] = Field(
        default_factory=list, description="Data & security guardrails"
    )
    financial_rules: list[str] = Field(
        default_factory=list, description="Financial & spending ceilings"
    )
    data_rules: list[str] = Field(
        default_factory=list, description="Data classification and privacy rules"
    )
    autonomy_boundaries: dict[str, Any] = Field(
        default_factory=dict, description="Autonomy boundaries per domain"
    )
    escalation_rules: list[str] = Field(default_factory=list, description="Triggers for escalation")


class CompanyConstitutionUpdate(BaseModel):
    mission: str | None = None
    values: list[str] | None = None
    operating_principles: list[str] | None = None
    prohibited_actions: list[str] | None = None
    approval_requirements: list[str] | None = None
    security_rules: list[str] | None = None
    financial_rules: list[str] | None = None
    data_rules: list[str] | None = None
    autonomy_boundaries: dict[str, Any] | None = None
    escalation_rules: list[str] | None = None
    amendment_notes: str | None = None


class CompanyConstitutionResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    version: int
    is_active: bool
    mission: str
    values: list[str]
    operating_principles: list[str]
    prohibited_actions: list[str]
    approval_requirements: list[str]
    security_rules: list[str]
    financial_rules: list[str]
    data_rules: list[str]
    autonomy_boundaries: dict[str, Any]
    escalation_rules: list[str]
    established_by: uuid.UUID | None = None
    amendment_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# AUTONOMY CONFIG SCHEMAS
# -------------------------------------------------------------
class AutonomyConfigCreate(BaseModel):
    autonomy_level: int = Field(
        ge=0,
        le=5,
        description="0=OBSERVE, 1=RECOMMEND, 2=EXECUTE_WITH_APPROVAL, 3=EXECUTE_WITHIN_POLICY, 4=AUTONOMOUS, 5=AUTONOMOUS_ADAPTIVE",
    )
    risk_level: GovernanceRiskLevel = GovernanceRiskLevel.MEDIUM
    requires_explicit_approval: bool = True
    department_id: uuid.UUID | None = None
    role_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    tool_name: str | None = None
    task_type: str | None = None
    action_name: str | None = None
    conditions: dict[str, Any] = Field(default_factory=dict)
    rationale: str | None = None


class AutonomyConfigResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    autonomy_level: int
    risk_level: GovernanceRiskLevel
    requires_explicit_approval: bool
    department_id: uuid.UUID | None = None
    role_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    tool_name: str | None = None
    task_type: str | None = None
    action_name: str | None = None
    conditions: dict[str, Any]
    rationale: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# GOVERNANCE EVALUATION REQUEST & RESPONSE
# -------------------------------------------------------------
class GovernanceActionEvaluationRequest(BaseModel):
    actor_id: uuid.UUID | None = None
    actor_name: str
    actor_type: str = "AGENT"
    department_id: uuid.UUID | None = None
    role_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    tool_name: str | None = None
    task_type: str | None = None
    action_name: str
    target: str
    reason: str
    payload: dict[str, Any] = Field(default_factory=dict)
    declared_risk_level: GovernanceRiskLevel | None = None
    approval_request_id: uuid.UUID | None = None


class GovernanceActionEvaluationResponse(BaseModel):
    allowed: bool
    effective_autonomy_level: int
    effective_autonomy_label: str
    requires_approval: bool
    is_prohibited: bool
    matched_constitution_clause: str | None = None
    matched_config_id: uuid.UUID | None = None
    approval_request_id: uuid.UUID | None = None
    reason: str


# -------------------------------------------------------------
# APPROVAL REQUEST SCHEMAS
# -------------------------------------------------------------
class ApprovalRequestCreate(BaseModel):
    agent_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    title: str
    action: str
    target: str
    risk_level: GovernanceRiskLevel = GovernanceRiskLevel.HIGH
    proposed_payload: dict[str, Any] = Field(default_factory=dict)
    reason: str


class ApprovalDecisionUpdate(BaseModel):
    decision: ApprovalStatus = Field(..., description="APPROVED or REJECTED")
    reviewer_notes: str | None = None


class ApprovalRequestResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    title: str
    action: str
    target: str
    risk_level: GovernanceRiskLevel
    proposed_payload: dict[str, Any]
    reason: str
    status: ApprovalStatus
    reviewer_user_id: uuid.UUID | None = None
    reviewer_notes: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApprovalDiffBlastRadiusResponse(BaseModel):
    approval_id: uuid.UUID
    task_id: uuid.UUID | None = None
    title: str
    action: str
    target: str
    risk_level: str
    diff: str
    files_touched: list[str] = Field(default_factory=list)
    ast_safety: dict[str, Any] = Field(default_factory=dict)
    blast_radius: dict[str, Any] = Field(default_factory=dict)


# -------------------------------------------------------------
# ESCALATION RECORD SCHEMAS
# -------------------------------------------------------------
class EscalationRecordCreate(BaseModel):
    agent_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    reason: str
    description: str
    severity: GovernanceRiskLevel = GovernanceRiskLevel.HIGH
    context_data: dict[str, Any] = Field(default_factory=dict)


class EscalationResolutionUpdate(BaseModel):
    status: EscalationStatus = EscalationStatus.RESOLVED
    resolution: str


class EscalationRecordResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    reason: str
    description: str
    severity: GovernanceRiskLevel
    status: EscalationStatus
    context_data: dict[str, Any]
    resolution: str | None = None
    resolved_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# AUDIT LOG SCHEMAS
# -------------------------------------------------------------
class GovernanceAuditLogCreate(BaseModel):
    actor_id: uuid.UUID | None = None
    actor_name: str
    actor_type: str = "AGENT"
    authority: str
    action: str
    target: str
    reason: str
    result: str
    autonomy_level: int = 3
    risk_level: GovernanceRiskLevel = GovernanceRiskLevel.LOW
    details: dict[str, Any] = Field(default_factory=dict)
    execution_id: uuid.UUID | None = None


class GovernanceAuditLogResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    execution_id: uuid.UUID | None = None
    actor_id: uuid.UUID | None = None
    actor_name: str
    actor_type: str
    authority: str
    action: str
    target: str
    reason: str
    result: str
    autonomy_level: int
    risk_level: GovernanceRiskLevel
    details: dict[str, Any]
    integrity_signature: str | None = None
    previous_signature: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
