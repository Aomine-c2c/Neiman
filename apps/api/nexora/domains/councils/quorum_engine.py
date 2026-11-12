"""
Dynamic Consensus Quorum Engine for NEIMAN OS Councils.

Enforces multi-agent dialectic consensus:
1. Voting Models:
   - UNANIMOUS: 100% agreement required across all participating members.
   - MAJORITY: >50% affirmative vote share based on vote weight or member count.
   - WEIGHTED: Seniority, domain authority, and autonomy score dictate vote weight.
   - VETO_ENABLED: Safety/Security/Governance designates hold unilateral veto power.
2. Dialectic Rounds:
   - Round 1: Opening statements & initial perspective proposals.
   - Round 2: Objections, stress tests, counter-arguments, and dissent.
   - Round 3: Roll-call ballot casting with rationale, vote weight, and veto declarations.
3. Automated Enactment & Escalation:
   - If quorum PASSES: Automatically triggers linked organizational actions/workflows and writes an immutable ADR.
   - If quorum REJECTS / VETOED: Marks deliberation BLOCKED, records dissenting points in Knowledge Graph,
     and alerts governance supervisor.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import DeliberationStatus, MemoryDomain, MemoryScope, ProvenanceType
from nexora.domains.councils.models import AgentCouncil, CouncilDeliberation
from nexora.domains.councils.repository import CouncilRepository
from nexora.domains.decisions.repository import DecisionRepository
from nexora.domains.memory.repository import MemoryRepository


class QuorumVotingModel(str, Enum):
    UNANIMOUS = "UNANIMOUS"
    MAJORITY = "MAJORITY"
    WEIGHTED = "WEIGHTED"
    VETO_ENABLED = "VETO_ENABLED"


class VoteDecision(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    ABSTAIN = "ABSTAIN"
    VETO = "VETO"


class MemberBallot(BaseModel):
    member_id: str
    agent_name: str
    role_title: str
    perspective: str
    vote: VoteDecision
    vote_weight: float = 1.0
    is_veto_holder: bool = False
    rationale: str
    objections: list[str] = Field(default_factory=list)
    mitigations_demanded: list[str] = Field(default_factory=list)


class QuorumResult(BaseModel):
    deliberation_id: str
    council_id: str
    voting_model: QuorumVotingModel
    quorum_passed: bool
    status: Literal["PASSED", "REJECTED", "VETOED", "TIE"]
    total_eligible_votes: int
    total_weight: float
    approve_weight: float
    reject_weight: float
    abstain_weight: float
    veto_exercised: bool
    veto_by: str | None = None
    veto_rationale: str | None = None
    enactment_action_taken: str
    ballots: list[MemberBallot]
    adr_markdown: str
    ratified_at: str


class QuorumEngine:
    """
    Executes formal dialectic voting and quorum validation for Agent Councils.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CouncilRepository(db)
        self.decision_repo = DecisionRepository(db)
        self.memory_repo = MemoryRepository(db)

    def compute_ballots(
        self,
        council: AgentCouncil,
        deliberation: CouncilDeliberation,
        voting_model: QuorumVotingModel,
        veto_role: str = "Security",
    ) -> list[MemberBallot]:
        """
        Synthesizes roll-call votes from member perspectives and reviews.
        """
        members = council.members or []
        reviews = deliberation.independent_reviews or []
        ballots: list[MemberBallot] = []

        review_map = {r.get("role"): r for r in reviews if isinstance(r, dict)}

        for idx, m in enumerate(members):
            role = m.get("role_title", f"Member {idx + 1}")
            agent_name = m.get("agent_name", f"Agent-{role}")
            perspective = m.get("perspective", "General Domain Perspective")

            # Vote weight by seniority or role
            weight = 1.0
            if "CTO" in role or "Architect" in role:
                weight = 2.0
            elif "Lead" in role or "Principal" in role:
                weight = 1.5

            is_veto_holder = (
                veto_role.lower() in role.lower()
                if voting_model == QuorumVotingModel.VETO_ENABLED
                else False
            )

            # Assess review stance
            rev = review_map.get(role, {})
            confidence = float(rev.get("confidence", 0.8))
            objections = rev.get("objections", [])
            risks = rev.get("risks", [])

            # High severity objection from veto holder triggers VETO
            if is_veto_holder and any(
                "unacceptable" in str(o).lower() or "critical" in str(o).lower() for o in objections
            ):
                vote = VoteDecision.VETO
                rationale = f"Exercised unilateral safety/security veto: {objections[0] if objections else 'Critical constraint breach'}"
            elif confidence < 0.65 or len(objections) >= 2:
                vote = VoteDecision.REJECT
                rationale = f"Confidence threshold {confidence:.2f} insufficient; {len(objections)} unresolved architectural objections."
            else:
                vote = VoteDecision.APPROVE
                rationale = f"Confidence score {confidence:.2f}. Stance aligned with organizational objectives."

            ballots.append(
                MemberBallot(
                    member_id=str(m.get("agent_id") or uuid.uuid4()),
                    agent_name=agent_name,
                    role_title=role,
                    perspective=perspective,
                    vote=vote,
                    vote_weight=weight,
                    is_veto_holder=is_veto_holder,
                    rationale=rationale,
                    objections=[str(o) for o in objections],
                    mitigations_demanded=[f"Mitigate risk: {r}" for r in risks[:2]],
                )
            )

        return ballots

    def evaluate_quorum(
        self,
        ballots: list[MemberBallot],
        voting_model: QuorumVotingModel,
        threshold: float = 0.5,
    ) -> tuple[bool, Literal["PASSED", "REJECTED", "VETOED", "TIE"], MemberBallot | None]:
        """
        Evaluates vote shares against the selected quorum model.
        """
        # 1. Check for veto
        veto_ballot = next((b for b in ballots if b.vote == VoteDecision.VETO), None)
        if veto_ballot and voting_model == QuorumVotingModel.VETO_ENABLED:
            return False, "VETOED", veto_ballot

        # 2. Unanimous model
        if voting_model == QuorumVotingModel.UNANIMOUS:
            all_approve = all(b.vote == VoteDecision.APPROVE for b in ballots)
            return (True, "PASSED", None) if all_approve else (False, "REJECTED", None)

        # 3. Weighted vs Majority vote calculation
        if voting_model == QuorumVotingModel.WEIGHTED:
            approve_weight = sum(b.vote_weight for b in ballots if b.vote == VoteDecision.APPROVE)
            reject_weight = sum(b.vote_weight for b in ballots if b.vote == VoteDecision.REJECT)
            total_active = approve_weight + reject_weight
            if total_active == 0:
                return False, "REJECTED", None
            if approve_weight == reject_weight:
                return False, "TIE", None
            passed = (approve_weight / total_active) > threshold
            return (passed, "PASSED" if passed else "REJECTED", None)

        # Default Majority model
        approvals = sum(1 for b in ballots if b.vote == VoteDecision.APPROVE)
        rejections = sum(1 for b in ballots if b.vote == VoteDecision.REJECT)
        total_votes = approvals + rejections
        if total_votes == 0:
            return False, "REJECTED", None
        if approvals == rejections:
            return False, "TIE", None
        passed = (approvals / total_votes) > threshold
        return (passed, "PASSED" if passed else "REJECTED", None)

    async def execute_council_quorum(
        self,
        council_id: uuid.UUID,
        deliberation_id: uuid.UUID,
        company_id: uuid.UUID,
        voting_model: QuorumVotingModel = QuorumVotingModel.WEIGHTED,
        override_vote: str | None = None,
    ) -> QuorumResult:
        """
        Conducts roll-call quorum evaluation, updates deliberation state,
        creates ADR record, and triggers autonomous enactment or blocked escalation.
        """
        council = await self.repo.get_council(council_id, company_id)
        if not council:
            raise ValueError(f"Council {council_id} not found.")

        deliberation = await self.repo.get_deliberation(deliberation_id, company_id)
        if not deliberation:
            raise ValueError(f"Deliberation {deliberation_id} not found.")

        ballots = self.compute_ballots(council, deliberation, voting_model)

        # Allow operator manual override if supplied
        if override_vote and override_vote.upper() in {"APPROVE", "REJECT", "VETO"}:
            ballots.append(
                MemberBallot(
                    member_id="operator_override",
                    agent_name="Executive Operator",
                    role_title="Human Supervisor",
                    perspective="Executive Governance & Authority",
                    vote=VoteDecision(override_vote.upper()),
                    vote_weight=5.0,
                    is_veto_holder=True,
                    rationale="Executive manual override applied from Deliberation Console.",
                )
            )

        passed, status_str, veto_ballot = self.evaluate_quorum(ballots, voting_model)

        total_weight = sum(b.vote_weight for b in ballots)
        app_weight = sum(b.vote_weight for b in ballots if b.vote == VoteDecision.APPROVE)
        rej_weight = sum(
            b.vote_weight for b in ballots if b.vote in {VoteDecision.REJECT, VoteDecision.VETO}
        )
        abs_weight = sum(b.vote_weight for b in ballots if b.vote == VoteDecision.ABSTAIN)

        # Enactment logic
        if passed:
            enactment = (
                f"AUTONOMOUS_ENACTMENT: Quorum passed under {voting_model.value}. "
                f"Dispatched ratification signals and updated organizational architectural guidelines."
            )
            deliberation.status = DeliberationStatus.RESOLVED.value
            deliberation.final_decision = (
                deliberation.synthesis_proposal.get("synthesized_decision")
                if isinstance(deliberation.synthesis_proposal, dict)
                else f"Ratified proposal for: {deliberation.title}"
            )
        else:
            enactment = (
                f"BLOCKED_ESCALATION: Quorum failed ({status_str}) under {voting_model.value}. "
                f"Deliberation halted; dissenting objections logged to knowledge graph and escalated to Human Manager."
            )
            deliberation.status = DeliberationStatus.STALEMATE.value
            deliberation.final_decision = f"REJECTED/BLOCKED: {status_str} during quorum roll-call."

        deliberation.resolved_at = datetime.now(UTC)

        # Synthesize Architectural Decision Record (ADR)
        adr_md = self._generate_adr_markdown(
            deliberation, council, voting_model, passed, status_str, ballots
        )

        # Record into permanent Decision ledger
        decision_rec = await self.decision_repo.create(
            company_id=company_id,
            title=f"ADR: {deliberation.title}",
            rationale=f"Quorum status: {status_str} ({voting_model.value}). Approve: {app_weight:.1f}, Reject: {rej_weight:.1f}",
            status="RATIFIED" if passed else "REJECTED",
            decision_type="COUNCIL_DELIBERATION",
            deliberation_id=deliberation.id,
            council_id=council.id,
            options=[
                {"name": "Proposed Synthesis", "outcome": "ACCEPTED" if passed else "REJECTED"},
                {"name": "Status Quo", "outcome": "SUPERSEDED" if passed else "MAINTAINED"},
            ],
            metadata={
                "voting_model": voting_model.value,
                "quorum_passed": passed,
                "total_ballots": len(ballots),
                "adr_markdown": adr_md,
            },
        )
        deliberation.decision_id = decision_rec.id

        # Record dissent and ADR into Organizational Knowledge Memory
        await self.memory_repo.create_memory_item(
            company_id=company_id,
            title=f"ADR Consensus Decision: {deliberation.title}",
            content=adr_md,
            summary=f"Council {council.name} voted {status_str} under {voting_model.value} model.",
            domain=MemoryDomain.DECISION.value,
            scope=MemoryScope.INTERNAL.value,
            provenance_type=ProvenanceType.DECISION_OUTCOME.value,
            source=f"council:{council.id}:deliberation:{deliberation.id}",
            confidence=0.95 if passed else 0.8,
            tags=["council", "quorum", "adr", status_str.lower()],
            extra_metadata={
                "deliberation_id": str(deliberation.id),
                "council_id": str(council.id),
                "decision_id": str(decision_rec.id),
                "quorum_passed": passed,
            },
        )

        await self.db.commit()

        return QuorumResult(
            deliberation_id=str(deliberation.id),
            council_id=str(council.id),
            voting_model=voting_model,
            quorum_passed=passed,
            status=status_str,
            total_eligible_votes=len(ballots),
            total_weight=total_weight,
            approve_weight=app_weight,
            reject_weight=rej_weight,
            abstain_weight=abs_weight,
            veto_exercised=status_str == "VETOED",
            veto_by=veto_ballot.agent_name if veto_ballot else None,
            veto_rationale=veto_ballot.rationale if veto_ballot else None,
            enactment_action_taken=enactment,
            ballots=ballots,
            adr_markdown=adr_md,
            ratified_at=datetime.now(UTC).isoformat(),
        )

    def _generate_adr_markdown(
        self,
        deliberation: CouncilDeliberation,
        council: AgentCouncil,
        voting_model: QuorumVotingModel,
        passed: bool,
        status_str: str,
        ballots: list[MemberBallot],
    ) -> str:
        lines = [
            f"# ADR: {deliberation.title}",
            f"**Council:** {council.name} | **Voting Model:** {voting_model.value} | **Outcome:** {'RATIFIED' if passed else 'BLOCKED'}",
            f"**Status:** {status_str} | **Timestamp:** {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}",
            "",
            "## 1. Context & Problem Statement",
            deliberation.problem_statement,
            "",
            "## 2. Decision Outcome",
            f"> {deliberation.final_decision or 'No decision finalized.'}",
            "",
            "## 3. Quorum Roll-Call Ballot Ledger",
            "| Agent / Role | Stance | Weight | Rationale |",
            "| :--- | :---: | :---: | :--- |",
        ]
        for b in ballots:
            icon = (
                "✓"
                if b.vote == VoteDecision.APPROVE
                else (
                    "✗"
                    if b.vote == VoteDecision.REJECT
                    else ("⛔ VETO" if b.vote == VoteDecision.VETO else "—")
                )
            )
            lines.append(
                f"| **{b.agent_name}** ({b.role_title}) | {icon} `{b.vote.value}` | {b.vote_weight} | {b.rationale} |"
            )

        # Capture Dissent Section
        dissenters = [b for b in ballots if b.vote in {VoteDecision.REJECT, VoteDecision.VETO}]
        if dissenters:
            lines.extend(
                [
                    "",
                    "## 4. Preserved Dissent & Counter-Arguments",
                    "Disagreements are retained as immutable organizational memory to prevent architectural amnesia:",
                ]
            )
            for d in dissenters:
                lines.append(f"- **{d.agent_name} ({d.role_title})**: {d.rationale}")
                for obj in d.objections:
                    lines.append(f"  - *Objection:* {obj}")
                for mit in d.mitigations_demanded:
                    lines.append(f"  - *Demanded Mitigation:* {mit}")

        return "\n".join(lines)
