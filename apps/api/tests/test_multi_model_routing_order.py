"""
Tests for multi-model fallback ordering, user-configurable fallback chain,
and multiple models on the same API key (e.g. Google Gemini 3.1 Pro -> 3.8 Flash).
"""

import uuid

import pytest

from nexora.domains.intelligence.router_service import IntelligenceRouter
from nexora.domains.intelligence.schemas import ModelRequest
from nexora.domains.intelligence.service import IntelligenceService


@pytest.mark.asyncio
async def test_default_policy_seeds_gemini_3_1_pro_as_primary(db):
    company_id = uuid.uuid4()
    router = IntelligenceRouter(db)
    policy = await router.get_or_create_default_policy(company_id)

    assert policy.fallback_chain[0] == "gemini-3.1-pro-preview"
    assert "gemini-3.8-flash" in policy.fallback_chain
    # Both gemini models are on the same provider
    assert policy.fallback_chain.index("gemini-3.1-pro-preview") < policy.fallback_chain.index("gemini-3.8-flash")


@pytest.mark.asyncio
async def test_construct_fallback_hierarchy_preserves_full_user_chain_and_same_key_models(db):
    company_id = uuid.uuid4()
    service = IntelligenceService(db)
    await service.seed_default_providers_if_empty()

    router = IntelligenceRouter(db)
    policy = await router.get_or_create_default_policy(company_id)

    # User custom chain with multiple models on Google Gemini, then Qwen, then Kilo
    custom_chain = [
        "gemini-3.1-pro-preview",
        "gemini-3.8-flash",
        "qwen3.8-max",
        "kilo-auto/free",
        "local-deepseek-r1",
    ]
    policy.fallback_chain = custom_chain
    await db.flush()

    req = ModelRequest(
        prompt="Synthesize architectural specification",
        required_capabilities=["reasoning"],
    )
    candidates = await router.resolve_candidate_models(req, policy)
    hierarchy = await router.construct_fallback_hierarchy(req, policy, candidates)

    chain_identifiers = [m.model_identifier for _, m in hierarchy]

    # Primary should be gemini-3.1-pro-preview
    assert hierarchy[0][1].model_identifier == "gemini-3.1-pro-preview"
    assert hierarchy[0][0] == "PRIMARY"

    # Should contain gemini-3.8-flash as fallback (same provider!)
    assert "gemini-3.8-flash" in chain_identifiers
    # Should contain qwen3.8-max
    assert "qwen3.8-max" in chain_identifiers
    # Should not truncate after 2 models
    assert len(hierarchy) >= 4
