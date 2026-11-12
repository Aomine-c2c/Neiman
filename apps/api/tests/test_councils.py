"""
Comprehensive Pytest Suite for NEIMAN Agent Councils & Organizational Deliberation.

Verifies:
1. Assembly of Agent Councils (Permanent & Temporary) with specialized participant perspectives:
   - Architecture Council: CTO, Architect, Backend Engineer, Security Engineer, QA Engineer.
   - Assigning heterogeneous model providers (Anthropic Claude, Google Gemini, OpenAI).
2. Execution of Full Deliberation Pipeline:
   - PROPOSAL: Problem framing & initial architectural hypothesis
   - INDEPENDENT REVIEW: Each participant independently evaluates:
     * proposal
     * evidence
     * risks
     * assumptions
     * confidence score
     * objections
   - OBJECTIONS: Explicit extraction and compilation of domain-specific constraints
   - DISCUSSION: Multi-round debate addressing objections
   - SYNTHESIS: Synthesis agent produces a balanced decision proposal
   - DISSENT RECORDING: Preserving disagreements as permanent organizational knowledge
     (Disagreement does not mean one model is wrong; both perspectives are preserved).
3. Decision Ratification & Storage:
   - DECISION: Official ratification
   - RECORD: Stored in Decision domain and Organizational Memory domain.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAgentCouncilsAndDeliberation:
    async def test_full_agent_council_deliberation_lifecycle(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # 1. Assemble Architecture Council with heterogeneous providers
        council_members = [
            {
                "agent_name": "Chief Technology Agent",
                "role_title": "CTO",
                "perspective": "Strategic Viability & Operational Alignment",
                "model_provider": "openai",
                "model_identifier": "gpt-4o",
            },
            {
                "agent_name": "Chief Systems Architect",
                "role_title": "Architect",
                "perspective": "Distributed Systems Scalability & Modularity",
                "model_provider": "anthropic",
                "model_identifier": "claude-3-5-sonnet",
            },
            {
                "agent_name": "Principal Backend Engineer",
                "role_title": "Backend Engineer",
                "perspective": "High-Throughput IO & Resource Footprint",
                "model_provider": "google",
                "model_identifier": "gemini-2.5-pro",
            },
            {
                "agent_name": "Cybersecurity Principal",
                "role_title": "Security Engineer",
                "perspective": "Zero-Trust Isolation & Secret Protection",
                "model_provider": "anthropic",
                "model_identifier": "claude-3-5-haiku",
            },
            {
                "agent_name": "QA Lead Agent",
                "role_title": "QA Engineer",
                "perspective": "Chaos Engineering & Contract Testability",
                "model_provider": "openai",
                "model_identifier": "gpt-4o-mini",
            },
        ]

        create_council_resp = await client.post(
            f"/api/v1/companies/{company_id}/councils",
            json={
                "name": "Architecture Council",
                "charter": "Govern foundational distributed system topology and engineering tradeoffs.",
                "council_type": "PERMANENT",
                "members": council_members,
            },
            headers=auth_headers,
        )
        assert create_council_resp.status_code == 201
        council_data = create_council_resp.json()
        council_id = council_data["id"]
        assert council_data["name"] == "Architecture Council"
        assert len(council_data["members"]) == 5

        # 2. Convene Deliberation on a High-Stakes Technical Problem
        problem = (
            "Determine the core real-time message bus architecture: Evaluate Event-Driven Redis Pub/Sub "
            "vs. Kafka Event Streams vs. gRPC Synchronous Direct Federation for inter-agent communication."
        )

        delib_resp = await client.post(
            f"/api/v1/companies/{company_id}/councils/{council_id}/deliberations",
            json={
                "title": "Inter-Agent Core Communication Topology",
                "problem_statement": problem,
                "context_data": {
                    "peak_throughput": "100k messages/sec",
                    "latency_budget": "50ms",
                    "cloud_provider": "multi-cloud",
                },
                "auto_execute_deliberation": True,
            },
            headers=auth_headers,
        )
        assert delib_resp.status_code == 201
        delib = delib_resp.json()
        delib_id = delib["id"]

        # 3. Verify Deliberation Stages Completed:
        # PROPOSAL -> INDEPENDENT REVIEW -> OBJECTIONS -> DISCUSSION -> SYNTHESIS
        assert delib["current_stage"] == "SYNTHESIS"
        assert delib["status"] == "SYNTHESIZED"

        # Check Independent Reviews (Evidence, Risks, Assumptions, Confidence, Objections)
        reviews = delib["independent_reviews"]
        assert len(reviews) == 5
        roles_reviewed = {r["role_title"] for r in reviews}
        assert "CTO" in roles_reviewed
        assert "Architect" in roles_reviewed
        assert "Backend Engineer" in roles_reviewed
        assert "Security Engineer" in roles_reviewed
        assert "QA Engineer" in roles_reviewed

        # Verify review properties
        for r in reviews:
            assert len(r["proposal"]) > 0
            assert len(r["evidence"]) > 0
            assert len(r["risks"]) > 0
            assert len(r["assumptions"]) > 0
            assert 0.0 <= r["confidence"] <= 1.0

        # Check Objections compiled
        objections = delib["objections"]
        assert len(objections) >= 3

        # Check Discussion Threads
        threads = delib["discussion_threads"]
        assert len(threads) >= 1

        # Check Disagreements preserved as valuable organizational knowledge
        disagreements = delib["disagreements_recorded"]
        assert len(disagreements) >= 1
        d0 = disagreements[0]
        assert "dissenting_agents" in d0
        assert "dissenting_models" in d0
        assert "argument" in d0
        assert "counter_argument" in d0

        # Check Synthesis Proposal produced by synthesis agent
        synthesis = delib["synthesis_proposal"]
        assert synthesis is not None
        assert "recommended_direction" in synthesis
        assert "confidence_consensus" in synthesis

        # 4. Ratify Deliberation Decision and Record in Memory
        ratify_resp = await client.post(
            f"/api/v1/companies/{company_id}/councils/deliberations/{delib_id}/decide",
            json={
                "decision": "Adopt Event-Driven Architecture with Transactional Outbox and mTLS",
                "rationale": "Balances throughput requirements of 100k msg/s while fulfilling zero-trust isolation.",
                "record_in_memory": True,
            },
            headers=auth_headers,
        )
        assert ratify_resp.status_code == 200
        ratified = ratify_resp.json()
        assert ratified["status"] == "RESOLVED"
        assert ratified["current_stage"] == "RECORDED"
        assert ratified["final_decision"] is not None
        assert ratified["decision_id"] is not None

        # 5. Verify Decision Exists in Official Decisions Domain
        dec_resp = await client.get(
            f"/api/v1/companies/{company_id}/decisions/{ratified['decision_id']}",
            headers=auth_headers,
        )
        assert dec_resp.status_code == 200
        dec_data = dec_resp.json()
        assert "Adopt Event-Driven Architecture" in dec_data["decision"]
        assert len(dec_data["participants"]) >= 5

        # 6. Verify Disagreements Are Stored in Organizational Memory
        mem_resp = await client.get(
            f"/api/v1/companies/{company_id}/memory/search?q=Dissent",
            headers=auth_headers,
        )
        assert mem_resp.status_code == 200
        memories = mem_resp.json()
        assert len(memories) >= 1
        assert "council" in memories[0]["tags"]

        # 7. Verify List Councils and Deliberations API
        councils_list = await client.get(
            f"/api/v1/companies/{company_id}/councils",
            headers=auth_headers,
        )
        assert councils_list.status_code == 200
        assert len(councils_list.json()) >= 1

        delibs_list = await client.get(
            f"/api/v1/companies/{company_id}/councils/{council_id}/deliberations",
            headers=auth_headers,
        )
        assert delibs_list.status_code == 200
        assert len(delibs_list.json()) >= 1
