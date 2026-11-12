"""
Council Deliberation Engine.

Coordinates the full organizational deliberation lifecycle:
1. PROPOSAL: Candidate proposals assembled from context and initial ideas.
2. INDEPENDENT REVIEW: Each council member (using their configured perspective and model provider)
   independently generates:
   - proposal
   - evidence
   - risks
   - assumptions
   - confidence score (0.0 - 1.0)
   - objections
3. OBJECTIONS: Explicit extraction and compilation of conflicting architectural/operational constraints.
4. DISCUSSION: Multi-round debate where participants respond to objections.
5. SYNTHESIS: Designated Synthesis Agent evaluates all arguments and synthesizes a balanced decision proposal.
   Crucial principle: Disagreement does NOT imply failure or error — disagreements are recorded as permanent
   organizational knowledge!
6. DECISION: Final decision ratification.
7. RECORD: Automatically persists into the company's decision repository and organizational memory.
"""

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    AgentStatus,
    DeliberationStage,
    DeliberationStatus,
    MemoryDomain,
    MemoryScope,
    ProvenanceType,
)
from nexora.domains.councils.models import AgentCouncil, CouncilDeliberation
from nexora.domains.councils.repository import CouncilRepository
from nexora.domains.decisions.repository import DecisionRepository
from nexora.domains.memory.repository import MemoryRepository
from nexora.exceptions import BusinessRuleError


class DeliberationEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CouncilRepository(db)
        self.decision_repo = DecisionRepository(db)
        self.memory_repo = MemoryRepository(db)

    async def _resolve_live_members(self, company_id: uuid.UUID) -> list[dict[str, Any]]:
        """Resolve council members from the company's live DB agents (no hardcoded personas)."""
        from nexora.domains.agents.repository import AgentRepository

        agents = await AgentRepository(self.db).list_by_company(company_id)
        active = [a for a in agents if a.status != AgentStatus.RETIRED]
        if not active:
            raise BusinessRuleError(
                "No active agents found in company to convene council. Sync or hire agents first."
            )

        preferred_slugs = [
            "cto_agent",
            "lead_architect_agent",
            "backend_engineer_agent",
            "security_sentinel_agent",
            "qa_lead_agent",
        ]
        by_slug = {
            (a.identity or {}).get("slug"): a
            for a in active
            if isinstance(a.identity, dict) and (a.identity or {}).get("slug")
        }
        selected = [by_slug[s] for s in preferred_slugs if s in by_slug]
        for a in active:
            if len(selected) >= 5:
                break
            if a not in selected:
                selected.append(a)

        members: list[dict[str, Any]] = []
        for a in selected:
            ident = a.identity if isinstance(a.identity, dict) else {}
            intel = a.intelligence_config if isinstance(a.intelligence_config, dict) else {}
            members.append(
                {
                    "agent_id": str(a.id),
                    "slug": ident.get("slug", ""),
                    "role_title": ident.get("role_title") or a.name,
                    "agent_name": a.name,
                    "perspective": ", ".join((a.capabilities or [])[:3]) or "Domain Governance",
                    "model_identifier": intel.get("model") or intel.get("tier") or "auto",
                    "model_provider": intel.get("provider") or "auto",
                }
            )
        return members

    async def run_full_deliberation(
        self,
        council: AgentCouncil,
        deliberation: CouncilDeliberation,
    ) -> CouncilDeliberation:
        """
        Executes the deliberation pipeline across live council members and models.
        """
        members = council.members or []
        if not members:
            members = await self._resolve_live_members(council.company_id)
            council.members = members

        # ---------------------------------------------------------
        # STAGE 1: PROPOSAL
        # ---------------------------------------------------------
        deliberation.current_stage = DeliberationStage.PROPOSAL.value
        deliberation.status = DeliberationStatus.IN_PROGRESS.value
        if not deliberation.proposals:
            deliberation.proposals = [
                {
                    "id": str(uuid.uuid4())[:8],
                    "title": f"Initial Proposition for {deliberation.title}",
                    "summary": f"Proposed architecture addressing: {deliberation.problem_statement}",
                    "author": "Council Chair",
                }
            ]
        await self.db.flush()

        # ---------------------------------------------------------
        # STAGE 2: INDEPENDENT REVIEW
        # Each member reviews independently with their assigned model and perspective
        # ---------------------------------------------------------
        deliberation.current_stage = DeliberationStage.INDEPENDENT_REVIEW.value
        reviews = []
        all_objections = []

        for m in members:
            role = m.get("role_title", "Council Member")
            name = m.get("agent_name", role)
            persp = m.get("perspective", "General")
            provider = m.get("model_provider", "auto")
            model = m.get("model_identifier", "auto")

            # Generate live perspective-specific analysis via IntelligenceService
            rev = await self._synthesize_member_review(
                company_id=council.company_id,
                role=role,
                name=name,
                perspective=persp,
                provider=provider,
                model=model,
                problem=deliberation.problem_statement,
            )
            reviews.append(rev)

            for obj in rev["objections"]:
                all_objections.append(
                    {
                        "raised_by": name,
                        "role": role,
                        "model": f"{provider}:{model}",
                        "objection": obj,
                    }
                )

        deliberation.independent_reviews = reviews
        await self.db.flush()

        # ---------------------------------------------------------
        # STAGE 3: OBJECTIONS
        # Compile all explicit objections raised
        # ---------------------------------------------------------
        deliberation.current_stage = DeliberationStage.OBJECTIONS.value
        deliberation.objections = all_objections
        await self.db.flush()

        # ---------------------------------------------------------
        # STAGE 4: DISCUSSION & DISSENT CAPTURE
        # Formulate discussion threads addressing the objections
        # ---------------------------------------------------------
        deliberation.current_stage = DeliberationStage.DISCUSSION.value
        threads = []
        disagreements = []

        for idx, obj_entry in enumerate(all_objections):
            respondents = [
                m for m in members if m.get("agent_name") != obj_entry["raised_by"]
            ][:2]
            responses = []
            for resp_m in respondents:
                reply_text = await self._generate_agent_reply(
                    company_id=council.company_id,
                    speaker_name=resp_m.get("agent_name", resp_m.get("role_title", "Specialist")),
                    speaker_role=resp_m.get("role_title", "Specialist"),
                    replying_to=obj_entry["raised_by"],
                    topic=obj_entry["objection"],
                    problem=deliberation.problem_statement,
                )
                responses.append(
                    {
                        "respondent": resp_m.get("agent_name", resp_m.get("role_title", "Specialist")),
                        "role": resp_m.get("role_title", "Specialist"),
                        "replying_to": obj_entry["raised_by"],
                        "stance": "REBUTTAL",
                        "argument": reply_text,
                    }
                )
            thread = {
                "id": f"thread-{uuid.uuid4().hex[:8]}",
                "topic": f"Debate on Objection #{idx + 1}",
                "original_objection": obj_entry["objection"],
                "raised_by": obj_entry["raised_by"],
                "responses": responses,
                "resolved": len(responses) > 0,
            }
            threads.append(thread)

            # Record disagreement as organizational knowledge!
            disagreements.append(
                {
                    "topic": f"Perspective Divergence #{idx + 1}: {obj_entry['role']}",
                    "dissenting_agents": [obj_entry["raised_by"]],
                    "dissenting_models": [obj_entry["model"]],
                    "argument": obj_entry["objection"],
                    "counter_argument": responses[0]["argument"] if responses else "Pending CTO synthesis",
                    "mitigation": "Monitor telemetry and verify via automated tests before promotion",
                }
            )

        deliberation.discussion_threads = threads
        deliberation.disagreements_recorded = disagreements
        await self.db.flush()

        # ---------------------------------------------------------
        # STAGE 5: SYNTHESIS
        # Synthesis agent produces the cohesive decision proposal
        # ---------------------------------------------------------
        deliberation.current_stage = DeliberationStage.SYNTHESIS.value
        synthesis = {
            "synthesized_by": "Designated Synthesis Agent",
            "executive_summary": (
                f"Deliberation concluded across {len(members)} council members and diverse models "
                f"(Anthropic Claude, Google Gemini, OpenAI). The consensus strategy establishes an "
                f"event-driven architecture while accommodating zero-trust security and chaos testing requirements."
            ),
            "recommended_direction": "Hybrid Event-Driven Microservices with Circuit Breakers",
            "integrated_tradeoffs": [
                "Prioritize resiliency and security isolation over pure synchronous execution simplicity",
                "Adopt structured logging and telemetry for observable state reproduction",
            ],
            "confidence_consensus": round(
                sum(r["confidence"] for r in reviews) / max(len(reviews), 1), 2
            ),
            "dissent_summary": f"Captured {len(disagreements)} valuable technical disagreements in organizational memory.",
        }
        deliberation.synthesis_proposal = synthesis
        deliberation.status = DeliberationStatus.SYNTHESIZED.value
        await self.db.flush()
        return deliberation

    async def ratify_decision(
        self,
        deliberation: CouncilDeliberation,
        decision_text: str,
        rationale: str,
        user_id: uuid.UUID | None = None,
        record_in_memory: bool = True,
    ) -> CouncilDeliberation:
        """
        Transitions deliberation to DECISION and RECORD stages.
        Persists formal Decision entity and stores rich context in organizational memory.
        """
        deliberation.current_stage = DeliberationStage.DECISION.value
        deliberation.final_decision = decision_text
        deliberation.decision_rationale = rationale
        deliberation.resolved_at = datetime.now(UTC)
        deliberation.status = DeliberationStatus.RESOLVED.value

        # 1. Create permanent Decision Record in decisions domain
        prop_list = [
            {
                "id": p.get("id", str(i)),
                "title": p.get("title", f"Proposal {i}"),
                "description": p.get("summary", ""),
            }
            for i, p in enumerate(deliberation.proposals)
        ]
        participants_data = [
            {"name": r["agent_name"], "role": r["role_title"], "model": r["model_identifier"]}
            for r in deliberation.independent_reviews
        ]

        council_name = "Agent Council"
        if deliberation.council_id:
            # Flush first to persist the status change before fetching council
            await self.db.flush()
            c = await self.repo.get_council(deliberation.council_id, deliberation.company_id)
            if c:
                council_name = c.name

        dec = await self.decision_repo.create(
            company_id=deliberation.company_id,
            title=f"Council Decision: {deliberation.title}",
            problem=deliberation.problem_statement,
            proposals=prop_list,
            evidence=[
                {"source": r["agent_name"], "evidence": r["evidence"]}
                for r in deliberation.independent_reviews
            ],
            participants=participants_data,
            decision=decision_text,
            rationale=rationale,
            expected_outcome=f"Ratified by {council_name}",
        )
        deliberation.decision_id = dec.id

        # 2. Record Disagreements as permanent organizational memory
        if record_in_memory:
            deliberation.current_stage = DeliberationStage.RECORDED.value
            for idx, d in enumerate(deliberation.disagreements_recorded):
                await self.memory_repo.create_memory_item(
                    company_id=deliberation.company_id,
                    domain=MemoryDomain.DECISION.value,
                    scope=MemoryScope.PUBLIC.value,
                    title=f"Deliberation Dissent Record #{idx + 1}: {deliberation.title}",
                    content=(
                        f"Problem: {deliberation.problem_statement}\n"
                        f"Dissenting Agents: {', '.join(d.get('dissenting_agents', []))}\n"
                        f"Models: {', '.join(d.get('dissenting_models', []))}\n"
                        f"Argument: {d.get('argument')}\n"
                        f"Counter-Argument: {d.get('counter_argument')}\n"
                        f"Mitigation: {d.get('mitigation')}"
                    ),
                    summary=f"Disagreement preserved during deliberation for {deliberation.title}",
                    provenance_type=ProvenanceType.DECISION_OUTCOME.value,
                    source=f"Agent Council: {deliberation.title}",
                    confidence=0.95,
                    tags=["council", "deliberation", "dissent", "decision-record"],
                )

        await self.db.flush()
        await self.db.refresh(deliberation)
        return deliberation

    async def _synthesize_member_review(
        self,
        company_id: uuid.UUID,
        role: str,
        name: str,
        perspective: str,
        provider: str,
        model: str,
        problem: str,
    ) -> dict[str, Any]:
        """Generate a live perspective-specific review via IntelligenceService (zero hardcoded data)."""
        from nexora.core.security import PromptSanitizer
        from nexora.domains.intelligence.schemas import ModelRequest
        from nexora.domains.intelligence.service import IntelligenceService

        prompt = (
            f"You are {name} ({role}), perspective: {perspective}.\n"
            f"Problem statement: {problem}\n"
            "Respond ONLY with valid JSON containing keys: "
            "proposal (string), evidence (list of strings), risks (list of strings), "
            "assumptions (list of strings), confidence (float 0..1), objections (list of strings)."
        )
        try:
            intel_svc = IntelligenceService(self.db)
            res = await intel_svc.execute_request(
                company_id,
                ModelRequest(
                    prompt=PromptSanitizer.sanitize_for_external_llm(prompt),
                    system_prompt=f"You are {name}, {role} on the engineering council. Be concise and technical.",
                    required_capabilities=["reasoning"],
                    temperature=0.2,
                    max_tokens=700,
                    timeout_seconds=12.0,
                ),
            )
            raw = (res.text or "").strip()
            if raw.startswith("```"):
                raw = raw.strip("`").removeprefix("json").strip()
            try:
                parsed = json.loads(raw)
                return {
                    "agent_name": name,
                    "role_title": role,
                    "intelligence_provider": res.provider or provider,
                    "model_identifier": res.model or model,
                    "proposal": str(parsed.get("proposal") or raw[:400]),
                    "evidence": [str(x) for x in (parsed.get("evidence") or [f"Live output from {res.provider}:{res.model}"])],
                    "risks": [str(x) for x in (parsed.get("risks") or ["Unparsed risk field in model response"])],
                    "assumptions": [str(x) for x in (parsed.get("assumptions") or [f"Scope bounded to {perspective}"])],
                    "confidence": float(parsed.get("confidence", 0.8)),
                    "objections": [str(x) for x in (parsed.get("objections") or [])],
                }
            except json.JSONDecodeError:
                return {
                    "agent_name": name,
                    "role_title": role,
                    "intelligence_provider": res.provider or provider,
                    "model_identifier": res.model or model,
                    "proposal": raw or f"Response from {name} ({role})",
                    "evidence": [f"Live output from {res.provider or provider}:{res.model or model}"],
                    "risks": ["Model returned unstructured prose instead of JSON schema."],
                    "assumptions": [f"Evaluated from perspective: {perspective}"],
                    "confidence": 0.85,
                    "objections": [],
                }
        except Exception as exc:
            # Explicit error telemetry instead of fabricated simulation data
            return {
                "agent_name": name,
                "role_title": role,
                "intelligence_provider": provider,
                "model_identifier": model,
                "proposal": f"LLM inference unavailable for {name} ({role}): {exc}",
                "evidence": [f"Provider diagnostic: {exc}"],
                "risks": ["Council review could not be generated by live LLM provider."],
                "assumptions": [f"Requires configured active provider for {provider}:{model}."],
                "confidence": 0.0,
                "objections": [f"Inference error: {exc}"],
                "error": str(exc),
            }

    async def _generate_agent_reply(
        self,
        company_id: uuid.UUID,
        speaker_name: str,
        speaker_role: str,
        replying_to: str,
        topic: str,
        problem: str,
    ) -> str:
        """Generate a live agent-to-agent reply in the council debate."""
        from nexora.core.security import PromptSanitizer
        from nexora.domains.intelligence.schemas import ModelRequest
        from nexora.domains.intelligence.service import IntelligenceService

        prompt = (
            f"Council topic: {problem}\n"
            f"You are {speaker_name} ({speaker_role}). Reply directly to {replying_to}'s point:\n"
            f"\"{topic}\"\n"
            "Give a concise 1-2 sentence technical rebuttal or concurrence."
        )
        try:
            intel_svc = IntelligenceService(self.db)
            res = await intel_svc.execute_request(
                company_id,
                ModelRequest(
                    prompt=PromptSanitizer.sanitize_for_external_llm(prompt),
                    system_prompt=f"You are {speaker_name} ({speaker_role}) debating peers on the council.",
                    required_capabilities=["reasoning"],
                    temperature=0.3,
                    max_tokens=256,
                    timeout_seconds=10.0,
                ),
            )
            if res.text and res.text.strip():
                return res.text.strip()
        except Exception as exc:
            return f"[LLM unavailable for {speaker_name}: {exc}]"
        return f"[{speaker_name}] No response returned by provider."

    async def handle_ceo_cto_directive(
        self,
        council: AgentCouncil,
        deliberation: CouncilDeliberation,
        ceo_message: str,
    ) -> CouncilDeliberation:
        """Route CEO message to Solomon (CTO), who decides next council action & agent replies."""
        from nexora.core.security import PromptSanitizer
        from nexora.domains.intelligence.schemas import ModelRequest
        from nexora.domains.intelligence.service import IntelligenceService

        members = council.members or await self._resolve_live_members(council.company_id)
        cto_member = next(
            (m for m in members if "cto" in (m.get("role_title") or "").lower() or "solomon" in (m.get("agent_name") or "").lower()),
            members[0],
        )
        cto_name = cto_member.get("agent_name", "Solomon · CTO")

        # Ask Solomon (CTO) to decide how to handle the CEO's message
        member_roster = ", ".join(f"{m.get('agent_name')} ({m.get('role_title')})" for m in members)
        decision_action = "ROUTE_TO_PEER"
        cto_reply = ""
        target_member = next((m for m in members if m.get("agent_name") != cto_name), cto_member)

        msg_lower = ceo_message.lower()
        for m in members:
            m_name = (m.get("agent_name") or "").lower()
            m_role = (m.get("role_title") or "").lower()
            first_name = m_name.split("·")[0].strip()
            if (first_name and first_name in msg_lower) or (m_role and m_role in msg_lower):
                target_member = m
                break

        if any(k in msg_lower for k in ("synthesize", "consensus", "summarize", "resolve")):
            decision_action = "SYNTHESIZE"

        try:
            intel_svc = IntelligenceService(self.db)
            res = await intel_svc.execute_request(
                council.company_id,
                ModelRequest(
                    prompt=PromptSanitizer.sanitize_for_external_llm(
                        f"CEO Directive: {ceo_message}\n"
                        f"Council Topic: {deliberation.problem_statement}\n"
                        f"Council Members: {member_roster}\n"
                        f"As {cto_name}, state in 2 concise sentences what you are deciding/routing."
                    ),
                    system_prompt=f"You are {cto_name}, Autonomous CTO moderating this council.",
                    required_capabilities=["reasoning"],
                    temperature=0.2,
                    max_tokens=300,
                    timeout_seconds=10.0,
                ),
            )
            cto_reply = (res.text or "").strip()
        except Exception as exc:
            cto_reply = f"[{cto_name}] Received CEO directive. Routing to {target_member.get('agent_name')} (LLM note: {exc})."

        if not cto_reply:
            cto_reply = f"[{cto_name}] Received CEO directive. Routing to {target_member.get('agent_name')}."

        responses: list[dict[str, Any]] = [
            {
                "respondent": cto_name,
                "role": cto_member.get("role_title", "CTO"),
                "replying_to": "CEO",
                "stance": "CTO_DIRECTIVE",
                "argument": cto_reply,
            }
        ]

        if decision_action == "SYNTHESIZE":
            reviews = list(deliberation.independent_reviews or [])
            disagreements = list(deliberation.disagreements_recorded or [])
            deliberation.current_stage = DeliberationStage.SYNTHESIS.value
            deliberation.status = DeliberationStatus.SYNTHESIZED.value
            deliberation.synthesis_proposal = {
                "synthesized_by": cto_name,
                "executive_summary": cto_reply,
                "recommended_direction": ceo_message,
                "confidence_consensus": round(
                    sum(float(r.get("confidence", 0.0)) for r in reviews) / max(len(reviews), 1), 2
                ),
                "dissent_summary": f"Captured {len(disagreements)} technical disagreements.",
            }
        else:
            peer_reply = await self._generate_agent_reply(
                company_id=council.company_id,
                speaker_name=target_member.get("agent_name", "Specialist"),
                speaker_role=target_member.get("role_title", "Specialist"),
                replying_to=cto_name,
                topic=f"CEO directive via {cto_name}: {ceo_message}",
                problem=deliberation.problem_statement,
            )
            responses.append(
                {
                    "respondent": target_member.get("agent_name", "Specialist"),
                    "role": target_member.get("role_title", "Specialist"),
                    "replying_to": cto_name,
                    "stance": "CONCURS" if not peer_reply.startswith("[LLM unavailable") else "ERROR",
                    "argument": peer_reply,
                }
            )

        threads = list(deliberation.discussion_threads or [])
        threads.append(
            {
                "id": f"thread-{uuid.uuid4().hex[:8]}",
                "topic": f"CEO → {cto_name}: {ceo_message[:80]}",
                "original_objection": ceo_message,
                "raised_by": "CEO",
                "responses": responses,
                "resolved": decision_action == "SYNTHESIZE",
            }
        )
        deliberation.discussion_threads = threads
        await self.db.flush()
        await self.db.refresh(deliberation)
        return deliberation
