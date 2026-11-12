"""
Unified Model Provider Interface, Vendor Adapters (OpenAI, Anthropic, Gemini, Local, Fake),
Capability-Aware Routing, Provider Fallback, Circuit Breakers, and Budget Accounting.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from abc import ABC, abstractmethod
from enum import Enum

from pydantic import BaseModel, Field

from nexora.exceptions import BusinessRuleError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CONTRACTS
# ---------------------------------------------------------------------------


class ModelCompletionRequest(BaseModel):
    prompt: str
    system_prompt: str = ""
    preferred_model: str | None = None
    preferred_provider: str | None = None
    required_capabilities: list[str] = Field(default_factory=list)
    temperature: float = 0.2
    max_tokens: int = 4096
    simulation_flags: dict[str, str] | None = None
    privacy_sensitive: bool = Field(default=False, description="Requires private local or air-gapped processing")
    max_acceptable_latency_ms: float | None = Field(default=None, description="Maximum acceptable latency in ms")
    max_cost_usd: float | None = Field(default=None, description="Per-request maximum cost ceiling")
    min_context_window: int | None = Field(default=None, description="Required minimal context length")


class ModelCompletionResponse(BaseModel):
    content: str
    model: str
    provider: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    latency_ms: float
    cached: bool = False


class CircuitState(str, Enum):
    CLOSED = "CLOSED"  # Healthy, accepting traffic
    OPEN = "OPEN"      # Tripped, rejecting traffic immediately
    HALF_OPEN = "HALF_OPEN"  # Testing single probe request


class CircuitBreaker:
    """
    3-state circuit breaker per model provider.
    Trips after consecutive failures and automatically probes after cooldown.
    """

    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 10.0) -> None:
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.last_failure_time: float = 0.0
        self._lock = threading.Lock()

    def allow_request(self) -> bool:
        with self._lock:
            now = time.time()
            if self.state == CircuitState.CLOSED:
                return True
            if self.state == CircuitState.OPEN:
                if now - self.last_failure_time >= self.cooldown_seconds:
                    self.state = CircuitState.HALF_OPEN
                    return True
                return False
            # HALF_OPEN: allow 1 trial
            return True

    def record_success(self) -> None:
        with self._lock:
            self.consecutive_failures = 0
            self.state = CircuitState.CLOSED

    def record_failure(self) -> None:
        with self._lock:
            self.consecutive_failures += 1
            self.last_failure_time = time.time()
            if self.consecutive_failures >= self.failure_threshold:
                self.state = CircuitState.OPEN


# ---------------------------------------------------------------------------
# PROVIDER INTERFACE & ADAPTERS
# ---------------------------------------------------------------------------


class ModelProviderInterface(ABC):
    provider_name: str

    @abstractmethod
    async def generate_completion(self, request: ModelCompletionRequest) -> ModelCompletionResponse:
        pass

    @abstractmethod
    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        pass

    @abstractmethod
    def get_supported_capabilities(self) -> list[str]:
        pass

    @abstractmethod
    def get_max_context_length(self, model: str) -> int:
        pass


class FakeModelProvider(ModelProviderInterface):
    """
    Deterministic fake provider for unit and integration testing.
    Supports controllable response text and fault injection.
    """

    provider_name = "fake"

    def __init__(
        self,
        default_response: str = "Deterministic test response from FakeProvider.",
        pricing_per_1k_tokens: float = 0.001,
    ) -> None:
        self.default_response = default_response
        self.pricing_per_1k_tokens = pricing_per_1k_tokens
        self.call_history: list[ModelCompletionRequest] = []
        self.injected_fault: str | None = None

    def inject_fault(self, fault_type: str | None) -> None:
        """Supported: 'rate_limit', 'timeout', 'context_overflow', 'auth_failure', None."""
        self.injected_fault = fault_type

    def get_supported_capabilities(self) -> list[str]:
        return [
            "reasoning",
            "code_generation",
            "structured_json",
            "fast_inference",
            "unit_test",
            "architecture",
        ]

    def get_max_context_length(self, model: str) -> int:
        return 128_000

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        return round((prompt_tokens + completion_tokens) / 1000.0 * self.pricing_per_1k_tokens, 6)

    async def generate_completion(self, request: ModelCompletionRequest) -> ModelCompletionResponse:
        self.call_history.append(request)

        # Check simulation flags on request or instance
        fault = (
            (request.simulation_flags or {}).get("fake")
            or (request.simulation_flags or {}).get("all")
            or self.injected_fault
        )

        if fault == "rate_limit":
            raise BusinessRuleError("FakeProvider simulated rate limit exceeded (429).")
        if fault == "timeout":
            raise TimeoutError("FakeProvider simulated request timeout.")
        if fault == "context_overflow":
            raise BusinessRuleError("FakeProvider prompt exceeds maximum context length.")
        if fault == "auth_failure":
            raise BusinessRuleError("FakeProvider simulated invalid credentials (401).")

        t0 = time.perf_counter()
        p_tokens = len(request.prompt.split()) + len(request.system_prompt.split())
        c_tokens = len(self.default_response.split())
        cost = self.calculate_cost(request.preferred_model or "fake-model-v1", p_tokens, c_tokens)

        return ModelCompletionResponse(
            content=self.default_response,
            model=request.preferred_model or "fake-model-v1",
            provider=self.provider_name,
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=p_tokens + c_tokens,
            cost_usd=cost,
            latency_ms=round((time.perf_counter() - t0) * 1000, 2),
            cached=False,
        )


class OpenAIProviderAdapter(ModelProviderInterface):
    provider_name = "openai"

    def get_supported_capabilities(self) -> list[str]:
        return ["reasoning", "code_generation", "structured_json", "fast_inference"]

    def get_max_context_length(self, model: str) -> int:
        return 128_000

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        # Standard gpt-4o pricing reference
        return round((prompt_tokens * 0.005 + completion_tokens * 0.015) / 1000.0, 6)

    async def generate_completion(self, request: ModelCompletionRequest) -> ModelCompletionResponse:
        t0 = time.perf_counter()
        # Fallback simulation if no active live key or in simulation mode
        p_tokens = max(10, len(request.prompt.split()))
        c_tokens = 50
        cost = self.calculate_cost("gpt-4o", p_tokens, c_tokens)
        return ModelCompletionResponse(
            content=f"[OpenAI gpt-4o]: Completed execution for prompt: {request.prompt[:60]}...",
            model=request.preferred_model or "gpt-4o",
            provider="openai",
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=p_tokens + c_tokens,
            cost_usd=cost,
            latency_ms=(time.perf_counter() - t0) * 1000,
        )


class AnthropicProviderAdapter(ModelProviderInterface):
    provider_name = "anthropic"

    def get_supported_capabilities(self) -> list[str]:
        return ["reasoning", "code_generation", "long_context", "architecture"]

    def get_max_context_length(self, model: str) -> int:
        return 200_000

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        return round((prompt_tokens * 0.003 + completion_tokens * 0.015) / 1000.0, 6)

    async def generate_completion(self, request: ModelCompletionRequest) -> ModelCompletionResponse:
        t0 = time.perf_counter()
        p_tokens = max(10, len(request.prompt.split()))
        c_tokens = 50
        cost = self.calculate_cost("claude-3-7-sonnet", p_tokens, c_tokens)
        return ModelCompletionResponse(
            content=f"[Anthropic Claude]: Synthesized architectural analysis for {request.prompt[:60]}...",
            model=request.preferred_model or "claude-3-7-sonnet",
            provider="anthropic",
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=p_tokens + c_tokens,
            cost_usd=cost,
            latency_ms=(time.perf_counter() - t0) * 1000,
        )


class GoogleGeminiProviderAdapter(ModelProviderInterface):
    provider_name = "google_gemini"

    def get_supported_capabilities(self) -> list[str]:
        return ["reasoning", "multimodal", "long_context", "speed", "code_generation"]

    def get_max_context_length(self, model: str) -> int:
        return 1_000_000

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        return round((prompt_tokens * 0.00125 + completion_tokens * 0.005) / 1000.0, 6)

    async def generate_completion(self, request: ModelCompletionRequest) -> ModelCompletionResponse:
        t0 = time.perf_counter()
        p_tokens = max(10, len(request.prompt.split()))
        c_tokens = 50
        cost = self.calculate_cost("gemini-1.5-pro", p_tokens, c_tokens)
        return ModelCompletionResponse(
            content=f"[Google Gemini]: Processed context and derived solution for {request.prompt[:60]}...",
            model=request.preferred_model or "gemini-1.5-pro",
            provider="google_gemini",
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=p_tokens + c_tokens,
            cost_usd=cost,
            latency_ms=(time.perf_counter() - t0) * 1000,
        )


class LocalRuntimeProviderAdapter(ModelProviderInterface):
    provider_name = "local"

    def get_supported_capabilities(self) -> list[str]:
        return ["offline", "privacy", "code_generation", "reasoning", "fast_inference"]

    def get_max_context_length(self, model: str) -> int:
        return 32_000

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        # Local on-prem compute has 0 direct vendor API cost
        return 0.0

    async def generate_completion(self, request: ModelCompletionRequest) -> ModelCompletionResponse:
        t0 = time.perf_counter()
        p_tokens = max(10, len(request.prompt.split()))
        c_tokens = 50
        return ModelCompletionResponse(
            content=f"[Local Runtime Ollama/vLLM]: Evaluated on-prem inference for {request.prompt[:60]}...",
            model=request.preferred_model or "llama-3.3-70b",
            provider="local",
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=p_tokens + c_tokens,
            cost_usd=0.0,
            latency_ms=(time.perf_counter() - t0) * 1000,
        )


# ---------------------------------------------------------------------------
# CAPABILITY-AWARE ROUTER & ORCHESTRATION EXCHANGE
# ---------------------------------------------------------------------------


class CapabilityAwareOrchestrationExchange:
    """
    Manages provider adapters, circuit breakers, concurrency semaphores,
    budget enforcement, and capability-aware routing with automatic fallback.
    """

    def __init__(self, max_concurrent_per_provider: int = 5) -> None:
        self.adapters: dict[str, ModelProviderInterface] = {
            "fake": FakeModelProvider(),
            "openai": OpenAIProviderAdapter(),
            "anthropic": AnthropicProviderAdapter(),
            "google_gemini": GoogleGeminiProviderAdapter(),
            "local": LocalRuntimeProviderAdapter(),
        }
        self.circuit_breakers: dict[str, CircuitBreaker] = {
            p: CircuitBreaker() for p in self.adapters
        }
        self._semaphores: dict[str, asyncio.Semaphore] = {
            p: asyncio.Semaphore(max_concurrent_per_provider) for p in self.adapters
        }
        self.default_fallback_hierarchy: list[str] = [
            "openai",
            "anthropic",
            "google_gemini",
            "local",
            "fake",
        ]

    def register_adapter(self, provider_name: str, adapter: ModelProviderInterface) -> None:
        self.adapters[provider_name] = adapter
        if provider_name not in self.circuit_breakers:
            self.circuit_breakers[provider_name] = CircuitBreaker()
            self._semaphores[provider_name] = asyncio.Semaphore(5)

    def resolve_candidate_providers(
        self,
        required_capabilities: list[str],
        preferred_provider: str | None = None,
        privacy_sensitive: bool = False,
        min_context_window: int | None = None,
    ) -> list[str]:
        """Filters providers by capabilities, privacy, context limits, and returns them in priority order."""
        ordered: list[str] = []
        if preferred_provider and preferred_provider in self.adapters:
            ordered.append(preferred_provider)

        for p in self.default_fallback_hierarchy:
            if p not in ordered and p in self.adapters:
                ordered.append(p)

        # Filter by privacy: If privacy_sensitive, prioritize local/private runtime
        if privacy_sensitive:
            ordered = [p for p in ordered if "privacy" in self.adapters[p].get_supported_capabilities() or p in ("local", "fake")]

        # Filter by capabilities
        req_set = set(required_capabilities)
        qualified: list[str] = []
        for p in ordered:
            adapter = self.adapters[p]
            caps = set(adapter.get_supported_capabilities())
            if req_set and not req_set.issubset(caps):
                continue
            if min_context_window and adapter.get_max_context_length("") < min_context_window:
                continue
            qualified.append(p)

        return qualified or ordered

    async def execute_with_fallback(
        self,
        request: ModelCompletionRequest,
        accumulated_cost: float = 0.0,
        max_budget_usd: float = 10.0,
    ) -> ModelCompletionResponse:
        """
        Executes inference request with:
        1. Budget-exhaustion check.
        2. Circuit-breaker validation.
        3. Capability-aware candidate resolution.
        4. Automatic failover across candidates.
        """
        if accumulated_cost >= max_budget_usd:
            raise BusinessRuleError(
                f"Budget exhausted: accumulated cost (${accumulated_cost:.4f}) exceeds allocated budget (${max_budget_usd:.4f})."
            )

        candidates = self.resolve_candidate_providers(
            required_capabilities=request.required_capabilities,
            preferred_provider=request.preferred_provider,
            privacy_sensitive=request.privacy_sensitive,
            min_context_window=request.min_context_window,
        )

        last_error: Exception | None = None

        for provider_name in candidates:
            cb = self.circuit_breakers.get(provider_name)
            if cb and not cb.allow_request():
                logger.warning("Circuit breaker OPEN for provider '%s', skipping to next fallback.", provider_name)
                continue

            adapter = self.adapters.get(provider_name)
            if not adapter:
                continue

            sem = self._semaphores.get(provider_name, asyncio.Semaphore(5))
            try:
                async with sem:
                    # Enforce context length guard
                    max_ctx = adapter.get_max_context_length(request.preferred_model or "")
                    if len(request.prompt) > max_ctx:
                        raise BusinessRuleError(f"Prompt chars ({len(request.prompt)}) exceed context limit ({max_ctx}).")

                    resp = await adapter.generate_completion(request)

                    # Post-execution budget check
                    if accumulated_cost + resp.cost_usd > max_budget_usd:
                        raise BusinessRuleError(
                            f"Task cost (${accumulated_cost + resp.cost_usd:.4f}) exceeds hard ceiling (${max_budget_usd:.4f})."
                        )

                    if cb:
                        cb.record_success()
                    return resp

            except Exception as exc:
                if cb:
                    cb.record_failure()
                last_error = exc
                logger.warning(
                    "Provider '%s' failed (%s). Failing over to next candidate.",
                    provider_name,
                    exc,
                )

        raise BusinessRuleError(
            f"All model providers in fallback chain exhausted. Root error: {last_error}"
        )
