"""Tests for WorktreeCodeRunner: isolated worktree execution, tool guardrails, and CTO auto-merge."""

from __future__ import annotations

import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from nexora.domains.agents.worktree_runner import (
    WorktreeCodeRunner,
    WorktreeExecutionBlockedError,
    WorktreeToolExecutor,
)


def _git(cwd: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=True,
    )
    return proc.stdout.strip()


def _init_temp_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-b", "main")
    _git(repo, "config", "user.email", "test@neiman.local")
    _git(repo, "config", "user.name", "NEIMAN Test")
    (repo / "README.md").write_text("# Test Repo\n", encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "chore: initial commit")
    return repo


def test_tool_executor_jails_paths_and_allowlists_commands(tmp_path: Path) -> None:
    wt = tmp_path / "wt"
    wt.mkdir()
    executor = WorktreeToolExecutor(wt)

    with pytest.raises(ValueError, match="relative"):
        executor.read_file("/etc/passwd")
    with pytest.raises(ValueError, match="escapes"):
        executor.read_file("../secret.txt")

    res_write = executor.write_file("src/app.py", "def add(a, b):\n    return a + b\n")
    assert res_write.ok
    res_edit = executor.edit_file("src/app.py", "return a + b", "return int(a) + int(b)")
    assert res_edit.ok
    assert "int(a) + int(b)" in (wt / "src/app.py").read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_tool_executor_rejects_shell_chaining_and_unlisted_commands(tmp_path: Path) -> None:
    wt = tmp_path / "wt"
    wt.mkdir()
    executor = WorktreeToolExecutor(wt)

    bad_chain = await executor.run_command("pytest && echo pwned")
    assert not bad_chain.ok
    assert "chaining" in bad_chain.output

    bad_cmd = await executor.run_command("rm -rf .")
    assert not bad_cmd.ok
    assert "allowlist" in bad_cmd.output


@pytest.mark.asyncio
async def test_worktree_runner_executes_tools_and_auto_merges_to_main(tmp_path: Path) -> None:
    repo = _init_temp_repo(tmp_path)
    runner = WorktreeCodeRunner(repo_root=repo, max_steps=6)

    responses = iter(
        [
            SimpleNamespace(
                text='{"action":"tool","tool":"write_file","args":{"path":"calc.py","content":"def mul(a, b):\\n    return a * b\\n"}}',
                total_tokens=40,
                cost_usd=0.001,
            ),
            SimpleNamespace(
                text='{"action":"tool","tool":"write_file","args":{"path":"test_calc.py","content":"from calc import mul\\ndef test_mul():\\n    assert mul(3, 4) == 12\\n"}}',
                total_tokens=40,
                cost_usd=0.001,
            ),
            SimpleNamespace(
                text='{"action":"tool","tool":"run_command","args":{"command":"python3 -m pytest -q"}}',
                total_tokens=30,
                cost_usd=0.001,
            ),
            SimpleNamespace(
                text='{"action":"done","summary":"Implemented mul() and verified pytest passes.","commit_message":"feat: add mul helper with tests"}',
                total_tokens=25,
                cost_usd=0.001,
            ),
        ]
    )

    async def fake_model(system_prompt: str, prompt: str):
        return next(responses)

    res = await runner.execute_task_in_worktree(
        task_id="11111111-2222-3333-4444-555555555555",
        task_title="Add mul helper",
        task_description="Implement mul(a, b) with unit test",
        expected_outcome="pytest passes",
        system_prompt="You are a coder.",
        invoke_model=fake_model,
    )

    assert res.merged_to_main is True
    assert res.tests_passed is True
    assert res.commit_sha is not None
    assert "calc.py" in res.files_changed
    assert (repo / "calc.py").exists()
    assert not Path(res.worktree_path).exists()


@pytest.mark.asyncio
async def test_worktree_runner_aborts_merge_and_preserves_worktree_on_conflict(tmp_path: Path) -> None:
    repo = _init_temp_repo(tmp_path)
    runner = WorktreeCodeRunner(repo_root=repo, max_steps=4)

    call_count = 0

    async def fake_model(system_prompt: str, prompt: str):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return SimpleNamespace(
                text='{"action":"tool","tool":"write_file","args":{"path":"README.md","content":"# Branch Version\\n"}}',
                total_tokens=20,
                cost_usd=0.0,
            )
        # Advance main with a conflicting edit before done
        (repo / "README.md").write_text("# Main Conflicting Version\n", encoding="utf-8")
        _git(repo, "add", "README.md")
        _git(repo, "commit", "-m", "chore: conflicting main update")
        return SimpleNamespace(
            text='{"action":"done","summary":"Updated README","commit_message":"docs: update README"}',
            total_tokens=20,
            cost_usd=0.0,
        )

    with pytest.raises(WorktreeExecutionBlockedError) as exc_info:
        await runner.execute_task_in_worktree(
            task_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            task_title="Update README",
            task_description="Edit README",
            expected_outcome="Clean merge",
            system_prompt="You are a coder.",
            invoke_model=fake_model,
        )

    assert "conflict" in str(exc_info.value).lower()
    assert Path(exc_info.value.worktree_path).exists()
    assert "# Main Conflicting Version" in (repo / "README.md").read_text(encoding="utf-8")
