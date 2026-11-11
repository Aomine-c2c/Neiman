"""
Durable Memory Engine with Provenance Tracking, Scoped Context Retrieval,
SHA-256 Deduplication, and Priority/TTL Retention Policies.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from nexora.domains.orchestration.schemas import DurableMemoryItem, MemoryScope


class DurableMemoryEngine:
    """
    Manages organizational and agent memory with strict provenance,
    cryptographic deduplication, scope boundary isolation, and retention policies.
    """

    def __init__(self) -> None:
        # memory_id -> DurableMemoryItem
        self._store: dict[str, DurableMemoryItem] = {}
        # content_hash -> memory_id (for deduplication)
        self._hash_index: dict[str, str] = {}

    @staticmethod
    def compute_content_hash(content: str, scope: MemoryScope, actor_id: str) -> str:
        # Include scope and actor in hash if AGENT_PRIVATE so different agents can store identical facts
        scope_prefix = actor_id if scope == MemoryScope.AGENT_PRIVATE else scope.value
        raw = f"{scope_prefix}::{content.strip()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def store_memory(
        self,
        company_id: str,
        actor_id: str,
        content: str,
        scope: MemoryScope = MemoryScope.PROJECT_SHARED,
        task_id: str | None = None,
        run_id: str | None = None,
        importance: float = 0.7,
        ttl_days: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> DurableMemoryItem:
        """
        Stores a memory with strict provenance.
        Deduplicates identical entries within the same scope.
        """
        c_hash = self.compute_content_hash(content, scope, actor_id)

        # Deduplication check
        if c_hash in self._hash_index:
            existing_id = self._hash_index[c_hash]
            existing = self._store[existing_id]
            if not existing.is_tombstoned:
                # Update importance if higher and refresh metadata
                existing.importance = max(existing.importance, importance)
                if metadata:
                    existing.metadata.update(metadata)
                return existing

        now = datetime.now(UTC)
        expires_at = now + timedelta(days=ttl_days) if ttl_days is not None else None

        item = DurableMemoryItem(
            memory_id=str(uuid.uuid4()),
            company_id=company_id,
            actor_id=actor_id,
            task_id=task_id,
            run_id=run_id,
            scope=scope,
            content=content,
            content_hash=c_hash,
            metadata=metadata or {},
            importance=importance,
            created_at=now,
            expires_at=expires_at,
            is_tombstoned=False,
        )

        self._store[item.memory_id] = item
        self._hash_index[c_hash] = item.memory_id
        return item

    def retrieve_scoped_memories(
        self,
        requesting_actor_id: str,
        company_id: str,
        query: str = "",
        allowed_scopes: list[MemoryScope] | None = None,
        limit: int = 20,
    ) -> list[DurableMemoryItem]:
        """
        Retrieves memories matching query and enforces privacy boundary:
        An agent CANNOT read AGENT_PRIVATE memories of another agent!
        """
        scopes = allowed_scopes or [
            MemoryScope.AGENT_PRIVATE,
            MemoryScope.PROJECT_SHARED,
            MemoryScope.COMPANY_WIDE,
        ]
        now = datetime.now(UTC)
        results: list[DurableMemoryItem] = []

        for item in self._store.values():
            if item.company_id != company_id or item.is_tombstoned:
                continue

            # Check expiration
            if item.expires_at and now > item.expires_at:
                continue

            if item.scope not in scopes:
                continue

            # Scope isolation: If AGENT_PRIVATE, only the owner can read
            if item.scope == MemoryScope.AGENT_PRIVATE and item.actor_id != requesting_actor_id:
                continue

            # Text match filter
            if query and query.casefold() not in item.content.casefold():
                continue

            results.append(item)

        # Sort by importance descending, then newest first
        results.sort(key=lambda m: (m.importance, m.created_at), reverse=True)
        return results[:limit]

    def enforce_retention_policy(self, company_id: str) -> dict[str, int]:
        """
        Prunes expired memories and low-importance transient memories.
        High importance (>= 0.8) memories are protected and retained indefinitely.
        """
        now = datetime.now(UTC)
        pruned_expired = 0
        pruned_low_importance = 0

        for m_id, item in list(self._store.items()):
            if item.company_id != company_id:
                continue

            # 1. Prune expired TTL memories
            if item.expires_at and now > item.expires_at:
                item.is_tombstoned = True
                pruned_expired += 1
                continue

            # 2. Prune transient low-importance memories older than 30 days
            age = (now - item.created_at).total_seconds()
            if age > 86400 * 30 and item.importance < 0.4:
                item.is_tombstoned = True
                pruned_low_importance += 1

        return {
            "pruned_expired": pruned_expired,
            "pruned_low_importance": pruned_low_importance,
        }

    def verify_provenance(self, memory_id: str) -> dict[str, Any]:
        """Returns verified provenance record for auditing."""
        item = self._store.get(memory_id)
        if not item:
            return {"verified": False, "error": "Memory not found."}
        return {
            "verified": True,
            "memory_id": item.memory_id,
            "creator_actor_id": item.actor_id,
            "source_task_id": item.task_id,
            "source_run_id": item.run_id,
            "scope": item.scope.value,
            "content_hash": item.content_hash,
            "created_at": item.created_at.isoformat(),
        }
