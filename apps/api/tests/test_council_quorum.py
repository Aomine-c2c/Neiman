from unittest.mock import MagicMock

from nexora.domains.councils.models import AgentCouncil, CouncilDeliberation
from nexora.domains.councils.quorum_engine import (
    MemberBallot,
    QuorumEngine,
    QuorumVotingModel,
    VoteDecision,
)


def make_ballot(
    agent_id: str,
    role: str,
    vote: VoteDecision,
    weight: float = 1.0,
    is_veto_holder: bool = False,
    objections: list[str] | None = None,
) -> MemberBallot:
    return MemberBallot(
        member_id=agent_id,
        agent_name=f"Agent-{role}",
        role_title=role,
        perspective=f"Perspective of {role}",
        vote=vote,
        vote_weight=weight,
        is_veto_holder=is_veto_holder,
        rationale=f"Voted {vote.value}",
        objections=objections or [],
        mitigations_demanded=[],
    )


def test_quorum_majority_passed():
    engine = QuorumEngine(MagicMock())
    ballots = [
        make_ballot("a1", "Architect", VoteDecision.APPROVE, 1.0),
        make_ballot("a2", "Security", VoteDecision.APPROVE, 1.0),
        make_ballot("a3", "QA", VoteDecision.REJECT, 1.0),
    ]
    passed, status, veto_ballot = engine.evaluate_quorum(
        ballots=ballots,
        voting_model=QuorumVotingModel.MAJORITY,
        threshold=0.5,
    )
    assert passed is True
    assert status == "PASSED"
    assert veto_ballot is None


def test_quorum_unanimous_rejected():
    engine = QuorumEngine(MagicMock())
    ballots = [
        make_ballot("a1", "Architect", VoteDecision.APPROVE, 1.0),
        make_ballot("a2", "Security", VoteDecision.REJECT, 1.0),
    ]
    passed, status, veto_ballot = engine.evaluate_quorum(
        ballots=ballots,
        voting_model=QuorumVotingModel.UNANIMOUS,
    )
    assert passed is False
    assert status == "REJECTED"


def test_quorum_veto_enabled():
    engine = QuorumEngine(MagicMock())
    ballots = [
        make_ballot("a1", "Lead Dev", VoteDecision.APPROVE, 1.5),
        make_ballot("a2", "Security Lead", VoteDecision.VETO, 2.0, is_veto_holder=True),
        make_ballot("a3", "Product", VoteDecision.APPROVE, 1.0),
    ]
    passed, status, veto_ballot = engine.evaluate_quorum(
        ballots=ballots,
        voting_model=QuorumVotingModel.VETO_ENABLED,
    )
    assert passed is False
    assert status == "VETOED"
    assert veto_ballot is not None
    assert veto_ballot.member_id == "a2"


def test_quorum_weighted():
    engine = QuorumEngine(MagicMock())
    # 2 devs reject (1.0 + 1.0 = 2.0 weight)
    # 1 architect approves (2.0) + 1 lead approves (1.5) = 3.5 weight
    ballots = [
        make_ballot("d1", "Developer", VoteDecision.REJECT, 1.0),
        make_ballot("d2", "Developer", VoteDecision.REJECT, 1.0),
        make_ballot("arch", "Chief Architect", VoteDecision.APPROVE, 2.0),
        make_ballot("lead", "Engineering Lead", VoteDecision.APPROVE, 1.5),
    ]
    passed, status, veto_ballot = engine.evaluate_quorum(
        ballots=ballots,
        voting_model=QuorumVotingModel.WEIGHTED,
        threshold=0.5,
    )
    assert passed is True
    assert status == "PASSED"


def test_compute_ballots_from_deliberation():
    engine = QuorumEngine(MagicMock())
    council = AgentCouncil(
        name="Architecture Council",
        charter="Review systemic architecture",
        members=[
            {"agent_id": "a-sec", "role_title": "Security Lead", "perspective": "AppSec"},
            {
                "agent_id": "a-arch",
                "role_title": "Principal Architect",
                "perspective": "Scalability",
            },
        ],
    )
    deliberation = CouncilDeliberation(
        title="Event Bus Migration",
        problem_statement="Kafka vs RabbitMQ",
        independent_reviews=[
            {
                "role": "Security Lead",
                "confidence": 0.5,
                "objections": [
                    "Critical CVE vulnerability in legacy client",
                    "Unacceptable data leak potential",
                ],
            },
            {
                "role": "Principal Architect",
                "confidence": 0.9,
                "objections": [],
            },
        ],
    )

    # Under VETO_ENABLED model, Security Lead should trigger VETO due to "unacceptable" objection
    ballots = engine.compute_ballots(council, deliberation, QuorumVotingModel.VETO_ENABLED)
    assert len(ballots) == 2
    sec_ballot = next(b for b in ballots if b.member_id == "a-sec")
    assert sec_ballot.vote == VoteDecision.VETO
    assert sec_ballot.is_veto_holder is True

    # Under MAJORITY model, Security Lead should be REJECT (confidence < 0.65)
    ballots_maj = engine.compute_ballots(council, deliberation, QuorumVotingModel.MAJORITY)
    sec_ballot_maj = next(b for b in ballots_maj if b.member_id == "a-sec")
    assert sec_ballot_maj.vote == VoteDecision.REJECT
