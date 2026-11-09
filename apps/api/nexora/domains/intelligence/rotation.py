"""
NEIMAN Autonomous Organization OS — Adaptive Model Complexity & Rotation Engine
Guarantees agents do not have fixed models. Models rotate dynamically based on:
1. Working agent priority (working agents get priority dispatch across healthy fleet)
2. Task & domain complexity (Frontier Reasoning vs Balanced Coding vs Fast Throughput)
3. Provider load balancing & rate-limit evasion via circular rotation
"""

import threading
import time
import uuid
from enum import StrEnum
from typing import Any


class ModelDepletionTracker:
    """
    Thread-safe tracker for depleted models (429/402 quota exhaustion)
    and dead providers/keys (401/403 authentication failures).
    Guarantees:
    - Depleted models on an API key are exhausted before advancing to the next key.
    - 401/403 errors mark the entire provider/key dead, bypassing all its models.
    - Automatic cooldown expiry restores models when limits reset.
    """

    _lock = threading.Lock()
    _depleted_models: dict[str, float] = {}
    _dead_providers: dict[str, float] = {}

    FIVE_HOURS_COOLDOWN = 18000.0  # 5 hours token regeneration cycle

    @classmethod
    def record_depleted_model(cls, model_identifier: str, cooldown_seconds: float = FIVE_HOURS_COOLDOWN) -> None:
        """Mark a specific model as quota-exhausted or rate-limited with a 5-hour regeneration cooldown."""
        if not model_identifier:
            return
        key = str(model_identifier).strip().lower()
        with cls._lock:
            cls._depleted_models[key] = time.time() + cooldown_seconds

    @classmethod
    def is_model_depleted(cls, model_identifier: str) -> bool:
        """Check if a model is currently in quota exhaustion cooldown."""
        if not model_identifier:
            return False
        key = str(model_identifier).strip().lower()
        with cls._lock:
            expiry = cls._depleted_models.get(key)
            if expiry is None:
                return False
            if time.time() >= expiry:
                cls._depleted_models.pop(key, None)
                return False
            return True

    @classmethod
    def restore_model(cls, model_identifier: str) -> None:
        """Manually or proactively restore a depleted model once tokens regenerate."""
        if not model_identifier:
            return
        key = str(model_identifier).strip().lower()
        with cls._lock:
            cls._depleted_models.pop(key, None)

    @classmethod
    def get_depleted_models_status(cls) -> list[dict[str, Any]]:
        """Return active depleted models and remaining countdown seconds for UI and telemetry."""
        now = time.time()
        results: list[dict[str, Any]] = []
        with cls._lock:
            expired_keys = []
            for ident, expiry in cls._depleted_models.items():
                rem = expiry - now
                if rem <= 0:
                    expired_keys.append(ident)
                else:
                    results.append({
                        "model_identifier": ident,
                        "remaining_seconds": int(rem),
                        "depleted_until_timestamp": expiry,
                        "cooldown_duration_seconds": int(cls.FIVE_HOURS_COOLDOWN),
                    })
            for k in expired_keys:
                cls._depleted_models.pop(k, None)
        return results

    @classmethod
    def record_dead_provider(cls, provider_name: str, cooldown_seconds: float = 300.0) -> None:
        """Mark an entire API key / provider dead due to 401/403 authentication failure."""
        if not provider_name:
            return
        key = str(provider_name).strip().lower()
        with cls._lock:
            cls._dead_providers[key] = time.time() + cooldown_seconds

    @classmethod
    def is_provider_dead(cls, provider_name: str) -> bool:
        """Check if a provider/key is currently marked dead due to auth failure."""
        if not provider_name:
            return False
        key = str(provider_name).strip().lower()
        with cls._lock:
            expiry = cls._dead_providers.get(key)
            if expiry is None:
                return False
            if time.time() >= expiry:
                cls._dead_providers.pop(key, None)
                return False
            return True

    @classmethod
    def clear(cls) -> None:
        """Reset depletion and provider states (for testing or key renewal)."""
        with cls._lock:
            cls._depleted_models.clear()
            cls._dead_providers.clear()


class ModelComplexityTier(StrEnum):
    FRONTIER = "FRONTIER"  # High reasoning, architecture, security, distributed systems, executive directives
    BALANCED = "BALANCED"  # Core implementation, full-stack microservices, refactoring, integration tests
    FAST = "FAST"          # High throughput, low latency, documentation, formatting, linting, audits


# Canonical model complexity tier mappings based on capability, cost, and parameters
MODEL_TIER_MAPPINGS: dict[str, ModelComplexityTier] = {
    # ── FRONTIER / COMPLEX REASONING ──────────────────────────────────────────
    "claude-3-5-sonnet": ModelComplexityTier.FRONTIER,
    "anthropic/claude-3.5-sonnet": ModelComplexityTier.FRONTIER,
    "gemini-3.1-pro-preview": ModelComplexityTier.FRONTIER,
    "gemini-2.5-pro": ModelComplexityTier.FRONTIER,
    "gpt-4o": ModelComplexityTier.FRONTIER,
    "deepseek-reasoner": ModelComplexityTier.FRONTIER,
    "deepseek/deepseek-r1": ModelComplexityTier.FRONTIER,
    "deepseek-ai/DeepSeek-R1": ModelComplexityTier.FRONTIER,
    "deepseek-ai/DeepSeek-R1:fastest": ModelComplexityTier.FRONTIER,
    "qwen3.8-max": ModelComplexityTier.FRONTIER,
    "glm-5": ModelComplexityTier.FRONTIER,
    "mistral-large-latest": ModelComplexityTier.FRONTIER,
    "mistral-large-3:675b": ModelComplexityTier.FRONTIER,
    "command-r-plus-08-2024": ModelComplexityTier.FRONTIER,
    "local-deepseek-r1": ModelComplexityTier.FRONTIER,
    "trinity-large-thinking": ModelComplexityTier.FRONTIER,
    "huihui_ai/Qwen3.8-abliterated:latest": ModelComplexityTier.FRONTIER,

    # ── BALANCED / CORE IMPLEMENTATION ─────────────────────────────────────────
    "codestral-latest": ModelComplexityTier.BALANCED,
    "deepseek-chat": ModelComplexityTier.BALANCED,
    "gemini-1.5-pro": ModelComplexityTier.BALANCED,
    "poolside/laguna-s-2.1": ModelComplexityTier.BALANCED,
    "qwen/qwen3.8-27b": ModelComplexityTier.BALANCED,
    "qwen3.8-27b": ModelComplexityTier.BALANCED,
    "llama-3.3-70b-versatile": ModelComplexityTier.BALANCED,
    "llama-3.3-70b": ModelComplexityTier.BALANCED,
    "meta-llama/llama-3.3-70b-instruct": ModelComplexityTier.BALANCED,
    "meta-llama/Llama-3.3-70B-Instruct-Turbo": ModelComplexityTier.BALANCED,
    "meta-llama/Llama-3.3-70B-Instruct:fastest": ModelComplexityTier.BALANCED,
    "kimi-k2.7-code": ModelComplexityTier.BALANCED,
    "kimi-k2.6": ModelComplexityTier.BALANCED,
    "glm-4.5": ModelComplexityTier.BALANCED,
    "solar-pro4": ModelComplexityTier.BALANCED,
    "mimo-v2.6-pro": ModelComplexityTier.BALANCED,
    "gpt-oss:20b": ModelComplexityTier.BALANCED,
    "openai/gpt-oss-20b": ModelComplexityTier.BALANCED,
    "grok-2-1212": ModelComplexityTier.BALANCED,
    "grok-2-vision-1212": ModelComplexityTier.BALANCED,
    "mixtral-8x7b-32768": ModelComplexityTier.BALANCED,
    "huihui_ai/gemma-4-abliterated:12b-qat": ModelComplexityTier.BALANCED,

    # ── FAST / HIGH-THROUGHPUT & TELEMETRY ─────────────────────────────────────
    "gemini-3.8-flash": ModelComplexityTier.FAST,
    "gemini-3.5-flash": ModelComplexityTier.FAST,
    "llama-3.1-8b-instant": ModelComplexityTier.FAST,
    "llama3.1-8b": ModelComplexityTier.FAST,
    "ministral-8b-latest": ModelComplexityTier.FAST,
    "qwen3.8-flash": ModelComplexityTier.FAST,
    "glm-5.3-flash": ModelComplexityTier.FAST,
    "mimo-v2.6-flash": ModelComplexityTier.FAST,
    "kilo-auto/free": ModelComplexityTier.FAST,
    "autofree": ModelComplexityTier.FAST,
    "kilo-auto/efficient": ModelComplexityTier.FAST,
    "MiniMax-M3.1-Flash": ModelComplexityTier.FAST,
    "command-r-08-2024": ModelComplexityTier.FAST,
    "muse-spark-1.3": ModelComplexityTier.FAST,
    "muse-wonder-1.0": ModelComplexityTier.FAST,
    "poolside/laguna-xs-2.1": ModelComplexityTier.FAST,
    "gemma4:31b-cloud": ModelComplexityTier.FAST,
    "qwen2.5-coder:1.5b": ModelComplexityTier.FAST,
}


def classify_model_tier(model_identifier: str) -> ModelComplexityTier:
    """Classifies a model identifier into its complexity tier with fallback heuristics."""
    if not model_identifier:
        return ModelComplexityTier.BALANCED

    normalized = model_identifier.lower().strip()
    if normalized in MODEL_TIER_MAPPINGS:
        return MODEL_TIER_MAPPINGS[normalized]

    for known_id, tier in MODEL_TIER_MAPPINGS.items():
        if known_id in normalized or normalized in known_id:
            return tier

    # Heuristic classifications
    if any(k in normalized for k in ["flash", "8b", "mini", "spark", "fast", "instant", "xs"]):
        return ModelComplexityTier.FAST
    if any(k in normalized for k in ["pro", "reasoner", "r1", "opus", "large", "max", "70b", "thinking"]):
        return ModelComplexityTier.FRONTIER

    return ModelComplexityTier.BALANCED


def resolve_task_complexity(
    task: Any = None,
    agent: Any = None,
    required_capabilities: list[str] | None = None,
) -> ModelComplexityTier:
    """
    Evaluates the computational complexity required for a task execution:
    - High priority / architectural / security / deadlock / executive tasks -> FRONTIER
    - Core engineering / backend / frontend / DevOps / review tasks -> BALANCED
    - Formatting / documentation / simple tests / low priority -> FAST
    """
    # 1. Inspect Task Priority & Content
    if task is not None:
        priority_val = getattr(task, "priority", None)
        if hasattr(priority_val, "value"):
            priority_val = priority_val.value
        priority_str = str(priority_val or "").upper()

        if priority_str == "CRITICAL":
            return ModelComplexityTier.FRONTIER

        title_desc = f"{getattr(task, 'title', '')} {getattr(task, 'description', '')}".lower()
        if any(w in title_desc for w in [
            "architecture", "architectural", "security", "vulnerability", "auth",
            "crypt", "deadlock", "consensus", "directive", "protocol", "governance",
            "threat", "adr", "specification", "concurrency", "distributed", "schema migration",
            "recovery", "incident", "break-glass", "audit trail"
        ]):
            return ModelComplexityTier.FRONTIER

        if priority_str == "LOW" or any(w in title_desc for w in [
            "documentation", "docstring", "readme", "markdown", "typo", "formatting",
            "changelog", "release notes", "summary report"
        ]):
            return ModelComplexityTier.FAST

    # 2. Inspect Agent Domain Archetype
    if agent is not None:
        agent_name = (getattr(agent, "name", "") or "").lower()
        identity = getattr(agent, "identity", None) or {}
        if isinstance(identity, dict):
            slug = (identity.get("slug") or "").lower()
            role_title = (identity.get("title") or "").lower()
        else:
            slug, role_title = "", ""

        combined = f"{agent_name} {slug} {role_title}"
        if any(r in combined for r in ["cto", "architect", "security", "sentinel", "database", "director", "chief"]):
            return ModelComplexityTier.FRONTIER
        if any(r in combined for r in ["writer", "documentation", "scribe"]):
            return ModelComplexityTier.FAST

    # 3. Required Capabilities
    caps = set(required_capabilities or [])
    if "architectural_reasoning" in caps or "deep_reasoning" in caps:
        return ModelComplexityTier.FRONTIER
    if "speed" in caps and not ("code_generation" in caps or "reasoning" in caps):
        return ModelComplexityTier.FAST

    # High priority task default
    if task is not None:
        priority_val = getattr(task, "priority", None)
        if hasattr(priority_val, "value"):
            priority_val = priority_val.value
        if str(priority_val or "").upper() == "HIGH":
            return ModelComplexityTier.FRONTIER

    return ModelComplexityTier.BALANCED


class ModelRotationManager:
    """
    Thread-safe model rotation and depletion manager.
    Coordinates multi-model dispatch across specialized working agents.
    Enforces:
    1. Key-first depletion: all healthy models on an API key / provider are exhausted
       before advancing to the next provider.
    2. Model depletion tracking: 429/402 quota limits mark individual models depleted with cooldown.
    3. Provider failure tracking: 401/403 auth errors mark the entire key dead.
    4. Complexity tier step-down: FRONTIER -> BALANCED -> FAST -> LOCAL degradation.
    5. Working agent priority: circular provider load-balancing across active workers.
    """

    _lock = threading.Lock()
    _rotation_offsets: dict[tuple[uuid.UUID, ModelComplexityTier], int] = {}

    @classmethod
    def _order_tier_by_provider_and_depletion(
        cls,
        company_id: uuid.UUID,
        tier: ModelComplexityTier,
        models_in_tier: list[Any],
        is_working_agent: bool = True,
    ) -> list[Any]:
        """
        Groups models in a complexity tier by provider / API key.
        Orders non-depleted models first on each key, and rotates provider groups
        so working agents don't bottleneck on a single key.
        """
        if not models_in_tier:
            return []

        # Group models by provider_id
        groups: dict[Any, list[Any]] = {}
        dead_provider_models: list[Any] = []

        for m in models_in_tier:
            prov_name = ""
            prov_obj = getattr(m, "__dict__", {}).get("provider")
            if prov_obj is not None:
                prov_name = getattr(prov_obj, "name", "")
            if not prov_name and hasattr(m, "provider_name"):
                prov_name = getattr(m, "provider_name", "") or ""
            if not prov_name and hasattr(m, "provider") and not hasattr(m, "_sa_instance_state"):
                prov_name = getattr(getattr(m, "provider", None), "name", "") or ""

            if prov_name and ModelDepletionTracker.is_provider_dead(prov_name):
                dead_provider_models.append(m)
                continue

            prov_key = getattr(m, "provider_id", None) or getattr(m, "provider_name", "default")
            groups.setdefault(prov_key, []).append(m)

        # For each provider group, place non-depleted models first, then depleted
        ordered_groups: list[list[Any]] = []
        for _, prov_models in groups.items():
            active = []
            depleted = []
            for m in prov_models:
                ident = getattr(m, "model_identifier", "")
                if ModelDepletionTracker.is_model_depleted(ident):
                    depleted.append(m)
                else:
                    active.append(m)
            # All models on this key are kept together (active first, depleted as fallback)
            ordered_groups.append(active + depleted)

        # Rotate provider groups across working agents
        if len(ordered_groups) > 1 and is_working_agent:
            key = (company_id, tier)
            with cls._lock:
                offset = cls._rotation_offsets.get(key, 0)
                cls._rotation_offsets[key] = (offset + 1) % len(ordered_groups)
            rotated_groups = ordered_groups[offset:] + ordered_groups[:offset]
        else:
            rotated_groups = ordered_groups

        # Flatten models key-by-key
        result = []
        for g in rotated_groups:
            result.extend(g)
        # Dead provider models appended at the very end
        result.extend(dead_provider_models)
        return result

    @classmethod
    def rotate_models(
        cls,
        company_id: uuid.UUID,
        tier: ModelComplexityTier,
        candidates: list[Any],
        is_working_agent: bool = True,
    ) -> list[Any]:
        """
        Partitions candidates into complexity tiers, groups models key-by-key,
        and provides degradation fallback (FRONTIER -> BALANCED -> FAST).
        """
        if not candidates:
            return []

        # Partition candidates by complexity
        tier_buckets: dict[ModelComplexityTier, list[Any]] = {
            ModelComplexityTier.FRONTIER: [],
            ModelComplexityTier.BALANCED: [],
            ModelComplexityTier.FAST: [],
        }

        for model in candidates:
            m_tier = classify_model_tier(model.model_identifier)
            tier_buckets[m_tier].append(model)

        # Order each tier bucket key-by-key
        ordered_frontier = cls._order_tier_by_provider_and_depletion(
            company_id, ModelComplexityTier.FRONTIER, tier_buckets[ModelComplexityTier.FRONTIER], is_working_agent
        )
        ordered_balanced = cls._order_tier_by_provider_and_depletion(
            company_id, ModelComplexityTier.BALANCED, tier_buckets[ModelComplexityTier.BALANCED], is_working_agent
        )
        ordered_fast = cls._order_tier_by_provider_and_depletion(
            company_id, ModelComplexityTier.FAST, tier_buckets[ModelComplexityTier.FAST], is_working_agent
        )

        # Step-down degradation hierarchy
        if tier == ModelComplexityTier.FRONTIER:
            adjacent_tiers = [ordered_frontier, ordered_balanced, ordered_fast]
        elif tier == ModelComplexityTier.BALANCED:
            adjacent_tiers = [ordered_balanced, ordered_frontier, ordered_fast]
        else:
            adjacent_tiers = [ordered_fast, ordered_balanced, ordered_frontier]

        # Flatten with deduplication
        ordered_candidates = []
        seen = set()
        for bucket in adjacent_tiers:
            for m in bucket:
                m_id = getattr(m, "id", None) or getattr(m, "model_identifier", None)
                if m_id not in seen:
                    ordered_candidates.append(m)
                    seen.add(m_id)

        # Append any remaining candidates
        for m in candidates:
            m_id = getattr(m, "id", None) or getattr(m, "model_identifier", None)
            if m_id not in seen:
                ordered_candidates.append(m)
                seen.add(m_id)

        return ordered_candidates
