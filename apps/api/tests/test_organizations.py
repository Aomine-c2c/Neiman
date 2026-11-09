"""Tests for the Organizations domain: Company, DNA, Department, OrgRole."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestCompany:
    async def test_create_company(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/companies",
            json={"name": "TestCo", "industry": "Software", "description": "Test company"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "TestCo"
        assert data["slug"] == "testco"
        assert data["industry"] == "Software"
        assert "id" in data

    async def test_create_company_generates_unique_slugs(
        self, client: AsyncClient, auth_headers: dict
    ):
        await client.post("/api/v1/companies", json={"name": "My Company"}, headers=auth_headers)
        resp = await client.post(
            "/api/v1/companies", json={"name": "My Company"}, headers=auth_headers
        )
        assert resp.status_code == 201
        assert resp.json()["slug"] == "my-company-1"

    async def test_list_my_companies(self, client: AsyncClient, auth_headers: dict):
        await client.post("/api/v1/companies", json={"name": "Co1"}, headers=auth_headers)
        await client.post("/api/v1/companies", json={"name": "Co2"}, headers=auth_headers)
        resp = await client.get("/api/v1/companies/me", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_get_company(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.get(f"/api/v1/companies/{company_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == company_id

    async def test_update_company(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.patch(
            f"/api/v1/companies/{company_id}",
            json={"mission": "Automate everything"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["mission"] == "Automate everything"

    async def test_create_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/v1/companies", json={"name": "NoAuth"})
        assert resp.status_code == 401

    async def test_creator_is_auto_owner(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.get(f"/api/v1/companies/{company_id}/members", headers=auth_headers)
        assert resp.status_code == 200
        members = resp.json()
        assert len(members) == 1
        assert members[0]["role"] == "OWNER"


class TestOrganizationalDNA:
    async def test_upsert_dna(self, client: AsyncClient, auth_headers: dict, company_via_api: dict):
        company_id = company_via_api["id"]
        resp = await client.put(
            f"/api/v1/companies/{company_id}/dna",
            json={
                "innovation_level": "RADICAL",
                "autonomy_level": "FULLY_AUTONOMOUS",
                "risk_tolerance": "AGGRESSIVE",
                "quality_threshold": "EXCEPTIONAL",
                "decision_style": "DELEGATIVE",
                "communication_style": "ASYNC_FIRST",
                "resource_strategy": "INVEST_HEAVY",
                "operating_philosophy": "Move fast, break things, fix them faster.",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["innovation_level"] == "RADICAL"
        assert data["autonomy_level"] == "FULLY_AUTONOMOUS"
        assert data["operating_philosophy"] == "Move fast, break things, fix them faster."

    async def test_get_dna(self, client: AsyncClient, auth_headers: dict, company_via_api: dict):
        company_id = company_via_api["id"]
        await client.put(
            f"/api/v1/companies/{company_id}/dna",
            json={"innovation_level": "PROGRESSIVE"},
            headers=auth_headers,
        )
        resp = await client.get(f"/api/v1/companies/{company_id}/dna", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["innovation_level"] == "PROGRESSIVE"

    async def test_patch_dna_partial(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await client.put(
            f"/api/v1/companies/{company_id}/dna",
            json={"risk_tolerance": "CAUTIOUS"},
            headers=auth_headers,
        )
        resp = await client.patch(
            f"/api/v1/companies/{company_id}/dna",
            json={"risk_tolerance": "FEARLESS"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["risk_tolerance"] == "FEARLESS"


class TestDepartment:
    async def test_create_department(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Engineering", "purpose": "Build the product"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Engineering"
        assert data["company_id"] == company_id
        assert data["parent_id"] is None

    async def test_create_nested_department(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        parent_resp = await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Engineering"},
            headers=auth_headers,
        )
        parent_id = parent_resp.json()["id"]
        child_resp = await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Frontend", "parent_id": parent_id},
            headers=auth_headers,
        )
        assert child_resp.status_code == 201
        assert child_resp.json()["parent_id"] == parent_id

    async def test_list_departments(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Marketing"},
            headers=auth_headers,
        )
        await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Sales"},
            headers=auth_headers,
        )
        resp = await client.get(f"/api/v1/companies/{company_id}/departments", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_department(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create_resp = await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Ops"},
            headers=auth_headers,
        )
        dept_id = create_resp.json()["id"]
        resp = await client.patch(
            f"/api/v1/companies/{company_id}/departments/{dept_id}",
            json={"purpose": "Keep the lights on"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["purpose"] == "Keep the lights on"

    async def test_delete_department(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create_resp = await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "ToDelete"},
            headers=auth_headers,
        )
        dept_id = create_resp.json()["id"]
        del_resp = await client.delete(
            f"/api/v1/companies/{company_id}/departments/{dept_id}",
            headers=auth_headers,
        )
        assert del_resp.status_code == 204
        get_resp = await client.get(
            f"/api/v1/companies/{company_id}/departments/{dept_id}",
            headers=auth_headers,
        )
        assert get_resp.status_code == 404


class TestOrgRole:
    async def _make_dept(self, client, headers, company_id):
        resp = await client.post(
            f"/api/v1/companies/{company_id}/departments",
            json={"name": "Engineering"},
            headers=headers,
        )
        return resp.json()["id"]

    async def test_create_role(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        dept_id = await self._make_dept(client, auth_headers, company_id)
        resp = await client.post(
            f"/api/v1/companies/{company_id}/roles/departments/{dept_id}",
            json={
                "title": "Senior Engineer",
                "responsibilities": ["Design systems", "Code reviews"],
                "capabilities": ["architecture", "mentoring"],
                "authority": "MANAGE",
                "required_skills": ["Python", "System Design"],
                "autonomy_level": "DELEGATED",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Senior Engineer"
        assert data["authority"] == "MANAGE"
        assert "Python" in data["required_skills"]

    async def test_list_roles_by_company(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        dept_id = await self._make_dept(client, auth_headers, company_id)
        await client.post(
            f"/api/v1/companies/{company_id}/roles/departments/{dept_id}",
            json={"title": "Role A"},
            headers=auth_headers,
        )
        await client.post(
            f"/api/v1/companies/{company_id}/roles/departments/{dept_id}",
            json={"title": "Role B"},
            headers=auth_headers,
        )
        resp = await client.get(f"/api/v1/companies/{company_id}/roles", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2
