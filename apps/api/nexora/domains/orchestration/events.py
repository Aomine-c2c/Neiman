"""
Event-Driven Communication, Delegation Controls, and Escalation Routing.
Prevents infinite delegation chains and uncontrolled sub-agent spawning.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from nexora.domains.orchestration.schemas import (
    AgentDelegationSpec,
    EscalationEvent,
)
from nexora.exceptions import BusinessRuleError

logger = logging.getLogger(__name__)


class OrchestrationEventBus:
    """
    Event-driven communication hub for orchestration events.
    Supports asynchronous publish/subscribe, enforces bounded delegation depth,
    and dispatches escalation triggers to human owners.
    """

    def __init__(self, max_delegation_depth: int = 3) -> None:
        self.max_delegation_depth = max_delegation_depth
        self._handlers: dict[str, list[Callable[[dict[str, Any]], Any]]] = {}
        self._event_history: list[dict[str, Any]] = []
        self._escalations: dict[str, EscalationEvent] = {}

    def subscribe(self, event_type: str, handler: Callable[[dict[str, Any]], Any]) -> None:
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        event_record = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "payload": payload,
        }
        self._event_history.append(event_record)
        if len(self._event_history) > 1000:
            self._event_history.pop(0)

        handlers = self._handlers.get(event_type, [])
        for h in handlers:
            try:
                h(event_record)
            except Exception as exc:
                logger.error("Error executing handler for event %s: %s", event_type, exc)

    def get_events(self, limit: int = 50) -> list[dict[str, Any]]:
        return list(reversed(self._event_history[-limit:]))

    # -------------------------------------------------------------
    # DELEGATION CONTROLS (Bounded Sub-agent Spawning)
    # -------------------------------------------------------------
    def validate_and_dispatch_delegation(
        self,
        delegation: AgentDelegationSpec,
    ) -> dict[str, Any]:
        """
        Validates delegation depth.
        Raises BusinessRuleError if delegation depth exceeds max_delegation_depth,
        preventing runaway sub-agent explosion and recursive loops.
        """
        if delegation.current_depth > self.max_delegation_depth:
            raise BusinessRuleError(
                f"Infinite delegation blocked: current depth {delegation.current_depth} "
                f"exceeds maximum allowed depth ({self.max_delegation_depth})."
            )

        if delegation.delegator_agent_id == delegation.target_agent_id:
            raise BusinessRuleError("Self-delegation loop blocked: an agent cannot delegate a task to itself.")

        self.publish(
            "DELEGATION_DISPATCHED",
            {
                "delegation_id": delegation.delegation_id,
                "parent_run_id": delegation.parent_run_id,
                "delegator": delegation.delegator_agent_id,
                "target": delegation.target_agent_id,
                "subtask_title": delegation.subtask.title,
                "depth": delegation.current_depth,
            },
        )
        return {
            "status": "DISPATCHED",
            "delegation_id": delegation.delegation_id,
            "depth": delegation.current_depth,
            "target_agent_id": delegation.target_agent_id,
        }

    # -------------------------------------------------------------
    # ESCALATION ROUTER
    # -------------------------------------------------------------
    def raise_escalation(
        self,
        run_id: str,
        agent_id: str,
        reason: str,
        severity: str = "HIGH",
        context: dict[str, Any] | None = None,
    ) -> EscalationEvent:
        """
        Creates an immutable escalation record and notifies the sovereign human owner.
        """
        escalation = EscalationEvent(
            escalation_id=str(uuid.uuid4()),
            run_id=run_id,
            agent_id=agent_id,
            severity=severity,
            reason=reason,
            context_snapshot=context or {},
            escalated_to="CEO_HUMAN_OWNER",
            status="OPEN",
            timestamp=datetime.now(UTC),
        )
        self._escalations[escalation.escalation_id] = escalation

        self.publish(
            "ESCALATION_TRIGGERED",
            {
                "escalation_id": escalation.escalation_id,
                "run_id": run_id,
                "agent_id": agent_id,
                "severity": severity,
                "reason": reason,
            },
        )
        return escalation

    def list_escalations(self, run_id: str | None = None) -> list[EscalationEvent]:
        if run_id:
            return [e for e in self._escalations.values() if e.run_id == run_id]
        return list(self._escalations.values())
