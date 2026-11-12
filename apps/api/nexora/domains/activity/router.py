"""REST and WebSocket router for Realtime Organizational Activity."""

import asyncio
import json
import uuid

import structlog
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.config import get_settings
from nexora.core.enums import MembershipRole
from nexora.core.permissions import require_member, require_viewer
from nexora.database import get_db
from nexora.domains.activity.broadcaster import activity_broadcaster
from nexora.domains.activity.schemas import ActivityEvent

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/companies/{company_id}/activity", tags=["Realtime Activity"])


@router.get("", response_model=list[ActivityEvent])
async def get_recent_activity(
    company_id: uuid.UUID,
    agent: str | None = Query(None, description="Filter by agent name substring"),
    department: str | None = Query(None, description="Filter by department name substring"),
    project: str | None = Query(None, description="Filter by project name substring"),
    event: str | None = Query(None, description="Filter by event type"),
    severity: str | None = Query(None, description="Filter by severity level"),
    limit: int = Query(50, ge=1, le=200),
    _user=Depends(require_viewer()),
):
    """Retrieve recent activity events with server-side filtering."""
    return await activity_broadcaster.get_recent_events(
        company_id=str(company_id),
        agent=agent,
        department=department,
        project=project,
        event_type=event,
        severity=severity,
        limit=limit,
    )


@router.post("/emit", response_model=ActivityEvent)
async def emit_activity_event(
    company_id: uuid.UUID,
    event: ActivityEvent,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_member()),
):
    """Emit an activity event into the organization's realtime stream."""
    company_key = str(company_id)
    event.company_id = company_key
    event.id = str(uuid.uuid4())
    await activity_broadcaster.broadcast(company_key, event, session=db)
    return event


async def _websocket_member_allowed(websocket: WebSocket, company_id: uuid.UUID) -> bool:
    """Validate a bearer session and company membership before accepting a socket."""
    from sqlalchemy import select

    from nexora.database import get_session_factory
    from nexora.domains.auth.models import User
    from nexora.domains.auth.service import AuthService
    from nexora.domains.organizations.repository import CompanyMemberRepository

    settings = get_settings()
    authorization = websocket.headers.get("authorization", "")
    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""

    try:
        async with get_session_factory()() as session:
            if token:
                user = await AuthService(session).get_current_user(token)
            elif settings.DISABLE_AUTH:
                result = await session.execute(
                    select(User).where(User.is_active.is_(True)).limit(1)
                )
                user = result.scalars().first()
            else:
                return False

            if user is None:
                return False
            membership = await CompanyMemberRepository(session).get_membership(
                company_id=company_id,
                user_id=user.id,
            )
            return bool(
                membership and MembershipRole(membership.role).can(MembershipRole.VIEWER)
            )
    except Exception:
        return False


@router.websocket("/ws")
async def activity_websocket(
    websocket: WebSocket,
    company_id: uuid.UUID,
):
    """Realtime WebSocket endpoint streaming organizational activity events live as they occur."""
    if not await _websocket_member_allowed(websocket, company_id):
        await websocket.close(code=1008, reason="Authentication and company membership required")
        return
    company_key = str(company_id)
    await activity_broadcaster.connect_ws(company_key, websocket)
    try:
        # Send initial recent events to hydrate client immediately upon connect
        recent = await activity_broadcaster.get_recent_events(company_id=company_key, limit=20)
        for ev in reversed(recent):
            await websocket.send_text(json.dumps(ev.model_dump(mode="json")))

        # Keep connection open & handle incoming client messages (e.g. heartbeat ping/pong)
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        await activity_broadcaster.disconnect_ws(company_key, websocket)
    except Exception as e:
        logger.warning("websocket_error", company_id=company_id, error=str(e))
        await activity_broadcaster.disconnect_ws(company_key, websocket)


@router.get("/stream")
async def activity_sse_stream(
    company_id: uuid.UUID,
    _user=Depends(require_viewer()),
):
    """Server-Sent Events (SSE) fallback transport streaming live organizational activity events."""
    company_key = str(company_id)
    queue = await activity_broadcaster.connect_sse(company_key)

    async def event_generator():
        try:
            # Yield initial recent events
            recent = await activity_broadcaster.get_recent_events(company_id=company_key, limit=20)
            for ev in reversed(recent):
                data = json.dumps(ev.model_dump(mode="json"))
                yield f"data: {data}\n\n"

            while True:
                ev = await queue.get()
                data = json.dumps(ev.model_dump(mode="json"))
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await activity_broadcaster.disconnect_sse(company_key, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
