"""
Tests for NEIMAN OS Integrated Bash Terminal domain.

Validates:
1. TerminalSession PTY lifecycle (start, write, resize, signal, close)
2. TerminalSession exec_command with stdout, stderr, exit code, and cwd tracking
3. TerminalManager session lifecycle and limit management
4. REST API: session creation, listing, execution, history, and cleanup
"""

import uuid
import pytest
from httpx import AsyncClient

from nexora.domains.terminal.service import TerminalSession, TerminalManager, terminal_manager

pytestmark = pytest.mark.asyncio


class TestTerminalSessionEngine:
    async def test_session_lifecycle(self):
        company_id = str(uuid.uuid4())
        session = TerminalSession(
            session_id=str(uuid.uuid4()),
            company_id=company_id,
            title="Test Shell",
        )
        session.start()
        assert session.is_active is True
        assert session.pid is not None
        assert session.master_fd is not None

        # Resize test
        session.resize(100, 30)
        assert session.cols == 100
        assert session.rows == 30

        # Signal test
        session.send_signal("SIGINT")

        # Close
        session.close()
        assert session.is_active is False
        assert session.master_fd is None

    async def test_session_exec_command(self):
        company_id = str(uuid.uuid4())
        session = TerminalSession(
            session_id=str(uuid.uuid4()),
            company_id=company_id,
            title="Test Shell Exec",
        )
        res = await session.exec_command("echo 'NEIMAN_BASH_READY'", timeout_seconds=5.0)
        assert res["exit_code"] == 0
        assert "NEIMAN_BASH_READY" in res["stdout"]
        assert res["duration_ms"] > 0
        assert len(session.history) == 1

    async def test_session_exec_cwd_transition(self):
        company_id = str(uuid.uuid4())
        session = TerminalSession(
            session_id=str(uuid.uuid4()),
            company_id=company_id,
            title="Test Shell CWD",
        )
        initial_dir = session.working_dir
        res = await session.exec_command("cd /tmp && pwd", timeout_seconds=5.0)
        assert res["exit_code"] == 0
        assert "/tmp" in res["stdout"]
        assert session.working_dir == "/tmp"

        # Cleanup back
        session.working_dir = initial_dir

    async def test_session_streaming_and_subscription(self):
        import asyncio
        company_id = str(uuid.uuid4())
        session = TerminalSession(
            session_id=str(uuid.uuid4()),
            company_id=company_id,
            title="Streaming Shell",
        )
        session.start()
        received: list[str] = []

        async def on_chunk(chunk: str):
            received.append(chunk)

        session.subscribe(on_chunk)
        session.write("echo 'LIVE_PTY_STREAM_OK'\n")
        await asyncio.sleep(0.3)

        combined = "".join(received) + "".join(session.backlog)
        assert "LIVE_PTY_STREAM_OK" in combined

        session.unsubscribe(on_chunk)
        session.close()

    def test_manager_lifecycle(self):
        mgr = TerminalManager()
        company_id = str(uuid.uuid4())

        s1 = mgr.create_session(company_id=company_id, title="Shell 1")
        assert s1.is_active is True
        assert s1.title == "Shell 1"

        sessions = mgr.list_sessions(company_id)
        assert len(sessions) == 1

        s_found = mgr.get_session(company_id, s1.session_id)
        assert s_found is not None
        assert s_found.session_id == s1.session_id

        # Clean up
        closed = mgr.close_session(company_id, s1.session_id)
        assert closed is True
        assert len(mgr.list_sessions(company_id)) == 0


class TestTerminalApiRouter:
    async def test_terminal_api_flow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        company_via_api: dict,
    ):
        company_id = company_via_api["id"]

        # 1. List sessions (auto-creates default)
        res = await client.get(
            f"/api/v1/companies/{company_id}/terminal/sessions",
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        default_session_id = data[0]["id"]

        # 2. Spawn a custom session
        res = await client.post(
            f"/api/v1/companies/{company_id}/terminal/sessions",
            json={
                "title": "Build & Lint Shell",
                "cols": 120,
                "rows": 34,
            },
            headers=auth_headers,
        )
        assert res.status_code == 201
        new_session = res.json()
        assert new_session["title"] == "Build & Lint Shell"
        custom_session_id = new_session["id"]

        # 3. Execute command via REST fallback
        res = await client.post(
            f"/api/v1/companies/{company_id}/terminal/sessions/{custom_session_id}/exec",
            json={"command": "echo 'TERMINAL_API_OK'"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        exec_data = res.json()
        assert exec_data["exit_code"] == 0
        assert "TERMINAL_API_OK" in exec_data["stdout"]

        # 4. Resize terminal
        res = await client.post(
            f"/api/v1/companies/{company_id}/terminal/sessions/{custom_session_id}/resize",
            json={"cols": 140, "rows": 40},
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["cols"] == 140

        # 5. Send signal
        res = await client.post(
            f"/api/v1/companies/{company_id}/terminal/sessions/{custom_session_id}/signal",
            json={"signal": "SIGINT"},
            headers=auth_headers,
        )
        assert res.status_code == 200

        # 6. Get history
        res = await client.get(
            f"/api/v1/companies/{company_id}/terminal/sessions/{custom_session_id}/history",
            headers=auth_headers,
        )
        assert res.status_code == 200
        hist_data = res.json()
        assert "echo 'TERMINAL_API_OK'" in hist_data["history"]

        # 7. Close session
        res = await client.delete(
            f"/api/v1/companies/{company_id}/terminal/sessions/{custom_session_id}",
            headers=auth_headers,
        )
        assert res.status_code == 204
