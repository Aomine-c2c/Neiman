"""
Tests for live intelligence provider adapter bridges and fallback resilience.
Verifies that when live API keys are provided or unconfigured, the adapters
behave properly, execute correctly, or gracefully fall back without crash.
"""

from unittest.mock import Mock, patch

import pytest

from nexora.config import Settings
from nexora.domains.intelligence.adapters.base import (
    AnthropicLiveAdapter,
    GeminiLiveAdapter,
    OpenAILiveAdapter,
)
from nexora.domains.intelligence.schemas import ModelRequest


@pytest.mark.asyncio
async def test_openai_adapter_simulated_fallback_when_no_key():
    adapter = OpenAILiveAdapter()
    req = ModelRequest(
        prompt="Synthesize organizational policy",
        required_capabilities=["reasoning"],
    )
    metadata = {
        "input_cost_per_million": 2.50,
        "output_cost_per_million": 10.00,
        "avg_latency_ms": 450.0,
    }

    # With no key set, runs simulated response
    res = await adapter.generate_response("gpt-4o", req, metadata)
    assert res.provider_used == "openai"
    assert "gpt-4o" in res.model_used
    assert res.prompt_tokens > 0
    assert res.completion_tokens > 0


@pytest.mark.asyncio
async def test_openai_adapter_live_execution_mocked_http():
    adapter = OpenAILiveAdapter()
    req = ModelRequest(
        prompt="Analyze revenue trend",
        required_capabilities=["reasoning"],
    )
    metadata = {
        "input_cost_per_million": 2.50,
        "output_cost_per_million": 10.00,
        "avg_latency_ms": 450.0,
    }

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Live analysis output from GPT-4o."}}],
        "usage": {"prompt_tokens": 42, "completion_tokens": 128},
    }

    with patch(
        "nexora.config.get_settings", return_value=Settings(OPENAI_API_KEY="sk-mock-live-key")
    ):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            res = await adapter.generate_response("gpt-4o", req, metadata)
            assert res.text == "Live analysis output from GPT-4o."
            assert res.prompt_tokens == 42
            assert res.completion_tokens == 128


@pytest.mark.asyncio
async def test_anthropic_adapter_live_execution_mocked_http():
    adapter = AnthropicLiveAdapter()
    req = ModelRequest(
        prompt="Review system architecture",
        required_capabilities=["reasoning"],
    )
    metadata = {
        "input_cost_per_million": 3.00,
        "output_cost_per_million": 15.00,
        "avg_latency_ms": 650.0,
    }

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "content": [{"text": "Live architecture critique from Claude 3.5 Sonnet."}],
        "usage": {"input_tokens": 55, "output_tokens": 160},
    }

    with patch(
        "nexora.config.get_settings", return_value=Settings(ANTHROPIC_API_KEY="sk-ant-mock-key")
    ):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            res = await adapter.generate_response("claude-3-5-sonnet", req, metadata)
            assert res.text == "Live architecture critique from Claude 3.5 Sonnet."
            assert res.prompt_tokens == 55
            assert res.completion_tokens == 160


@pytest.mark.asyncio
async def test_gemini_adapter_live_execution_mocked_http():
    adapter = GeminiLiveAdapter()
    req = ModelRequest(
        prompt="Process large enterprise dataset",
        required_capabilities=["large_context"],
    )
    metadata = {
        "input_cost_per_million": 1.25,
        "output_cost_per_million": 5.00,
        "avg_latency_ms": 380.0,
    }

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Live synthesis from Gemini 1.5 Pro."}]}}],
        "usageMetadata": {"promptTokenCount": 90, "candidatesTokenCount": 210},
    }

    with patch(
        "nexora.config.get_settings", return_value=Settings(GEMINI_API_KEY="mock-gemini-key")
    ):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            res = await adapter.generate_response("gemini-1.5-pro", req, metadata)
            assert res.text == "Live synthesis from Gemini 1.5 Pro."
            assert res.prompt_tokens == 90
            assert res.completion_tokens == 210


@pytest.mark.asyncio
async def test_kilocode_adapter_live_execution_mocked_http():
    from nexora.domains.intelligence.adapters.base import KiloCodeLiveAdapter

    adapter = KiloCodeLiveAdapter()
    req = ModelRequest(prompt="Code autocomplete test")
    metadata = {
        "input_cost_per_million": 0.0,
        "output_cost_per_million": 0.0,
        "avg_latency_ms": 200.0,
    }

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "const calculateTotal = (items) => items.reduce((a, b) => a + b.price, 0);"}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 25},
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        res = await adapter.generate_response("autofree", req, metadata)
        assert "calculateTotal" in res.text
        assert res.model_used == "kilo-auto/free"
        assert res.estimated_cost_usd == 0.0
        assert mock_post.called
        assert "api.kilo.ai/api/gateway/chat/completions" in mock_post.call_args[0][0]


@pytest.mark.asyncio
async def test_ollama_cloud_adapter_live_execution_mocked_http():
    from nexora.domains.intelligence.adapters.base import OllamaCloudLiveAdapter

    adapter = OllamaCloudLiveAdapter()
    req = ModelRequest(prompt="Tell me a joke")
    metadata = {
        "input_cost_per_million": 0.0,
        "output_cost_per_million": 0.0,
        "avg_latency_ms": 220.0,
    }

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Why did the neural net cross the road? To optimize the loss function."}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 20},
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        res = await adapter.generate_response("gemma4:31b-cloud", req, metadata)
        assert "neural net" in res.text
        assert res.provider_used == "ollama"
        assert mock_post.called
        assert "ollama.com/v1/chat/completions" in mock_post.call_args[0][0]
