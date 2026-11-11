"""Unit and integration test suite for NEIMAN CLI configuration subsystem."""

import os
import uuid
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from nexora.neiman_cli import (
    _render_hermes_help,
    cmd_config_agent,
    cmd_config_constitution,
    cmd_config_get,
    cmd_config_probe,
    cmd_config_providers,
    cmd_config_reset_breakers,
    cmd_config_routing,
    cmd_config_set,
    cmd_config_set_key,
    cmd_config_show,
    cmd_project_assign,
    cmd_project_create,
    cmd_project_list,
    cmd_project_tasks,
    cmd_task_assign,
    get_configured_api_url,
    get_configured_company_id,
    get_configured_timeout,
    get_configured_token,
    load_cli_config,
    save_cli_config,
    set_client_factory,
)


@pytest_asyncio.fixture
async def cli_live_env(client: AsyncClient, auth_headers: dict, company_via_api: dict):
    """Provide an in-process ASGI environment with seeded agents for CLI live tests."""
    comp_id = company_via_api["id"]
    token = auth_headers["Authorization"].split("Bearer ")[-1]

    # Pre-seed Architect Agent and Verification SRE
    await client.post(
        f"/api/v1/companies/{comp_id}/agents",
        json={
            "name": "Architect Agent",
            "autonomy": "SUPERVISED",
            "capabilities": ["architecture", "code_review"],
        },
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/companies/{comp_id}/agents",
        json={
            "name": "Verification SRE",
            "autonomy": "SUPERVISED",
            "capabilities": ["testing", "sre"],
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

    with patch.dict(
        os.environ,
        {
            "NEIMAN_API_URL": "http://test/api/v1",
            "NEIMAN_COMPANY_ID": comp_id,
            "NEIMAN_AUTH_TOKEN": token,
        },
    ):
        yield

    set_client_factory(None)


def test_load_save_cli_config(tmp_path):
    test_cfg_file = str(tmp_path / "cli.json")
    with (
        patch("nexora.neiman_cli.CONFIG_FILE", test_cfg_file),
        patch("nexora.neiman_cli.CONFIG_DIR", str(tmp_path)),
    ):
        # Initially empty
        assert load_cli_config() == {}

        # Save config
        data = {
            "api_url": "http://127.0.0.1:8000/api/v1",
            "company_id": str(uuid.uuid4()),
            "token": "test-jwt-token-12345",
            "timeout": 20.0,
        }
        save_cli_config(data)

        # Loaded matches
        loaded = load_cli_config()
        assert loaded == data
        assert get_configured_api_url() == "http://127.0.0.1:8000/api/v1"
        assert get_configured_company_id() == data["company_id"]
        assert get_configured_token() == "test-jwt-token-12345"
        assert get_configured_timeout() == 20.0


def test_cmd_config_set_validation(tmp_path, capsys):
    test_cfg_file = str(tmp_path / "cli.json")
    with (
        patch("nexora.neiman_cli.CONFIG_FILE", test_cfg_file),
        patch("nexora.neiman_cli.CONFIG_DIR", str(tmp_path)),
    ):
        # Invalid key
        cmd_config_set("invalid_key", "value")
        captured = capsys.readouterr()
        assert "Unknown key" in captured.out

        # Invalid api_url
        cmd_config_set("api_url", "ftp://invalid-protocol")
        captured = capsys.readouterr()
        assert "api_url must begin with http" in captured.out

        # Invalid company_id
        cmd_config_set("company_id", "not-a-uuid")
        captured = capsys.readouterr()
        assert "company_id must be a valid UUID string" in captured.out

        # Invalid timeout
        cmd_config_set("timeout", "-5")
        captured = capsys.readouterr()
        assert "timeout must be a positive number" in captured.out

        # Valid setting
        valid_uuid = str(uuid.uuid4())
        cmd_config_set("company_id", valid_uuid)
        cmd_config_set("timeout", "35.5")
        cfg = load_cli_config()
        assert cfg["company_id"] == valid_uuid
        assert cfg["timeout"] == 35.5


def test_cmd_config_get(tmp_path, capsys):
    test_cfg_file = str(tmp_path / "cli.json")
    with (
        patch("nexora.neiman_cli.CONFIG_FILE", test_cfg_file),
        patch("nexora.neiman_cli.CONFIG_DIR", str(tmp_path)),
    ):
        save_cli_config({"timeout": 42.0})

        # Single key
        cmd_config_get("timeout")
        out1 = capsys.readouterr().out
        assert "42.0" in out1

        # All keys
        cmd_config_get("all")
        out2 = capsys.readouterr().out
        assert "timeout" in out2
        assert "api_url" in out2


@pytest.mark.asyncio
async def test_cmd_config_show_live(capsys):
    await cmd_config_show()
    captured = capsys.readouterr().out
    assert "NEIMAN CLI // CONFIGURATION & TELEMETRY" in captured
    assert "API Base URL" in captured


@pytest.mark.asyncio
async def test_cmd_config_providers_live(cli_live_env, capsys):
    await cmd_config_providers()
    captured = capsys.readouterr().out
    assert "Registered Intelligence Providers" in captured
    assert "openai" in captured or "anthropic" in captured or "local" in captured


@pytest.mark.asyncio
async def test_cmd_config_set_key_and_probe_live(cli_live_env, capsys):
    # Set key in vault
    await cmd_config_set_key(
        "openai",
        "sk-custom-test-vault-key",
        base_url="https://api.openai.com/v1",
        auto_discover=False,
    )
    captured = capsys.readouterr().out
    assert "Successfully Configured" in captured

    # Probe local provider
    await cmd_config_probe("local")
    captured_probe = capsys.readouterr().out
    assert "Provider Probe Telemetry: local" in captured_probe
    assert "Circuit Breaker" in captured_probe

    # Reset circuit breakers
    await cmd_config_reset_breakers()
    captured_reset = capsys.readouterr().out
    assert "circuit breakers reset" in captured_reset


@pytest.mark.asyncio
async def test_cmd_config_routing_live(cli_live_env, capsys):
    # Read active policy
    await cmd_config_routing()
    captured = capsys.readouterr().out
    assert "Intelligence Routing Policy" in captured
    assert "Active Strategy" in captured

    # Update policy
    await cmd_config_routing(strategy="FASTEST", max_latency=2500.0)
    captured_update = capsys.readouterr().out
    assert "Routing policy successfully updated" in captured_update


@pytest.mark.asyncio
async def test_cmd_config_agent_live(cli_live_env, capsys):
    # Query agent
    await cmd_config_agent("architect")
    captured = capsys.readouterr().out
    assert "Agent Configuration: Architect Agent" in captured

    # Update agent autonomy
    await cmd_config_agent("architect", autonomy="SEMI_AUTONOMOUS", budget=25.0)
    captured_update = capsys.readouterr().out
    assert "successfully updated" in captured_update
    assert "SEMI_AUTONOMOUS" in captured_update


@pytest.mark.asyncio
async def test_cmd_config_constitution_live(cli_live_env, capsys):
    # Read constitution
    await cmd_config_constitution()
    captured = capsys.readouterr().out
    assert "Corporate Governance Constitution" in captured
    assert "Mission Statement" in captured


@pytest.mark.asyncio
async def test_cmd_project_lifecycle(cli_live_env, capsys):
    # 1. Create project
    proj_name = f"Pipeline_{uuid.uuid4().hex[:4]}"
    await cmd_project_create(proj_name, objective="Automated pipeline test", priority="HIGH")
    out = capsys.readouterr().out
    assert "Project Successfully Created" in out
    assert proj_name in out

    # 2. List projects
    await cmd_project_list()
    out = capsys.readouterr().out
    assert "NEIMAN Projects Portfolio" in out
    assert "Pipeline" in out

    # 3. Assign project to agent
    await cmd_project_assign(proj_name, "Architect")
    out = capsys.readouterr().out
    assert "Project Assigned to Agent Employee" in out
    assert "Architect Agent" in out

    # 4. List project tasks
    await cmd_project_tasks(proj_name)
    out = capsys.readouterr().out
    assert f"Tasks for Project: {proj_name}" in out
    assert "Architect" in out and "Agent" in out


@pytest.mark.asyncio
async def test_cmd_task_assign_flow(cli_live_env, capsys):
    # Create project and task
    proj_name = f"TaskFlow_{uuid.uuid4().hex[:4]}"
    await cmd_project_create(proj_name)
    capsys.readouterr()

    # Assign project to generate initial task
    await cmd_project_assign(proj_name, "Architect")
    capsys.readouterr()

    # Reassign individual task to Verification SRE
    await cmd_task_assign(f"Execute Core Deliverables: {proj_name}", "Verification")
    out = capsys.readouterr().out
    assert "Task Assigned Successfully" in out
    assert "Verification SRE" in out


def test_render_hermes_help(capsys):
    _render_hermes_help()
    out = capsys.readouterr().out
    assert "Hermes Agent Operator Guide" in out
    assert "/project list" in out
    assert "/assign <task_id> <agent>" in out
    assert "<Any text directive>" in out
