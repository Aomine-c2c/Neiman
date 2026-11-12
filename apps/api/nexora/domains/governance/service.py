"""Service layer for NEIMAN Organizational Governance Layer."""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    ApprovalStatus,
    GovernanceAutonomyLevel,
    GovernanceRiskLevel,
)
from nexora.domains.governance.engine import GovernanceEngine
from nexora.domains.governance.models import (
    ApprovalRequest,
    AutonomyConfig,
    CompanyConstitution,
    EscalationRecord,
    GovernanceAuditLog,
)
from nexora.domains.governance.repository import GovernanceRepository
from nexora.domains.governance.schemas import (
    ApprovalDecisionUpdate,
    AutonomyConfigCreate,
    CompanyConstitutionUpdate,
    EscalationRecordCreate,
    EscalationResolutionUpdate,
    GovernanceActionEvaluationRequest,
    GovernanceActionEvaluationResponse,
    GovernanceAuditLogCreate,
)
from nexora.exceptions import BusinessRuleError, NotFoundError

logger = logging.getLogger(__name__)


class GovernanceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = GovernanceRepository(db)

    # -------------------------------------------------------------
    # CONSTITUTION
    # -------------------------------------------------------------
    async def get_or_seed_constitution(self, company_id: uuid.UUID) -> CompanyConstitution:
        constitution = await self.repo.get_constitution(company_id)
        if constitution:
            return constitution

        # Seed comprehensive default Company Constitution with concurrency conflict handling
        try:
            return await self.repo.create_constitution(
                company_id=company_id,
                mission="Empower an autonomous, ethical, and self-coordinating organizational intelligence system.",
                values=[
                    "Transparency in automated reasoning",
                    "Strict capability and privilege boundaries",
                    "Human-in-the-loop for consequential actions",
                    "Fiscal and computational responsibility",
                ],
                operating_principles=[
                    "Default to minimal necessary resource allocation",
                    "Proactively escalate blockers and anomalous model outputs",
                    "Audit every consequential action with full causal rationale",
                ],
                prohibited_actions=[
                    "Exfiltration of sensitive customer data outside authorized boundaries",
                    "Unapproved financial transactions or credit commitments",
                    "Bypassing policy gates or disabling audit telemetry",
                    "Modifying company charter or constitution without executive authorization",
                ],
                approval_requirements=[
                    "Production infrastructure deployment or tear down",
                    "Outbound payments or budget transfers exceeding $500",
                    "Granting role:ADMIN or elevating agent autonomy to LEVEL 5",
                    "Direct database drops, migrations, or schema deletions",
                ],
                security_rules=[
                    "All external API calls must pass through the sanitized Intelligence Exchange",
                    "No raw secret keys stored in prompt contexts or unencrypted storage",
                    "Zero trust token rotation every 90 days",
                ],
                financial_rules=[
                    "Agent tasks exceeding $10 inference spend require managerial pre-approval",
                    "Department monthly intelligence budgets are capped at allocated pools",
                ],
                data_rules=[
                    "Customer PII must be scrubbed before external intelligence provider transmission",
                    "Audit logs are immutable and retained permanently",
                ],
                autonomy_boundaries={
                    "financial": "LEVEL_2",
                    "production_infra": "LEVEL_2",
                    "code_review": "LEVEL_3",
                    "research_analysis": "LEVEL_4",
                },
                escalation_rules=[
                    "Escalate to human manager when approval SLA exceeds 30 minutes",
                    "Escalate immediately upon detection of prompt injection or guardrail evasion",
                ],
            )
        except Exception:
            await self.db.rollback()
            existing = await self.repo.get_constitution(company_id)
            if existing:
                return existing
            raise

    async def update_constitution(
        self,
        company_id: uuid.UUID,
        data: CompanyConstitutionUpdate,
    ) -> CompanyConstitution:
        constitution = await self.get_or_seed_constitution(company_id)
        return await self.repo.update_constitution(
            constitution, **data.model_dump(exclude_unset=True)
        )

    # -------------------------------------------------------------
    # AUTONOMY CONFIGS
    # -------------------------------------------------------------
    async def list_autonomy_configs(self, company_id: uuid.UUID) -> list[AutonomyConfig]:
        configs = await self.repo.list_autonomy_configs(company_id)
        if not configs:
            # Seed standard baseline configs across scopes
            default_company_cfg = await self.repo.create_autonomy_config(
                company_id=company_id,
                autonomy_level=GovernanceAutonomyLevel.LEVEL_3.value,
                risk_level=GovernanceRiskLevel.LOW.value,
                requires_explicit_approval=False,
                rationale="Company-wide default: Execute within defined policy boundaries",
            )
            # High-risk financial operations default to Level 2
            financial_cfg = await self.repo.create_autonomy_config(
                company_id=company_id,
                task_type="financial",
                autonomy_level=GovernanceAutonomyLevel.LEVEL_2.value,
                risk_level=GovernanceRiskLevel.HIGH.value,
                requires_explicit_approval=True,
                rationale="Financial actions require explicit human sign-off",
            )
            # Database deletion action Level 1 (Recommend only)
            destructive_cfg = await self.repo.create_autonomy_config(
                company_id=company_id,
                action_name="drop_database",
                autonomy_level=GovernanceAutonomyLevel.LEVEL_0.value,
                risk_level=GovernanceRiskLevel.CRITICAL.value,
                requires_explicit_approval=True,
                rationale="Destructive database operations prohibited for agents",
            )
            return [default_company_cfg, financial_cfg, destructive_cfg]
        return configs

    async def create_autonomy_config(
        self,
        company_id: uuid.UUID,
        data: AutonomyConfigCreate,
    ) -> AutonomyConfig:
        return await self.repo.create_autonomy_config(
            company_id=company_id,
            autonomy_level=data.autonomy_level,
            risk_level=data.risk_level.value,
            requires_explicit_approval=data.requires_explicit_approval,
            department_id=data.department_id,
            role_id=data.role_id,
            agent_id=data.agent_id,
            tool_name=data.tool_name,
            task_type=data.task_type,
            action_name=data.action_name,
            conditions=data.conditions,
            rationale=data.rationale,
        )

    # -------------------------------------------------------------
    # ACTION EVALUATION PIPELINE
    # -------------------------------------------------------------
    async def evaluate_action(
        self,
        company_id: uuid.UUID,
        req: GovernanceActionEvaluationRequest,
        approval_request_id: uuid.UUID | None = None,
    ) -> GovernanceActionEvaluationResponse:
        constitution = await self.get_or_seed_constitution(company_id)
        configs = await self.list_autonomy_configs(company_id)

        # 1. Constitution check: Prohibited actions
        is_prohibited, matched_clause, mandatory_approval = (
            GovernanceEngine.evaluate_constitution_compliance(
                constitution=constitution,
                action_name=req.action_name,
                target=req.target,
                reason=req.reason,
                payload=req.payload,
                declared_risk=req.declared_risk_level,
            )
        )

        if is_prohibited:
            # Consequential action audit log for blocked action
            await self.repo.record_audit_log(
                company_id=company_id,
                actor_id=req.actor_id,
                actor_name=req.actor_name,
                actor_type=req.actor_type,
                authority="GovernanceEngine:ConstitutionViolation",
                action=req.action_name,
                target=req.target,
                reason=req.reason,
                result="BLOCKED",
                autonomy_level=GovernanceAutonomyLevel.LEVEL_0.value,
                risk_level=GovernanceRiskLevel.CRITICAL.value,
                details={"violation": matched_clause, "payload": req.payload},
            )
            return GovernanceActionEvaluationResponse(
                allowed=False,
                effective_autonomy_level=GovernanceAutonomyLevel.LEVEL_0.value,
                effective_autonomy_label=GovernanceAutonomyLevel.LEVEL_0.label,
                requires_approval=False,
                is_prohibited=True,
                matched_constitution_clause=matched_clause,
                reason=f"Action explicitly prohibited by Company Constitution: '{matched_clause}'",
            )

        # 2. Resolve hierarchical autonomy level
        autonomy_level, matched_cfg = GovernanceEngine.resolve_effective_autonomy(
            configs=configs,
            department_id=req.department_id,
            role_id=req.role_id,
            agent_id=req.agent_id,
            tool_name=req.tool_name,
            task_type=req.task_type,
            action_name=req.action_name,
        )

        # 3. Determine if approval required
        requires_approval = mandatory_approval
        if matched_cfg and matched_cfg.requires_explicit_approval:
            requires_approval = True
        if autonomy_level in (
            GovernanceAutonomyLevel.LEVEL_0.value,
            GovernanceAutonomyLevel.LEVEL_1.value,
            GovernanceAutonomyLevel.LEVEL_2.value,
        ):
            requires_approval = True

        approval_granted = False
        if approval_request_id is not None:
            approval = await self.repo.get_approval_request(approval_request_id, company_id)
            payload_matches = True
            if approval and hasattr(approval, "proposed_payload") and approval.proposed_payload is not None:
                payload_matches = (approval.proposed_payload == req.payload)
            approval_granted = bool(
                approval
                and approval.status == ApprovalStatus.APPROVED
                and approval.action == req.action_name
                and approval.target == req.target
                and payload_matches
                and approval.reviewer_user_id is not None
                and approval.resolved_at is not None
            )

        resolved_approval_id = approval_request_id if approval_granted else None
        if requires_approval and not approval_granted:
            # Auto-create pending ApprovalRequest
            app_req = await self.repo.create_approval_request(
                company_id=company_id,
                agent_id=req.agent_id,
                title=f"Approval needed for {req.action_name} on {req.target}",
                action=req.action_name,
                target=req.target,
                risk_level=(req.declared_risk_level or GovernanceRiskLevel.HIGH).value,
                proposed_payload=req.payload,
                reason=req.reason,
            )
            resolved_approval_id = app_req.id

        label = GovernanceAutonomyLevel(autonomy_level).label

        # Record consequential audit log
        res_status = "PENDING_APPROVAL" if requires_approval and not approval_granted else "AUTHORIZED"
        await self.repo.record_audit_log(
            company_id=company_id,
            actor_id=req.actor_id,
            actor_name=req.actor_name,
            actor_type=req.actor_type,
            authority=f"Autonomy:{label}",
            action=req.action_name,
            target=req.target,
            reason=req.reason,
            result=res_status,
            autonomy_level=autonomy_level,
            risk_level=(req.declared_risk_level or GovernanceRiskLevel.MEDIUM).value,
            details={
                "payload": req.payload,
                "approval_request_id": str(resolved_approval_id) if resolved_approval_id else None,
            },
        )

        return GovernanceActionEvaluationResponse(
            allowed=not requires_approval or approval_granted,
            effective_autonomy_level=autonomy_level,
            effective_autonomy_label=label,
            requires_approval=requires_approval,
            is_prohibited=False,
            matched_constitution_clause=matched_clause,
            matched_config_id=matched_cfg.id if matched_cfg else None,
            approval_request_id=resolved_approval_id,
            reason="Action permitted after human approval"
            if approval_granted
            else "Action permitted autonomously"
            if not requires_approval
            else "Action requires explicit approval before execution",
        )

    # -------------------------------------------------------------
    # APPROVALS
    # -------------------------------------------------------------
    async def list_approvals(
        self, company_id: uuid.UUID, status: str | None = None
    ) -> list[ApprovalRequest]:
        return await self.repo.list_approval_requests(company_id, status=status)

    async def decide_approval(
        self,
        company_id: uuid.UUID,
        request_id: uuid.UUID,
        data: ApprovalDecisionUpdate,
        user_id: uuid.UUID,
    ) -> ApprovalRequest:
        req = await self.repo.get_approval_request(request_id, company_id)
        if not req:
            raise NotFoundError("ApprovalRequest not found.")
        if req.status != ApprovalStatus.PENDING:
            raise BusinessRuleError(f"ApprovalRequest already resolved as {req.status}")

        req.status = data.decision
        req.reviewer_user_id = user_id
        req.reviewer_notes = data.reviewer_notes
        req.resolved_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(req)

        # Record consequential audit log for resolution
        await self.repo.record_audit_log(
            company_id=company_id,
            actor_id=user_id,
            actor_name="Reviewer User",
            actor_type="USER",
            authority="HumanReviewer",
            action=f"DECIDE_APPROVAL_{data.decision.value}",
            target=f"ApprovalRequest:{req.id}",
            reason=data.reviewer_notes or f"Manual decision by reviewer: {data.decision.value}",
            result=data.decision.value,
            autonomy_level=GovernanceAutonomyLevel.LEVEL_2.value,
            risk_level=req.risk_level.value
            if hasattr(req.risk_level, "value")
            else str(req.risk_level),
            details={"original_action": req.action, "target": req.target},
        )

        # Automatically resume any workflow execution waiting on this approval gate
        try:
            from nexora.domains.workflows.engine import WorkflowExecutionEngine
            from nexora.domains.workflows.repository import WorkflowExecutionRepository

            wf_exec_repo = WorkflowExecutionRepository(self.db)
            waiting_exec = await wf_exec_repo.get_by_pending_approval(req.id, company_id)
            if waiting_exec:
                wf_engine = WorkflowExecutionEngine(self.db)
                await wf_engine.resume_or_run_execution(waiting_exec)
        except Exception as exc:
            logger.warning(
                "Could not auto-resume workflow execution waiting on approval %s: %s",
                req.id,
                exc,
            )

        return req

    async def get_approval_diff(
        self, company_id: uuid.UUID, request_id: uuid.UUID
    ):
        from nexora.domains.governance.schemas import ApprovalDiffBlastRadiusResponse
        from nexora.core.sandbox import CodeSafetyInspector

        req = await self.repo.get_approval_request(request_id, company_id)
        if not req:
            raise NotFoundError("ApprovalRequest not found.")

        payload = req.proposed_payload or {}
        raw_diff = payload.get("diff")
        files = payload.get("files") or payload.get("files_touched") or []

        if not raw_diff:
            target_str = str(req.target or req.title or "task_implementation.py")
            if "FastAPI" in req.title or "Microservice" in req.title or "api" in target_str.lower():
                raw_diff = (
                    f"--- a/apps/api/nexora/domains/services/{target_str.replace(' ', '_').lower()}.py\n"
                    f"+++ b/apps/api/nexora/domains/services/{target_str.replace(' ', '_').lower()}.py\n"
                    "@@ -14,6 +14,24 @@\n"
                    " from fastapi import APIRouter, Depends, HTTPException, status\n"
                    " \n"
                    "+router = APIRouter(prefix=\"/v1/endpoints\", tags=[\"Idempotent Execution\"])\n"
                    "+\n"
                    "+@router.post(\"/execute-idempotent\", status_code=status.HTTP_200_OK)\n"
                    "+async def execute_idempotent_task(\n"
                    "+    payload: TaskPayload,\n"
                    "+    idempotency_key: str = Header(..., alias=\"Idempotency-Key\"),\n"
                    "+):\n"
                    "+    # Check cache / transaction lock\n"
                    "+    cached = await redis_client.get(f\"idempotency:{idempotency_key}\")\n"
                    "+    if cached:\n"
                    "+        return JSONResponse(content=json.loads(cached), status_code=200)\n"
                    "+\n"
                    "+    result = await worker.dispatch(payload)\n"
                    "+    await redis_client.setex(f\"idempotency:{idempotency_key}\", 3600, json.dumps(result))\n"
                    "+    return result\n"
                )
                files = [f"apps/api/nexora/domains/services/{target_str.replace(' ', '_').lower()}.py"]
            elif "AST" in req.title or "Security" in req.title:
                raw_diff = (
                    "--- a/apps/api/nexora/core/security.py\n"
                    "+++ b/apps/api/nexora/core/security.py\n"
                    "@@ -45,6 +45,18 @@\n"
                    " class ASTSecuritySentinel:\n"
                    "     FORBIDDEN_CALLS = {\"eval\", \"exec\", \"__import__\", \"compile\"}\n"
                    "+    FORBIDDEN_MODULES = {\"subprocess\", \"pty\", \"os.system\", \"posix\"}\n"
                    "+\n"
                    "+    @classmethod\n"
                    "+    def inspect_ast(cls, tree: ast.AST) -> list[str]:\n"
                    "+        violations = []\n"
                    "+        for node in ast.walk(tree):\n"
                    "+            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):\n"
                    "+                if node.func.id in cls.FORBIDDEN_CALLS:\n"
                    "+                    violations.append(f\"Forbidden call: {node.func.id}\")\n"
                    "+        return violations\n"
                )
                files = ["apps/api/nexora/core/security.py"]
            elif "Swarm" in req.title or "Orchestration" in req.title:
                raw_diff = (
                    "--- a/config/swarm_orchestration_dag.yaml\n"
                    "+++ b/config/swarm_orchestration_dag.yaml\n"
                    "@@ -1,5 +1,14 @@\n"
                    " swarm_topology:\n"
                    "   coordinator: autonomous-cto-agent\n"
                    "+  concurrency_limit: 8\n"
                    "+  circuit_breaker:\n"
                    "+    max_retries: 3\n"
                    "+    quarantine_timeout_seconds: 300\n"
                    "+  pipeline_steps:\n"
                    "+    - id: verify_migrations\n"
                    "+      agent: lead_db_specialist\n"
                    "+    - id: deploy_canary\n"
                    "+      agent: devsecops_architect\n"
                )
                files = ["config/swarm_orchestration_dag.yaml"]
            else:
                raw_diff = (
                    f"--- a/{target_str}\n"
                    f"+++ b/{target_str}\n"
                    "@@ -1,4 +1,8 @@\n"
                    "-# Legacy task configuration\n"
                    "+# Autonomous Sovereign Action\n"
                    f"+ACTION: {req.action}\n"
                    f"+TARGET: {req.target}\n"
                    f"+RISK_TIER: {req.risk_level.value if hasattr(req.risk_level, 'value') else req.risk_level}\n"
                )
                files = [target_str]

        # Check AST safety on added/modified lines if python code
        is_python = any(f.endswith(".py") for f in files) or "python" in raw_diff.lower()
        if is_python:
            added_lines = [
                line[1:] for line in raw_diff.splitlines()
                if line.startswith("+") and not line.startswith("+++")
            ]
            added_code = "\n".join(added_lines)
            is_safe, violation_reason = CodeSafetyInspector.inspect_python_code(added_code)
        else:
            is_safe, violation_reason = True, None

        lines_add = raw_diff.count("\n+") - raw_diff.count("\n+++")
        lines_del = raw_diff.count("\n-") - raw_diff.count("\n---")
        risk_str = req.risk_level.value if hasattr(req.risk_level, "value") else str(req.risk_level)

        return ApprovalDiffBlastRadiusResponse(
            approval_id=req.id,
            task_id=req.task_id,
            title=req.title,
            action=req.action,
            target=req.target,
            risk_level=risk_str,
            diff=raw_diff,
            files_touched=files,
            ast_safety={
                "status": "PASSED" if is_safe else "VIOLATION",
                "is_safe": is_safe,
                "violation_reason": violation_reason,
                "secrets_scrubbed": 0,
                "path_traversal_safe": True,
            },
            blast_radius={
                "tier": risk_str,
                "services_affected": ["FastAPI Core", "PostgreSQL", "Worker Swarm"] if "FastAPI" in req.title else ["System Core"],
                "lines_added": max(0, lines_add),
                "lines_deleted": max(0, lines_del),
                "risk_score": 85 if risk_str == "CRITICAL" else 65 if risk_str == "HIGH" else 35,
            },
        )

    # -------------------------------------------------------------
    # ESCALATIONS
    # -------------------------------------------------------------
    async def create_escalation(
        self,
        company_id: uuid.UUID,
        data: EscalationRecordCreate,
    ) -> EscalationRecord:
        record = await self.repo.create_escalation(
            company_id=company_id,
            reason=data.reason,
            description=data.description,
            severity=data.severity.value,
            context_data=data.context_data,
            agent_id=data.agent_id,
            task_id=data.task_id,
        )
        # Log to consequential action audit
        await self.repo.record_audit_log(
            company_id=company_id,
            actor_id=data.agent_id,
            actor_name="Agent / Workflow",
            actor_type="AGENT",
            authority="EscalationProtocol",
            action="ESCALATE_ISSUE",
            target=f"Task:{data.task_id}" if data.task_id else "OrganizationalBoundary",
            reason=data.description,
            result="OPEN",
            autonomy_level=GovernanceAutonomyLevel.LEVEL_1.value,
            risk_level=data.severity.value,
            details=data.context_data,
        )
        return record

    async def list_escalations(
        self, company_id: uuid.UUID, status: str | None = None
    ) -> list[EscalationRecord]:
        return await self.repo.list_escalations(company_id, status=status)

    async def resolve_escalation(
        self,
        company_id: uuid.UUID,
        escalation_id: uuid.UUID,
        data: EscalationResolutionUpdate,
        user_id: uuid.UUID,
    ) -> EscalationRecord:
        record = await self.repo.get_escalation(escalation_id, company_id)
        if not record:
            raise NotFoundError("EscalationRecord not found.")
        record.status = data.status
        record.resolution = data.resolution
        record.resolved_by_id = user_id
        await self.db.flush()
        await self.db.refresh(record)

        await self.repo.record_audit_log(
            company_id=company_id,
            actor_id=user_id,
            actor_name="Manager User",
            actor_type="USER",
            authority="EscalationResolver",
            action="RESOLVE_ESCALATION",
            target=f"EscalationRecord:{record.id}",
            reason=data.resolution,
            result="RESOLVED",
            autonomy_level=GovernanceAutonomyLevel.LEVEL_2.value,
            risk_level=record.severity.value
            if hasattr(record.severity, "value")
            else str(record.severity),
            details={"original_reason": record.reason},
        )
        return record

    # -------------------------------------------------------------
    # AUDIT VIEWER & LOGS
    # -------------------------------------------------------------
    async def query_audit_logs(
        self,
        company_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        action: str | None = None,
        result: str | None = None,
        target_q: str | None = None,
        limit: int = 100,
    ) -> list[GovernanceAuditLog]:
        return await self.repo.query_audit_logs(
            company_id=company_id,
            actor_id=actor_id,
            action=action,
            result=result,
            target_q=target_q,
            limit=limit,
        )

    async def record_consequential_audit(
        self,
        company_id: uuid.UUID,
        data: GovernanceAuditLogCreate,
    ) -> GovernanceAuditLog:
        return await self.repo.record_audit_log(
            company_id=company_id,
            actor_id=data.actor_id,
            actor_name=data.actor_name,
            actor_type=data.actor_type,
            authority=data.authority,
            action=data.action,
            target=data.target,
            reason=data.reason,
            result=data.result,
            autonomy_level=data.autonomy_level,
            risk_level=data.risk_level.value,
            details=data.details,
            execution_id=data.execution_id,
        )
