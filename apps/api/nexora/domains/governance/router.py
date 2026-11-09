"""
REST API Router for NEIMAN Organizational Governance Layer.
Endpoints for:
- Company Constitution
- Autonomy Matrix Configuration (0-5)
- Action Evaluation Pipeline (Allowed, Prohibited, Requires Approval)
- Approval Gate & Human-in-the-loop Reviews
- Escalation Tracking
- Consequential Action Audit Viewer (Understand why every action happened)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_member, require_viewer
from nexora.core.sandbox import SandboxExecutionResult, SandboxExecutionSpec
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.governance.schemas import (
    ApprovalDecisionUpdate,
    ApprovalRequestResponse,
    AutonomyConfigCreate,
    AutonomyConfigResponse,
    CompanyConstitutionResponse,
    CompanyConstitutionUpdate,
    EscalationRecordCreate,
    EscalationRecordResponse,
    EscalationResolutionUpdate,
    GovernanceActionEvaluationRequest,
    GovernanceActionEvaluationResponse,
    GovernanceAuditLogCreate,
    GovernanceAuditLogResponse,
)
from nexora.domains.governance.service import GovernanceService

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(prefix="/companies/{company_id}/governance", tags=["Governance & Autonomy"])


# ==========================================
# COMPANY CONSTITUTION
# ==========================================


@router.get("/constitution", response_model=CompanyConstitutionResponse)
async def get_constitution(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """View the company constitution charter, rules, boundaries, and principles."""
    service = GovernanceService(db)
    return await service.get_or_seed_constitution(company_id)


@router.patch("/constitution", response_model=CompanyConstitutionResponse)
async def update_constitution(
    company_id: uuid.UUID,
    data: CompanyConstitutionUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Amend the company constitution (Admin/Owner only)."""
    service = GovernanceService(db)
    return await service.update_constitution(company_id, data)


# ==========================================
# AUTONOMY CONFIGURATION MATRIX (LEVELS 0 - 5)
# ==========================================


@router.get("/autonomy-configs", response_model=list[AutonomyConfigResponse])
async def list_autonomy_configs(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List autonomy configurations across company, department, role, agent, tool, and action scopes."""
    service = GovernanceService(db)
    return await service.list_autonomy_configs(company_id)


@router.post(
    "/autonomy-configs", response_model=AutonomyConfigResponse, status_code=status.HTTP_201_CREATED
)
async def create_autonomy_config(
    company_id: uuid.UUID,
    data: AutonomyConfigCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Configure custom autonomy rules (0=Observe, 1=Recommend, 2=Approval, 3=Policy, 4=Autonomous, 5=Adaptive)."""
    service = GovernanceService(db)
    return await service.create_autonomy_config(company_id, data)


# ==========================================
# GOVERNANCE EVALUATION PIPELINE
# ==========================================


@router.post("/evaluate-action", response_model=GovernanceActionEvaluationResponse)
async def evaluate_action(
    company_id: uuid.UUID,
    data: GovernanceActionEvaluationRequest,
    current_user: CurrentUser,
    db: DB,
    approval_request_id: uuid.UUID | None = Query(None),
    _: None = Depends(require_member()),
):
    """
    Evaluates whether an action is permitted, prohibited, or requires approval.
    Applies constitutional constraints and hierarchical autonomy resolution.
    """
    service = GovernanceService(db)
    effective_approval_id = data.approval_request_id or approval_request_id
    return await service.evaluate_action(company_id, data, approval_request_id=effective_approval_id)


# ==========================================
# APPROVALS & HUMAN-IN-THE-LOOP
# ==========================================


@router.get("/approvals", response_model=list[ApprovalRequestResponse])
async def list_approvals(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    status_filter: str | None = Query(None, alias="status"),
    _: None = Depends(require_viewer()),
):
    """List approval requests (pending or historical)."""
    service = GovernanceService(db)
    return await service.list_approvals(company_id, status=status_filter)


@router.post("/approvals/{request_id}/decision", response_model=ApprovalRequestResponse)
async def decide_approval(
    company_id: uuid.UUID,
    request_id: uuid.UUID,
    data: ApprovalDecisionUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Approve or reject a pending approval request."""
    service = GovernanceService(db)
    return await service.decide_approval(company_id, request_id, data, current_user.id)


@router.get("/approvals/{request_id}/diff")
async def get_approval_diff(
    company_id: uuid.UUID,
    request_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Inspect syntax unified diff, affected files, AST safety clearance, and blast-radius score."""
    service = GovernanceService(db)
    return await service.get_approval_diff(company_id, request_id)


# ==========================================
# ESCALATIONS
# ==========================================


@router.get("/escalations", response_model=list[EscalationRecordResponse])
async def list_escalations(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    status_filter: str | None = Query(None, alias="status"),
    _: None = Depends(require_viewer()),
):
    """List recorded organizational escalations."""
    service = GovernanceService(db)
    return await service.list_escalations(company_id, status=status_filter)


@router.post(
    "/escalations", response_model=EscalationRecordResponse, status_code=status.HTTP_201_CREATED
)
async def create_escalation(
    company_id: uuid.UUID,
    data: EscalationRecordCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Record an escalation from an agent or workflow."""
    service = GovernanceService(db)
    return await service.create_escalation(company_id, data)


@router.post("/escalations/{escalation_id}/resolve", response_model=EscalationRecordResponse)
async def resolve_escalation(
    company_id: uuid.UUID,
    escalation_id: uuid.UUID,
    data: EscalationResolutionUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Resolve an escalation ticket."""
    service = GovernanceService(db)
    return await service.resolve_escalation(company_id, escalation_id, data, current_user.id)


# ==========================================
# AUDIT LOGS & AUDIT VIEWER
# ==========================================


@router.get("/audits", response_model=list[GovernanceAuditLogResponse])
async def query_audits(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    result: str | None = None,
    target_q: str | None = Query(None, description="Search target or reason keywords"),
    limit: int = Query(100, ge=1, le=500),
    _: None = Depends(require_viewer()),
):
    """
    Searchable Consequential Action Audit Viewer.
    Every consequential action shows: actor, authority, timestamp, action, target, reason, result, autonomy level.
    """
    service = GovernanceService(db)
    return await service.query_audit_logs(
        company_id=company_id,
        actor_id=actor_id,
        action=action,
        result=result,
        target_q=target_q,
        limit=limit,
    )


@router.post(
    "/audits", response_model=GovernanceAuditLogResponse, status_code=status.HTTP_201_CREATED
)
async def record_audit(
    company_id: uuid.UUID,
    data: GovernanceAuditLogCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Explicitly record a consequential action in the governance audit trail."""
    service = GovernanceService(db)
    return await service.record_consequential_audit(company_id, data)


@router.get("/audits/{audit_id}/verify")
async def verify_audit_integrity(
    company_id: uuid.UUID,
    audit_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Verify cryptographic HMAC-SHA256 signature and tamper-evident integrity for an audit record."""
    from nexora.core.security import AuditIntegrityChamber
    from nexora.domains.governance.models import GovernanceAuditLog
    from nexora.exceptions import NotFoundError

    log = await db.get(GovernanceAuditLog, audit_id)
    if not log or log.company_id != company_id:
        raise NotFoundError("Audit record not found.")

    if not log.integrity_signature:
        return {"audit_id": str(audit_id), "verified": False, "reason": "No signature recorded."}

    is_valid = AuditIntegrityChamber.verify_record_signature(
        audit_id=str(log.id),
        company_id=str(log.company_id),
        actor_id=str(log.actor_id or "NONE"),
        action=log.action,
        target=log.target,
        result=log.result,
        timestamp=log.created_at.isoformat() if log.created_at else "",
        signature=log.integrity_signature,
        previous_signature=log.previous_signature or "GENESIS",
    )
    return {
        "audit_id": str(audit_id),
        "verified": is_valid,
        "signature": log.integrity_signature,
        "previous_signature": log.previous_signature,
    }


# ==========================================
# TOOL & CODE EXECUTION SANDBOX
# ==========================================


@router.post("/sandbox/run", response_model=SandboxExecutionResult)
async def run_in_sandbox(
    company_id: uuid.UUID,
    spec: SandboxExecutionSpec,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Executes a shell command or Python script in a zero-trust, ephemeral isolated sandbox.
    Enforces AST inspection, filesystem boundaries, timeout limits, and secret scrubbing.
    """
    from nexora.core.sandbox import ExecutionSandbox

    sandbox = ExecutionSandbox(company_id=company_id)
    return sandbox.execute(spec)
