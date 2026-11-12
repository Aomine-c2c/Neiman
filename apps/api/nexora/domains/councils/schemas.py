"""
Pydantic Schemas for Agent Councils and Organizational Deliberation.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from nexora.core.enums import CouncilType


class CouncilMemberConfig(BaseModel):
    agent_id: uuid.UUID | None = None
    agent_name: str
    role_title: str
    perspective: str = Field(
        description="Evaluation angle or lens, e.g. 'Security & Threat Vector'"
    )
    model_provider: str | None = Field(
        default=None, description="e.g. 'anthropic', 'google', 'openai', 'local'"
    )
    model_identifier: str | None = Field(
        default=None, description="e.g. 'claude-3-7-sonnet', 'gemini-2.5-pro'"
    )


class AgentCouncilCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    charter: str = Field(min_length=5)
    council_type: CouncilType = CouncilType.PERMANENT
    synthesis_agent_id: uuid.UUID | None = None
    members: list[CouncilMemberConfig] = Field(default_factory=list)


class AgentCouncilUpdate(BaseModel):
    name: str | None = None
    charter: str | None = None
    council_type: CouncilType | None = None
    synthesis_agent_id: uuid.UUID | None = None
    members: list[CouncilMemberConfig] | None = None
    is_active: bool | None = None


class AgentCouncilResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    charter: str
    council_type: str
    is_active: bool
    synthesis_agent_id: uuid.UUID | None
    members: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


# -------------------------------------------------------------
# DELIBERATION SCHEMAS
# -------------------------------------------------------------
class ParticipantReview(BaseModel):
    agent_id: uuid.UUID | None = None
    agent_name: str
    role_title: str
    intelligence_provider: str | None = None
    model_identifier: str | None = None
    proposal: str = Field(description="Perspective proposal or response to the core problem")
    evidence: list[str] = Field(
        default_factory=list, description="Supporting empirical or logical evidence"
    )
    risks: list[str] = Field(
        default_factory=list, description="Identified technical/business risks"
    )
    assumptions: list[str] = Field(
        default_factory=list, description="Explicit operating assumptions"
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Self-assessed confidence score (0.0 - 1.0)"
    )
    objections: list[str] = Field(
        default_factory=list, description="Objections or reservations regarding competing views"
    )


class DisagreementRecord(BaseModel):
    topic: str
    dissenting_agents: list[str]
    dissenting_models: list[str] = Field(default_factory=list)
    argument: str
    counter_argument: str
    mitigation: str | None = None


class DeliberationCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    problem_statement: str = Field(min_length=10)
    context_data: dict[str, Any] = Field(default_factory=dict)
    initial_proposals: list[dict[str, Any]] = Field(default_factory=list)
    auto_execute_deliberation: bool = Field(
        default=True, description="Automatically orchestrate deliberation lifecycle"
    )


class DeliberationDecisionRequest(BaseModel):
    decision: str = Field(min_length=5)
    rationale: str = Field(min_length=5)
    record_in_memory: bool = Field(default=True)


class CouncilDeliberationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    council_id: uuid.UUID
    company_id: uuid.UUID
    title: str
    problem_statement: str
    context_data: dict[str, Any]
    current_stage: str
    status: str
    proposals: list[dict[str, Any]]
    independent_reviews: list[dict[str, Any]]
    objections: list[dict[str, Any]]
    discussion_threads: list[dict[str, Any]]
    synthesis_proposal: dict[str, Any] | None
    final_decision: str | None
    decision_rationale: str | None
    disagreements_recorded: list[dict[str, Any]]
    decision_id: uuid.UUID | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
