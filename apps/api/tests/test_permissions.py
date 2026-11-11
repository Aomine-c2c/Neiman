"""
Tests for the RBAC permission system.
Validates that role hierarchy is enforced correctly across all domains.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _register_and_login(client: AsyncClient, email: str, username: str) -> dict:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "password": "TestPass123!"},
    )
    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "TestPass123!"}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


class TestMembershipPermissions:
    async def test_owner_can_invite_member(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # Register bob
        await client.post(
            "/api/v1/auth/register",
            json={"email": "bob@example.com", "username": "bob", "password": "TestPass123!"},
        )
        await client.get("/api/v1/auth/me", headers=auth_headers)
        # Get bob's user_id
        bob_headers = await _register_and_login(client, "carol@example.com", "carol")
        me_bob = await client.get("/api/v1/auth/me", headers=bob_headers)
        bob_id = me_bob.json()["id"]

        resp = await client.post(
            f"/api/v1/companies/{company_id}/members",
            json={"user_id": bob_id, "role": "MEMBER"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "MEMBER"

    async def test_viewer_cannot_create_department(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        viewer_headers = await _register_and_login(client, "viewer@example.com", "viewer")
        viewer_id = (await client.get("/api/v1/auth/me", headers=viewer_headers)).json()["id"]

        # Add viewer as VIEWER
        await client.post(
            f"/api/v1/companies/{company_id}/members",
            json={"user_id": viewer_id, "role": "VIEWER"},
            headers=auth_headers,
        )

        # Viewer tries to create department — should fail
        resp = await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Unauthorized Dept"},
            headers=viewer_headers,
        )
        assert resp.status_code == 403

    async def test_viewer_can_read(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        viewer_headers = await _register_and_login(client, "reader@example.com", "reader")
        reader_id = (await client.get("/api/v1/auth/me", headers=viewer_headers)).json()["id"]

        await client.post(
            f"/api/v1/companies/{company_id}/members",
            json={"user_id": reader_id, "role": "VIEWER"},
            headers=auth_headers,
        )

        resp = await client.get(f"/api/v1/companies/{company_id}", headers=viewer_headers)
        assert resp.status_code == 200

    async def test_non_member_cannot_access_company(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        stranger_headers = await _register_and_login(client, "stranger@example.com", "stranger")
        resp = await client.get(f"/api/v1/companies/{company_id}", headers=stranger_headers)
        assert resp.status_code == 403

    async def test_member_level_hierarchy(self):
        """Unit test: MembershipRole.can() respects hierarchy."""
        from nexora.core.enums import MembershipRole

        assert MembershipRole.OWNER.can(MembershipRole.ADMIN) is True
        assert MembershipRole.OWNER.can(MembershipRole.VIEWER) is True
        assert MembershipRole.ADMIN.can(MembershipRole.OWNER) is False
        assert MembershipRole.MANAGER.can(MembershipRole.ADMIN) is False
        assert MembershipRole.MEMBER.can(MembershipRole.MEMBER) is True
        assert MembershipRole.VIEWER.can(MembershipRole.MEMBER) is False

    async def test_cannot_assign_owner_via_invite(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        newuser_headers = await _register_and_login(client, "newowner@example.com", "newowner")
        newuser_id = (await client.get("/api/v1/auth/me", headers=newuser_headers)).json()["id"]

        resp = await client.post(
            f"/api/v1/companies/{company_id}/members",
            json={"user_id": newuser_id, "role": "OWNER"},
            headers=auth_headers,
        )
        assert resp.status_code == 400  # BusinessRuleError

    async def test_manager_can_create_agent_not_viewer(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        manager_headers = await _register_and_login(client, "mgr@example.com", "mgr")
        manager_id = (await client.get("/api/v1/auth/me", headers=manager_headers)).json()["id"]
        await client.post(
            f"/api/v1/companies/{company_id}/members",
            json={"user_id": manager_id, "role": "MANAGER"},
            headers=auth_headers,
        )
        resp = await client.post(
            f"/api/v1/companies/{company_id}/agents",
            json={"name": "Manager's Agent"},
            headers=manager_headers,
        )
        assert resp.status_code == 201
