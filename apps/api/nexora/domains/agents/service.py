"""
Agent Service — Full multi-agent employee business logic:
- 7-stage lifecycle state machine (CREATED -> CONFIGURED -> AVAILABLE -> WORKING -> BLOCKED -> PAUSED -> RETIRED)
- Organizational reporting hierarchy (manager assignment, direct reports)
- Agent collaboration (delegation, review, escalation, messages)
- Long-term memory store (episodic, semantic, procedural)
- Traceable audit trails
- Rich employee profile view
"""

from __future__ import annotations

import builtins
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    AgentMessageType,
    AgentStatus,
    AuditAction,
    ExecutionStatus,
    TaskStatus,
)
from nexora.domains.agents.execution import AgentExecutionEngine
from nexora.domains.agents.models import Agent, AgentCommunication, AgentExecutionAudit, AgentMemory
from nexora.domains.agents.repository import (
    AgentAuditRepository,
    AgentCommunicationRepository,
    AgentMemoryRepository,
    AgentRepository,
)
from nexora.domains.agents.schemas import (
    AgentProfileResponse,
    TaskExecutionResult,
)
from nexora.domains.projects.repository import TaskRepository
from nexora.exceptions import BusinessRuleError, NotFoundError


class AgentService:
    # Hard cap on active/non-retired AI & external proxy agents per company (Seat 0 CEO is human)
    MAX_COMPANY_AGENTS = 33

    # Valid lifecycle transitions
    VALID_TRANSITIONS = {
        AgentStatus.CREATED: {AgentStatus.CONFIGURED, AgentStatus.RETIRED},
        AgentStatus.CONFIGURED: {AgentStatus.AVAILABLE, AgentStatus.PAUSED, AgentStatus.RETIRED},
        AgentStatus.AVAILABLE: {
            AgentStatus.WORKING,
            AgentStatus.PAUSED,
            AgentStatus.BLOCKED,
            AgentStatus.RETIRED,
        },
        AgentStatus.WORKING: {AgentStatus.AVAILABLE, AgentStatus.BLOCKED, AgentStatus.PAUSED},
        AgentStatus.BLOCKED: {AgentStatus.AVAILABLE, AgentStatus.PAUSED, AgentStatus.RETIRED},
        AgentStatus.PAUSED: {AgentStatus.AVAILABLE, AgentStatus.CONFIGURED, AgentStatus.RETIRED},
        AgentStatus.RETIRED: set(),  # Terminal state
    }

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AgentRepository(db)
        self.memory_repo = AgentMemoryRepository(db)
        self.comm_repo = AgentCommunicationRepository(db)
        self.audit_repo = AgentAuditRepository(db)
        self.task_repo = TaskRepository(db)
        self.execution_engine = AgentExecutionEngine(db)

    async def create(self, company_id: uuid.UUID, **kwargs) -> Agent:
        """Create a new agent employee starting in CREATED lifecycle state."""
        existing = await self.repo.list_by_company(company_id)
        active_count = sum(1 for a in existing if a.status != AgentStatus.RETIRED)
        if active_count >= self.MAX_COMPANY_AGENTS:
            raise BusinessRuleError(
                f"Company agent cap reached ({active_count}/{self.MAX_COMPANY_AGENTS}). "
                "Retire an existing agent before hiring or registering another."
            )

        # Initial status is CONFIGURED if capabilities/tools/instructions provided, else CREATED
        if "status" not in kwargs:
            if (
                kwargs.get("capabilities")
                or kwargs.get("tools")
                or kwargs.get("system_instructions")
            ):
                kwargs["status"] = AgentStatus.CONFIGURED
            else:
                kwargs["status"] = AgentStatus.CREATED
        agent = await self.repo.create(company_id=company_id, **kwargs)

        await self.audit_repo.record_audit(
            agent_id=agent.id,
            company_id=company_id,
            execution_id=uuid.uuid4(),
            action=AuditAction.AGENT_CREATED,
            status=ExecutionStatus.SUCCESS,
            details={"name": agent.name, "role_id": str(agent.role_id) if agent.role_id else None},
        )
        return agent

    async def get(self, agent_id: uuid.UUID, company_id: uuid.UUID) -> Agent:
        agent = await self.repo.get_by_id(agent_id)
        if not agent or agent.company_id != company_id:
            raise NotFoundError(f"Agent {agent_id} not found.")
        return agent

    async def list(self, company_id: uuid.UUID) -> builtins.list[Agent]:
        return await self.repo.list_by_company(company_id)

    async def update(self, agent_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Agent:
        agent = await self.get(agent_id, company_id)

        # Handle manager assignment / hierarchy verification
        new_manager_id = kwargs.get("manager_agent_id")
        if new_manager_id:
            if new_manager_id == agent.id:
                raise BusinessRuleError("An agent cannot be their own manager.")
            mgr = await self.repo.get_by_id(new_manager_id)
            if not mgr or mgr.company_id != company_id:
                raise NotFoundError(f"Manager agent {new_manager_id} not found in this company.")

        # If configuring a CREATED agent, auto transition to CONFIGURED
        if agent.status == AgentStatus.CREATED and (
            kwargs.get("system_instructions")
            or kwargs.get("capabilities")
            or kwargs.get("intelligence_config")
        ):
            if "status" not in kwargs:
                kwargs["status"] = AgentStatus.CONFIGURED

        return await self.repo.update(agent, **kwargs)

    async def transition_status(
        self,
        agent_id: uuid.UUID,
        company_id: uuid.UUID,
        new_status: AgentStatus,
        reason: str | None = None,
    ) -> Agent:
        """Enforces the 7-stage agent lifecycle state machine."""
        agent = await self.get(agent_id, company_id)
        current = agent.status

        # Map synonyms to canonical values if needed
        allowed = self.VALID_TRANSITIONS.get(current, set())
        if new_status not in allowed and new_status != current:
            raise BusinessRuleError(
                f"Invalid lifecycle transition from {current.value} to {new_status.value}. "
                f"Allowed target states: {[s.value for s in allowed]}"
            )

        updated = await self.repo.update(agent, status=new_status)
        await self.audit_repo.record_audit(
            agent_id=agent.id,
            company_id=company_id,
            execution_id=uuid.uuid4(),
            action=AuditAction.STATUS_TRANSITION,
            status=ExecutionStatus.SUCCESS,
            details={
                "previous_status": current.value,
                "new_status": new_status.value,
                "reason": reason,
            },
        )
        return updated

    async def delete(self, agent_id: uuid.UUID, company_id: uuid.UUID) -> None:
        agent = await self.get(agent_id, company_id)
        await self.repo.soft_delete(agent)

    # ── Hierarchy & Multi-Agent Collaboration ──────────────────────────────────

    async def delegate_task(
        self,
        company_id: uuid.UUID,
        from_agent_id: uuid.UUID,
        to_agent_id: uuid.UUID,
        task_id: uuid.UUID,
        instructions: str,
    ) -> AgentCommunication:
        """Agent delegates a task to another agent (e.g. manager to subordinate or peer to peer)."""
        from_agent = await self.get(from_agent_id, company_id)
        to_agent = await self.get(to_agent_id, company_id)
        task = await self.task_repo.get_by_id(task_id)
        if not task or task.company_id != company_id:
            raise NotFoundError(f"Task {task_id} not found.")

        # Reassign task
        await self.task_repo.update(task, assigned_agent_id=to_agent.id)

        # Create structured communication
        msg = await self.comm_repo.send_message(
            company_id=company_id,
            from_agent_id=from_agent.id,
            to_agent_id=to_agent.id,
            task_id=task.id,
            message_type=AgentMessageType.DELEGATION,
            subject=f"Task Delegation: {task.title}",
            body=instructions,
            payload={"task_id": str(task.id), "delegated_by": from_agent.name},
        )

        await self.audit_repo.record_audit(
            agent_id=from_agent.id,
            company_id=company_id,
            execution_id=uuid.uuid4(),
            action=AuditAction.DELEGATION,
            task_id=task.id,
            status=ExecutionStatus.SUCCESS,
            details={"to_agent_id": str(to_agent.id), "task_title": task.title},
        )
        return msg

    async def escalate_problem(
        self,
        company_id: uuid.UUID,
        from_agent_id: uuid.UUID,
        task_id: uuid.UUID | None,
        problem: str,
        urgency: str = "HIGH",
    ) -> AgentCommunication:
        """Agent escalates an unresolvable issue or blocker to its designated manager."""
        agent = await self.get(from_agent_id, company_id)
        target_manager_id = agent.manager_agent_id

        # Update agent status to BLOCKED
        await self.repo.update(agent, status=AgentStatus.BLOCKED)

        msg = await self.comm_repo.send_message(
            company_id=company_id,
            from_agent_id=agent.id,
            to_agent_id=target_manager_id,
            task_id=task_id,
            message_type=AgentMessageType.ESCALATION,
            subject=f"Escalation from {agent.name}: {problem[:50]}",
            body=problem,
            payload={"urgency": urgency, "task_id": str(task_id) if task_id else None},
        )

        await self.audit_repo.record_audit(
            agent_id=agent.id,
            company_id=company_id,
            execution_id=uuid.uuid4(),
            action=AuditAction.ESCALATION,
            task_id=task_id,
            status=ExecutionStatus.SUCCESS,
            details={"problem": problem, "manager_id": str(target_manager_id)},
        )
        return msg

    async def request_review(
        self,
        company_id: uuid.UUID,
        from_agent_id: uuid.UUID,
        reviewer_agent_id: uuid.UUID,
        task_id: uuid.UUID,
        deliverable: str,
    ) -> AgentCommunication:
        """Agent submits work for review by a peer or manager."""
        from_agent = await self.get(from_agent_id, company_id)
        reviewer = await self.get(reviewer_agent_id, company_id)

        return await self.comm_repo.send_message(
            company_id=company_id,
            from_agent_id=from_agent.id,
            to_agent_id=reviewer.id,
            task_id=task_id,
            message_type=AgentMessageType.REVIEW,
            subject="Review Requested for Task deliverable",
            body=deliverable,
            payload={"task_id": str(task_id), "status": "PENDING_REVIEW"},
        )

    async def send_message(
        self,
        company_id: uuid.UUID,
        from_agent_id: uuid.UUID,
        to_agent_id: uuid.UUID | None,
        subject: str,
        body: str,
        message_type: AgentMessageType = AgentMessageType.REQUEST,
        task_id: uuid.UUID | None = None,
        payload: dict | None = None,
    ) -> AgentCommunication:
        await self.get(from_agent_id, company_id)
        if to_agent_id:
            await self.get(to_agent_id, company_id)

        return await self.comm_repo.send_message(
            company_id=company_id,
            from_agent_id=from_agent_id,
            to_agent_id=to_agent_id,
            task_id=task_id,
            message_type=message_type,
            subject=subject,
            body=body,
            payload=payload,
        )

    # ── Memory Management ──────────────────────────────────────────────────────

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
        agent = await self.get(agent_id, company_id)
        mem = await self.memory_repo.add_memory(
            agent_id=agent.id,
            company_id=company_id,
            memory_type=memory_type,
            key=key,
            content=content,
            metadata=metadata,
            importance=importance,
        )
        return mem

    async def list_memories(
        self, agent_id: uuid.UUID, company_id: uuid.UUID, memory_type: str | None = None
    ) -> builtins.list[AgentMemory]:
        await self.get(agent_id, company_id)
        return await self.memory_repo.list_memories(agent_id, memory_type)

    # ── Task Execution & Audit Trail ───────────────────────────────────────────

    async def execute_task(
        self,
        agent_id: uuid.UUID,
        company_id: uuid.UUID,
        task_id: uuid.UUID,
        input_data: dict | None = None,
        override_model: str | None = None,
    ) -> TaskExecutionResult:
        return await self.execution_engine.execute_task(
            agent_id=agent_id,
            company_id=company_id,
            task_id=task_id,
            input_data=input_data,
            override_model=override_model,
        )

    async def list_audits(
        self, agent_id: uuid.UUID, company_id: uuid.UUID
    ) -> builtins.list[AgentExecutionAudit]:
        await self.get(agent_id, company_id)
        return await self.audit_repo.list_for_agent(agent_id)

    # ── Rich Employee Profile Inspection ───────────────────────────────────────

    async def get_agent_profile(
        self, agent_id: uuid.UUID, company_id: uuid.UUID
    ) -> AgentProfileResponse:
        """
        Assembles comprehensive employee profile:
        identity, role, department, manager, tools, permissions, resource usage,
        current active task, memories, recent communications, and audit history.
        """
        agent = await self.get(agent_id, company_id)

        # Lookup role and department metadata
        role_title = None
        if agent.role_id:
            from nexora.domains.organizations.repository import OrgRoleRepository

            r = await OrgRoleRepository(self.db).get_by_id(agent.role_id)
            if r:
                role_title = r.title

        dept_name = None
        if agent.department_id:
            from nexora.domains.organizations.repository import DepartmentRepository

            d = await DepartmentRepository(self.db).get_by_id(agent.department_id)
            if d:
                dept_name = d.name

        manager_name = None
        if agent.manager_agent_id:
            mgr = await self.repo.get_by_id(agent.manager_agent_id)
            if mgr:
                manager_name = mgr.name

        # Find current active task
        active_tasks = await self.task_repo.list_by_agent(agent.id)
        current_task_dict = None
        for t in active_tasks:
            if t.status in (TaskStatus.IN_PROGRESS, TaskStatus.PENDING, TaskStatus.BLOCKED):
                current_task_dict = {
                    "id": str(t.id),
                    "title": t.title,
                    "status": t.status.value,
                    "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                    "project_id": str(t.project_id),
                }
                break

        # Fetch recent communications, audits, and memories
        comms = await self.comm_repo.list_for_agent(agent.id, limit=10)
        audits = await self.audit_repo.list_for_agent(agent.id, limit=10)
        mems = await self.memory_repo.list_memories(agent.id, limit=10)

        return AgentProfileResponse(
            id=agent.id,
            company_id=agent.company_id,
            name=agent.name,
            status=agent.status,
            autonomy=agent.autonomy,
            role_title=role_title,
            department_name=dept_name,
            manager_name=manager_name,
            manager_id=agent.manager_agent_id,
            identity=agent.identity or {},
            system_instructions=agent.system_instructions,
            responsibilities=agent.responsibilities or [],
            goals=agent.goals or [],
            capabilities=agent.capabilities or [],
            permissions=agent.permissions or {},
            tools=agent.tools or [],
            intelligence_config=agent.intelligence_config or {},
            resource_limits=agent.resource_limits or {},
            resource_usage=agent.resource_usage or {},
            performance_metadata=agent.performance_metadata or {},
            current_task=current_task_dict,
            recent_communications=[
                {
                    "id": str(c.id),
                    "type": c.message_type.value,
                    "subject": c.subject,
                    "from_agent_id": str(c.from_agent_id),
                    "to_agent_id": str(c.to_agent_id) if c.to_agent_id else None,
                    "created_at": c.created_at.isoformat(),
                }
                for c in comms
            ],
            recent_decisions=[],
            recent_audits=[
                {
                    "id": str(a.id),
                    "action": a.action.value,
                    "step": a.step.value if a.step else None,
                    "status": a.status.value,
                    "created_at": a.created_at.isoformat(),
                    "details": a.details,
                }
                for a in audits
            ],
            memories=[
                {
                    "id": str(m.id),
                    "type": m.memory_type,
                    "key": m.key,
                    "content": m.content,
                    "importance": m.importance,
                }
                for m in mems
            ],
        )
