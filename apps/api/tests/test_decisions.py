"""Tests for the Decisions domain."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDecisions:
    async def test_create_decision(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/decisions",
            json={
                "title": "Choose our primary LLM provider",
                "problem": "We need to select which LLM provider to use for production agents.",
                "proposals": [
                    {
                        "id": "p1",
                        "title": "OpenAI GPT-4o",
                        "description": "Best quality",
                        "pros": ["Best reasoning"],
                        "cons": ["Expensive"],
                    },
                    {
                        "id": "p2",
                        "title": "Anthropic Claude",
                        "description": "Safety-focused",
                        "pros": ["Safe"],
                        "cons": ["API limits"],
                    },
                ],
                "evidence": [
                    {
                        "id": "e1",
                        "type": "research",
                        "source": "Internal benchmark",
                        "summary": "GPT-4o outperformed Claude on our test cases",
                    },
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Choose our primary LLM provider"
        assert data["status"] == "OPEN"
        assert len(data["proposals"]) == 2

    async def test_resolve_decision(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/decisions",
            json={
                "title": "Select stack",
                "problem": "Which tech stack should we use for the backend?",
            },
            headers=auth_headers,
        )
        decision_id = create.json()["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/decisions/{decision_id}/resolve",
            json={
                "decision": "We will use FastAPI with SQLAlchemy 2.0 and PostgreSQL.",
                "rationale": "FastAPI is async-first and excellent for AI workloads.",
                "expected_outcome": "A production-ready API that can handle 1000+ RPS.",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "DECIDED"
        assert data["decision"] == "We will use FastAPI with SQLAlchemy 2.0 and PostgreSQL."
        assert data["decided_by_id"] is not None

    async def test_record_outcome(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/decisions",
            json={"title": "Outcome test", "problem": "Test problem for outcome recording"},
            headers=auth_headers,
        )
        decision_id = create.json()["id"]
        await client.post(
            f"/api/v1/companies/{company_id}/decisions/{decision_id}/resolve",
            json={"decision": "Go with option A", "rationale": "Best fit for our needs"},
            headers=auth_headers,
        )
        outcome_resp = await client.post(
            f"/api/v1/companies/{company_id}/decisions/{decision_id}/outcome",
            json={"actual_outcome": "Option A worked perfectly, 30% productivity boost."},
            headers=auth_headers,
        )
        assert outcome_resp.status_code == 200
        assert outcome_resp.json()["status"] == "EVALUATED"
        assert "productivity boost" in outcome_resp.json()["actual_outcome"]

    async def test_cannot_update_decided_decision(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/decisions",
            json={
                "title": "Immutable decision",
                "problem": "A decision that should be immutable once made.",
            },
            headers=auth_headers,
        )
        decision_id = create.json()["id"]
        await client.post(
            f"/api/v1/companies/{company_id}/decisions/{decision_id}/resolve",
            json={"decision": "Final choice", "rationale": "It was the best option."},
            headers=auth_headers,
        )
        resp = await client.patch(
            f"/api/v1/companies/{company_id}/decisions/{decision_id}",
            json={"problem": "Trying to change the problem after decision"},
            headers=auth_headers,
        )
        assert resp.status_code == 400
