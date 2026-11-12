"""
Terminal Service & Session Management for NEIMAN OS.

Manages interactive bash pseudoterminals (PTY), process life-cycles,
bidirectional I/O streaming, window resizing, and REST command fallbacks.
"""

from __future__ import annotations

import asyncio
from collections import deque
import fcntl
import os
import pty
import shutil
import signal
import struct
import subprocess
import termios
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Coroutine, Any
import uuid
import structlog

logger = structlog.get_logger(__name__)

DEFAULT_WORKING_DIR = str(Path(__file__).resolve().parents[4])  # /home/devine-general/Projects/Sila


class TerminalSession:
    """Represents a single interactive PTY bash session."""

    def __init__(
        self,
        session_id: str,
        company_id: str,
        title: str,
        working_dir: str | None = None,
        user_id: str | None = None,
        cols: int = 120,
        rows: int = 34,
        environment_variables: dict[str, str] | None = None,
    ) -> None:
        self.session_id = session_id
        self.company_id = company_id
        self.title = title
        self.user_id = user_id
        self.cols = cols
        self.rows = rows
        self.created_at = datetime.now(timezone.utc).isoformat()
        resolved_default = DEFAULT_WORKING_DIR
        try:
            from nexora.domains.vcs.service import get_company_workspace_dir
            resolved_default = str(get_company_workspace_dir(company_id))
        except Exception:
            pass
        self.working_dir = working_dir or resolved_default
        if not os.path.isdir(self.working_dir):
            self.working_dir = resolved_default

        self.environment_variables = environment_variables or {}
        self.history: deque[str] = deque(maxlen=200)
        self.backlog: deque[str] = deque(maxlen=2000)

        self.master_fd: int | None = None
        self.process: subprocess.Popen[bytes] | None = None
        self.pid: int | None = None
        self.is_active: bool = False
        self._reader_task: asyncio.Task[None] | None = None
        self._subscribers: set[Callable[[str], Coroutine[Any, Any, None]]] = set()

    def start(self, initial_command: str | None = None) -> None:
        """Spawn the interactive pseudoterminal and child bash process."""
        if self.is_active:
            return

        master_fd, slave_fd = pty.openpty()
        self.master_fd = master_fd

        # Set terminal dimensions
        try:
            winsize = struct.pack("HHHH", self.rows, self.cols, 0, 0)
            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
        except Exception:
            pass

        # Prepare environment
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["LANG"] = "C.UTF-8"
        env["LC_ALL"] = "C.UTF-8"
        env["PWD"] = self.working_dir
        env["NEIMAN_COMPANY_ID"] = self.company_id
        env["NEIMAN_SESSION_ID"] = self.session_id
        env["PS1"] = r"\[\033[01;32m\]neiman@host\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "
        for k, v in self.environment_variables.items():
            env[k] = v

        # Locate bash
        bash_path = shutil.which("bash") or "/bin/bash"

        try:
            self.process = subprocess.Popen(
                [bash_path, "-i"],
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=self.working_dir,
                env=env,
                close_fds=True,
                preexec_fn=os.setsid,
            )
            os.close(slave_fd)
            self.pid = self.process.pid
            self.is_active = True

            # Make master_fd non-blocking
            flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
            fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

            # Initial greeting banner
            greeting = f"\x1b[1;36m=== NEIMAN Sovereign Integrated Bash Terminal ===\x1b[0m\r\n\x1b[90mSession: {self.session_id[:8]} | Dir: {self.working_dir} | PID: {self.pid}\x1b[0m\r\n\r\n"
            self.backlog.append(greeting)

            # Start asyncio reader loop if event loop is running
            try:
                loop = asyncio.get_running_loop()
                self._reader_task = loop.create_task(self._read_loop())
            except RuntimeError:
                pass

            if initial_command:
                self.write(f"{initial_command}\n")

            logger.info("terminal_session_started", session_id=self.session_id, pid=self.pid)
        except Exception as exc:
            if self.master_fd is not None:
                try:
                    os.close(self.master_fd)
                except Exception:
                    pass
                self.master_fd = None
            self.is_active = False
            logger.error("terminal_session_start_failed", session_id=self.session_id, error=str(exc))
            raise

    async def _read_loop(self) -> None:
        """Continuously read output chunks from PTY master and broadcast."""
        while self.is_active and self.master_fd is not None:
            try:
                data = os.read(self.master_fd, 4096)
                if not data:
                    break
                text = data.decode("utf-8", errors="replace")
                self.backlog.append(text)

                # Broadcast to connected WebSocket subscribers
                for subscriber in list(self._subscribers):
                    try:
                        await subscriber(text)
                    except Exception:
                        pass
            except BlockingIOError:
                await asyncio.sleep(0.015)
            except (OSError, ValueError):
                break
            except Exception as e:
                logger.warning("terminal_reader_exception", session_id=self.session_id, error=str(e))
                break

        self.is_active = False

    def subscribe(self, callback: Callable[[str], Coroutine[Any, Any, None]]) -> None:
        """Register a subscriber callback for live stdout chunks."""
        self._subscribers.add(callback)
        if self._reader_task is None or self._reader_task.done():
            try:
                loop = asyncio.get_running_loop()
                self._reader_task = loop.create_task(self._read_loop())
            except RuntimeError:
                pass

    def unsubscribe(self, callback: Callable[[str], Coroutine[Any, Any, None]]) -> None:
        """Unregister a subscriber."""
        self._subscribers.discard(callback)

    def write(self, data: str | bytes) -> None:
        """Write raw keystrokes or input text directly into the PTY master_fd."""
        if not self.is_active or self.master_fd is None:
            return
        payload = data.encode("utf-8") if isinstance(data, str) else data
        try:
            os.write(self.master_fd, payload)
        except Exception as exc:
            logger.warning("terminal_write_error", session_id=self.session_id, error=str(exc))

    def resize(self, cols: int, rows: int) -> None:
        """Update PTY window columns and rows."""
        self.cols = max(20, min(500, cols))
        self.rows = max(5, min(200, rows))
        if self.master_fd is not None:
            try:
                winsize = struct.pack("HHHH", self.rows, self.cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except Exception:
                pass

    def send_signal(self, sig_name: str = "SIGINT") -> None:
        """Deliver POSIX signal to child process."""
        sig_map = {
            "SIGINT": signal.SIGINT,
            "SIGTERM": signal.SIGTERM,
            "SIGKILL": signal.SIGKILL,
            "SIGHUP": signal.SIGHUP,
        }
        target_sig = sig_map.get(sig_name.upper(), signal.SIGINT)

        if target_sig == signal.SIGINT:
            self.write("\x03")

        if self.pid:
            try:
                os.kill(self.pid, target_sig)
            except ProcessLookupError:
                pass

    async def exec_command(self, command: str, timeout_seconds: float = 30.0) -> dict[str, Any]:
        """
        Headless / REST fallback command execution within this session's working directory.
        Tracks working directory transitions (e.g. `cd dir`) and records into history.
        """
        start_time = time.perf_counter()
        self.history.append(command)

        # Wrap with cwd capture to track directory navigation
        wrapped_script = f"""
cd "{self.working_dir}"
{command}
__EXIT_CODE__=$?
echo "\n__NEIMAN_CWD_PROBE__=$(pwd)"
exit $__EXIT_CODE__
"""
        proc = await asyncio.create_subprocess_exec(
            shutil.which("bash") or "/bin/bash",
            "-c",
            wrapped_script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=self.working_dir,
            env={
                **os.environ,
                "TERM": "xterm-256color",
                "PWD": self.working_dir,
                "NEIMAN_COMPANY_ID": self.company_id,
                "NEIMAN_SESSION_ID": self.session_id,
            },
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout_seconds,
            )
            raw_stdout = stdout_bytes.decode("utf-8", errors="replace")
            raw_stderr = stderr_bytes.decode("utf-8", errors="replace")
            exit_code = proc.returncode or 0
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            raw_stdout = ""
            raw_stderr = f"Command timed out after {timeout_seconds}s"
            exit_code = 124

        # Extract and update probed cwd
        new_cwd = self.working_dir
        if "__NEIMAN_CWD_PROBE__=" in raw_stdout:
            parts = raw_stdout.split("__NEIMAN_CWD_PROBE__=")
            raw_stdout = parts[0].rstrip("\n")
            if len(parts) > 1:
                probed = parts[1].strip().split("\n")[0].strip()
                if os.path.isdir(probed):
                    new_cwd = probed
                    self.working_dir = probed

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Append to live terminal backlog so REST execs show in terminal view
        combined_output = f"\r\n\x1b[32m$\x1b[0m {command}\r\n{raw_stdout}\r\n"
        if raw_stderr:
            combined_output += f"\x1b[31m{raw_stderr}\x1b[0m\r\n"
        self.backlog.append(combined_output)

        return {
            "session_id": self.session_id,
            "command": command,
            "exit_code": exit_code,
            "stdout": raw_stdout,
            "stderr": raw_stderr,
            "working_dir": new_cwd,
            "duration_ms": duration_ms,
        }

    def close(self) -> None:
        """Terminate child process and close PTY descriptor."""
        self.is_active = False
        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()

        if self.pid:
            try:
                os.killpg(os.getpgid(self.pid), signal.SIGTERM)
            except Exception:
                try:
                    os.kill(self.pid, signal.SIGTERM)
                except Exception:
                    pass

        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None

        logger.info("terminal_session_closed", session_id=self.session_id)


class TerminalManager:
    """Registry and orchestrator for all company terminal sessions."""

    def __init__(self) -> None:
        # company_id -> { session_id -> TerminalSession }
        self._sessions: dict[str, dict[str, TerminalSession]] = {}

    def get_or_create_default_session(self, company_id: str, user_id: str | None = None) -> TerminalSession:
        """Return the primary active session or create one if none exists."""
        company_key = str(company_id)
        if company_key in self._sessions and self._sessions[company_key]:
            active = [s for s in self._sessions[company_key].values() if s.is_active]
            if active:
                return active[0]

        return self.create_session(
            company_id=company_key,
            title="Terminal 1 (bash)",
            user_id=user_id,
        )

    def create_session(
        self,
        company_id: str,
        title: str | None = None,
        working_dir: str | None = None,
        user_id: str | None = None,
        cols: int = 120,
        rows: int = 34,
        environment_variables: dict[str, str] | None = None,
        initial_command: str | None = None,
    ) -> TerminalSession:
        """Create and start a new terminal session."""
        company_key = str(company_id)
        if company_key not in self._sessions:
            self._sessions[company_key] = {}

        # Max 10 active sessions per company
        active_count = sum(1 for s in self._sessions[company_key].values() if s.is_active)
        if active_count >= 10:
            # Terminate the oldest session
            oldest = min(self._sessions[company_key].values(), key=lambda s: s.created_at)
            self.close_session(company_key, oldest.session_id)

        session_id = str(uuid.uuid4())
        session_title = title or f"Terminal {len(self._sessions[company_key]) + 1} (bash)"
        session = TerminalSession(
            session_id=session_id,
            company_id=company_key,
            title=session_title,
            working_dir=working_dir,
            user_id=user_id,
            cols=cols,
            rows=rows,
            environment_variables=environment_variables,
        )
        session.start(initial_command=initial_command)
        self._sessions[company_key][session_id] = session
        return session

    def get_session(self, company_id: str, session_id: str) -> TerminalSession | None:
        """Retrieve a session by ID."""
        return self._sessions.get(str(company_id), {}).get(session_id)

    def list_sessions(self, company_id: str) -> list[TerminalSession]:
        """List all active and recent sessions for a company."""
        return list(self._sessions.get(str(company_id), {}).values())

    def close_session(self, company_id: str, session_id: str) -> bool:
        """Close and remove a session."""
        company_key = str(company_id)
        session = self._sessions.get(company_key, {}).get(session_id)
        if session:
            session.close()
            del self._sessions[company_key][session_id]
            return True
        return False


# Singleton instance
terminal_manager = TerminalManager()

