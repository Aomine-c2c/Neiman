"""Decision service."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import DecisionStatus
from nexora.domains.decisions.models import Decision
from nexora.domains.decisions.repository import DecisionRepository
from nexora.exceptions import BusinessRuleError, NotFoundError


class DecisionService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = DecisionRepository(db)

    async def create(self, company_id: uuid.UUID, **kwargs) -> Decision:
        return await self.repo.create(company_id=company_id, **kwargs)

    async def get(self, decision_id: uuid.UUID, company_id: uuid.UUID) -> Decision:
        d = await self.repo.get_by_id(decision_id)
        if not d or d.company_id != company_id:
            raise NotFoundError(f"Decision {decision_id} not found.")
        return d

    async def list(self, company_id: uuid.UUID) -> list[Decision]:
        return await self.repo.list_by_company(company_id)

    async def update(self, decision_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Decision:
        d = await self.get(decision_id, company_id)
        if d.status in (
            DecisionStatus.DECIDED,
            DecisionStatus.IMPLEMENTED,
            DecisionStatus.EVALUATED,
        ):
            raise BusinessRuleError("Cannot update a closed decision. Record an outcome instead.")
        return await self.repo.update(d, **kwargs)

    async def resolve(
        self,
        decision_id: uuid.UUID,
        company_id: uuid.UUID,
        decided_by_id: uuid.UUID,
        decision_text: str,
        rationale: str,
        expected_outcome: str | None,
    ) -> Decision:
        d = await self.get(decision_id, company_id)
        if d.status == DecisionStatus.DECIDED:
            raise BusinessRuleError("Decision already resolved.")
        return await self.repo.update(
            d,
            decision=decision_text,
            rationale=rationale,
            expected_outcome=expected_outcome,
            status=DecisionStatus.DECIDED,
            decided_at=datetime.now(UTC),
            decided_by_id=decided_by_id,
        )

    async def record_outcome(
        self, decision_id: uuid.UUID, company_id: uuid.UUID, actual_outcome: str
    ) -> Decision:
        d = await self.get(decision_id, company_id)
        if d.status not in (DecisionStatus.DECIDED, DecisionStatus.IMPLEMENTED):
            raise BusinessRuleError("Can only record outcome for DECIDED or IMPLEMENTED decisions.")
        return await self.repo.update(
            d, actual_outcome=actual_outcome, status=DecisionStatus.EVALUATED
        )

    async def delete(self, decision_id: uuid.UUID, company_id: uuid.UUID) -> None:
        d = await self.get(decision_id, company_id)
        await self.repo.soft_delete(d)
