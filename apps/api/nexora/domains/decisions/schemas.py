"""Decision Pydantic schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from nexora.core.enums import DecisionStatus


class Proposal(BaseModel):
    id: str
    title: str
    description: str
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    proposed_by: str | None = None


class Evidence(BaseModel):
    id: str
    type: str = Field(description="data | research | precedent | expert_opinion | other")
    source: str
    summary: str
    url: str | None = None


class Participant(BaseModel):
    user_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    role: str = Field(description="decision_maker | advisor | stakeholder | observer")
    input: str | None = None


class DecisionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    problem: str = Field(min_length=10)
    proposals: list[Proposal] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    participants: list[Participant] = Field(default_factory=list)
    expected_outcome: str | None = None


class DecisionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    problem: str | None = None
    proposals: list[Proposal] | None = None
    evidence: list[Evidence] | None = None
    participants: list[Participant] | None = None
    expected_outcome: str | None = None


class DecisionResolve(BaseModel):
    """Used to close a decision with an outcome."""

    decision: str = Field(min_length=10, description="The decision that was made")
    rationale: str = Field(min_length=10)
    expected_outcome: str | None = None


class DecisionOutcome(BaseModel):
    """Record the actual outcome after implementation."""

    actual_outcome: str = Field(min_length=10)


class DecisionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    title: str
    problem: str
    proposals: list
    evidence: list
    participants: list
    decision: str | None
    rationale: str | None
    expected_outcome: str | None
    actual_outcome: str | None
    status: DecisionStatus
    decided_at: datetime | None
    decided_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
