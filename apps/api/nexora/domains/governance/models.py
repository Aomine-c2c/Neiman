"""
Governance domain models:
- CompanyConstitution (mission, values, operating principles, prohibited actions, approval requirements, security/financial/data rules, autonomy boundaries, escalation rules)
- AutonomyPolicy (Autonomy levels 0 to 5 configurable per company, department, role, agent, tool, task_type, action)
- ApprovalRequest (Explicit approval gate for high-risk operations or level 2 execution)
- EscalationRecord (Formal escalation of policy violations, blockers, or security alerts)
- GovernanceAuditLog (Consequential action log: actor, authority, timestamp, action, target, reason, result, autonomy_level)
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nexora.domains.organizations.models import Company

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import UUIDTimestampBase
from nexora.core.enums import (
    ApprovalStatus,
    EscalationStatus,
    GovernanceAutonomyLevel,
    GovernanceRiskLevel,
)


class CompanyConstitution(UUIDTimestampBase):
    """
    The fundamental legal and operational charter for a Company in NEIMAN.
    Governs all agents, workflows, and automated decisions.
    """

    __tablename__ = "company_constitutions"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Core Purpose & Ethics
    mission: Mapped[str] = mapped_column(Text, nullable=False)
    values: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="List of core ethical and operational values"
    )
    operating_principles: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="Operational guidelines and decision criteria"
    )

    # Strict Boundaries & Safety Constraints
    prohibited_actions: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Explicitly forbidden actions (e.g., unauthorized data exfiltration, unapproved financial spends)",
    )
    approval_requirements: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Conditions requiring mandatory human/manager sign-off",
    )

    # Domain Governance Rules
    security_rules: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Authentication, encryption, key handling, and zero-trust policies",
    )
    financial_rules: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Budget thresholds, spend approvals, invoice authorization constraints",
    )
    data_rules: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Data residency, classification (PII, confidential), retention, export limits",
    )

    # Autonomy & Escalation
    autonomy_boundaries: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Default global ceilings and autonomy ceilings across domains",
    )
    escalation_rules: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Chain-of-command routing triggers for edge cases and exceptions",
    )

    # Metadata
    established_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    amendment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    company: Mapped["Company"] = relationship("Company", lazy="select")  # noqa: F821


class AutonomyConfig(UUIDTimestampBase):
    """
    Configurable autonomy levels (0 to 5) configured hierarchically at:
    Company -> Department -> Role -> Agent -> Tool -> Task Type -> Action.
    Enforces highest-precedence specific rules down to organizational defaults.
    """

    __tablename__ = "autonomy_configs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Granular Scope Targets (Nullable depending on hierarchy level)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    role_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("org_roles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    tool_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Target specific tool (e.g. database_write, payment_gateway)",
    )
    task_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Target specific task category (e.g. customer_support, deployment)",
    )
    action_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Target specific atomic action (e.g. delete_database, issue_refund)",
    )

    # The Autonomy Level (0 to 5)
    autonomy_level: Mapped[int] = mapped_column(
        Integer,
        default=GovernanceAutonomyLevel.LEVEL_2.value,
        nullable=False,
        comment="0=OBSERVE, 1=RECOMMEND, 2=EXECUTE_WITH_APPROVAL, 3=EXECUTE_WITHIN_POLICY, 4=AUTONOMOUS, 5=AUTONOMOUS_ADAPTIVE",
    )

    risk_level: Mapped[GovernanceRiskLevel] = mapped_column(
        SAEnum(GovernanceRiskLevel, name="governance_risk_level"),
        default=GovernanceRiskLevel.MEDIUM,
        nullable=False,
    )
    requires_explicit_approval: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="High-risk operations require explicit approval unless deliberately overridden",
    )
    conditions: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Dynamic evaluation constraints (e.g. {'max_amount_usd': 500, 'time_window': 'business_hours'})",
    )
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)


class ApprovalRequest(UUIDTimestampBase):
    """
    Formal approval ticket required for high-risk operations, Level 2 autonomy actions,
    or actions exceeding policy thresholds.
    """

    __tablename__ = "approval_requests"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False)
    risk_level: Mapped[GovernanceRiskLevel] = mapped_column(
        SAEnum(GovernanceRiskLevel, name="governance_risk_level"),
        default=GovernanceRiskLevel.HIGH,
        nullable=False,
    )
    proposed_payload: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Parameters and payload for the proposed execution",
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False, comment="Why this action is needed")

    status: Mapped[ApprovalStatus] = mapped_column(
        SAEnum(ApprovalStatus, name="approval_status"),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Resolution
    reviewer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EscalationRecord(UUIDTimestampBase):
    """
    Formal record of an organizational escalation when an agent is blocked,
    encounters a prohibited action attempt, or experiences severe policy conflict.
    """

    __tablename__ = "escalation_records"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[GovernanceRiskLevel] = mapped_column(
        SAEnum(GovernanceRiskLevel, name="governance_risk_level"),
        default=GovernanceRiskLevel.HIGH,
        nullable=False,
    )
    status: Mapped[EscalationStatus] = mapped_column(
        SAEnum(EscalationStatus, name="escalation_status"),
        default=EscalationStatus.OPEN,
        nullable=False,
    )
    context_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class GovernanceAuditLog(UUIDTimestampBase):
    """
    Consequential Action Audit Log.
    Every consequential action in NEIMAN records:
    - actor (agent_id or user_id + name)
    - authority (role, permissions, or delegation grant)
    - timestamp (created_at)
    - action (e.g. EXECUTE_TOOL, DEPLOY_SERVICE, TRANSFER_FUNDS, AMEND_POLICY)
    - target (resource, entity, database, endpoint)
    - reason (why an action happened)
    - result (SUCCESS, REJECTED, BLOCKED, FAILED)
    - autonomy_level (LEVEL 0 - 5 applied during evaluation)
    - execution_id (correlation id)
    """

    __tablename__ = "governance_audit_logs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    execution_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)

    # Actor & Authority
    actor_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_type: Mapped[str] = mapped_column(
        String(50), default="AGENT", nullable=False
    )  # AGENT | USER | SYSTEM
    authority: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Authority credentials or role backing this action (e.g. 'role:FINANCE_LEAD', 'autonomy:LEVEL_3')",
    )

    # Action & Consequence
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Explicit rationale explaining why action occurred"
    )
    result: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # SUCCESS | BLOCKED | REJECTED | FAILED

    autonomy_level: Mapped[int] = mapped_column(
        Integer, default=GovernanceAutonomyLevel.LEVEL_3.value, nullable=False
    )
    risk_level: Mapped[GovernanceRiskLevel] = mapped_column(
        SAEnum(GovernanceRiskLevel, name="governance_risk_level"),
        default=GovernanceRiskLevel.LOW,
        nullable=False,
    )
    details: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Complete telemetry, inputs, state snapshot, and verification data",
    )
    integrity_signature: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="HMAC-SHA256 tamper-evident integrity signature"
    )
    previous_signature: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="Signature of preceding audit record in chain"
    )
