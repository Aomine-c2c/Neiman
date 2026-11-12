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

from nexora.core.enums import AgentMessageType, Priority, ProjectStatus, TaskStatus
from nexora.domains.activity.broadcaster import activity_broadcaster
from nexora.domains.activity.schemas import ActivityEvent, ActivityEventType, ActivitySeverity
from nexora.domains.agents.models import Agent, AgentCommunication, CTOProposal
from nexora.domains.agents.repository import AgentRepository
from nexora.domains.agents.schemas import (
    CTODirectiveRequest,
    CTODirectiveResponse,
    CTOProposalDecisionRequest,
    ExecutiveThreadMessageItem,
    ExecutiveThreadResponse,
    ExecutiveThreadSendRequest,
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

        workspace_context = "No attached workspace inspected."
        try:
            from pathlib import Path
            from nexora.domains.projects.inspector import WorkspaceInspector
            from nexora.domains.vcs.service import (
                get_company_workspace_dir,
                set_company_workspace_dir,
            )

            target_dir: Path | None = None
            if req.target_repo:
                candidate = Path(req.target_repo).expanduser().resolve()
                if candidate.is_dir():
                    target_dir = set_company_workspace_dir(str(company_id), candidate)
            else:
                existing_dir = get_company_workspace_dir(str(company_id))
                if existing_dir.is_dir():
                    target_dir = existing_dir

            if target_dir is not None:
                inspection = WorkspaceInspector.inspect(str(target_dir))
                workspace_context = (
                    f"Workspace: {inspection.target_path} | Stack: {', '.join(inspection.detected_stack or ['unknown'])} | "
                    f"Git: {inspection.git_branch or 'none'} | Summary: {inspection.summary[:400]}"
                )
        except Exception:
            workspace_context = "Workspace inspection unavailable."

        intent, reply_text, decomposed_specs = await self._analyze_and_decompose_with_model(
            company_id=company_id,
            cto=cto,
            project=project,
            agents=agents,
            directive=req.directive,
            workspace_context=workspace_context,
            document_text=req.document_text,
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

        if created_tasks and req.auto_delegate and req.autonomous_execute:
            from nexora.domains.agents.supervisor import ContinuousSupervisor

            ContinuousSupervisor(self.db).toggle(company_id, "PLAY")

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
        workspace_context: str = "",
        document_text: str | None = None,
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

        # Automatic organizational memory retrieval before every new directive
        memory_context = "None recorded."
        try:
            from nexora.domains.memory.service import MemoryService

            mem_svc = MemoryService(self.db)
            relevant_memories = await mem_svc.search_memories(
                company_id=company_id,
                query=directive,
                limit=5,
            )
            if relevant_memories:
                memory_context = "\n".join(
                    [
                        f"- [{m.domain}] {m.title}: {(m.summary or m.content or '')[:240]}"
                        for m in relevant_memories
                    ]
                )
        except Exception:
            memory_context = "Unavailable."

        doc_section = (
            f"Project Specification Document:\n{document_text[:24000]}\n\n"
            if document_text
            else ""
        )
        ws_section = f"Target Codebase Context:\n{workspace_context}\n\n" if workspace_context else ""

        system_prompt = (
            f"You are the Autonomous CTO of this engineering enterprise.\n"
            f"You oversee the active initiative: '{project.name}'.\n"
            f"Available workforce swarm agents: {agent_roster_str}.\n\n"
            f"{ws_section}"
            f"{doc_section}"
            f"Active Architectural Proposals & Initiatives:\n{proposal_summary}\n\n"
            f"Relevant Organizational Memory:\n{memory_context}\n\n"
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
        """Formulate initial proactive proposals once per company; never re-create decided proposals."""
        existing = await self.list_proposals(company_id)
        if existing:
            decided_titles = {
                p.title.strip().lower()
                for p in existing
                if p.status in ("APPROVED", "DISMISSED")
            }
            dirty = False
            valid_pending: list[CTOProposal] = []
            seen_pending_titles: set[str] = set()
            for p in existing:
                if p.status == "PROPOSED":
                    norm_title = p.title.strip().lower()
                    if norm_title in decided_titles or norm_title in seen_pending_titles:
                        await self.db.delete(p)
                        dirty = True
                    else:
                        seen_pending_titles.add(norm_title)
                        valid_pending.append(p)
            if dirty:
                await self.db.commit()
            return valid_pending

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

    # ── Executive Email Thread & Multi-Agent Delegation Engine ──────────────────

    @staticmethod
    def _agent_role_label(agent: Agent) -> str:
        if isinstance(agent.identity, dict):
            role = agent.identity.get("role") or agent.identity.get("title")
            if role:
                return str(role)
        return agent.role_title or "Specialist Agent"

    async def list_executive_threads(
        self, company_id: uuid.UUID
    ) -> list[ExecutiveThreadResponse]:
        """
        Return all persistent executive email threads (CTO directives, multi-agent delegations,
        direct agent messages, and council deliberations) ordered by most recent update.
        """
        from nexora.domains.councils.models import CouncilDeliberation

        agents = await self.agent_repo.list_by_company(company_id)
        agent_map = {str(a.id): a for a in agents}

        stmt = (
            select(AgentCommunication)
            .where(AgentCommunication.company_id == company_id)
            .order_by(AgentCommunication.created_at.asc())
        )
        comm_res = await self.db.execute(stmt)
        comms = list(comm_res.scalars().all())

        threads_map: dict[str, dict[str, Any]] = {}

        for c in comms:
            pl = c.payload if isinstance(c.payload, dict) else {}
            t_id = str(pl.get("thread_id") or f"comm-{c.id}")
            t_subj = c.subject or "Executive Engineering Directive"
            t_type = str(pl.get("thread_type") or "CTO_DIRECTIVE")

            from_agent = agent_map.get(str(c.from_agent_id))
            to_agent = agent_map.get(str(c.to_agent_id)) if c.to_agent_id else None

            sender_name = str(
                pl.get("sender_name")
                or (from_agent.name if from_agent else "Operator")
            )
            sender_role = str(
                pl.get("sender_role")
                or (self._agent_role_label(from_agent) if from_agent else "Human Lead")
            )
            to_name = str(
                pl.get("to_name")
                or (to_agent.name if to_agent else "Chief Technology Agent")
            )
            to_role = str(
                pl.get("to_role")
                or (self._agent_role_label(to_agent) if to_agent else "CTO")
            )
            cc_names = [str(x) for x in (pl.get("cc_names") or [])]
            delegated_tasks = list(pl.get("delegated_tasks") or [])
            msg_kind = str(pl.get("msg_kind") or c.message_type.value)

            msg_item = ExecutiveThreadMessageItem(
                id=str(c.id),
                thread_id=t_id,
                sender_id=str(pl.get("sender_id") or c.from_agent_id),
                sender_name=sender_name,
                sender_role=sender_role,
                to_name=to_name,
                to_role=to_role,
                cc_names=cc_names,
                subject=t_subj,
                body=c.body,
                message_type=msg_kind,
                stance=pl.get("stance"),
                confidence=pl.get("confidence"),
                delegated_tasks=delegated_tasks,
                evidence=list(pl.get("evidence") or []),
                risks=list(pl.get("risks") or []),
                created_at=c.created_at.isoformat() if c.created_at else datetime.now(UTC).isoformat(),
            )

            if t_id not in threads_map:
                threads_map[t_id] = {
                    "thread_id": t_id,
                    "subject": t_subj,
                    "thread_type": t_type,
                    "status": "ACTIVE",
                    "participants": {},
                    "messages": [],
                    "spec_summary": None,
                    "technical_rationale": None,
                    "extracted_tasks": [],
                    "disagreements": [],
                    "adr_status": "ACTIVE",
                    "deliberation_id": pl.get("deliberation_id"),
                    "updated_at": msg_item.created_at,
                }

            entry = threads_map[t_id]
            entry["messages"].append(msg_item)
            entry["updated_at"] = msg_item.created_at

            # Track participants
            entry["participants"][sender_name] = {
                "id": msg_item.sender_id or sender_name,
                "name": sender_name,
                "role": sender_role,
            }
            if to_name and to_name not in entry["participants"]:
                entry["participants"][to_name] = {
                    "id": str(c.to_agent_id) if c.to_agent_id else to_name,
                    "name": to_name,
                    "role": to_role,
                }

            if delegated_tasks:
                entry["status"] = "DELEGATED"
                entry["adr_status"] = "DIRECTIVE_DISPATCHED"
                existing_ids = {t.get("id") for t in entry["extracted_tasks"] if isinstance(t, dict)}
                for dt in delegated_tasks:
                    if isinstance(dt, dict) and dt.get("id") not in existing_ids:
                        entry["extracted_tasks"].append(dt)
                        existing_ids.add(dt.get("id"))

            if msg_kind == "CTO_DELEGATION":
                entry["spec_summary"] = c.body
                if delegated_tasks:
                    entry["technical_rationale"] = (
                        f"Autonomous CTO decomposed directive into {len(delegated_tasks)} "
                        "specialized engineering work items and delegated across squad."
                    )

        # Merge Council Deliberations as threads as well
        delib_stmt = (
            select(CouncilDeliberation)
            .where(CouncilDeliberation.company_id == company_id)
            .order_by(CouncilDeliberation.created_at.desc())
            .limit(25)
        )
        delib_res = await self.db.execute(delib_stmt)
        delibs = list(delib_res.scalars().all())

        for d in delibs:
            d_thread_id = f"delib-{d.id}"
            reviews = d.independent_reviews if isinstance(d.independent_reviews, list) else []
            disagreements = d.disagreements_recorded if isinstance(d.disagreements_recorded, list) else []
            synth = d.synthesis_proposal if isinstance(d.synthesis_proposal, dict) else {}
            mitigations = synth.get("recommended_mitigations") if isinstance(synth, dict) else []

            delib_messages: list[ExecutiveThreadMessageItem] = []
            participants_dict: dict[str, dict[str, str]] = {}

            for idx, rev in enumerate(reviews):
                if not isinstance(rev, dict):
                    continue
                ag_name = str(rev.get("agent_name") or rev.get("role") or f"Specialist {idx + 1}")
                ag_role = str(rev.get("role") or "Council Member")
                objections = list(rev.get("objections") or [])
                stance = "OBJECTS" if objections else "SUPPORTS"
                conf = float(rev.get("confidence", 0.85))
                participants_dict[ag_name] = {
                    "id": str(rev.get("agent_id") or ag_name),
                    "name": ag_name,
                    "role": ag_role,
                }
                delib_messages.append(
                    ExecutiveThreadMessageItem(
                        id=f"{d.id}-rev-{idx}",
                        thread_id=d_thread_id,
                        sender_id=str(rev.get("agent_id") or ag_name),
                        sender_name=ag_name,
                        sender_role=ag_role,
                        to_name="Architecture Council",
                        to_role="Council Quorum",
                        cc_names=["Operator", "CTO"],
                        subject=d.title,
                        body=str(rev.get("proposal") or ""),
                        message_type="COUNCIL_REVIEW",
                        stance=stance,
                        confidence=conf,
                        delegated_tasks=[],
                        evidence=[str(x) for x in (rev.get("evidence") or [])],
                        risks=[str(x) for x in (rev.get("risks") or [])],
                        created_at=d.created_at.isoformat() if d.created_at else datetime.now(UTC).isoformat(),
                    )
                )

            # Append any interactive messages sent inside this deliberation thread
            if d_thread_id in threads_map:
                existing_entry = threads_map[d_thread_id]
                delib_messages.extend(existing_entry["messages"])
                participants_dict.update(existing_entry["participants"])

            threads_map[d_thread_id] = {
                "thread_id": d_thread_id,
                "subject": d.title,
                "thread_type": "COUNCIL_DEBATE",
                "status": d.status or "DELIBERATING",
                "participants": participants_dict,
                "messages": delib_messages,
                "spec_summary": (
                    synth.get("synthesized_decision")
                    if isinstance(synth, dict) and synth.get("synthesized_decision")
                    else d.problem_statement
                ),
                "technical_rationale": d.decision_rationale or d.problem_statement,
                "extracted_tasks": [
                    {"id": f"mit-{i}", "title": str(m), "status": "PENDING", "priority": "HIGH"}
                    for i, m in enumerate(mitigations or [])
                ] + (threads_map[d_thread_id]["extracted_tasks"] if d_thread_id in threads_map else []),
                "disagreements": [
                    {
                        "topic": str(dis.get("topic") or "Architectural Trade-off"),
                        "mitigation": str(dis.get("mitigation") or ""),
                    }
                    for dis in disagreements
                    if isinstance(dis, dict)
                ],
                "adr_status": d.status or "DELIBERATING",
                "deliberation_id": str(d.id),
                "updated_at": (
                    delib_messages[-1].created_at
                    if delib_messages
                    else (d.updated_at.isoformat() if d.updated_at else datetime.now(UTC).isoformat())
                ),
            }

        results: list[ExecutiveThreadResponse] = []
        for item in threads_map.values():
            results.append(
                ExecutiveThreadResponse(
                    thread_id=item["thread_id"],
                    subject=item["subject"],
                    thread_type=item["thread_type"],
                    status=item["status"],
                    participants=list(item["participants"].values()),
                    messages=item["messages"],
                    spec_summary=item["spec_summary"],
                    technical_rationale=item["technical_rationale"],
                    extracted_tasks=item["extracted_tasks"],
                    disagreements=item["disagreements"],
                    adr_status=item["adr_status"],
                    deliberation_id=item["deliberation_id"],
                    updated_at=item["updated_at"],
                )
            )

        results.sort(key=lambda r: r.updated_at, reverse=True)
        return results

    async def send_executive_thread_message(
        self, company_id: uuid.UUID, req: ExecutiveThreadSendRequest
    ) -> ExecutiveThreadResponse:
        """
        Send an email-style message in an Executive Thread:
        - If addressed to CTO (or no target_agent_id):
          1. Records Operator's message.
          2. Runs CTO analysis & task decomposition.
          3. Records CTO's reply & task delegation cards.
          4. Each delegated specialist agent automatically replies in the thread with their execution plan.
        - If addressed to a specific specialist agent:
          1. Records Operator's direct message to that agent.
          2. Generates and records that specialist agent's direct reply in the thread.
        """
        cto = await self.get_or_resolve_cto(company_id)
        agents = await self.agent_repo.list_by_company(company_id)
        agent_by_id = {a.id: a for a in agents}
        agent_by_name = {a.name.lower(): a for a in agents}

        target_agent = (
            agent_by_id.get(req.target_agent_id)
            if req.target_agent_id and req.target_agent_id in agent_by_id
            else cto
        )
        is_to_cto = target_agent.id == cto.id

        thread_id = req.thread_id or f"thr-{uuid.uuid4().hex[:12]}"
        subject = (req.subject or "").strip()
        if not subject:
            # If continuing an existing thread, look up its subject
            existing_stmt = (
                select(AgentCommunication)
                .where(AgentCommunication.company_id == company_id)
                .order_by(AgentCommunication.created_at.desc())
                .limit(30)
            )
            ex_res = await self.db.execute(existing_stmt)
            for row in ex_res.scalars().all():
                if isinstance(row.payload, dict) and row.payload.get("thread_id") == thread_id:
                    subject = row.subject
                    break
            if not subject:
                clean_preview = req.body.strip().split("\n")[0][:72]
                subject = clean_preview if len(clean_preview) > 5 else f"Directive to {target_agent.name}"

        cc_agents = [agent_by_id[cid] for cid in req.cc_agent_ids if cid in agent_by_id]
        cc_names = [a.name for a in cc_agents]
        if not is_to_cto and cto.name not in cc_names:
            cc_names.append(cto.name)

        thread_type = (
            "COUNCIL_DEBATE"
            if thread_id.startswith("delib-")
            else ("CTO_DIRECTIVE" if is_to_cto else "AGENT_DIRECT")
        )

        # 1. Persist Operator's outbound email message
        op_comm = AgentCommunication(
            company_id=company_id,
            from_agent_id=cto.id,
            to_agent_id=target_agent.id,
            message_type=AgentMessageType.REQUEST,
            subject=subject,
            body=req.body.strip(),
            payload={
                "thread_id": thread_id,
                "thread_type": thread_type,
                "msg_kind": "OPERATOR",
                "sender_id": "operator",
                "sender_name": "Operator",
                "sender_role": "Human Lead",
                "to_name": target_agent.name,
                "to_role": "CTO" if is_to_cto else self._agent_role_label(target_agent),
                "cc_names": cc_names,
            },
        )
        self.db.add(op_comm)
        await self.db.flush()

        if is_to_cto:
            # 2. Execute CTO Directive Analysis & Task Decomposition
            directive_res = await self.intake_directive(
                company_id,
                CTODirectiveRequest(
                    directive=req.body.strip(),
                    priority=req.priority,
                    auto_delegate=req.auto_delegate,
                ),
            )
            created_tasks = directive_res.tasks or []
            delegated_agent_names = list(
                dict.fromkeys(
                    [
                        str(t.get("assigned_agent"))
                        for t in created_tasks
                        if isinstance(t, dict) and t.get("assigned_agent")
                    ]
                )
            )

            cto_reply_body = (
                directive_res.analysis
                or directive_res.summary
                or "Directive analyzed and decomposed across the engineering squad."
            )

            # 3. Persist CTO Reply & Task Delegation Turn
            cto_comm = AgentCommunication(
                company_id=company_id,
                from_agent_id=cto.id,
                to_agent_id=cto.id,
                message_type=(
                    AgentMessageType.DELEGATION
                    if created_tasks
                    else AgentMessageType.RESPONSE
                ),
                subject=subject,
                body=cto_reply_body,
                payload={
                    "thread_id": thread_id,
                    "thread_type": thread_type,
                    "msg_kind": "CTO_DELEGATION",
                    "sender_id": str(cto.id),
                    "sender_name": cto.name,
                    "sender_role": "CTO",
                    "to_name": "Operator",
                    "to_role": "Human Lead",
                    "cc_names": delegated_agent_names or cc_names,
                    "stance": "DELEGATED" if created_tasks else "CONVERSATION",
                    "delegated_tasks": created_tasks,
                },
            )
            self.db.add(cto_comm)
            await self.db.flush()

            # 4. Automatically generate downstream Specialist Agent replies for each delegated task
            for task_info in created_tasks:
                if not isinstance(task_info, dict):
                    continue
                assigned_name = str(task_info.get("assigned_agent") or "")
                specialist = agent_by_name.get(assigned_name.lower())
                if not specialist:
                    role_hint = str(task_info.get("role") or "").lower()
                    for ag in agents:
                        if ag.id != cto.id and role_hint in self._agent_role_label(ag).lower():
                            specialist = ag
                            break
                if not specialist:
                    specialist = next((ag for ag in agents if ag.id != cto.id), cto)

                spec_role = self._agent_role_label(specialist)
                task_title = str(task_info.get("title") or "Engineering Task")
                task_prio = str(task_info.get("priority") or "HIGH")

                agent_reply_text = (
                    f"Acknowledged assignment from @{cto.name} for **{task_title}** ({task_prio} priority).\n\n"
                    f"Execution Plan ({spec_role}):\n"
                    f"1. Inspect repository AST & module boundaries for `{task_title}`.\n"
                    f"2. Implement changes with strict type safety and zero mock state.\n"
                    f"3. Run verification suite and report completion back to thread."
                )

                ag_comm = AgentCommunication(
                    company_id=company_id,
                    from_agent_id=specialist.id,
                    to_agent_id=cto.id,
                    task_id=uuid.UUID(str(task_info["id"])) if task_info.get("id") else None,
                    message_type=AgentMessageType.RESPONSE,
                    subject=subject,
                    body=agent_reply_text,
                    payload={
                        "thread_id": thread_id,
                        "thread_type": thread_type,
                        "msg_kind": "AGENT_REPLY",
                        "sender_id": str(specialist.id),
                        "sender_name": specialist.name,
                        "sender_role": spec_role,
                        "to_name": f"{cto.name}, Operator",
                        "to_role": "Executive Lead",
                        "cc_names": [cto.name, "Operator"],
                        "stance": "IN_PROGRESS",
                        "delegated_tasks": [task_info],
                    },
                )
                self.db.add(ag_comm)

            await self.db.commit()
        else:
            # Direct message to a specific Specialist Agent
            reply_text = await self._generate_direct_agent_reply(
                company_id=company_id,
                agent=target_agent,
                cto=cto,
                operator_message=req.body.strip(),
            )
            spec_role = self._agent_role_label(target_agent)
            ag_comm = AgentCommunication(
                company_id=company_id,
                from_agent_id=target_agent.id,
                to_agent_id=cto.id,
                message_type=AgentMessageType.RESPONSE,
                subject=subject,
                body=reply_text,
                payload={
                    "thread_id": thread_id,
                    "thread_type": thread_type,
                    "msg_kind": "AGENT_REPLY",
                    "sender_id": str(target_agent.id),
                    "sender_name": target_agent.name,
                    "sender_role": spec_role,
                    "to_name": "Operator",
                    "to_role": "Human Lead",
                    "cc_names": [cto.name],
                    "stance": "DIRECT_REPLY",
                },
            )
            self.db.add(ag_comm)
            await self.db.commit()

        all_threads = await self.list_executive_threads(company_id)
        for t in all_threads:
            if t.thread_id == thread_id:
                return t
        return all_threads[0]

    async def _generate_direct_agent_reply(
        self,
        company_id: uuid.UUID,
        agent: Agent,
        cto: Agent,
        operator_message: str,
    ) -> str:
        """Generate a direct 1-on-1 response from a specialist squad agent."""
        from nexora.core.security import PromptSanitizer
        from nexora.domains.agents.identity_files import get_agent_system_instructions
        from nexora.domains.intelligence.schemas import ModelRequest
        from nexora.domains.intelligence.service import IntelligenceService

        role_label = self._agent_role_label(agent)
        tasks = await self.task_repo.list_by_company(company_id)
        my_tasks = [t for t in tasks if t.assigned_agent_id == agent.id][:5]
        tasks_context = (
            "\n".join([f"- [{t.status.value}] {t.title} ({t.priority.value})" for t in my_tasks])
            if my_tasks
            else "No active tasks currently assigned."
        )

        sys_prompt = (
            f"You are {agent.name}, {role_label} in this software engineering organization.\n"
            f"Your CTO is {cto.name}.\n"
            f"Your currently assigned engineering tasks:\n{tasks_context}\n\n"
            "Respond directly to the Operator in first person ('I'). Be technical, concise, and actionable.\n\n"
            f"{get_agent_system_instructions(agent)}"
        )

        try:
            model_req = ModelRequest(
                prompt=PromptSanitizer.sanitize_for_external_llm(operator_message),
                system_prompt=PromptSanitizer.sanitize_for_external_llm(sys_prompt),
                required_capabilities=["reasoning"],
                temperature=0.3,
                max_tokens=1024,
                timeout_seconds=8.0,
            )
            intel_svc = IntelligenceService(self.db)
            res = await intel_svc.execute_request(company_id, model_req, agent_id=agent.id)
            if res.text and res.text.strip():
                return res.text.strip()
        except Exception:
            pass

        if my_tasks:
            top_t = my_tasks[0]
            return (
                f"[{agent.name} · {role_label}] Copy that. Regarding your message: \"{operator_message[:90]}\"\n\n"
                f"I am actively aligned on **{top_t.title}** (Status: `{top_t.status.value}`, Priority: `{top_t.priority.value}`). "
                f"I will incorporate these constraints into the implementation and report verification telemetry in this thread."
            )
        return (
            f"[{agent.name} · {role_label}] Acknowledged. I have reviewed your instructions regarding "
            f"\"{operator_message[:90]}\" and am ready to execute or coordinate with @{cto.name}."
        )

    async def hire_agent(
        self,
        company_id: uuid.UUID,
        *,
        name: str,
        role_title: str,
        slug: str,
        hire_type: str = "temporary",
        external_runtime: str | None = None,
        capabilities: list[str] | None = None,
        mcp_servers: list[str] | None = None,
        worktree_scope: str | None = None,
        soul_markdown: str | None = None,
        skills_markdown: str | None = None,
    ) -> dict:
        """CTO dynamic hiring & external proxy provisioning within the 33-agent cap.

        - temporary / external (e.g. Hermes): autonomous up to 33 cap; external gets proxy soul + security_lead auto-audit.
        - permanent: provisioned in PAUSED state with pending_ceo_approval=True for 1-click CEO Decision Card.
        """
        from nexora.core.enums import AgentStatus
        from nexora.core.external_agents import ExternalAgentConfig, external_agent_registry
        from nexora.domains.agents.service import AgentService
        from nexora.exceptions import BusinessRuleError

        normalized_type = hire_type.strip().lower()
        if normalized_type not in {"permanent", "temporary", "external"}:
            raise BusinessRuleError(f"Unsupported hire_type '{hire_type}'. Use permanent, temporary, or external.")

        agent_svc = AgentService(self.db)
        existing = await agent_svc.list(company_id)
        active_count = sum(1 for a in existing if a.status != AgentStatus.RETIRED)
        if active_count >= AgentService.MAX_COMPANY_AGENTS:
            raise BusinessRuleError(
                f"Cannot hire '{name}': company at {active_count}/{AgentService.MAX_COMPANY_AGENTS} agent cap."
            )

        is_external = normalized_type == "external" or bool(external_runtime)
        is_permanent = normalized_type == "permanent"
        runtime_name = (external_runtime or "hermes").strip().lower() if is_external else None

        if not soul_markdown:
            if is_external:
                soul_markdown = (
                    f"# EXTERNAL PROXY SOUL: {name}\n\n"
                    f"- **Slug**: `{slug}`\n"
                    f"- **Runtime**: `{runtime_name}`\n"
                    f"- **Role**: {role_title}\n"
                    f"- **Boundary**: Scoped to assigned worktree/branch (`{worktree_scope or 'feature/*'}`). "
                    "No prod/DB/secret access. All per-task MCP grants auto-audited by `security_lead`.\n"
                )
            else:
                soul_markdown = (
                    f"# SOUL SPECIFICATION: {name}\n\n"
                    f"- **Slug**: `{slug}`\n"
                    f"- **Role Title**: {role_title}\n"
                    f"- **Hire Type**: {normalized_type}\n"
                )

        if not skills_markdown:
            skills_list = capabilities or (["external_execution"] if is_external else ["task_execution"])
            skills_markdown = "# Operational Skills\n\n" + "\n".join(f"- `{s}`" for s in skills_list) + "\n"

        if is_external and not external_agent_registry.get_agent(slug):
            external_agent_registry.register_agent(
                ExternalAgentConfig(
                    id=slug,
                    name=name,
                    vendor=runtime_name or "hermes",
                    description=f"CTO-provisioned {runtime_name or 'hermes'} external proxy ({role_title})",
                    endpoint_type="builtin_adapter",
                    endpoint_url=f"local://{runtime_name or 'hermes'}/{slug}",
                    capabilities=capabilities or ["code_generation", "reasoning"],
                    system_prompt=soul_markdown,
                    is_active=True,
                )
            )

        permissions = {
            "worktree_scope": worktree_scope or "assigned_worktree_only",
            "branch_scope": "feature/*",
            "prod_db_access": False,
            "secret_access": False,
            "mcp_servers": mcp_servers or [],
            "security_lead_auto_audit": is_external,
        }

        status = AgentStatus.PAUSED if is_permanent else AgentStatus.AVAILABLE
        agent = await agent_svc.create(
            company_id,
            name=name,
            status=status,
            capabilities=capabilities or [],
            permissions=permissions,
            system_instructions=f"You are {name} ({role_title}). Follow your SOUL and SKILLS strictly.",
            identity={
                "slug": slug,
                "role_title": role_title,
                "hire_type": normalized_type,
                "external_runtime": runtime_name,
                "pending_ceo_approval": is_permanent,
                "soul_markdown": soul_markdown,
                "skills_markdown": skills_markdown,
            },
        )
        await self.db.commit()
        return {
            "agent_id": str(agent.id),
            "slug": slug,
            "name": agent.name,
            "hire_type": normalized_type,
            "status": agent.status.value,
            "requires_ceo_approval": is_permanent,
            "security_lead_auto_audit": is_external,
            "active_agents": active_count + 1,
            "max_agents": AgentService.MAX_COMPANY_AGENTS,
        }

    async def enhance_prompt(
        self,
        company_id: uuid.UUID,
        prompt: str,
        context: str | None = None,
    ) -> dict[str, str | None]:
        """Sharpen a raw CEO directive into a concise, high-signal specification for Solomon (CTO)."""
        from nexora.core.security import PromptSanitizer
        from nexora.domains.intelligence.schemas import ModelRequest
        from nexora.domains.intelligence.service import IntelligenceService
        from nexora.exceptions import BusinessRuleError

        cleaned = prompt.strip()
        if not cleaned:
            raise BusinessRuleError("Prompt cannot be empty.")

        ctx_block = f"\nContext: {context.strip()}" if context and context.strip() else ""
        sys_prompt = (
            "You are Solomon (CTO) & Nicodemus (Research & Intelligence Lead). "
            "Rewrite the CEO's raw directive into a crisp, zero-filler engineering prompt with:\n"
            "1) Clear Objective\n2) Scope & Constraints\n3) Verifiable Acceptance Criteria.\n"
            "Return ONLY the rewritten prompt text—no preamble, no markdown code fences."
        )
        intel_svc = IntelligenceService(self.db)
        res = await intel_svc.execute_request(
            company_id,
            ModelRequest(
                prompt=PromptSanitizer.sanitize_for_external_llm(f"Raw CEO prompt: {cleaned}{ctx_block}"),
                system_prompt=sys_prompt,
                required_capabilities=["reasoning"],
                temperature=0.2,
                max_tokens=450,
                timeout_seconds=10.0,
            ),
        )
        enhanced = (res.text or "").strip()
        if not enhanced:
            raise BusinessRuleError("LLM provider returned an empty enhanced prompt.")
        return {
            "enhanced_prompt": enhanced,
            "provider": res.provider,
            "model": res.model,
        }


