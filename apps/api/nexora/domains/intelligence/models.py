"""
Intelligence Exchange domain models:
- ModelProvider (Google Gemini, Anthropic Claude, OpenAI, Local, etc.)
- Model (Registered models with capabilities, context, latency, cost, privacy)
- ModelRoutingPolicy (Priority-based capability matching, cost/latency/privacy/fallback rules)
- ModelRequestLog (Historical log of routing, execution, tokens, latency, cost)
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import NexoraBase, TimestampMixin, UUIDBase


class ModelProvider(NexoraBase):
    """
    An AI vendor / service provider (OpenAI, Anthropic, Google Gemini, Local/Self-hosted, etc.).
    Keeps organizational agents decoupled from vendor APIs.
    """

    __tablename__ = "model_providers"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_configured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_local: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Health / availability monitoring
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_health_check_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    models: Mapped[list["Model"]] = relationship(
        "Model", back_populates="provider", cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<ModelProvider id={self.id} name={self.name} is_configured={self.is_configured} is_healthy={self.is_healthy}>"


class Model(NexoraBase):
    """
    A specific model instance offered by a provider.
    Exposes capabilities, modalities, context capacity, pricing, latency, and privacy metadata.
    """

    __tablename__ = "models"

    provider_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("model_providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_identifier: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
        comment="Provider API identifier, e.g. gpt-4o, claude-3-5-sonnet-20241022, gemini-1.5-pro",
    )
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Capabilities & Features
    capabilities: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Tags: reasoning, code_generation, creative, fast, vision, agentic, large_context",
    )
    modalities: Mapped[list] = mapped_column(
        JSON, default=lambda: ["text"], nullable=False, comment="text, vision, audio, code"
    )
    tool_support: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    structured_output_support: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Specifications
    context_capacity: Mapped[int] = mapped_column(Integer, default=128000, nullable=False)
    max_output_tokens: Mapped[int] = mapped_column(Integer, default=4096, nullable=False)

    # Cost (USD per 1M tokens)
    input_cost_per_million: Mapped[float] = mapped_column(Float, default=2.50, nullable=False)
    output_cost_per_million: Mapped[float] = mapped_column(Float, default=10.00, nullable=False)

    # Performance benchmark defaults
    avg_latency_ms: Mapped[float] = mapped_column(Float, default=600.0, nullable=False)
    availability_rate: Mapped[float] = mapped_column(Float, default=0.999, nullable=False)

    # Privacy classification (PUBLIC_CLOUD, PRIVATE_CLOUD, ON_PREMISE_ZERO_RETENTION)
    privacy_classification: Mapped[str] = mapped_column(
        String(50), default="PUBLIC_CLOUD", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    provider: Mapped["ModelProvider"] = relationship(
        "ModelProvider", back_populates="models", lazy="selectin"
    )

    def __repr__(self) -> str:
        return (
            f"<Model id={self.id} identifier={self.model_identifier} provider={self.provider_id}>"
        )


class ModelRoutingPolicy(NexoraBase):
    """
    Company-level intelligence routing policy.
    Guides how capability requests are resolved across providers with cost, latency,
    privacy, fallback, and explicit user preference rules.
    """

    __tablename__ = "model_routing_policies"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    strategy: Mapped[str] = mapped_column(
        String(50),
        default="BALANCED",
        nullable=False,
        comment="BALANCED | LOWEST_COST | LOWEST_LATENCY | HIGHEST_CAPABILITY | STRICT_PRIVACY",
    )
    max_cost_per_query_usd: Mapped[float] = mapped_column(Float, default=0.50, nullable=False)
    max_acceptable_latency_ms: Mapped[float] = mapped_column(Float, default=5000.0, nullable=False)
    required_privacy_level: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Fallback chain: list of model identifiers to try in order on rate-limit or failure
    fallback_chain: Mapped[list] = mapped_column(
        JSON,
        default=lambda: [
            "gemini-3.1-pro-preview",
            "gemini-3.8-flash",
            "poolside/laguna-s-2.1",
            "qwen3.8-max",
            "deepseek-reasoner",
            "kimi-k2.7-code",
            "glm-5",
            "kilo-auto/free",
            "local-deepseek-r1",
        ],
        nullable=False,
    )

    # Explicit user/agent preferences: { "architectural_reasoning": "claude-3-5-sonnet", "quick_formatting": "gemini-1.5-flash" }
    capability_preferences: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ModelRequestLog(UUIDBase, TimestampMixin):
    """
    Telemetry and audit log for every model invocation routed through the Intelligence Exchange.
    Provides data for the Intelligence Exchange Dashboard.
    """

    __tablename__ = "model_request_logs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    requested_capability: Mapped[str | None] = mapped_column(String(100), nullable=True)
    selected_provider_name: Mapped[str] = mapped_column(String(100), nullable=False)
    selected_model_identifier: Mapped[str] = mapped_column(String(150), nullable=False)

    routed_tier: Mapped[str] = mapped_column(
        String(50),
        default="PRIMARY",
        nullable=False,
        comment="PRIMARY, FALLBACK, SECONDARY_FALLBACK, LOCAL_DEGRADED",
    )
    routed_via_fallback: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fallback_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attempts_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    routing_trace: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    circuit_breaker_status: Mapped[str] = mapped_column(
        String(50), default="CLOSED", nullable=False
    )

    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
