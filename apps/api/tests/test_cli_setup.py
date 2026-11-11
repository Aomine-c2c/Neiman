"""Integration tests for NEIMAN CLI Setup Wizard and task creation."""

import os
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from nexora.neiman_cli import (
    cmd_setup,
    cmd_task_create,
    set_client_factory,
)


@pytest_asyncio.fixture
async def cli_test_env(client: AsyncClient, auth_headers: dict, company_via_api: dict, tmp_path):
    """Set up client factory, seed agent, and isolated config for CLI setup tests."""
    comp_id = company_via_api["id"]
    token = auth_headers["Authorization"].split("Bearer ")[-1]
    cfg_file = str(tmp_path / "cli.json")

    # Pre-seed an Architect Agent so CTO directive has an agent workforce to delegate to
    await client.post(
        f"/api/v1/companies/{comp_id}/agents",
        json={
            "name": "Architect Agent",
            "autonomy": "SUPERVISED",
            "capabilities": ["architecture", "code_review"],
        },
        headers=auth_headers,
    )

    def factory(timeout=None):
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
        return AsyncClient(
            transport=client._transport,
            base_url="http://test/api/v1",
            headers=headers,
        )

    set_client_factory(factory)

    with (
        patch("nexora.neiman_cli.CONFIG_FILE", cfg_file),
        patch("nexora.neiman_cli.CONFIG_DIR", str(tmp_path)),
        patch.dict(
            os.environ,
            {
                "NEIMAN_API_URL": "http://test/api/v1",
                "NEIMAN_COMPANY_ID": comp_id,
                "NEIMAN_AUTH_TOKEN": token,
            },
        ),
    ):
        yield {"company_id": comp_id, "token": token, "cfg_file": cfg_file}

    set_client_factory(None)


@pytest.mark.asyncio
async def test_cmd_setup_with_workspace_inspection(cli_test_env, client: AsyncClient, auth_headers: dict, tmp_path):
    """Test cmd_setup with workspace inspection links project and triggers CTO directive."""
    comp_id = cli_test_env["company_id"]

    # Create dummy project workspace
    target_repo = tmp_path / "telemetry_engine"
    target_repo.mkdir()
    (target_repo / "Cargo.toml").write_text('[package]\nname = "telemetry_engine"\nversion = "0.1.0"\n')
    (target_repo / "README.md").write_text("# Telemetry Engine\nHigh performance monitoring node.\n")

    # Run non-interactive setup
    await cmd_setup(
        company_id=comp_id,
        workspace_path=str(target_repo),
        provider="local_ollama",
        non_interactive=True,
        auto_plan=True,
    )

    # Verify project was created
    p_res = await client.get(f"/api/v1/companies/{comp_id}/projects", headers=auth_headers)
    assert p_res.status_code == 200
    projects = p_res.json()
    assert any("telemetry_engine" in p["name"] for p in projects)

    # Verify task was created in project
    created_proj = next(p for p in projects if "telemetry_engine" in p["name"])
    t_res = await client.get(f"/api/v1/companies/{comp_id}/projects/{created_proj['id']}/tasks", headers=auth_headers)
    assert t_res.status_code == 200
    tasks = t_res.json()
    assert len(tasks) > 0


@pytest.mark.asyncio
async def test_cmd_setup_custom_project(cli_test_env, client: AsyncClient, auth_headers: dict):
    """Test cmd_setup with custom project name and directive goal."""
    comp_id = cli_test_env["company_id"]

    await cmd_setup(
        company_id=comp_id,
        project_name="Quantum Security Initiative",
        goal="Establish quantum-safe key exchange protocol",
        provider="openai",
        key="sk-test-mock-key-12345",
        non_interactive=True,
        auto_plan=True,
    )

    # Verify project exists
    p_res = await client.get(f"/api/v1/companies/{comp_id}/projects", headers=auth_headers)
    assert p_res.status_code == 200
    projects = p_res.json()
    assert any(p["name"] == "Quantum Security Initiative" for p in projects)


@pytest.mark.asyncio
async def test_cmd_task_create(cli_test_env, client: AsyncClient, auth_headers: dict):
    """Test cmd_task_create creates a new task in active project."""
    comp_id = cli_test_env["company_id"]

    # Ensure a project exists
    p_res = await client.post(
        f"/api/v1/companies/{comp_id}/projects",
        json={"name": "Core Pipeline", "objective": "Pipeline tasks"},
        headers=auth_headers,
    )
    assert p_res.status_code in (200, 201)
    proj_id = p_res.json()["id"]

    # Create task via CLI helper
    await cmd_task_create(
        title="Implement telemetry audit trail",
        project_identifier="Core Pipeline",
        priority="HIGH",
        company_id=comp_id,
    )

    # Check that task exists
    tasks_res = await client.get(f"/api/v1/companies/{comp_id}/projects/{proj_id}/tasks", headers=auth_headers)
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert any(t["title"] == "Implement telemetry audit trail" for t in tasks)
