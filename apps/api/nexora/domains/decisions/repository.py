"""Decision repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.decisions.models import Decision


class DecisionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, decision_id: uuid.UUID) -> Decision | None:
        result = await self.db.execute(
            select(Decision).where(Decision.id == decision_id, Decision.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[Decision]:
        result = await self.db.execute(
            select(Decision)
            .where(Decision.company_id == company_id, Decision.is_deleted.is_(False))
            .order_by(Decision.created_at.desc())
        )
        return list(result.scalars().all())

    def _serialize(self, kwargs: dict) -> dict:
        for key, value in kwargs.items():
            if isinstance(value, list) and value and hasattr(value[0], "model_dump"):
                kwargs[key] = [v.model_dump() for v in value]
        return kwargs

    async def create(self, company_id: uuid.UUID, **kwargs) -> Decision:
        kwargs = self._serialize(kwargs)
        decision = Decision(company_id=company_id, **kwargs)
        self.db.add(decision)
        await self.db.flush()
        await self.db.refresh(decision)
        return decision

    async def update(self, item: Decision, **kwargs) -> Decision:
        kwargs = self._serialize(kwargs)
        for key, value in kwargs.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def soft_delete(self, decision: Decision) -> None:
        from datetime import UTC, datetime

        decision.is_deleted = True
        decision.deleted_at = datetime.now(UTC)
        await self.db.flush()
