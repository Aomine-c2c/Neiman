"""
Autonomous Worktree Code Runner & Iterative LLM Tool Loop.

Executes coding tasks inside an isolated per-task Git worktree using an
iterative JSON tool-calling loop (`read_file`, `write_file`, `edit_file`,
`search_files`, `list_files`, `run_command`), commits verified changes on the
task branch, and performs a safe CTO auto-merge into `main` (aborting cleanly
and marking the task BLOCKED on test failure or merge conflict).
"""

from __future__ import annotations

import asyncio
import json
import re
import shlex
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ALLOWED_COMMAND_PREFIXES: tuple[tuple[str, ...], ...] = (
    ("pytest",),
    (".venv/bin/pytest",),
    ("python", "-m", "pytest"),
    ("python3", "-m", "pytest"),
    ("ruff",),
    ("npx", "tsc"),
    ("npx", "jest"),
    ("npm", "test"),
    ("npm", "run", "lint"),
    ("npm", "run", "build"),
    ("git", "status"),
    ("git", "diff"),
    ("git", "log"),
)

FORBIDDEN_SHELL_TOKENS = ("&&", "||", ";", "|", "`", "$(", ">", "<", "\n", "\r")


class WorktreeExecutionBlockedError(Exception):
    """Raised when autonomous execution fails tests or hits a merge conflict."""

    def __init__(
        self,
        message: str,
        *,
        worktree_path: str,
        branch_name: str,
        diff_output: str = "",
    ) -> None:
        super().__init__(message)
        self.worktree_path = worktree_path
        self.branch_name = branch_name
        self.diff_output = diff_output


@dataclass
class WorktreeToolResult:
    ok: bool
    output: str


@dataclass
class WorktreeRunResult:
    summary: str
    worktree_path: str
    branch_name: str
    commit_sha: str | None = None
    merged_to_main: bool = False
    files_changed: list[str] = field(default_factory=list)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    tests_passed: bool = False
    tokens_consumed: int = 0
    cost_usd: float = 0.0


class WorktreeToolExecutor:
    """Safely executes file and allowlisted test/lint commands jailed inside a worktree."""

    def __init__(self, worktree_path: Path) -> None:
        self.worktree_path = worktree_path.resolve()

    def _resolve_safe_path(self, rel_path: str) -> Path:
        if not rel_path or Path(rel_path).is_absolute():
            raise ValueError(f"Path must be relative to worktree: {rel_path!r}")
        candidate = (self.worktree_path / rel_path).resolve()
        if not candidate.is_relative_to(self.worktree_path):
            raise ValueError(f"Path escapes worktree boundary: {rel_path!r}")
        return candidate

    def read_file(self, path: str, start_line: int = 1, end_line: int = 200) -> WorktreeToolResult:
        target = self._resolve_safe_path(path)
        if not target.is_file():
            return WorktreeToolResult(ok=False, output=f"File not found: {path}")
        lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
        start = max(1, int(start_line))
        end = min(len(lines), max(start, int(end_line)))
        numbered = [f"{i}: {lines[i - 1]}" for i in range(start, end + 1)]
        return WorktreeToolResult(ok=True, output="\n".join(numbered)[:12000])

    def write_file(self, path: str, content: str) -> WorktreeToolResult:
        target = self._resolve_safe_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return WorktreeToolResult(ok=True, output=f"Wrote {len(content)} chars to {path}")

    def edit_file(self, path: str, target: str, replacement: str) -> WorktreeToolResult:
        file_path = self._resolve_safe_path(path)
        if not file_path.is_file():
            return WorktreeToolResult(ok=False, output=f"File not found: {path}")
        text = file_path.read_text(encoding="utf-8")
        if target not in text:
            return WorktreeToolResult(ok=False, output=f"Target snippet not found in {path}")
        updated = text.replace(target, replacement, 1)
        file_path.write_text(updated, encoding="utf-8")
        return WorktreeToolResult(ok=True, output=f"Edited {path}")

    def list_files(self, subdir: str = ".") -> WorktreeToolResult:
        base = self._resolve_safe_path(subdir) if subdir != "." else self.worktree_path
        if not base.exists():
            return WorktreeToolResult(ok=False, output=f"Directory not found: {subdir}")
        items = []
        for p in sorted(base.rglob("*")):
            if ".git" in p.parts or "node_modules" in p.parts or ".venv" in p.parts:
                continue
            if p.is_file():
                items.append(str(p.relative_to(self.worktree_path)))
            if len(items) >= 200:
                break
        return WorktreeToolResult(ok=True, output="\n".join(items) or "(empty)")

    def search_files(self, pattern: str, subdir: str = ".") -> WorktreeToolResult:
        base = self._resolve_safe_path(subdir) if subdir != "." else self.worktree_path
        regex = re.compile(pattern)
        matches: list[str] = []
        for p in sorted(base.rglob("*")):
            if ".git" in p.parts or "node_modules" in p.parts or ".venv" in p.parts:
                continue
            if not p.is_file() or p.stat().st_size > 512_000:
                continue
            try:
                for idx, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                    if regex.search(line):
                        matches.append(f"{p.relative_to(self.worktree_path)}:{idx}: {line[:180]}")
                        if len(matches) >= 60:
                            return WorktreeToolResult(ok=True, output="\n".join(matches))
            except OSError:
                continue
        return WorktreeToolResult(ok=True, output="\n".join(matches) or "No matches.")

    async def run_command(self, command: str, timeout: float = 60.0) -> WorktreeToolResult:
        if any(tok in command for tok in FORBIDDEN_SHELL_TOKENS):
            return WorktreeToolResult(ok=False, output="Rejected: shell chaining/redirection not allowed.")
        try:
            tokens = shlex.split(command)
        except ValueError as exc:
            return WorktreeToolResult(ok=False, output=f"Invalid command syntax: {exc}")
        if not tokens:
            return WorktreeToolResult(ok=False, output="Empty command.")
        allowed = any(
            tuple(tokens[: len(prefix)]) == prefix for prefix in ALLOWED_COMMAND_PREFIXES
        )
        if not allowed:
            return WorktreeToolResult(
                ok=False,
                output=f"Command '{tokens[0]}' is not in the worktree allowlist.",
            )

        proc = await asyncio.create_subprocess_exec(
            *tokens,
            cwd=str(self.worktree_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except TimeoutError:
            proc.kill()
            return WorktreeToolResult(ok=False, output=f"Command timed out after {timeout}s.")

        out = (stdout_b.decode(errors="replace") + "\n" + stderr_b.decode(errors="replace")).strip()
        return WorktreeToolResult(ok=proc.returncode == 0, output=f"exit={proc.returncode}\n{out[:8000]}")

    async def dispatch(self, tool_name: str, args: dict[str, Any]) -> WorktreeToolResult:
        try:
            if tool_name == "read_file":
                return self.read_file(
                    path=str(args["path"]),
                    start_line=int(args.get("start_line", 1)),
                    end_line=int(args.get("end_line", 200)),
                )
            if tool_name == "write_file":
                return self.write_file(path=str(args["path"]), content=str(args["content"]))
            if tool_name == "edit_file":
                return self.edit_file(
                    path=str(args["path"]),
                    target=str(args["target"]),
                    replacement=str(args["replacement"]),
                )
            if tool_name == "list_files":
                return self.list_files(subdir=str(args.get("subdir", ".")))
            if tool_name == "search_files":
                return self.search_files(
                    pattern=str(args["pattern"]),
                    subdir=str(args.get("subdir", ".")),
                )
            if tool_name == "run_command":
                return await self.run_command(command=str(args["command"]))
            return WorktreeToolResult(ok=False, output=f"Unknown tool: {tool_name}")
        except Exception as exc:
            return WorktreeToolResult(ok=False, output=f"Tool error: {exc}")


class WorktreeCodeRunner:
    """Manages per-task Git worktrees, iterative LLM coding loop, and CTO auto-merge."""

    def __init__(self, repo_root: Path, max_steps: int = 12) -> None:
        self.repo_root = repo_root.resolve()
        self.max_steps = max_steps

    def _run_git(self, *args: str, cwd: Path | None = None) -> tuple[int, str, str]:
        proc = subprocess.run(
            ["git", *args],
            cwd=str(cwd or self.repo_root),
            capture_output=True,
            text=True,
            timeout=30,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()

    def ensure_worktree(self, task_id: str) -> tuple[Path, str]:
        short_id = task_id.replace("-", "")[:10]
        branch_name = f"neiman/task-{short_id}"
        worktree_path = self.repo_root / ".neiman" / "worktrees" / f"task-{short_id}"
        if worktree_path.exists():
            return worktree_path, branch_name

        worktree_path.parent.mkdir(parents=True, exist_ok=True)
        # Check if branch already exists
        rc, _, _ = self._run_git("rev-parse", "--verify", branch_name)
        if rc == 0:
            rc, _, err = self._run_git("worktree", "add", str(worktree_path), branch_name)
        else:
            rc, _, err = self._run_git("worktree", "add", "-b", branch_name, str(worktree_path), "HEAD")
        if rc != 0:
            raise RuntimeError(f"Failed to create task worktree: {err}")
        return worktree_path, branch_name

    def _extract_action(self, raw_text: str) -> dict[str, Any] | None:
        text = raw_text.strip()
        if "```" in text:
            m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
            if m:
                text = m.group(1)
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            parsed = json.loads(text[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    async def execute_task_in_worktree(
        self,
        *,
        task_id: str,
        task_title: str,
        task_description: str,
        expected_outcome: str,
        system_prompt: str,
        invoke_model: Any,
        on_tool_event: Any | None = None,
    ) -> WorktreeRunResult:
        worktree_path, branch_name = self.ensure_worktree(task_id)
        executor = WorktreeToolExecutor(worktree_path)
        result = WorktreeRunResult(
            summary="",
            worktree_path=str(worktree_path),
            branch_name=branch_name,
        )

        transcript: list[str] = [
            f"TASK: {task_title}",
            f"DESCRIPTION: {task_description}",
            f"EXPECTED OUTCOME: {expected_outcome}",
            (
                "TOOLS: read_file(path, start_line, end_line), write_file(path, content), "
                "edit_file(path, target, replacement), list_files(subdir), "
                "search_files(pattern, subdir), run_command(command).\n"
                'Respond ONLY with JSON: {"action":"tool","tool":"...","args":{...}} '
                'or {"action":"done","summary":"...","commit_message":"..."}'
            ),
        ]

        done_payload: dict[str, Any] | None = None
        last_test_ok = False
        has_run_tests = False

        for step_idx in range(1, self.max_steps + 1):
            prompt = "\n\n".join(transcript[-10:])
            resp = await invoke_model(system_prompt=system_prompt, prompt=prompt)
            result.tokens_consumed += getattr(resp, "total_tokens", 0) or 0
            result.cost_usd += getattr(resp, "cost_usd", 0.0) or 0.0

            action = self._extract_action(getattr(resp, "text", ""))
            if not action:
                transcript.append("SYSTEM: Invalid JSON action. Reply with valid JSON.")
                continue

            if action.get("action") == "done":
                done_payload = action
                break

            if action.get("action") == "tool":
                t_name = str(action.get("tool", ""))
                t_args = action.get("args") or {}
                tool_res = await executor.dispatch(t_name, t_args)
                if t_name == "run_command" and any(
                    k in str(t_args.get("command", "")) for k in ("pytest", "jest", "tsc", "npm test")
                ):
                    has_run_tests = True
                    last_test_ok = tool_res.ok

                event = {
                    "step": step_idx,
                    "tool": t_name,
                    "args": t_args,
                    "ok": tool_res.ok,
                    "output_preview": tool_res.output[:400],
                }
                result.tool_calls.append(event)
                if on_tool_event:
                    await on_tool_event(event)
                transcript.append(f"TOOL({t_name}) ok={tool_res.ok}:\n{tool_res.output[:3000]}")
            else:
                transcript.append("SYSTEM: Unknown action. Use 'tool' or 'done'.")

        _, diff_out, _ = self._run_git("diff", cwd=worktree_path)
        if not done_payload:
            raise WorktreeExecutionBlockedError(
                f"Step cap ({self.max_steps}) reached without completion.",
                worktree_path=str(worktree_path),
                branch_name=branch_name,
                diff_output=diff_out[:4000],
            )

        if has_run_tests and not last_test_ok:
            raise WorktreeExecutionBlockedError(
                "Verification tests failed in task worktree; preserving worktree for inspection.",
                worktree_path=str(worktree_path),
                branch_name=branch_name,
                diff_output=diff_out[:4000],
            )

        result.tests_passed = last_test_ok or not has_run_tests
        result.summary = str(done_payload.get("summary") or "Task completed in worktree.")

        # Commit changes if any exist
        _, status_out, _ = self._run_git("status", "--porcelain", cwd=worktree_path)
        if status_out:
            self._run_git("add", "-A", cwd=worktree_path)
            commit_msg = str(done_payload.get("commit_message") or f"feat: {task_title[:72]}")
            rc, _, commit_err = self._run_git("commit", "-m", commit_msg, cwd=worktree_path)
            if rc != 0:
                raise WorktreeExecutionBlockedError(
                    f"Git commit failed in worktree: {commit_err}",
                    worktree_path=str(worktree_path),
                    branch_name=branch_name,
                    diff_output=diff_out[:4000],
                )
            _, sha, _ = self._run_git("rev-parse", "HEAD", cwd=worktree_path)
            _, changed, _ = self._run_git("diff", "--name-only", "HEAD~1..HEAD", cwd=worktree_path)
            result.commit_sha = sha
            result.files_changed = [f for f in changed.splitlines() if f.strip()]

            # CTO Auto-Merge into current main/HEAD
            rc_merge, _, merge_err = self._run_git(
                "merge", "--no-ff", branch_name, "-m", f"merge(cto): {task_title[:68]}"
            )
            if rc_merge != 0:
                _, conflict_diff, _ = self._run_git("diff")
                self._run_git("merge", "--abort")
                raise WorktreeExecutionBlockedError(
                    f"Auto-merge conflict on main: {merge_err}. Preserving worktree '{branch_name}'.",
                    worktree_path=str(worktree_path),
                    branch_name=branch_name,
                    diff_output=conflict_diff[:4000],
                )
            result.merged_to_main = True
            self._run_git("worktree", "remove", str(worktree_path))
            self._run_git("branch", "-d", branch_name)

        return result
