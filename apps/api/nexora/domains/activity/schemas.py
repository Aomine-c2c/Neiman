"""Activity schemas for realtime event streaming and querying."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ActivityEventType(str, Enum):
    AGENT_STARTED = "agent_started"
    AGENT_COMPLETED = "agent_completed"
    TASK_CREATED = "task_created"
    TASK_FAILED = "task_failed"
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_COMPLETED = "workflow_completed"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_COMPLETED = "approval_completed"
    PROVIDER_FAILED = "provider_failed"
    PROVIDER_SWITCHED = "provider_switched"
    RESOURCE_THRESHOLD = "resource_threshold"
    DECISION_CREATED = "decision_created"
    EVOLUTION_PROPOSED = "evolution_proposed"
    SIMULATION_COMPLETED = "simulation_completed"
    RUNTIME_EXECUTION_COMPLETED = "runtime_execution_completed"
    RUNTIME_EXECUTION_BLOCKED = "runtime_execution_blocked"


class ActivitySeverity(str, Enum):
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ActivityEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    event_type: ActivityEventType
    severity: ActivitySeverity = ActivitySeverity.INFO
    title: str
    summary: str
    agent_id: str | None = None
    agent_name: str | None = None
    department_id: str | None = None
    department_name: str | None = None
    project_id: str | None = None
    project_name: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ActivityFilterParams(BaseModel):
    agent: str | None = None
    department: str | None = None
    project: str | None = None
    event: str | None = None
    severity: ActivitySeverity | None = None
    search: str | None = None
    limit: int = 50
