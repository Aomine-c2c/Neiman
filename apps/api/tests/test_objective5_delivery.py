"""Tests for Objective 5: Greenfield document intake, brownfield workspace inspection, and supervisor auto-pause."""

from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from nexora.core.enums import AgentStatus, Priority, TaskStatus
from nexora.domains.agents.cto_service import CTOService
from nexora.domains.agents.models import Agent
from nexora.domains.agents.schemas import CTODirectiveRequest
from nexora.domains.agents.supervisor import ContinuousSupervisor, get_supervisor_state
from nexora.domains.projects.models import Project, Task


@pytest.mark.asyncio
async def test_cto_directive_accepts_document_and_brownfield_workspace(
    db, company, tmp_path: Path
) -> None:
    cto_agent = Agent(
        company_id=company.id,
        name="Bezalel · Lead Architect",
        identity={"role": "CTO / Lead Architect"},
        status=AgentStatus.AVAILABLE,
    )
    db.add(cto_agent)
    await db.flush()

    repo = tmp_path / "brownfield-app"
    repo.mkdir()
    (repo / "pyproject.toml").write_text("[project]\nname='demo'\n", encoding="utf-8")
    (repo / "main.py").write_text("print('hello')\n", encoding="utf-8")

    captured_prompts: list[str] = []

    async def fake_execute_request(company_id, request, **kwargs):
        captured_prompts.append(request.system_prompt or "")
        return SimpleNamespace(
            text=(
                '{"intent":"DIRECTIVE","reply":"Roadmap created.","tasks":['
                '{"title":"Add health endpoint","description":"Add /healthz","target_role":"backend","priority":"HIGH","expected_outcome":"200 OK"}'
                "]}"
            ),
            total_tokens=100,
            estimated_cost_usd=0.001,
        )

    long_doc = "# Greenfield Spec\n" + ("Requirement details. " * 150)
    req = CTODirectiveRequest(
        directive="Build the system from this spec",
        target_repo=str(repo),
        document_text=long_doc,
        auto_delegate=True,
        autonomous_execute=False,
    )

    with patch(
        "nexora.domains.intelligence.service.IntelligenceService.execute_request",
        new=AsyncMock(side_effect=fake_execute_request),
    ):
        svc = CTOService(db)
        resp = await svc.intake_directive(company.id, req)

    assert resp.tasks_created_count == 1
    assert captured_prompts
    assert "Target Codebase Context:" in captured_prompts[0]
    assert "Project Specification Document:" in captured_prompts[0]


@pytest.mark.asyncio
async def test_supervisor_auto_pauses_on_blocked_task(db, company, user) -> None:
    project = Project(company_id=company.id, owner_id=user.id, name="Main Project")
    db.add(project)
    await db.flush()

    blocked_task = Task(
        company_id=company.id,
        project_id=project.id,
        title="Conflicting task",
        description="Needs resolution",
        priority=Priority.HIGH,
        status=TaskStatus.BLOCKED,
    )
    db.add(blocked_task)
    await db.flush()

    state = get_supervisor_state(company.id)
    state.is_running = True
    state.state = "PLAYING"

    sup = ContinuousSupervisor(db)
    with patch("nexora.domains.agents.supervisor.stop_supervisor_daemon") as mock_stop:
        res = await sup.run_cycle(company.id)

    assert res["status"] == "IDLE"
    assert state.is_running is False
    assert state.state == "PAUSED"
    mock_stop.assert_called_once_with(company.id)
