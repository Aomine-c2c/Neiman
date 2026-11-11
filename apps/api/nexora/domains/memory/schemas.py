"""
Pydantic Schemas for NEIMAN Organizational Memory System.
Covers:
- Memory Items (10 domains, metadata, permissions, retention)
- Context Assembly Request & Minimal Necessary Context Response
- Decision Records (deliberation, evidence, outcomes, lessons learned)
- Searchable Knowledge Base query & filter parameters
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from nexora.core.enums import (
    MemoryDomain,
    MemoryScope,
    ProvenanceType,
    RetentionPolicy,
)

# ==========================================
# MEMORY ITEM SCHEMAS
# ==========================================


class MemoryItemCreate(BaseModel):
    domain: MemoryDomain
    scope: MemoryScope = MemoryScope.INTERNAL
    title: str = Field(..., max_length=255)
    content: str = Field(..., min_length=1)
    summary: str | None = None

    department_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None

    provenance_type: ProvenanceType = ProvenanceType.HUMAN_INPUT
    source: str = Field(default="user_input", max_length=255)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    relevance_score: float = Field(default=1.0, ge=0.0)

    required_permissions: list[str] = Field(default_factory=list)
    retention_policy: RetentionPolicy = RetentionPolicy.PERMANENT
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryItemUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    summary: str | None = None
    scope: MemoryScope | None = None
    confidence: float | None = Field(None, ge=0.0, le=1.0)
    relevance_score: float | None = None
    required_permissions: list[str] | None = None
    tags: list[str] | None = None
    is_archived: bool | None = None
    metadata: dict[str, Any] | None = None


class MemoryItemResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    domain: str
    scope: str
    title: str
    content: str
    summary: str | None
    department_id: uuid.UUID | None
    agent_id: uuid.UUID | None
    project_id: uuid.UUID | None
    task_id: uuid.UUID | None
    provenance_type: str
    source: str
    owner_id: uuid.UUID | None
    confidence: float
    relevance_score: float
    access_count: int
    last_accessed_at: datetime | None
    required_permissions: list[str]
    retention_policy: str
    is_archived: bool
    tags: list[str]
    metadata: dict[str, Any] = Field(..., alias="extra_metadata")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ==========================================
# CONTEXT ASSEMBLY SCHEMAS
# ==========================================


class ContextAssemblyRequest(BaseModel):
    """
    Requested context for a Task or Agent execution.
    Specifies task objective, required domains, and caller credentials
    so the system retrieves ONLY authorized, ranked, minimal necessary context.
    """

    task_objective: str = Field(..., min_length=3, description="Task purpose to match relevance")
    task_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None

    target_domains: list[MemoryDomain] | None = Field(
        None, description="Subset of domains needed. Defaults to task-inferred domains."
    )
    caller_permissions: list[str] = Field(
        default_factory=list, description="e.g. ['role:ADMIN', 'dept:engineering', 'agent:42']"
    )
    caller_role: str = "MEMBER"  # OWNER, ADMIN, MANAGER, MEMBER, VIEWER
    max_context_tokens: int = Field(default=4000, ge=100, le=32000)
    max_items: int = Field(default=5, ge=1, le=20)
    compress_context: bool = Field(default=True, description="Enable algorithmic token compression")
    compression_strategy: str = Field(
        default="AGGRESSIVE", description="CONSERVATIVE | BALANCED | AGGRESSIVE | TRIPLETS"
    )


class AssembledMemorySnippet(BaseModel):
    memory_id: uuid.UUID
    domain: str
    title: str
    excerpt: str
    relevance_score: float
    confidence: float
    source: str


class ContextAssemblyResponse(BaseModel):
    """
    Sanitized, minimal, authorized context assembled for prompt injection.
    Prevents leaking unauthorized or redundant company memory to external model providers.
    """

    task_objective: str
    total_memories_evaluated: int
    authorized_memories_selected: int
    estimated_context_tokens: int
    domains_consulted: list[str]
    assembled_context_prompt: str
    snippets: list[AssembledMemorySnippet]
    # Token Compression Telemetry
    compression_applied: bool = False
    uncompressed_context_tokens: int = 0
    tokens_saved: int = 0
    compression_ratio_pct: float = 0.0


# ==========================================
# DECISION RECORD SCHEMAS
# ==========================================


class OptionConsidered(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    title: str
    description: str
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    impact_score: float = Field(default=5.0, ge=1.0, le=10.0)


class EvidenceItem(BaseModel):
    source: str
    claim: str
    verified: bool = True
    url_or_ref: str | None = None


class DecisionParticipant(BaseModel):
    name: str
    role: str
    identity_type: str = "AGENT"  # USER | AGENT
    stance: str = "SUPPORT"  # SUPPORT | OBJECT | NEUTRAL


class DecisionRecordCreate(BaseModel):
    title: str = Field(..., max_length=255)
    problem: str = Field(..., min_length=5)
    options: list[OptionConsidered] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    participants: list[DecisionParticipant] = Field(default_factory=list)
    decision: str = Field(..., min_length=5)
    rationale: str = Field(..., min_length=5)
    expected_outcome: str = Field(..., min_length=5)
    actual_outcome: str | None = None
    lessons_learned: list[str] = Field(default_factory=list)
    decided_by_agent_id: uuid.UUID | None = None


class DecisionRecordOutcomeUpdate(BaseModel):
    actual_outcome: str = Field(..., min_length=5)
    lessons_learned: list[str] = Field(..., min_length=1)


class DecisionRecordResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    title: str
    problem: str
    options: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    participants: list[dict[str, Any]]
    decision: str
    rationale: str
    expected_outcome: str
    actual_outcome: str | None
    lessons_learned: list[str]
    decided_by_user_id: uuid.UUID | None
    decided_by_agent_id: uuid.UUID | None
    memory_item_id: uuid.UUID | None
    decided_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# SEARCH & KNOWLEDGE BASE QUERY SCHEMAS
# ==========================================


class MemorySearchQuery(BaseModel):
    query: str = Field(..., min_length=1, description="Keywords or search query")
    domain: MemoryDomain | None = None
    scope: MemoryScope | None = None
    department_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    tags: list[str] | None = None
    limit: int = Field(default=20, ge=1, le=100)


# ==========================================
# KNOWLEDGE GRAPH SCHEMAS
# ==========================================


class KnowledgeEntityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    entity_type: str = Field(default="CONCEPT", max_length=50)
    description: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)


class KnowledgeEntityResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    entity_type: str
    description: str | None
    properties: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KnowledgeRelationCreate(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID
    relation_type: str = Field(..., min_length=1, max_length=100)
    weight: float = Field(default=1.0, ge=0.0, le=10.0)
    provenance: str | None = None


class KnowledgeRelationResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    relation_type: str
    weight: float
    provenance: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KnowledgeGraphResponse(BaseModel):
    entities: list[KnowledgeEntityResponse]
    relations: list[KnowledgeRelationResponse]
    total_entities: int
    total_relations: int
