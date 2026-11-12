"""
Vendor Model Adapters for the NEIMAN Intelligence Exchange.
Implements:
- Granular provider exceptions (RateLimit, Timeout, ContextOverflow, StructuredOutputValidation)
- CircuitBreaker state machine per provider (CLOSED, OPEN, HALF_OPEN)
- Structured output validation against Pydantic/JSON schemas
- Normalized vendor adapters for OpenAI, Anthropic, Google Gemini, and Local / On-Premise models
"""

import json
import logging
import math
import os
import re
import threading
import time
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any

from nexora.domains.intelligence.schemas import ModelRequest, ModelResponsePayload

logger = logging.getLogger(__name__)

# ── Operational limits (guards against unbounded resource consumption) ─────────

MAX_PROMPT_CHARS = 200_000
MAX_SYSTEM_PROMPT_CHARS = 100_000
MAX_TIMEOUT_SECONDS = 120.0
MIN_TIMEOUT_SECONDS = 1.0

# Query-string / header patterns that may carry credentials in upstream error text.
_SECRET_QUERY_PATTERN = re.compile(r"((?:key|api[-_]?key|token|access[-_]?token|password|secret)=)[^&\s'\"]+", re.IGNORECASE)
_BEARER_PATTERN = re.compile(r"(Bearer\s+)[A-Za-z0-9._\-]{8,}", re.IGNORECASE)


# ── Provider credential resolution ────────────────────────────────────────────
#
# Credentials are NEVER hardcoded in source. They are resolved from the process
# environment (or the untracked `apps/api/.env` file) at import time so that a
# leaked repository cannot leak live vendor keys. The FALLBACK_* aliases keep the
# historical call sites readable; each one simply points at the matching
# `Settings` field.


def _env_secret(*names: str) -> str:
    """Resolves the first configured credential among `names` (empty string if none)."""
    from nexora.config import get_settings

    settings = get_settings()
    for name in names:
        value = os.environ.get(name) or (
            getattr(settings, name, None) if settings is not None else None
        )
        if value:
            return str(value)
    return ""


FALLBACK_GEMINI_API_KEY = _env_secret("GEMINI_API_KEY", "GOOGLE_API_KEY")
FALLBACK_OPENAI_API_KEY = _env_secret("OPENAI_API_KEY")
FALLBACK_ANTHROPIC_API_KEY = _env_secret("ANTHROPIC_API_KEY")
FALLBACK_GROQ_API_KEY = _env_secret("GROQ_API_KEY")
FALLBACK_DEEPSEEK_API_KEY = _env_secret("DEEPSEEK_API_KEY")
FALLBACK_TOGETHER_API_KEY = _env_secret("TOGETHER_AI_API_KEY")
FALLBACK_KILO_API_KEY = _env_secret("KILO_API_KEY", "KILOCODE_API_KEY")
FALLBACK_META_API_KEY = _env_secret("META_API_KEY", "META_MUSE_API_KEY")
FALLBACK_OLLAMA_API_KEY = _env_secret("OLLAMA_API_KEY")
FALLBACK_HUGGINGFACE_API_KEY = _env_secret("HUGGINGFACE_API_KEY", "HF_TOKEN")
FALLBACK_KIMI_API_KEY = _env_secret("KIMI_API_KEY", "MOONSHOT_API_KEY")
FALLBACK_ZAI_API_KEY = _env_secret("ZAI_API_KEY", "Z_AI_API_KEY", "ZHIPU_API_KEY", "ZHIPUAI_API_KEY")
FALLBACK_ZHIPU_API_KEY = FALLBACK_ZAI_API_KEY
FALLBACK_ALIBABA_API_KEY = _env_secret(
    "ALIBABA_API_KEY", "ALIBABACLOUD_API_KEY", "DASHSCOPE_API_KEY", "QWEN_API_KEY"
)
FALLBACK_DASHSCOPE_API_KEY = FALLBACK_ALIBABA_API_KEY
FALLBACK_POOLSIDE_API_KEY = _env_secret("POOLSIDE_API_KEY")
FALLBACK_ARCEE_API_KEY = _env_secret("ARCEE_API_KEY")
FALLBACK_XIAOMIMIMO_API_KEY = _env_secret("XIAOMIMIMO_API_KEY", "MIMO_API_KEY", "XIAOMI_MIMO_API_KEY")
FALLBACK_MINIMAX_API_KEY = _env_secret("MINIMAX_API_KEY")
FALLBACK_UPSTAGE_API_KEY = _env_secret("UPSTAGE_API_KEY")


def _configured_secret_values() -> tuple[str, ...]:
    """Every credential currently configured, used to scrub outbound error text."""
    from nexora.config import get_settings

    settings = get_settings()
    values: list[str] = []
    for name in dir(settings):
        if not (name.endswith("_API_KEY") or name == "HF_TOKEN"):
            continue
        value = getattr(settings, name, None)
        if isinstance(value, str) and len(value) >= 4:
            values.append(value)
    for k in (
        FALLBACK_GEMINI_API_KEY,
        FALLBACK_OPENAI_API_KEY,
        FALLBACK_ANTHROPIC_API_KEY,
        FALLBACK_GROQ_API_KEY,
        FALLBACK_DEEPSEEK_API_KEY,
        FALLBACK_TOGETHER_API_KEY,
        FALLBACK_KILO_API_KEY,
        FALLBACK_META_API_KEY,
        FALLBACK_OLLAMA_API_KEY,
        FALLBACK_HUGGINGFACE_API_KEY,
        FALLBACK_KIMI_API_KEY,
        FALLBACK_ZAI_API_KEY,
        FALLBACK_ALIBABA_API_KEY,
        FALLBACK_POOLSIDE_API_KEY,
        FALLBACK_ARCEE_API_KEY,
        FALLBACK_XIAOMIMIMO_API_KEY,
        FALLBACK_MINIMAX_API_KEY,
        FALLBACK_UPSTAGE_API_KEY,
    ):
        if k and len(k) >= 4 and k not in values:
            values.append(k)
    return tuple(values)


def redact_secrets(text: str, *extra_secrets: str | None) -> str:
    """
    Removes credentials from outbound error text before it is logged, persisted to the
    routing ledger, or returned to an API client.

    Upstream HTTP errors embed the full request URL in their message, so any secret
    placed in a query string (e.g. Google's `?key=`) leaks verbatim unless scrubbed.
    """
    if not text:
        return text
    scrubbed = text
    for secret in (*_configured_secret_values(), *extra_secrets):
        if secret and len(secret) >= 4:
            scrubbed = scrubbed.replace(secret, "[REDACTED]")
    scrubbed = _SECRET_QUERY_PATTERN.sub(r"\1[REDACTED]", scrubbed)
    scrubbed = _BEARER_PATTERN.sub(r"\1[REDACTED]", scrubbed)
    return scrubbed


def clamp_timeout(seconds: float | None, default: float = 15.0) -> float:
    """Clamps a caller-supplied timeout into a safe, bounded range."""
    try:
        value = float(seconds) if seconds is not None else default
    except (TypeError, ValueError):
        return default
    if not math.isfinite(value):
        return default
    return max(MIN_TIMEOUT_SECONDS, min(value, MAX_TIMEOUT_SECONDS))


def _safe_float(value: Any, default: float) -> float:
    """Coerces a metadata value to a finite float, falling back to `default`."""
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(result):
        return default
    return result


def _reject_json_constant(name: str) -> Any:
    """`json.loads` hook that refuses the non-standard NaN / Infinity literals."""
    raise ValueError(f"Invalid JSON constant: {name}")


def _json_type_matches(value: Any, expected: str | list[str]) -> bool:
    """Checks a JSON value against a JSON Schema primitive type declaration."""
    expected_types = expected if isinstance(expected, list) else [expected]
    for candidate in expected_types:
        match candidate:
            case "object":
                if isinstance(value, dict):
                    return True
            case "array":
                if isinstance(value, list):
                    return True
            case "string":
                if isinstance(value, str):
                    return True
            case "integer":
                if isinstance(value, int) and not isinstance(value, bool):
                    return True
            case "number":
                if isinstance(value, int | float) and not isinstance(value, bool):
                    return True
            case "boolean":
                if isinstance(value, bool):
                    return True
            case "null":
                if value is None:
                    return True
    return False


class CircuitState(str, Enum):
    CLOSED = "CLOSED"  # Normal operation: traffic flows freely
    OPEN = "OPEN"  # Outage / high error rate: traffic rejected immediately
    HALF_OPEN = "HALF_OPEN"  # Testing recovery with canary queries


class ProviderException(Exception):
    """Base exception for model provider errors."""

    def __init__(
        self,
        provider: str,
        message: str,
        status_code: int = 500,
        policy_rejected: bool = False,
    ) -> None:
        self.provider = provider
        self.status_code = status_code
        # Set when the call was refused by a local policy check (e.g. the egress
        # guard). Such errors must never be downgraded to a simulated response.
        self.policy_rejected = policy_rejected
        super().__init__(f"[{provider.upper()}] {message}")


class ProviderRateLimitError(ProviderException):
    """Raised when provider returns HTTP 429 or quota limit exhaustion."""

    def __init__(self, provider: str, retry_after_seconds: float = 2.0) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__(
            provider,
            f"Rate limit / quota exceeded. Retry after {retry_after_seconds}s.",
            status_code=429,
        )


class ProviderTimeoutError(ProviderException):
    """Raised when provider call exceeds the SLA timeout."""

    def __init__(self, provider: str, timeout_seconds: float) -> None:
        super().__init__(provider, f"Request timed out after {timeout_seconds}s.", status_code=504)


class ContextLengthExceededError(ProviderException):
    """Raised when prompt + generation tokens exceed model context capacity."""

    def __init__(
        self, provider: str, context_needed: int = 0, model_limit: int = 0
    ) -> None:
        super().__init__(
            provider,
            f"Context length {context_needed} tokens exceeds capacity {model_limit} tokens.",
            status_code=400,
        )


class StructuredOutputValidationError(ProviderException):
    """Raised when generated response fails schema validation."""

    def __init__(self, provider: str, reason: str) -> None:
        super().__init__(
            provider, f"Structured output schema validation failed: {reason}", status_code=422
        )


class CircuitBreaker:
    """
    Per-provider circuit breaker protecting against cascading failures.
    State transitions:
    - CLOSED -> OPEN after `failure_threshold` consecutive errors.
    - OPEN -> HALF_OPEN after `recovery_timeout_seconds`.
    - HALF_OPEN -> CLOSED on first success, or OPEN on failure.

    Thread-safety: all transitions are guarded by a re-entrant lock, and only a
    single probe is admitted while the breaker is HALF_OPEN. Without that guard a
    burst of concurrent waiters would all be let through and hammer a provider that
    is still recovering (thundering-herd / retry storm).
    """

    def __init__(
        self,
        provider_name: str,
        failure_threshold: int = 3,
        recovery_timeout_seconds: float = 30.0,
    ) -> None:
        self.provider_name = provider_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self.state: CircuitState = CircuitState.CLOSED
        self.failure_count: int = 0
        self.last_failure_time: float | None = None
        self.last_state_change: float = time.time()
        self._lock = threading.RLock()
        self._probe_in_flight: bool = False

    def can_execute(self) -> bool:
        """
        Side-effect free check of whether traffic is currently permitted.

        This method never mutates state: health probes call it for observation only
        and must not advance the state machine.
        """
        with self._lock:
            now = time.time()
            if self.state == CircuitState.OPEN:
                last_failure = self.last_failure_time or self.last_state_change
                return (now - last_failure) >= self.recovery_timeout_seconds
            if self.state == CircuitState.HALF_OPEN:
                return not self._probe_in_flight
            return True

    def try_acquire(self) -> bool:
        """
        Atomically admits a call. Moves OPEN -> HALF_OPEN when the recovery window
        has elapsed and admits exactly one probe while HALF_OPEN.
        """
        with self._lock:
            now = time.time()
            if self.state == CircuitState.OPEN:
                last_failure = self.last_failure_time or self.last_state_change
                if (now - last_failure) < self.recovery_timeout_seconds:
                    return False
                self.state = CircuitState.HALF_OPEN
                self.last_state_change = now
                self._probe_in_flight = True
                return True
            if self.state == CircuitState.HALF_OPEN:
                if self._probe_in_flight:
                    return False
                self._probe_in_flight = True
                return True
            return True

    def release_probe(self) -> None:
        """Releases the HALF_OPEN probe slot without changing the breaker state."""
        with self._lock:
            self._probe_in_flight = False

    def record_success(self) -> None:
        """Register successful call, resetting circuit to CLOSED."""
        with self._lock:
            self.failure_count = 0
            self.last_failure_time = None
            self.state = CircuitState.CLOSED
            self.last_state_change = time.time()
            self._probe_in_flight = False

    def record_failure(self) -> None:
        """Register failure and transition to OPEN if threshold reached."""
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            self._probe_in_flight = False
            if self.state == CircuitState.HALF_OPEN:
                # A failed probe sends the breaker straight back to OPEN.
                self.state = CircuitState.OPEN
                self.last_state_change = self.last_failure_time
            elif self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                self.last_state_change = self.last_failure_time

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "provider": self.provider_name,
                "state": self.state.value,
                "failure_count": self.failure_count,
                "last_failure_time": self.last_failure_time,
            }


class BaseModelAdapter(ABC):
    """Abstract adapter defining the contract all AI vendor integrations must satisfy."""

    def __init__(self) -> None:
        self.circuit_breaker = CircuitBreaker(self.get_provider_name())
        self._last_timeout: float = 15.0

    @abstractmethod
    def get_provider_name(self) -> str:
        """Returns the canonical provider name, e.g. 'openai', 'anthropic', 'google_gemini', 'local'."""
        pass

    def validate_structured_output(
        self, text: str, schema: dict[str, Any] | None
    ) -> tuple[bool, str | None]:
        """
        Validates model output against the supplied JSON schema.

        Checks performed:
        1. Strict JSON parse (NaN / Infinity are rejected, unlike `json.loads` defaults).
        2. The document must be a JSON object when the schema describes object
           properties or required keys (a JSON array or scalar cannot satisfy them).
        3. Every `required` property must be present.
        4. Declared `properties` types are enforced for the primitive JSON types.

        Returns (is_valid, error_reason).
        """
        if not schema:
            return True, None

        try:
            # `parse_constant` rejects NaN / Infinity / -Infinity, which are not
            # valid JSON and would break strict downstream parsers.
            parsed = json.loads(text, parse_constant=_reject_json_constant)
        except ValueError as e:
            return False, f"Output is not valid JSON: {str(e)}"
        except Exception as e:  # pragma: no cover - defensive
            return False, f"Output is not valid JSON: {str(e)}"

        required_keys = schema.get("required") or []
        properties = schema.get("properties") or {}

        if not isinstance(required_keys, list) or not isinstance(properties, dict):
            return False, "Schema 'required' must be a list and 'properties' must be an object."

        schema_expects_object = bool(required_keys) or bool(properties) or schema.get("type") == "object"

        if schema_expects_object and not isinstance(parsed, dict):
            return False, (
                "Schema expects a JSON object but the model returned "
                f"{type(parsed).__name__}."
            )

        if isinstance(parsed, dict):
            for k in required_keys:
                if k not in parsed:
                    return False, f"Missing required property: '{k}'"

            for name, spec in properties.items():
                if name not in parsed or not isinstance(spec, dict):
                    continue
                expected = spec.get("type")
                if not expected or name not in parsed:
                    continue
                actual = parsed[name]
                if not _json_type_matches(actual, expected):
                    return False, (
                        f"Property '{name}' has type '{type(actual).__name__}' "
                        f"but the schema requires '{expected}'."
                    )
        return True, None

    @abstractmethod
    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        """Execute text or reasoning generation against the vendor model."""
        pass

    def get_simulation_behavior(self, flags: dict[str, Any]) -> str | None:
        """Resolves simulation behavior for this provider or fallback to global wildcard flags."""
        return (
            flags.get(self.get_provider_name())
            or flags.get("all")
            or flags.get("default")
            or flags.get("*")
        )

    def _simulation_fallback_enabled(self, request: ModelRequest) -> bool:
        """Allow synthetic completions strictly in test environments."""
        import os
        from nexora.config import get_settings

        settings = get_settings()
        is_test_env = settings.ENVIRONMENT == "test" or bool(os.environ.get("PYTEST_CURRENT_TEST"))
        if not is_test_env:
            return False

        if self.get_simulation_behavior(request.simulation_flags or {}):
            return True

        return bool(settings.ENABLE_SIMULATION_MODE)

    def _require_simulation_fallback(self, request: ModelRequest) -> None:
        if not self._simulation_fallback_enabled(request):
            raise ProviderException(
                self.get_provider_name(),
                "No live completion is available and simulation mode is disabled.",
                status_code=503,
            )

    def should_simulate_length_limit(self, model_identifier: str, request: ModelRequest) -> bool:
        """Determines whether simulated length limit truncation should be triggered."""
        flags = request.simulation_flags or {}
        req_meta = getattr(request, "metadata", None) or {}
        sim_len = req_meta.get("simulate_length")
        simulate_models = req_meta.get("simulate_length_models") or []
        if not isinstance(simulate_models, list | tuple | set):
            simulate_models = []
        return bool(
            self.get_simulation_behavior(flags) == "length"
            or flags.get(model_identifier) == "length"
            or sim_len is True
            or sim_len == model_identifier
            or sim_len == self.get_provider_name()
            or model_identifier in simulate_models
        )

    # ── Shared live-call helpers ──────────────────────────────────────────────

    @staticmethod
    def _resolve_timeout(request: ModelRequest) -> float:
        """Returns a bounded timeout so a caller cannot pin a worker indefinitely."""
        return clamp_timeout(getattr(request, "timeout_seconds", None))

    @staticmethod
    def _compute_cost(
        model_metadata: dict[str, Any],
        prompt_tokens: int,
        completion_tokens: int,
        default_input_rate: float = 2.50,
        default_output_rate: float = 10.00,
    ) -> float:
        """
        Computes the estimated USD cost of a call.

        Rate columns are nullable in the catalog, so a missing rate must degrade to
        the documented default instead of raising `TypeError` on `int * None`.
        """
        in_rate = _safe_float(
            model_metadata.get("input_cost_per_million"), default_input_rate
        )
        out_rate = _safe_float(
            model_metadata.get("output_cost_per_million"), default_output_rate
        )
        return (prompt_tokens * in_rate / 1_000_000) + (
            completion_tokens * out_rate / 1_000_000
        )

    def _validate_endpoint(self, base_url: str, model_metadata: dict[str, Any]) -> str:
        """
        Guards the outbound request against SSRF.

        The endpoint is tenant-configurable and the request carries the provider's
        decrypted API key, so an unvalidated base_url would let a tenant redirect
        the key to an arbitrary host. Providers flagged `is_local` keep access to
        loopback / private ranges (self-hosted Ollama, vLLM, ...).
        """
        from nexora.core.security import ToolSandbox

        is_local = bool(model_metadata.get("is_local"))
        try:
            return ToolSandbox.validate_provider_endpoint(
                base_url, allow_loopback=is_local, allow_private=is_local
            )
        except Exception as exc:
            raise ProviderException(
                self.get_provider_name(),
                f"Provider endpoint rejected by egress policy: {exc}",
                status_code=400,
                policy_rejected=True,
            ) from exc

    @staticmethod
    def _retry_after_seconds(resp: Any, default: float) -> float:
        """Extracts a Retry-After hint (delta seconds or HTTP-date) from a response."""
        try:
            raw = resp.headers.get("retry-after")
        except Exception:
            return default
        if not raw:
            return default
        try:
            return max(0.0, float(raw))
        except (TypeError, ValueError):
            pass
        try:
            from email.utils import parsedate_to_datetime

            when = parsedate_to_datetime(str(raw))
            if when.tzinfo is None:
                from datetime import UTC

                when = when.replace(tzinfo=UTC)
            delta = (when - datetime.now(UTC)).total_seconds()
            return max(0.0, delta)
        except Exception:
            return default

    def _raise_mapped_http_error(self, exc: Exception, api_key: str | None = None) -> None:
        """
        Translates an httpx failure into a typed provider exception.

        - Network/read timeouts become `ProviderTimeoutError` (504) so the router's
          timeout-specific failover path is actually reachable.
        - HTTP status errors keep their upstream status semantics (4xx -> 502/401,
          5xx -> 503) instead of collapsing into a generic 500.
        - The message is scrubbed of credentials before it can reach logs, the
          routing ledger or an API response.
        """
        import httpx

        provider = self.get_provider_name()

        if isinstance(exc, httpx.TimeoutException):
            raise ProviderTimeoutError(provider, timeout_seconds=self._last_timeout) from exc

        if isinstance(exc, httpx.HTTPStatusError):
            upstream = exc.response.status_code
            safe = redact_secrets(str(exc), api_key)
            if upstream == 429:
                raise ProviderRateLimitError(provider) from exc
            if upstream in (401, 403):
                raise ProviderException(
                    provider, f"Provider rejected credentials (HTTP {upstream}): {safe}", 401
                ) from exc
            if upstream == 400 and "context" in safe.lower():
                raise ContextLengthExceededError(provider, 0, 0) from exc
            status = 503 if upstream >= 500 else 502
            raise ProviderException(
                provider, f"Provider returned HTTP {upstream}: {safe}", status
            ) from exc

        safe = redact_secrets(str(exc), api_key)
        raise ProviderException(provider, f"Live call failed: {safe}") from exc

    @abstractmethod
    async def check_health(self) -> bool:
        """Probe provider liveness."""
        pass


class OpenAILiveAdapter(BaseModelAdapter):
    """Adapter for OpenAI models (GPT-4o, o1, o3-mini) with failure simulation & normalization."""

    def get_provider_name(self) -> str:
        return "openai"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        # Check simulation hooks
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)

        if sim_behavior == "rate_limit":
            raise ProviderRateLimitError(self.get_provider_name(), retry_after_seconds=1.5)
        if sim_behavior == "timeout":
            raise ProviderTimeoutError(
                self.get_provider_name(), timeout_seconds=request.timeout_seconds
            )
        from nexora.config import get_settings

        settings = get_settings()

        response_text = None
        prompt_tokens = 0
        completion_tokens = 0
        latency_ms = model_metadata.get("avg_latency_ms", 450.0)
        finish_reason = "stop"
        is_truncated = False
        live_attempted = False

        if sim_behavior == "length" or self.should_simulate_length_limit(model_identifier, request):
            finish_reason = "length"
            is_truncated = True

        # Check if live execution is configured and enabled
        api_key = (
            model_metadata.get("api_key")
            or (getattr(request, "runtime_api_keys", {}).get("openai") if getattr(request, "runtime_api_keys", None) else None)
            or (getattr(request, "runtime_api_keys", {}).get("api_key") if getattr(request, "runtime_api_keys", None) else None)
            or getattr(settings, "OPENAI_API_KEY", None)
            or FALLBACK_OPENAI_API_KEY
        )
        base_url = (
            model_metadata.get("base_url")
            or getattr(settings, "OPENAI_BASE_URL", None)
            or "https://api.openai.com/v1"
        )

        if api_key and not sim_behavior and not getattr(settings, "ENABLE_SIMULATION_MODE", False):
            import httpx

            timeout_seconds = self._resolve_timeout(request)
            self._last_timeout = timeout_seconds
            t_start = time.perf_counter()
            live_attempted = True
            try:
                base_url = self._validate_endpoint(base_url, model_metadata)
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
                messages = []
                if request.system_prompt:
                    messages.append({"role": "system", "content": request.system_prompt})
                messages.append({"role": "user", "content": request.prompt})

                payload: dict[str, Any] = {
                    "model": model_identifier,
                    "messages": messages,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                }
                if request.structured_output_schema:
                    payload["response_format"] = {"type": "json_object"}

                endpoint = f"{base_url.rstrip('/')}/chat/completions"
                async with httpx.AsyncClient(
                    timeout=timeout_seconds, follow_redirects=False
                ) as client:
                    resp = await client.post(
                        endpoint,
                        json=payload,
                        headers=headers,
                    )
                    if resp.status_code == 429:
                        raise ProviderRateLimitError(
                            self.get_provider_name(),
                            retry_after_seconds=self._retry_after_seconds(resp, 2.0),
                        )
                    resp.raise_for_status()
                    data = resp.json()
                    choice = (data.get("choices") or [None])[0]
                    if not choice:
                        raise ProviderException(
                            self.get_provider_name(),
                            "Provider returned a response without any completion choice.",
                            status_code=502,
                        )
                    message = choice.get("message") or {}
                    response_text = message.get("content")
                    raw_finish = choice.get("finish_reason", "stop")
                    if raw_finish == "length":
                        finish_reason = "length"
                        is_truncated = True
                    usage = data.get("usage", {}) or {}
                    prompt_tokens = usage.get("prompt_tokens", 0) or 0
                    completion_tokens = usage.get("completion_tokens", 0) or 0
                    latency_ms = (time.perf_counter() - t_start) * 1000
            except (ProviderRateLimitError, ProviderTimeoutError, ProviderException):
                # Policy rejections (e.g. the egress guard) and provider errors must
                # always propagate: swallowing them would replace a blocked call
                # with a fabricated response.
                raise
            except Exception as e:
                clean_err = redact_secrets(str(e), api_key)
                logger.warning("OpenAI live call failed: %s", clean_err)
                self._raise_mapped_http_error(e, api_key)

        if response_text is None and live_attempted:
            # A live call that produced no usable content must not be silently
            # replaced by a synthetic answer: that would present fabricated output
            # as a genuine vendor response in the routing ledger.
            raise ProviderException(
                self.get_provider_name(),
                "Provider returned an empty completion payload.",
                status_code=502,
            )

        if response_text is None:
            self._require_simulation_fallback(request)
            if sim_behavior == "malformed_json" and request.structured_output_schema:
                # Emit invalid json to test schema validation
                response_text = "Here is the result: { missing_quotes: invalid_json "
            else:
                prompt_len = len(request.prompt.split()) + (
                    len(request.system_prompt.split()) if request.system_prompt else 0
                )
                prompt_tokens = int(prompt_len * 1.3) + 15
                completion_tokens = 280

                if request.structured_output_schema:
                    # Return compliant JSON
                    sample_output = {
                        "provider": "openai",
                        "model": model_identifier,
                        "status": "completed",
                        "analysis": f"Synthesized response for: {request.prompt[:50]}",
                    }
                    # Add any required fields to satisfy schema
                    for req_key in request.structured_output_schema.get("required", []):
                        if req_key not in sample_output:
                            sample_output[req_key] = f"sample_{req_key}_value"
                    response_text = json.dumps(sample_output)
                else:
                    response_text = (
                        f"[OpenAI/{model_identifier}] Synthesized response to: '{request.prompt[:60]}...' "
                        f"Adhering to capabilities: {', '.join(request.required_capabilities)}."
                    )

        # Structured output check
        is_valid, val_err = self.validate_structured_output(
            response_text, request.structured_output_schema
        )
        if not is_valid:
            raise StructuredOutputValidationError(
                self.get_provider_name(), val_err or "Invalid format"
            )

        if prompt_tokens == 0:
            prompt_len = len(request.prompt.split()) + (
                len(request.system_prompt.split()) if request.system_prompt else 0
            )
            prompt_tokens = max(1, int(prompt_len * 1.3) + 15)
        if completion_tokens == 0:
            completion_tokens = max(1, int(len(response_text.split()) * 1.3))
        total_tokens = prompt_tokens + completion_tokens

        cost_usd = self._compute_cost(
            model_metadata, prompt_tokens, completion_tokens, 2.50, 10.00
        )

        return ModelResponsePayload(
            text=response_text,
            model_used=model_identifier,
            provider_used=self.get_provider_name(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
            latency_ms=latency_ms,
            structured_output_validated=bool(request.structured_output_schema),
            circuit_breaker_status=self.circuit_breaker.state.value,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def check_health(self) -> bool:
        return self.circuit_breaker.can_execute()


class AnthropicLiveAdapter(BaseModelAdapter):
    """Adapter for Anthropic Claude models (Claude 3.5 Sonnet, Haiku, Opus)."""

    def get_provider_name(self) -> str:
        return "anthropic"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)

        if sim_behavior == "rate_limit":
            raise ProviderRateLimitError(self.get_provider_name(), retry_after_seconds=2.0)
        if sim_behavior == "timeout":
            raise ProviderTimeoutError(
                self.get_provider_name(), timeout_seconds=request.timeout_seconds
            )
        from nexora.config import get_settings

        settings = get_settings()

        response_text = None
        prompt_tokens = 0
        completion_tokens = 0
        latency_ms = _safe_float(model_metadata.get("avg_latency_ms"), 650.0)
        finish_reason = "stop"
        is_truncated = False
        live_attempted = False

        if sim_behavior == "length" or self.should_simulate_length_limit(model_identifier, request):
            finish_reason = "length"
            is_truncated = True

        api_key = (
            model_metadata.get("api_key")
            or (getattr(request, "runtime_api_keys", {}).get("anthropic") if getattr(request, "runtime_api_keys", None) else None)
            or getattr(settings, "ANTHROPIC_API_KEY", None)
            or FALLBACK_ANTHROPIC_API_KEY
        )
        base_url = (
            model_metadata.get("base_url")
            or getattr(settings, "ANTHROPIC_BASE_URL", None)
            or "https://api.anthropic.com/v1"
        )

        if api_key and not sim_behavior and not getattr(settings, "ENABLE_SIMULATION_MODE", False):
            import httpx

            timeout_seconds = self._resolve_timeout(request)
            self._last_timeout = timeout_seconds
            t_start = time.perf_counter()
            live_attempted = True
            try:
                base_url = self._validate_endpoint(base_url, model_metadata)
                headers = {
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                }
                payload: dict[str, Any] = {
                    "model": model_identifier,
                    # Honour the caller's budget instead of silently truncating at 1024.
                    "max_tokens": request.max_tokens,
                    "temperature": request.temperature,
                    "messages": [{"role": "user", "content": request.prompt}],
                }
                if request.system_prompt:
                    payload["system"] = request.system_prompt

                endpoint = f"{base_url.rstrip('/')}/messages"
                async with httpx.AsyncClient(
                    timeout=timeout_seconds, follow_redirects=False
                ) as client:
                    resp = await client.post(
                        endpoint,
                        json=payload,
                        headers=headers,
                    )
                    if resp.status_code == 429:
                        raise ProviderRateLimitError(
                            self.get_provider_name(),
                            retry_after_seconds=self._retry_after_seconds(resp, 2.0),
                        )
                    resp.raise_for_status()
                    data = resp.json()
                    content_blocks = data.get("content") or []
                    response_text = "".join(
                        block.get("text", "")
                        for block in content_blocks
                        if isinstance(block, dict)
                    )
                    raw_stop = data.get("stop_reason", "end_turn")
                    if raw_stop == "max_tokens":
                        finish_reason = "length"
                        is_truncated = True
                    usage = data.get("usage", {}) or {}
                    prompt_tokens = usage.get("input_tokens", 0) or 0
                    completion_tokens = usage.get("output_tokens", 0) or 0
                    latency_ms = (time.perf_counter() - t_start) * 1000
            except (ProviderRateLimitError, ProviderTimeoutError, ProviderException):
                raise
            except Exception as e:
                clean_err = redact_secrets(str(e), api_key)
                logger.warning("Anthropic live call failed: %s", clean_err)
                self._raise_mapped_http_error(e, api_key)

        if response_text is None and live_attempted:
            raise ProviderException(
                self.get_provider_name(),
                "Provider returned an empty completion payload.",
                status_code=502,
            )

        if response_text is None:
            self._require_simulation_fallback(request)
            if sim_behavior == "malformed_json" and request.structured_output_schema:
                response_text = "I analyzed this but here is raw markdown ```json not closed"
            else:
                if request.structured_output_schema:
                    sample_output = {
                        "provider": "anthropic",
                        "model": model_identifier,
                        "status": "completed",
                        "analysis": f"Claude architectural review: {request.prompt[:50]}",
                    }
                    for req_key in request.structured_output_schema.get("required", []):
                        if req_key not in sample_output:
                            sample_output[req_key] = f"claude_{req_key}_data"
                    response_text = json.dumps(sample_output)
                else:
                    response_text = (
                        f"[Anthropic/{model_identifier}] Analytical architectural output addressing: '{request.prompt[:60]}...' "
                        f"Structured according to NEIMAN organizational standards."
                    )

        is_valid, val_err = self.validate_structured_output(
            response_text, request.structured_output_schema
        )
        if not is_valid:
            raise StructuredOutputValidationError(
                self.get_provider_name(), val_err or "Invalid schema"
            )

        if prompt_tokens == 0:
            prompt_len = len(request.prompt.split()) + (
                len(request.system_prompt.split()) if request.system_prompt else 0
            )
            prompt_tokens = max(1, int(prompt_len * 1.3) + 12)
        if completion_tokens == 0:
            completion_tokens = max(1, int(len(response_text.split()) * 1.3))
        total_tokens = prompt_tokens + completion_tokens

        in_rate = model_metadata.get("input_cost_per_million", 3.00)
        out_rate = model_metadata.get("output_cost_per_million", 15.00)
        cost_usd = (prompt_tokens * in_rate / 1_000_000) + (
            completion_tokens * out_rate / 1_000_000
        )

        return ModelResponsePayload(
            text=response_text,
            model_used=model_identifier,
            provider_used=self.get_provider_name(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
            latency_ms=latency_ms,
            structured_output_validated=bool(request.structured_output_schema),
            circuit_breaker_status=self.circuit_breaker.state.value,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def check_health(self) -> bool:
        return self.circuit_breaker.can_execute()


class GeminiLiveAdapter(BaseModelAdapter):
    """Adapter for Google Gemini models (Gemini 1.5 Pro, Flash, Gemini 2.0)."""

    def get_provider_name(self) -> str:
        return "google_gemini"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)

        if sim_behavior == "rate_limit":
            raise ProviderRateLimitError(self.get_provider_name(), retry_after_seconds=1.0)
        if sim_behavior == "timeout":
            raise ProviderTimeoutError(
                self.get_provider_name(), timeout_seconds=request.timeout_seconds
            )
        from nexora.config import get_settings

        settings = get_settings()

        response_text = None
        prompt_tokens = 0
        completion_tokens = 0
        latency_ms = model_metadata.get("avg_latency_ms", 380.0)
        finish_reason = "stop"
        is_truncated = False

        if sim_behavior == "length" or self.should_simulate_length_limit(model_identifier, request):
            finish_reason = "length"
            is_truncated = True

        api_key = (
            model_metadata.get("api_key")
            or (getattr(request, "runtime_api_keys", {}).get("google_gemini") if getattr(request, "runtime_api_keys", None) else None)
            or (getattr(request, "runtime_api_keys", {}).get("gemini") if getattr(request, "runtime_api_keys", None) else None)
            or getattr(settings, "GEMINI_API_KEY", None)
            or FALLBACK_GEMINI_API_KEY
        )

        live_attempted = False

        if api_key and not sim_behavior and not getattr(settings, "ENABLE_SIMULATION_MODE", False):
            import httpx

            target_model = model_identifier
            # Map only retired legacy model names to active Google AI Studio equivalents
            if target_model in (
                "gemini-1.5-pro",
                "gemini-1.5-flash",
                "gemini-pro",
            ):
                target_model = "gemini-2.5-flash"

            t_start = time.perf_counter()
            timeout_seconds = self._resolve_timeout(request)
            self._last_timeout = timeout_seconds
            live_attempted = True
            try:
                # Standard Google Generative Language REST Endpoint.
                # The credential travels in the `x-goog-api-key` HEADER, never in the
                # query string: httpx embeds the full URL in its error messages, so a
                # `?key=` parameter leaks the secret into logs, the routing ledger
                # and API responses.
                endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent"
                headers = {"x-goog-api-key": api_key, "content-type": "application/json"}
                payload: dict[str, Any] = {
                    "contents": [{"parts": [{"text": request.prompt}]}],
                    "generationConfig": {
                        "temperature": request.temperature,
                        "maxOutputTokens": request.max_tokens,
                    },
                }
                if request.system_prompt:
                    payload["system_instruction"] = {"parts": [{"text": request.system_prompt}]}
                if request.structured_output_schema:
                    # Ask the vendor for a JSON document instead of prose.
                    payload["generationConfig"]["responseMimeType"] = "application/json"

                async with httpx.AsyncClient(
                    timeout=timeout_seconds, follow_redirects=False
                ) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    # If deprecated or not found on this tier, attempt one retry with gemini-2.5-flash
                    if resp.status_code == 404 and target_model != "gemini-2.5-flash":
                        target_model = "gemini-2.5-flash"
                        retry_endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent"
                        resp = await client.post(retry_endpoint, json=payload, headers=headers)

                    if resp.status_code == 429:
                        clean_err = redact_secrets(resp.text, api_key)
                        raise ProviderRateLimitError(self.get_provider_name(), clean_err)
                    else:
                        resp.raise_for_status()
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        response_text = "".join(p.get("text", "") for p in parts)
                        raw_finish = candidates[0].get("finishReason", "STOP")
                        if raw_finish == "MAX_TOKENS":
                            finish_reason = "length"
                            is_truncated = True
                    usage = data.get("usageMetadata", {}) or {}
                    prompt_tokens = usage.get("promptTokenCount", 0) or 0
                    completion_tokens = usage.get("candidatesTokenCount", 0) or 0
                    latency_ms = (time.perf_counter() - t_start) * 1000
            except (ProviderRateLimitError, ProviderTimeoutError, ProviderException):
                raise
            except Exception as e:
                clean_err = redact_secrets(str(e), api_key)
                logger.warning("Gemini live call failed: %s", clean_err)
                self._raise_mapped_http_error(e, api_key)

        if response_text is None and live_attempted:
            raise ProviderException(
                self.get_provider_name(),
                "Provider returned an empty completion payload.",
                status_code=502,
            )

        if response_text is None:
            self._require_simulation_fallback(request)
            if sim_behavior == "malformed_json" and request.structured_output_schema:
                response_text = "<json>Invalid format</json>"
            else:
                if request.structured_output_schema:
                    sample_output = {
                        "provider": "google_gemini",
                        "model": model_identifier,
                        "status": "completed",
                        "analysis": f"Gemini large-context analysis: {request.prompt[:50]}",
                    }
                    for req_key in request.structured_output_schema.get("required", []):
                        if req_key not in sample_output:
                            sample_output[req_key] = f"gemini_{req_key}_data"
                    response_text = json.dumps(sample_output)
                else:
                    response_text = (
                        f"[Google Gemini/{model_identifier}] High-context response for: '{request.prompt[:60]}...' "
                        f"Processed with extended context capacity."
                    )

        is_valid, val_err = self.validate_structured_output(
            response_text, request.structured_output_schema
        )
        if not is_valid:
            raise StructuredOutputValidationError(
                self.get_provider_name(), val_err or "Invalid schema"
            )

        if prompt_tokens == 0:
            prompt_tokens = max(1, int(len(request.prompt.split()) * 1.3) + 10)
        if completion_tokens == 0:
            completion_tokens = max(1, int(len(response_text.split()) * 1.3))
        total_tokens = prompt_tokens + completion_tokens

        in_rate = model_metadata.get("input_cost_per_million", 1.25)
        out_rate = model_metadata.get("output_cost_per_million", 5.00)
        cost_usd = (prompt_tokens * in_rate / 1_000_000) + (
            completion_tokens * out_rate / 1_000_000
        )

        return ModelResponsePayload(
            text=response_text,
            model_used=model_identifier,
            provider_used=self.get_provider_name(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
            latency_ms=latency_ms,
            structured_output_validated=bool(request.structured_output_schema),
            circuit_breaker_status=self.circuit_breaker.state.value,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def check_health(self) -> bool:
        return self.circuit_breaker.can_execute()


class LocalModelLiveAdapter(BaseModelAdapter):
    """Adapter for local / self-hosted models (Ollama, vLLM, DeepSeek-R1). Zero API Cost & Air-gapped fallback."""

    def get_provider_name(self) -> str:
        return "local"

    @classmethod
    def _resolve_timeout(cls, request: ModelRequest) -> float:
        req_val = getattr(request, "timeout_seconds", None)
        return max(45.0, clamp_timeout(req_val, default=45.0))

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)

        if sim_behavior == "rate_limit":
            # Highly unusual for local, but possible if host GPU queue is full
            raise ProviderRateLimitError(self.get_provider_name(), retry_after_seconds=0.5)
        if sim_behavior == "timeout":
            raise ProviderTimeoutError(
                self.get_provider_name(), timeout_seconds=request.timeout_seconds
            )

        response_text = None
        prompt_tokens = 0
        completion_tokens = 0
        latency_ms = model_metadata.get("avg_latency_ms", 850.0)
        finish_reason = "stop"
        is_truncated = False

        if sim_behavior == "length" or self.should_simulate_length_limit(model_identifier, request):
            finish_reason = "length"
            is_truncated = True

        base_url = str(model_metadata.get("base_url") or "").strip()
        simulation_enabled = self._simulation_fallback_enabled(request)
        if not base_url and not simulation_enabled:
            raise ProviderException(
                self.get_provider_name(),
                "Local inference endpoint is not configured.",
                status_code=503,
            )

        if sim_behavior or not base_url or simulation_enabled:
            if request.structured_output_schema:
                sample_output = {
                    "provider": "local",
                    "model": model_identifier,
                    "status": "completed",
                    "analysis": f"Local air-gapped reasoning: {request.prompt[:50]}",
                }
                for req_key in request.structured_output_schema.get("required", []):
                    if req_key not in sample_output:
                        sample_output[req_key] = f"local_{req_key}_data"
                response_text = json.dumps(sample_output)
            else:
                response_text = (
                    f"[Local/{model_identifier}] On-premise air-gapped generation for: '{request.prompt[:60]}...' "
                    f"Zero external data retention."
                )
        else:
            import httpx

            endpoint_base = base_url.rstrip("/")
            if not endpoint_base.endswith("/v1"):
                endpoint_base = f"{endpoint_base}/v1"
            headers = {"Content-Type": "application/json"}
            api_key = model_metadata.get("api_key")
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            messages = []
            if request.system_prompt:
                messages.append({"role": "system", "content": request.system_prompt})
            messages.append({"role": "user", "content": request.prompt})
            # For local Ollama runtime, ensure model is mapped to an available local model
            active_model = model_identifier
            if "11434" in endpoint_base or "localhost" in endpoint_base:
                if active_model in ("local-deepseek-r1", "local", "deepseek-r1"):
                    active_model = "qwen2.5-coder:1.5b"
            payload: dict[str, Any] = {
                "model": active_model,
                "messages": messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            }
            if request.structured_output_schema:
                payload["response_format"] = {"type": "json_object"}
            started = time.perf_counter()
            try:
                async with httpx.AsyncClient(
                    timeout=self._resolve_timeout(request), follow_redirects=False
                ) as client:
                    response = await client.post(
                        f"{endpoint_base}/chat/completions",
                        json=payload,
                        headers=headers,
                    )
                if response.status_code == 404 and active_model != "qwen2.5-coder:1.5b":
                    # Model not present on local runtime; retry with available lightweight model
                    payload["model"] = "qwen2.5-coder:1.5b"
                    async with httpx.AsyncClient(
                        timeout=self._resolve_timeout(request), follow_redirects=False
                    ) as client:
                        response = await client.post(
                            f"{endpoint_base}/chat/completions",
                            json=payload,
                            headers=headers,
                        )
                if response.status_code == 429:
                    raise ProviderRateLimitError(self.get_provider_name(), 1.0)
                response.raise_for_status()
                data = response.json()
                choice = (data.get("choices") or [None])[0]
                if not choice:
                    raise ProviderException(
                        self.get_provider_name(),
                        "Local inference endpoint returned no completion choice.",
                        status_code=502,
                    )
                response_text = (choice.get("message") or {}).get("content")
                finish_reason = choice.get("finish_reason") or "stop"
                is_truncated = finish_reason == "length"
                usage = data.get("usage") or {}
                prompt_tokens = int(usage.get("prompt_tokens") or 0)
                completion_tokens = int(usage.get("completion_tokens") or 0)
                latency_ms = (time.perf_counter() - started) * 1000
            except (ProviderRateLimitError, ProviderTimeoutError, ProviderException):
                raise
            except Exception as error:
                self._raise_mapped_http_error(error, api_key or "")
            if not response_text:
                raise ProviderException(
                    self.get_provider_name(),
                    "Local inference endpoint returned an empty completion.",
                    status_code=502,
                )

        is_valid, val_err = self.validate_structured_output(
            response_text, request.structured_output_schema
        )
        if not is_valid:
            raise StructuredOutputValidationError(
                self.get_provider_name(), val_err or "Invalid schema"
            )

        if prompt_tokens == 0:
            prompt_len = len(request.prompt.split()) + (
                len(request.system_prompt.split()) if request.system_prompt else 0
            )
            prompt_tokens = max(1, int(prompt_len * 1.3) + 8)
        if completion_tokens == 0:
            completion_tokens = max(1, int(len(response_text.split()) * 1.3))
        total_tokens = prompt_tokens + completion_tokens

        # Local models incur zero external vendor API cost
        cost_usd = 0.0

        return ModelResponsePayload(
            text=response_text,
            model_used=model_identifier,
            provider_used=self.get_provider_name(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
            latency_ms=latency_ms,
            structured_output_validated=bool(request.structured_output_schema),
            circuit_breaker_status=self.circuit_breaker.state.value,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def check_health(self) -> bool:
        return self.circuit_breaker.can_execute()


class GenericOpenAICompatibleAdapter(BaseModelAdapter):
    """
    Adapter for any OpenAI-compatible inference endpoint or free-tier provider
    (e.g., Cohere v2, Cloudflare Workers AI, Zhipu AI GLM, Aion Labs, Together AI, Groq).
    """

    def __init__(
        self, provider_name: str = "openai_compatible", base_url: str | None = None
    ) -> None:
        self._provider_name = provider_name
        self._base_url = base_url
        super().__init__()

    def get_provider_name(self) -> str:
        return self._provider_name

    def calculate_cost(self, prompt_tokens: int, completion_tokens: int, model: str) -> float:
        # Free-tier provider endpoints incur $0.00 direct charge
        return 0.0

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        if not self.circuit_breaker.can_execute():
            # Fast-fail: the breaker is open, this is an availability problem and
            # not a quota problem, so it must not be reported as a rate limit.
            raise ProviderException(
                self.get_provider_name(),
                f"Circuit breaker is {self.circuit_breaker.state.value}; call fast-failed.",
                status_code=503,
            )

        # Simulation behavior hook for tests
        sim_behavior = model_metadata.get("simulate_behavior")
        if sim_behavior == "rate_limit":
            raise ProviderRateLimitError(self.get_provider_name(), retry_after_seconds=2.0)
        if sim_behavior == "timeout":
            raise ProviderTimeoutError(
                self.get_provider_name(), timeout_seconds=request.timeout_seconds
            )

        t_start = time.perf_counter()
        response_text = None
        prompt_tokens = 0
        completion_tokens = 0
        finish_reason = "stop"
        is_truncated = False

        if sim_behavior == "length" or self.should_simulate_length_limit(model_identifier, request):
            finish_reason = "length"
            is_truncated = True

        # Attempt live call if base_url or api_key configured
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get(self.get_provider_name())
            or runtime_keys.get("api_key")
        )
        target_url = self._base_url or model_metadata.get("base_url")

        from nexora.config import get_settings

        settings = get_settings()

        if api_key and target_url and not getattr(settings, "ENABLE_SIMULATION_MODE", False):
            import httpx

            timeout_seconds = self._resolve_timeout(request)
            self._last_timeout = timeout_seconds
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            messages = []
            if request.system_prompt:
                messages.append({"role": "system", "content": request.system_prompt})
            messages.append({"role": "user", "content": request.prompt})

            # For local Ollama runtime, ensure model is mapped to an available local model
            active_model = model_identifier
            if target_url and ("11434" in target_url or "localhost" in target_url):
                if active_model in ("local-deepseek-r1", "local", "deepseek-r1"):
                    active_model = "qwen2.5-coder:1.5b"
            payload: dict[str, Any] = {
                "model": active_model,
                "messages": messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            }
            if request.structured_output_schema:
                payload["response_format"] = {"type": "json_object"}

            try:
                target_url = self._validate_endpoint(target_url, model_metadata)
                endpoint = f"{target_url.rstrip('/')}/chat/completions"
                async with httpx.AsyncClient(
                    timeout=timeout_seconds, follow_redirects=False
                ) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        choice = (data.get("choices") or [None])[0]
                        if not choice:
                            raise ProviderException(
                                self.get_provider_name(),
                                "Provider returned a response without any completion choice.",
                                status_code=502,
                            )
                        response_text = (choice.get("message") or {}).get("content")
                        raw_finish = choice.get("finish_reason", "stop")
                        if raw_finish == "length":
                            finish_reason = "length"
                            is_truncated = True
                        usage = data.get("usage", {}) or {}
                        prompt_tokens = usage.get("prompt_tokens", 0) or 0
                        completion_tokens = usage.get("completion_tokens", 0) or 0
                        self.circuit_breaker.record_success()
                    elif resp.status_code == 429:
                        self.circuit_breaker.record_failure()
                        raise ProviderRateLimitError(
                            self.get_provider_name(),
                            retry_after_seconds=self._retry_after_seconds(resp, 5.0),
                        )
                    else:
                        # Any other status is a real failure: it must be recorded as
                        # such and surfaced, never masked by a synthetic response.
                        if resp.status_code >= 400:
                            # `raise_for_status` produces the upstream error; the
                            # failure is recorded exactly once by the handler below.
                            resp.raise_for_status()
                        self.circuit_breaker.record_failure()
                        raise ProviderException(
                            self.get_provider_name(),
                            f"Provider returned HTTP {resp.status_code}: "
                            f"{redact_secrets(resp.text, api_key)}",
                            status_code=502,
                        )
            except (ProviderRateLimitError, ProviderTimeoutError, ProviderException):
                raise
            except Exception as e:
                self.circuit_breaker.record_failure()
                logger.warning(
                    "%s live call failed: %s", self.get_provider_name(), redact_secrets(str(e), api_key)
                )
                self._raise_mapped_http_error(e, api_key)

        # Fallback response generation if offline or unkeyed test
        if response_text is None:
            self._require_simulation_fallback(request)
            if request.structured_output_schema:
                sample_output = {
                    "provider": self.get_provider_name(),
                    "model": model_identifier,
                    "status": "completed",
                    "result": f"Free tier inference completed for: {request.prompt[:40]}",
                }
                for req_key in request.structured_output_schema.get("required", []):
                    if req_key not in sample_output:
                        sample_output[req_key] = f"free_{req_key}_data"
                response_text = json.dumps(sample_output)
            else:
                response_text = (
                    f"[{self.get_provider_name().title()}/{model_identifier}] Free tier generation: "
                    f"{request.prompt[:50]}... (Zero cost tier)"
                )

        latency_ms = (time.perf_counter() - t_start) * 1000

        is_valid, val_err = self.validate_structured_output(
            response_text, request.structured_output_schema
        )
        if not is_valid:
            raise StructuredOutputValidationError(
                self.get_provider_name(), val_err or "Invalid schema"
            )

        if prompt_tokens == 0:
            prompt_tokens = max(1, int(len(request.prompt.split()) * 1.3) + 5)
        if completion_tokens == 0:
            completion_tokens = max(1, int(len(response_text.split()) * 1.3))

        # Cost must reflect the model's published rates: several providers routed
        # through this adapter (Mistral, Groq, OpenRouter, Together) are billed,
        # and reporting $0.00 silently defeats the per-request budget ceiling.
        cost_usd = self._compute_cost(
            model_metadata, prompt_tokens, completion_tokens, 0.0, 0.0
        )

        return ModelResponsePayload(
            text=response_text,
            model_used=model_identifier,
            provider_used=self.get_provider_name(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            estimated_cost_usd=cost_usd,
            latency_ms=latency_ms,
            structured_output_validated=bool(request.structured_output_schema),
            circuit_breaker_status=self.circuit_breaker.state.value,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def check_health(self) -> bool:
        return self.circuit_breaker.can_execute()


class DedicatedOpenAICompatibleAdapter(BaseModelAdapter):
    """
    Base class for dedicated OpenAI-compatible cloud inference provider adapters.
    Provides standard Chat Completions REST handling, secret masking, rate limit backoff,
    and structured output validation.
    """

    PROVIDER_NAME: str = "openai_compatible"
    DEFAULT_BASE_URL: str = "https://api.openai.com/v1"
    DEFAULT_INPUT_RATE: float = 1.00
    DEFAULT_OUTPUT_RATE: float = 2.00
    DEFAULT_LATENCY_MS: float = 300.0
    EXTRA_HEADERS: dict[str, str] = {}

    def get_provider_name(self) -> str:
        return self.PROVIDER_NAME

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)

        if sim_behavior == "rate_limit":
            raise ProviderRateLimitError(self.get_provider_name(), retry_after_seconds=1.5)
        if sim_behavior == "timeout":
            raise ProviderTimeoutError(
                self.get_provider_name(), timeout_seconds=request.timeout_seconds
            )

        from nexora.config import get_settings

        settings = get_settings()

        response_text = None
        prompt_tokens = 0
        completion_tokens = 0
        latency_ms = model_metadata.get("avg_latency_ms", self.DEFAULT_LATENCY_MS)
        finish_reason = "stop"
        is_truncated = False

        if sim_behavior == "length" or self.should_simulate_length_limit(model_identifier, request):
            finish_reason = "length"
            is_truncated = True

        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        env_attr = f"{self.get_provider_name().upper()}_API_KEY"
        if "api_key" in model_metadata and model_metadata["api_key"] is None:
            api_key = None
        else:
            api_key = (
                model_metadata.get("api_key")
                or runtime_keys.get(self.get_provider_name())
                or runtime_keys.get("api_key")
                or getattr(settings, env_attr, None)
            )
        base_url = (
            model_metadata.get("base_url")
            or getattr(settings, f"{self.get_provider_name().upper()}_BASE_URL", None)
            or self.DEFAULT_BASE_URL
        )

        live_attempted = False
        if api_key and not sim_behavior and not getattr(settings, "ENABLE_SIMULATION_MODE", False):
            import httpx

            timeout_seconds = self._resolve_timeout(request)
            t_start = time.perf_counter()
            live_attempted = True
            try:
                base_url = self._validate_endpoint(base_url, model_metadata)
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    **self.EXTRA_HEADERS,
                }
                messages = []
                if request.system_prompt:
                    messages.append({"role": "system", "content": request.system_prompt})
                messages.append({"role": "user", "content": request.prompt})

                payload: dict[str, Any] = {
                    "model": model_identifier,
                    "messages": messages,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                }
                if request.structured_output_schema:
                    payload["response_format"] = {"type": "json_object"}

                endpoint = f"{base_url.rstrip('/')}/chat/completions"
                async with httpx.AsyncClient(
                    timeout=timeout_seconds, follow_redirects=False
                ) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 429:
                        self.circuit_breaker.record_failure()
                        retry_after = self._retry_after_seconds(resp, default=2.0)
                        raise ProviderRateLimitError(
                            self.get_provider_name(), retry_after_seconds=retry_after
                        )
                    if resp.status_code in (408, 504):
                        self.circuit_breaker.record_failure()
                        raise ProviderTimeoutError(
                            self.get_provider_name(), timeout_seconds=timeout_seconds
                        )

                    resp.raise_for_status()
                    data = resp.json()
                    choice = data["choices"][0]
                    response_text = choice["message"]["content"]
                    raw_finish = choice.get("finish_reason", "stop")
                    if raw_finish == "length":
                        finish_reason = "length"
                        is_truncated = True
                    usage = data.get("usage", {})
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    latency_ms = (time.perf_counter() - t_start) * 1000
                    self.circuit_breaker.record_success()
            except (ProviderRateLimitError, ProviderTimeoutError):
                raise
            except Exception as e:
                self.circuit_breaker.record_failure()
                clean_err = redact_secrets(str(e), api_key)
                logger.warning(
                    "%s live call failed: %s", self.get_provider_name().title(), clean_err
                )
                raise ProviderException(self.get_provider_name(), f"Live call failed: {clean_err}")

        if response_text is None and live_attempted:
            raise ProviderException(
                self.get_provider_name(),
                "Provider returned an empty completion payload.",
                status_code=502,
            )

        # Fallback simulation if no key or offline
        if response_text is None:
            self._require_simulation_fallback(request)
            if request.structured_output_schema:
                sample_output = {
                    "provider": self.get_provider_name(),
                    "model": model_identifier,
                    "status": "completed",
                    "analysis": f"{self.get_provider_name().title()} high-throughput synthesis: {request.prompt[:50]}",
                }
                for req_key in request.structured_output_schema.get("required", []):
                    if req_key not in sample_output:
                        sample_output[req_key] = f"{self.get_provider_name()}_{req_key}_data"
                response_text = json.dumps(sample_output)
            else:
                response_text = (
                    f"[{self.get_provider_name().title()}/{model_identifier}] Cloud inference response for: '{request.prompt[:60]}...' "
                    f"Processed via {self.get_provider_name().title()} high-capacity infrastructure."
                )

        is_valid, val_err = self.validate_structured_output(
            response_text, request.structured_output_schema
        )
        if not is_valid:
            raise StructuredOutputValidationError(
                self.get_provider_name(), val_err or "Invalid schema"
            )

        if prompt_tokens == 0:
            prompt_len = len(request.prompt.split()) + (
                len(request.system_prompt.split()) if request.system_prompt else 0
            )
            prompt_tokens = max(1, int(prompt_len * 1.3) + 8)
        if completion_tokens == 0:
            completion_tokens = max(1, int(len(response_text.split()) * 1.3))
        total_tokens = prompt_tokens + completion_tokens

        cost_usd = self._compute_cost(
            model_metadata,
            prompt_tokens,
            completion_tokens,
            default_input_rate=self.DEFAULT_INPUT_RATE,
            default_output_rate=self.DEFAULT_OUTPUT_RATE,
        )

        return ModelResponsePayload(
            text=response_text,
            model_used=model_identifier,
            provider_used=self.get_provider_name(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
            latency_ms=latency_ms,
            structured_output_validated=bool(request.structured_output_schema),
            circuit_breaker_status=self.circuit_breaker.state.value,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def check_health(self) -> bool:
        return self.circuit_breaker.can_execute()


class GroqLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Groq Language Processing Unit (LPU) cloud."""

    PROVIDER_NAME = "groq"
    DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
    DEFAULT_INPUT_RATE = 0.59
    DEFAULT_OUTPUT_RATE = 0.79
    DEFAULT_LATENCY_MS = 140.0
    DEFAULT_MODEL = "qwen/qwen3.8-27b"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("groq")
            or runtime_keys.get("api_key")
            or getattr(settings, "GROQ_API_KEY", None)
            or FALLBACK_GROQ_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        return await super().generate_response(canonical_model, request, meta)


class OpenRouterLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for OpenRouter multi-model aggregation gateway."""

    PROVIDER_NAME = "openrouter"
    DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
    DEFAULT_INPUT_RATE = 2.50
    DEFAULT_OUTPUT_RATE = 10.00
    DEFAULT_LATENCY_MS = 400.0
    EXTRA_HEADERS = {"HTTP-Referer": "https://neiman.os", "X-Title": "NEIMAN OS"}


class MistralLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Mistral AI frontier models (Mistral Large, Codestral, Ministral)."""

    PROVIDER_NAME = "mistral"
    DEFAULT_BASE_URL = "https://api.mistral.ai/v1"
    DEFAULT_INPUT_RATE = 2.00
    DEFAULT_OUTPUT_RATE = 6.00
    DEFAULT_LATENCY_MS = 350.0


class DeepSeekLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for DeepSeek Cloud inference (DeepSeek-V3, DeepSeek-R1)."""

    PROVIDER_NAME = "deepseek"
    DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
    DEFAULT_INPUT_RATE = 0.14
    DEFAULT_OUTPUT_RATE = 0.28
    DEFAULT_LATENCY_MS = 500.0

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("deepseek")
            or runtime_keys.get("api_key")
            or getattr(settings, "DEEPSEEK_API_KEY", None)
            or FALLBACK_DEEPSEEK_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        try:
            return await super().generate_response(model_identifier, request, meta)
        except ProviderException as pe:
            if getattr(pe, "policy_rejected", False):
                # A local policy refusal (egress guard) is never downgraded to a
                # simulated response: the call must fail loudly.
                raise
            # If live account has insufficient balance or quota, fall back to simulation gracefully
            if sim_behavior not in ("rate_limit", "timeout") and ("insufficient balance" in str(pe).lower() or "quota" in str(pe).lower()):
                self._require_simulation_fallback(request)
                logger.warning("DeepSeek live call hit balance limitation, simulating: %s", pe)
                meta_sim = dict(meta)
                meta_sim["api_key"] = None
                return await super().generate_response(model_identifier, request, meta_sim)
            raise


class CerebrasLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Cerebras wafer-scale ultra-fast inference (Llama 3.1 & 3.3)."""

    PROVIDER_NAME = "cerebras"
    DEFAULT_BASE_URL = "https://api.cerebras.ai/v1"
    DEFAULT_INPUT_RATE = 0.60
    DEFAULT_OUTPUT_RATE = 0.60
    DEFAULT_LATENCY_MS = 110.0


class TogetherAILiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Together AI high-throughput serverless inference."""

    PROVIDER_NAME = "together_ai"
    DEFAULT_BASE_URL = "https://api.together.xyz/v1"
    DEFAULT_INPUT_RATE = 0.80
    DEFAULT_OUTPUT_RATE = 0.80
    DEFAULT_LATENCY_MS = 280.0
    DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("together_ai")
            or runtime_keys.get("together")
            or runtime_keys.get("api_key")
            or getattr(settings, "TOGETHER_AI_API_KEY", None)
            or getattr(settings, "TOGETHER_API_KEY", None)
            or FALLBACK_TOGETHER_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        try:
            return await super().generate_response(canonical_model, request, meta)
        except ProviderException as pe:
            if getattr(pe, "policy_rejected", False):
                raise
            # When the fallback key is unactivated (401), fall back to simulation
            # gracefully instead of failing the whole request.
            if "401" in str(pe) or "Unauthorized" in str(pe):
                self._require_simulation_fallback(request)
                logger.warning(
                    "Together AI live call rejected credentials, simulating: %s", pe
                )
                meta_sim = dict(meta)
                meta_sim["api_key"] = None
                return await super().generate_response(canonical_model, request, meta_sim)
            raise


class HuggingFaceLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Hugging Face Inference Providers router (serverless open-weight models)."""

    PROVIDER_NAME = "huggingface"
    DEFAULT_BASE_URL = "https://router.huggingface.co/v1"
    DEFAULT_INPUT_RATE = 0.50
    DEFAULT_OUTPUT_RATE = 1.00
    DEFAULT_LATENCY_MS = 320.0
    DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct:fastest"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("huggingface")
            or runtime_keys.get("hf")
            or runtime_keys.get("api_key")
            or getattr(settings, "HUGGINGFACE_API_KEY", None)
            or getattr(settings, "HF_TOKEN", None)
            or FALLBACK_HUGGINGFACE_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        return await super().generate_response(canonical_model, request, meta)


class KimiLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Kimi Moonshot AI ultra-long context and code reasoning models."""

    PROVIDER_NAME = "kimi"
    DEFAULT_BASE_URL = "https://api.moonshot.ai/v1"
    DEFAULT_INPUT_RATE = 1.00
    DEFAULT_OUTPUT_RATE = 1.00
    DEFAULT_LATENCY_MS = 380.0
    DEFAULT_MODEL = "kimi-k2.7-code"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("kimi")
            or runtime_keys.get("moonshot")
            or runtime_keys.get("api_key")
            or getattr(settings, "KIMI_API_KEY", None)
            or getattr(settings, "MOONSHOT_API_KEY", None)
            or FALLBACK_KIMI_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        return await super().generate_response(canonical_model, request, meta)


class ZAILiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Z.AI / Zhipu AI GLM bilingual reasoning and vision foundation models."""

    PROVIDER_NAME = "z_ai"
    DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
    DEFAULT_INPUT_RATE = 1.00
    DEFAULT_OUTPUT_RATE = 1.00
    DEFAULT_LATENCY_MS = 350.0
    DEFAULT_MODEL = "glm-5"

    def __init__(self, provider_name: str = "z_ai", base_url: str | None = None) -> None:
        super().__init__()
        self.PROVIDER_NAME = provider_name
        if base_url:
            self.DEFAULT_BASE_URL = base_url

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("z_ai")
            or runtime_keys.get("zai")
            or runtime_keys.get("zhipu")
            or runtime_keys.get("zhipu_ai")
            or runtime_keys.get("api_key")
            or getattr(settings, "ZAI_API_KEY", None)
            or getattr(settings, "Z_AI_API_KEY", None)
            or getattr(settings, "ZHIPU_API_KEY", None)
            or getattr(settings, "ZHIPUAI_API_KEY", None)
            or FALLBACK_ZAI_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        return await super().generate_response(canonical_model, request, meta)


class AlibabaCloudLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Alibaba Cloud Model Studio / DashScope Qwen foundation models."""

    PROVIDER_NAME = "alibabacloud"
    DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    DEFAULT_INPUT_RATE = 0.80
    DEFAULT_OUTPUT_RATE = 2.00
    DEFAULT_LATENCY_MS = 280.0
    DEFAULT_MODEL = "qwen3.8-flash"

    def __init__(self, provider_name: str = "alibabacloud", base_url: str | None = None) -> None:
        super().__init__()
        self.PROVIDER_NAME = provider_name
        if base_url:
            self.DEFAULT_BASE_URL = base_url

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("alibabacloud")
            or runtime_keys.get("alibaba")
            or runtime_keys.get("dashscope")
            or runtime_keys.get("qwen")
            or runtime_keys.get("api_key")
            or getattr(settings, "ALIBABACLOUD_API_KEY", None)
            or getattr(settings, "ALIBABA_API_KEY", None)
            or getattr(settings, "DASHSCOPE_API_KEY", None)
            or getattr(settings, "QWEN_API_KEY", None)
            or FALLBACK_ALIBABA_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key
        # Route to international endpoint if domestic endpoint was defaulted
        endpoint_url = meta.get("base_url") or self.DEFAULT_BASE_URL
        if "dashscope.aliyuncs.com" in endpoint_url and "dashscope-intl" not in endpoint_url:
            meta["base_url"] = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

        return await super().generate_response(canonical_model, request, meta)


class XAILiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for xAI Grok foundation models."""

    PROVIDER_NAME = "xai"
    DEFAULT_BASE_URL = "https://api.x.ai/v1"
    DEFAULT_INPUT_RATE = 2.00
    DEFAULT_OUTPUT_RATE = 10.00
    DEFAULT_LATENCY_MS = 400.0


class KiloCodeLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Kilo Code Universal Gateway (kilo.ai). Defaults to kilo-auto/free tier."""

    PROVIDER_NAME = "kilocode"
    DEFAULT_BASE_URL = "https://api.kilo.ai/api/gateway"
    DEFAULT_INPUT_RATE = 0.0
    DEFAULT_OUTPUT_RATE = 0.0
    DEFAULT_LATENCY_MS = 220.0
    DEFAULT_MODEL = "kilo-auto/free"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        if not canonical_model or canonical_model.lower() in ("autofree", "auto-free", "kilo-auto-free", "default", "free"):
            canonical_model = self.DEFAULT_MODEL

        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("kilocode")
            or runtime_keys.get("kilo")
            or runtime_keys.get("api_key")
            or getattr(settings, "KILO_API_KEY", None)
            or getattr(settings, "KILOCODE_API_KEY", None)
            or FALLBACK_KILO_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        is_free = "free" in canonical_model.lower() or meta.get("is_free", False)
        if is_free:
            meta["input_cost_per_million"] = 0.0
            meta["output_cost_per_million"] = 0.0

        return await super().generate_response(canonical_model, request, meta)


class MetaMuseLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """Adapter for Meta Muse generative models (muse-spark-1.3, muse-wonder-1.0)."""

    PROVIDER_NAME = "meta_muse"
    DEFAULT_BASE_URL = "https://api.meta.ai/v1"
    DEFAULT_INPUT_RATE = 0.50
    DEFAULT_OUTPUT_RATE = 1.50
    DEFAULT_LATENCY_MS = 280.0
    DEFAULT_MODEL = "muse-spark-1.3"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("meta_muse")
            or runtime_keys.get("meta")
            or runtime_keys.get("api_key")
            or getattr(settings, "META_API_KEY", None)
            or getattr(settings, "META_MUSE_API_KEY", None)
            or FALLBACK_META_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key

        try:
            return await super().generate_response(canonical_model, request, meta)
        except ProviderException as pe:
            if getattr(pe, "policy_rejected", False):
                # A local policy refusal (egress guard) is never downgraded to a
                # simulated response: the call must fail loudly.
                raise
            err_lower = str(pe).lower()
            if sim_behavior not in ("rate_limit", "timeout") and (
                "billing" in err_lower or "quota" in err_lower or "insufficient" in err_lower or "balance" in err_lower
            ):
                self._require_simulation_fallback(request)
                logger.warning("Meta Muse live call hit account/billing limitation, simulating: %s", pe)
                meta_sim = dict(meta)
                meta_sim["api_key"] = None
                return await super().generate_response(canonical_model, request, meta_sim)
            raise


class PoolsideLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """
    Live Poolside AI adapter connecting to https://inference.poolside.ai/v1
    Serving Laguna S 2.1 (frontier agentic coding) and Laguna XS 2.1 models.
    """

    PROVIDER_NAME = "poolside"
    DEFAULT_BASE_URL = "https://inference.poolside.ai/v1"
    DEFAULT_INPUT_RATE = 0.80
    DEFAULT_OUTPUT_RATE = 2.40
    DEFAULT_LATENCY_MS = 290.0
    DEFAULT_MODEL = "poolside/laguna-s-2.1"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("poolside")
            or runtime_keys.get("api_key")
            or getattr(settings, "POOLSIDE_API_KEY", None)
            or FALLBACK_POOLSIDE_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key
        meta["base_url"] = meta.get("base_url") or self.DEFAULT_BASE_URL

        return await super().generate_response(canonical_model, request, meta)


class ArceeLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """
    Live Arcee AI adapter connecting to https://api.arcee.ai/api/v1
    Serving specialized models and frontier architectures.
    """

    PROVIDER_NAME = "arcee"
    DEFAULT_BASE_URL = "https://api.arcee.ai/api/v1"
    DEFAULT_INPUT_RATE = 0.50
    DEFAULT_OUTPUT_RATE = 1.50
    DEFAULT_LATENCY_MS = 250.0
    DEFAULT_MODEL = "trinity-large-thinking"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("arcee")
            or runtime_keys.get("api_key")
            or getattr(settings, "ARCEE_API_KEY", None)
            or FALLBACK_ARCEE_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key
        meta["base_url"] = meta.get("base_url") or self.DEFAULT_BASE_URL
        meta["headers"] = {"User-Agent": "curl/7.68.0"}

        return await super().generate_response(canonical_model, request, meta)


class XiaomiMiMoLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """
    Live Xiaomi MiMo adapter connecting to https://api.xiaomimimo.com/v1
    Serving multimodal reasoning and agentic foundation models (mimo-v2.6-pro, mimo-v2.6-flash).
    """

    PROVIDER_NAME = "xiaomimimo"
    DEFAULT_BASE_URL = "https://api.xiaomimimo.com/v1"
    DEFAULT_INPUT_RATE = 0.20
    DEFAULT_OUTPUT_RATE = 0.60
    DEFAULT_LATENCY_MS = 250.0
    DEFAULT_MODEL = "mimo-v2.6-flash"

    def __init__(self, provider_name: str = "xiaomimimo", base_url: str = "https://api.xiaomimimo.com/v1") -> None:
        super().__init__()
        self.PROVIDER_NAME = provider_name
        self.DEFAULT_BASE_URL = base_url

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("xiaomimimo")
            or runtime_keys.get("xiaomi_mimo")
            or runtime_keys.get("mimo")
            or runtime_keys.get("api_key")
            or getattr(settings, "XIAOMIMIMO_API_KEY", None)
            or getattr(settings, "MIMO_API_KEY", None)
            or getattr(settings, "XIAOMI_MIMO_API_KEY", None)
            or FALLBACK_XIAOMIMIMO_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key
        meta["base_url"] = meta.get("base_url") or self.DEFAULT_BASE_URL

        return await super().generate_response(canonical_model, request, meta)


class MiniMaxLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """
    Live MiniMax adapter connecting to https://api.minimax.io/v1
    Serving high-throughput reasoning and agent models (MiniMax-M3.1-Flash, MiniMax-M3).
    """

    PROVIDER_NAME = "minimax"
    DEFAULT_BASE_URL = "https://api.minimax.io/v1"
    DEFAULT_INPUT_RATE = 0.25
    DEFAULT_OUTPUT_RATE = 1.00
    DEFAULT_LATENCY_MS = 220.0
    DEFAULT_MODEL = "MiniMax-M3.1-Flash"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("minimax")
            or runtime_keys.get("api_key")
            or getattr(settings, "MINIMAX_API_KEY", None)
            or FALLBACK_MINIMAX_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key
        meta["base_url"] = meta.get("base_url") or self.DEFAULT_BASE_URL

        return await super().generate_response(canonical_model, request, meta)


class UpstageLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """
    Live Upstage Solar adapter connecting to https://api.upstage.ai/v1
    Serving specialized Solar models (solar-pro4, solar-pro3, solar-mini4).
    """

    PROVIDER_NAME = "upstage"
    DEFAULT_BASE_URL = "https://api.upstage.ai/v1"
    DEFAULT_INPUT_RATE = 0.30
    DEFAULT_OUTPUT_RATE = 1.00
    DEFAULT_LATENCY_MS = 240.0
    DEFAULT_MODEL = "solar-pro4"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("upstage")
            or runtime_keys.get("solar")
            or runtime_keys.get("api_key")
            or getattr(settings, "UPSTAGE_API_KEY", None)
            or FALLBACK_UPSTAGE_API_KEY
        )
        meta = dict(model_metadata)
        meta["api_key"] = api_key
        meta["base_url"] = meta.get("base_url") or self.DEFAULT_BASE_URL

        return await super().generate_response(canonical_model, request, meta)


class OllamaCloudLiveAdapter(DedicatedOpenAICompatibleAdapter):
    """
    Adapter for Ollama Cloud (https://ollama.com/v1) hosted frontier & open-weights intelligence.
    Defaults to gemma4:31b-cloud (free plan) and falls back gracefully to simulation or free tier.
    """

    PROVIDER_NAME = "ollama"
    DEFAULT_BASE_URL = "https://ollama.com/v1"
    DEFAULT_INPUT_RATE = 0.0
    DEFAULT_OUTPUT_RATE = 0.0
    DEFAULT_LATENCY_MS = 240.0
    DEFAULT_MODEL = "gemma4:31b-cloud"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        canonical_model = model_identifier or self.DEFAULT_MODEL
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)
        from nexora.config import get_settings

        settings = get_settings()
        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("ollama")
            or runtime_keys.get("ollama_cloud")
            or runtime_keys.get("api_key")
            or getattr(settings, "OLLAMA_API_KEY", None)
            or FALLBACK_OLLAMA_API_KEY
        )
        base_url = (
            model_metadata.get("base_url")
            or getattr(settings, "OLLAMA_BASE_URL", None)
            or self.DEFAULT_BASE_URL
        )
        if "11434" in base_url or "localhost" in base_url:
            base_url = self.DEFAULT_BASE_URL

        meta = dict(model_metadata)
        meta["api_key"] = api_key
        meta["base_url"] = base_url

        try:
            return await super().generate_response(canonical_model, request, meta)
        except ProviderException as pe:
            if getattr(pe, "policy_rejected", False):
                # A local policy refusal (egress guard) is never downgraded to a
                # simulated response: the call must fail loudly.
                raise
            err_lower = str(pe).lower()
            if sim_behavior not in ("rate_limit", "timeout") and any(
                w in err_lower for w in ("free plan", "402", "403", "forbidden", "upgrade", "quota")
            ):
                self._require_simulation_fallback(request)
                logger.warning(
                    "Ollama Cloud live call hit tier restriction (%s), retrying free tier: %s",
                    canonical_model,
                    pe,
                )
                if canonical_model != self.DEFAULT_MODEL:
                    try:
                        return await super().generate_response(self.DEFAULT_MODEL, request, meta)
                    except Exception:
                        pass
                meta_sim = dict(meta)
                meta_sim["api_key"] = None
                return await super().generate_response(canonical_model, request, meta_sim)
            raise


class CohereLiveAdapter(BaseModelAdapter):
    """Adapter for Cohere Command R+ and Command R foundation models via v2 Chat API."""

    def get_provider_name(self) -> str:
        return "cohere"

    async def generate_response(
        self,
        model_identifier: str,
        request: ModelRequest,
        model_metadata: dict[str, Any],
    ) -> ModelResponsePayload:
        flags = request.simulation_flags or {}
        sim_behavior = self.get_simulation_behavior(flags)

        if sim_behavior == "rate_limit":
            raise ProviderRateLimitError(self.get_provider_name(), retry_after_seconds=1.5)
        if sim_behavior == "timeout":
            raise ProviderTimeoutError(
                self.get_provider_name(), timeout_seconds=request.timeout_seconds
            )

        from nexora.config import get_settings

        settings = get_settings()

        response_text = None
        prompt_tokens = 0
        completion_tokens = 0
        latency_ms = model_metadata.get("avg_latency_ms", 450.0)
        finish_reason = "stop"
        is_truncated = False

        if sim_behavior == "length" or self.should_simulate_length_limit(model_identifier, request):
            finish_reason = "length"
            is_truncated = True

        runtime_keys = getattr(request, "runtime_api_keys", None) or {}
        api_key = (
            model_metadata.get("api_key")
            or runtime_keys.get("cohere")
            or runtime_keys.get("api_key")
            or getattr(settings, "COHERE_API_KEY", None)
        )
        base_url = (
            model_metadata.get("base_url")
            or getattr(settings, "COHERE_BASE_URL", None)
            or "https://api.cohere.com/v2"
        )

        if api_key and not sim_behavior and not getattr(settings, "ENABLE_SIMULATION_MODE", False):
            import httpx

            timeout_seconds = self._resolve_timeout(request)
            t_start = time.perf_counter()
            try:
                base_url = self._validate_endpoint(base_url, model_metadata)
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
                messages = []
                if request.system_prompt:
                    messages.append({"role": "system", "content": request.system_prompt})
                messages.append({"role": "user", "content": request.prompt})

                payload: dict[str, Any] = {
                    "model": model_identifier,
                    "messages": messages,
                }
                if request.temperature is not None:
                    payload["temperature"] = request.temperature
                if request.max_tokens is not None:
                    payload["max_tokens"] = request.max_tokens

                endpoint = f"{base_url.rstrip('/')}/chat"
                async with httpx.AsyncClient(
                    timeout=timeout_seconds, follow_redirects=False
                ) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 429:
                        self.circuit_breaker.record_failure()
                        retry_after = self._retry_after_seconds(resp, default=2.0)
                        raise ProviderRateLimitError(
                            self.get_provider_name(), retry_after_seconds=retry_after
                        )
                    if resp.status_code in (408, 504):
                        self.circuit_breaker.record_failure()
                        raise ProviderTimeoutError(
                            self.get_provider_name(), timeout_seconds=timeout_seconds
                        )

                    resp.raise_for_status()
                    data = resp.json()
                    msg_content = data.get("message", {}).get("content", [])
                    if msg_content and isinstance(msg_content, list):
                        response_text = "".join(
                            c.get("text", "") for c in msg_content if isinstance(c, dict)
                        )
                    usage = data.get("usage", {}).get("tokens", {})
                    prompt_tokens = usage.get("input_tokens", 0)
                    completion_tokens = usage.get("output_tokens", 0)
                    latency_ms = (time.perf_counter() - t_start) * 1000
                    self.circuit_breaker.record_success()
            except (ProviderRateLimitError, ProviderTimeoutError):
                raise
            except Exception as e:
                self.circuit_breaker.record_failure()
                clean_err = redact_secrets(str(e), api_key)
                logger.warning("Cohere live call failed: %s", clean_err)
                raise ProviderException(self.get_provider_name(), f"Live call failed: {clean_err}")

        if response_text is None:
            self._require_simulation_fallback(request)
            if request.structured_output_schema:
                sample_output = {
                    "provider": "cohere",
                    "model": model_identifier,
                    "status": "completed",
                    "analysis": f"Cohere Command enterprise synthesis: {request.prompt[:50]}",
                }
                for req_key in request.structured_output_schema.get("required", []):
                    if req_key not in sample_output:
                        sample_output[req_key] = f"cohere_{req_key}_data"
                response_text = json.dumps(sample_output)
            else:
                response_text = (
                    f"[Cohere/{model_identifier}] Enterprise intelligence response for: '{request.prompt[:60]}...' "
                    f"Grounded with enterprise search and reasoning."
                )

        is_valid, val_err = self.validate_structured_output(
            response_text, request.structured_output_schema
        )
        if not is_valid:
            raise StructuredOutputValidationError(
                self.get_provider_name(), val_err or "Invalid schema"
            )

        if prompt_tokens == 0:
            prompt_len = len(request.prompt.split()) + (
                len(request.system_prompt.split()) if request.system_prompt else 0
            )
            prompt_tokens = max(1, int(prompt_len * 1.3) + 8)
        if completion_tokens == 0:
            completion_tokens = max(1, int(len(response_text.split()) * 1.3))
        total_tokens = prompt_tokens + completion_tokens

        cost_usd = self._compute_cost(
            model_metadata,
            prompt_tokens,
            completion_tokens,
            default_input_rate=2.50,
            default_output_rate=10.00,
        )

        return ModelResponsePayload(
            text=response_text,
            model_used=model_identifier,
            provider_used=self.get_provider_name(),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
            latency_ms=latency_ms,
            structured_output_validated=bool(request.structured_output_schema),
            circuit_breaker_status=self.circuit_breaker.state.value,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def check_health(self) -> bool:
        return self.circuit_breaker.can_execute()


class ModelAdapterRegistry:
    """Registry coordinating available model provider adapters with circuit breakers."""

    _instance = None

    def __init__(self) -> None:
        self._init_defaults()

    def _init_defaults(self) -> None:
        self._adapters: dict[str, BaseModelAdapter] = {}
        # Register core frontier providers
        self.register(OpenAILiveAdapter())
        self.register(AnthropicLiveAdapter())
        self.register(GeminiLiveAdapter())
        self.register(LocalModelLiveAdapter())

        # Register dedicated Full Cloud Suite providers
        self.register(GroqLiveAdapter())
        self.register(OpenRouterLiveAdapter())
        self.register(MistralLiveAdapter())
        self.register(DeepSeekLiveAdapter())
        self.register(CerebrasLiveAdapter())
        self.register(TogetherAILiveAdapter())
        self.register(CohereLiveAdapter())
        self.register(XAILiveAdapter())
        self.register(KiloCodeLiveAdapter())
        self.register(PoolsideLiveAdapter())
        self.register(MetaMuseLiveAdapter())
        self.register(OllamaCloudLiveAdapter())
        self.register(HuggingFaceLiveAdapter())
        self.register(KimiLiveAdapter())
        self.register(ZAILiveAdapter(provider_name="z_ai"))
        self.register(ZAILiveAdapter(provider_name="zhipu_ai"))
        self.register(ZAILiveAdapter(provider_name="zai"))
        self.register(AlibabaCloudLiveAdapter(provider_name="alibabacloud"))
        self.register(AlibabaCloudLiveAdapter(provider_name="dashscope"))
        self.register(AlibabaCloudLiveAdapter(provider_name="alibaba"))
        self.register(AlibabaCloudLiveAdapter(provider_name="qwen"))
        self.register(ArceeLiveAdapter())
        self.register(XiaomiMiMoLiveAdapter(provider_name="xiaomimimo"))
        self.register(XiaomiMiMoLiveAdapter(provider_name="xiaomi_mimo"))
        self.register(XiaomiMiMoLiveAdapter(provider_name="mimo"))
        self.register(MiniMaxLiveAdapter())
        self.register(UpstageLiveAdapter())

        # Register free-tier & community gateway providers
        community_providers = [
            ("cloudflare_workers_ai", "https://api.cloudflare.com/client/v4/ai"),
            ("aion_labs", "https://api.aionlabs.ai/v1"),
            ("custom_openai_compatible", "http://localhost:8000/v1"),
        ]
        for name, url in community_providers:
            self.register(GenericOpenAICompatibleAdapter(provider_name=name, base_url=url))

    def register(self, adapter: BaseModelAdapter, preserve_state: bool = True) -> None:
        """
        Registers (or replaces) the adapter for a provider.

        When an adapter is replaced at runtime (e.g. a provider is reconfigured
        with a new base URL) the existing circuit breaker state is carried over,
        otherwise every reconfiguration would reset the breaker to CLOSED and
        defeat the fail-fast protection exactly when a provider is misbehaving.
        """
        provider_name = adapter.get_provider_name()
        existing = self._adapters.get(provider_name)
        if preserve_state and existing is not None:
            adapter.circuit_breaker.failure_count = existing.circuit_breaker.failure_count
            adapter.circuit_breaker.state = existing.circuit_breaker.state
            adapter.circuit_breaker.last_failure_time = existing.circuit_breaker.last_failure_time
            adapter.circuit_breaker.last_state_change = existing.circuit_breaker.last_state_change
        self._adapters[provider_name] = adapter

    def get(self, provider_name: str) -> BaseModelAdapter | None:
        return self._adapters.get(provider_name)

    def reset_circuit_breakers(self) -> None:
        """Reset all circuit breakers to CLOSED."""
        for adapter in self._adapters.values():
            adapter.circuit_breaker.record_success()

    def reset_to_defaults(self) -> None:
        """Restore canonical frontier adapters and reset circuit breakers."""
        self._init_defaults()

