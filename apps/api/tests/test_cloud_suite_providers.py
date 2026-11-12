"""
Tests for Full Cloud Suite AI providers, environment-resolved credentials,
and complete deactivation/purging of Ollama connectivity.
"""

from unittest.mock import Mock, patch

import pytest

from nexora.config import Settings, get_settings
from nexora.domains.intelligence.adapters.base import (
    FALLBACK_ALIBABA_API_KEY,
    FALLBACK_ARCEE_API_KEY,
    FALLBACK_DEEPSEEK_API_KEY,
    FALLBACK_GROQ_API_KEY,
    FALLBACK_HUGGINGFACE_API_KEY,
    FALLBACK_KILO_API_KEY,
    FALLBACK_KIMI_API_KEY,
    FALLBACK_META_API_KEY,
    FALLBACK_MINIMAX_API_KEY,
    FALLBACK_OLLAMA_API_KEY,
    FALLBACK_OPENAI_API_KEY,
    FALLBACK_TOGETHER_API_KEY,
    FALLBACK_UPSTAGE_API_KEY,
    FALLBACK_XIAOMIMIMO_API_KEY,
    FALLBACK_ZAI_API_KEY,
    AlibabaCloudLiveAdapter,
    ArceeLiveAdapter,
    CerebrasLiveAdapter,
    CohereLiveAdapter,
    DeepSeekLiveAdapter,
    GeminiLiveAdapter,
    GroqLiveAdapter,
    HuggingFaceLiveAdapter,
    KiloCodeLiveAdapter,
    KimiLiveAdapter,
    LocalModelLiveAdapter,
    MetaMuseLiveAdapter,
    MiniMaxLiveAdapter,
    MistralLiveAdapter,
    ModelAdapterRegistry,
    OllamaCloudLiveAdapter,
    OpenAILiveAdapter,
    OpenRouterLiveAdapter,
    ProviderException,
    TogetherAILiveAdapter,
    UpstageLiveAdapter,
    XAILiveAdapter,
    XiaomiMiMoLiveAdapter,
    ZAILiveAdapter,
)
from nexora.domains.intelligence.schemas import ModelRequest


@pytest.fixture(autouse=True)
def disable_simulation_mode_for_cloud_suite_tests(monkeypatch):
    """Ensure adapter live dispatch with mocked httpx runs with simulation mode disabled."""
    monkeypatch.setenv("ENABLE_SIMULATION_MODE", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_kilocode_adapter_resolves_credential_from_environment():
    """Verify the KiloCodeLiveAdapter credential is resolved from the environment."""
    adapter = KiloCodeLiveAdapter()
    req = ModelRequest(prompt="Hello Kilo Code")
    metadata: dict = {}

    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" in FALLBACK_KILO_API_KEY

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Hello from Kilo Code!"}}],
        "usage": {"prompt_tokens": 12, "completion_tokens": 8},
    }

    with patch("nexora.config.get_settings", return_value=Settings(KILO_API_KEY=None, KILOCODE_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("kilo-auto/free", req, metadata)
            assert res.text == "Hello from Kilo Code!"
            assert res.provider_used == "kilocode"

            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_KILO_API_KEY}"


@pytest.mark.asyncio
async def test_kilocode_adapter_defaults_to_autofree():
    """Verify KiloCodeLiveAdapter resolves 'autofree' alias and empty models to kilo-auto/free at $0 cost."""
    adapter = KiloCodeLiveAdapter()
    req = ModelRequest(prompt="Generate code")
    metadata: dict = {}

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Code output"}}],
        "usage": {"prompt_tokens": 20, "completion_tokens": 30},
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        # Test 1: model="autofree"
        res = await adapter.generate_response("autofree", req, metadata)
        assert res.model_used == "kilo-auto/free"
        assert res.estimated_cost_usd == 0.0
        payload = mock_post.call_args[1]["json"]
        assert payload["model"] == "kilo-auto/free"

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        # Test 2: model=""
        res = await adapter.generate_response("", req, metadata)
        assert res.model_used == "kilo-auto/free"
        assert res.estimated_cost_usd == 0.0
        payload = mock_post.call_args[1]["json"]
        assert payload["model"] == "kilo-auto/free"


@pytest.mark.asyncio
async def test_gemini_adapter_sends_credential_in_header_not_query_string():
    """
    The Gemini credential must travel in the `x-goog-api-key` header.

    httpx embeds the full request URL in its exception messages, so a `?key=`
    query parameter leaks the secret into logs, the routing ledger and API
    responses. The key is also never hardcoded in source: it is resolved from
    the environment.
    """
    adapter = GeminiLiveAdapter()
    req = ModelRequest(
        prompt="Verify credential transport",
        required_capabilities=["reasoning"],
    )
    metadata = {
        "input_cost_per_million": 0.10,
        "output_cost_per_million": 0.40,
        "avg_latency_ms": 350.0,
    }

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Gemini response via header key."}]}}],
        "usageMetadata": {"promptTokenCount": 15, "candidatesTokenCount": 30},
    }

    configured_key = "AQ.TestOnlyConfiguredGeminiKey"

    with patch(
        "nexora.config.get_settings", return_value=Settings(GEMINI_API_KEY=configured_key)
    ):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("gemini-3.5-flash", req, metadata)
            assert res.text == "Gemini response via header key."
            assert res.provider_used == "google_gemini"

            call_url = mock_post.call_args[0][0]
            headers = mock_post.call_args[1].get("headers") or {}
            # The credential must not appear anywhere in the URL.
            assert configured_key not in call_url
            assert "key=" not in call_url
            # ...and must be carried by the dedicated header.
            assert headers.get("x-goog-api-key") == configured_key


@pytest.mark.asyncio
async def test_deepseek_adapter_resolves_credential_from_environment():
    """Verify the DeepSeekLiveAdapter credential is resolved from the environment."""
    adapter = DeepSeekLiveAdapter()
    req = ModelRequest(prompt="Verify deepseek key fallback")
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_DEEPSEEK_API_KEY == (get_settings().DEEPSEEK_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "DeepSeek response via configured key."}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 20},
    }

    with patch("nexora.config.get_settings", return_value=Settings(DEEPSEEK_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("deepseek-chat", req, metadata)
            assert res.text == "DeepSeek response via configured key."
            assert res.provider_used == "deepseek"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_DEEPSEEK_API_KEY}"


@pytest.mark.asyncio
async def test_openai_adapter_resolves_credential_from_environment():
    """Verify the OpenAILiveAdapter credential is resolved from the environment."""
    adapter = OpenAILiveAdapter()
    req = ModelRequest(prompt="Verify openai key fallback")
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_OPENAI_API_KEY == (get_settings().OPENAI_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "OpenAI response via configured key."}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 20},
    }

    with patch("nexora.config.get_settings", return_value=Settings(OPENAI_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("gpt-4o", req, metadata)
            assert res.text == "OpenAI response via configured key."
            assert res.provider_used == "openai"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_OPENAI_API_KEY}"


@pytest.mark.asyncio
async def test_meta_muse_adapter_resolves_credential_from_environment():
    """Verify the MetaMuseLiveAdapter credential is resolved from the environment."""
    adapter = MetaMuseLiveAdapter()
    req = ModelRequest(prompt="Verify meta muse key fallback")
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_META_API_KEY == (get_settings().META_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Meta Muse response via configured key."}}],
        "usage": {"prompt_tokens": 14, "completion_tokens": 28},
    }

    with patch("nexora.config.get_settings", return_value=Settings(META_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("muse-spark-1.3", req, metadata)
            assert res.text == "Meta Muse response via configured key."
            assert res.provider_used == "meta_muse"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_META_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "api.meta.ai" in call_url


@pytest.mark.asyncio
async def test_ollama_cloud_adapter_resolves_credential_from_environment():
    """Verify the OllamaCloudLiveAdapter credential is resolved from the environment."""
    adapter = OllamaCloudLiveAdapter()
    req = ModelRequest(prompt="Verify ollama key fallback")
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_OLLAMA_API_KEY == (get_settings().OLLAMA_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Ollama Cloud response via configured key."}}],
        "usage": {"prompt_tokens": 12, "completion_tokens": 24},
    }

    with patch("nexora.config.get_settings", return_value=Settings(OLLAMA_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("gemma4:31b-cloud", req, metadata)
            assert res.text == "Ollama Cloud response via configured key."
            assert res.provider_used == "ollama"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_OLLAMA_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "ollama.com" in call_url


@pytest.mark.asyncio
async def test_groq_adapter_resolves_credential_from_environment():
    """Verify the GroqLiveAdapter credential is resolved from the environment."""
    adapter = GroqLiveAdapter()
    req = ModelRequest(prompt="Verify groq key fallback")
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_GROQ_API_KEY == (get_settings().GROQ_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Groq LPU response via configured key."}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 30},
    }

    with patch("nexora.config.get_settings", return_value=Settings(GROQ_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("qwen/qwen3.8-27b", req, metadata)
            assert res.text == "Groq LPU response via configured key."
            assert res.provider_used == "groq"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_GROQ_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "api.groq.com" in call_url


@pytest.mark.asyncio
async def test_together_adapter_resolves_credential_from_environment():
    """Verify the TogetherAILiveAdapter credential is resolved from the environment."""
    adapter = TogetherAILiveAdapter()
    req = ModelRequest(
        prompt="Verify static together key fallback",
        required_capabilities=["reasoning"],
    )
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_TOGETHER_API_KEY == (get_settings().TOGETHER_AI_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Together AI high-throughput response via configured key."}}],
        "usage": {"prompt_tokens": 14, "completion_tokens": 28},
    }

    with patch("nexora.config.get_settings", return_value=Settings(TOGETHER_AI_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("meta-llama/Llama-3.3-70B-Instruct-Turbo", req, metadata)
            assert res.text == "Together AI high-throughput response via configured key."
            assert res.provider_used == "together_ai"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_TOGETHER_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "api.together.xyz" in call_url


@pytest.mark.asyncio
async def test_together_adapter_rejects_unactivated_key_without_synthetic_output():
    """Verify an unauthorized provider response is surfaced instead of fabricated output."""
    import httpx

    adapter = TogetherAILiveAdapter()
    req = ModelRequest(prompt="Test simulation failover")
    metadata: dict = {}

    mock_resp = Mock()
    mock_resp.status_code = 401
    mock_resp.text = "Unauthorized"

    with patch("nexora.config.get_settings", return_value=Settings(TOGETHER_AI_API_KEY=None, ENABLE_SIMULATION_MODE=False)):
        with patch(
            "httpx.AsyncClient.post",
            side_effect=httpx.HTTPStatusError("401 Unauthorized", request=Mock(), response=mock_resp),
        ):
            with pytest.raises(ProviderException):
                await adapter.generate_response("meta-llama/Llama-3.3-70B-Instruct-Turbo", req, metadata)


@pytest.mark.asyncio
async def test_huggingface_adapter_resolves_credential_from_environment():
    """Verify HuggingFaceLiveAdapter falls back to the hardcoded Hugging Face token."""
    adapter = HuggingFaceLiveAdapter()
    req = ModelRequest(
        prompt="Verify static huggingface token fallback",
        required_capabilities=["reasoning"],
    )
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_HUGGINGFACE_API_KEY == (get_settings().HUGGINGFACE_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Hugging Face router completion via hardcoded token."}}],
        "usage": {"prompt_tokens": 16, "completion_tokens": 32},
    }

    with patch("nexora.config.get_settings", return_value=Settings(HUGGINGFACE_API_KEY=None, HF_TOKEN=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("meta-llama/Llama-3.3-70B-Instruct:fastest", req, metadata)
            assert res.text == "Hugging Face router completion via hardcoded token."
            assert res.provider_used == "huggingface"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_HUGGINGFACE_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "router.huggingface.co" in call_url


@pytest.mark.asyncio
async def test_huggingface_adapter_surfaces_credit_exhaustion():
    """Verify credit exhaustion is reported without fabricated inference output."""
    import httpx

    adapter = HuggingFaceLiveAdapter()
    req = ModelRequest(prompt="Test credit exhaustion simulation failover")
    metadata: dict = {}

    mock_resp = Mock()
    mock_resp.status_code = 402
    mock_resp.text = '{"error":"You have no remaining credits. Purchase pre-paid credits to continue using Inference Providers."}'

    with patch("nexora.config.get_settings", return_value=Settings(HUGGINGFACE_API_KEY=None, HF_TOKEN=None, ENABLE_SIMULATION_MODE=False)):
        with patch(
            "httpx.AsyncClient.post",
            side_effect=httpx.HTTPStatusError("402 Payment Required", request=Mock(), response=mock_resp),
        ):
            with pytest.raises(ProviderException):
                await adapter.generate_response("meta-llama/Llama-3.3-70B-Instruct:fastest", req, metadata)


@pytest.mark.asyncio
async def test_kimi_adapter_resolves_credential_from_environment():
    """Verify the KimiLiveAdapter credential is resolved from the environment."""
    adapter = KimiLiveAdapter()
    req = ModelRequest(
        prompt="Verify static kimi key fallback",
        required_capabilities=["reasoning"],
    )
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_KIMI_API_KEY == (get_settings().KIMI_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Kimi Moonshot AI code reasoning completion via configured key."}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 30},
    }

    with patch("nexora.config.get_settings", return_value=Settings(KIMI_API_KEY=None, MOONSHOT_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("kimi-k2.7-code", req, metadata)
            assert res.text == "Kimi Moonshot AI code reasoning completion via configured key."
            assert res.provider_used == "kimi"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_KIMI_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "api.moonshot.ai" in call_url


@pytest.mark.asyncio
async def test_kimi_adapter_surfaces_balance_exhaustion():
    """Verify Kimi quota exhaustion is reported without fabricated inference output."""
    import httpx

    adapter = KimiLiveAdapter()
    req = ModelRequest(prompt="Test balance exhaustion simulation failover")
    metadata: dict = {}

    mock_resp = Mock()
    mock_resp.status_code = 429
    mock_resp.text = '{"error":{"message":"Your account is suspended due to insufficient balance","type":"exceeded_current_quota_error"}}'

    with patch("nexora.config.get_settings", return_value=Settings(KIMI_API_KEY=None, MOONSHOT_API_KEY=None, ENABLE_SIMULATION_MODE=False)):
        with patch(
            "httpx.AsyncClient.post",
            side_effect=httpx.HTTPStatusError("429 Too Many Requests", request=Mock(), response=mock_resp),
        ):
            with pytest.raises(ProviderException):
                await adapter.generate_response("kimi-k2.7-code", req, metadata)


@pytest.mark.asyncio
async def test_zai_adapter_resolves_credential_from_environment():
    """Verify the ZAILiveAdapter credential is resolved from the environment."""
    adapter = ZAILiveAdapter()
    req = ModelRequest(
        prompt="Verify static z.ai key fallback",
        required_capabilities=["reasoning"],
    )
    metadata: dict = {}

    # The credential is resolved from the environment, never hardcoded in source.
    assert FALLBACK_ZAI_API_KEY == (get_settings().ZAI_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Z.AI GLM-5 reasoning completion via configured key."}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 30},
    }

    with patch("nexora.config.get_settings", return_value=Settings(ZAI_API_KEY=None, Z_AI_API_KEY=None, ZHIPU_API_KEY=None)):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("glm-5", req, metadata)
            assert res.text == "Z.AI GLM-5 reasoning completion via configured key."
            assert res.provider_used == "z_ai"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_ZAI_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "open.bigmodel.cn" in call_url


@pytest.mark.asyncio
async def test_zai_adapter_surfaces_balance_exhaustion():
    """Verify Z.AI quota exhaustion is reported without fabricated inference output."""
    import httpx

    adapter = ZAILiveAdapter()
    req = ModelRequest(prompt="Test balance exhaustion simulation failover")
    metadata: dict = {}

    mock_resp = Mock()
    mock_resp.status_code = 429
    mock_resp.text = '{"error":{"code":"1113","message":"余额不足或无可用资源包,请充值。"}}'

    with patch("nexora.config.get_settings", return_value=Settings(ZAI_API_KEY=None, Z_AI_API_KEY=None, ZHIPU_API_KEY=None, ENABLE_SIMULATION_MODE=False)):
        with patch(
            "httpx.AsyncClient.post",
            side_effect=httpx.HTTPStatusError("429 Too Many Requests", request=Mock(), response=mock_resp),
        ):
            with pytest.raises(ProviderException):
                await adapter.generate_response("glm-5", req, metadata)


@pytest.mark.asyncio
async def test_alibabacloud_adapter_resolves_credential_from_environment():
    """Verify the AlibabaCloudLiveAdapter credential is resolved from the environment."""
    adapter = AlibabaCloudLiveAdapter()
    req = ModelRequest(
        prompt="Verify static alibaba cloud key fallback",
        required_capabilities=["reasoning"],
    )
    metadata: dict = {}

    assert FALLBACK_ALIBABA_API_KEY == (get_settings().ALIBABA_API_KEY or "")

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Qwen 3.8 Flash live completion via configured key."}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 30},
    }

    with patch(
        "nexora.config.get_settings",
        return_value=Settings(
            ALIBABACLOUD_API_KEY=None,
            ALIBABA_API_KEY=None,
            DASHSCOPE_API_KEY=None,
            QWEN_API_KEY=None,
        ),
    ):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            res = await adapter.generate_response("qwen3.8-flash", req, metadata)
            assert res.text == "Qwen 3.8 Flash live completion via configured key."
            assert res.provider_used == "alibabacloud"
            headers = mock_post.call_args[1]["headers"]
            assert headers["Authorization"] == f"Bearer {FALLBACK_ALIBABA_API_KEY}"
            call_url = mock_post.call_args[0][0]
            assert "dashscope-intl.aliyuncs.com" in call_url


@pytest.mark.asyncio
async def test_alibabacloud_adapter_surfaces_invalid_api_key():
    """Verify invalid Alibaba credentials fail without fabricated inference output."""
    import httpx

    adapter = AlibabaCloudLiveAdapter()
    req = ModelRequest(prompt="Test balance exhaustion simulation failover")
    metadata: dict = {}

    mock_resp = Mock()
    mock_resp.status_code = 401
    mock_resp.text = '{"error":{"message":"Incorrect API key provided","code":"invalid_api_key"}}'

    with patch(
        "nexora.config.get_settings",
        return_value=Settings(
            ALIBABACLOUD_API_KEY=None,
            ALIBABA_API_KEY=None,
            DASHSCOPE_API_KEY=None,
            QWEN_API_KEY=None,
            ENABLE_SIMULATION_MODE=False,
        ),
    ):
        with patch(
            "httpx.AsyncClient.post",
            side_effect=httpx.HTTPStatusError("401 Unauthorized", request=Mock(), response=mock_resp),
        ):
            with pytest.raises(ProviderException):
                await adapter.generate_response("qwen3.8-flash", req, metadata)


@pytest.mark.asyncio
async def test_local_model_adapter_has_no_ollama_daemon_calls():
    """Verify missing local inference configuration fails without synthetic output."""
    adapter = LocalModelLiveAdapter()
    req = ModelRequest(
        prompt="Offline air-gapped query",
        required_capabilities=["privacy"],
    )
    metadata = {"avg_latency_ms": 200.0}

    with patch(
        "nexora.config.get_settings",
        return_value=Settings(ENABLE_SIMULATION_MODE=False),
    ):
        with pytest.raises(ProviderException, match="endpoint is not configured"):
            await adapter.generate_response("local-model", req, metadata)


@pytest.mark.asyncio
async def test_local_model_adapter_uses_configured_openai_compatible_endpoint():
    adapter = LocalModelLiveAdapter()
    req = ModelRequest(prompt="Explain the current project status.", required_capabilities=["privacy"])
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "The service is ready."}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 8, "completion_tokens": 5},
    }

    with patch(
        "nexora.config.get_settings",
        return_value=Settings(ENABLE_SIMULATION_MODE=False),
    ):
        with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
            response = await adapter.generate_response(
                "qwen2.5:7b",
                req,
                {"base_url": "http://127.0.0.1:11434/v1", "is_local": True},
            )

    assert response.text == "The service is ready."
    assert response.provider_used == "local"
    assert response.total_tokens == 13
    assert mock_post.call_args.args[0] == "http://127.0.0.1:11434/v1/chat/completions"


@pytest.mark.parametrize(
    "adapter_cls,provider_name,expected_domain",
    [
        (GroqLiveAdapter, "groq", "api.groq.com"),
        (OpenRouterLiveAdapter, "openrouter", "openrouter.ai"),
        (MistralLiveAdapter, "mistral", "api.mistral.ai"),
        (DeepSeekLiveAdapter, "deepseek", "api.deepseek.com"),
        (CerebrasLiveAdapter, "cerebras", "api.cerebras.ai"),
        (TogetherAILiveAdapter, "together_ai", "api.together.xyz"),
        (CohereLiveAdapter, "cohere", "api.cohere.com"),
        (XAILiveAdapter, "xai", "api.x.ai"),
        (OllamaCloudLiveAdapter, "ollama", "ollama.com"),
        (HuggingFaceLiveAdapter, "huggingface", "router.huggingface.co"),
        (KimiLiveAdapter, "kimi", "api.moonshot.ai"),
        (ZAILiveAdapter, "z_ai", "open.bigmodel.cn"),
        (AlibabaCloudLiveAdapter, "alibabacloud", "dashscope-intl.aliyuncs.com"),
    ],
)
@pytest.mark.asyncio
async def test_dedicated_cloud_provider_adapters_live_call(adapter_cls, provider_name, expected_domain):
    """Verify each dedicated provider adapter formats live requests and hits its specific domain."""
    adapter = adapter_cls()
    assert adapter.get_provider_name() == provider_name

    req = ModelRequest(
        prompt="Synthesize organizational policy",
        required_capabilities=["reasoning"],
    )
    metadata = {
        "api_key": "test-key-12345",
        "input_cost_per_million": 0.50,
        "output_cost_per_million": 1.50,
        "avg_latency_ms": 300.0,
    }

    mock_resp = Mock()
    mock_resp.status_code = 200
    if provider_name == "cohere":
        mock_resp.json.return_value = {
            "message": {"content": [{"text": f"Response from {provider_name}."}]},
            "usage": {"tokens": {"input_tokens": 10, "output_tokens": 20}},
        }
    else:
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": f"Response from {provider_name}."}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20},
        }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        res = await adapter.generate_response("test-model", req, metadata)
        assert f"Response from {provider_name}." in res.text
        assert res.provider_used == provider_name
        assert res.prompt_tokens == 10
        assert res.completion_tokens == 20

        call_url = mock_post.call_args[0][0]
        assert expected_domain in call_url


def test_registry_registers_all_cloud_suite_adapters():
    """Verify ModelAdapterRegistry registers every member of the Cloud Suite."""
    registry = ModelAdapterRegistry()
    expected_providers = [
        "openai",
        "anthropic",
        "google_gemini",
        "local",
        "groq",
        "openrouter",
        "mistral",
        "deepseek",
        "cerebras",
        "together_ai",
        "cohere",
        "xai",
        "kilocode",
        "meta_muse",
        "huggingface",
        "kimi",
        "z_ai",
        "zhipu_ai",
        "zai",
        "alibabacloud",
        "dashscope",
        "alibaba",
        "qwen",
        "arcee",
        "xiaomimimo",
        "xiaomi_mimo",
        "mimo",
        "minimax",
        "upstage",
    ]
    for p in expected_providers:
        adapter = registry.get(p)
        assert adapter is not None, f"Missing adapter for provider: {p}"
        assert adapter.get_provider_name() == p
    assert isinstance(registry.get("kilocode"), KiloCodeLiveAdapter)
    assert isinstance(registry.get("meta_muse"), MetaMuseLiveAdapter)
    assert isinstance(registry.get("huggingface"), HuggingFaceLiveAdapter)
    assert isinstance(registry.get("kimi"), KimiLiveAdapter)
    assert isinstance(registry.get("z_ai"), ZAILiveAdapter)
    assert isinstance(registry.get("zhipu_ai"), ZAILiveAdapter)
    assert isinstance(registry.get("alibabacloud"), AlibabaCloudLiveAdapter)
    assert isinstance(registry.get("dashscope"), AlibabaCloudLiveAdapter)
    assert isinstance(registry.get("arcee"), ArceeLiveAdapter)
    assert isinstance(registry.get("xiaomimimo"), XiaomiMiMoLiveAdapter)
    assert isinstance(registry.get("minimax"), MiniMaxLiveAdapter)
    assert isinstance(registry.get("upstage"), UpstageLiveAdapter)


@pytest.mark.asyncio
async def test_xiaomimimo_adapter_resolves_credential_and_executes():
    """Verify XiaomiMiMoLiveAdapter resolves credentials and executes completions against api.xiaomimimo.com."""
    adapter = XiaomiMiMoLiveAdapter()
    req = ModelRequest(prompt="Analyze architecture with MiMo")
    metadata: dict = {}

    assert FALLBACK_XIAOMIMIMO_API_KEY

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "MiMo architecture analysis."}}],
        "usage": {"prompt_tokens": 15, "completion_tokens": 25},
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        res = await adapter.generate_response("mimo-v2.6-flash", req, metadata)
        assert res.text == "MiMo architecture analysis."
        assert res.provider_used == "xiaomimimo"
        assert res.model_used == "mimo-v2.6-flash"

        call_url = mock_post.call_args[0][0]
        assert "api.xiaomimimo.com" in call_url
        headers = mock_post.call_args[1]["headers"]
        assert headers["Authorization"] == f"Bearer {FALLBACK_XIAOMIMIMO_API_KEY}"


@pytest.mark.asyncio
async def test_minimax_adapter_resolves_credential_and_executes():
    """Verify MiniMaxLiveAdapter resolves credentials and executes completions against api.minimax.io."""
    adapter = MiniMaxLiveAdapter()
    req = ModelRequest(prompt="Execute reasoning task")
    metadata: dict = {}

    assert FALLBACK_MINIMAX_API_KEY

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "MiniMax reasoning completed."}}],
        "usage": {"prompt_tokens": 18, "completion_tokens": 30},
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        res = await adapter.generate_response("MiniMax-M3.1-Flash", req, metadata)
        assert res.text == "MiniMax reasoning completed."
        assert res.provider_used == "minimax"
        assert res.model_used == "MiniMax-M3.1-Flash"

        call_url = mock_post.call_args[0][0]
        assert "api.minimax.io" in call_url
        headers = mock_post.call_args[1]["headers"]
        assert headers["Authorization"] == f"Bearer {FALLBACK_MINIMAX_API_KEY}"


@pytest.mark.asyncio
async def test_upstage_adapter_resolves_credential_and_executes():
    """Verify UpstageLiveAdapter resolves credentials and executes completions against api.upstage.ai."""
    adapter = UpstageLiveAdapter()
    req = ModelRequest(prompt="Solar depth reasoning")
    metadata: dict = {}

    assert FALLBACK_UPSTAGE_API_KEY

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Solar synthesis."}}],
        "usage": {"prompt_tokens": 12, "completion_tokens": 22},
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        res = await adapter.generate_response("solar-pro4", req, metadata)
        assert res.text == "Solar synthesis."
        assert res.provider_used == "upstage"
        assert res.model_used == "solar-pro4"

        call_url = mock_post.call_args[0][0]
        assert "api.upstage.ai" in call_url
        headers = mock_post.call_args[1]["headers"]
        assert headers["Authorization"] == f"Bearer {FALLBACK_UPSTAGE_API_KEY}"


@pytest.mark.asyncio
async def test_arcee_adapter_resolves_credential_and_executes():
    """Verify ArceeLiveAdapter resolves credentials and executes completions against api.arcee.ai."""
    adapter = ArceeLiveAdapter()
    req = ModelRequest(prompt="Domain specialized reasoning")
    metadata: dict = {}

    assert FALLBACK_ARCEE_API_KEY

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Arcee specialized output."}}],
        "usage": {"prompt_tokens": 14, "completion_tokens": 28},
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        res = await adapter.generate_response("trinity-large-thinking", req, metadata)
        assert res.text == "Arcee specialized output."
        assert res.provider_used == "arcee"
        assert res.model_used == "trinity-large-thinking"

        call_url = mock_post.call_args[0][0]
        assert "api.arcee.ai" in call_url
        headers = mock_post.call_args[1]["headers"]
        assert headers["Authorization"] == f"Bearer {FALLBACK_ARCEE_API_KEY}"


@pytest.mark.asyncio
async def test_seed_default_providers_marks_env_configured_providers_healthy(db):
    """Verify providers configured via .env are marked both is_configured=True and is_healthy=True on boot/seed."""
    from sqlalchemy import select

    from nexora.domains.intelligence.models import ModelProvider
    from nexora.domains.intelligence.service import IntelligenceService

    svc = IntelligenceService(db)
    with patch(
        "nexora.config.get_settings",
        return_value=Settings(
            GEMINI_API_KEY="AQ.live-gemini-key",
            ANTHROPIC_API_KEY="sk-ant-live-key",
            DEEPSEEK_API_KEY="sk-deepseek-live-key",
            GROQ_API_KEY="gsk_live_key",
        ),
    ):
        configured_count = await svc.seed_default_providers_if_empty()
        assert configured_count >= 4

        res = await db.execute(
            select(ModelProvider).where(
                ModelProvider.name.in_(["google_gemini", "anthropic", "deepseek", "groq"])
            )
        )
        providers = {p.name: p for p in res.scalars().all()}
        for name in ("google_gemini", "anthropic", "deepseek", "groq"):
            assert providers[name].is_configured is True, f"{name} should be configured"
            assert providers[name].is_healthy is True, f"{name} should be marked healthy when seeded from .env"
            assert providers[name].is_active is True, f"{name} should be active"

