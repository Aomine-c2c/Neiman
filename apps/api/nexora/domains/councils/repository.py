"""
Repository for Agent Councils and Deliberations.
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from nexora.domains.councils.models import AgentCouncil, CouncilDeliberation


class CouncilRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------
    # AGENT COUNCILS
    # -------------------------------------------------------------
    async def create_council(
        self,
        company_id: uuid.UUID,
        name: str,
        charter: str,
        council_type: str,
        synthesis_agent_id: uuid.UUID | None = None,
        members: list[dict[str, Any]] | None = None,
    ) -> AgentCouncil:
        council = AgentCouncil(
            company_id=company_id,
            name=name,
            charter=charter,
            council_type=council_type,
            synthesis_agent_id=synthesis_agent_id,
            members=members or [],
        )
        self.db.add(council)
        await self.db.flush()
        await self.db.refresh(council)
        return council

    async def get_council(
        self, council_id: uuid.UUID, company_id: uuid.UUID
    ) -> AgentCouncil | None:
        stmt = (
            select(AgentCouncil)
            .where(AgentCouncil.id == council_id, AgentCouncil.company_id == company_id)
            .options(selectinload(AgentCouncil.deliberations))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_councils(self, company_id: uuid.UUID) -> list[AgentCouncil]:
        stmt = (
            select(AgentCouncil)
            .where(AgentCouncil.company_id == company_id)
            .options(selectinload(AgentCouncil.deliberations))
            .order_by(AgentCouncil.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # -------------------------------------------------------------
    # DELIBERATIONS
    # -------------------------------------------------------------
    async def create_deliberation(
        self,
        council_id: uuid.UUID,
        company_id: uuid.UUID,
        title: str,
        problem_statement: str,
        context_data: dict[str, Any] | None = None,
        initial_proposals: list[dict[str, Any]] | None = None,
    ) -> CouncilDeliberation:
        delib = CouncilDeliberation(
            council_id=council_id,
            company_id=company_id,
            title=title,
            problem_statement=problem_statement,
            context_data=context_data or {},
            proposals=initial_proposals or [],
            independent_reviews=[],
            objections=[],
            discussion_threads=[],
            disagreements_recorded=[],
        )
        self.db.add(delib)
        await self.db.flush()
        await self.db.refresh(delib)
        return delib

    async def get_deliberation(
        self, deliberation_id: uuid.UUID, company_id: uuid.UUID
    ) -> CouncilDeliberation | None:
        stmt = (
            select(CouncilDeliberation)
            .where(
                CouncilDeliberation.id == deliberation_id,
                CouncilDeliberation.company_id == company_id,
            )
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_deliberations(
        self,
        company_id: uuid.UUID,
        council_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[CouncilDeliberation]:
        stmt = select(CouncilDeliberation).where(CouncilDeliberation.company_id == company_id)
        if council_id:
            stmt = stmt.where(CouncilDeliberation.council_id == council_id)
        stmt = stmt.order_by(CouncilDeliberation.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
