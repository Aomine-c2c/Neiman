"""Policy repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import PolicyStatus
from nexora.domains.policies.models import Policy


class PolicyRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, policy_id: uuid.UUID) -> Policy | None:
        result = await self.db.execute(
            select(Policy).where(Policy.id == policy_id, Policy.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[Policy]:
        result = await self.db.execute(
            select(Policy)
            .where(Policy.company_id == company_id, Policy.is_deleted.is_(False))
            .order_by(Policy.name)
        )
        return list(result.scalars().all())

    async def create(self, company_id: uuid.UUID, **kwargs) -> Policy:
        rules = kwargs.pop("rules", [])
        if rules and hasattr(rules[0], "model_dump"):
            rules = [r.model_dump() for r in rules]
        policy = Policy(company_id=company_id, rules=rules, **kwargs)
        self.db.add(policy)
        await self.db.flush()
        await self.db.refresh(policy)
        return policy

    async def update(self, policy: Policy, **kwargs) -> Policy:
        rules = kwargs.pop("rules", None)
        if rules is not None:
            if rules and hasattr(rules[0], "model_dump"):
                rules = [r.model_dump() for r in rules]
            policy.rules = rules
            policy.version += 1
        for key, value in kwargs.items():
            if value is not None and hasattr(policy, key):
                setattr(policy, key, value)
        await self.db.flush()
        await self.db.refresh(policy)
        return policy

    async def soft_delete(self, policy: Policy) -> None:
        from datetime import UTC, datetime

        policy.is_deleted = True
        policy.deleted_at = datetime.now(UTC)
        policy.status = PolicyStatus.INACTIVE
        await self.db.flush()
