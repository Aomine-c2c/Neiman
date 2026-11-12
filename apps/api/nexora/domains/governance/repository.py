import uuid
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import ApprovalStatus, EscalationStatus
from nexora.domains.governance.models import (
    ApprovalRequest,
    AutonomyConfig,
    CompanyConstitution,
    EscalationRecord,
    GovernanceAuditLog,
)


class GovernanceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------
    # CONSTITUTION
    # -------------------------------------------------------------
    async def get_constitution(self, company_id: uuid.UUID) -> CompanyConstitution | None:
        stmt = select(CompanyConstitution).where(CompanyConstitution.company_id == company_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def create_constitution(
        self,
        company_id: uuid.UUID,
        mission: str,
        values: list,
        operating_principles: list,
        prohibited_actions: list,
        approval_requirements: list,
        security_rules: list,
        financial_rules: list,
        data_rules: list,
        autonomy_boundaries: dict,
        escalation_rules: list,
        established_by: uuid.UUID | None = None,
    ) -> CompanyConstitution:
        constitution = CompanyConstitution(
            company_id=company_id,
            mission=mission,
            values=values,
            operating_principles=operating_principles,
            prohibited_actions=prohibited_actions,
            approval_requirements=approval_requirements,
            security_rules=security_rules,
            financial_rules=financial_rules,
            data_rules=data_rules,
            autonomy_boundaries=autonomy_boundaries,
            escalation_rules=escalation_rules,
            established_by=established_by,
        )
        self.db.add(constitution)
        await self.db.flush()
        await self.db.refresh(constitution)
        return constitution

    async def update_constitution(
        self, constitution: CompanyConstitution, **kwargs
    ) -> CompanyConstitution:
        for k, v in kwargs.items():
            if v is not None and hasattr(constitution, k):
                setattr(constitution, k, v)
        constitution.version += 1
        await self.db.flush()
        await self.db.refresh(constitution)
        return constitution

    # -------------------------------------------------------------
    # AUTONOMY CONFIGS
    # -------------------------------------------------------------
    async def list_autonomy_configs(self, company_id: uuid.UUID) -> list[AutonomyConfig]:
        stmt = select(AutonomyConfig).where(AutonomyConfig.company_id == company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_autonomy_config(
        self,
        company_id: uuid.UUID,
        autonomy_level: int,
        risk_level: str,
        requires_explicit_approval: bool,
        department_id: uuid.UUID | None = None,
        role_id: uuid.UUID | None = None,
        agent_id: uuid.UUID | None = None,
        tool_name: str | None = None,
        task_type: str | None = None,
        action_name: str | None = None,
        conditions: dict | None = None,
        rationale: str | None = None,
    ) -> AutonomyConfig:
        config = AutonomyConfig(
            company_id=company_id,
            autonomy_level=autonomy_level,
            risk_level=risk_level,
            requires_explicit_approval=requires_explicit_approval,
            department_id=department_id,
            role_id=role_id,
            agent_id=agent_id,
            tool_name=tool_name,
            task_type=task_type,
            action_name=action_name,
            conditions=conditions or {},
            rationale=rationale,
        )
        self.db.add(config)
        await self.db.flush()
        await self.db.refresh(config)
        return config

    # -------------------------------------------------------------
    # APPROVAL REQUESTS
    # -------------------------------------------------------------
    async def create_approval_request(
        self,
        company_id: uuid.UUID,
        title: str,
        action: str,
        target: str,
        risk_level: str,
        proposed_payload: dict,
        reason: str,
        agent_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
    ) -> ApprovalRequest:
        existing_stmt = select(ApprovalRequest).where(
            ApprovalRequest.company_id == company_id,
            ApprovalRequest.action == action,
            ApprovalRequest.target == target,
            ApprovalRequest.status == ApprovalStatus.PENDING,
        )
        if task_id is not None:
            existing_stmt = existing_stmt.where(ApprovalRequest.task_id == task_id)
        existing_res = await self.db.execute(existing_stmt)
        existing = existing_res.scalars().first()
        if existing and (existing.proposed_payload or {}) == (proposed_payload or {}):
            return existing

        req = ApprovalRequest(
            company_id=company_id,
            title=title,
            action=action,
            target=target,
            risk_level=risk_level,
            proposed_payload=proposed_payload,
            reason=reason,
            agent_id=agent_id,
            task_id=task_id,
            status=ApprovalStatus.PENDING,
        )
        self.db.add(req)
        await self.db.flush()
        await self.db.refresh(req)
        return req

    async def get_approval_request(
        self, request_id: uuid.UUID, company_id: uuid.UUID
    ) -> ApprovalRequest | None:
        stmt = select(ApprovalRequest).where(
            ApprovalRequest.id == request_id,
            ApprovalRequest.company_id == company_id,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_approval_requests(
        self,
        company_id: uuid.UUID,
        status: str | None = None,
        limit: int = 50,
    ) -> list[ApprovalRequest]:
        stmt = select(ApprovalRequest).where(ApprovalRequest.company_id == company_id)
        if status:
            stmt = stmt.where(ApprovalRequest.status == status)
        stmt = stmt.order_by(ApprovalRequest.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # -------------------------------------------------------------
    # ESCALATION RECORDS
    # -------------------------------------------------------------
    async def create_escalation(
        self,
        company_id: uuid.UUID,
        reason: str,
        description: str,
        severity: str,
        context_data: dict,
        agent_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
    ) -> EscalationRecord:
        record = EscalationRecord(
            company_id=company_id,
            reason=reason,
            description=description,
            severity=severity,
            context_data=context_data,
            agent_id=agent_id,
            task_id=task_id,
            status=EscalationStatus.OPEN,
        )
        self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return record

    async def list_escalations(
        self,
        company_id: uuid.UUID,
        status: str | None = None,
        limit: int = 50,
    ) -> list[EscalationRecord]:
        stmt = select(EscalationRecord).where(EscalationRecord.company_id == company_id)
        if status:
            stmt = stmt.where(EscalationRecord.status == status)
        stmt = stmt.order_by(EscalationRecord.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_escalation(
        self, escalation_id: uuid.UUID, company_id: uuid.UUID
    ) -> EscalationRecord | None:
        stmt = select(EscalationRecord).where(
            EscalationRecord.id == escalation_id,
            EscalationRecord.company_id == company_id,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    # -------------------------------------------------------------
    # AUDIT LOGS
    # -------------------------------------------------------------
    async def record_audit_log(
        self,
        company_id: uuid.UUID,
        actor_name: str,
        authority: str,
        action: str,
        target: str,
        reason: str,
        result: str,
        autonomy_level: int,
        risk_level: str,
        details: dict,
        actor_id: uuid.UUID | None = None,
        actor_type: str = "AGENT",
        execution_id: uuid.UUID | None = None,
    ) -> GovernanceAuditLog:
        from nexora.core.security import AuditIntegrityChamber

        # Fetch latest audit log signature for this company to chain
        prev_stmt = (
            select(GovernanceAuditLog.integrity_signature)
            .where(GovernanceAuditLog.company_id == company_id)
            .order_by(GovernanceAuditLog.created_at.desc())
            .limit(1)
        )
        prev_sig_res = await self.db.execute(prev_stmt)
        prev_sig = prev_sig_res.scalar_one_or_none() or "GENESIS"

        log_id = uuid.uuid4()
        now_dt = datetime.now(UTC)
        timestamp_str = now_dt.isoformat()
        sig = AuditIntegrityChamber.compute_record_signature(
            audit_id=str(log_id),
            company_id=str(company_id),
            actor_id=str(actor_id or "NONE"),
            action=action,
            target=target,
            result=result,
            timestamp=timestamp_str,
            previous_signature=prev_sig,
        )

        log = GovernanceAuditLog(
            id=log_id,
            company_id=company_id,
            actor_name=actor_name,
            actor_id=actor_id,
            actor_type=actor_type,
            authority=authority,
            action=action,
            target=target,
            reason=reason,
            result=result,
            autonomy_level=autonomy_level,
            risk_level=risk_level,
            details=details,
            execution_id=execution_id,
            created_at=now_dt,
            integrity_signature=sig,
            previous_signature=prev_sig,
        )
        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)
        return log

    async def query_audit_logs(
        self,
        company_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        action: str | None = None,
        result: str | None = None,
        target_q: str | None = None,
        limit: int = 100,
    ) -> list[GovernanceAuditLog]:
        stmt = select(GovernanceAuditLog).where(GovernanceAuditLog.company_id == company_id)
        if actor_id:
            stmt = stmt.where(GovernanceAuditLog.actor_id == actor_id)
        if action:
            stmt = stmt.where(GovernanceAuditLog.action == action)
        if result:
            stmt = stmt.where(GovernanceAuditLog.result == result)
        if target_q:
            stmt = stmt.where(
                or_(
                    GovernanceAuditLog.target.ilike(f"%{target_q}%"),
                    GovernanceAuditLog.reason.ilike(f"%{target_q}%"),
                )
            )
        stmt = stmt.order_by(GovernanceAuditLog.created_at.desc()).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())
