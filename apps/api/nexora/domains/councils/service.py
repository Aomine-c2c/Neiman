"""
Council & Deliberation Service.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.councils.engine import DeliberationEngine
from nexora.domains.councils.models import AgentCouncil, CouncilDeliberation
from nexora.domains.councils.repository import CouncilRepository
from nexora.exceptions import NotFoundError


class CouncilService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CouncilRepository(db)
        self.engine = DeliberationEngine(db)

    async def create_council(
        self,
        company_id: uuid.UUID,
        name: str,
        charter: str,
        council_type: str = "PERMANENT",
        synthesis_agent_id: uuid.UUID | None = None,
        members: list[dict[str, Any]] | None = None,
    ) -> AgentCouncil:
        return await self.repo.create_council(
            company_id=company_id,
            name=name,
            charter=charter,
            council_type=council_type,
            synthesis_agent_id=synthesis_agent_id,
            members=members,
        )

    async def get_council(self, council_id: uuid.UUID, company_id: uuid.UUID) -> AgentCouncil:
        council = await self.repo.get_council(council_id, company_id)
        if not council:
            raise NotFoundError(f"Agent Council {council_id} not found.")
        return council

    async def list_councils(self, company_id: uuid.UUID) -> list[AgentCouncil]:
        return await self.repo.list_councils(company_id)

    async def start_deliberation(
        self,
        council_id: uuid.UUID,
        company_id: uuid.UUID,
        title: str,
        problem_statement: str,
        context_data: dict[str, Any] | None = None,
        initial_proposals: list[dict[str, Any]] | None = None,
        auto_execute: bool = True,
    ) -> CouncilDeliberation:
        council = await self.get_council(council_id, company_id)
        delib = await self.repo.create_deliberation(
            council_id=council.id,
            company_id=company_id,
            title=title,
            problem_statement=problem_statement,
            context_data=context_data,
            initial_proposals=initial_proposals,
        )
        if auto_execute:
            await self.engine.run_full_deliberation(council, delib)
        return await self.get_deliberation(delib.id, company_id)

    async def get_deliberation(
        self, deliberation_id: uuid.UUID, company_id: uuid.UUID
    ) -> CouncilDeliberation:
        delib = await self.repo.get_deliberation(deliberation_id, company_id)
        if not delib:
            raise NotFoundError(f"Deliberation {deliberation_id} not found.")
        return delib

    async def list_deliberations(
        self,
        company_id: uuid.UUID,
        council_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[CouncilDeliberation]:
        return await self.repo.list_deliberations(
            company_id=company_id,
            council_id=council_id,
            limit=limit,
            offset=offset,
        )

    async def decide_and_record(
        self,
        deliberation_id: uuid.UUID,
        company_id: uuid.UUID,
        decision_text: str,
        rationale: str,
        user_id: uuid.UUID | None = None,
        record_in_memory: bool = True,
    ) -> CouncilDeliberation:
        delib = await self.get_deliberation(deliberation_id, company_id)
        return await self.engine.ratify_decision(
            deliberation=delib,
            decision_text=decision_text,
            rationale=rationale,
            user_id=user_id,
            record_in_memory=record_in_memory,
        )
