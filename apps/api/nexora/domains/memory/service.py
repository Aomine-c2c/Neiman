"""
Service layer for NEIMAN Organizational Memory System.
Coordinates storage, search, decision tracking, context assembly, and seed data.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    MemoryDomain,
    MemoryScope,
    ProvenanceType,
)
from nexora.domains.memory.context_engine import ContextAssemblyEngine
from nexora.domains.memory.models import DecisionRecord, MemoryItem
from nexora.domains.memory.repository import MemoryRepository
from nexora.domains.memory.schemas import (
    ContextAssemblyRequest,
    ContextAssemblyResponse,
    DecisionRecordCreate,
    DecisionRecordOutcomeUpdate,
    MemoryItemCreate,
)
from nexora.exceptions import NotFoundError


class MemoryService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MemoryRepository(db)

    # -------------------------------------------------------------
    # DEFAULT SEED MEMORIES
    # -------------------------------------------------------------
    async def ensure_baseline_memories(self, company_id: uuid.UUID) -> list[MemoryItem]:
        existing_charter = await self.repo.search_memories(
            company_id, query="Operating Principles", limit=1
        )
        if existing_charter:
            return await self.repo.list_memories(company_id, limit=20)

        # Seed realistic baseline memories across multiple domains
        seed_data = [
            (
                MemoryDomain.COMPANY.value,
                MemoryScope.PUBLIC.value,
                "Company Operating Principles",
                "NEIMAN operates as an autonomous, self-coordinating organizational operating system with strict capability-based security.",
                "Autonomous organization OS principles and core mission.",
                ProvenanceType.POLICY_DOCUMENT.value,
                "Founding Charter",
                1.0,
                ["culture", "operating-principles"],
            ),
            (
                MemoryDomain.POLICY.value,
                MemoryScope.INTERNAL.value,
                "Model Provider Data Classification Standard",
                "Confidential customer personally identifiable data must never be transmitted to non-enterprise AI model endpoints without explicit sanitization.",
                "Customer PII must be sanitized before inference routing.",
                ProvenanceType.POLICY_DOCUMENT.value,
                "Security Policy v1.2",
                1.0,
                ["security", "compliance", "privacy"],
            ),
            (
                MemoryDomain.FAILURE.value,
                MemoryScope.INTERNAL.value,
                "Post-Mortem: Unbounded Token Consumption Incident",
                "In Q2, recursive agent reflection loops caused runaway API spend. Resolution: Enforce maximum token ceilings and timeout guardrails on all agent execution lifecycles.",
                "Recursive agent loop mitigation and hard ceiling policies.",
                ProvenanceType.DECISION_OUTCOME.value,
                "Incident INC-204",
                0.95,
                ["postmortem", "incident", "tokens"],
            ),
            (
                MemoryDomain.DECISION.value,
                MemoryScope.INTERNAL.value,
                "Architecture: Multi-Provider Intelligence Routing",
                "Decided to abstract all AI models behind an organizational Intelligence Exchange rather than hardcoding vendor SDKs into agents.",
                "Vendor decoupling via capability-based routing.",
                ProvenanceType.SYSTEM_SYNTHESIS.value,
                "Architecture Decision Record ADR-003",
                1.0,
                ["architecture", "adr", "intelligence"],
            ),
            (
                MemoryDomain.KNOWLEDGE_BASE.value,
                MemoryScope.PUBLIC.value,
                "Engineering Workflow Standards",
                "All domain modules must feature repository, service, and schema layers with async SQLAlchemy 2.0 and Pydantic V2 verification.",
                "Standard engineering domain architectural pattern.",
                ProvenanceType.HUMAN_INPUT.value,
                "Engineering Playbook",
                1.0,
                ["engineering", "playbook", "standards"],
            ),
        ]

        created = []
        for domain, scope, title, content, summary, prov, src, conf, tags in seed_data:
            item = await self.repo.create_memory_item(
                company_id=company_id,
                domain=domain,
                scope=scope,
                title=title,
                content=content,
                summary=summary,
                provenance_type=prov,
                source=src,
                confidence=conf,
                tags=tags,
            )
            created.append(item)
        return created

    # -------------------------------------------------------------
    # MEMORY ITEMS
    # -------------------------------------------------------------
    async def create_memory(
        self,
        company_id: uuid.UUID,
        data: MemoryItemCreate,
        owner_id: uuid.UUID | None = None,
    ) -> MemoryItem:
        item = await self.repo.create_memory_item(
            company_id=company_id,
            domain=data.domain.value,
            title=data.title,
            content=data.content,
            summary=data.summary,
            scope=data.scope.value,
            department_id=data.department_id,
            agent_id=data.agent_id,
            project_id=data.project_id,
            task_id=data.task_id,
            provenance_type=data.provenance_type.value,
            source=data.source,
            owner_id=owner_id,
            confidence=data.confidence,
            relevance_score=data.relevance_score,
            required_permissions=data.required_permissions,
            retention_policy=data.retention_policy.value,
            tags=data.tags,
            extra_metadata=data.metadata,
        )

        # Index into LanceDB semantic vector store asynchronously / non-blocking
        try:
            from nexora.domains.memory.vector_store import LanceVectorStore

            LanceVectorStore.get_instance().upsert_memory(
                memory_id=str(item.id),
                company_id=str(company_id),
                domain=item.domain,
                scope=item.scope,
                title=item.title,
                summary=item.summary or "",
                content=item.content,
            )
        except Exception:
            pass

        return item

    async def get_memory(self, company_id: uuid.UUID, memory_id: uuid.UUID) -> MemoryItem:
        item = await self.repo.get_memory_item(memory_id, company_id)
        if not item:
            raise NotFoundError("MemoryItem not found.")
        await self.repo.increment_access(item)
        return item

    async def list_memories(
        self,
        company_id: uuid.UUID,
        domain: str | None = None,
        scope: str | None = None,
        department_id: uuid.UUID | None = None,
        agent_id: uuid.UUID | None = None,
        project_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[MemoryItem]:
        await self.ensure_baseline_memories(company_id)
        return await self.repo.list_memories(
            company_id=company_id,
            domain=domain,
            scope=scope,
            department_id=department_id,
            agent_id=agent_id,
            project_id=project_id,
            limit=limit,
        )

    async def search_memories(
        self,
        company_id: uuid.UUID,
        query: str,
        domain: str | None = None,
        scope: str | None = None,
        limit: int = 20,
    ) -> list[MemoryItem]:
        await self.ensure_baseline_memories(company_id)
        return await self.repo.search_memories(
            company_id=company_id,
            query=query,
            domain=domain,
            scope=scope,
            limit=limit,
        )

    # -------------------------------------------------------------
    # CONTEXT ASSEMBLY (TASK -> RELEVANT -> AUTHORIZED -> MINIMAL)
    # -------------------------------------------------------------
    async def assemble_context_for_task(
        self,
        company_id: uuid.UUID,
        request: ContextAssemblyRequest,
    ) -> ContextAssemblyResponse:
        await self.ensure_baseline_memories(company_id)
        candidate_memories = await self.repo.list_memories(company_id, limit=200)

        return ContextAssemblyEngine.assemble_minimal_context(
            request=request,
            candidate_memories=candidate_memories,
            company_id=str(company_id),
        )

    # -------------------------------------------------------------
    # DECISION RECORDS
    # -------------------------------------------------------------
    async def create_decision_record(
        self,
        company_id: uuid.UUID,
        data: DecisionRecordCreate,
        user_id: uuid.UUID | None = None,
    ) -> DecisionRecord:
        # Also persist a corresponding MemoryItem in DECISION domain for unified context search
        memory_item = await self.repo.create_memory_item(
            company_id=company_id,
            domain=MemoryDomain.DECISION.value,
            title=f"Decision: {data.title}",
            content=f"Problem: {data.problem}\nDecision: {data.decision}\nRationale: {data.rationale}",
            summary=f"{data.title}: {data.decision}",
            scope=MemoryScope.INTERNAL.value,
            provenance_type=ProvenanceType.DECISION_OUTCOME.value,
            source="Organizational Deliberation",
            owner_id=user_id,
            confidence=1.0,
            tags=["decision", "deliberation"],
        )

        return await self.repo.create_decision_record(
            company_id=company_id,
            title=data.title,
            problem=data.problem,
            options=[opt.model_dump() for opt in data.options],
            evidence=[ev.model_dump() for ev in data.evidence],
            participants=[p.model_dump() for p in data.participants],
            decision=data.decision,
            rationale=data.rationale,
            expected_outcome=data.expected_outcome,
            actual_outcome=data.actual_outcome,
            lessons_learned=data.lessons_learned,
            decided_by_user_id=user_id,
            decided_by_agent_id=data.decided_by_agent_id,
            memory_item_id=memory_item.id,
        )

    async def list_decision_records(
        self, company_id: uuid.UUID, limit: int = 50
    ) -> list[DecisionRecord]:
        return await self.repo.list_decision_records(company_id, limit=limit)

    async def record_decision_outcome(
        self,
        company_id: uuid.UUID,
        record_id: uuid.UUID,
        data: DecisionRecordOutcomeUpdate,
    ) -> DecisionRecord:
        record = await self.repo.get_decision_record(record_id, company_id)
        if not record:
            raise NotFoundError("DecisionRecord not found.")

        updated = await self.repo.update_decision_outcome(
            record=record,
            actual_outcome=data.actual_outcome,
            lessons_learned=data.lessons_learned,
        )

        # If a failure or lesson learned occurred, record to FAILURE or LESSON domain
        if data.lessons_learned:
            await self.repo.create_memory_item(
                company_id=company_id,
                domain=MemoryDomain.FAILURE.value
                if "failed" in data.actual_outcome.lower()
                else MemoryDomain.DECISION.value,
                title=f"Outcome & Lessons: {record.title}",
                content=f"Outcome: {data.actual_outcome}\nLessons: {', '.join(data.lessons_learned)}",
                summary=f"Lessons from {record.title}",
                provenance_type=ProvenanceType.DECISION_OUTCOME.value,
                source="Post-Implementation Review",
                tags=["lessons-learned", "outcome-review"],
            )

        return updated

    # -------------------------------------------------------------
    # KNOWLEDGE GRAPH & AUTO-EXTRACTION
    # -------------------------------------------------------------
    async def extract_and_store_graph_facts(
        self, company_id: uuid.UUID, text: str, provenance: str | None = None
    ) -> int:
        """Auto-extracts entity relationships from unstructured text and registers them in Knowledge Graph."""
        from nexora.domains.memory.context_engine import KnowledgeGraphFactExtractor

        triples = KnowledgeGraphFactExtractor.extract_triples(text)
        created_count = 0
        for subj, pred, obj in triples:
            s_ent = await self.repo.get_or_create_entity(company_id=company_id, name=subj)
            o_ent = await self.repo.get_or_create_entity(company_id=company_id, name=obj)
            await self.repo.create_relation(
                company_id=company_id,
                source_id=s_ent.id,
                target_id=o_ent.id,
                relation_type=pred,
                provenance=provenance,
            )
            created_count += 1
        return created_count

    async def get_knowledge_graph(
        self,
        company_id: uuid.UUID,
        limit: int = 100,
        q: str | None = None,
        entity_type: str | None = None,
    ):
        """Returns nodes and edges for Knowledge Graph explorer with optional search and type filtering."""
        # Ensure seed entities exist if empty (only check baseline when not filtering)
        if not q and not entity_type:
            baseline_entities, _ = await self.repo.get_knowledge_graph(company_id, limit=1)
            if not baseline_entities:
                # Seed foundational system nodes
                e_sys = await self.repo.get_or_create_entity(
                    company_id, "NEIMAN OS", "SYSTEM", "Autonomous Organization Core Kernel"
                )
                e_gov = await self.repo.get_or_create_entity(
                    company_id, "Governance Council", "GOVERNANCE", "Autonomy Boundary Gatekeeper"
                )
                e_sec = await self.repo.get_or_create_entity(
                    company_id,
                    "Security Sandbox",
                    "SECURITY",
                    "Tool execution and filesystem chroot",
                )
                e_intel = await self.repo.get_or_create_entity(
                    company_id, "Intelligence Exchange", "ENGINE", "Multi-provider model router"
                )
                e_db = await self.repo.get_or_create_entity(
                    company_id,
                    "PostgreSQL/SQLite",
                    "DATABASE",
                    "Organizational ledger and memory triplestore",
                )

                await self.repo.create_relation(company_id, e_sys.id, e_gov.id, "ENFORCES")
                await self.repo.create_relation(company_id, e_gov.id, e_sec.id, "MANAGES")
                await self.repo.create_relation(company_id, e_sys.id, e_intel.id, "UTILIZES")
                await self.repo.create_relation(company_id, e_sys.id, e_db.id, "DEPENDS_ON")

        entities, relations = await self.repo.get_knowledge_graph(
            company_id,
            limit=limit,
            q=q,
            entity_type=entity_type,
        )
        return entities, relations
