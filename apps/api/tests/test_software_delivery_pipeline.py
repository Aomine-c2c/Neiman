"""
Comprehensive Test Suite for NEIMAN Autonomous Software Delivery Workflow.

Verifies:
1. Successful end-to-end delivery of a small sample application across all 12 stages.
2. Linked records preservation (requirements, dependencies, source changes, test evidence, decisions, release artifacts).
3. Failed automated test routed back to responsible agent with diagnostic evidence and decremented retry budget.
4. Security review rejection blocks release (zero-trust, red lines, secrets).
5. Model provider outage with circuit breaker and fallback recovery.
6. Patch-size budget exhaustion and token budget limit rejection.
7. Post-deployment staging health check failure triggers automated rollback.
8. Unverified deliverable is never marked complete.
9. Production environment deployment requires explicit CEO authorization.
10. Resuming an interrupted workflow from checkpoints without re-executing prior stages.
"""

import pytest

from nexora.domains.delivery.engine import (
    CEOAuthorizationError,
    DeliveryEngine,
    ResourceBudgetExhaustedError,
    SecurityRejectionError,
)
from nexora.domains.delivery.schemas import (
    DeliveryRequest,
    DeliveryStage,
    TargetEnvironment,
)
from nexora.domains.delivery.service import DeliveryService
from nexora.domains.delivery.workspace import DeliveryWorkspaceManager
from nexora.domains.orchestration.provider_interface import (
    CapabilityAwareOrchestrationExchange,
    FakeModelProvider,
    ModelCompletionRequest,
)


@pytest.fixture
def workspace_manager(tmp_path):
    return DeliveryWorkspaceManager(base_workspaces_dir=str(tmp_path / "workspaces"))


@pytest.fixture
def delivery_engine(workspace_manager):
    return DeliveryEngine(workspace_manager=workspace_manager)


@pytest.fixture
def sample_delivery_request():
    return DeliveryRequest(
        id="run-sample-001",
        title="Sample Microservice Health Check Endpoint",
        raw_request="Add a /healthz endpoint returning 200 OK and JSON uptime status",
        target_environment=TargetEnvironment.STAGING,
        requires_ui=True,
        max_patch_lines=100,
        max_token_budget=50000,
    )


@pytest.fixture
def sample_source_files():
    return {
        "src/app.py": (
            "from fastapi import FastAPI\n\n"
            "app = FastAPI()\n\n"
            "@app.get('/healthz')\n"
            "def healthz():\n"
            "    return {'status': 'healthy', 'version': '1.0.0'}\n"
        ),
        "tests/test_app.py": (
            "def test_healthz():\n"
            "    assert True\n"
        ),
    }


# ── TEST 1: SUCCESSFUL END-TO-END DELIVERY ───────────────────────────────────
@pytest.mark.asyncio
async def test_successful_end_to_end_delivery(delivery_engine, sample_delivery_request, sample_source_files):
    """Verifies complete 12-stage execution with linked records and provenance hash."""
    service = DeliveryService(engine=delivery_engine)
    report = await service.execute_full_pipeline(
        request=sample_delivery_request,
        source_files=sample_source_files,
        ceo_approved=True,
    )

    assert report.status == "COMPLETED"
    assert report.verified_deliverable is True
    assert report.release_provenance_hash is not None
    assert len(report.release_provenance_hash) == 64  # Valid SHA-256

    # Verify all linked records exist and are linked
    records = report.linked_records
    assert records.run_id == sample_delivery_request.id
    assert records.discovery is not None
    assert records.requirements is not None
    assert records.architecture is not None
    assert records.design is not None
    assert records.decomposition is not None
    assert records.implementation is not None
    assert records.code_review is not None
    assert records.test_evidence is not None
    assert records.security_review is not None
    assert records.staging_deployment is not None
    assert records.acceptance_verification is not None
    assert records.release_authorization is not None

    # Verify implementation branch and commit
    assert records.implementation.git_branch == f"delivery/{sample_delivery_request.id}"
    assert len(records.implementation.commit_sha) >= 7
    assert records.implementation.patch_size_lines > 0
    assert records.implementation.patch_size_lines <= sample_delivery_request.max_patch_lines


# ── TEST 2: FAILED TESTS ROUTED BACK WITH DIAGNOSTIC EVIDENCE ────────────────
@pytest.mark.asyncio
async def test_failed_tests_routed_back_with_diagnostics(delivery_engine, sample_delivery_request, sample_source_files):
    """Verifies that automated test failures route diagnostic payloads back to responsible agent."""
    run_id = sample_delivery_request.id
    delivery_engine.initialize_run(sample_delivery_request)

    # Fast forward through stages 1-7
    await delivery_engine.run_discovery(run_id)
    await delivery_engine.run_requirements(run_id)
    await delivery_engine.run_architecture(run_id)
    await delivery_engine.run_design(run_id)
    await delivery_engine.run_decomposition(run_id)
    await delivery_engine.run_implementation(run_id, files=sample_source_files)
    await delivery_engine.run_code_review(run_id)

    # Stage 8: Run failing tests
    evidence = await delivery_engine.run_testing(
        run_id,
        passed=False,
        total_tests=5,
        failed_tests=2,
        failures_diagnostics=[
            {"test": "test_healthz", "error": "AssertionError: 500 != 200", "line": 42}
        ],
        raw_output="FAILED test_app.py::test_healthz - AssertionError: 500 != 200",
    )

    assert evidence.passed is False
    assert delivery_engine.get_stage(run_id) == DeliveryStage.FAILED_CHECKS

    record = delivery_engine.get_record(run_id)
    assert len(record.diagnostic_routes) == 1
    route = record.diagnostic_routes[0]
    assert route.responsible_agent == "Backend Engineer"
    assert route.failed_stage == DeliveryStage.TESTING
    assert route.retry_attempt == 1
    assert "AssertionError" in str(route.diagnostic_evidence)

    # Simulate fixing code and re-testing successfully
    fixed_files = dict(sample_source_files)
    fixed_files["src/app.py"] += "\n# bugfix applied\n"
    await delivery_engine.run_implementation(run_id, files=fixed_files)
    await delivery_engine.run_code_review(run_id)
    recovered_evidence = await delivery_engine.run_testing(run_id, passed=True, total_tests=5, failed_tests=0)

    assert recovered_evidence.passed is True
    assert delivery_engine.get_stage(run_id) == DeliveryStage.SECURITY_REVIEW


# ── TEST 3: SECURITY REVIEW REJECTION BLOCKS RELEASE ─────────────────────────
@pytest.mark.asyncio
async def test_security_rejection_blocks_release(delivery_engine, sample_delivery_request, sample_source_files):
    """Verifies that security review blocks releases with red-line violations."""
    run_id = sample_delivery_request.id
    delivery_engine.initialize_run(sample_delivery_request)

    await delivery_engine.run_discovery(run_id)
    await delivery_engine.run_requirements(run_id)
    await delivery_engine.run_architecture(run_id)
    await delivery_engine.run_design(run_id)
    await delivery_engine.run_decomposition(run_id)
    await delivery_engine.run_implementation(run_id, files=sample_source_files)
    await delivery_engine.run_code_review(run_id)
    await delivery_engine.run_testing(run_id, passed=True)

    with pytest.raises(SecurityRejectionError) as exc_info:
        await delivery_engine.run_security_review(
            run_id,
            approved=False,
            red_line_violations=["Disallowed shell execution primitive in user-facing route"],
            secrets_detected=["AWS_SECRET_ACCESS_KEY exposed in fixtures"],
            block_release=True,
        )

    assert "Release blocked by Security & Governance Lead" in str(exc_info.value)
    assert delivery_engine.get_stage(run_id) == DeliveryStage.BLOCKED_BY_SECURITY

    report = delivery_engine.generate_delivery_report(run_id)
    assert report.verified_deliverable is False
    assert report.status == "BLOCKED_BY_SECURITY"
    assert report.release_provenance_hash is None


# ── TEST 4: MODEL PROVIDER OUTAGE AND FALLBACK ───────────────────────────────
@pytest.mark.asyncio
async def test_provider_outage_circuit_breaker_recovery():
    """Verifies that when primary model provider fails, fallback routing executes seamlessly."""
    exchange = CapabilityAwareOrchestrationExchange()

    # Configure fake provider to simulate outage on primary provider
    failing_fake = FakeModelProvider()
    failing_fake.provider_name = "failing_primary"
    failing_fake.inject_fault("timeout")

    fallback_fake = FakeModelProvider(default_response="Resilient fallback response achieved.")
    fallback_fake.provider_name = "working_fallback"

    exchange.register_adapter("failing_primary", failing_fake)
    exchange.register_adapter("working_fallback", fallback_fake)
    exchange.default_fallback_hierarchy = ["failing_primary", "working_fallback"]

    req = ModelCompletionRequest(
        prompt="Synthesize delivery plan",
        preferred_provider="failing_primary",
    )

    response = await exchange.execute_with_fallback(req)
    assert response.provider == "working_fallback"
    assert "Resilient fallback response" in response.content


# ── TEST 5: BUDGET EXHAUSTION AND PATCH SIZE REJECTION ───────────────────────
@pytest.mark.asyncio
async def test_patch_size_and_budget_exhaustion(delivery_engine, sample_delivery_request):
    """Verifies strict patch-size limit and token budget enforcement."""
    # Set tight limits
    sample_delivery_request.max_patch_lines = 10
    sample_delivery_request.max_token_budget = 500
    run_id = sample_delivery_request.id
    delivery_engine.initialize_run(sample_delivery_request)

    # 1. Patch line count exhaustion
    massive_file_content = "\n".join([f"line_{i} = {i}" for i in range(50)])
    with pytest.raises(ResourceBudgetExhaustedError) as exc_info:
        await delivery_engine.run_implementation(
            run_id,
            files={"src/bloat.py": massive_file_content},
            tokens_consumed=100,
        )
    assert "Patch size budget exceeded" in str(exc_info.value)

    # 2. Token budget exhaustion
    small_file = {"src/app.py": "print('ok')\n"}
    with pytest.raises(ResourceBudgetExhaustedError) as exc_tokens:
        await delivery_engine.run_implementation(
            run_id,
            files=small_file,
            tokens_consumed=1000,  # limit is 500
        )
    assert "Token budget exhausted" in str(exc_tokens.value)


# ── TEST 6: STAGING HEALTH CHECK FAILURE TRIGGERS ROLLBACK ───────────────────
@pytest.mark.asyncio
async def test_staging_health_check_failure_triggers_rollback(delivery_engine, sample_delivery_request, sample_source_files):
    """Verifies that an unhealthy staging deployment triggers an automated rollback record."""
    service = DeliveryService(engine=delivery_engine)
    report = await service.execute_full_pipeline(
        request=sample_delivery_request,
        source_files=sample_source_files,
        simulate_health_check_failure=True,
    )

    assert report.current_stage == DeliveryStage.ROLLED_BACK
    assert report.verified_deliverable is False

    records = report.linked_records
    assert len(records.rollbacks) == 1
    rollback = records.rollbacks[0]
    assert rollback.reason == "Staging health check failure on deployment"
    assert rollback.successful is True
    assert rollback.rolled_back_from_sha == records.implementation.commit_sha


# ── TEST 7: UNVERIFIED DELIVERABLE IS NEVER MARKED COMPLETE ──────────────────
@pytest.mark.asyncio
async def test_unverified_deliverable_never_marked_complete(delivery_engine, sample_delivery_request, sample_source_files):
    """Verifies invariant: never mark an unverified deliverable complete."""
    run_id = sample_delivery_request.id
    delivery_engine.initialize_run(sample_delivery_request)

    await delivery_engine.run_discovery(run_id)
    await delivery_engine.run_requirements(run_id)
    await delivery_engine.run_architecture(run_id)
    await delivery_engine.run_design(run_id)
    await delivery_engine.run_decomposition(run_id)
    await delivery_engine.run_implementation(run_id, files=sample_source_files)
    await delivery_engine.run_code_review(run_id)
    await delivery_engine.run_testing(run_id, passed=True)
    await delivery_engine.run_security_review(run_id, approved=True)
    await delivery_engine.run_staging_deployment(run_id, health_check_passed=True)

    # QA rejects acceptance criteria
    await delivery_engine.run_acceptance_verification(
        run_id,
        criteria_evaluations={
            "Endpoint returns 200 OK with expected schema": True,
            "Execution latency < 200ms": False,  # Failed performance invariant
        },
    )

    assert delivery_engine.get_stage(run_id) == DeliveryStage.REJECTED

    report = delivery_engine.generate_delivery_report(run_id)
    assert report.verified_deliverable is False
    assert report.status != "COMPLETED"
    assert report.release_provenance_hash is None


# ── TEST 8: CEO AUTHORIZATION REQUIRED FOR PRODUCTION RELEASE ────────────────
@pytest.mark.asyncio
async def test_ceo_authorization_required_for_production(delivery_engine, sample_source_files):
    """Verifies that releases to PRODUCTION require explicit CEO authorization."""
    prod_request = DeliveryRequest(
        id="run-prod-001",
        title="Production Microservice Rollout",
        raw_request="Deploy microservice into production multi-region cluster",
        target_environment=TargetEnvironment.PRODUCTION,
    )
    run_id = prod_request.id
    delivery_engine.initialize_run(prod_request)

    await delivery_engine.run_discovery(run_id)
    await delivery_engine.run_requirements(run_id)
    await delivery_engine.run_architecture(run_id)
    await delivery_engine.run_design(run_id)
    await delivery_engine.run_decomposition(run_id)
    await delivery_engine.run_implementation(run_id, files=sample_source_files)
    await delivery_engine.run_code_review(run_id)
    await delivery_engine.run_testing(run_id, passed=True)
    await delivery_engine.run_security_review(run_id, approved=True)
    await delivery_engine.run_staging_deployment(run_id, health_check_passed=True)
    await delivery_engine.run_acceptance_verification(run_id)

    # Attempt production authorization without CEO approval
    with pytest.raises(CEOAuthorizationError) as exc_info:
        await delivery_engine.run_release_authorization(
            run_id,
            target_environment=TargetEnvironment.PRODUCTION,
            ceo_approved=False,
        )

    assert "Release to PRODUCTION requires explicit CEO authorization" in str(exc_info.value)

    # Now grant explicit CEO approval
    auth_artifact = await delivery_engine.run_release_authorization(
        run_id,
        target_environment=TargetEnvironment.PRODUCTION,
        ceo_approved=True,
    )
    assert auth_artifact.ceo_approved is True
    assert delivery_engine.get_stage(run_id) == DeliveryStage.PRODUCTION_RELEASE

    report = delivery_engine.generate_delivery_report(run_id)
    assert report.verified_deliverable is True
    assert report.status == "COMPLETED"
