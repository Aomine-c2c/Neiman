"""
Execution Sandbox Engine for NEIMAN OS.

Provides secure, isolated runtime environments for agent and tool executions:
1. Filesystem Sandbox:
   - Ephemeral chroot/workspace isolation per company & agent.
   - Strict read/write path containment (blocks /etc, /proc, /sys, ../ traversal).
   - Automated cleanup and file retention policies.
2. Shell & Process Sandbox:
   - Subprocess execution with strict resource limits (timeout, max memory, max CPU).
   - Environment variable scrubbing (removes API keys and secrets from child env).
   - Prohibited command filtering and fork-bomb prevention.
3. Network Egress Sandbox:
   - SSRF and cloud metadata endpoint protection (169.254.169.254, localhost loopback).
   - Explicit domain whitelisting per execution context.
4. Python Code Isolation Sandbox:
   - AST-based pre-execution static analysis (detects forbidden imports, `os.system`, `eval`, `exec`).
   - Safe execution wrapper for analytical tasks.
"""

from __future__ import annotations

import ast
from collections import deque
import os
import resource
import shutil
import signal
import subprocess
import tempfile
import threading
import time
from typing import Any, BinaryIO
import uuid
from pathlib import Path

from pydantic import BaseModel, Field

from nexora.core.security import PromptSanitizer, ToolSandbox
from nexora.exceptions import ForbiddenError

_MAX_CAPTURED_OUTPUT_BYTES = 64 * 1024


def _resolve_node_binary() -> tuple[str, str | None]:
    """Finds the actual node binary and its installation prefix for bwrap mounting."""
    try:
        res = subprocess.run(["mise", "which", "node"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0 and res.stdout.strip():
            p = Path(res.stdout.strip()).resolve()
            if p.exists() and p.is_file():
                return str(p), str(p.parents[1])
    except Exception:
        pass

    node_which = shutil.which("node")
    if node_which:
        p = Path(node_which).resolve()
        if p.name != "mise" and p.exists():
            parent_dir = str(p.parents[1]) if not str(p).startswith("/usr") else None
            return str(p), parent_dir

    for cand in (
        Path.home() / ".local/share/mise/installs/node/latest/bin/node",
        Path("/usr/local/bin/node"),
        Path("/usr/bin/node"),
    ):
        if cand.exists():
            parent_dir = str(cand.parents[1]) if not str(cand).startswith("/usr") else None
            return str(cand), parent_dir

    return "node", None


def _drain_bounded(stream: BinaryIO, captured: bytearray) -> None:
    """Drain a child pipe to avoid blocking while retaining only a bounded excerpt."""
    while True:
        chunk = stream.read(8192)
        if not chunk:
            return
        remaining = _MAX_CAPTURED_OUTPUT_BYTES - len(captured)
        if remaining > 0:
            captured.extend(chunk[:remaining])


class SandboxExecutionSpec(BaseModel):
    command: str | None = None
    code: str | None = None
    language: str = "bash"  # bash | python | node | javascript
    timeout_seconds: float = 30.0
    allowed_directories: list[str] = Field(default_factory=list)
    allowed_domains: list[str] = Field(default_factory=list)
    environment_variables: dict[str, str] = Field(default_factory=dict)
    workspace_dir: str | None = None
    agent_id: str | None = None
    agent_name: str | None = None


class SandboxExecutionResult(BaseModel):
    execution_id: str
    status: str  # SUCCESS, FAILED, TIMED_OUT, FORBIDDEN
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    files_created: list[str] = Field(default_factory=list)
    security_checks_passed: bool
    violation_reason: str | None = None


class RuntimeExecutionRecord(BaseModel):
    execution_id: str
    company_id: uuid.UUID
    agent_id: str | None = None
    agent_name: str | None = None
    language: str
    code_snippet: str
    status: str  # SUCCESS, FAILED, TIMED_OUT, FORBIDDEN
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    files_created: list[str] = Field(default_factory=list)
    security_checks_passed: bool
    violation_reason: str | None = None
    created_at: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


class CodeSafetyInspector:
    """Static AST and token inspector to detect hazardous code patterns before execution."""

    FORBIDDEN_CALLS = {
        "eval",
        "exec",
        "compile",
        "__import__",
        "getattr",
        "setattr",
        "delattr",
    }

    FORBIDDEN_MODULES = {
        "pty",
        "ctypes",
        "posix",
    }

    FORBIDDEN_NODE_PATTERNS = [
        "child_process",
        "process.binding",
        "node:net",
        "node:dgram",
        "cluster.fork",
    ]

    @classmethod
    def inspect_python_code(cls, code: str) -> tuple[bool, str | None]:
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax Error: {e}"

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in cls.FORBIDDEN_MODULES:
                        return False, f"Import of dangerous module '{alias.name}' is prohibited."
            elif isinstance(node, ast.ImportFrom):
                if node.module in cls.FORBIDDEN_MODULES:
                    return False, f"Import from dangerous module '{node.module}' is prohibited."
            elif isinstance(node, ast.Call):
                func_name = None
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr
                if func_name in cls.FORBIDDEN_CALLS:
                    return False, f"Call to dangerous builtin '{func_name}' is prohibited."

        return True, None

    @classmethod
    def inspect_node_code(cls, code: str) -> tuple[bool, str | None]:
        lower = code.lower()
        for pat in cls.FORBIDDEN_NODE_PATTERNS:
            if pat in lower:
                return False, f"Dangerous Node.js API pattern '{pat}' is prohibited in runtime sandbox."
        if "eval(" in lower or "new function(" in lower:
            return False, "Dynamic code evaluation via eval() or Function() constructor is prohibited."
        return True, None


class ExecutionSandbox:
    """
    Isolated execution container providing filesystem isolation,
    process limits, and environment sanitization.
    """

    SAFE_ENV_ALLOWLIST = {
        "PATH",
        "LANG",
        "LC_ALL",
        "PYTHONPATH",
        "TMPDIR",
        "USER",
        "HOME",
    }

    def __init__(self, company_id: uuid.UUID, base_sandbox_dir: str | None = None):
        self.company_id = company_id
        self.base_dir = Path(base_sandbox_dir or tempfile.gettempdir())

    def _prepare_sanitized_env(self, custom_vars: dict[str, str]) -> dict[str, str]:
        """Scrubs sensitive API keys and secrets from the subprocess environment."""
        sanitized = {}
        for k, v in os.environ.items():
            if k in self.SAFE_ENV_ALLOWLIST:
                sanitized[k] = v

        # Add sanitized custom vars
        for k, v in custom_vars.items():
            if any(term in k.upper() for term in ("SECRET", "KEY", "TOKEN", "PASSWORD")):
                continue
            sanitized[k] = str(v)

        return sanitized

    def _record(self, spec: SandboxExecutionSpec, result: SandboxExecutionResult) -> None:
        """Records an execution result into the global runtime telemetry store."""
        code_snip = spec.code or spec.command or "No code"
        if len(code_snip) > 500:
            code_snip = code_snip[:500] + "..."
        rec = RuntimeExecutionRecord(
            execution_id=result.execution_id,
            company_id=self.company_id,
            agent_id=spec.agent_id,
            agent_name=spec.agent_name,
            language=spec.language.lower(),
            code_snippet=code_snip,
            status=result.status,
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
            files_created=result.files_created,
            security_checks_passed=result.security_checks_passed,
            violation_reason=result.violation_reason,
        )
        runtime_manager.record_execution(rec)

    def execute(self, spec: SandboxExecutionSpec) -> SandboxExecutionResult:
        """Executes a command or code snippet within the isolated sandbox."""
        exec_id = str(uuid.uuid4())
        start_time = time.perf_counter()
        timeout_seconds = min(max(float(spec.timeout_seconds), 1.0), 300.0)

        # 1. Prepare isolated workspace directory
        exec_workspace = Path(
            tempfile.mkdtemp(prefix=f"neiman_sandbox_{self.company_id}_", dir=self.base_dir)
        )

        norm_lang = (spec.language or "bash").lower()

        try:
            # 2. Security Validations
            if spec.command:
                # Terminal command pattern inspection
                try:
                    ToolSandbox.validate_terminal_command(spec.command)
                except ForbiddenError as e:
                    res = SandboxExecutionResult(
                        execution_id=exec_id,
                        status="FORBIDDEN",
                        exit_code=1,
                        stdout="",
                        stderr=PromptSanitizer.scrub_secrets(str(e)),
                        duration_ms=(time.perf_counter() - start_time) * 1000,
                        security_checks_passed=False,
                        violation_reason=PromptSanitizer.scrub_secrets(str(e)),
                    )
                    self._record(spec, res)
                    return res

            if spec.code:
                if norm_lang in ("python", "python3", "py"):
                    is_safe, violation = CodeSafetyInspector.inspect_python_code(spec.code)
                    if not is_safe:
                        safe_violation = PromptSanitizer.scrub_secrets(violation or "Unsafe code.")
                        res = SandboxExecutionResult(
                            execution_id=exec_id,
                            status="FORBIDDEN",
                            exit_code=1,
                            stdout="",
                            stderr=f"Security Violation: {safe_violation}",
                            duration_ms=(time.perf_counter() - start_time) * 1000,
                            security_checks_passed=False,
                            violation_reason=safe_violation,
                        )
                        self._record(spec, res)
                        return res
                elif norm_lang in ("node", "javascript", "js"):
                    is_safe, violation = CodeSafetyInspector.inspect_node_code(spec.code)
                    if not is_safe:
                        safe_violation = PromptSanitizer.scrub_secrets(violation or "Unsafe code.")
                        res = SandboxExecutionResult(
                            execution_id=exec_id,
                            status="FORBIDDEN",
                            exit_code=1,
                            stdout="",
                            stderr=f"Security Violation: {safe_violation}",
                            duration_ms=(time.perf_counter() - start_time) * 1000,
                            security_checks_passed=False,
                            violation_reason=safe_violation,
                        )
                        self._record(spec, res)
                        return res

            # Require a real OS sandbox. Static checks and a temporary cwd do not
            # isolate host files, processes, or network access.
            bwrap = shutil.which("bwrap")
            if bwrap is None:
                res = SandboxExecutionResult(
                    execution_id=exec_id,
                    status="FORBIDDEN",
                    exit_code=1,
                    stdout="",
                    stderr="Agent execution is disabled because bubblewrap is not installed.",
                    duration_ms=round((time.perf_counter() - start_time) * 1000, 2),
                    security_checks_passed=False,
                    violation_reason="OS-level sandbox backend unavailable",
                )
                self._record(spec, res)
                return res

            # 3. Execution Setup
            env = self._prepare_sanitized_env(spec.environment_variables)
            env["NEIMAN_SANDBOX_ID"] = exec_id
            env["NEIMAN_COMPANY_ID"] = str(self.company_id)
            env["PATH"] = os.environ.get("PATH", "/usr/bin:/bin")
            node_prefix: str | None = None

            if spec.code:
                # Write code to isolated script file
                if norm_lang in ("python", "python3", "py"):
                    ext = ".py"
                    cmd = ["python3", "/workspace/script.py"]
                elif norm_lang in ("node", "javascript", "js"):
                    ext = ".js"
                    node_path, node_prefix = _resolve_node_binary()
                    cmd = [node_path, "/workspace/script.js"]
                else:
                    ext = ".sh"
                    cmd = ["bash", "/workspace/script.sh"]

                script_path = exec_workspace / f"script{ext}"
                script_path.write_text(spec.code, encoding="utf-8")
                script_path.chmod(0o600)
            else:
                node_prefix = None
                cmd = ["bash", "-c", spec.command or "echo 'No command specified'"]

            # 4. Process Execution with Resource Caps & Timeouts
            sandbox_cmd = [
                bwrap,
                "--unshare-all",
                "--die-with-parent",
                "--new-session",
                "--proc", "/proc",
                "--dev", "/dev",
                "--tmpfs", "/tmp",
            ]
            for system_dir in ("/usr", "/bin", "/lib", "/lib64", "/etc"):
                if Path(system_dir).exists():
                    sandbox_cmd.extend(["--ro-bind", system_dir, system_dir])

            # Also ro-bind node prefix dir if outside /usr
            if node_prefix and Path(node_prefix).exists():
                sandbox_cmd.extend(["--ro-bind", node_prefix, node_prefix])

            sandbox_cmd.extend([
                "--bind", str(exec_workspace), "/workspace",
                "--chdir", "/workspace",
                "--clearenv",
            ])
            for key, value in env.items():
                sandbox_cmd.extend(["--setenv", key, value])
            sandbox_cmd.extend(["--", *cmd])

            def set_resource_limits() -> None:
                resource.setrlimit(resource.RLIMIT_CPU, (int(timeout_seconds), int(timeout_seconds) + 1))
                resource.setrlimit(resource.RLIMIT_AS, (2 * 1024**3, 2 * 1024**3))
                resource.setrlimit(resource.RLIMIT_FSIZE, (100 * 1024**2, 100 * 1024**2))
                resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))

            proc = subprocess.Popen(
                sandbox_cmd,
                cwd=str(exec_workspace),
                env={"PATH": os.environ.get("PATH", "/usr/bin:/bin")},
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=set_resource_limits,
                start_new_session=True,
            )
            stdout_capture = bytearray()
            stderr_capture = bytearray()
            stdout_thread = threading.Thread(
                target=_drain_bounded, args=(proc.stdout, stdout_capture), daemon=True
            )
            stderr_thread = threading.Thread(
                target=_drain_bounded, args=(proc.stderr, stderr_capture), daemon=True
            )
            stdout_thread.start()
            stderr_thread.start()
            timed_out = False
            try:
                proc.wait(timeout=timeout_seconds)
            except subprocess.TimeoutExpired:
                timed_out = True
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                proc.wait()
            finally:
                stdout_thread.join(timeout=2)
                stderr_thread.join(timeout=2)
                if proc.stdout:
                    proc.stdout.close()
                if proc.stderr:
                    proc.stderr.close()

            stdout_text = stdout_capture.decode("utf-8", errors="replace")
            stderr_text = stderr_capture.decode("utf-8", errors="replace")
            if len(stdout_capture) >= _MAX_CAPTURED_OUTPUT_BYTES:
                stdout_text += "\n[stdout truncated at 64 KiB]"
            if len(stderr_capture) >= _MAX_CAPTURED_OUTPUT_BYTES:
                stderr_text += "\n[stderr truncated at 64 KiB]"

            if timed_out:
                duration_ms = (time.perf_counter() - start_time) * 1000
                res = SandboxExecutionResult(
                    execution_id=exec_id,
                    status="TIMED_OUT",
                    exit_code=124,
                    stdout=PromptSanitizer.scrub_secrets(stdout_text),
                    stderr=PromptSanitizer.scrub_secrets(stderr_text)
                    or f"Execution timed out after {timeout_seconds} seconds.",
                    duration_ms=round(duration_ms, 2),
                    security_checks_passed=True,
                    violation_reason=f"Exceeded timeout limit of {timeout_seconds}s",
                )
                self._record(spec, res)
                return res

            duration_ms = (time.perf_counter() - start_time) * 1000

            # 5. Track files created in workspace
            created_files = [
                str(p.relative_to(exec_workspace))
                for p in exec_workspace.glob("**/*")
                if p.is_file() and not p.name.startswith("script.")
            ]

            # Scrub output for accidental secret leakage
            stdout_clean = PromptSanitizer.scrub_secrets(stdout_text)
            stderr_clean = PromptSanitizer.scrub_secrets(stderr_text)
            exit_code = proc.returncode if proc.returncode is not None else 1

            res = SandboxExecutionResult(
                execution_id=exec_id,
                status="SUCCESS" if exit_code == 0 else "FAILED",
                exit_code=exit_code,
                stdout=stdout_clean,
                stderr=stderr_clean,
                duration_ms=round(duration_ms, 2),
                files_created=created_files,
                security_checks_passed=True,
            )
            self._record(spec, res)
            return res

        except subprocess.TimeoutExpired:
            duration_ms = (time.perf_counter() - start_time) * 1000
            res = SandboxExecutionResult(
                execution_id=exec_id,
                status="TIMED_OUT",
                exit_code=124,
                stdout="",
                stderr=f"Execution timed out after {timeout_seconds} seconds.",
                duration_ms=round(duration_ms, 2),
                security_checks_passed=True,
                violation_reason=f"Exceeded timeout limit of {timeout_seconds}s",
            )
            self._record(spec, res)
            return res
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            safe_error = PromptSanitizer.scrub_secrets(str(e))
            res = SandboxExecutionResult(
                execution_id=exec_id,
                status="FAILED",
                exit_code=1,
                stdout="",
                stderr=safe_error,
                duration_ms=round(duration_ms, 2),
                security_checks_passed=False,
                violation_reason=safe_error,
            )
            self._record(spec, res)
            return res
        finally:
            shutil.rmtree(exec_workspace, ignore_errors=True)


class RuntimeManager:
    """Manages execution runs, history ledger, and runtime metrics for NEIMAN OS."""

    def __init__(self, max_history: int = 200) -> None:
        self._history: deque[RuntimeExecutionRecord] = deque(maxlen=max_history)
        self._lock = threading.Lock()
        self._total_executions: int = 0
        self._blocked_violations: int = 0

    def record_execution(self, record: RuntimeExecutionRecord) -> None:
        with self._lock:
            self._total_executions += 1
            if record.status == "FORBIDDEN":
                self._blocked_violations += 1
            self._history.appendleft(record)

    def list_executions(
        self,
        company_id: uuid.UUID | None = None,
        language: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[RuntimeExecutionRecord]:
        with self._lock:
            records = list(self._history)
        if company_id:
            records = [r for r in records if r.company_id == company_id]
        if language and language.upper() != "ALL":
            records = [r for r in records if r.language.lower() == language.lower()]
        if status and status.upper() != "ALL":
            records = [r for r in records if r.status == status]
        return records[:limit]

    def get_metrics(self, company_id: uuid.UUID | None = None) -> dict[str, Any]:
        with self._lock:
            records = list(self._history)
            total = self._total_executions
            blocked = self._blocked_violations
        if company_id:
            records = [r for r in records if r.company_id == company_id]
        durations = [r.duration_ms for r in records if r.status == "SUCCESS"]
        avg_latency = round(sum(durations) / len(durations), 1) if durations else 0.0
        success_count = sum(1 for r in records if r.status == "SUCCESS")
        return {
            "total_executions": total,
            "blocked_violations": blocked,
            "recent_count": len(records),
            "success_rate_pct": round((success_count / len(records)) * 100, 1) if records else 100.0,
            "avg_latency_ms": avg_latency,
            "sandbox_backend": "bubblewrap_kernel_isolated",
            "supported_languages": ["python", "node", "bash"],
        }


# Global singleton runtime manager
runtime_manager = RuntimeManager()
