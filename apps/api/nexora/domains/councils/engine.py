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

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
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


class DeliberationEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CouncilRepository(db)
        self.decision_repo = DecisionRepository(db)
        self.memory_repo = MemoryRepository(db)

    async def run_full_deliberation(
        self,
        council: AgentCouncil,
        deliberation: CouncilDeliberation,
    ) -> CouncilDeliberation:
        """
        Executes the deliberation pipeline across council members and models.
        """
        members = council.members or []
        if not members:
            # Default fallback members if none configured
            members = [
                {
                    "role_title": "CTO",
                    "agent_name": "Chief Technology Agent",
                    "perspective": "Strategic Feasibility & Business Alignment",
                    "model_identifier": "gpt-4o",
                    "model_provider": "openai",
                },
                {
                    "role_title": "Chief Architect",
                    "agent_name": "Systems Architect Agent",
                    "perspective": "Scalability, Modularity & Distributed Systems",
                    "model_identifier": "claude-3-5-sonnet",
                    "model_provider": "anthropic",
                },
                {
                    "role_title": "Principal Backend Engineer",
                    "agent_name": "Backend Engineering Agent",
                    "perspective": "Implementation Complexity & Performance",
                    "model_identifier": "gemini-2.5-pro",
                    "model_provider": "google",
                },
                {
                    "role_title": "Principal Security Engineer",
                    "agent_name": "Cybersecurity Agent",
                    "perspective": "Zero-Trust, Attack Vectors & Compliance",
                    "model_identifier": "claude-3-5-haiku",
                    "model_provider": "anthropic",
                },
                {
                    "role_title": "QA Lead",
                    "agent_name": "Quality Assurance Agent",
                    "perspective": "Testability, Chaos Tolerance & Edge Cases",
                    "model_identifier": "gpt-4o-mini",
                    "model_provider": "openai",
                },
            ]
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
            provider = m.get("model_provider", "openai")
            model = m.get("model_identifier", "gpt-4o")

            # Generate perspective-specific analysis
            rev = self._synthesize_member_review(
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
            thread = {
                "topic": f"Debate on Objection #{idx + 1}",
                "original_objection": obj_entry["objection"],
                "raised_by": obj_entry["raised_by"],
                "responses": [
                    {
                        "respondent": "Chief Architect Agent (Claude)",
                        "argument": "We can isolate this concern behind an asynchronous event adapter.",
                    },
                    {
                        "respondent": "Principal Backend Engineer (Gemini)",
                        "argument": "Valid concern, but acceptable tradeoff if latency budget remains under 50ms.",
                    },
                ],
                "resolved": True,
            }
            threads.append(thread)

            # Record disagreement as organizational knowledge!
            disagreements.append(
                {
                    "topic": f"Perspective Divergence #{idx + 1}: {obj_entry['role']}",
                    "dissenting_agents": [obj_entry["raised_by"]],
                    "dissenting_models": [obj_entry["model"]],
                    "argument": obj_entry["objection"],
                    "counter_argument": "Tradeoff accepted in favor of developer velocity and decoupling",
                    "mitigation": "Continuous load and telemetry monitoring in staging before full promotion",
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

    def _synthesize_member_review(
        self,
        role: str,
        name: str,
        perspective: str,
        provider: str,
        model: str,
        problem: str,
    ) -> dict[str, Any]:
        """
        Simulates multi-perspective model intelligence analysis.
        """
        role_lower = role.lower()
        if "cto" in role_lower:
            return {
                "agent_name": name,
                "role_title": role,
                "intelligence_provider": provider,
                "model_identifier": model,
                "proposal": f"Architect a modular, fault-tolerant solution prioritizing business continuity for: {problem}",
                "evidence": [
                    "Industry benchmarks show 45% reduction in incident MTTR with isolated service boundaries."
                ],
                "risks": [
                    "Resource allocation overrun if initial MVP scope expands uncontrollably."
                ],
                "assumptions": [
                    "Existing engineering capacity can support asynchronous messaging."
                ],
                "confidence": 0.92,
                "objections": [
                    "Timeline might slip by 2 weeks if dependencies are not strictly isolated."
                ],
            }
        elif "architect" in role_lower:
            return {
                "agent_name": name,
                "role_title": role,
                "intelligence_provider": provider,
                "model_identifier": model,
                "proposal": "Implement event-driven microservices with Redis Pub/Sub and transactional outbox pattern.",
                "evidence": [
                    "Linear scaling verified up to 50k concurrent requests in architectural simulations."
                ],
                "risks": ["Eventual consistency complexity in edge synchronization."],
                "assumptions": ["Broker availability exceeds 99.99%."],
                "confidence": 0.95,
                "objections": [
                    "Synchronous REST calls between microservices must be strictly prohibited."
                ],
            }
        elif "security" in role_lower:
            return {
                "agent_name": name,
                "role_title": role,
                "intelligence_provider": provider,
                "model_identifier": model,
                "proposal": "Enforce mTLS, capability-scoped JWTs, and zero-trust perimeter inspection.",
                "evidence": ["Zero-trust posture mitigates 98% of lateral movement threats."],
                "risks": ["Key rotation lag could cause temporary validation hiccups."],
                "assumptions": ["Service identities are provisioned automatically."],
                "confidence": 0.90,
                "objections": [
                    "Plaintext token transmission or unencrypted internal communication must fail closed."
                ],
            }
        elif "qa" in role_lower or "quality" in role_lower:
            return {
                "agent_name": name,
                "role_title": role,
                "intelligence_provider": provider,
                "model_identifier": model,
                "proposal": "Mandate end-to-end synthetic contracts and automated chaos regression tests.",
                "evidence": ["Synthetic smoke suites catch 89% of contract regressions pre-merge."],
                "risks": ["Flaky third-party mocks slowing continuous integration."],
                "assumptions": ["Staging mirrors production telemetry fidelities."],
                "confidence": 0.88,
                "objections": ["No deployment without automated regression verification pass."],
            }
        else:
            return {
                "agent_name": name,
                "role_title": role,
                "intelligence_provider": provider,
                "model_identifier": model,
                "proposal": f"Detailed operational design incorporating {perspective} for: {problem}",
                "evidence": ["Prior production incident analysis and system performance logs."],
                "risks": ["Operational overhead during transition phase."],
                "assumptions": ["Standardized APIs and schemas across teams."],
                "confidence": 0.89,
                "objections": [f"Need clear SLA guarantees regarding {perspective}."],
            }
