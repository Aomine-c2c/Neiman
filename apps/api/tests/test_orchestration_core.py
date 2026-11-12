"""
Comprehensive Test Suite for NEIMAN Production Agent Orchestration Core.
Tests:
- Task & Dependency Graph (DAG, Cycle Detection, Topological Order, Data Pipelining)
- Atomic Task Claiming (Concurrency Limits, Leases, Duplicate Job Prevention)
- Resilience & Recovery (Bounded Retries, Checkpoints, Crash Recovery, Tamper Detection)
- Event-Driven Communication, Delegation (Bounded Depth), and Escalation
- Durable Memory with Provenance, Scoped Context Isolation, Deduplication, and Retention
- Model Provider Common Interface, Fake Provider, Capability-Aware Routing, Fallback, Circuit Breakers, and Budget Exhaustion
- Security Hardening (Anti-Self-Modification, Tool Allowlists, Multi-Layer Sandboxing, Least Privilege)
- Traceable Autonomous Run Pillars (Goal, Budget, Authority, Result, Verification)
- FastAPI REST Endpoints
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from nexora.domains.orchestration.claiming import AtomicTaskClaimer
from nexora.domains.orchestration.enforcer import OrchestrationSecurityEnforcer
from nexora.domains.orchestration.engine import AutonomousOrchestrationEngine
from nexora.domains.orchestration.events import OrchestrationEventBus
from nexora.domains.orchestration.graph import TaskDependencyGraphManager
from nexora.domains.orchestration.memory_engine import DurableMemoryEngine
from nexora.domains.orchestration.provider_interface import (
    CapabilityAwareOrchestrationExchange,
    CircuitBreaker,
    CircuitState,
    FakeModelProvider,
    ModelCompletionRequest,
)
from nexora.domains.orchestration.resilience import (
    BoundedRetryManager,
    CheckpointManager,
    RecoveryManager,
)
from nexora.domains.orchestration.schemas import (
    AgentDelegationSpec,
    MemoryScope,
    OrchestrationStatus,
    OrchestrationTaskSpec,
    RunAuthority,
    RunBudget,
    TaskClaimRequest,
    TaskDependencyGraphSpec,
    VerificationStatus,
)
from nexora.exceptions import BusinessRuleError, ForbiddenError

# ---------------------------------------------------------------------------
# 1. TASK & DEPENDENCY GRAPH TESTS
# ---------------------------------------------------------------------------


class TestTaskDependencyGraph:
    def test_valid_dag_topological_sort(self):
        """Proves a multi-step DAG generates correct topological ordering."""
        t1 = OrchestrationTaskSpec(id="t1", title="Extract requirements")
        t2 = OrchestrationTaskSpec(id="t2", title="Design schema", dependencies=["t1"])
        t3 = OrchestrationTaskSpec(id="t3", title="Implement service", dependencies=["t2"])
        t4 = OrchestrationTaskSpec(id="t4", title="Write tests", dependencies=["t2"])
        t5 = OrchestrationTaskSpec(id="t5", title="Deploy", dependencies=["t3", "t4"])

        spec = TaskDependencyGraphSpec(name="Delivery Pipeline", tasks=[t1, t2, t3, t4, t5])
        mgr = TaskDependencyGraphManager(spec)
        res = mgr.validate_graph()

        assert res.is_valid is True
        assert res.has_cycles is False
        order = res.topological_order
        assert order.index("t1") < order.index("t2")
        assert order.index("t2") < order.index("t3")
        assert order.index("t2") < order.index("t4")
        assert order.index("t3") < order.index("t5")
        assert order.index("t4") < order.index("t5")

    def test_cycle_detection_blocks_circular_dependencies(self):
        """Proves circular dependencies are detected and pinpointed."""
        t1 = OrchestrationTaskSpec(id="a", title="Task A", dependencies=["c"])
        t2 = OrchestrationTaskSpec(id="b", title="Task B", dependencies=["a"])
        t3 = OrchestrationTaskSpec(id="c", title="Task C", dependencies=["b"])

        spec = TaskDependencyGraphSpec(name="Circular Pipeline", tasks=[t1, t2, t3])
        mgr = TaskDependencyGraphManager(spec)
        res = mgr.validate_graph()

        assert res.is_valid is False
        assert res.has_cycles is True
        assert any("Cycle detected" in err for err in res.errors)

    def test_missing_dependency_detected(self):
        """Proves referencing non-existent dependency is flagged."""
        t1 = OrchestrationTaskSpec(id="a", title="Task A", dependencies=["missing_id"])
        mgr = TaskDependencyGraphManager(TaskDependencyGraphSpec(name="Broken", tasks=[t1]))
        res = mgr.validate_graph()
        assert res.is_valid is False
        assert any("references unknown dependency" in err for err in res.errors)

    def test_upstream_output_pipelining(self):
        """Proves outputs from upstream dependencies are injected into downstream task inputs."""
        t1 = OrchestrationTaskSpec(id="t1", title="Step 1")
        t2 = OrchestrationTaskSpec(id="t2", title="Step 2", dependencies=["t1"])

        mgr = TaskDependencyGraphManager(TaskDependencyGraphSpec(name="Pipe", tasks=[t1, t2]))
        completed_outputs = {"t1": {"generated_code": "def hello(): return 'world'"}}

        combined = mgr.pipeline_upstream_outputs("t2", completed_outputs)
        assert combined["generated_code"] == "def hello(): return 'world'"
        assert "t1" in combined["__upstream_outputs__"]


# ---------------------------------------------------------------------------
# 2. ATOMIC TASK CLAIMING TESTS
# ---------------------------------------------------------------------------


class TestAtomicTaskClaiming:
    def test_atomic_claim_with_lease(self):
        """Proves qualified agent claims unblocked tasks and receives time-bounded lease."""
        claimer = AtomicTaskClaimer(max_concurrent_per_agent=2)
        task = OrchestrationTaskSpec(id="t1", title="Code Task", capabilities_required=["python"])

        req = TaskClaimRequest(
            agent_id="agent_1",
            agent_name="Python Dev",
            capabilities=["python", "git"],
            max_tasks=1,
            lease_duration_seconds=60,
        )
        res = claimer.claim_task([task], req, company_id="comp_1")

        assert res.success is True
        assert len(res.claimed_tasks) == 1
        assert res.claimed_tasks[0].id == "t1"
        assert res.claimed_tasks[0].status == OrchestrationStatus.CLAIMED
        assert res.lease_expires_at is not None

    def test_duplicate_claiming_prevented(self):
        """Proves an already claimed task cannot be claimed by another agent."""
        claimer = AtomicTaskClaimer()
        task = OrchestrationTaskSpec(id="t1", title="Task 1", capabilities_required=["python"])

        req1 = TaskClaimRequest(agent_id="agent_1", agent_name="Agent 1", capabilities=["python"])
        req2 = TaskClaimRequest(agent_id="agent_2", agent_name="Agent 2", capabilities=["python"])

        res1 = claimer.claim_task([task], req1, company_id="comp_1")
        assert res1.success is True

        res2 = claimer.claim_task([task], req2, company_id="comp_1")
        assert res2.success is False
        assert "No unblocked tasks matching" in res2.reason

    def test_agent_concurrency_ceiling_enforced(self):
        """Proves agent cannot exceed max_concurrent_per_agent ceiling."""
        claimer = AtomicTaskClaimer(max_concurrent_per_agent=1)
        t1 = OrchestrationTaskSpec(id="t1", title="Task 1")
        t2 = OrchestrationTaskSpec(id="t2", title="Task 2")

        req = TaskClaimRequest(agent_id="agent_1", agent_name="Agent 1", capabilities=[])
        res1 = claimer.claim_task([t1], req, company_id="comp_1")
        assert res1.success is True

        # Second claim attempt must be rejected due to concurrency limit
        res2 = claimer.claim_task([t2], req, company_id="comp_1")
        assert res2.success is False
        assert "concurrency ceiling reached" in res2.reason

    def test_expired_lease_cleanup_and_reclaiming(self):
        """Proves expired leases are automatically cleaned up."""
        claimer = AtomicTaskClaimer()
        task = OrchestrationTaskSpec(id="t1", title="Task 1")

        # Claim with valid 10s lease duration
        req = TaskClaimRequest(
            agent_id="agent_1", agent_name="Agent 1", capabilities=[], lease_duration_seconds=10
        )
        res1 = claimer.claim_task([task], req, company_id="comp_1")
        assert res1.success is True

        # Simulate expiration by backdating the active lease
        claimer._active_leases["t1"]["lease_expires_at"] = datetime.now(UTC) - timedelta(seconds=1)

        # Next check revokes expired lease
        expired = claimer.cleanup_expired_leases()
        assert "t1" in expired
        assert claimer.get_agent_active_count("agent_1") == 0


# ---------------------------------------------------------------------------
# 3. RESILIENCE & RECOVERY TESTS
# ---------------------------------------------------------------------------


class TestResilienceAndRecovery:
    def test_bounded_retry_backoff(self):
        """Proves exponential backoff respects minimum, factor, and ceiling."""
        b1 = BoundedRetryManager.compute_backoff(1, initial_seconds=1.0, max_seconds=10.0, jitter=False)
        b2 = BoundedRetryManager.compute_backoff(2, initial_seconds=1.0, max_seconds=10.0, jitter=False)
        b3 = BoundedRetryManager.compute_backoff(3, initial_seconds=1.0, max_seconds=10.0, jitter=False)
        b4 = BoundedRetryManager.compute_backoff(10, initial_seconds=1.0, max_seconds=10.0, jitter=False)

        assert b1 == 1.0
        assert b2 == 2.0
        assert b3 == 4.0
        assert b4 == 10.0  # Capped at max_seconds

    def test_checkpoint_creation_and_integrity_verification(self):
        """Proves checkpoint generates valid cryptographic SHA-256 signature."""
        cp = CheckpointManager.create_checkpoint(
            run_id="run_123",
            task_id="task_456",
            step_index=1,
            step_name="STEP_ONE",
            state_snapshot={"key": "value"},
            tokens_consumed=150,
            cost_usd=0.002,
        )
        assert len(cp.hash_signature) == 64
        assert CheckpointManager.verify_checkpoint_integrity(cp) is True

        # Tampering with checkpoint content invalidates signature
        cp.state_snapshot["key"] = "tampered_value"
        assert CheckpointManager.verify_checkpoint_integrity(cp) is False

    def test_recovery_from_interrupted_checkpoints(self):
        """Proves interrupted run resumes cleanly from last checkpoint."""
        cp1 = CheckpointManager.create_checkpoint(
            run_id="run_1", task_id="t1", step_index=1, step_name="STEP_1", state_snapshot={"a": 1}
        )
        cp2 = CheckpointManager.create_checkpoint(
            run_id="run_1", task_id="t1", step_index=2, step_name="STEP_2", state_snapshot={"b": 2}
        )

        recovered = RecoveryManager.reconstruct_state("run_1", [cp1, cp2], total_steps=3)
        assert recovered.is_recoverable is True
        assert recovered.completed_steps == [1, 2]
        assert recovered.last_checkpoint.step_name == "STEP_2"
        assert recovered.accumulated_state == {"a": 1, "b": 2}
        assert "Ready to resume from step 3" in recovered.recovery_reason


# ---------------------------------------------------------------------------
# 4. EVENT-DRIVEN COMMUNICATION & DELEGATION TESTS
# ---------------------------------------------------------------------------


class TestEventDrivenDelegationAndEscalation:
    def test_bounded_delegation_depth_prevents_infinite_loops(self):
        """Proves delegation depth exceeding ceiling raises BusinessRuleError."""
        bus = OrchestrationEventBus(max_delegation_depth=3)
        spec = AgentDelegationSpec(
            parent_run_id="run_1",
            delegator_agent_id="agent_a",
            target_agent_id="agent_b",
            subtask=OrchestrationTaskSpec(title="Subtask"),
            current_depth=4,  # Exceeds max 3
            max_depth=3,
        )

        with pytest.raises(BusinessRuleError, match="Infinite delegation blocked"):
            bus.validate_and_dispatch_delegation(spec)

    def test_self_delegation_blocked(self):
        """Proves agent cannot delegate task to itself."""
        bus = OrchestrationEventBus()
        spec = AgentDelegationSpec(
            parent_run_id="run_1",
            delegator_agent_id="agent_a",
            target_agent_id="agent_a",
            subtask=OrchestrationTaskSpec(title="Recursive Task"),
            current_depth=1,
        )

        with pytest.raises(BusinessRuleError, match="Self-delegation loop blocked"):
            bus.validate_and_dispatch_delegation(spec)

    def test_escalation_records_event_and_notifies_owner(self):
        """Proves raising escalation records event targeted to CEO."""
        bus = OrchestrationEventBus()
        events_received = []
        bus.subscribe("ESCALATION_TRIGGERED", lambda e: events_received.append(e))

        esc = bus.raise_escalation(
            run_id="run_99",
            agent_id="agent_x",
            reason="High risk database drop detected",
            severity="CRITICAL",
        )
        assert esc.status == "OPEN"
        assert esc.escalated_to == "CEO_HUMAN_OWNER"
        assert len(events_received) == 1


# ---------------------------------------------------------------------------
# 5. DURABLE MEMORY WITH PROVENANCE & RETENTION TESTS
# ---------------------------------------------------------------------------


class TestDurableMemoryWithProvenance:
    def test_memory_provenance_and_deduplication(self):
        """Proves memories track provenance and identical content is deduplicated."""
        mem = DurableMemoryEngine()
        m1 = mem.store_memory(
            company_id="c1",
            actor_id="agent_1",
            content="PostgreSQL 16 connection pooling config",
            scope=MemoryScope.PROJECT_SHARED,
            task_id="t1",
            run_id="r1",
            importance=0.8,
        )
        assert len(m1.content_hash) == 64

        # Storing duplicate content returns the existing record
        m2 = mem.store_memory(
            company_id="c1",
            actor_id="agent_1",
            content="PostgreSQL 16 connection pooling config",
            scope=MemoryScope.PROJECT_SHARED,
        )
        assert m1.memory_id == m2.memory_id

    def test_scoped_context_isolation_protects_private_memories(self):
        """Proves an agent cannot read another agent's AGENT_PRIVATE memory."""
        mem = DurableMemoryEngine()
        mem.store_memory(
            company_id="c1",
            actor_id="agent_alice",
            content="Alice private thoughts on refactoring",
            scope=MemoryScope.AGENT_PRIVATE,
        )

        # Alice can read her own memory
        alice_results = mem.retrieve_scoped_memories(
            requesting_actor_id="agent_alice", company_id="c1", query="private thoughts"
        )
        assert len(alice_results) == 1

        # Bob cannot read Alice's AGENT_PRIVATE memory
        bob_results = mem.retrieve_scoped_memories(
            requesting_actor_id="agent_bob", company_id="c1", query="private thoughts"
        )
        assert len(bob_results) == 0

    def test_retention_policy_prunes_expired_and_protects_important(self):
        """Proves expired TTL memories are pruned while high importance memories are preserved."""
        mem = DurableMemoryEngine()
        # High importance (>= 0.8) -> Immortal
        m_immortal = mem.store_memory(
            company_id="c1",
            actor_id="agent_1",
            content="Architectural Standard ADR-001",
            importance=0.9,
        )
        # Expired TTL memory
        m_expired = mem.store_memory(
            company_id="c1",
            actor_id="agent_1",
            content="Scratch note",
            ttl_days=-1,  # Expired yesterday
            importance=0.3,
        )

        stats = mem.enforce_retention_policy(company_id="c1")
        assert stats["pruned_expired"] == 1

        active = mem.retrieve_scoped_memories("agent_1", "c1")
        ids = {item.memory_id for item in active}
        assert m_immortal.memory_id in ids
        assert m_expired.memory_id not in ids


# ---------------------------------------------------------------------------
# 6. MODEL PROVIDERS, FALLBACK & BUDGET EXHAUSTION TESTS
# ---------------------------------------------------------------------------


class TestProviderInterfaceAndBudgetExhaustion:
    @pytest.mark.asyncio
    async def test_fake_provider_deterministic_completion(self):
        """Proves FakeModelProvider produces deterministic completions and calculates costs."""
        provider = FakeModelProvider(default_response="Generated output code.")
        req = ModelCompletionRequest(prompt="Write unit tests")
        res = await provider.generate_completion(req)

        assert res.content == "Generated output code."
        assert res.provider == "fake"
        assert res.total_tokens > 0
        assert res.cost_usd > 0.0

    @pytest.mark.asyncio
    async def test_automatic_provider_fallback_on_fault(self):
        """Proves primary provider failure automatically fails over to next candidate."""
        fake1 = FakeModelProvider()
        fake1.provider_name = "primary_failing"
        fake1.inject_fault("rate_limit")

        fake2 = FakeModelProvider(default_response="Fallback succeeded.")
        fake2.provider_name = "secondary_success"

        exchange = CapabilityAwareOrchestrationExchange()
        exchange.register_adapter("primary_failing", fake1)
        exchange.register_adapter("secondary_success", fake2)
        exchange.default_fallback_hierarchy = ["primary_failing", "secondary_success"]

        req = ModelCompletionRequest(prompt="Evaluate data")
        res = await exchange.execute_with_fallback(req)

        assert res.provider == "secondary_success"
        assert res.content == "Fallback succeeded."

    def test_circuit_breaker_trips_and_cooldown(self):
        """Proves circuit breaker trips after 3 failures and blocks requests until cooldown."""
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=0.1)
        assert cb.allow_request() is True

        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED

        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.allow_request() is False

    @pytest.mark.asyncio
    async def test_budget_exhaustion_hard_blocks_execution(self):
        """Proves exceeding allocated dollar budget raises BusinessRuleError."""
        exchange = CapabilityAwareOrchestrationExchange()
        req = ModelCompletionRequest(prompt="Expensive prompt")

        # Prior accumulated cost ($5.00) equals max_budget_usd ($5.00)
        with pytest.raises(BusinessRuleError, match="Budget exhausted"):
            await exchange.execute_with_fallback(req, accumulated_cost=5.00, max_budget_usd=5.00)


# ---------------------------------------------------------------------------
# 7. SECURITY & ANTI-SELF-MODIFICATION TESTS
# ---------------------------------------------------------------------------


class TestSecurityAndAntiSelfModification:
    def test_anti_self_modification_blocks_privilege_escalation(self):
        """Proves agent attempting to elevate its own permissions is blocked."""
        with pytest.raises(ForbiddenError, match="Privilege escalation blocked"):
            OrchestrationSecurityEnforcer.assert_no_self_modification(
                actor_agent_id="agent_123",
                target_resource="agent_123",
                operation="UPDATE",
                payload={"permissions": {"allowed_tools": ["all"]}},
            )

    def test_tool_allowlist_enforces_deny_by_default(self):
        """Proves undeclared tool is blocked by deny-by-default."""
        auth = RunAuthority(
            position_key="software_architect",
            autonomy_level=3,
            granted_tools=["codebase_ast_analysis"],
            denied_tools=["corporate_bank_transfer"],
        )

        # Allowed tool passes
        OrchestrationSecurityEnforcer.assert_tool_permitted("codebase_ast_analysis", auth)

        # Undeclared tool blocked
        with pytest.raises(ForbiddenError, match="not in the granted tool allowlist"):
            OrchestrationSecurityEnforcer.assert_tool_permitted("terminal_exec", auth)

        # Denied tool blocked
        with pytest.raises(ForbiddenError, match="explicitly DENIED"):
            OrchestrationSecurityEnforcer.assert_tool_permitted("corporate_bank_transfer", auth)

    def test_sandboxing_blocks_traversal_and_destructive_patterns(self):
        """Proves multi-layer sandboxing blocks traversal, shell bombs, SQL drops, and SSRF."""
        # Path traversal
        with pytest.raises(ForbiddenError, match="Path traversal blocked"):
            OrchestrationSecurityEnforcer.validate_filesystem_path("../../etc/shadow", ["/workspace"])

        # Destructive shell command
        with pytest.raises(ForbiddenError, match="Command execution blocked"):
            OrchestrationSecurityEnforcer.validate_terminal_command("rm -rf / --no-preserve-root")

        # Destructive SQL
        with pytest.raises(ForbiddenError, match="Database execution blocked"):
            OrchestrationSecurityEnforcer.validate_database_query("DROP TABLE users CASCADE;")

        # SSRF cloud metadata
        with pytest.raises(ForbiddenError, match="Network egress blocked"):
            OrchestrationSecurityEnforcer.validate_network_url("http://169.254.169.254/latest/meta-data/")


# ---------------------------------------------------------------------------
# 8. TRACEABLE AUTONOMOUS RUNS (Pillars Test)
# ---------------------------------------------------------------------------


class TestTraceableAutonomousRuns:
    @pytest.mark.asyncio
    async def test_full_autonomous_run_produces_5_canonical_pillars(self):
        """
        Proves every autonomous run contains:
        1. Goal
        2. Budget
        3. Authority
        4. Result
        5. Verification Status
        """
        engine = AutonomousOrchestrationEngine()
        task = OrchestrationTaskSpec(
            title="Generate API schema",
            description="Produce OpenAPI 3.1 specification for users service",
            capabilities_required=["code_generation"],
        )
        auth = RunAuthority(
            position_key="software_architect",
            autonomy_level=3,
            granted_tools=["codebase_ast_analysis"],
        )
        budget = RunBudget(allocated_usd=2.0)

        record = await engine.execute_task_run(
            company_id="company_1",
            agent_id="agent_arch",
            task=task,
            authority=auth,
            budget=budget,
        )

        assert record.status == OrchestrationStatus.COMPLETED
        # Pillar 1: Traceable Goal
        assert record.goal == "Generate API schema"
        # Pillar 2: Budget
        assert record.budget.allocated_usd == 2.0
        assert record.budget.consumed_tokens > 0
        # Pillar 3: Authority
        assert record.authority.position_key == "software_architect"
        assert record.authority.autonomy_level == 3
        # Pillar 4: Structured Result
        assert record.result["status"] == "SUCCESS"
        assert len(record.result["output"]) > 0
        # Pillar 5: Verification Status
        assert record.verification.status == VerificationStatus.VERIFIED
        assert "SECURITY_SANDBOX_PASS" in record.verification.checks_passed
        # Checkpoints verified
        assert len(record.checkpoints) >= 3


# ---------------------------------------------------------------------------
# 9. FASTAPI REST API ENDPOINTS TESTS
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestOrchestrationAPIEndpoints:
    async def test_graph_validate_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/orchestration/graph/validate",
            json={
                "name": "Test DAG",
                "tasks": [
                    {"id": "t1", "title": "Step 1"},
                    {"id": "t2", "title": "Step 2", "dependencies": ["t1"]},
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_valid"] is True
        assert data["topological_order"] == ["t1", "t2"]

    async def test_tasks_claim_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/orchestration/tasks/claim",
            json={
                "request": {
                    "agent_id": str(uuid.uuid4()),
                    "agent_name": "Worker Agent",
                    "capabilities": ["reasoning"],
                    "max_tasks": 1,
                },
                "candidate_tasks": [
                    {"id": "t_claim_1", "title": "Analyze Data", "capabilities_required": ["reasoning"]}
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["claimed_tasks"]) == 1

    async def test_trigger_run_and_recover_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        # 1. Trigger Run
        run_resp = await client.post(
            f"/api/v1/companies/{company_id}/orchestration/runs",
            json={
                "agent_id": str(uuid.uuid4()),
                "task": {"title": "Verify Architecture Standards"},
                "authority": {
                    "position_key": "software_architect",
                    "autonomy_level": 3,
                    "granted_tools": ["codebase_ast_analysis"],
                },
                "budget": {"allocated_usd": 1.50},
            },
            headers=auth_headers,
        )
        assert run_resp.status_code == 201
        run_data = run_resp.json()
        run_id = run_data["run_id"]
        assert run_data["goal"] == "Verify Architecture Standards"
        assert run_data["verification"]["status"] == "VERIFIED"

        # 2. Get Run
        get_resp = await client.get(
            f"/api/v1/companies/{company_id}/orchestration/runs/{run_id}",
            headers=auth_headers,
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["run_id"] == run_id

        # 3. Recover Run
        rec_resp = await client.post(
            f"/api/v1/companies/{company_id}/orchestration/runs/{run_id}/recover",
            headers=auth_headers,
        )
        assert rec_resp.status_code == 200
        rec_data = rec_resp.json()
        assert rec_data["run_id"] == run_id

    async def test_events_endpoint(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.get(
            f"/api/v1/companies/{company_id}/orchestration/events",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
