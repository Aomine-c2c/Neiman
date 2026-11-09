"""Tests for the System Setup Reset endpoint."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestSystemSetupReset:
    async def test_setup_reset_requires_explicit_confirmation(self, client: AsyncClient, db):
        from nexora.domains.auth.models import User
        from nexora.domains.auth.service import hash_password

        # Create and authenticate a platform administrator
        su = User(
            email="admin@example.com",
            username="admin",
            password_hash=hash_password("AdminPass123!"),
            first_name="Admin",
            last_name="User",
            is_active=True,
            is_superuser=True,
        )
        db.add(su)
        await db.commit()
        await db.refresh(su)

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "AdminPass123!"},
        )
        assert login_resp.status_code == 200
        headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

        # Missing confirmation body -> 422 validation error
        resp = await client.post("/api/v1/system/setup/reset", headers=headers)
        assert resp.status_code == 422
