"""
Resilience Engine: Bounded Retries with Exponential Backoff,
Durable Checkpoint Serialization, and Crash/Restart State Recovery.
"""

from __future__ import annotations

import hashlib
import json
import random
import uuid
from datetime import UTC, datetime
from typing import Any

from nexora.domains.orchestration.schemas import (
    DurableExecutionCheckpoint,
    OrchestrationStatus,
    RecoverableExecutionState,
)


class BoundedRetryManager:
    """
    Calculates bounded exponential backoff with deterministic or randomized jitter.
    Guarantees hard retry ceilings to prevent infinite execution loops.
    """

    @staticmethod
    def compute_backoff(
        attempt: int,
        initial_seconds: float = 1.0,
        backoff_factor: float = 2.0,
        max_seconds: float = 60.0,
        jitter: bool = True,
    ) -> float:
        """Computes exponential backoff delay: min(initial * (factor ** (attempt - 1)), max) + jitter."""
        if attempt <= 0:
            return 0.0
        delay = initial_seconds * (backoff_factor ** (attempt - 1))
        bounded = min(delay, max_seconds)
        if jitter:
            # 10% to 25% randomized jitter
            jitter_amount = random.uniform(0.1, 0.25) * bounded
            bounded += jitter_amount
        return round(bounded, 3)

    @staticmethod
    def can_retry(current_attempts: int, max_retries: int) -> bool:
        """Returns True if current retry count is strictly below configured max_retries."""
        return current_attempts < max_retries


class CheckpointManager:
    """
    Manages immutable execution checkpoints with cryptographic SHA-256 integrity signatures.
    """

    @staticmethod
    def compute_checkpoint_hash(
        run_id: str,
        task_id: str,
        step_index: int,
        step_name: str,
        state_snapshot: dict[str, Any],
        tokens: int,
        cost: float,
    ) -> str:
        serialized_state = json.dumps(state_snapshot, sort_keys=True, default=str)
        raw_payload = f"{run_id}:{task_id}:{step_index}:{step_name}:{serialized_state}:{tokens}:{cost:.6f}"
        return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

    @classmethod
    def create_checkpoint(
        cls,
        run_id: str,
        task_id: str,
        step_index: int,
        step_name: str,
        state_snapshot: dict[str, Any],
        tokens_consumed: int = 0,
        cost_usd: float = 0.0,
    ) -> DurableExecutionCheckpoint:
        signature = cls.compute_checkpoint_hash(
            run_id=run_id,
            task_id=task_id,
            step_index=step_index,
            step_name=step_name,
            state_snapshot=state_snapshot,
            tokens=tokens_consumed,
            cost=cost_usd,
        )
        return DurableExecutionCheckpoint(
            checkpoint_id=str(uuid.uuid4()),
            run_id=run_id,
            task_id=task_id,
            step_index=step_index,
            step_name=step_name,
            state_snapshot=dict(state_snapshot),
            tokens_consumed=tokens_consumed,
            cost_usd=cost_usd,
            timestamp=datetime.now(UTC),
            hash_signature=signature,
        )

    @classmethod
    def verify_checkpoint_integrity(cls, checkpoint: DurableExecutionCheckpoint) -> bool:
        expected = cls.compute_checkpoint_hash(
            run_id=checkpoint.run_id,
            task_id=checkpoint.task_id,
            step_index=checkpoint.step_index,
            step_name=checkpoint.step_name,
            state_snapshot=checkpoint.state_snapshot,
            tokens=checkpoint.tokens_consumed,
            cost=checkpoint.cost_usd,
        )
        return checkpoint.hash_signature == expected


class RecoveryManager:
    """
    Reconstructs execution state after process crash, timeout, or pause.
    Enables zero-duplicate execution by resuming from the exact point of interruption.
    """

    @staticmethod
    def reconstruct_state(
        run_id: str,
        checkpoints: list[DurableExecutionCheckpoint],
        total_steps: int,
    ) -> RecoverableExecutionState:
        if not checkpoints:
            return RecoverableExecutionState(
                run_id=run_id,
                status=OrchestrationStatus.PENDING,
                completed_steps=[],
                last_checkpoint=None,
                accumulated_state={},
                total_tokens_consumed=0,
                total_cost_usd=0.0,
                is_recoverable=True,
                recovery_reason="Fresh execution, no prior checkpoints.",
            )

        # Sort by step_index ascending
        sorted_cps = sorted(checkpoints, key=lambda cp: cp.step_index)

        # Verify cryptographic integrity of all checkpoints
        for cp in sorted_cps:
            if not CheckpointManager.verify_checkpoint_integrity(cp):
                return RecoverableExecutionState(
                    run_id=run_id,
                    status=OrchestrationStatus.FAILED,
                    is_recoverable=False,
                    recovery_reason=f"Checkpoint integrity violation at step {cp.step_index} ({cp.step_name}). Corrupted checkpoint hash.",
                )

        completed_indices = [cp.step_index for cp in sorted_cps]
        last_cp = sorted_cps[-1]

        # Consolidate state up to latest checkpoint
        accumulated: dict[str, Any] = {}
        total_tokens = sum(cp.tokens_consumed for cp in sorted_cps)
        total_cost = sum(cp.cost_usd for cp in sorted_cps)
        for cp in sorted_cps:
            accumulated.update(cp.state_snapshot)

        # If all steps are completed
        if len(completed_indices) >= total_steps:
            return RecoverableExecutionState(
                run_id=run_id,
                status=OrchestrationStatus.COMPLETED,
                completed_steps=completed_indices,
                last_checkpoint=last_cp,
                accumulated_state=accumulated,
                total_tokens_consumed=total_tokens,
                total_cost_usd=total_cost,
                is_recoverable=False,
                recovery_reason="All steps already completed.",
            )

        return RecoverableExecutionState(
            run_id=run_id,
            status=OrchestrationStatus.PAUSED,
            completed_steps=completed_indices,
            last_checkpoint=last_cp,
            accumulated_state=accumulated,
            total_tokens_consumed=total_tokens,
            total_cost_usd=total_cost,
            is_recoverable=True,
            recovery_reason=f"Ready to resume from step {last_cp.step_index + 1}.",
        )
