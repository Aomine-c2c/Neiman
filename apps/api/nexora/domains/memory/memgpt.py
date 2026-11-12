"""
MemGPT Hierarchical Virtual Memory Subsystem for NEIMAN OS.

Architecture Implementation:
1. Virtual Context Management: Treats LLM token limit as RAM, backing memory into tiered storage.
2. Tier 1: Core Memory (In-Prompt Active Working RAM):
   - Persona Block: Agent persona, directives, tone, system boundaries.
   - Human / Org Block: User facts, company goals, active department policies.
   - Dynamic self-edit tools: core_memory_append, core_memory_replace.
3. Tier 2: Recall Memory (In-Context FIFO Queue + Conversation Archive):
   - Chronological message FIFO queue with automatic eviction & recursive summarization.
   - Searchable event log of previous interactions and execution traces.
4. Tier 3: Archival Memory (External Storage):
   - Vector store and semantic retrieval for unbounded knowledge items, documents, and historical ADRs.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import (
    JSON,
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from nexora.core.base import NexoraBase

# =====================================================================
# SQLALCHEMY DATABASE MODELS FOR MEMGPT
# =====================================================================


class AgentCoreMemoryBlock(NexoraBase):
    """
    Core Memory (RAM) for an agent:
    Holds actively editable Persona and Human/Context working memory blocks.
    Injected directly into the model's system prompt on every execution call.
    """

    __tablename__ = "agent_core_memory_blocks"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    block_name: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, comment="persona | human | scratchpad | custom"
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    char_limit: Mapped[int] = mapped_column(Integer, default=2000, nullable=False)
    is_read_only: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AgentRecallLog(NexoraBase):
    """
    Recall Memory (Conversation & Event Log FIFO Queue):
    Persists past dialogue, tool executions, and inputs.
    When FIFO queue overflows token limit, older records are paged into Archival Memory.
    """

    __tablename__ = "agent_recall_logs"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    role: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="user | assistant | system | tool"
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    tool_calls: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    tool_call_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estimated_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_evicted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# =====================================================================
# PYDANTIC SCHEMAS
# =====================================================================


class CoreMemoryBlockSchema(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    block_name: str
    label: str
    content: str
    char_limit: int
    is_read_only: bool
    updated_at: datetime


class CoreMemoryUpdateSchema(BaseModel):
    block_name: str = Field(..., description="persona | human | scratchpad")
    content: str
    mode: str = Field("replace", description="replace | append")


class RecallMessageSchema(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    role: str
    message: str
    estimated_tokens: int
    created_at: datetime


class MemGPTPromptContext(BaseModel):
    agent_id: uuid.UUID
    persona_block: str
    human_block: str
    scratchpad_block: str | None = None
    fifo_messages: list[dict[str, Any]]
    total_active_tokens: int
    archived_memories_count: int


# =====================================================================
# MEMGPT ENGINE SERVICE
# =====================================================================


class MemGPTEngine:
    """
    Operating System Virtual Context Controller for NEIMAN agents.
    Manages Core Memory edits, FIFO queue paging, and archival offloading.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def initialize_agent_core_memory(
        self, agent_id: uuid.UUID, company_id: uuid.UUID, persona_text: str, human_text: str = ""
    ) -> list[AgentCoreMemoryBlock]:
        """Ensures default Core Memory (Persona & Human blocks) are present for an agent."""
        blocks = await self.get_core_memory_blocks(agent_id)
        if blocks:
            return blocks

        default_blocks = [
            AgentCoreMemoryBlock(
                agent_id=agent_id,
                company_id=company_id,
                block_name="persona",
                label="Agent Persona & Operating Directives",
                content=persona_text or "Autonomous NEIMAN Agent Specialist.",
                char_limit=2500,
            ),
            AgentCoreMemoryBlock(
                agent_id=agent_id,
                company_id=company_id,
                block_name="human",
                label="Human / User / Org Context",
                content=human_text or "Interacting with NEIMAN Leadership and Operator.",
                char_limit=2500,
            ),
            AgentCoreMemoryBlock(
                agent_id=agent_id,
                company_id=company_id,
                block_name="scratchpad",
                label="Working Scratchpad",
                content="Current focus: active mission execution.",
                char_limit=1500,
            ),
        ]
        self.db.add_all(default_blocks)
        await self.db.flush()
        return default_blocks

    async def get_core_memory_blocks(self, agent_id: uuid.UUID) -> list[AgentCoreMemoryBlock]:
        result = await self.db.execute(
            select(AgentCoreMemoryBlock).where(AgentCoreMemoryBlock.agent_id == agent_id)
        )
        return list(result.scalars().all())

    async def update_core_memory(
        self, agent_id: uuid.UUID, company_id: uuid.UUID, update: CoreMemoryUpdateSchema
    ) -> AgentCoreMemoryBlock:
        """Agent tool execution: core_memory_replace or core_memory_append."""
        result = await self.db.execute(
            select(AgentCoreMemoryBlock).where(
                AgentCoreMemoryBlock.agent_id == agent_id,
                AgentCoreMemoryBlock.block_name == update.block_name,
            )
        )
        block = result.scalar_one_or_none()
        if not block:
            block = AgentCoreMemoryBlock(
                agent_id=agent_id,
                company_id=company_id,
                block_name=update.block_name,
                label=update.block_name.capitalize(),
                content=update.content,
            )
            self.db.add(block)
        else:
            if update.mode == "append":
                new_text = f"{block.content}\n{update.content}".strip()
                block.content = new_text[: block.char_limit]
            else:
                block.content = update.content[: block.char_limit]

        await self.db.flush()
        await self.db.refresh(block)
        return block

    async def append_recall_message(
        self,
        agent_id: uuid.UUID,
        company_id: uuid.UUID,
        role: str,
        message: str,
        tool_calls: list[dict] | None = None,
    ) -> AgentRecallLog:
        """Appends to the active FIFO recall queue."""
        estimated_tokens = max(1, len(message.split()) + 4)
        log = AgentRecallLog(
            agent_id=agent_id,
            company_id=company_id,
            role=role,
            message=message,
            tool_calls=tool_calls or [],
            estimated_tokens=estimated_tokens,
            is_evicted=False,
        )
        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)

        # Enforce FIFO queue context ceiling (page out to Archival when > 10 messages)
        await self._enforce_fifo_eviction(agent_id, company_id, max_active_messages=10)
        return log

    async def _enforce_fifo_eviction(
        self, agent_id: uuid.UUID, company_id: uuid.UUID, max_active_messages: int = 10
    ) -> None:
        """Pages older messages out of active FIFO RAM into long-term organizational memory items."""
        result = await self.db.execute(
            select(AgentRecallLog)
            .where(AgentRecallLog.agent_id == agent_id, AgentRecallLog.is_evicted.is_(False))
            .order_by(AgentRecallLog.created_at.desc())
        )
        active_logs = list(result.scalars().all())

        if len(active_logs) > max_active_messages:
            evict_candidates = active_logs[max_active_messages:]
            for log in evict_candidates:
                log.is_evicted = True

            # Synthesize evicted items into Archival Memory
            from nexora.domains.memory.models import MemoryItem

            evicted_text = "\n".join(
                [f"[{cand.role}]: {cand.message}" for cand in reversed(evict_candidates)]
            )
            summary = (
                f"Archived {len(evict_candidates)} messages from agent conversation FIFO stream."
            )

            archived_item = MemoryItem(
                company_id=company_id,
                domain="AGENT",
                scope="INTERNAL",
                title=f"Evicted Recall Memory - Agent {str(agent_id)[:8]}",
                content=evicted_text,
                summary=summary,
                agent_id=agent_id,
                provenance_type="SYSTEM_SYNTHESIS",
                source="MemGPT Virtual Context Eviction",
                confidence=0.98,
                tags=["memgpt", "archival", "recall_evicted"],
            )
            self.db.add(archived_item)
            await self.db.flush()

    async def assemble_memgpt_prompt_context(
        self, agent_id: uuid.UUID, company_id: uuid.UUID
    ) -> MemGPTPromptContext:
        """Assembles the full MemGPT prompt token layout: Core Memory (Persona + Human) + FIFO Recall."""
        blocks = await self.get_core_memory_blocks(agent_id)
        persona_content = ""
        human_content = ""
        scratchpad_content = None

        for b in blocks:
            if b.block_name == "persona":
                persona_content = b.content
            elif b.block_name == "human":
                human_content = b.content
            elif b.block_name == "scratchpad":
                scratchpad_content = b.content

        # Get active FIFO messages
        res = await self.db.execute(
            select(AgentRecallLog)
            .where(AgentRecallLog.agent_id == agent_id, AgentRecallLog.is_evicted.is_(False))
            .order_by(AgentRecallLog.created_at.asc())
        )
        active_msgs = list(res.scalars().all())

        fifo_formatted = [
            {"role": m.role, "content": m.message, "tokens": m.estimated_tokens}
            for m in active_msgs
        ]

        total_tokens = (
            sum(m.estimated_tokens for m in active_msgs)
            + len(persona_content.split())
            + len(human_content.split())
        )

        # Count archived items
        from nexora.domains.memory.models import MemoryItem

        archived_res = await self.db.execute(
            select(MemoryItem).where(
                MemoryItem.agent_id == agent_id,
                MemoryItem.tags.contains(["memgpt"]),
            )
        )
        archived_count = len(archived_res.scalars().all())

        return MemGPTPromptContext(
            agent_id=agent_id,
            persona_block=persona_content,
            human_block=human_content,
            scratchpad_block=scratchpad_content,
            fifo_messages=fifo_formatted,
            total_active_tokens=total_tokens,
            archived_memories_count=archived_count,
        )
