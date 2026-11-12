"""
Tests for Adaptive Model Complexity Routing and Working Agent Model Rotation.
Verifies:
1. Agents do not have fixed models.
2. Models rotate dynamically, prioritizing working agents.
3. Model selection adapts strictly to task complexity.
"""

import uuid
from unittest.mock import MagicMock

import pytest

from nexora.domains.intelligence.rotation import (
    ModelComplexityTier,
    ModelRotationManager,
    classify_model_tier,
    resolve_task_complexity,
)


def test_classify_model_tier():
    # Frontier reasoning
    assert classify_model_tier("claude-3-5-sonnet") == ModelComplexityTier.FRONTIER
    assert classify_model_tier("gemini-3.1-pro-preview") == ModelComplexityTier.FRONTIER
    assert classify_model_tier("deepseek-reasoner") == ModelComplexityTier.FRONTIER
    assert classify_model_tier("gpt-4o") == ModelComplexityTier.FRONTIER

    # Balanced coding
    assert classify_model_tier("codestral-latest") == ModelComplexityTier.BALANCED
    assert classify_model_tier("deepseek-chat") == ModelComplexityTier.BALANCED
    assert classify_model_tier("llama-3.3-70b-versatile") == ModelComplexityTier.BALANCED

    # Fast / High-throughput
    assert classify_model_tier("gemini-3.8-flash") == ModelComplexityTier.FAST
    assert classify_model_tier("llama-3.1-8b-instant") == ModelComplexityTier.FAST
    assert classify_model_tier("kilo-auto/free") == ModelComplexityTier.FAST


def test_resolve_task_complexity():
    # 1. Critical task -> FRONTIER
    crit_task = MagicMock(priority=MagicMock(value="CRITICAL"), title="Root Architecture Overhaul", description="")
    assert resolve_task_complexity(task=crit_task) == ModelComplexityTier.FRONTIER

    # 2. Security audit task -> FRONTIER
    sec_task = MagicMock(priority=MagicMock(value="HIGH"), title="Execute AST Security Vulnerability Scans", description="")
    assert resolve_task_complexity(task=sec_task) == ModelComplexityTier.FRONTIER

    # 3. Low priority documentation -> FAST
    doc_task = MagicMock(priority=MagicMock(value="LOW"), title="Update API Documentation Markdown", description="")
    assert resolve_task_complexity(task=doc_task) == ModelComplexityTier.FAST

    # 4. Agent role heuristics (Autonomous CTO Agent -> FRONTIER)
    cto_agent = MagicMock(name="Autonomous CTO Agent", identity={"slug": "cto_agent", "title": "Chief Technology Officer"}, capabilities=["reasoning"])
    generic_task = MagicMock(priority=MagicMock(value="MEDIUM"), title="Review architecture", description="")
    assert resolve_task_complexity(task=generic_task, agent=cto_agent) == ModelComplexityTier.FRONTIER

    # 5. Technical Writer Agent -> FAST
    writer_agent = MagicMock(name="Technical Writer Agent", identity={"slug": "technical_writer_agent", "title": "Technical Writer"}, capabilities=["synthesis"])
    simple_task = MagicMock(priority=MagicMock(value="MEDIUM"), title="Write changelog", description="")
    assert resolve_task_complexity(task=simple_task, agent=writer_agent) == ModelComplexityTier.FAST

    # 6. Backend Engineer Core Coding -> BALANCED
    backend_agent = MagicMock(name="Backend Engineer Agent", identity={"slug": "backend_engineer_agent", "title": "Backend Engineer"}, capabilities=["code_generation"])
    api_task = MagicMock(priority=MagicMock(value="MEDIUM"), title="Implement FastAPI microservice", description="")
    assert resolve_task_complexity(task=api_task, agent=backend_agent) == ModelComplexityTier.BALANCED


def test_model_rotation_manager_rotates_candidates():
    company_id = uuid.uuid4()

    # Create mock candidate models across tiers
    m_sonnet = MagicMock(id=uuid.uuid4(), model_identifier="claude-3-5-sonnet")
    m_gemini_pro = MagicMock(id=uuid.uuid4(), model_identifier="gemini-3.1-pro-preview")
    m_deepseek_r1 = MagicMock(id=uuid.uuid4(), model_identifier="deepseek-reasoner")

    m_codestral = MagicMock(id=uuid.uuid4(), model_identifier="codestral-latest")
    m_flash = MagicMock(id=uuid.uuid4(), model_identifier="gemini-3.8-flash")

    candidates = [m_sonnet, m_gemini_pro, m_deepseek_r1, m_codestral, m_flash]

    # First rotation for FRONTIER tier
    rotated_1 = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FRONTIER,
        candidates=candidates,
        is_working_agent=True,
    )
    first_model = rotated_1[0]

    # Second rotation for FRONTIER tier should advance the primary model
    rotated_2 = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FRONTIER,
        candidates=candidates,
        is_working_agent=True,
    )
    second_model = rotated_2[0]

    # Third rotation for FRONTIER tier should advance again
    rotated_3 = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FRONTIER,
        candidates=candidates,
        is_working_agent=True,
    )
    third_model = rotated_3[0]

    # Models must rotate and not remain fixed!
    assert first_model.model_identifier != second_model.model_identifier
    assert second_model.model_identifier != third_model.model_identifier

    # All three rotated models belong to FRONTIER tier
    frontier_ids = {"claude-3-5-sonnet", "gemini-3.1-pro-preview", "deepseek-reasoner"}
    assert first_model.model_identifier in frontier_ids
    assert second_model.model_identifier in frontier_ids
    assert third_model.model_identifier in frontier_ids


def test_key_first_model_depletion_before_next_key():
    from nexora.domains.intelligence.rotation import ModelDepletionTracker
    ModelDepletionTracker.clear()
    company_id = uuid.uuid4()

    # Provider 1 (Google Gemini) has 2 frontier models
    p1_id = uuid.uuid4()
    p1_name = "google_gemini"
    m_gemini_1 = MagicMock(id=uuid.uuid4(), model_identifier="gemini-3.1-pro-preview", provider_id=p1_id, provider=MagicMock(name=p1_name))
    m_gemini_2 = MagicMock(id=uuid.uuid4(), model_identifier="gemini-2.5-pro", provider_id=p1_id, provider=MagicMock(name=p1_name))

    # Provider 2 (OpenAI) has 1 frontier model
    p2_id = uuid.uuid4()
    p2_name = "openai"
    m_gpt4o = MagicMock(id=uuid.uuid4(), model_identifier="gpt-4o", provider_id=p2_id, provider=MagicMock(name=p2_name))

    candidates = [m_gemini_1, m_gemini_2, m_gpt4o]

    # Verify both models on Provider 1 come before Provider 2
    res = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FRONTIER,
        candidates=candidates,
        is_working_agent=False,
    )
    res_ids = [m.model_identifier for m in res]
    assert res_ids[0] in ("gemini-3.1-pro-preview", "gemini-2.5-pro")
    assert res_ids[1] in ("gemini-3.1-pro-preview", "gemini-2.5-pro")
    assert res_ids[2] == "gpt-4o"

    # Mark the first model depleted (simulating 429 quota exhaustion)
    ModelDepletionTracker.record_depleted_model("gemini-3.1-pro-preview", cooldown_seconds=60.0)
    assert ModelDepletionTracker.is_model_depleted("gemini-3.1-pro-preview") is True

    # Re-order: gemini-2.5-pro on SAME key must be prioritized over gpt-4o, while gemini-3.1-pro-preview is demoted
    res_after_depletion = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FRONTIER,
        candidates=candidates,
        is_working_agent=False,
    )
    assert res_after_depletion[0].model_identifier == "gemini-2.5-pro"


def test_auth_error_marks_entire_key_dead():
    from nexora.domains.intelligence.rotation import ModelDepletionTracker
    ModelDepletionTracker.clear()
    company_id = uuid.uuid4()

    p1_id = uuid.uuid4()
    p1_mock = MagicMock()
    p1_mock.name = "anthropic"
    m_claude_1 = MagicMock(id=uuid.uuid4(), model_identifier="claude-3-5-sonnet", provider_id=p1_id, provider=p1_mock)

    p2_id = uuid.uuid4()
    p2_mock = MagicMock()
    p2_mock.name = "openai"
    m_gpt4o = MagicMock(id=uuid.uuid4(), model_identifier="gpt-4o", provider_id=p2_id, provider=p2_mock)

    # Mark anthropic provider dead due to 401/403 invalid key
    ModelDepletionTracker.record_dead_provider("anthropic", cooldown_seconds=300.0)
    assert ModelDepletionTracker.is_provider_dead("anthropic") is True

    # Rotation should bypass all Anthropic models and prioritize OpenAI
    res = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FRONTIER,
        candidates=[m_claude_1, m_gpt4o],
        is_working_agent=False,
    )
    assert res[0].model_identifier == "gpt-4o"


def test_tier_degradation_hierarchy():
    from nexora.domains.intelligence.rotation import ModelDepletionTracker
    ModelDepletionTracker.clear()
    company_id = uuid.uuid4()

    m_frontier = MagicMock(id=uuid.uuid4(), model_identifier="gemini-3.1-pro-preview", provider_id=uuid.uuid4(), provider=MagicMock(name="google"))
    m_balanced = MagicMock(id=uuid.uuid4(), model_identifier="codestral-latest", provider_id=uuid.uuid4(), provider=MagicMock(name="mistral"))
    m_fast = MagicMock(id=uuid.uuid4(), model_identifier="gemini-3.8-flash", provider_id=uuid.uuid4(), provider=MagicMock(name="google"))

    candidates = [m_frontier, m_balanced, m_fast]

    # Target FRONTIER: FRONTIER -> BALANCED -> FAST
    frontier_res = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FRONTIER,
        candidates=candidates,
        is_working_agent=False,
    )
    assert [m.model_identifier for m in frontier_res] == ["gemini-3.1-pro-preview", "codestral-latest", "gemini-3.8-flash"]

    # Target BALANCED: BALANCED -> FRONTIER -> FAST
    balanced_res = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.BALANCED,
        candidates=candidates,
        is_working_agent=False,
    )
    assert [m.model_identifier for m in balanced_res] == ["codestral-latest", "gemini-3.1-pro-preview", "gemini-3.8-flash"]

    # Target FAST: FAST -> BALANCED -> FRONTIER
    fast_res = ModelRotationManager.rotate_models(
        company_id=company_id,
        tier=ModelComplexityTier.FAST,
        candidates=candidates,
        is_working_agent=False,
    )
    assert [m.model_identifier for m in fast_res] == ["gemini-3.8-flash", "codestral-latest", "gemini-3.1-pro-preview"]


def test_classify_model_tier_dynamic_unlisted():
    """Verify arbitrary unlisted model identifiers from API keys are classified dynamically via heuristics."""
    # Unknown frontier models
    assert classify_model_tier("vendor-x/quantum-pro-thinking") == ModelComplexityTier.FRONTIER
    assert classify_model_tier("custom-r1-heavy") == ModelComplexityTier.FRONTIER
    assert classify_model_tier("claude-next-opus-unreleased") == ModelComplexityTier.FRONTIER

    # Unknown fast models
    assert classify_model_tier("hyper-fast-telemetry-instant") == ModelComplexityTier.FAST
    assert classify_model_tier("micro-spark-8b") == ModelComplexityTier.FAST
    assert classify_model_tier("custom-nano-flash") == ModelComplexityTier.FAST

    # Default fallback to balanced
    assert classify_model_tier("arbitrary-new-foundation-model") == ModelComplexityTier.BALANCED


@pytest.mark.asyncio
async def test_sync_configured_providers_models_soft_deactivates():
    """Verify periodic API key check upserts new models and soft-deactivates missing models."""
    from unittest.mock import AsyncMock, patch

    from nexora.domains.intelligence.service import IntelligenceService

    db_mock = AsyncMock()

    # Provider
    prov_id = uuid.uuid4()
    mock_prov = MagicMock(
        id=prov_id,
        name="custom_vendor",
        display_name="Custom Vendor",
        is_configured=True,
        is_active=True,
        api_key_encrypted="encrypted_key",
        base_url=None,
        is_local=False,
    )

    # Existing models: 'kept-model' and 'deprecated-model'
    m_kept = MagicMock(id=uuid.uuid4(), provider_id=prov_id, model_identifier="kept-model", is_active=True)
    m_deprecated = MagicMock(id=uuid.uuid4(), provider_id=prov_id, model_identifier="deprecated-model", is_active=True)

    # Mock execute results:
    # 1. select ModelProvider
    mock_prov_res = MagicMock()
    mock_prov_res.scalars.return_value.all.return_value = [mock_prov]

    # 2. select existing Model
    mock_model_res = MagicMock()
    mock_model_res.scalars.return_value.all.return_value = [m_kept, m_deprecated]

    # 3. select Company IDs
    mock_comp_res = MagicMock()
    mock_comp_res.scalars.return_value.all.return_value = []

    db_mock.execute.side_effect = [mock_prov_res, mock_model_res, mock_comp_res]

    service = IntelligenceService(db_mock)
    service.seed_default_providers_if_empty = AsyncMock(return_value=0)

    # API key returns: 'kept-model' and 'new-api-model'
    discovered_payload = [
        {
            "model_identifier": "kept-model",
            "display_name": "Kept Model",
            "capabilities": ["reasoning"],
            "context_capacity": 128000,
            "input_cost_per_million": 1.0,
            "output_cost_per_million": 2.0,
            "privacy_classification": "PUBLIC_CLOUD",
        },
        {
            "model_identifier": "new-api-model",
            "display_name": "New API Model",
            "capabilities": ["code_generation"],
            "context_capacity": 64000,
            "input_cost_per_million": 0.5,
            "output_cost_per_million": 1.5,
            "privacy_classification": "PUBLIC_CLOUD",
        },
    ]

    with patch("nexora.core.crypto.decrypt_secret", return_value="sk-actual-api-key"), \
         patch("nexora.domains.intelligence.discovery.fetch_provider_models", new_callable=AsyncMock, return_value=discovered_payload):
        summary = await service.sync_configured_providers_models()

    assert summary["total_providers_checked"] == 1
    assert summary["total_models_added"] == 1
    assert summary["total_models_soft_deactivated"] == 1
    assert m_kept.is_active is True
    assert m_deprecated.is_active is False


def test_model_depletion_tracker_five_hours_cooldown():
    """Verify depleted models use 5-hour (18,000s) regeneration cycle and report status for UI."""
    from nexora.domains.intelligence.rotation import ModelDepletionTracker

    ModelDepletionTracker.clear()
    assert ModelDepletionTracker.is_model_depleted("depleted-claude") is False

    ModelDepletionTracker.record_depleted_model("depleted-claude")
    assert ModelDepletionTracker.is_model_depleted("depleted-claude") is True

    statuses = ModelDepletionTracker.get_depleted_models_status()
    assert len(statuses) == 1
    assert statuses[0]["model_identifier"] == "depleted-claude"
    assert statuses[0]["remaining_seconds"] > 17900
    assert statuses[0]["cooldown_duration_seconds"] == 18000

    # Test restoration
    ModelDepletionTracker.restore_model("depleted-claude")
    assert ModelDepletionTracker.is_model_depleted("depleted-claude") is False
    assert len(ModelDepletionTracker.get_depleted_models_status()) == 0


@pytest.mark.asyncio
async def test_auto_bind_discovered_models_prioritizes_working_agents():
    """Verify dynamic seeding pass auto-binds discovered models by tier and prioritizes working agents."""
    from unittest.mock import AsyncMock

    from nexora.domains.intelligence.service import IntelligenceService

    company_id = uuid.uuid4()
    db_mock = AsyncMock()

    m_frontier = MagicMock(id=uuid.uuid4(), model_identifier="pro-reasoner-api", is_active=True)
    m_balanced = MagicMock(id=uuid.uuid4(), model_identifier="coder-v2-api", is_active=True)
    m_fast = MagicMock(id=uuid.uuid4(), model_identifier="instant-telemetry-flash", is_active=True)

    # 1. Models query
    mock_models_res = MagicMock()
    mock_models_res.scalars.return_value.all.return_value = [m_frontier, m_balanced, m_fast]

    # 2. Company agents query
    working_agent = MagicMock(
        id=uuid.uuid4(),
        company_id=company_id,
        name="Chief Architect",
        status="RUNNING",
        identity={"slug": "architect", "title": "Chief Architect"},
        capabilities=["reasoning"],
        intelligence_config={},
    )
    idle_agent = MagicMock(
        id=uuid.uuid4(),
        company_id=company_id,
        name="Documentation Writer",
        status="CREATED",
        identity={"slug": "writer", "title": "Technical Writer"},
        capabilities=["synthesis"],
        intelligence_config={},
    )
    mock_agents_res = MagicMock()
    mock_agents_res.scalars.return_value.all.return_value = [idle_agent, working_agent]

    db_mock.execute.side_effect = [mock_models_res, mock_agents_res]

    service = IntelligenceService(db_mock)
    mock_policy = MagicMock(fallback_chain=[], capability_preferences={})
    service.get_policy = AsyncMock(return_value=mock_policy)

    bind_res = await service.auto_bind_discovered_models_to_company(company_id)

    assert bind_res["status"] == "ok"
    assert bind_res["bound_agents"] == 2
    # Working architect should be assigned the frontier model
    assert working_agent.intelligence_config["model"] == "pro-reasoner-api"
    # Writer should be assigned the fast model
    assert idle_agent.intelligence_config["model"] == "instant-telemetry-flash"
    # Fallback chain should lead with frontier model
    assert mock_policy.fallback_chain[0] == "pro-reasoner-api"



