"""Tests for the Policies domain."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestPolicies:
    async def test_create_policy(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/policies",
            json={
                "name": "Data Retention Policy",
                "scope": "COMPANY",
                "enforcement_level": "HARD",
                "rules": [
                    {
                        "id": "r1",
                        "name": "No PII in logs",
                        "condition": "Agent writes to logs",
                        "action": "Strip PII fields before writing",
                        "priority": 10,
                    },
                    {
                        "id": "r2",
                        "name": "7-year data retention",
                        "condition": "Data older than 7 years",
                        "action": "Archive or delete",
                        "priority": 1,
                    },
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Data Retention Policy"
        assert data["enforcement_level"] == "HARD"
        assert data["version"] == 1
        assert len(data["rules"]) == 2

    async def test_update_policy_increments_version(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/policies",
            json={
                "name": "Versioned Policy",
                "rules": [{"id": "r1", "name": "Rule 1", "condition": "test", "action": "do it"}],
            },
            headers=auth_headers,
        )
        policy_id = create.json()["id"]
        assert create.json()["version"] == 1

        update = await client.patch(
            f"/api/v1/companies/{company_id}/policies/{policy_id}",
            json={
                "rules": [
                    {
                        "id": "r1",
                        "name": "Updated Rule",
                        "condition": "new test",
                        "action": "do it better",
                    }
                ]
            },
            headers=auth_headers,
        )
        assert update.status_code == 200
        assert update.json()["version"] == 2

    async def test_list_policies(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await client.post(
            f"/api/v1/companies/{company_id}/policies",
            json={"name": "Policy A"},
            headers=auth_headers,
        )
        await client.post(
            f"/api/v1/companies/{company_id}/policies",
            json={"name": "Policy B"},
            headers=auth_headers,
        )
        resp = await client.get(f"/api/v1/companies/{company_id}/policies", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_policy_requires_admin(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Register a MEMBER user
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "member@example.com",
                "username": "member99",
                "password": "TestPass123!",
            },
        )
        member_resp = await client.post(
            "/api/v1/auth/login", json={"email": "member@example.com", "password": "TestPass123!"}
        )
        member_token = member_resp.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}
        member_id = (await client.get("/api/v1/auth/me", headers=member_headers)).json()["id"]

        await client.post(
            f"/api/v1/companies/{company_id}/members",
            json={"user_id": member_id, "role": "MEMBER"},
            headers=auth_headers,
        )

        resp = await client.post(
            f"/api/v1/companies/{company_id}/policies",
            json={"name": "Unauthorized Policy"},
            headers=member_headers,
        )
        assert resp.status_code == 403
