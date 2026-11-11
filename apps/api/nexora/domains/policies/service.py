"""Policy service."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.policies.models import Policy
from nexora.domains.policies.repository import PolicyRepository
from nexora.exceptions import NotFoundError


class PolicyService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = PolicyRepository(db)

    async def create(self, company_id: uuid.UUID, **kwargs) -> Policy:
        return await self.repo.create(company_id=company_id, **kwargs)

    async def get(self, policy_id: uuid.UUID, company_id: uuid.UUID) -> Policy:
        policy = await self.repo.get_by_id(policy_id)
        if not policy or policy.company_id != company_id:
            raise NotFoundError(f"Policy {policy_id} not found.")
        return policy

    async def list(self, company_id: uuid.UUID) -> list[Policy]:
        return await self.repo.list_by_company(company_id)

    async def update(self, policy_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Policy:
        policy = await self.get(policy_id, company_id)
        return await self.repo.update(policy, **kwargs)

    async def delete(self, policy_id: uuid.UUID, company_id: uuid.UUID) -> None:
        policy = await self.get(policy_id, company_id)
        await self.repo.soft_delete(policy)
