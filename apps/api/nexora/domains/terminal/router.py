"""
REST and WebSocket API Router for NEIMAN Integrated Bash Terminal.

Provides interactive bidirectional PTY streaming over WebSocket
and HTTP REST endpoints for terminal session management.
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from nexora.core.permissions import require_member, require_viewer
from nexora.database import get_db
from nexora.domains.activity.broadcaster import activity_broadcaster
from nexora.domains.activity.schemas import ActivityEvent, ActivityEventType, ActivitySeverity
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.terminal.schemas import (
    TerminalExecRequest,
    TerminalExecResponse,
    TerminalHistoryResponse,
    TerminalResizeRequest,
    TerminalSessionCreate,
    TerminalSessionResponse,
    TerminalSignalRequest,
)
from nexora.domains.terminal.service import TerminalSession, terminal_manager

logger = structlog.get_logger(__name__)

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(prefix="/companies/{company_id}/terminal", tags=["Integrated Bash Terminal"])


def _to_response(session: TerminalSession) -> TerminalSessionResponse:
    return TerminalSessionResponse(
        id=session.session_id,
        company_id=session.company_id,
        user_id=session.user_id,
        title=session.title,
        working_dir=session.working_dir,
        created_at=session.created_at,
        is_active=session.is_active,
        pid=session.pid,
        cols=session.cols,
        rows=session.rows,
    )


@router.get("/sessions", response_model=list[TerminalSessionResponse])
async def list_terminal_sessions(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
) -> list[TerminalSessionResponse]:
    """List all interactive terminal sessions for this company."""
    sessions = terminal_manager.list_sessions(str(company_id))
    if not sessions:
        # Create a default session if none exists
        default_session = terminal_manager.get_or_create_default_session(
            str(company_id),
            user_id=str(current_user.id) if current_user else None,
        )
        return [_to_response(default_session)]
    return [_to_response(s) for s in sessions]


@router.post("/sessions", response_model=TerminalSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_terminal_session(
    company_id: uuid.UUID,
    req: TerminalSessionCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
) -> TerminalSessionResponse:
    """Spawn a new interactive bash terminal session."""
    session = terminal_manager.create_session(
        company_id=str(company_id),
        title=req.title,
        working_dir=req.working_dir,
        user_id=str(current_user.id) if current_user else None,
        cols=req.cols,
        rows=req.rows,
        environment_variables=req.environment_variables,
        initial_command=req.initial_command,
    )

    # Broadcast activity event
    event = ActivityEvent(
        company_id=str(company_id),
        event_type=ActivityEventType.RUNTIME_EXECUTION_COMPLETED,
        severity=ActivitySeverity.INFO,
        title=f"Terminal Session Spawned: {session.title}",
        summary=f"PID {session.pid} running bash at {session.working_dir}",
    )
    await activity_broadcaster.broadcast(str(company_id), event, session=db)

    return _to_response(session)


@router.get("/sessions/{session_id}", response_model=TerminalSessionResponse)
async def get_terminal_session(
    company_id: uuid.UUID,
    session_id: str,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
) -> TerminalSessionResponse:
    """Retrieve details for a specific terminal session."""
    session = terminal_manager.get_session(str(company_id), session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Terminal session not found")
    return _to_response(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def close_terminal_session(
    company_id: uuid.UUID,
    session_id: str,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
) -> None:
    """Terminate and remove a terminal session."""
    success = terminal_manager.close_session(str(company_id), session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Terminal session not found")


@router.post("/sessions/{session_id}/exec", response_model=TerminalExecResponse)
async def exec_in_terminal_session(
    company_id: uuid.UUID,
    session_id: str,
    req: TerminalExecRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
) -> TerminalExecResponse:
    """
    Execute a bash command in the terminal session's working directory (headless/REST fallback).
    Tracks cwd changes (e.g. `cd src`) and appends output to the session stream.
    """
    session = terminal_manager.get_session(str(company_id), session_id)
    if not session:
        session = terminal_manager.get_or_create_default_session(
            str(company_id),
            user_id=str(current_user.id) if current_user else None,
        )

    res = await session.exec_command(req.command, timeout_seconds=req.timeout_seconds)
    return TerminalExecResponse(**res)


@router.post("/sessions/{session_id}/resize", status_code=status.HTTP_200_OK)
async def resize_terminal_session(
    company_id: uuid.UUID,
    session_id: str,
    req: TerminalResizeRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
) -> dict[str, Any]:
    """Resize the terminal window columns and rows."""
    session = terminal_manager.get_session(str(company_id), session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Terminal session not found")
    session.resize(req.cols, req.rows)
    return {"status": "ok", "cols": session.cols, "rows": session.rows}


@router.post("/sessions/{session_id}/signal", status_code=status.HTTP_200_OK)
async def send_signal_to_terminal_session(
    company_id: uuid.UUID,
    session_id: str,
    req: TerminalSignalRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
) -> dict[str, Any]:
    """Send a POSIX signal (SIGINT, SIGTERM, SIGKILL) to the terminal process."""
    session = terminal_manager.get_session(str(company_id), session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Terminal session not found")
    session.send_signal(req.signal)
    return {"status": "ok", "signal": req.signal}


@router.get("/sessions/{session_id}/history", response_model=TerminalHistoryResponse)
async def get_terminal_history(
    company_id: uuid.UUID,
    session_id: str,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
) -> TerminalHistoryResponse:
    """Get the recent command history and scrollback buffer for a session."""
    session = terminal_manager.get_session(str(company_id), session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Terminal session not found")
    return TerminalHistoryResponse(
        session_id=session.session_id,
        history=list(session.history),
        backlog="".join(session.backlog),
    )


# ── Realtime Bidirectional WebSocket Terminal Stream ──

async def _verify_ws_auth(websocket: WebSocket, company_id: uuid.UUID) -> bool:
    """Validate Bearer token or development mode before accepting WebSocket."""
    from nexora.domains.activity.router import _websocket_member_allowed
    return await _websocket_member_allowed(websocket, company_id)


@router.websocket("/ws")
@router.websocket("/sessions/{session_id}/ws")
async def terminal_websocket(
    websocket: WebSocket,
    company_id: uuid.UUID,
    session_id: str | None = None,
):
    """
    Realtime bidirectional interactive bash terminal WebSocket stream.
    Directly streams client keystrokes into PTY stdin and child PTY stdout to client.
    """
    if not await _verify_ws_auth(websocket, company_id):
        await websocket.close(code=1008, reason="Authentication and company membership required")
        return

    await websocket.accept()
    company_key = str(company_id)

    # Resolve or create session
    if session_id:
        session = terminal_manager.get_session(company_key, session_id)
    else:
        session = None

    if not session:
        session = terminal_manager.get_or_create_default_session(company_key)

    # Subscriber callback pushing terminal chunks to client
    async def _send_chunk(chunk: str):
        try:
            await websocket.send_text(json.dumps({"type": "output", "data": chunk}))
        except Exception:
            pass

    session.subscribe(_send_chunk)

    try:
        # Send initial backlog to hydrate the client terminal screen
        initial_backlog = "".join(session.backlog)
        await websocket.send_text(
            json.dumps({
                "type": "init",
                "session_id": session.session_id,
                "title": session.title,
                "working_dir": session.working_dir,
                "pid": session.pid,
                "cols": session.cols,
                "rows": session.rows,
                "backlog": initial_backlog,
            })
        )

        while True:
            raw_msg = await websocket.receive_text()
            if not raw_msg:
                continue

            # Try parsing structured protocol frame
            try:
                msg = json.loads(raw_msg)
                msg_type = msg.get("type", "input")

                if msg_type == "input":
                    data = msg.get("data", "")
                    if data:
                        session.write(data)
                elif msg_type == "resize":
                    cols = int(msg.get("cols", 120))
                    rows = int(msg.get("rows", 34))
                    session.resize(cols, rows)
                elif msg_type == "signal":
                    sig = str(msg.get("signal", "SIGINT"))
                    session.send_signal(sig)
                elif msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                # Raw text keystrokes
                session.write(raw_msg)

    except WebSocketDisconnect:
        session.unsubscribe(_send_chunk)
    except Exception as exc:
        logger.warning("terminal_ws_error", session_id=session.session_id, error=str(exc))
        session.unsubscribe(_send_chunk)
