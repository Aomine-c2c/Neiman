"""
Intelligence Service & Repository.
Manages providers, models, routing policies, seed data, and dashboard aggregation.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.intelligence.models import (
    Model,
    ModelProvider,
    ModelRequestLog,
    ModelRoutingPolicy,
)
from nexora.domains.intelligence.router_service import IntelligenceRouter
from nexora.domains.intelligence.schemas import (
    IntelligenceDashboardResponse,
    ModelCreate,
    ModelProviderCreate,
    ModelProviderResponse,
    ModelRequest,
    ModelResponse,
    ModelResponsePayload,
    ProviderConfigureRequest,
    ProviderConfigureResponse,
    ProviderProbeRequest,
    ProviderProbeResponse,
)
from nexora.exceptions import NotFoundError

logger = logging.getLogger(__name__)


class IntelligenceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.router = IntelligenceRouter(db)

    async def seed_default_providers_if_empty(self) -> int:
        """Seed the full universal AI provider catalog if empty or missing entries."""
        from nexora.domains.intelligence.catalog import UNIVERSAL_PROVIDER_CATALOG

        result = await self.db.execute(select(ModelProvider))
        existing_providers: dict[str, ModelProvider | None] = {
            p.name: p for p in result.scalars().all() if p is not None and getattr(p, "name", None)
        }

        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        for item in UNIVERSAL_PROVIDER_CATALOG:
            name = item["name"]
            if name not in existing_providers:
                stmt = (
                    sqlite_insert(ModelProvider)
                    .values(
                        id=uuid.uuid4(),
                        name=name,
                        display_name=item["display_name"],
                        description=item.get("description"),
                        website_url=item.get("website_url"),
                        base_url=item.get("base_url"),
                        is_local=item.get("is_local", False),
                        is_configured=False,
                        is_healthy=False,
                    )
                    .on_conflict_do_nothing(index_elements=["name"])
                )
                await self.db.execute(stmt)

        res_all = await self.db.execute(select(ModelProvider))
        existing_providers = {
            p.name: p for p in res_all.scalars().all() if p is not None and getattr(p, "name", None)
        }

        from nexora.config import get_settings
        from nexora.core.crypto import encrypt_secret

        settings = get_settings()

        def configured_value(*names: str) -> str | None:
            for name in names:
                value = getattr(settings, name, None)
                if not isinstance(value, str):
                    continue
                normalized = value.strip()
                if not normalized:
                    continue
                lowered = normalized.lower()
                if any(marker in lowered for marker in ("your-api-key", "your-key", "placeholder", "replace-me", "changeme")):
                    continue
                return normalized
            return None

        ollama_host = configured_value("OLLAMA_BASE_URL", "OLLAMA_HOST")
        provider_env_configs: dict[str, dict[str, Any]] = {
            "openai": {"key": configured_value("OPENAI_API_KEY"), "base_url": configured_value("OPENAI_BASE_URL") or "https://api.openai.com/v1"},
            "anthropic": {"key": configured_value("ANTHROPIC_API_KEY"), "base_url": configured_value("ANTHROPIC_BASE_URL") or "https://api.anthropic.com/v1"},
            "google_gemini": {"key": configured_value("GEMINI_API_KEY", "GOOGLE_API_KEY"), "base_url": "https://generativelanguage.googleapis.com/v1beta"},
            "local": {"key": configured_value("OLLAMA_API_KEY"), "base_url": ollama_host, "is_local": True},
            "kilocode": {"key": configured_value("KILO_API_KEY", "KILOCODE_API_KEY"), "base_url": "https://api.kilo.ai/api/gateway"},
            "deepseek": {"key": configured_value("DEEPSEEK_API_KEY"), "base_url": "https://api.deepseek.com/v1"},
            "meta_muse": {"key": configured_value("META_API_KEY", "META_MUSE_API_KEY"), "base_url": "https://api.meta.ai/v1"},
            "ollama": {"key": configured_value("OLLAMA_API_KEY"), "base_url": "https://ollama.com/v1"},
            "groq": {"key": configured_value("GROQ_API_KEY"), "base_url": "https://api.groq.com/openai/v1"},
            "together_ai": {"key": configured_value("TOGETHER_AI_API_KEY"), "base_url": "https://api.together.xyz/v1"},
            "huggingface": {"key": configured_value("HUGGINGFACE_API_KEY", "HF_TOKEN"), "base_url": "https://router.huggingface.co/v1"},
            "kimi": {"key": configured_value("KIMI_API_KEY", "MOONSHOT_API_KEY"), "base_url": "https://api.moonshot.ai/v1"},
            "z_ai": {"key": configured_value("ZAI_API_KEY", "Z_AI_API_KEY", "ZHIPU_API_KEY", "ZHIPUAI_API_KEY"), "base_url": "https://open.bigmodel.cn/api/paas/v4"},
            "zhipu_ai": {"key": configured_value("ZHIPU_API_KEY", "ZHIPUAI_API_KEY", "ZAI_API_KEY", "Z_AI_API_KEY"), "base_url": "https://open.bigmodel.cn/api/paas/v4"},
            "alibabacloud": {"key": configured_value("ALIBABACLOUD_API_KEY", "ALIBABA_API_KEY", "DASHSCOPE_API_KEY", "QWEN_API_KEY"), "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"},
            "dashscope": {"key": configured_value("DASHSCOPE_API_KEY", "ALIBABA_API_KEY", "ALIBABACLOUD_API_KEY", "QWEN_API_KEY"), "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"},
            "poolside": {"key": configured_value("POOLSIDE_API_KEY"), "base_url": "https://inference.poolside.ai/v1"},
            "arcee": {"key": configured_value("ARCEE_API_KEY"), "base_url": "https://api.arcee.ai/api/v1"},
            "xiaomimimo": {"key": configured_value("XIAOMIMIMO_API_KEY", "MIMO_API_KEY", "XIAOMI_MIMO_API_KEY"), "base_url": "https://api.xiaomimimo.com/v1"},
            "minimax": {"key": configured_value("MINIMAX_API_KEY"), "base_url": "https://api.minimax.io/v1"},
            "upstage": {"key": configured_value("UPSTAGE_API_KEY"), "base_url": "https://api.upstage.ai/v1"},
            "xai": {"key": configured_value("XAI_API_KEY"), "base_url": "https://api.x.ai/v1"},
            "mistral": {"key": configured_value("MISTRAL_API_KEY"), "base_url": "https://api.mistral.ai/v1"},
            "cohere": {"key": configured_value("COHERE_API_KEY"), "base_url": "https://api.cohere.ai/v1"},
            "cerebras": {"key": configured_value("CEREBRAS_API_KEY"), "base_url": "https://api.cerebras.ai/v1"},
            "openrouter": {"key": configured_value("OPENROUTER_API_KEY"), "base_url": "https://openrouter.ai/api/v1"},
        }

        # Respect user explicit overrides from CLI config
        user_overrides = set()
        try:
            from nexora.neiman_cli import load_cli_config

            cli_cfg = load_cli_config()
            user_overrides = set(cli_cfg.get("provider_overrides", []))
        except Exception as exc:
            logger.warning("Provider CLI overrides could not be loaded: %s", exc)

        for prov_name, prov_cfg in provider_env_configs.items():
            prov = existing_providers.get(prov_name)
            if not prov:
                continue
            key_val = prov_cfg.get("key")
            if key_val and prov_name not in user_overrides:
                prov.api_key_encrypted = encrypt_secret(key_val)
                prov.is_configured = True
                prov.is_active = True
                if getattr(prov, "consecutive_failures", 0) == 0:
                    prov.is_healthy = True
            elif prov.api_key_encrypted:
                prov.is_configured = True
                prov.is_active = True
                if getattr(prov, "consecutive_failures", 0) == 0:
                    prov.is_healthy = True
            elif prov_cfg.get("is_local") and prov_cfg.get("base_url"):
                prov.is_configured = True
                prov.is_active = True
                if getattr(prov, "consecutive_failures", 0) == 0:
                    prov.is_healthy = True
            if prov_cfg.get("base_url"):
                prov.base_url = prov_cfg["base_url"]
            if "is_local" in prov_cfg:
                prov.is_local = prov_cfg["is_local"]

        canonical_models = [
            # ── Frontier Flagships ──
            (
                "openai",
                "gpt-4o",
                "GPT-4o",
                ["reasoning", "code_generation", "vision", "agentic", "text"],
                128000,
                2.50,
                10.00,
                450.0,
                "PUBLIC_CLOUD",
            ),
            (
                "anthropic",
                "claude-3-5-sonnet",
                "Claude 3.5 Sonnet",
                ["reasoning", "architectural_reasoning", "code_generation", "analysis", "text"],
                200000,
                3.00,
                15.00,
                620.0,
                "PUBLIC_CLOUD",
            ),
            (
                "google_gemini",
                "gemini-3.5-flash",
                "Gemini 3.5 Flash",
                ["reasoning", "large_context", "speed", "code_generation", "analysis", "text"],
                1000000,
                0.10,
                0.40,
                280.0,
                "PUBLIC_CLOUD",
            ),
            (
                "google_gemini",
                "gemini-3.1-pro-preview",
                "Gemini 3.1 Pro Preview",
                ["reasoning", "architectural_reasoning", "large_context", "multimodal", "analysis", "code_generation", "text"],
                2000000,
                1.25,
                5.00,
                380.0,
                "PUBLIC_CLOUD",
            ),
            (
                "google_gemini",
                "gemini-3.8-flash",
                "Gemini 3.8 Flash",
                ["reasoning", "large_context", "speed", "multimodal", "text"],
                1000000,
                0.15,
                0.60,
                320.0,
                "PUBLIC_CLOUD",
            ),
            (
                "google_gemini",
                "gemini-2.5-pro",
                "Gemini 2.5 Pro",
                ["reasoning", "large_context", "multimodal", "analysis", "text"],
                2000000,
                1.25,
                5.00,
                450.0,
                "PUBLIC_CLOUD",
            ),
            (
                "google_gemini",
                "gemini-1.5-pro",
                "Gemini 1.5 Pro",
                ["reasoning", "large_context", "multimodal", "analysis", "text"],
                2000000,
                1.25,
                5.00,
                380.0,
                "PUBLIC_CLOUD",
            ),
            # ── Poolside AI Agentic Coding Models ──
            (
                "poolside",
                "poolside/laguna-s-2.1",
                "Laguna S 2.1",
                ["reasoning", "architectural_reasoning", "code_generation", "agentic", "text"],
                128000,
                0.80,
                2.40,
                290.0,
                "PUBLIC_CLOUD",
            ),
            (
                "poolside",
                "poolside/laguna-xs-2.1",
                "Laguna XS 2.1",
                ["speed", "code_generation", "agentic", "text"],
                64000,
                0.20,
                0.60,
                180.0,
                "PUBLIC_CLOUD",
            ),
            # ── Meta Muse Generative Models ──
            (
                "meta_muse",
                "muse-spark-1.3",
                "Meta Muse Spark 1.3",
                ["speed", "reasoning", "text"],
                32000,
                0.20,
                0.40,
                240.0,
                "PUBLIC_CLOUD",
            ),
            (
                "meta_muse",
                "muse-wonder-1.0",
                "Meta Muse Wonder 1.0",
                ["multimodal", "creativity", "text"],
                64000,
                0.50,
                1.50,
                380.0,
                "PUBLIC_CLOUD",
            ),
            # ── Ollama Cloud Hosted Models ──
            (
                "ollama",
                "gemma4:31b-cloud",
                "Gemma 4 31B Cloud (Free)",
                ["reasoning", "speed", "text"],
                131072,
                0.0,
                0.0,
                220.0,
                "PUBLIC_CLOUD",
            ),
            (
                "ollama",
                "gpt-oss:20b",
                "GPT-OSS 20B (Free)",
                ["reasoning", "analysis", "text"],
                131072,
                0.0,
                0.0,
                240.0,
                "PUBLIC_CLOUD",
            ),
            (
                "ollama",
                "mistral-large-3:675b",
                "Mistral Large 3 675B (Ollama Cloud)",
                ["reasoning", "code_generation", "text"],
                262144,
                2.00,
                6.00,
                380.0,
                "PUBLIC_CLOUD",
            ),
            # ── Groq LPU High-Speed Cloud ──
            (
                "groq",
                "qwen/qwen3.8-27b",
                "Qwen 3.8 27B (Groq LPU)",
                ["reasoning", "speed", "text"],
                131072,
                0.80,
                4.00,
                110.0,
                "PUBLIC_CLOUD",
            ),
            (
                "groq",
                "openai/gpt-oss-20b",
                "GPT-OSS 20B (Groq LPU)",
                ["reasoning", "analysis", "speed", "text"],
                131072,
                0.08,
                0.30,
                100.0,
                "PUBLIC_CLOUD",
            ),
            (
                "groq",
                "llama-3.3-70b-versatile",
                "Llama 3.3 70B (Groq LPU)",
                ["reasoning", "code_generation", "speed", "text"],
                128000,
                0.59,
                0.79,
                140.0,
                "PUBLIC_CLOUD",
            ),
            (
                "groq",
                "llama-3.1-8b-instant",
                "Llama 3.1 8B Instant (Groq LPU)",
                ["speed", "text"],
                128000,
                0.05,
                0.08,
                90.0,
                "PUBLIC_CLOUD",
            ),
            (
                "groq",
                "mixtral-8x7b-32768",
                "Mixtral 8x7B (Groq LPU)",
                ["reasoning", "speed", "text"],
                32768,
                0.24,
                0.24,
                150.0,
                "PUBLIC_CLOUD",
            ),
            # ── OpenRouter Unified Gateway ──
            (
                "openrouter",
                "anthropic/claude-3.5-sonnet",
                "Claude 3.5 Sonnet (OpenRouter)",
                ["reasoning", "architectural_reasoning", "code_generation", "text"],
                200000,
                3.00,
                15.00,
                450.0,
                "PUBLIC_CLOUD",
            ),
            (
                "openrouter",
                "meta-llama/llama-3.3-70b-instruct",
                "Llama 3.3 70B Instruct (OpenRouter)",
                ["reasoning", "code_generation", "text"],
                128000,
                0.40,
                0.40,
                380.0,
                "PUBLIC_CLOUD",
            ),
            (
                "openrouter",
                "deepseek/deepseek-r1",
                "DeepSeek-R1 (OpenRouter)",
                ["reasoning", "code_generation", "analysis", "text"],
                64000,
                0.80,
                2.40,
                550.0,
                "PUBLIC_CLOUD",
            ),
            # ── Mistral AI ──
            (
                "mistral",
                "mistral-large-latest",
                "Mistral Large 2",
                ["reasoning", "code_generation", "analysis", "text"],
                128000,
                2.00,
                6.00,
                350.0,
                "PUBLIC_CLOUD",
            ),
            (
                "mistral",
                "codestral-latest",
                "Codestral 2501",
                ["code_generation", "speed", "text"],
                256000,
                0.30,
                0.90,
                220.0,
                "PUBLIC_CLOUD",
            ),
            (
                "mistral",
                "ministral-8b-latest",
                "Ministral 8B",
                ["speed", "edge", "text"],
                128000,
                0.10,
                0.10,
                160.0,
                "PUBLIC_CLOUD",
            ),
            # ── DeepSeek Cloud ──
            (
                "deepseek",
                "deepseek-chat",
                "DeepSeek-V3",
                ["reasoning", "code_generation", "analysis", "text"],
                64000,
                0.14,
                0.28,
                480.0,
                "PUBLIC_CLOUD",
            ),
            (
                "deepseek",
                "deepseek-reasoner",
                "DeepSeek-R1 Reasoning",
                ["reasoning", "math", "code_generation", "text"],
                64000,
                0.55,
                2.19,
                650.0,
                "PUBLIC_CLOUD",
            ),
            # ── Cerebras Inference ──
            (
                "cerebras",
                "llama-3.3-70b",
                "Llama 3.3 70B (Cerebras Wafer)",
                ["reasoning", "speed", "text"],
                128000,
                0.60,
                0.60,
                110.0,
                "PUBLIC_CLOUD",
            ),
            (
                "cerebras",
                "llama3.1-8b",
                "Llama 3.1 8B (Cerebras Wafer)",
                ["speed", "text"],
                8192,
                0.10,
                0.10,
                80.0,
                "PUBLIC_CLOUD",
            ),
            # ── Together AI ──
            (
                "together_ai",
                "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "Llama 3.3 70B Turbo (Together)",
                ["reasoning", "code_generation", "text"],
                128000,
                0.88,
                0.88,
                250.0,
                "PUBLIC_CLOUD",
            ),
            (
                "together_ai",
                "deepseek-ai/DeepSeek-R1",
                "DeepSeek-R1 (Together)",
                ["reasoning", "code_generation", "text"],
                64000,
                0.80,
                2.40,
                520.0,
                "PUBLIC_CLOUD",
            ),
            # ── Cohere Enterprise ──
            (
                "cohere",
                "command-r-plus-08-2024",
                "Cohere Command R+",
                ["reasoning", "analysis", "tool_use", "text"],
                128000,
                2.50,
                10.00,
                420.0,
                "PUBLIC_CLOUD",
            ),
            (
                "cohere",
                "command-r-08-2024",
                "Cohere Command R",
                ["reasoning", "speed", "text"],
                128000,
                0.15,
                0.60,
                260.0,
                "PUBLIC_CLOUD",
            ),
            # ── xAI Grok ──
            (
                "xai",
                "grok-2-1212",
                "xAI Grok 2",
                ["reasoning", "live_search", "analysis", "text"],
                128000,
                2.00,
                10.00,
                390.0,
                "PUBLIC_CLOUD",
            ),
            (
                "xai",
                "grok-2-vision-1212",
                "xAI Grok 2 Vision",
                ["multimodal", "vision", "reasoning", "text"],
                32768,
                2.00,
                10.00,
                420.0,
                "PUBLIC_CLOUD",
            ),
            # ── Kilo Code Universal Gateway (Default: Auto Free) ──
            (
                "kilocode",
                "kilo-auto/free",
                "Kilo Auto Free (Universal Gateway)",
                ["reasoning", "code_generation", "speed", "text"],
                1000000,
                0.0,
                0.0,
                180.0,
                "PUBLIC_CLOUD",
            ),
            (
                "kilocode",
                "autofree",
                "Kilo Auto Free (Alias)",
                ["reasoning", "code_generation", "speed", "text"],
                1000000,
                0.0,
                0.0,
                180.0,
                "PUBLIC_CLOUD",
            ),
            (
                "kilocode",
                "kilo-auto/efficient",
                "Kilo Auto Efficient",
                ["reasoning", "code_generation", "speed", "text"],
                1000000,
                0.10,
                0.40,
                220.0,
                "PUBLIC_CLOUD",
            ),
            # ── Hugging Face Inference Providers ──
            (
                "huggingface",
                "meta-llama/Llama-3.3-70B-Instruct:fastest",
                "Llama 3.3 70B (Hugging Face Router)",
                ["reasoning", "code_generation", "text"],
                128000,
                0.60,
                0.60,
                290.0,
                "PUBLIC_CLOUD",
            ),
            (
                "huggingface",
                "deepseek-ai/DeepSeek-R1:fastest",
                "DeepSeek-R1 (Hugging Face Router)",
                ["reasoning", "code_generation", "text"],
                64000,
                0.80,
                2.40,
                550.0,
                "PUBLIC_CLOUD",
            ),
            # ── Kimi Moonshot AI ──
            (
                "kimi",
                "kimi-k2.7-code",
                "Kimi K2.7 Code (Moonshot)",
                ["reasoning", "code_generation", "large_context", "multimodal", "text"],
                262144,
                1.00,
                1.00,
                380.0,
                "PUBLIC_CLOUD",
            ),
            (
                "kimi",
                "kimi-k2.6",
                "Kimi K2.6 (Moonshot)",
                ["reasoning", "large_context", "multimodal", "text"],
                262144,
                0.80,
                0.80,
                340.0,
                "PUBLIC_CLOUD",
            ),
            # ── Z.AI / Zhipu GLM ──
            (
                "z_ai",
                "glm-5",
                "GLM-5 Frontier Reasoning (Z.AI)",
                ["reasoning", "code_generation", "agentic", "multimodal", "text"],
                128000,
                1.00,
                1.00,
                350.0,
                "PUBLIC_CLOUD",
            ),
            (
                "z_ai",
                "glm-4.5",
                "GLM-4.5 Flagship (Z.AI)",
                ["reasoning", "code_generation", "multimodal", "text"],
                128000,
                0.80,
                0.80,
                320.0,
                "PUBLIC_CLOUD",
            ),
            (
                "z_ai",
                "glm-5.3-flash",
                "GLM-5.3 Flash (Z.AI)",
                ["speed_optimized", "code_generation", "text"],
                128000,
                0.10,
                0.10,
                180.0,
                "PUBLIC_CLOUD",
            ),
            (
                "zhipu_ai",
                "glm-5",
                "GLM-5 Frontier Reasoning (Zhipu)",
                ["reasoning", "code_generation", "agentic", "multimodal", "text"],
                128000,
                1.00,
                1.00,
                350.0,
                "PUBLIC_CLOUD",
            ),
            # ── Alibaba Cloud (Qwen) ──
            (
                "alibabacloud",
                "qwen3.8-flash",
                "Qwen 3.8 Flash (Alibaba)",
                ["reasoning", "speed_optimized", "code_generation", "multimodal", "text"],
                128000,
                0.20,
                0.60,
                200.0,
                "PUBLIC_CLOUD",
            ),
            (
                "alibabacloud",
                "qwen3.8-max",
                "Qwen 3.8 Max (Alibaba)",
                ["reasoning", "code_generation", "agentic", "multimodal", "text"],
                128000,
                1.60,
                6.40,
                420.0,
                "PUBLIC_CLOUD",
            ),
            (
                "alibabacloud",
                "qwen3.8-27b",
                "Qwen 3.8 27B (Alibaba)",
                ["reasoning", "code_generation", "text"],
                128000,
                0.60,
                1.80,
                260.0,
                "PUBLIC_CLOUD",
            ),
            (
                "dashscope",
                "qwen3.8-flash",
                "Qwen 3.8 Flash (DashScope)",
                ["reasoning", "speed_optimized", "code_generation", "multimodal", "text"],
                128000,
                0.20,
                0.60,
                200.0,
                "PUBLIC_CLOUD",
            ),
            (
                "dashscope",
                "qwen3.8-max",
                "Qwen 3.8 Max (DashScope)",
                ["reasoning", "code_generation", "agentic", "multimodal", "text"],
                128000,
                1.60,
                6.40,
                420.0,
                "PUBLIC_CLOUD",
            ),
            # ── Arcee AI ──
            (
                "arcee",
                "trinity-large-thinking",
                "Trinity Large Thinking",
                ["reasoning", "deep_thinking", "analysis", "text"],
                128000,
                0.50,
                1.50,
                250.0,
                "PUBLIC_CLOUD",
            ),
            # ── Xiaomi MiMo ──
            (
                "xiaomimimo",
                "mimo-v2.6-flash",
                "MiMo V2.6 Flash",
                ["reasoning", "multimodal", "fast", "code_generation", "text"],
                1000000,
                0.10,
                0.20,
                220.0,
                "PUBLIC_CLOUD",
            ),
            (
                "xiaomimimo",
                "mimo-v2.6-pro",
                "MiMo V2.6 Pro",
                ["reasoning", "multimodal", "agentic", "code_generation", "text"],
                1000000,
                0.40,
                1.20,
                310.0,
                "PUBLIC_CLOUD",
            ),
            # ── MiniMax ──
            (
                "minimax",
                "MiniMax-M3.1-Flash",
                "MiniMax M3.1 Flash",
                ["reasoning", "code_generation", "fast", "text"],
                256000,
                0.25,
                1.00,
                210.0,
                "PUBLIC_CLOUD",
            ),
            # ── Upstage (Solar) ──
            (
                "upstage",
                "solar-pro4",
                "Solar Pro 4",
                ["reasoning", "analysis", "code_generation", "text"],
                128000,
                0.30,
                1.00,
                230.0,
                "PUBLIC_CLOUD",
            ),
            # ── Local Air-Gapped ──
            (
                "local",
                "local-deepseek-r1",
                "DeepSeek-R1 Local",
                ["reasoning", "code_generation", "privacy", "text"],
                64000,
                0.0,
                0.0,
                750.0,
                "ON_PREMISE_ZERO_RETENTION",
            ),
        ]
        try:
            for (
                p_name,
                m_ident,
                disp,
                caps,
                ctx,
                in_c,
                out_c,
                lat,
                priv,
            ) in canonical_models:
                prov = existing_providers.get(p_name)
                if prov:
                    check_m = await self.db.execute(
                        select(Model).where(
                            Model.provider_id == prov.id,
                            Model.model_identifier == m_ident,
                        )
                    )
                    if not check_m.scalars().first():
                        self.db.add(
                            Model(
                                provider_id=prov.id,
                                model_identifier=m_ident,
                                display_name=disp,
                                capabilities=caps,
                                context_capacity=ctx,
                                input_cost_per_million=in_c,
                                output_cost_per_million=out_c,
                                avg_latency_ms=lat,
                                privacy_classification=priv,
                            )
                        )
            await self.db.flush()
        except Exception as exc:
            logger.warning("Provider model catalog seeding flush notice: %s", exc)

        return sum(
            1
            for p in existing_providers.values()
            if p is not None and getattr(p, "is_configured", False)
        )

    # ── Providers & Models CRUD ────────────────────────────────────────────────

    async def list_providers(self) -> list[ModelProviderResponse]:
        await self.seed_default_providers_if_empty()
        from nexora.core.crypto import decrypt_secret, mask_secret

        result = await self.db.execute(
            select(ModelProvider)
            .where(ModelProvider.is_active.is_(True))
            .order_by(ModelProvider.display_name)
        )
        providers = list(result.scalars().all())

        responses = []
        for p in providers:
            if not p:
                continue
            plain_key = (
                decrypt_secret(p.api_key_encrypted)
                if getattr(p, "api_key_encrypted", None)
                else None
            )
            masked = mask_secret(plain_key)
            responses.append(
                ModelProviderResponse(
                    id=p.id,
                    name=p.name,
                    display_name=p.display_name,
                    description=p.description,
                    website_url=p.website_url,
                    base_url=p.base_url,
                    is_configured=p.is_configured,
                    api_key_masked=masked,
                    is_active=p.is_active,
                    is_local=p.is_local,
                    is_healthy=p.is_healthy,
                    consecutive_failures=p.consecutive_failures,
                    last_health_check_at=p.last_health_check_at,
                    created_at=p.created_at,
                )
            )
        return responses

    async def list_models(self) -> list[Model]:
        await self.seed_default_providers_if_empty()
        result = await self.db.execute(select(Model).where(Model.is_active.is_(True)))
        return list(result.scalars().all())

    async def add_provider(self, data: ModelProviderCreate) -> ModelProvider:
        from nexora.core.crypto import encrypt_secret
        from nexora.core.security import ToolSandbox

        base_url = data.base_url
        if base_url:
            # Guard the endpoint before it can receive a credential (SSRF).
            base_url = await ToolSandbox.validate_provider_endpoint_async(
                base_url,
                allow_loopback=bool(data.is_local),
                allow_private=bool(data.is_local),
            )

        enc_key = encrypt_secret(data.api_key) if data.api_key else None
        p = ModelProvider(
            name=data.name,
            display_name=data.display_name,
            description=data.description,
            website_url=data.website_url,
            base_url=base_url,
            api_key_encrypted=enc_key,
            is_configured=bool(data.api_key or (base_url and data.is_local)),
            is_local=data.is_local,
            is_healthy=bool(data.api_key or data.is_local),
        )
        self.db.add(p)
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def configure_provider(
        self,
        provider_name: str,
        config: ProviderConfigureRequest,
        company_id: uuid.UUID | None = None,
    ) -> ProviderConfigureResponse:
        """
        Configure a provider's API key and/or base URL in the encrypted vault,
        and optionally auto-discover available models.
        """
        from nexora.core.crypto import encrypt_secret, mask_secret
        from nexora.domains.intelligence.discovery import fetch_provider_models
        from nexora.domains.intelligence.schemas import ProviderConfigureResponse

        await self.seed_default_providers_if_empty()
        result = await self.db.execute(
            select(ModelProvider).where(ModelProvider.name == provider_name)
        )
        provider = result.scalars().first()
        if not provider:
            raise NotFoundError(f"Provider '{provider_name}' not found.")

        # Update base URL if provided
        if config.base_url is not None:
            candidate = config.base_url.strip() or None
            if candidate:
                # The endpoint receives the provider's decrypted API key and the
                # user's prompt, so it is validated against the egress policy
                # before it is persisted (SSRF / credential-exfiltration guard).
                from nexora.core.security import ToolSandbox

                candidate = await ToolSandbox.validate_provider_endpoint_async(
                    candidate,
                    allow_loopback=bool(provider.is_local),
                    allow_private=bool(provider.is_local),
                )
            provider.base_url = candidate

        # Update API key if provided
        plain_key = None
        if config.api_key is not None:
            plain_key = config.api_key.strip() or None
            provider.api_key_encrypted = encrypt_secret(plain_key)

        provider.is_configured = bool(
            provider.api_key_encrypted or (provider.base_url and provider.is_local)
        )
        provider.is_healthy = provider.is_configured
        provider.consecutive_failures = 0
        await self.db.flush()

        discovered_count = 0
        discovered_model_ids: list[str] = []

        if config.auto_discover and (plain_key or provider.base_url):
            discovered = await fetch_provider_models(
                provider_name=provider.name,
                base_url=provider.base_url,
                api_key=plain_key,
                allow_private=bool(provider.is_local),
            )
            # Upsert discovered models
            for item in discovered:
                m_ident = item["model_identifier"]
                discovered_model_ids.append(m_ident)
                q_existing = await self.db.execute(
                    select(Model).where(
                        Model.provider_id == provider.id,
                        Model.model_identifier == m_ident,
                    )
                )
                m = q_existing.scalars().first()
                if not m:
                    m = Model(
                        provider_id=provider.id,
                        model_identifier=m_ident,
                        display_name=item["display_name"],
                        capabilities=item["capabilities"],
                        context_capacity=item["context_capacity"],
                        input_cost_per_million=item["input_cost_per_million"],
                        output_cost_per_million=item["output_cost_per_million"],
                        privacy_classification=item["privacy_classification"],
                    )
                    self.db.add(m)
                discovered_count += 1

            await self.db.flush()

        # Update dynamic adapter in registry for non-frontier providers
        if provider.name not in {"openai", "anthropic", "google_gemini", "local"}:
            from nexora.domains.intelligence.adapters.base import GenericOpenAICompatibleAdapter

            self.router.registry.register(
                GenericOpenAICompatibleAdapter(provider_name=provider.name, base_url=provider.base_url)
            )

        # Update company routing policy if company_id is provided and set_as_primary is requested
        if company_id and getattr(config, "set_as_primary", True):
            policy = await self.get_policy(company_id)
            q_m = select(Model).where(Model.provider_id == provider.id, Model.is_active.is_(True))
            p_models = (await self.db.execute(q_m)).scalars().all()
            p_model_ids = [m.model_identifier for m in p_models]
            if p_model_ids:
                existing_chain = [m for m in (policy.fallback_chain or []) if m not in p_model_ids]
                policy.fallback_chain = p_model_ids[:2] + existing_chain
                new_prefs = dict(policy.capability_preferences or {})
                for cap in ["reasoning", "code_generation", "text", "analysis"]:
                    new_prefs[cap] = p_model_ids[0]
                policy.capability_preferences = new_prefs
                await self.db.flush()

        if company_id:
            await self.auto_bind_discovered_models_to_company(company_id)

        return ProviderConfigureResponse(
            provider_name=provider.name,
            display_name=provider.display_name,
            is_configured=provider.is_configured,
            is_healthy=provider.is_healthy,
            base_url=provider.base_url,
            api_key_masked=mask_secret(plain_key),
            discovered_models_count=discovered_count,
            models=discovered_model_ids[:20],
            message=f"Provider '{provider.display_name}' configured successfully. Discovered {discovered_count} models.",
        )

    async def sync_configured_providers_models(self) -> dict[str, Any]:
        """
        Periodically checks all configured AI providers using their stored decrypted API keys / base URLs.
        Dynamically queries provider model endpoints, creates/updates active models, and soft-deactivates
        models no longer returned by the API key (setting is_active=False).
        Guarantees no hardcoded model names are required for active model rotation.
        """
        from datetime import datetime

        from nexora.core.crypto import decrypt_secret
        from nexora.domains.intelligence.discovery import fetch_provider_models

        await self.seed_default_providers_if_empty()
        result = await self.db.execute(
            select(ModelProvider).where(
                ModelProvider.is_active.is_(True),
                ModelProvider.is_configured.is_(True),
            )
        )
        configured_providers = list(result.scalars().all())

        sync_summary: dict[str, Any] = {
            "total_providers_checked": len(configured_providers),
            "synced_providers": [],
            "total_models_active": 0,
            "total_models_soft_deactivated": 0,
            "total_models_added": 0,
        }

        for provider in configured_providers:
            plain_key = None
            if provider.api_key_encrypted:
                plain_key = decrypt_secret(provider.api_key_encrypted)

            if not plain_key and not provider.base_url:
                continue

            discovered = await fetch_provider_models(
                provider_name=provider.name,
                base_url=provider.base_url,
                api_key=plain_key,
                allow_private=bool(provider.is_local),
            )

            # Query existing models for this provider
            q_existing = await self.db.execute(
                select(Model).where(Model.provider_id == provider.id)
            )
            existing_models = {m.model_identifier: m for m in q_existing.scalars().all()}

            discovered_identifiers = set()
            added_for_prov = 0
            deactivated_for_prov = 0

            for item in discovered:
                m_ident = item["model_identifier"]
                discovered_identifiers.add(m_ident)
                if m_ident in existing_models:
                    m = existing_models[m_ident]
                    m.is_active = True
                    m.display_name = item.get("display_name", m.display_name)
                    m.capabilities = item.get("capabilities", m.capabilities)
                    m.context_capacity = item.get("context_capacity", m.context_capacity)
                else:
                    m = Model(
                        provider_id=provider.id,
                        model_identifier=m_ident,
                        display_name=item["display_name"],
                        capabilities=item["capabilities"],
                        context_capacity=item["context_capacity"],
                        input_cost_per_million=item["input_cost_per_million"],
                        output_cost_per_million=item["output_cost_per_million"],
                        privacy_classification=item["privacy_classification"],
                        is_active=True,
                    )
                    self.db.add(m)
                    existing_models[m_ident] = m
                    added_for_prov += 1

            # Soft-deactivate models no longer returned by the provider API key (only if discovery succeeded)
            if discovered:
                for m_ident, m in existing_models.items():
                    if m_ident not in discovered_identifiers and m.is_active:
                        m.is_active = False
                        deactivated_for_prov += 1

            provider.last_health_check_at = datetime.now(UTC)
            provider.is_healthy = True
            provider.consecutive_failures = 0

            active_count = sum(1 for m in existing_models.values() if m.is_active)
            sync_summary["synced_providers"].append({
                "provider_name": provider.name,
                "display_name": provider.display_name,
                "discovered_count": len(discovered),
                "added_count": added_for_prov,
                "deactivated_count": deactivated_for_prov,
                "active_models_count": active_count,
            })
            sync_summary["total_models_added"] += added_for_prov
            sync_summary["total_models_soft_deactivated"] += deactivated_for_prov
            sync_summary["total_models_active"] += active_count

        # Run dynamic seeding pass for all companies to auto-bind discovered models to agents and routing chains
        from nexora.domains.organizations.models import Company

        q_comps = select(Company.id)
        comp_ids = list((await self.db.execute(q_comps)).scalars().all())
        total_bound = 0
        for c_id in comp_ids:
            bind_res = await self.auto_bind_discovered_models_to_company(c_id)
            total_bound += bind_res.get("bound_agents", 0)

        sync_summary["total_agents_auto_bound"] = total_bound

        await self.db.flush()
        return sync_summary

    async def auto_bind_discovered_models_to_company(
        self,
        company_id: uuid.UUID,
    ) -> dict[str, Any]:
        """
        Dynamic seeding pass: auto-populates agent model assignments and routing chains
        from configured API keys' discovered models without hardcoding names.
        Prioritizes working agents across matching complexity tiers (FRONTIER, BALANCED, FAST).
        """
        from nexora.domains.agents.models import Agent
        from nexora.domains.intelligence.rotation import (
            ModelComplexityTier,
            classify_model_tier,
            resolve_task_complexity,
        )

        # 1. Fetch all active models from configured, healthy providers
        q = (
            select(Model)
            .join(ModelProvider, Model.provider_id == ModelProvider.id)
            .where(
                Model.is_active.is_(True),
                ModelProvider.is_active.is_(True),
                ModelProvider.is_configured.is_(True),
            )
        )
        res = await self.db.execute(q)
        active_models = list(res.scalars().all())
        if not active_models:
            return {"status": "no_active_models", "bound_agents": 0}

        tier_buckets: dict[ModelComplexityTier, list[Model]] = {
            ModelComplexityTier.FRONTIER: [],
            ModelComplexityTier.BALANCED: [],
            ModelComplexityTier.FAST: [],
        }
        for m in active_models:
            tier_buckets[classify_model_tier(m.model_identifier)].append(m)

        # 2. Update company routing policy
        policy = await self.get_policy(company_id)
        # Fallback chain: Frontier -> Balanced -> Fast
        chain = []
        for tier in [ModelComplexityTier.FRONTIER, ModelComplexityTier.BALANCED, ModelComplexityTier.FAST]:
            for m in tier_buckets[tier]:
                if m.model_identifier not in chain:
                    chain.append(m.model_identifier)
        if chain:
            policy.fallback_chain = chain[:15]

        # Capability preferences
        pref_frontier = tier_buckets[ModelComplexityTier.FRONTIER][0].model_identifier if tier_buckets[ModelComplexityTier.FRONTIER] else chain[0]
        pref_balanced = tier_buckets[ModelComplexityTier.BALANCED][0].model_identifier if tier_buckets[ModelComplexityTier.BALANCED] else pref_frontier
        pref_fast = tier_buckets[ModelComplexityTier.FAST][0].model_identifier if tier_buckets[ModelComplexityTier.FAST] else pref_balanced

        policy.capability_preferences = {
            "reasoning": pref_frontier,
            "architectural_reasoning": pref_frontier,
            "code_generation": pref_balanced,
            "speed": pref_fast,
            "agentic": pref_frontier,
            "text": pref_balanced,
            "analysis": pref_frontier,
        }

        # 3. Query existing agents in company and auto-bind discovered models matching their role tier
        q_agents = select(Agent).where(Agent.company_id == company_id)
        res_agents = await self.db.execute(q_agents)
        agents = list(res_agents.scalars().all())

        # Sort agents so working/active agents are processed first (working agent priority)
        def agent_priority(a: Agent) -> int:
            st = str(getattr(a.status, "value", a.status) or "").upper()
            return 0 if st in ("WORKING", "RUNNING", "ACTIVE", "BUSY") else 1

        agents.sort(key=agent_priority)
        active_model_idents = {m.model_identifier for m in active_models}
        bound_count = 0
        for agent in agents:
            req_tier = resolve_task_complexity(agent=agent)
            candidates = tier_buckets[req_tier] or active_models
            chosen_model = candidates[0].model_identifier

            intel = dict(agent.intelligence_config or {})
            curr_model = intel.get("model")
            if not curr_model or curr_model not in active_model_idents:
                intel["model"] = chosen_model
                agent.intelligence_config = intel
                bound_count += 1

        await self.db.flush()
        return {
            "status": "ok",
            "fallback_chain": policy.fallback_chain,
            "bound_agents": bound_count,
            "active_models_count": len(active_models),
        }

    async def add_model(self, data: ModelCreate) -> Model:
        provider = await self.db.get(ModelProvider, data.provider_id)
        if not provider:
            raise NotFoundError(f"Provider {data.provider_id} not found.")
        m = Model(**data.model_dump())
        self.db.add(m)
        await self.db.flush()
        await self.db.refresh(m)
        return m

    # ── Policy Management ──────────────────────────────────────────────────────

    async def get_policy(self, company_id: uuid.UUID):
        return await self.router.get_or_create_default_policy(company_id)

    async def update_policy(self, company_id: uuid.UUID, data) -> ModelRoutingPolicy:
        policy = await self.router.get_or_create_default_policy(company_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(policy, key, value)
        await self.db.flush()
        await self.db.refresh(policy)
        return policy

    # ── Routing Execution ──────────────────────────────────────────────────────

    async def execute_request(
        self,
        company_id: uuid.UUID,
        request: ModelRequest,
        agent_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
    ) -> ModelResponsePayload:
        await self.seed_default_providers_if_empty()
        return await self.router.route_and_execute(
            company_id=company_id,
            request=request,
            agent_id=agent_id,
            task_id=task_id,
        )

    # ── Dashboard & Analytics ──────────────────────────────────────────────────

    async def get_dashboard(self, company_id: uuid.UUID) -> IntelligenceDashboardResponse:
        await self.seed_default_providers_if_empty()
        providers = await self.list_providers()
        models = await self.list_models()

        import sqlalchemy as sa

        # Telemetry aggregations
        q_stats = select(
            func.count(ModelRequestLog.id),
            func.coalesce(func.sum(ModelRequestLog.total_tokens), 0),
            func.coalesce(func.sum(ModelRequestLog.estimated_cost_usd), 0.0),
            func.coalesce(func.avg(ModelRequestLog.latency_ms), 0.0),
            func.coalesce(func.avg(sa.cast(ModelRequestLog.success, sa.Integer)), 1.0),
        ).where(ModelRequestLog.company_id == company_id)
        stats_res = await self.db.execute(q_stats)
        row = stats_res.one()

        # Recent routing decisions
        q_logs = (
            select(ModelRequestLog)
            .where(ModelRequestLog.company_id == company_id)
            .order_by(desc(ModelRequestLog.created_at))
            .limit(10)
        )
        logs_res = await self.db.execute(q_logs)
        recent_logs = [
            {
                "id": str(log_entry.id),
                "requested_capability": log_entry.requested_capability,
                "provider": log_entry.selected_provider_name,
                "model": log_entry.selected_model_identifier,
                "cost_usd": log_entry.estimated_cost_usd,
                "latency_ms": log_entry.latency_ms,
                "routed_tier": getattr(log_entry, "routed_tier", "PRIMARY"),
                "fallback": log_entry.routed_via_fallback,
                "fallback_reason": log_entry.fallback_reason,
                "attempts_count": getattr(log_entry, "attempts_count", 1),
                "routing_trace": getattr(log_entry, "routing_trace", []),
                "circuit_breaker_status": getattr(log_entry, "circuit_breaker_status", "CLOSED"),
                "success": log_entry.success,
                "created_at": log_entry.created_at.isoformat(),
            }
            for log_entry in logs_res.scalars().all()
        ]

        healthy_count = sum(1 for p in providers if p.is_healthy)

        # Resolve current active provider and model
        policy = await self.get_policy(company_id)
        active_prov_name = None
        active_model_name = None
        active_prov_display = None

        # 1. Check policy fallback chain top model against configured providers
        if policy and policy.fallback_chain:
            for top_model_id in policy.fallback_chain:
                m_match = next((m for m in models if m.model_identifier == top_model_id), None)
                if m_match:
                    p_match = next((p for p in providers if p.id == m_match.provider_id), None)
                    if p_match and p_match.is_configured:
                        active_prov_name = p_match.name
                        active_model_name = m_match.model_identifier
                        active_prov_display = p_match.display_name
                        break

        # 2. If not found, check capability preferences
        if not active_prov_name and policy and policy.capability_preferences:
            for cap_model_id in policy.capability_preferences.values():
                m_match = next((m for m in models if m.model_identifier == cap_model_id), None)
                if m_match:
                    p_match = next((p for p in providers if p.id == m_match.provider_id), None)
                    if p_match and p_match.is_configured and p_match.is_healthy:
                        active_prov_name = p_match.name
                        active_model_name = m_match.model_identifier
                        active_prov_display = p_match.display_name
                        break

        # 3. Prioritize Google Gemini 3.8 Flash as default swarm engine when configured and no policy preference matched
        if not active_prov_name:
            gemini_prov = next((p for p in providers if p.name == "google_gemini" and p.is_configured), None)
            if gemini_prov:
                gemini_model = next((m for m in models if m.provider_id == gemini_prov.id and m.model_identifier == "gemini-3.8-flash"), None)
                if not gemini_model:
                    gemini_model = next((m for m in models if m.provider_id == gemini_prov.id), None)
                if gemini_model:
                    active_prov_name = gemini_prov.name
                    active_model_name = gemini_model.model_identifier
                    active_prov_display = gemini_prov.display_name

        # 3. If not found, find first configured and healthy provider
        if not active_prov_name:
            configured_provs = [p for p in providers if p.is_configured]
            if configured_provs:
                top_p = configured_provs[0]
                m_match = next((m for m in models if m.provider_id == top_p.id), None)
                active_prov_name = top_p.name
                active_model_name = m_match.model_identifier if m_match else f"{top_p.name}-default"
                active_prov_display = top_p.display_name

        from nexora.domains.intelligence.rotation import ModelDepletionTracker
        depleted_status = ModelDepletionTracker.get_depleted_models_status()

        return IntelligenceDashboardResponse(
            total_requests=row[0],
            total_tokens_consumed=int(row[1]),
            total_spend_usd=float(row[2]),
            avg_latency_ms=float(row[3]),
            overall_success_rate=float(row[4]),
            providers_count=len(providers),
            models_count=len(models),
            healthy_providers_count=healthy_count,
            active_provider=active_prov_name,
            active_model=active_model_name,
            active_provider_display=active_prov_display,
            fallback_chain=list(policy.fallback_chain or []) if policy else [],
            recent_routing_decisions=recent_logs,
            available_providers=[ModelProviderResponse.model_validate(p) for p in providers],
            available_models=[ModelResponse.model_validate(m) for m in models],
            depleted_models=depleted_status,
        )

    # ── Live Health & Latency Probing ──────────────────────────────────────────

    async def probe_provider(
        self,
        provider_name: str,
        probe_req: ProviderProbeRequest,
    ) -> ProviderProbeResponse:
        """
        Actively probes an AI vendor adapter to measure real-time latency,
        verify circuit breaker state, and optionally test fault tolerance via error injection.
        """
        await self.seed_default_providers_if_empty()
        import time
        from datetime import datetime

        # Find provider in database
        q = select(ModelProvider).where(ModelProvider.name == provider_name)
        res = await self.db.execute(q)
        provider = res.scalar_one_or_none()
        if not provider:
            raise NotFoundError(f"Provider '{provider_name}' not found.")

        adapter = self.router.registry.get(provider.name)
        if not adapter:
            raise NotFoundError(f"No active adapter registered for provider '{provider_name}'.")

        # Fast-fail check if circuit breaker is already OPEN. `try_acquire` is atomic
        # so that concurrent probes cannot all be admitted while the breaker is
        # recovering.
        if not adapter.circuit_breaker.try_acquire():
            return ProviderProbeResponse(
                provider=provider.name,
                display_name=provider.display_name,
                is_healthy=False,
                latency_ms=0.0,
                circuit_breaker_status=adapter.circuit_breaker.state.value,
                consecutive_failures=provider.consecutive_failures,
                message=f"Fast-failed: Circuit breaker is {adapter.circuit_breaker.state.value} due to consecutive failures.",
                timestamp=datetime.now(UTC),
            )

        start_time = time.perf_counter()

        # Handle chaos / error simulation
        if probe_req.simulate_error:
            adapter.circuit_breaker.record_failure()
            provider.consecutive_failures += 1
            if provider.consecutive_failures >= adapter.circuit_breaker.failure_threshold:
                provider.is_healthy = False
            await self.db.flush()

            sim_latency = round((time.perf_counter() - start_time) * 1000 + 45.0, 2)
            err_type = probe_req.simulate_error.lower()
            return ProviderProbeResponse(
                provider=provider.name,
                display_name=provider.display_name,
                is_healthy=provider.is_healthy,
                latency_ms=sim_latency,
                circuit_breaker_status=adapter.circuit_breaker.state.value,
                consecutive_failures=provider.consecutive_failures,
                message=f"Simulated {err_type.upper()} fault recorded. Failure count: {provider.consecutive_failures}/{adapter.circuit_breaker.failure_threshold}",
                timestamp=datetime.now(UTC),
            )

        try:
            # Dispatch lightweight ping request
            test_req = ModelRequest(
                prompt="Ping healthcheck",
                context_tokens_needed=10,
                timeout_seconds=probe_req.timeout_seconds,
            )
            # Find default model for provider
            q_m = select(Model).where(Model.provider_id == provider.id, Model.is_active.is_(True))
            res_m = await self.db.execute(q_m)
            model = res_m.scalars().first()
            model_id = model.model_identifier if model else f"{provider.name}-default"

            from nexora.core.crypto import decrypt_secret

            plain_key = (
                decrypt_secret(provider.api_key_encrypted)
                if getattr(provider, "api_key_encrypted", None)
                else None
            )
            meta = {
                "api_key": plain_key,
                "base_url": provider.base_url,
                "is_local": bool(provider.is_local),
            }

            await adapter.generate_response(model_id, test_req, meta)

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Record success on circuit breaker & database
            adapter.circuit_breaker.record_success()
            provider.consecutive_failures = 0
            provider.is_healthy = True
            await self.db.flush()

            return ProviderProbeResponse(
                provider=provider.name,
                display_name=provider.display_name,
                is_healthy=True,
                latency_ms=latency_ms,
                circuit_breaker_status=adapter.circuit_breaker.state.value,
                consecutive_failures=0,
                message=f"Probe successful ({latency_ms}ms). Provider is online and healthy.",
                timestamp=datetime.now(UTC),
            )

        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            adapter.circuit_breaker.record_failure()
            provider.consecutive_failures += 1
            if provider.consecutive_failures >= adapter.circuit_breaker.failure_threshold:
                provider.is_healthy = False
            await self.db.flush()

            return ProviderProbeResponse(
                provider=provider.name,
                display_name=provider.display_name,
                is_healthy=provider.is_healthy,
                latency_ms=latency_ms,
                circuit_breaker_status=adapter.circuit_breaker.state.value,
                consecutive_failures=provider.consecutive_failures,
                message=f"Probe failed: {str(e)}",
                timestamp=datetime.now(UTC),
            )
        finally:
            # Never leave the HALF_OPEN probe slot held by a finished probe.
            adapter.circuit_breaker.release_probe()
