"""
Auto-discovery helper for AI Providers.
Queries provider /v1/models or vendor-specific endpoints with credentials and maps them to NEIMAN Model specifications.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def fetch_provider_models(
    provider_name: str,
    base_url: str | None,
    api_key: str | None,
    timeout_seconds: float = 10.0,
    allow_private: bool = False,
) -> list[dict[str, Any]]:
    """
    Query the provider's models endpoint and normalize into Model definitions.
    Supports OpenAI, OpenRouter, Groq, Mistral, Ollama, DeepSeek, Cerebras, Together, vLLM, etc.

    The endpoint is tenant-configurable and this call carries the provider's API key,
    so the URL is validated against the egress policy before it is contacted.
    """
    headers: dict[str, str] = {}
    if api_key:
        if provider_name == "anthropic":
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"
        elif provider_name in ("gemini", "google", "google_gemini"):
            headers["x-goog-api-key"] = api_key
        else:
            headers["Authorization"] = f"Bearer {api_key}"

    # Determine endpoint URL
    target_url = None
    clean_base = base_url.rstrip("/") if base_url else ""

    if clean_base:
        from nexora.core.security import ToolSandbox

        try:
            await ToolSandbox.validate_provider_endpoint_async(
                clean_base,
                allow_loopback=allow_private,
                allow_private=allow_private,
            )
        except Exception as exc:
            logger.warning("Rejected provider discovery endpoint for %s: %s", provider_name, exc)
            return []

    if provider_name == "ollama" or (clean_base and ":11434" in clean_base):
        # Ollama /api/tags
        url = f"{clean_base or 'http://localhost:11434'}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    models = []
                    for item in data.get("models", []):
                        m_id = item.get("name") or item.get("model")
                        if not m_id:
                            continue
                        models.append(
                            {
                                "model_identifier": m_id,
                                "display_name": f"{m_id.title()}",
                                "capabilities": ["reasoning", "code_generation", "privacy", "text"],
                                "context_capacity": 64000,
                                "input_cost_per_million": 0.0,
                                "output_cost_per_million": 0.0,
                                "privacy_classification": "ON_PREMISE_ZERO_RETENTION",
                            }
                        )
                    return models
        except Exception as e:
            logger.warning("Ollama discovery failed: %s", e)
            return []

    # Standard OpenAI-compatible /v1/models endpoints
    if clean_base:
        if clean_base.endswith("/models"):
            target_url = clean_base
        elif clean_base.endswith("/v1"):
            target_url = f"{clean_base}/models"
        elif clean_base.endswith("/v2") and provider_name == "cohere":
            target_url = f"{clean_base}/models"
        else:
            target_url = f"{clean_base}/v1/models"
    else:
        # Default known cloud endpoints
        known_endpoints = {
            "openai": "https://api.openai.com/v1/models",
            "openrouter": "https://openrouter.ai/api/v1/models",
            "anthropic": "https://api.anthropic.com/v1/models",
            "google_gemini": "https://generativelanguage.googleapis.com/v1beta/models",
            "gemini": "https://generativelanguage.googleapis.com/v1beta/models",
            "groq": "https://api.groq.com/openai/v1/models",
            "deepseek": "https://api.deepseek.com/v1/models",
            "mistral": "https://api.mistral.ai/v1/models",
            "together_ai": "https://api.together.xyz/v1/models",
            "cerebras": "https://api.cerebras.ai/v1/models",
            "fireworks": "https://api.fireworks.ai/inference/v1/models",
            "deepinfra": "https://api.deepinfra.com/v1/models",
            "xai": "https://api.x.ai/v1/models",
            "perplexity": "https://api.perplexity.ai/models",
            "cohere": "https://api.cohere.com/v2/models",
        }
        target_url = known_endpoints.get(provider_name)

    if not target_url:
        return []

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.get(target_url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                raw_list = (
                    data.get("data")
                    if isinstance(data, dict) and "data" in data
                    else data.get("models")
                    if isinstance(data, dict)
                    else data
                )
                if not isinstance(raw_list, list):
                    return []

                discovered: list[dict[str, Any]] = []
                for item in raw_list:
                    if isinstance(item, dict):
                        m_id = item.get("id") or item.get("name")
                    elif isinstance(item, str):
                        m_id = item
                    else:
                        continue

                    if not m_id:
                        continue

                    m_id_str = str(m_id)
                    if m_id_str.startswith("models/"):
                        m_id_str = m_id_str[len("models/"):]

                    # Filter out non-LLM / embedding / whisper items if desired, but keep generative models
                    m_lower = m_id_str.lower()
                    if any(
                        x in m_lower
                        for x in ["embedding", "tts", "dall-e", "whisper", "bge", "moderation"]
                    ):
                        continue

                    caps = ["text", "reasoning"]
                    if any(x in m_lower for x in ["code", "coder", "qwen", "deepseek", "sonnet"]):
                        caps.append("code_generation")
                    if any(x in m_lower for x in ["vision", "vl", "omni", "4o"]):
                        caps.append("vision")

                    context = 128000
                    if any(x in m_lower for x in ["1m", "2m", "gemini-1.5"]):
                        context = 1000000
                    elif any(x in m_lower for x in ["200k", "claude"]):
                        context = 200000

                    discovered.append(
                        {
                            "model_identifier": m_id_str,
                            "display_name": m_id_str,
                            "capabilities": caps,
                            "context_capacity": context,
                            "input_cost_per_million": 1.0,
                            "output_cost_per_million": 3.0,
                            "privacy_classification": "PUBLIC_CLOUD",
                        }
                    )

                return discovered
    except Exception as e:
        logger.warning("Model discovery failed for %s at %s: %s", provider_name, target_url, e)
        return []

    return []
