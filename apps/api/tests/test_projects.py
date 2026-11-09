"""Tests for the Projects and Tasks domain."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestProjects:
    async def test_create_project(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={
                "name": "NEIMAN Launch",
                "objective": "Ship NEIMAN v1 to market",
                "priority": "CRITICAL",
                "milestones": [
                    {"title": "MVP", "description": "Core features done"},
                    {"title": "Beta", "description": "Public beta"},
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "NEIMAN Launch"
        assert data["priority"] == "CRITICAL"
        assert data["status"] == "DRAFT"
        assert len(data["milestones"]) == 2

    async def test_list_projects(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={"name": "Project 1"},
            headers=auth_headers,
        )
        await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={"name": "Project 2"},
            headers=auth_headers,
        )
        resp = await client.get(f"/api/v1/companies/{company_id}/projects", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_project_status(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={"name": "My Project"},
            headers=auth_headers,
        )
        project_id = create.json()["id"]
        resp = await client.patch(
            f"/api/v1/companies/{company_id}/projects/{project_id}",
            json={"status": "ACTIVE"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ACTIVE"

    async def test_delete_project(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        create = await client.post(
            f"/api/v1/companies/{company_id}/projects",
            json={"name": "Deletable"},
            headers=auth_headers,
        )
        project_id = create.json()["id"]
        del_resp = await client.delete(
            f"/api/v1/companies/{company_id}/projects/{project_id}", headers=auth_headers
        )
        assert del_resp.status_code == 204


class TestTasks:
    async def _make_project(self, client, headers, company_id, name="Test Project"):
        resp = await client.post(
            f"/api/v1/companies/{company_id}/projects", json={"name": name}, headers=headers
        )
        return resp.json()["id"]

    async def test_create_task(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        project_id = await self._make_project(client, auth_headers, company_id)
        resp = await client.post(
            f"/api/v1/companies/{company_id}/projects/{project_id}/tasks",
            json={
                "title": "Implement auth",
                "description": "Build JWT auth system",
                "priority": "HIGH",
                "expected_outcome": "Users can log in",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Implement auth"
        assert data["status"] == "PENDING"
        assert data["project_id"] == project_id

    async def test_list_tasks(self, client: AsyncClient, auth_headers: dict, company_via_api: dict):
        company_id = company_via_api["id"]
        project_id = await self._make_project(client, auth_headers, company_id)
        await client.post(
            f"/api/v1/companies/{company_id}/projects/{project_id}/tasks",
            json={"title": "Task A"},
            headers=auth_headers,
        )
        await client.post(
            f"/api/v1/companies/{company_id}/projects/{project_id}/tasks",
            json={"title": "Task B"},
            headers=auth_headers,
        )
        resp = await client.get(
            f"/api/v1/companies/{company_id}/projects/{project_id}/tasks", headers=auth_headers
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_task_status(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        project_id = await self._make_project(client, auth_headers, company_id)
        create = await client.post(
            f"/api/v1/companies/{company_id}/projects/{project_id}/tasks",
            json={"title": "A task"},
            headers=auth_headers,
        )
        task_id = create.json()["id"]
        resp = await client.patch(
            f"/api/v1/companies/{company_id}/projects/{project_id}/tasks/{task_id}",
            json={"status": "IN_PROGRESS"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "IN_PROGRESS"
