"""Agent API router with full multi-agent employee capabilities."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_manager, require_member, require_viewer
from nexora.database import get_db
from nexora.domains.agents.docs_agent import (
    DocGenerationReport,
    DocumentationAgentEngine,
)
from nexora.domains.agents.schemas import (
    AgentCreate,
    AgentProfileResponse,
    AgentResponse,
    AgentStatusTransition,
    AgentUpdate,
    AuditLogResponse,
    MemoryCreate,
    MemoryResponse,
    MessageCreate,
    MessageResponse,
    TaskExecutionRequest,
    TaskExecutionResult,
)
from nexora.domains.agents.service import AgentService
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user

router = APIRouter(prefix="/companies/{company_id}/agents", tags=["Agents"])

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Agent Management ──────────────────────────────────────────────────────────


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    company_id: uuid.UUID,
    body: AgentCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Create a new organizational agent employee (initialized in CREATED state)."""
    svc = AgentService(db)
    return await svc.create(company_id=company_id, **body.model_dump())


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List all agents in the company."""
    return await AgentService(db).list(company_id)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Get basic agent details."""
    return await AgentService(db).get(agent_id, company_id)


@router.get("/{agent_id}/profile", response_model=AgentProfileResponse)
async def get_agent_profile(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Get rich employee profile: role, manager, tools, usage, memories, audit trail."""
    return await AgentService(db).get_agent_profile(agent_id, company_id)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: AgentUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Update agent configuration, role, manager hierarchy, or limits."""
    return await AgentService(db).update(agent_id, company_id, **body.model_dump(exclude_none=True))


@router.post("/{agent_id}/transition", response_model=AgentResponse)
async def transition_agent_status(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: AgentStatusTransition,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Transition agent lifecycle: CREATED -> CONFIGURED -> AVAILABLE -> WORKING -> BLOCKED -> PAUSED -> RETIRED."""
    return await AgentService(db).transition_status(agent_id, company_id, body.status, body.reason)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    """Retire and soft-delete an agent."""
    await AgentService(db).delete(agent_id, company_id)


# ── Multi-Agent Execution & Audits ──────────────────────────────────────────


@router.post("/{agent_id}/execute", response_model=TaskExecutionResult)
async def execute_task(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: TaskExecutionRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Execute a task via the 10-step lifecycle engine with capability and budget checks."""
    return await AgentService(db).execute_task(
        agent_id=agent_id,
        company_id=company_id,
        task_id=body.task_id,
        input_data=body.input_data,
        override_model=body.override_model,
    )


@router.get("/{agent_id}/audits", response_model=list[AuditLogResponse])
async def list_agent_audits(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List execution audit records for an agent."""
    return await AgentService(db).list_audits(agent_id, company_id)


# ── Long-term Memory ────────────────────────────────────────────────────────


@router.post(
    "/{agent_id}/memories", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED
)
async def add_agent_memory(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: MemoryCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Persist an episodic, semantic, or procedural memory entry for an agent."""
    return await AgentService(db).add_memory(
        agent_id=agent_id,
        company_id=company_id,
        memory_type=body.memory_type,
        key=body.key,
        content=body.content,
        metadata=body.metadata,
        importance=body.importance,
    )


@router.get("/{agent_id}/memories", response_model=list[MemoryResponse])
async def list_agent_memories(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    memory_type: str | None = Query(None),
    _: None = Depends(require_viewer()),
):
    """Retrieve memories stored by this agent."""
    return await AgentService(db).list_memories(agent_id, company_id, memory_type)


# ── Agent Communication & Hierarchy ─────────────────────────────────────────


@router.post(
    "/{agent_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def send_agent_message(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: MessageCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """Send structured message (request, delegation, review, notification)."""
    return await AgentService(db).send_message(
        company_id=company_id,
        from_agent_id=agent_id,
        to_agent_id=body.to_agent_id,
        subject=body.subject,
        body=body.body,
        message_type=body.message_type,
        task_id=body.task_id,
        payload=body.payload,
    )


@router.post("/{agent_id}/delegate", response_model=MessageResponse)
async def delegate_task_to_agent(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    to_agent_id: uuid.UUID = Query(...),
    task_id: uuid.UUID = Query(...),
    instructions: str = Query("Please execute this delegated task."),
    _: None = Depends(require_member()),
):
    """Delegate a task from one agent to another agent."""
    return await AgentService(db).delegate_task(
        company_id=company_id,
        from_agent_id=agent_id,
        to_agent_id=to_agent_id,
        task_id=task_id,
        instructions=instructions,
    )


@router.post("/{agent_id}/escalate", response_model=MessageResponse)
async def escalate_problem(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    problem: str = Query(...),
    task_id: uuid.UUID | None = Query(None),
    _: None = Depends(require_member()),
):
    """Escalate a blocker or problem to the agent's manager."""
    return await AgentService(db).escalate_problem(
        company_id=company_id,
        from_agent_id=agent_id,
        task_id=task_id,
        problem=problem,
    )


# ── Documentation Specialist Agent ──────────────────────────────────────────


@router.post("/docs/generate", response_model=DocGenerationReport)
async def trigger_documentation_generation(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    commit_to_disk: bool = Query(
        True, description="Write generated markdown directly to .agents/ and docs/"
    ),
    _: None = Depends(require_member()),
):
    """
    Triggers the Documentation Specialist Agent (DocuForge-Arch) to inspect the AST code graph,
    synthesize zero-filler technical references specifically for coding agents, and auto-update
    .agents/AGENTS_REFERENCE.md and organizational memory.
    """
    engine = DocumentationAgentEngine(db=db)
    return await engine.generate_and_update_agent_documentation(
        company_id=company_id,
        commit_to_disk=commit_to_disk,
    )
