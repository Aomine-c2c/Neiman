"""
Autonomous CTO Agent Service.
Supervises organizational engineering workforce:
- Directive intake and task decomposition into dependency DAGs.
- Autonomous delegation across specialized employee roles.
- Proactive engineering proposal formulation (architecture, security, performance).
- Proposal decision execution and task dispatch.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import Priority, ProjectStatus, TaskStatus
from nexora.domains.activity.broadcaster import activity_broadcaster
from nexora.domains.activity.schemas import ActivityEvent, ActivityEventType, ActivitySeverity
from nexora.domains.agents.models import Agent, CTOProposal
from nexora.domains.agents.repository import AgentRepository
from nexora.domains.agents.schemas import (
    CTODirectiveRequest,
    CTODirectiveResponse,
    CTOProposalDecisionRequest,
)
from nexora.domains.projects.models import Project
from nexora.domains.projects.repository import ProjectRepository, TaskRepository
from nexora.exceptions import BusinessRuleError, NotFoundError

logger = logging.getLogger(__name__)


class CTOService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.agent_repo = AgentRepository(db)
        self.project_repo = ProjectRepository(db)
        self.task_repo = TaskRepository(db)

    async def get_or_resolve_cto(self, company_id: uuid.UUID) -> Agent:
        """Find or designate the CTO / Chief Architect agent for the company."""
        agents = await self.agent_repo.list_by_company(company_id)
        if not agents:
            raise NotFoundError(f"No agents configured for company {company_id}.")

        # Check for agent with CTO or Architect title/role
        for a in agents:
            name_lower = a.name.lower()
            if (
                "cto" in name_lower
                or "chief architect" in name_lower
                or "lead architect" in name_lower
            ):
                return a

        # Fallback to the first available agent
        return agents[0]

    async def get_primary_project(self, company_id: uuid.UUID) -> Project:
        """Get or create primary project for delegating CTO directives."""
        projects = await self.project_repo.list_by_company(company_id)
        if projects:
            return projects[0]

        from nexora.domains.organizations.models import Company

        comp_stmt = select(Company).where(Company.id == company_id)
        comp_res = await self.db.execute(comp_stmt)
        company = comp_res.scalar_one_or_none()
        owner_id = company.owner_id if company and company.owner_id else uuid.uuid4()

        # Create default primary project
        return await self.project_repo.create(
            company_id=company_id,
            owner_id=owner_id,
            name="Autonomous Core Engineering",
            objective="Continuous organizational development and autonomous lifecycle execution",
            priority=Priority.HIGH,
            status=ProjectStatus.ACTIVE,
        )

    async def intake_directive(
        self,
        company_id: uuid.UUID,
        req: CTODirectiveRequest,
    ) -> CTODirectiveResponse:
        """
        Accept an operator directive or conversation, analyze requirements via the AI model,
        and either converse directly or decompose into domain tasks for employee agents.
        """
        cto = await self.get_or_resolve_cto(company_id)
        if req.project_id:
            custom_proj = await self.project_repo.get_by_id(req.project_id)
            project = (
                custom_proj
                if custom_proj and custom_proj.company_id == company_id
                else await self.get_primary_project(company_id)
            )
        else:
            project = await self.get_primary_project(company_id)
        agents = await self.agent_repo.list_by_company(company_id)

        # Map agents by role / specialization
        role_map: dict[str, Agent] = {}
        for a in agents:
            n = a.name.lower()
            if "backend" in n:
                role_map["backend"] = a
            elif "frontend" in n or "ui" in n:
                role_map["frontend"] = a
            elif "database" in n or "data" in n:
                role_map["database"] = a
            elif "qa" in n or "test" in n or "quality" in n:
                role_map["qa"] = a
            elif "security" in n or "sentinel" in n or "sec" in n:
                role_map["security"] = a
            elif "devops" in n or "release" in n or "sre" in n:
                role_map["devops"] = a
            elif "reviewer" in n or "review" in n:
                role_map["reviewer"] = a
            elif "writer" in n or "docs" in n:
                role_map["docs"] = a
            elif "architect" in n:
                role_map["architect"] = a

        intent, reply_text, decomposed_specs = await self._analyze_and_decompose_with_model(
            company_id=company_id,
            cto=cto,
            project=project,
            agents=agents,
            directive=req.directive,
        )

        if intent == "CONVERSATION" and reply_text:
            return CTODirectiveResponse(
                directive=req.directive,
                cto_agent_name=cto.name,
                analysis=reply_text,
                summary=reply_text,
                tasks_created_count=0,
                tasks=[],
                intent="CONVERSATION",
            )

        if not decomposed_specs:
            # No tasks were produced by the AI model. This happens when:
            #   - No AI provider is configured / all providers fail
            #   - The model output is unparseable
            # Create a default review task so the directive is not lost.
            fallback_task = await self.task_repo.create(
                project_id=project.id,
                company_id=company_id,
                assigned_agent_id=cto.id,
                title=f"Review directive: {req.directive[:80]}",
                description=f"CTO directive received but AI decomposition was unavailable. "
                           f"Manual review required.\n\nDirective: {req.directive}",
                priority=Priority.HIGH,
                status=TaskStatus.PENDING,
                expected_outcome="Review directive and determine next steps.",
            )
            fallback_analysis = reply_text or "AI decomposition unavailable; created default review task."
            return CTODirectiveResponse(
                directive=req.directive,
                cto_agent_name=cto.name,
                analysis=fallback_analysis,
                summary=fallback_analysis,
                tasks_created_count=1,
                tasks=[
                    {
                        "id": str(fallback_task.id),
                        "title": fallback_task.title,
                        "priority": fallback_task.priority.value,
                        "status": fallback_task.status.value,
                    }
                ],
                intent="DIRECTIVE_FALLBACK",
            )

        created_tasks: list[dict[str, Any]] = []
        created_task_ids: list[str] = []

        # Convert priority string
        p_enum = Priority.HIGH
        if req.priority.upper() in Priority.__members__:
            p_enum = Priority[req.priority.upper()]

        for spec in decomposed_specs:
            target_role = spec.get("target_role", "backend").lower()
            assigned_agent = role_map.get(target_role) or role_map.get("backend") or cto

            # Resolve dependency IDs from previous steps
            dep_ids = [
                created_task_ids[idx]
                for idx in spec.get("dep_indices", [])
                if isinstance(idx, int) and idx < len(created_task_ids)
            ]

            task_priority = p_enum
            if spec.get("priority") and str(spec["priority"]).upper() in Priority.__members__:
                task_priority = Priority[str(spec["priority"]).upper()]

            task = await self.task_repo.create(
                project_id=project.id,
                company_id=company_id,
                assigned_agent_id=assigned_agent.id if assigned_agent else None,
                title=spec["title"],
                description=f"{spec['description']}\nDirective Context: {req.directive}",
                priority=task_priority,
                status=TaskStatus.PENDING,
                dependencies=dep_ids,
                expected_outcome=spec.get("expected_outcome", "Satisfies acceptance criteria."),
            )
            created_task_ids.append(str(task.id))
            created_tasks.append(
                {
                    "id": str(task.id),
                    "title": task.title,
                    "role": target_role,
                    "assigned_agent": assigned_agent.name if assigned_agent else "Unassigned",
                    "dependencies": dep_ids,
                    "priority": task_priority.value,
                }
            )

        # Broadcast activity event
        await activity_broadcaster.broadcast(
            str(company_id),
            ActivityEvent(
                company_id=str(company_id),
                event_type=ActivityEventType.TASK_CREATED,
                severity=ActivitySeverity.INFO,
                title=f"CTO Directive Decomposed: {req.directive[:60]}...",
                summary=f"CTO {cto.name} analyzed directive and delegated {len(created_tasks)} subtasks across workforce.",
                agent_id=str(cto.id),
                agent_name=cto.name,
                payload={
                    "directive": req.directive,
                    "tasks_created": len(created_tasks),
                    "task_ids": created_task_ids,
                },
            ),
            session=self.db,
        )

        analysis_text = reply_text or f"Directive parsed into {len(created_tasks)} sequential engineering tasks mapped to specialized workforce roles."
        return CTODirectiveResponse(
            directive=req.directive,
            cto_agent_name=cto.name,
            analysis=analysis_text,
            summary=analysis_text,
            tasks_created_count=len(created_tasks),
            tasks=created_tasks,
            intent="DIRECTIVE",
        )

    async def _analyze_and_decompose_with_model(
        self,
        company_id: uuid.UUID,
        cto: Agent,
        project: Project,
        agents: list[Agent],
        directive: str,
    ) -> tuple[str, str, list[dict[str, Any]]]:
        """
        Use live configured AI model to analyze the executive's input,
        deciding whether it is conversational dialogue or an actionable engineering directive.
        """
        import json

        from nexora.core.security import PromptSanitizer
        from nexora.domains.intelligence.schemas import ModelRequest
        from nexora.domains.intelligence.service import IntelligenceService

        agent_roster_str = ", ".join(
            [
                f"{a.name} ({a.identity.get('role', 'specialist') if isinstance(a.identity, dict) else 'specialist'})"
                for a in agents
            ]
        )

        # Fetch pending proposals to contextualize ambiguous references ("it", "this", "assign tasks")
        proposal_stmt = (
            select(CTOProposal)
            .where(CTOProposal.company_id == company_id)
            .order_by(CTOProposal.created_at.desc())
            .limit(3)
        )
        proposal_res = await self.db.execute(proposal_stmt)
        active_proposals = proposal_res.scalars().all()
        proposal_summary = (
            "\n".join([f"- [{p.category}] {p.title}: {p.rationale}" for p in active_proposals])
            if active_proposals
            else "Autonomous Swarm Orchestration & Continuous Delivery Architecture"
        )

        system_prompt = (
            f"You are the Autonomous CTO of this engineering enterprise.\n"
            f"You oversee the active initiative: '{project.name}'.\n"
            f"Available workforce swarm agents: {agent_roster_str}.\n\n"
            f"Active Architectural Proposals & Initiatives:\n{proposal_summary}\n\n"
            "Analyze the executive operator's message:\n"
            "1. CONVERSATIONAL INTERACTIONS:\n"
            "If the operator is communicating purely conversationally (e.g. casual greetings like 'hi', 'hello', or asking generic questions without commanding action):\n"
            "- Set 'intent': 'CONVERSATION'.\n"
            "- In 'reply', respond directly, helpfully, and insightfully as the Autonomous CTO. Speak in first person ('I'). Keep it concise and executive-level.\n"
            "- Set 'tasks': [] (DO NOT create any tasks).\n\n"
            "2. ACTIONABLE ENGINEERING DIRECTIVES:\n"
            "If the operator commands to implement, build, execute, create, refactor, fix, test, design, or deploy software, OR says 'Implement it and assign tasks now', 'Proceed', 'Assign tasks', or 'Continue development':\n"
            "- Treat this as an explicit ACTIONABLE DIRECTIVE. If 'it' or 'this' is referenced, resolve it to the top Active Architectural Proposal or current initiative.\n"
            "- Set 'intent': 'DIRECTIVE'.\n"
            "- In 'reply', summarize your architectural analysis and decomposition plan.\n"
            "- In 'tasks', generate concrete, non-mock, specific technical tasks mapped to specialized workforce roles (backend, frontend, database, qa, reviewer, devops, security, architect, docs):\n"
            "  * 'title': Specific task title (e.g., 'Implement JWT Bearer Authentication Middleware', NOT generic stubs)\n"
            "  * 'description': Concrete engineering specification\n"
            "  * 'target_role': One of ['backend', 'frontend', 'database', 'qa', 'reviewer', 'devops', 'security', 'architect', 'docs']\n"
            "  * 'priority': 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL'\n"
            "  * 'expected_outcome': Clear acceptance criteria\n\n"
            "You MUST respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "intent": "CONVERSATION" or "DIRECTIVE",\n'
            '  "reply": "CTO response message",\n'
            '  "tasks": []\n'
            "}"
        )

        from nexora.domains.agents.identity_files import get_agent_system_instructions

        injected, reason = PromptSanitizer.scan_for_injection(directive)
        if injected:
            raise BusinessRuleError(f"CTO directive blocked by prompt security: {reason}")

        system_prompt = f"{system_prompt}\n\n{get_agent_system_instructions(cto)}"

        model_req = ModelRequest(
            prompt=PromptSanitizer.sanitize_for_external_llm(directive),
            system_prompt=PromptSanitizer.sanitize_for_external_llm(system_prompt),
            required_capabilities=["reasoning"],
            temperature=0.3,
            max_tokens=2048,
            timeout_seconds=10.0,
        )

        intel_svc = IntelligenceService(self.db)
        try:
            model_res = await intel_svc.execute_request(company_id, model_req, agent_id=cto.id)
            raw_text = model_res.text.strip()
        except Exception as exc:
            return (
                "CONVERSATION",
                f"CTO online for '{project.name}' ({len(agents)} agents ready). "
                f"Upstream model call failed ({exc}); verify active provider key in Intelligence Router or issue a slash command (/tick, /play, /approve-all).",
                [],
            )

        # Clean markdown code blocks if present
        clean_text = raw_text
        if "```" in clean_text:
            import re
            m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean_text, re.DOTALL)
            if m:
                clean_text = m.group(1).strip()
            else:
                lines = clean_text.splitlines()
                if lines and lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                clean_text = "\n".join(lines).strip()

        parsed = None
        try:
            parsed = json.loads(clean_text)
        except Exception:
            brace_start = raw_text.find("{")
            brace_end = raw_text.rfind("}")
            if brace_start != -1 and brace_end > brace_start:
                try:
                    parsed = json.loads(raw_text[brace_start : brace_end + 1])
                except Exception:
                    parsed = None

        if parsed and isinstance(parsed, dict):
            intent = str(parsed.get("intent", "CONVERSATION")).upper()
            reply = str(parsed.get("reply") or parsed.get("analysis") or "").strip()
            tasks = (
                parsed.get("tasks", [])
                if intent == "DIRECTIVE" and isinstance(parsed.get("tasks"), list)
                else []
            )
            if not reply:
                reply = raw_text
            return intent, reply, tasks

        # If LLM returned conversational plain text without JSON wrapper:
        # Honor the LLM's authentic generated message directly as conversation.
        # Under NO circumstances replace it with a prewritten/canned string.
        return "CONVERSATION", raw_text, []



    async def list_proposals(self, company_id: uuid.UUID) -> list[CTOProposal]:
        """List all proposals generated by the CTO for operator review."""
        stmt = (
            select(CTOProposal)
            .where(CTOProposal.company_id == company_id)
            .order_by(CTOProposal.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def generate_proposals_if_empty(self, company_id: uuid.UUID) -> list[CTOProposal]:
        """Formulate proactive proposals if no pending proposals currently exist."""
        existing = await self.list_proposals(company_id)
        pending = [p for p in existing if p.status == "PROPOSED"]
        if pending:
            return pending

        cto = await self.get_or_resolve_cto(company_id)

        proactive_ideas = [
            {
                "title": "Autonomous Query Result & Vector Embedding Caching Layer",
                "category": "PERFORMANCE",
                "rationale": "Intelligence queries and agent memory queries exhibit repeat retrieval patterns. In-memory LRU caching will reduce latency by ~60% and lower monthly token costs.",
                "impact_assessment": "Sub-millisecond memory recall and ~$120/mo projected token cost savings.",
                "proposed_tasks": [
                    {
                        "title": "Implement Redis / In-Memory Cache Key Policy",
                        "description": "Create cache manager utility with TTL expiry and eviction policies.",
                        "role": "backend",
                    },
                    {
                        "title": "Instrument Intelligence Router with Cache Middleware",
                        "description": "Wrap model call dispatchers to check cache before external LLM inference.",
                        "role": "backend",
                    },
                    {
                        "title": "Cache Invalidation & Hit-Rate Benchmark Tests",
                        "description": "Write integration test suite confirming cache hits, TTL eviction, and consistency.",
                        "role": "qa",
                    },
                ],
            },
            {
                "title": "Zero-Trust Continuous Architectural Rot Sentinel Automation",
                "category": "ARCHITECTURE",
                "rationale": "Prevent untyped logic, dead imports, circular module dependencies, and boundary violations from accumulating across git worktrees.",
                "impact_assessment": "100% architectural conformance and automatic pre-commit quality enforcement.",
                "proposed_tasks": [
                    {
                        "title": "Automate AST Dependency Graph Validator",
                        "description": "Integrate AST parser checking circular dependencies across nexora domains.",
                        "role": "reviewer",
                    },
                    {
                        "title": "Configure Pre-Merge Git Hook Quality Gate",
                        "description": "Add git hook verification blocking commits that violate architectural rules.",
                        "role": "devops",
                    },
                ],
            },
            {
                "title": "AppSec Cryptographic Secret & PII Egress Masking Guardrail",
                "category": "SECURITY",
                "rationale": "Ensure zero API tokens, database connection credentials, or private user telemetry are transmitted to external intelligence providers.",
                "impact_assessment": "Guaranteed SOC2 / HIPAA compliant egress filtering on all agent model payloads.",
                "proposed_tasks": [
                    {
                        "title": "Build Regex & Entropy Secret Masking Filter",
                        "description": "Implement redaction filter for AWS keys, private SSH tokens, and database URIs.",
                        "role": "security",
                    },
                    {
                        "title": "Write Adversarial Secret Injection Test Suite",
                        "description": "Validate filter against 50+ known credential formats to prove zero egress.",
                        "role": "qa",
                    },
                ],
            },
        ]

        created = []
        for idea in proactive_ideas:
            prop = CTOProposal(
                company_id=company_id,
                cto_agent_id=cto.id,
                title=idea["title"],
                category=idea["category"],
                rationale=idea["rationale"],
                impact_assessment=idea["impact_assessment"],
                status="PROPOSED",
                proposed_tasks=idea["proposed_tasks"],
                delegated_task_ids=[],
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            self.db.add(prop)
            created.append(prop)

        await self.db.commit()
        for p in created:
            await self.db.refresh(p)

        # Emit notification event
        await activity_broadcaster.broadcast(
            str(company_id),
            ActivityEvent(
                company_id=str(company_id),
                event_type=ActivityEventType.EVOLUTION_PROPOSED,
                severity=ActivitySeverity.INFO,
                title=f"CTO {cto.name} Formulated Proactive Initiatives",
                summary=f"{len(created)} engineering proposals queued for CEO operator review.",
                agent_id=str(cto.id),
                agent_name=cto.name,
                payload={"proposals_count": len(created)},
            ),
            session=self.db,
        )

        return created

    async def decide_proposal(
        self,
        company_id: uuid.UUID,
        proposal_id: uuid.UUID,
        req: CTOProposalDecisionRequest,
    ) -> CTOProposal:
        """Approve and delegate proposal to workforce, or dismiss it."""
        stmt = select(CTOProposal).where(
            CTOProposal.id == proposal_id, CTOProposal.company_id == company_id
        )
        result = await self.db.execute(stmt)
        prop = result.scalar_one_or_none()
        if not prop:
            raise NotFoundError(f"Proposal {proposal_id} not found.")

        if prop.status != "PROPOSED":
            raise BusinessRuleError(f"Proposal already decided: status is {prop.status}.")

        decision_upper = req.decision.upper()
        if decision_upper == "APPROVED":
            prop.status = "APPROVED"
            project = await self.get_primary_project(company_id)
            agents = await self.agent_repo.list_by_company(company_id)

            # Map agents
            role_map: dict[str, Agent] = {}
            for a in agents:
                n = a.name.lower()
                for key in [
                    "backend",
                    "frontend",
                    "database",
                    "qa",
                    "security",
                    "devops",
                    "reviewer",
                ]:
                    if key in n:
                        role_map[key] = a

            cto = await self.get_or_resolve_cto(company_id)
            delegated_ids = []

            for p_task in prop.proposed_tasks:
                target_role = p_task.get("role", "backend")
                assigned = role_map.get(target_role) or cto

                task = await self.task_repo.create(
                    project_id=project.id,
                    company_id=company_id,
                    assigned_agent_id=assigned.id if assigned else None,
                    title=p_task["title"],
                    description=f"{p_task['description']}\nProposal Initiative: {prop.title}",
                    priority=Priority.HIGH,
                    status=TaskStatus.PENDING,
                    expected_outcome=f"Deliverable for {prop.title}",
                )
                delegated_ids.append(str(task.id))

            prop.delegated_task_ids = delegated_ids

            await activity_broadcaster.broadcast(
                str(company_id),
                ActivityEvent(
                    company_id=str(company_id),
                    event_type=ActivityEventType.TASK_CREATED,
                    severity=ActivitySeverity.INFO,
                    title=f"CEO Approved Proposal: {prop.title}",
                    summary=f"Delegated {len(delegated_ids)} tasks to engineering workforce.",
                    payload={"proposal_id": str(prop.id), "delegated_task_ids": delegated_ids},
                ),
                session=self.db,
            )

        elif decision_upper == "DISMISSED":
            prop.status = "DISMISSED"
            await activity_broadcaster.broadcast(
                str(company_id),
                ActivityEvent(
                    company_id=str(company_id),
                    event_type=ActivityEventType.DECISION_CREATED,
                    severity=ActivitySeverity.LOW,
                    title=f"CEO Dismissed Proposal: {prop.title}",
                    summary=req.notes or "Proposal archived without delegation.",
                    payload={"proposal_id": str(prop.id)},
                ),
                session=self.db,
            )
        else:
            raise BusinessRuleError(
                f"Unknown decision '{req.decision}'. Use 'APPROVED' or 'DISMISSED'."
            )

        await self.db.commit()
        await self.db.refresh(prop)
        return prop

    async def get_cto_status(self, company_id: uuid.UUID) -> dict[str, Any]:
        """Aggregate CTO executive status, workforce counts, and proposal queues."""
        cto = await self.get_or_resolve_cto(company_id)
        agents = await self.agent_repo.list_by_company(company_id)
        proposals = await self.list_proposals(company_id)
        pending_proposals = [p for p in proposals if p.status == "PROPOSED"]

        # Tasks stats
        tasks = await self.task_repo.list_by_company(company_id)
        active_tasks = [
            t for t in tasks if t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS)
        ]

        return {
            "company_id": str(company_id),
            "cto_agent_id": str(cto.id),
            "cto_agent_name": cto.name,
            "total_agents": len(agents),
            "working_agents": len([a for a in agents if a.status.value in ("WORKING", "ACTIVE")]),
            "pending_proposals_count": len(pending_proposals),
            "active_tasks_count": len(active_tasks),
            "completed_tasks_count": len([t for t in tasks if t.status == TaskStatus.COMPLETED]),
        }
