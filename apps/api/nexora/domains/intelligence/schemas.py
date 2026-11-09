"""Pydantic schemas for the Intelligence Exchange."""

import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

# ── Provider & Model Metadata Schemas ─────────────────────────────────────────


class ModelProviderCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    display_name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    website_url: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    is_local: bool = False


class ModelProviderResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    display_name: str
    description: str | None
    website_url: str | None
    base_url: str | None
    is_configured: bool
    api_key_masked: str | None = None
    is_active: bool
    is_local: bool
    is_healthy: bool
    consecutive_failures: int
    last_health_check_at: datetime | None
    created_at: datetime


class ProviderConfigureRequest(BaseModel):
    api_key: str | None = Field(
        default=None, description="API Key for the provider (will be stored encrypted in vault)"
    )
    base_url: str | None = Field(default=None, description="Custom endpoint URL or proxy link")
    auto_discover: bool = Field(
        default=True, description="Query provider endpoint to auto-discover models"
    )
    set_as_primary: bool = Field(
        default=True, description="Immediately set this provider as primary in routing policy"
    )


class ProviderConfigureResponse(BaseModel):
    provider_name: str
    display_name: str
    is_configured: bool
    is_healthy: bool
    base_url: str | None
    api_key_masked: str | None
    discovered_models_count: int
    models: list[str] = Field(default_factory=list)
    message: str


class ModelCreate(BaseModel):
    provider_id: uuid.UUID
    model_identifier: str = Field(min_length=2, max_length=150)
    display_name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    capabilities: list[str] = Field(default_factory=lambda: ["reasoning", "text"])
    modalities: list[str] = Field(default_factory=lambda: ["text"])
    tool_support: bool = True
    structured_output_support: bool = True
    context_capacity: int = 128000
    max_output_tokens: int = 4096
    input_cost_per_million: float = 2.50
    output_cost_per_million: float = 10.00
    avg_latency_ms: float = 600.0
    availability_rate: float = 0.999
    privacy_classification: str = "PUBLIC_CLOUD"


class ModelResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    provider_id: uuid.UUID
    model_identifier: str
    display_name: str
    description: str | None
    capabilities: list[str]
    modalities: list[str]
    tool_support: bool
    structured_output_support: bool
    context_capacity: int
    max_output_tokens: int
    input_cost_per_million: float
    output_cost_per_million: float
    avg_latency_ms: float
    availability_rate: float
    privacy_classification: str
    is_active: bool
    created_at: datetime


# ── Routing Policy Schemas ───────────────────────────────────────────────────


class ModelRoutingPolicyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    strategy: str = (
        "BALANCED"  # BALANCED | LOWEST_COST | LOWEST_LATENCY | HIGHEST_CAPABILITY | STRICT_PRIVACY
    )
    max_cost_per_query_usd: float = 0.50
    max_acceptable_latency_ms: float = 5000.0
    required_privacy_level: str | None = None
    fallback_chain: list[str] = Field(
        default_factory=lambda: [
            "gemini-3.8-flash",
            "gemini-3.1-pro-preview",
            "deepseek-reasoner",
            "qwen3.8-max",
            "kimi-k2.7-code",
            "glm-5",
            "kilo-auto/free",
            "local-deepseek-r1",
        ]
    )
    capability_preferences: dict[str, str] = Field(default_factory=dict)
    is_default: bool = False


class ModelRoutingPolicyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    strategy: str | None = None
    max_cost_per_query_usd: float | None = None
    max_acceptable_latency_ms: float | None = None
    required_privacy_level: str | None = None
    fallback_chain: list[str] | None = None
    capability_preferences: dict[str, str] | None = None
    is_default: bool | None = None


class ModelRoutingPolicyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    description: str | None
    strategy: str
    max_cost_per_query_usd: float
    max_acceptable_latency_ms: float
    required_privacy_level: str | None
    fallback_chain: list[str]
    capability_preferences: dict
    is_default: bool
    created_at: datetime


# ── Execution / Request & Response Schemas ───────────────────────────────────


class ModelRequest(BaseModel):
    """
    Standard vendor-agnostic request format for organizational intelligence.
    Agents express needs in terms of capabilities, with optional provider preferences or overrides.
    """

    prompt: str = Field(min_length=1)
    system_prompt: str | None = None
    required_capabilities: list[str] = Field(default_factory=lambda: ["reasoning"])
    context_tokens_needed: int = 4000
    preferred_provider: str | None = None
    preferred_model: str | None = None
    allow_fallback: bool = True
    max_acceptable_cost_usd: float | None = None
    token_ceiling: int | None = None
    timeout_seconds: float = 15.0
    required_privacy: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096
    structured_output_schema: dict | None = None
    simulation_flags: dict[str, str] | None = (
        None  # e.g. {"openai": "rate_limit", "anthropic": "timeout"}
    )
    metadata: dict[str, Any] = Field(default_factory=dict)
    enable_token_compression: bool = True
    compression_strategy: str = "AGGRESSIVE"  # CONSERVATIVE | BALANCED | AGGRESSIVE | TRIPLETS
    runtime_api_keys: dict[str, str] = Field(default_factory=dict)


class ModelResponsePayload(BaseModel):
    """Normalized response payload delivered back to organizational agents."""

    text: str
    model_used: str
    provider_used: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    latency_ms: float
    routed_tier: str = "PRIMARY"  # PRIMARY | FALLBACK | SECONDARY_FALLBACK | LOCAL_DEGRADED
    routed_via_fallback: bool = False
    fallback_reason: str | None = None
    attempts_count: int = 1
    routing_trace: list[dict] = Field(default_factory=list)
    structured_output_validated: bool = False
    circuit_breaker_status: str = "CLOSED"  # CLOSED | HALF_OPEN | OPEN
    finish_reason: str = "stop"  # stop | length | content_filter | error
    is_truncated: bool = False
    credited_model: str | None = None
    credited_provider: str | None = None
    failover_trace: list[dict] = Field(default_factory=list)
    # Built-in Token Compression Telemetry
    compression_applied: bool = False
    original_prompt_tokens: int = 0
    compressed_prompt_tokens: int = 0
    tokens_saved: int = 0
    compression_ratio_pct: float = 0.0
    cost_saved_usd: float = 0.0


# ── Dashboard & Analytics Schemas ───────────────────────────────────────────


class IntelligenceDashboardResponse(BaseModel):
    total_requests: int
    total_tokens_consumed: int
    total_spend_usd: float
    avg_latency_ms: float
    overall_success_rate: float
    providers_count: int
    models_count: int
    healthy_providers_count: int
    active_provider: str | None = None
    active_model: str | None = None
    active_provider_display: str | None = None
    fallback_chain: list[str] = Field(default_factory=list)
    recent_routing_decisions: list[dict] = Field(default_factory=list)
    available_providers: list[ModelProviderResponse] = Field(default_factory=list)
    available_models: list[ModelResponse] = Field(default_factory=list)
    depleted_models: list[dict[str, Any]] = Field(default_factory=list)


# ── Live Probing & Health Benchmarking Schemas ──────────────────────────────


class ProviderProbeRequest(BaseModel):
    """Parameters for active live provider latency and resilience probing."""

    simulate_error: str | None = None  # None | "rate_limit" | "timeout" | "500"
    timeout_seconds: float = 10.0


class ProviderProbeResponse(BaseModel):
    """Result of an active probe against an AI vendor adapter."""

    provider: str
    display_name: str
    is_healthy: bool
    latency_ms: float
    circuit_breaker_status: str  # CLOSED | OPEN | HALF_OPEN
    consecutive_failures: int = 0
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ── Built-in Token Compression On-Demand Schemas ───────────────────────────


class TokenCompressionBreakdownSchema(BaseModel):
    filler_tokens_saved: int = 0
    whitespace_tokens_saved: int = 0
    json_tokens_saved: int = 0
    discourse_tokens_saved: int = 0


class TokenCompressionRequest(BaseModel):
    text: str = Field(
        min_length=1, description="Raw verbose text, prompt, or instructions to compress"
    )
    strategy: str = Field(
        default="DYNAMIC",
        description="Compression strategy: DYNAMIC | CONSERVATIVE | BALANCED | AGGRESSIVE | TRIPLETS",
    )


class TokenCompressionResponse(BaseModel):
    original_text: str
    compressed_text: str
    original_tokens: int
    compressed_tokens: int
    tokens_saved: int
    compression_ratio_pct: float
    strategy_used: str
    breakdown: TokenCompressionBreakdownSchema = Field(default_factory=TokenCompressionBreakdownSchema)
    estimated_cost_saved_usd: float = 0.0
    latency_ms: float = 0.0
    timestamp: datetime


class BatchTokenCompressionRequest(BaseModel):
    texts: list[str] = Field(
        min_length=1, max_length=50, description="List of prompt fragments or messages to compress"
    )
    strategy: str = Field(
        default="DYNAMIC",
        description="Compression strategy: DYNAMIC | CONSERVATIVE | BALANCED | AGGRESSIVE | TRIPLETS",
    )


class BatchTokenCompressionResponse(BaseModel):
    results: list[TokenCompressionResponse]
    total_original_tokens: int
    total_compressed_tokens: int
    total_tokens_saved: int
    overall_compression_ratio_pct: float
    total_cost_saved_usd: float
    total_latency_ms: float
    timestamp: datetime


class TokenCompressionStatsResponse(BaseModel):
    total_requests_compressed: int
    total_tokens_saved: int
    average_compression_ratio_pct: float
    total_estimated_usd_saved: float
    most_effective_strategy: str
    active_strategies: list[str]
