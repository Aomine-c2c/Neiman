"""
Intelligence Router — Core routing engine of the NEIMAN Intelligence Exchange.
Implements:
1. Provider health & model availability monitoring
2. Circuit breaker state checks & fast-fail protection
3. Rate-limit detection & exponential retry policies
4. Timeout & capability mismatch handling
5. Context-size & cost/token ceiling enforcement
6. Structured output schema validation
7. Four-Tier Fallback Hierarchy:
   PRIMARY -> FALLBACK -> SECONDARY FALLBACK -> LOCAL/DEGRADED MODE
8. Full routing decision ledger logging for future optimization
"""

import asyncio
import logging
import uuid
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from nexora.domains.intelligence.adapters.base import (
    ModelAdapterRegistry,
    ProviderRateLimitError,
    ProviderTimeoutError,
    StructuredOutputValidationError,
)
from nexora.domains.intelligence.models import (
    Model,
    ModelProvider,
    ModelRequestLog,
    ModelRoutingPolicy,
)
from nexora.domains.intelligence.schemas import (
    ModelRequest,
    ModelResponsePayload,
)
from nexora.exceptions import BusinessRuleError, NotFoundError

logger = logging.getLogger(__name__)

# Global singleton registry so circuit breaker state persists across requests within the process
_SHARED_REGISTRY = ModelAdapterRegistry()


class IntelligenceRouter:
    def __init__(self, db: AsyncSession, registry: ModelAdapterRegistry | None = None) -> None:
        self.db = db
        self.registry = registry or _SHARED_REGISTRY

    async def get_or_create_default_policy(self, company_id: uuid.UUID) -> ModelRoutingPolicy:
        """Fetch default company routing policy or create one."""
        q = (
            select(ModelRoutingPolicy)
            .where(
                ModelRoutingPolicy.company_id == company_id,
                ModelRoutingPolicy.is_deleted.is_(False),
            )
            .order_by(desc(ModelRoutingPolicy.is_default))
        )
        result = await self.db.execute(q)
        policy = result.scalars().first()
        if not policy:
            policy = ModelRoutingPolicy(
                company_id=company_id,
                name="Default Resilient Policy",
                strategy="BALANCED",
                fallback_chain=[
                    "gemini-3.1-pro-preview",
                    "gemini-2.5-pro",
                    "claude-3-5-sonnet",
                    "gpt-4o",
                    "deepseek-reasoner",
                    "qwen3.8-max",
                    "kimi-k2.7-code",
                    "glm-5",
                    "local-deepseek-r1",
                    "kilo-auto/free",
                ],
                capability_preferences={
                    "reasoning": "gemini-3.1-pro-preview",
                    "architectural_reasoning": "gemini-3.1-pro-preview",
                    "code_generation": "gemini-3.1-pro-preview",
                    "large_context": "gemini-3.1-pro-preview",
                    "speed": "gemini-3.8-flash",
                    "agentic": "gemini-3.1-pro-preview",
                    "multimodal": "gemini-3.1-pro-preview",
                    "privacy": "local-deepseek-r1",
                    "free": "kilo-auto/free",
                },
                is_default=True,
            )
            self.db.add(policy)
            await self.db.flush()
            await self.db.refresh(policy)
        return policy

    async def resolve_candidate_models(
        self,
        request: ModelRequest,
        policy: ModelRoutingPolicy,
    ) -> list[Model]:
        """
        Pre-flight checks and filters available models matching requested capabilities,
        context size, cost ceilings, token ceilings, and privacy classification.
        """
        q = (
            select(Model)
            .options(selectinload(Model.provider))
            .join(ModelProvider, Model.provider_id == ModelProvider.id)
            .where(
                Model.is_active.is_(True),
                Model.is_deleted.is_(False),
                ModelProvider.is_active.is_(True),
                ModelProvider.is_configured.is_(True),
            )
        )
        result = await self.db.execute(q)
        all_models = list(result.scalars().all())

        candidates = []
        for m in all_models:
            # 1. Privacy filter
            if request.required_privacy and m.privacy_classification != request.required_privacy:
                continue

            # 2. Context capacity pre-flight check
            if m.context_capacity < request.context_tokens_needed:
                continue

            # 3. Token ceiling pre-flight check
            if request.token_ceiling and request.context_tokens_needed > request.token_ceiling:
                continue

            # 4. Capability matching with canonical model capability normalization
            KNOWN_MODEL_CAPS = {
                "reasoning", "code_generation", "vision", "agentic", "text",
                "large_context", "speed", "multimodal", "analysis", "architectural_reasoning"
            }
            caps = set(m.capabilities or [])
            req_caps = set(request.required_capabilities or [])
            normalized_req_caps = req_caps.intersection(KNOWN_MODEL_CAPS) or {"reasoning"}
            if not normalized_req_caps.issubset(caps):
                continue

            # 5. Cost ceiling check
            if request.max_acceptable_cost_usd is not None:
                est_cost = request.context_tokens_needed * m.input_cost_per_million / 1_000_000
                if est_cost > request.max_acceptable_cost_usd:
                    continue
            elif policy.max_cost_per_query_usd:
                est_cost = request.context_tokens_needed * m.input_cost_per_million / 1_000_000
                if est_cost > policy.max_cost_per_query_usd:
                    continue

            candidates.append(m)

        # Strategy-based ranking
        strategy = policy.strategy
        if strategy == "LOWEST_COST":
            candidates.sort(key=lambda x: x.input_cost_per_million)
        elif strategy == "LOWEST_LATENCY":
            candidates.sort(key=lambda x: x.avg_latency_ms)
        elif strategy == "STRICT_PRIVACY":
            candidates.sort(
                key=lambda x: 0 if x.privacy_classification == "ON_PREMISE_ZERO_RETENTION" else 1
            )
        elif strategy == "HIGHEST_CAPABILITY":
            candidates.sort(key=lambda x: x.context_capacity, reverse=True)
        else:
            # BALANCED
            candidates.sort(
                key=lambda x: (x.input_cost_per_million * 0.5) + (x.avg_latency_ms * 0.001)
            )

        return candidates

    async def construct_fallback_hierarchy(
        self,
        request: ModelRequest,
        policy: ModelRoutingPolicy,
        candidates: list[Model],
    ) -> list[tuple[str, Model]]:
        """
        Builds the 4-tier execution plan:
        1. PRIMARY
        2. FALLBACK
        3. SECONDARY FALLBACK
        4. LOCAL/DEGRADED MODE
        """
        chain: list[tuple[str, Model]] = []
        seen_identifiers = set()

        # Step 1: Select PRIMARY
        primary_model: Model | None = None
        if request.preferred_model:
            target_model = request.preferred_model
            if target_model.lower() in ("autofree", "auto-free", "kilo-auto-free"):
                target_model = "kilo-auto/free"
            q = (
                select(Model)
                .options(selectinload(Model.provider))
                .where(
                    Model.model_identifier.in_([target_model, request.preferred_model]), Model.is_active.is_(True)
                )
            )
            res = await self.db.execute(q)
            primary_model = res.scalars().first()

        if not primary_model and request.preferred_provider:
            q_p = select(ModelProvider).where(
                ModelProvider.name == request.preferred_provider, ModelProvider.is_active.is_(True)
            )
            res_p = await self.db.execute(q_p)
            pref_prov = res_p.scalars().first()
            if pref_prov:
                prov_models = [m for m in candidates if m.provider_id == pref_prov.id]
                # Default kilocode to autofree
                if request.preferred_provider in ("kilocode", "kilo"):
                    matched_autofree = next((m for m in prov_models if m.model_identifier in ("kilo-auto/free", "autofree")), None)
                    if matched_autofree:
                        primary_model = matched_autofree
                # Check if policy fallback chain specifies preferred model for this provider
                if not primary_model:
                    for fb_ident in (policy.fallback_chain or []):
                        matched = next((m for m in prov_models if m.model_identifier == fb_ident), None)
                        if matched:
                            primary_model = matched
                            break
                if not primary_model and prov_models:
                    primary_model = prov_models[0]

        # Dynamic Adaptive Rotation prioritizing Working Agents & Task Complexity
        complexity_str = request.metadata.get("complexity") if isinstance(request.metadata, dict) else None
        is_working_agent = request.metadata.get("is_working_agent", False) if isinstance(request.metadata, dict) else False

        if complexity_str and candidates:
            from nexora.domains.intelligence.rotation import (
                ModelComplexityTier,
                ModelRotationManager,
            )
            try:
                target_tier = ModelComplexityTier(complexity_str)
            except ValueError:
                target_tier = ModelComplexityTier.BALANCED

            # Rotate candidates prioritizing working agents and task complexity
            candidates = ModelRotationManager.rotate_models(
                company_id=policy.company_id,
                tier=target_tier,
                candidates=candidates,
                is_working_agent=is_working_agent,
            )
            if not primary_model and candidates:
                primary_model = candidates[0]

        if not primary_model and candidates:
            # 1. Check capability preferences against filtered candidates
            for cap in request.required_capabilities:
                pref_id = policy.capability_preferences.get(cap) if policy and policy.capability_preferences else None
                if pref_id:
                    matched = next((m for m in candidates if m.model_identifier == pref_id), None)
                    if matched:
                        primary_model = matched
                        break

            # 2. Check fallback chain against filtered candidates
            if not primary_model and policy and policy.fallback_chain:
                for fb_ident in policy.fallback_chain:
                    m_match = next((m for m in candidates if m.model_identifier == fb_ident), None)
                    if m_match:
                        primary_model = m_match
                        break

            # 3. Prioritize configured and healthy provider models from candidates
            if not primary_model:
                q_provs = select(ModelProvider).where(ModelProvider.is_active.is_(True))
                all_provs = {p.id: p for p in (await self.db.execute(q_provs)).scalars().all()}
                configured_candidate = next(
                    (m for m in candidates if all_provs.get(m.provider_id) and all_provs[m.provider_id].is_configured and all_provs[m.provider_id].is_healthy),
                    None
                )
                primary_model = configured_candidate or candidates[0]

        if not primary_model and policy and policy.fallback_chain:
            # Fallback if no candidate matched (e.g. empty catalog candidate pool)
            for fb_ident in policy.fallback_chain:
                q = (
                    select(Model)
                    .options(selectinload(Model.provider))
                    .join(ModelProvider, Model.provider_id == ModelProvider.id)
                    .where(
                        Model.model_identifier == fb_ident,
                        Model.is_active.is_(True),
                        ModelProvider.is_active.is_(True),
                        ModelProvider.is_configured.is_(True),
                    )
                )
                res = await self.db.execute(q)
                m_match = res.scalars().first()
                if m_match:
                    primary_model = m_match
                    break

        if primary_model:
            chain.append(("PRIMARY", primary_model))
            seen_identifiers.add(primary_model.model_identifier)

        if not request.allow_fallback:
            return chain

        # Step 2 & 3: Multi-tier fallback honoring full user-defined chain
        fallback_targets = list(policy.fallback_chain or [])
        tier_idx = 1

        for ident in fallback_targets:
            if ident in seen_identifiers:
                continue
            q = (
                select(Model)
                .options(selectinload(Model.provider))
                .join(ModelProvider, Model.provider_id == ModelProvider.id)
                .where(
                    Model.model_identifier == ident,
                    Model.is_active.is_(True),
                    ModelProvider.is_active.is_(True),
                    ModelProvider.is_configured.is_(True),
                )
            )
            res = await self.db.execute(q)
            fb_model = res.scalars().first()
            if fb_model:
                if "local" in ident.lower():
                    # Keep local for Tier 4 / LOCAL_DEGRADED
                    continue
                # If privacy classification is strictly requested, never leak to unmatching tier
                if request.required_privacy and fb_model.privacy_classification != request.required_privacy:
                    continue
                tier_label = (
                    "FALLBACK" if tier_idx == 1
                    else "SECONDARY FALLBACK" if tier_idx == 2
                    else f"FALLBACK_TIER_{tier_idx}"
                )
                chain.append((tier_label, fb_model))
                seen_identifiers.add(ident)
                tier_idx += 1
                if tier_idx > 10:
                    break

        provider_result = await self.db.execute(
            select(ModelProvider).where(
                ModelProvider.is_active.is_(True),
                ModelProvider.is_configured.is_(True),
            )
        )
        providers_by_id = {provider.id: provider for provider in provider_result.scalars().all()}
        for candidate in candidates:
            if candidate.model_identifier in seen_identifiers:
                continue
            provider = providers_by_id.get(candidate.provider_id)
            if not provider or provider.is_local:
                continue
            if request.required_privacy and candidate.privacy_classification != request.required_privacy:
                continue
            tier_label = (
                "FALLBACK"
                if tier_idx == 1
                else "SECONDARY FALLBACK"
                if tier_idx == 2
                else f"FALLBACK_TIER_{tier_idx}"
            )
            chain.append((tier_label, candidate))
            seen_identifiers.add(candidate.model_identifier)
            tier_idx += 1
            if tier_idx > 12:
                break

        # Step 4: Ensure LOCAL/DEGRADED MODE is always available as safety net
        q_local = (
            select(Model)
            .options(selectinload(Model.provider))
            .join(ModelProvider, Model.provider_id == ModelProvider.id)
            .where(
                ModelProvider.is_local.is_(True),
                Model.is_active.is_(True),
                ModelProvider.is_configured.is_(True),
            )
        )
        res_local = await self.db.execute(q_local)
        local_model = res_local.scalars().first()
        if local_model and local_model.model_identifier not in seen_identifiers:
            chain.append(("LOCAL_DEGRADED", local_model))

        return chain

    async def route_and_execute(
        self,
        company_id: uuid.UUID,
        request: ModelRequest,
        agent_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
    ) -> ModelResponsePayload:
        """
        Executes real-world multi-provider hardened dispatch.
        Guarantees:
        - Primary -> Fallback -> Secondary Fallback -> Local/Degraded Mode
        - Rate-limit handling with exponential backoff
        - Circuit-breaker state evaluation
        - Structured-output schema verification
        - Comprehensive telemetry logging of every step
        """
        # Built-in Token Compression
        compression_result = None
        if getattr(request, "enable_token_compression", True):
            from nexora.core.compression import TokenCompressor

            strat = getattr(request, "compression_strategy", "AGGRESSIVE")
            compression_result = TokenCompressor.compress(request.prompt, strategy=strat)
            # Use compressed text for inference prompt
            request.prompt = compression_result.compressed_text
            if request.system_prompt:
                sys_comp = TokenCompressor.compress(request.system_prompt, strategy="BALANCED")
                request.system_prompt = sys_comp.compressed_text

        policy = await self.get_or_create_default_policy(company_id)
        candidates = await self.resolve_candidate_models(request, policy)

        # Context-size validation pre-check
        if not candidates and not request.preferred_model:
            # Check if all models failed context size
            q_cap = select(Model).where(Model.is_active.is_(True))
            all_m = (await self.db.execute(q_cap)).scalars().all()
            max_cap = max((m.context_capacity for m in all_m), default=0)
            if request.context_tokens_needed > max_cap:
                raise BusinessRuleError(
                    f"Context capacity overflow: Requested {request.context_tokens_needed} tokens, "
                    f"highest available provider capacity is {max_cap} tokens."
                )

        hierarchy = await self.construct_fallback_hierarchy(request, policy, candidates)
        if not hierarchy:
            raise NotFoundError(
                "No intelligence provider available matching requested capabilities."
            )

        routing_trace: list[dict[str, Any]] = []
        failover_trace: list[dict[str, Any]] = []
        last_error_reason: str | None = None
        primary_failure_reason: str | None = None
        total_attempts = 0

        for tier, model in hierarchy:
            provider = await self.db.get(ModelProvider, model.provider_id)
            if not provider:
                continue

            if not provider.is_active or not provider.is_configured:
                routing_trace.append({
                    "tier": tier,
                    "provider": provider.name,
                    "model": model.model_identifier,
                    "action": "SKIPPED",
                    "reason": "Provider is not configured or is inactive.",
                })
                continue
            if provider.is_local:
                if not provider.base_url:
                    routing_trace.append({
                        "tier": tier,
                        "provider": provider.name,
                        "model": model.model_identifier,
                        "action": "SKIPPED",
                        "reason": "Local provider has no inference endpoint configured.",
                    })
                    continue
            elif not provider.api_key_encrypted:
                routing_trace.append({
                    "tier": tier,
                    "provider": provider.name,
                    "model": model.model_identifier,
                    "action": "SKIPPED",
                    "reason": "Cloud provider has no encrypted API credential configured.",
                })
                continue

            from nexora.domains.intelligence.rotation import ModelDepletionTracker

            # Check if this API key / provider has been marked dead due to 401/403
            if ModelDepletionTracker.is_provider_dead(provider.name):
                routing_trace.append({
                    "tier": tier,
                    "provider": provider.name,
                    "model": model.model_identifier,
                    "action": "SKIPPED_DEAD_KEY",
                    "reason": f"API key for {provider.name} marked dead from prior 401/403 authentication error.",
                })
                continue

            # Check if this specific model has been marked depleted (429/402 quota)
            if ModelDepletionTracker.is_model_depleted(model.model_identifier):
                routing_trace.append({
                    "tier": tier,
                    "provider": provider.name,
                    "model": model.model_identifier,
                    "action": "SKIPPED_DEPLETED_MODEL",
                    "reason": f"Model {model.model_identifier} is currently in quota exhaustion cooldown.",
                })
                continue

            adapter = self.registry.get(provider.name)
            if not adapter:
                continue

            # Circuit Breaker Check. `try_acquire` is atomic: while the breaker is
            # HALF_OPEN it admits exactly one probe, so a burst of concurrent
            # requests cannot stampede a provider that is still recovering.
            if not adapter.circuit_breaker.try_acquire():
                trace_entry = {
                    "tier": tier,
                    "provider": provider.name,
                    "model": model.model_identifier,
                    "action": "SKIPPED",
                    "reason": f"Circuit breaker is {adapter.circuit_breaker.state.value}",
                }
                routing_trace.append(trace_entry)
                failover_trace.append(
                    {
                        "tier": tier,
                        "provider": provider.name,
                        "model": model.model_identifier,
                        "status": "CIRCUIT_BREAKER_OPEN",
                    }
                )
                continue

            # Attempt Execution with Retries for Rate Limits
            max_retries = 2
            for retry_num in range(max_retries):
                total_attempts += 1
                try:
                    from nexora.core.crypto import decrypt_secret

                    plain_key = (
                        decrypt_secret(provider.api_key_encrypted)
                        if getattr(provider, "api_key_encrypted", None)
                        else None
                    )
                    metadata_dict = {
                        "avg_latency_ms": model.avg_latency_ms,
                        "input_cost_per_million": model.input_cost_per_million,
                        "output_cost_per_million": model.output_cost_per_million,
                        "api_key": plain_key,
                        "base_url": provider.base_url,
                        # Self-hosted providers are allowed to target loopback / private
                        # ranges; cloud providers are not.
                        "is_local": bool(provider.is_local),
                    }

                    # Execute generation
                    resp = await adapter.generate_response(
                        model.model_identifier, request, metadata_dict
                    )

                    # Check for token limit or truncation
                    if resp.is_truncated or resp.finish_reason == "length":
                        last_error_reason = (
                            f"Model {model.model_identifier} reached context/token limit ({resp.finish_reason})"
                        )
                        failover_trace.append(
                            {
                                "tier": tier,
                                "provider": provider.name,
                                "model": model.model_identifier,
                                "status": "LIMIT_REACHED",
                                "finish_reason": resp.finish_reason,
                                "tokens_consumed": resp.total_tokens,
                            }
                        )
                        routing_trace.append(
                            {
                                "tier": tier,
                                "provider": provider.name,
                                "model": model.model_identifier,
                                "action": "LIMIT_REACHED_FAILOVER",
                                "reason": last_error_reason,
                                "attempt": retry_num + 1,
                            }
                        )
                        # Do NOT mark task completed or accept truncated generation.
                        # Break retry loop to advance to the next model in hierarchy!
                        if isinstance(getattr(request, "metadata", None), dict) and request.metadata.get("simulate_length") is True:
                            request.metadata["simulate_length"] = False
                        break

                    # Success! Register with circuit breaker and provider health
                    adapter.circuit_breaker.record_success()
                    provider.consecutive_failures = 0
                    provider.is_healthy = True

                    routed_via_fallback = tier != "PRIMARY" or len(failover_trace) > 0
                    resp.routed_tier = tier
                    resp.routed_via_fallback = routed_via_fallback
                    resp.fallback_reason = (
                        (primary_failure_reason or last_error_reason)
                        if routed_via_fallback
                        else None
                    )
                    resp.attempts_count = total_attempts
                    resp.circuit_breaker_status = adapter.circuit_breaker.state.value

                    # Credit succeeding model and provider
                    resp.credited_model = model.model_identifier
                    resp.credited_provider = provider.name
                    failover_trace.append(
                        {
                            "tier": tier,
                            "provider": provider.name,
                            "model": model.model_identifier,
                            "status": "SUCCESS",
                        }
                    )
                    resp.failover_trace = failover_trace
                    resp.finish_reason = resp.finish_reason or "stop"
                    resp.is_truncated = False

                    routing_trace.append(
                        {
                            "tier": tier,
                            "provider": provider.name,
                            "model": model.model_identifier,
                            "action": "COMPLETED",
                            "attempt": retry_num + 1,
                        }
                    )
                    resp.routing_trace = routing_trace

                    # Attach Token Compression Telemetry
                    if compression_result:
                        resp.compression_applied = True
                        resp.original_prompt_tokens = compression_result.original_tokens
                        resp.compressed_prompt_tokens = compression_result.compressed_tokens
                        resp.tokens_saved = compression_result.tokens_saved
                        resp.compression_ratio_pct = compression_result.compression_ratio_pct
                        cost_per_token = (model.input_cost_per_million or 2.50) / 1_000_000.0
                        resp.cost_saved_usd = round(
                            compression_result.tokens_saved * cost_per_token, 6
                        )

                    # Log to audit ledger
                    log = ModelRequestLog(
                        company_id=company_id,
                        agent_id=agent_id,
                        task_id=task_id,
                        requested_capability=",".join(request.required_capabilities),
                        selected_provider_name=provider.name,
                        selected_model_identifier=model.model_identifier,
                        routed_tier=tier,
                        routed_via_fallback=routed_via_fallback,
                        fallback_reason=resp.fallback_reason,
                        attempts_count=total_attempts,
                        routing_trace=routing_trace,
                        circuit_breaker_status=adapter.circuit_breaker.state.value,
                        prompt_tokens=resp.prompt_tokens,
                        completion_tokens=resp.completion_tokens,
                        total_tokens=resp.total_tokens,
                        estimated_cost_usd=resp.estimated_cost_usd,
                        latency_ms=resp.latency_ms,
                        success=True,
                    )
                    self.db.add(log)
                    await self.db.flush()
                    adapter.circuit_breaker.release_probe()
                    return resp

                except ProviderRateLimitError as rle:
                    last_error_reason = f"Rate-limit on {provider.name}: {rle}"
                    ModelDepletionTracker.record_depleted_model(model.model_identifier, cooldown_seconds=ModelDepletionTracker.FIVE_HOURS_COOLDOWN)
                    if tier == "PRIMARY" and not primary_failure_reason:
                        primary_failure_reason = last_error_reason
                    if retry_num < max_retries - 1:
                        # Exponential backoff
                        backoff = 0.05 * (2**retry_num)
                        await asyncio.sleep(backoff)
                        routing_trace.append(
                            {
                                "tier": tier,
                                "provider": provider.name,
                                "model": model.model_identifier,
                                "action": "RETRY",
                                "attempt": retry_num + 1,
                                "error": str(rle),
                            }
                        )
                        continue
                    else:
                        adapter.circuit_breaker.record_failure()
                        provider.consecutive_failures += 1
                        routing_trace.append(
                            {
                                "tier": tier,
                                "provider": provider.name,
                                "model": model.model_identifier,
                                "action": "MODEL_DEPLETED_FAILOVER",
                                "error": str(rle),
                            }
                        )
                        break

                except ProviderTimeoutError as pte:
                    last_error_reason = f"Timeout on {provider.name}: {pte}"
                    if tier == "PRIMARY" and not primary_failure_reason:
                        primary_failure_reason = last_error_reason
                    adapter.circuit_breaker.record_failure()
                    provider.consecutive_failures += 1
                    routing_trace.append(
                        {
                            "tier": tier,
                            "provider": provider.name,
                            "model": model.model_identifier,
                            "action": "FAILOVER",
                            "error": str(pte),
                        }
                    )
                    break

                except StructuredOutputValidationError as soe:
                    last_error_reason = (
                        f"Structured schema validation error on {provider.name}: {soe}"
                    )
                    if tier == "PRIMARY" and not primary_failure_reason:
                        primary_failure_reason = last_error_reason
                    routing_trace.append(
                        {
                            "tier": tier,
                            "provider": provider.name,
                            "model": model.model_identifier,
                            "action": "FAILOVER",
                            "error": str(soe),
                        }
                    )
                    break

                except Exception as e:
                    err_str = str(e).lower()
                    if any(w in err_str for w in ["401", "403", "unauthorized", "forbidden", "invalid api key", "authentication"]):
                        # Whole API key / provider is dead -> mark dead so subsequent models on this key are bypassed
                        ModelDepletionTracker.record_dead_provider(provider.name, cooldown_seconds=300.0)
                        last_error_reason = f"Auth/Key failure on {provider.name}: {e}"
                        action_label = "KEY_DEAD_FAILOVER"
                    elif any(w in err_str for w in ["429", "402", "quota", "rate limit", "payment required", "exceeded"]):
                        # Specific model depleted on this key -> mark model depleted for 5-hour regeneration cycle
                        ModelDepletionTracker.record_depleted_model(model.model_identifier, cooldown_seconds=ModelDepletionTracker.FIVE_HOURS_COOLDOWN)
                        last_error_reason = f"Quota/Depletion on {provider.name} ({model.model_identifier}): {e}"
                        action_label = "MODEL_DEPLETED_FAILOVER"
                    else:
                        last_error_reason = f"Unexpected failure on {provider.name}: {e}"
                        action_label = "FAILOVER"

                    adapter.circuit_breaker.record_failure()
                    provider.consecutive_failures += 1
                    routing_trace.append(
                        {
                            "tier": tier,
                            "provider": provider.name,
                            "model": model.model_identifier,
                            "action": action_label,
                            "error": str(e),
                        }
                    )
                    break

            # Release the HALF_OPEN probe slot for every non-success exit path
            # (break / exhausted retries) so the breaker can never wedge shut.
            adapter.circuit_breaker.release_probe()

            if provider.consecutive_failures >= 3:
                provider.is_healthy = False
            await self.db.flush()

        # If everything exhausted, record in ledger and raise
        fail_log = ModelRequestLog(
            company_id=company_id,
            agent_id=agent_id,
            task_id=task_id,
            requested_capability=",".join(request.required_capabilities),
            selected_provider_name=hierarchy[0][1].model_identifier if hierarchy else "unknown",
            selected_model_identifier="exhausted",
            routed_tier="EXHAUSTED",
            routed_via_fallback=True,
            fallback_reason=f"Exhausted all tiers. Last reason: {last_error_reason}",
            attempts_count=total_attempts,
            routing_trace=routing_trace,
            circuit_breaker_status="OPEN",
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            estimated_cost_usd=0.0,
            latency_ms=0.0,
            success=False,
            error_message=last_error_reason,
        )
        self.db.add(fail_log)
        await self.db.flush()

        raise BusinessRuleError(
            f"All routing tiers failed. Telemetry preserved for optimization. Last error: {last_error_reason}"
        )
