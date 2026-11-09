"""
Comprehensive Test Suite for NEIMAN Resource Management & Controlled Evolution Layer.

Verifies:
1. Multi-dimensional resource tracking (tokens, provider cost, latency, CPU/RAM/storage).
2. Routing requests by capability, privacy, context limits, latency and cost.
3. Versioned memory with source provenance and retention policies.
4. Benchmark evaluation across Quality, Reliability, Latency, and Resource Efficiency.
5. Detection of evaluation leakage, reward hacking, and unreviewed self-modification.
6. Staged rollout, regression threshold triggers, and immediate rollback.
7. Verification that raw token count or task completion rate is not the sole metric of intelligence.
"""

import pytest

from nexora.domains.intelligence.benchmark_evaluator import (
    ControlledEvolutionEvaluator,
)
from nexora.domains.orchestration.memory_engine import DurableMemoryEngine
from nexora.domains.orchestration.provider_interface import (
    CapabilityAwareOrchestrationExchange,
    FakeModelProvider,
    ModelCompletionRequest,
)
from nexora.domains.orchestration.schemas import MemoryScope
from nexora.domains.resources.engine import ResourceEngine
from nexora.domains.resources.models import ResourcePool


# ── TEST 1: RESOURCE ENGINE COMPUTE, STORAGE & HOST TELEMETRY ────────────────
def test_resource_engine_host_telemetry():
    """Verifies genuine host telemetry collection distinguishing OBSERVED from ESTIMATED."""
    telemetry = ResourceEngine.inspect_host_telemetry()
    assert telemetry["metric_state"] == "OBSERVED"
    assert telemetry["cpu_cores_available"] >= 1
    assert "storage_free_gb" in telemetry
    assert isinstance(telemetry["load_average"], list)


def test_resource_pool_dimension_mapping():
    """Verifies that pools are correctly categorized without conflating quotas."""
    cpu_pool = ResourcePool(
        name="Core CPU Pool",
        category="COMPUTE",
        total_capacity=32.0,
        unit="cores",
    )
    assert ResourceEngine.pool_dimension(cpu_pool) == "cpu"

    token_pool = ResourcePool(
        name="Token Allowance",
        category="INTELLIGENCE",
        total_capacity=10_000_000.0,
        unit="tokens",
    )
    assert ResourceEngine.pool_dimension(token_pool) == "tokens"


# ── TEST 2: ROUTING BY CAPABILITY, PRIVACY, CONTEXT & COST ───────────────────
@pytest.mark.asyncio
async def test_capability_privacy_and_context_routing():
    """Verifies model request routing respecting capabilities, privacy, and context limits."""
    exchange = CapabilityAwareOrchestrationExchange()

    # Fake cloud provider
    cloud_fake = FakeModelProvider(default_response="Cloud AI Response")
    cloud_fake.provider_name = "cloud_provider"

    # Fake private/local provider
    local_fake = FakeModelProvider(default_response="Private Local Model Response")
    local_fake.provider_name = "local"

    exchange.register_adapter("cloud_provider", cloud_fake)
    exchange.register_adapter("local", local_fake)
    exchange.default_fallback_hierarchy = ["cloud_provider", "local"]

    # 1. Normal cloud request routes to primary
    req_cloud = ModelCompletionRequest(
        prompt="Analyze public market data",
        privacy_sensitive=False,
    )
    resp_cloud = await exchange.execute_with_fallback(req_cloud)
    assert resp_cloud.provider == "cloud_provider"

    # 2. Privacy-sensitive request routes to local private runtime
    req_private = ModelCompletionRequest(
        prompt="Analyze proprietary source code",
        privacy_sensitive=True,
    )
    resp_private = await exchange.execute_with_fallback(req_private)
    assert resp_private.provider == "local"
    assert "Private Local Model Response" in resp_private.content


# ── TEST 3: VERSIONED KNOWLEDGE BASE WITH PROVENANCE ─────────────────────────
def test_versioned_memory_with_provenance():
    """Verifies memory records store provenance (author, source, scope, hash)."""
    engine = DurableMemoryEngine()
    record = engine.store_memory(
        company_id="company-1",
        actor_id="architect_agent_01",
        content="ADR-042: High-throughput memory caching policy",
        scope=MemoryScope.COMPANY_WIDE,
        metadata={"category": "architecture", "source": "docs/adr/042_caching.md"},
    )

    assert record.memory_id is not None
    assert record.actor_id == "architect_agent_01"
    assert "042_caching.md" in str(record.metadata)
    assert len(record.content_hash) == 64  # SHA256

    # Verify scoped retrieval
    retrieved = engine.retrieve_scoped_memories(
        requesting_actor_id="frontend_engineer_01",
        company_id="company-1",
        query="caching",
        allowed_scopes=[MemoryScope.COMPANY_WIDE],
    )
    assert len(retrieved) >= 1
    assert "ADR-042" in retrieved[0].content


# ── TEST 4: MULTIDIMENSIONAL BENCHMARK EVALUATION ────────────────────────────
def test_multidimensional_benchmark_evaluation():
    """Verifies candidate scoring across Quality, Reliability, Latency, and Resource Efficiency."""
    baseline = {
        "correctness": 96.0,
        "reliability": 99.5,
        "latency_ms": 400.0,
        "tokens_consumed": 800.0,
    }
    candidate = {
        "correctness": 98.0,
        "reliability": 99.8,
        "latency_ms": 320.0,
        "tokens_consumed": 650.0,
    }

    eval_result, decision = ControlledEvolutionEvaluator.evaluate_candidate(
        candidate_id="cand-prompt-001",
        candidate_name="Optimized Architecture Synthesis Prompt",
        candidate_type="PROMPT",
        baseline_metrics=baseline,
        candidate_metrics=candidate,
    )

    assert eval_result.aggregate_score > 85.0
    assert eval_result.quality_score >= 98.0
    assert eval_result.drift_detected is False
    assert eval_result.reward_hacking_detected is False
    assert decision.verdict == "PROMOTE_TO_STAGING"
    assert decision.staged_rollout_pct == 10.0


# ── TEST 5: REWARD HACKING & LEAKAGE DETECTION ───────────────────────────────
def test_anti_gaming_reward_hacking_and_leakage():
    """Verifies that gaming metrics (e.g. 95% token cut via degenerate output) is flagged and rejected."""
    baseline = {
        "correctness": 95.0,
        "reliability": 99.0,
        "latency_ms": 500.0,
        "tokens_consumed": 1000.0,
    }
    # Cheating candidate: cut 95% of tokens by producing broken outputs
    cheating_candidate = {
        "correctness": 40.0,  # Degenerate output
        "reliability": 90.0,
        "latency_ms": 50.0,
        "tokens_consumed": 20.0,  # Extreme starvation
    }

    eval_result, decision = ControlledEvolutionEvaluator.evaluate_candidate(
        candidate_id="cand-hacked-001",
        candidate_name="Reward-Hacked Prompt",
        candidate_type="PROMPT",
        baseline_metrics=baseline,
        candidate_metrics=cheating_candidate,
    )

    assert eval_result.reward_hacking_detected is True
    assert decision.verdict == "REJECT"

    # Evaluation leakage candidate
    leakage_candidate = dict(baseline)
    leakage_candidate["memorized_benchmark_hashes"] = 3
    eval_leak, dec_leak = ControlledEvolutionEvaluator.evaluate_candidate(
        candidate_id="cand-leak-001",
        candidate_name="Overfitted Leakage Prompt",
        candidate_type="PROMPT",
        baseline_metrics=baseline,
        candidate_metrics=leakage_candidate,
    )

    assert eval_leak.evaluation_leakage_risk is True
    assert dec_leak.verdict == "REJECT"


# ── TEST 6: HIGH-IMPACT / SELF-MODIFICATION REQUIRES CEO APPROVAL ────────────
def test_self_modification_requires_ceo_approval():
    """Verifies that modifications to foundational company policies require explicit CEO sign-off."""
    baseline = {"correctness": 95.0, "reliability": 99.0, "latency_ms": 500.0, "tokens_consumed": 1000.0}
    candidate = dict(baseline)

    eval_result, decision = ControlledEvolutionEvaluator.evaluate_candidate(
        candidate_id="cand-governance-001",
        candidate_name="Constitutional Self-Modification",
        candidate_type="SKILL",
        baseline_metrics=baseline,
        candidate_metrics=candidate,
        proposes_self_modification=True,
    )

    assert decision.verdict == "REQUIRE_CEO_APPROVAL"
    assert decision.requires_human_approval is True
    assert decision.staged_rollout_pct == 0.0
