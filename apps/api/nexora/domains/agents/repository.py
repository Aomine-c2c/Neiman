"""Agent repository with multi-agent capabilities, memory, communication, and audits."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import AgentStatus
from nexora.domains.agents.models import Agent, AgentCommunication, AgentExecutionAudit, AgentMemory


class AgentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, agent_id: uuid.UUID) -> Agent | None:
        result = await self.db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[Agent]:
        result = await self.db.execute(
            select(Agent)
            .where(Agent.company_id == company_id, Agent.is_deleted.is_(False))
            .order_by(Agent.name)
        )
        return list(result.scalars().all())

    async def list_direct_reports(self, manager_agent_id: uuid.UUID) -> list[Agent]:
        result = await self.db.execute(
            select(Agent)
            .where(Agent.manager_agent_id == manager_agent_id, Agent.is_deleted.is_(False))
            .order_by(Agent.name)
        )
        return list(result.scalars().all())

    async def create(self, company_id: uuid.UUID, **kwargs) -> Agent:
        for k in ("identity", "intelligence_config", "resource_limits"):
            if k in kwargs and hasattr(kwargs[k], "model_dump"):
                kwargs[k] = kwargs[k].model_dump()
        agent = Agent(company_id=company_id, **kwargs)
        self.db.add(agent)
        await self.db.flush()
        await self.db.refresh(agent)
        return agent

    async def update(self, agent: Agent, **kwargs) -> Agent:
        for key, value in kwargs.items():
            if value is not None and hasattr(agent, key):
                if hasattr(value, "model_dump"):
                    value = value.model_dump()
                setattr(agent, key, value)
        await self.db.flush()
        await self.db.refresh(agent)
        return agent

    async def soft_delete(self, agent: Agent) -> None:
        agent.is_deleted = True
        agent.deleted_at = datetime.now(UTC)
        agent.status = AgentStatus.RETIRED
        await self.db.flush()


class AgentMemoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add_memory(
        self,
        agent_id: uuid.UUID,
        company_id: uuid.UUID,
        memory_type: str,
        key: str,
        content: str,
        metadata: dict | None = None,
        importance: float = 1.0,
    ) -> AgentMemory:
        mem = AgentMemory(
            agent_id=agent_id,
            company_id=company_id,
            memory_type=memory_type,
            key=key,
            content=content,
            metadata_=metadata or {},
            importance=importance,
            last_accessed_at=datetime.now(UTC),
        )
        self.db.add(mem)
        await self.db.flush()
        await self.db.refresh(mem)
        return mem

    async def list_memories(
        self, agent_id: uuid.UUID, memory_type: str | None = None, limit: int = 50
    ) -> list[AgentMemory]:
        q = select(AgentMemory).where(
            AgentMemory.agent_id == agent_id, AgentMemory.is_deleted.is_(False)
        )
        if memory_type:
            q = q.where(AgentMemory.memory_type == memory_type)
        q = q.order_by(desc(AgentMemory.importance), desc(AgentMemory.created_at)).limit(limit)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def search_memory(self, agent_id: uuid.UUID, keyword: str) -> list[AgentMemory]:
        q = (
            select(AgentMemory)
            .where(
                AgentMemory.agent_id == agent_id,
                AgentMemory.is_deleted.is_(False),
                (AgentMemory.key.ilike(f"%{keyword}%") | AgentMemory.content.ilike(f"%{keyword}%")),
            )
            .order_by(desc(AgentMemory.importance))
            .limit(20)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())


class AgentCommunicationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def send_message(
        self,
        company_id: uuid.UUID,
        from_agent_id: uuid.UUID,
        to_agent_id: uuid.UUID | None,
        message_type,
        subject: str,
        body: str,
        task_id: uuid.UUID | None = None,
        payload: dict | None = None,
    ) -> AgentCommunication:
        msg = AgentCommunication(
            company_id=company_id,
            from_agent_id=from_agent_id,
            to_agent_id=to_agent_id,
            task_id=task_id,
            message_type=message_type,
            subject=subject,
            body=body,
            payload=payload or {},
        )
        self.db.add(msg)
        await self.db.flush()
        await self.db.refresh(msg)
        return msg

    async def list_inbox(self, agent_id: uuid.UUID, limit: int = 50) -> list[AgentCommunication]:
        q = (
            select(AgentCommunication)
            .where(
                AgentCommunication.to_agent_id == agent_id,
                AgentCommunication.is_deleted.is_(False),
            )
            .order_by(desc(AgentCommunication.created_at))
            .limit(limit)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_outbox(self, agent_id: uuid.UUID, limit: int = 50) -> list[AgentCommunication]:
        q = (
            select(AgentCommunication)
            .where(
                AgentCommunication.from_agent_id == agent_id,
                AgentCommunication.is_deleted.is_(False),
            )
            .order_by(desc(AgentCommunication.created_at))
            .limit(limit)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_for_agent(
        self, agent_id: uuid.UUID, limit: int = 20
    ) -> list[AgentCommunication]:
        q = (
            select(AgentCommunication)
            .where(
                (AgentCommunication.from_agent_id == agent_id)
                | (AgentCommunication.to_agent_id == agent_id),
                AgentCommunication.is_deleted.is_(False),
            )
            .order_by(desc(AgentCommunication.created_at))
            .limit(limit)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def mark_read(self, message_id: uuid.UUID) -> AgentCommunication | None:
        result = await self.db.execute(
            select(AgentCommunication).where(AgentCommunication.id == message_id)
        )
        msg = result.scalar_one_or_none()
        if msg:
            msg.is_read = True
            await self.db.flush()
            await self.db.refresh(msg)
        return msg


class AgentAuditRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def record_audit(
        self,
        agent_id: uuid.UUID,
        company_id: uuid.UUID,
        execution_id: uuid.UUID,
        action,
        step=None,
        status=None,
        task_id: uuid.UUID | None = None,
        details: dict | None = None,
        tokens_consumed: int = 0,
        cost_usd: float = 0.0,
        duration_ms: float = 0.0,
    ) -> AgentExecutionAudit:
        audit = AgentExecutionAudit(
            agent_id=agent_id,
            company_id=company_id,
            task_id=task_id,
            execution_id=execution_id,
            action=action,
            step=step,
            status=status,
            details=details or {},
            tokens_consumed=tokens_consumed,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
        )
        self.db.add(audit)
        await self.db.flush()
        await self.db.refresh(audit)
        return audit

    async def list_for_agent(
        self, agent_id: uuid.UUID, limit: int = 50
    ) -> list[AgentExecutionAudit]:
        q = (
            select(AgentExecutionAudit)
            .where(AgentExecutionAudit.agent_id == agent_id)
            .order_by(desc(AgentExecutionAudit.created_at))
            .limit(limit)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_by_execution(self, execution_id: uuid.UUID) -> list[AgentExecutionAudit]:
        q = (
            select(AgentExecutionAudit)
            .where(AgentExecutionAudit.execution_id == execution_id)
            .order_by(AgentExecutionAudit.created_at)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all())
