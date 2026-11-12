"""
Regression tests for the intelligence adapter hardening.

Covers the vulnerabilities found in the bug hunt:
  - credentials leaking through upstream error text / URLs
  - fabricated "successful" responses replacing failed live calls
  - circuit breaker state machine (probe admission, health-check side effects)
  - structured output validation gaps
  - SSRF / credential exfiltration through tenant-controlled provider endpoints
"""

import asyncio
import json
from unittest.mock import Mock, patch

import httpx
import pytest

from nexora.config import Settings
from nexora.core.security import ToolSandbox
from nexora.domains.intelligence.adapters.base import (
    AnthropicLiveAdapter,
    CircuitBreaker,
    CircuitState,
    GeminiLiveAdapter,
    GenericOpenAICompatibleAdapter,
    GroqLiveAdapter,
    OpenAILiveAdapter,
    ProviderException,
    ProviderTimeoutError,
    clamp_timeout,
    redact_secrets,
)
from nexora.domains.intelligence.schemas import ModelRequest

SECRET = "sk-test-super-secret-key-value-1234567890"


@pytest.fixture(autouse=True)
def _disable_simulation_mode(monkeypatch):
    from nexora.config import get_settings

    monkeypatch.setenv("ENABLE_SIMULATION_MODE", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# ── Credential redaction ─────────────────────────────────────────────────────


def test_redact_secrets_scrubs_query_string_credentials():
    text = "Client error '400 Bad Request' for url 'https://x/y?key=AIzaSyTOPSEKRITVALUE'"
    scrubbed = redact_secrets(text)
    assert "AIzaSyTOPSEKRITVALUE" not in scrubbed
    assert "[REDACTED]" in scrubbed


def test_redact_secrets_scrubs_bearer_tokens():
    assert SECRET not in redact_secrets(f"Authorization: Bearer {SECRET}", SECRET)


def test_redact_secrets_scrubs_explicit_secret_anywhere():
    assert SECRET not in redact_secrets(f"upstream said {SECRET} oops", SECRET)


# ── Timeouts ─────────────────────────────────────────────────────────────────


def test_clamp_timeout_bounds_untrusted_values():
    assert clamp_timeout(1e12) == 120.0
    assert clamp_timeout(0) == 1.0
    assert clamp_timeout(-5) == 1.0
    assert clamp_timeout(float("nan")) == 15.0
    assert clamp_timeout(None) == 15.0
    assert clamp_timeout(30.0) == 30.0


# ── Circuit breaker ──────────────────────────────────────────────────────────


def test_can_execute_has_no_side_effect_on_state():
    breaker = CircuitBreaker("p", failure_threshold=1, recovery_timeout_seconds=0.0)
    breaker.record_failure()
    assert breaker.state == CircuitState.OPEN
    # A read-only health probe must not advance the state machine.
    assert breaker.can_execute() is True
    assert breaker.state == CircuitState.OPEN


def test_half_open_admits_exactly_one_probe():
    breaker = CircuitBreaker("p", failure_threshold=1, recovery_timeout_seconds=0.0)
    breaker.record_failure()
    assert breaker.try_acquire() is True
    assert breaker.state == CircuitState.HALF_OPEN
    # A second concurrent caller must be rejected while the probe is in flight.
    assert breaker.try_acquire() is False
    breaker.release_probe()
    assert breaker.try_acquire() is True


def test_open_breaker_blocks_before_recovery_window():
    breaker = CircuitBreaker("p", failure_threshold=1, recovery_timeout_seconds=300.0)
    breaker.record_failure()
    assert breaker.can_execute() is False
    assert breaker.try_acquire() is False


def test_failed_probe_reopens_breaker():
    breaker = CircuitBreaker("p", failure_threshold=1, recovery_timeout_seconds=0.0)
    breaker.record_failure()
    breaker.try_acquire()
    breaker.record_failure()
    assert breaker.state == CircuitState.OPEN


def test_success_resets_breaker():
    breaker = CircuitBreaker("p", failure_threshold=2)
    breaker.record_failure()
    breaker.record_success()
    assert breaker.state == CircuitState.CLOSED
    assert breaker.failure_count == 0
    assert breaker.last_failure_time is None


# ── Structured output validation ─────────────────────────────────────────────


@pytest.mark.parametrize(
    "adapter_cls",
    [OpenAILiveAdapter, AnthropicLiveAdapter, GeminiLiveAdapter],
)
def test_validate_structured_output_rejects_non_object(adapter_cls):
    adapter = adapter_cls()
    schema = {"type": "object", "required": ["status"]}
    valid, reason = adapter.validate_structured_output("[1, 2, 3]", schema)
    assert valid is False
    assert "object" in (reason or "").lower()


@pytest.mark.parametrize(
    "adapter_cls",
    [OpenAILiveAdapter, AnthropicLiveAdapter, GeminiLiveAdapter],
)
def test_validate_structured_output_enforces_property_types(adapter_cls):
    adapter = adapter_cls()
    schema = {
        "type": "object",
        "required": ["status", "count"],
        "properties": {"status": {"type": "string"}, "count": {"type": "integer"}},
    }
    valid, reason = adapter.validate_structured_output(
        json.dumps({"status": 123, "count": "nope"}), schema
    )
    assert valid is False
    assert "status" in (reason or "")


@pytest.mark.parametrize(
    "adapter_cls",
    [OpenAILiveAdapter, AnthropicLiveAdapter, GeminiLiveAdapter],
)
def test_validate_structured_output_rejects_nan(adapter_cls):
    adapter = adapter_cls()
    valid, reason = adapter.validate_structured_output(
        '{"status":"ok","count":NaN}', {"type": "object", "required": ["status", "count"]}
    )
    assert valid is False
    assert reason


@pytest.mark.parametrize(
    "adapter_cls",
    [OpenAILiveAdapter, AnthropicLiveAdapter, GeminiLiveAdapter],
)
def test_validate_structured_output_accepts_valid_document(adapter_cls):
    adapter = adapter_cls()
    schema = {
        "type": "object",
        "required": ["status"],
        "properties": {"status": {"type": "string"}},
    }
    valid, reason = adapter.validate_structured_output('{"status":"ok"}', schema)
    assert valid is True
    assert reason is None


# ── Live-call failure handling ───────────────────────────────────────────────


def test_openai_live_timeout_raises_provider_timeout_error():
    adapter = OpenAILiveAdapter()
    request = ModelRequest(prompt="hi")
    with patch("nexora.config.get_settings", return_value=Settings(OPENAI_API_KEY="sk-x")):
        with patch("httpx.AsyncClient.post", side_effect=httpx.ReadTimeout("timed out")):
            with pytest.raises(ProviderTimeoutError):
                asyncio.run(adapter.generate_response("gpt-4o", request, {}))


def test_openai_live_empty_content_is_not_replaced_by_synthetic_output():
    resp = Mock()
    resp.status_code = 200
    resp.json.return_value = {
        "choices": [{"message": {"content": None}, "finish_reason": "tool_calls"}],
        "usage": {},
    }
    adapter = OpenAILiveAdapter()
    with patch("nexora.config.get_settings", return_value=Settings(OPENAI_API_KEY="sk-x")):
        with patch("httpx.AsyncClient.post", return_value=resp):
            with pytest.raises(ProviderException) as exc:
                asyncio.run(adapter.generate_response("gpt-4o", ModelRequest(prompt="hi"), {}))
    assert "Synthesized" not in str(exc.value)


def test_generic_adapter_records_failure_instead_of_success_on_http_500():
    resp = Mock()
    resp.status_code = 500
    resp.text = "upstream exploded"
    resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "boom", request=httpx.Request("POST", "https://x"), response=httpx.Response(500)
    )
    adapter = GenericOpenAICompatibleAdapter(provider_name="mistral", base_url="https://api.mistral.ai/v1")
    with patch("httpx.AsyncClient.post", return_value=resp):
        with pytest.raises(ProviderException):
            asyncio.run(
                adapter.generate_response(
                    "mistral-large", ModelRequest(prompt="hi"), {"api_key": "k"}
                )
            )
    # The failure must be recorded, not swallowed into a `record_success()`.
    assert adapter.circuit_breaker.failure_count == 1


def test_generic_adapter_does_not_leak_api_key_in_error_message():
    resp = Mock()
    resp.status_code = 500
    resp.text = "boom"
    resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        f"boom for url 'https://api.example.com/v1?key={SECRET}'",
        request=httpx.Request("POST", "https://x"),
        response=httpx.Response(500),
    )
    adapter = GenericOpenAICompatibleAdapter(provider_name="mistral", base_url="https://api.mistral.ai/v1")
    with patch("httpx.AsyncClient.post", return_value=resp):
        with pytest.raises(ProviderException) as exc:
            asyncio.run(
                adapter.generate_response(
                    "mistral-large", ModelRequest(prompt="hi"), {"api_key": SECRET}
                )
            )
    assert SECRET not in str(exc.value)


def test_gemini_key_is_not_placed_in_the_request_url():
    resp = Mock()
    resp.status_code = 200
    resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "ok"}]}, "finishReason": "STOP"}],
        "usageMetadata": {},
    }
    captured = {}

    async def capture(*args, **kwargs):
        captured["url"] = str(args[1] if len(args) > 1 else kwargs.get("url", ""))
        return resp

    adapter = GeminiLiveAdapter()
    with patch("nexora.config.get_settings", return_value=Settings(GEMINI_API_KEY=SECRET)):
        with patch("httpx.AsyncClient.post", capture):
            asyncio.run(
                adapter.generate_response("gemini-1.5-pro", ModelRequest(prompt="hi"), {})
            )
    assert SECRET not in captured["url"]
    assert "key=" not in captured["url"]


# ── SSRF / egress policy ─────────────────────────────────────────────────────


def test_validate_provider_endpoint_rejects_metadata_host():
    with pytest.raises(Exception):
        ToolSandbox.validate_provider_endpoint("http://169.254.169.254/latest/meta-data")


def test_validate_provider_endpoint_rejects_loopback_for_cloud_providers():
    with pytest.raises(Exception):
        ToolSandbox.validate_provider_endpoint("http://127.0.0.1:8000/v1")


def test_validate_provider_endpoint_rejects_non_http_scheme():
    with pytest.raises(Exception):
        ToolSandbox.validate_provider_endpoint("file:///etc/passwd")


def test_validate_provider_endpoint_rejects_embedded_credentials():
    with pytest.raises(Exception):
        ToolSandbox.validate_provider_endpoint("https://user:pass@api.example.com/v1")


def test_validate_provider_endpoint_allows_loopback_for_local_providers():
    assert (
        ToolSandbox.validate_provider_endpoint("http://127.0.0.1:11434", allow_loopback=True)
        == "http://127.0.0.1:11434"
    )


def test_adapter_rejects_ssrf_base_url():
    adapter = OpenAILiveAdapter()
    with pytest.raises(ProviderException) as exc:
        adapter._validate_endpoint("http://169.254.169.254/latest", {})
    assert exc.value.status_code == 400


def test_adapter_allows_local_base_url_when_provider_is_local():
    adapter = OpenAILiveAdapter()
    assert (
        adapter._validate_endpoint("http://127.0.0.1:11434", {"is_local": True})
        == "http://127.0.0.1:11434"
    )


def test_egress_rejection_is_marked_as_policy_rejection():
    adapter = OpenAILiveAdapter()
    with pytest.raises(ProviderException) as exc:
        adapter._validate_endpoint("http://169.254.169.254/latest", {})
    assert exc.value.policy_rejected is True


def test_policy_rejection_is_never_downgraded_to_simulation():
    """
    A blocked endpoint must raise, never fall back to a synthetic response.

    The tier-restriction fallbacks in the dedicated adapters match on message
    keywords; the policy rejection has to be flagged so it cannot be mistaken
    for a vendor quota error.
    """
    adapter = GroqLiveAdapter()
    request = ModelRequest(prompt="hello")
    resp = Mock()
    resp.status_code = 400
    resp.text = "forbidden by egress policy"
    resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "forbidden by egress policy",
        request=httpx.Request("POST", "https://x"),
        response=httpx.Response(400),
    )
    with patch("httpx.AsyncClient.post", return_value=resp):
        with pytest.raises(ProviderException) as exc:
            asyncio.run(
                adapter.generate_response(
                    "llama-3.3-70b-versatile",
                    request,
                    {"api_key": "k", "base_url": "https://api.groq.com/openai/v1"},
                )
            )
    assert exc.value.policy_rejected is False  # vendor 400, not a local policy refusal
    assert "Synthesized" not in str(exc.value)
