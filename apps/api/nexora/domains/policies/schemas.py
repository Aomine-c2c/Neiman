"""Policy Pydantic schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from nexora.core.enums import EnforcementLevel, PolicyScope, PolicyStatus


class PolicyRule(BaseModel):
    id: str
    name: str
    condition: str = Field(
        description="Natural language or expression describing when this rule applies"
    )
    action: str = Field(description="What happens when the condition is met")
    priority: int = Field(default=0, description="Higher priority rules are evaluated first")
    active: bool = True


class PolicyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    scope: PolicyScope = PolicyScope.COMPANY
    scope_id: uuid.UUID | None = None
    rules: list[PolicyRule] = Field(default_factory=list)
    enforcement_level: EnforcementLevel = EnforcementLevel.SOFT


class PolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    scope_id: uuid.UUID | None = None
    rules: list[PolicyRule] | None = None
    enforcement_level: EnforcementLevel | None = None
    status: PolicyStatus | None = None


class PolicyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    description: str | None
    scope: PolicyScope
    scope_id: uuid.UUID | None
    rules: list
    enforcement_level: EnforcementLevel
    status: PolicyStatus
    version: int
    created_at: datetime
    updated_at: datetime
