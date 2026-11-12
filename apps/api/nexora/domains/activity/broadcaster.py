"""Realtime Activity Event Broadcaster with in-memory fan-out to WebSocket and SSE clients."""

import asyncio
import json
import uuid
from collections import defaultdict

import structlog
from fastapi import WebSocket
from sqlalchemy import event as sqlalchemy_event

from nexora.core.security import PromptSanitizer
from nexora.domains.activity.schemas import ActivityEvent

logger = structlog.get_logger(__name__)
_SSE_QUEUE_MAX_EVENTS = 100
_WEBSOCKET_SEND_TIMEOUT_SECONDS = 2.0


def _scrub_event_value(value):
    """Redact secret-like strings before an activity event is persisted or emitted."""
    if isinstance(value, str):
        return PromptSanitizer.scrub_secrets(value)
    if isinstance(value, dict):
        return {
            _scrub_event_value(key): _scrub_event_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_scrub_event_value(item) for item in value]
    return value


def _scrub_event(event: ActivityEvent) -> ActivityEvent:
    """Return a safe copy so storage, WebSocket and SSE all receive the same data."""
    return event.model_copy(update={
        "title": _scrub_event_value(event.title),
        "summary": _scrub_event_value(event.summary),
        "agent_name": _scrub_event_value(event.agent_name),
        "department_name": _scrub_event_value(event.department_name),
        "project_name": _scrub_event_value(event.project_name),
        "payload": _scrub_event_value(event.payload),
    })


class ActivityBroadcaster:
    """Manages active WebSockets and SSE listener queues per organization."""

    def __init__(self):
        # company_id -> set of active WebSockets
        self._ws_connections: dict[str, set[WebSocket]] = defaultdict(set)
        # company_id -> set of asyncio.Queue for SSE streams
        self._sse_queues: dict[str, set[asyncio.Queue[ActivityEvent]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect_ws(self, company_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._ws_connections[company_id].add(websocket)
        logger.info("ws_client_connected", company_id=company_id)

    async def disconnect_ws(self, company_id: str, websocket: WebSocket):
        async with self._lock:
            self._ws_connections[company_id].discard(websocket)
        logger.info("ws_client_disconnected", company_id=company_id)

    async def connect_sse(self, company_id: str) -> asyncio.Queue[ActivityEvent]:
        q: asyncio.Queue[ActivityEvent] = asyncio.Queue(maxsize=_SSE_QUEUE_MAX_EVENTS)
        async with self._lock:
            self._sse_queues[company_id].add(q)
        return q

    async def disconnect_sse(self, company_id: str, q: asyncio.Queue[ActivityEvent]):
        async with self._lock:
            self._sse_queues[company_id].discard(q)

    async def get_recent_events(
        self,
        company_id: str,
        agent: str | None = None,
        department: str | None = None,
        project: str | None = None,
        event_type: str | None = None,
        severity: str | None = None,
        limit: int = 50,
    ) -> list[ActivityEvent]:
        from sqlalchemy import select

        from nexora.database import get_session_factory
        from nexora.domains.activity.models import ActivityEventRecord

        statement = select(ActivityEventRecord).where(
            ActivityEventRecord.company_id == uuid.UUID(company_id)
        )
        if agent:
            statement = statement.where(ActivityEventRecord.agent_name.ilike(f"%{agent}%"))
        if department:
            statement = statement.where(ActivityEventRecord.department_name.ilike(f"%{department}%"))
        if project:
            statement = statement.where(ActivityEventRecord.project_name.ilike(f"%{project}%"))
        if event_type and event_type != "ALL":
            statement = statement.where(ActivityEventRecord.event_type == event_type)
        if severity and severity != "ALL":
            statement = statement.where(ActivityEventRecord.severity == severity)
        statement = statement.order_by(ActivityEventRecord.timestamp.desc()).limit(limit)

        async with get_session_factory()() as session:
            records = (await session.execute(statement)).scalars().all()
        return [
            _scrub_event(ActivityEvent(
                id=record.id,
                company_id=str(record.company_id),
                event_type=record.event_type,
                severity=record.severity,
                title=record.title,
                summary=record.summary,
                agent_id=record.agent_id,
                agent_name=record.agent_name,
                department_id=record.department_id,
                department_name=record.department_name,
                project_id=record.project_id,
                project_name=record.project_name,
                payload=record.payload,
                timestamp=record.timestamp,
            ))
            for record in records
        ]

    async def broadcast(self, company_id: str, event: ActivityEvent, session=None):
        """Persist an activity event, then fan it out only after its transaction commits."""
        from nexora.domains.activity.models import ActivityEventRecord

        event = _scrub_event(event)

        record = ActivityEventRecord(
            id=event.id,
            company_id=uuid.UUID(company_id),
            event_type=event.event_type.value,
            severity=event.severity.value,
            title=event.title,
            summary=event.summary,
            agent_id=event.agent_id,
            agent_name=event.agent_name,
            department_id=event.department_id,
            department_name=event.department_name,
            project_id=event.project_id,
            project_name=event.project_name,
            payload=json.loads(json.dumps(event.payload, default=str)),
            timestamp=event.timestamp,
        )
        if session is not None:
            session.add(record)
            await session.flush()
            sync_session = session.sync_session
            pending_key = "nexora_activity_post_commit"
            pending = sync_session.info.setdefault(pending_key, [])
            pending.append((company_id, event))
            if len(pending) == 1:
                def after_commit(committed_session):
                    queued = committed_session.info.pop(pending_key, [])
                    if sqlalchemy_event.contains(committed_session, "after_rollback", after_rollback):
                        sqlalchemy_event.remove(committed_session, "after_rollback", after_rollback)
                    try:
                        loop = asyncio.get_running_loop()
                    except RuntimeError:
                        logger.error("activity_fanout_skipped", reason="event_loop_unavailable")
                        return
                    for queued_company_id, queued_event in queued:
                        loop.create_task(self._fanout(queued_company_id, queued_event))

                def after_rollback(rolled_back_session):
                    rolled_back_session.info.pop(pending_key, None)
                    if sqlalchemy_event.contains(rolled_back_session, "after_commit", after_commit):
                        sqlalchemy_event.remove(rolled_back_session, "after_commit", after_commit)

                sqlalchemy_event.listen(sync_session, "after_commit", after_commit, once=True)
                sqlalchemy_event.listen(sync_session, "after_rollback", after_rollback, once=True)
            return

        from nexora.database import get_session_factory

        async with get_session_factory()() as db_session:
            db_session.add(record)
            await db_session.commit()
        await self._fanout(company_id, event)

    async def _fanout(self, company_id: str, event: ActivityEvent) -> None:
        async with self._lock:
            ws_targets = list(self._ws_connections.get(company_id, []))
            sse_targets = list(self._sse_queues.get(company_id, []))

        payload_json = json.dumps(event.model_dump(mode="json"))
        dead_ws = []
        for ws in ws_targets:
            try:
                await asyncio.wait_for(
                    ws.send_text(payload_json), timeout=_WEBSOCKET_SEND_TIMEOUT_SECONDS
                )
            except Exception as exc:
                logger.warning("ws_send_failed", error=str(exc))
                dead_ws.append(ws)

        if dead_ws:
            async with self._lock:
                for ws in dead_ws:
                    self._ws_connections[company_id].discard(ws)

        for queue in sse_targets:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Keep the stream bounded for slow clients; prefer recent events.
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning("activity_sse_event_dropped", company_id=company_id)



# Global singleton instance
activity_broadcaster = ActivityBroadcaster()
