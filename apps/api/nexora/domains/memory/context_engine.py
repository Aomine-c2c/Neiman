"""
Context Assembly Engine for NEIMAN Organizational Memory System.

Core Architectural Law:
- External model providers must NOT automatically receive the entire company memory.
- Only authorized, task-relevant context should be transmitted.
- Context assembly pipeline:
  TASK
  → identify required knowledge
  → retrieve relevant memories
  → apply permissions
  → rank relevance
  → construct context
  → send minimal necessary context to model
"""

import re

from nexora.core.enums import MemoryDomain, MemoryScope
from nexora.domains.memory.models import MemoryItem
from nexora.domains.memory.schemas import (
    AssembledMemorySnippet,
    ContextAssemblyRequest,
    ContextAssemblyResponse,
)


class ContextAssemblyEngine:
    @staticmethod
    def identify_required_domains(
        task_objective: str, explicit_domains: list[MemoryDomain] | None
    ) -> list[str]:
        """
        Identify which of the 10 memory domains are needed for this task.
        Uses explicit request if provided; otherwise infers from keywords.
        """
        if explicit_domains:
            return [d.value for d in explicit_domains]

        text = task_objective.lower()
        domains = set()

        if any(w in text for w in ["customer", "client", "churn", "support", "ticket", "user"]):
            domains.add(MemoryDomain.CUSTOMER.value)
        if any(w in text for w in ["policy", "compliance", "rule", "legal", "gdpr", "standard"]):
            domains.add(MemoryDomain.POLICY.value)
        if any(w in text for w in ["decision", "tradeoff", "strategy", "architecture"]):
            domains.add(MemoryDomain.DECISION.value)
        if any(w in text for w in ["experiment", "test", "ab test", "hypothesis", "benchmark"]):
            domains.add(MemoryDomain.EXPERIMENT.value)
        if any(w in text for w in ["fail", "incident", "bug", "crash", "postmortem", "error"]):
            domains.add(MemoryDomain.FAILURE.value)
        if any(w in text for w in ["project", "milestone", "sprint", "roadmap", "task"]):
            domains.add(MemoryDomain.PROJECT.value)
        if any(w in text for w in ["department", "sales", "marketing", "engineering", "finance"]):
            domains.add(MemoryDomain.DEPARTMENT.value)

        # Baseline knowledge base and company culture are commonly relevant
        domains.add(MemoryDomain.KNOWLEDGE_BASE.value)
        domains.add(MemoryDomain.COMPANY.value)

        return list(domains)

    @staticmethod
    def is_authorized(item: MemoryItem, caller_role: str, caller_permissions: list[str]) -> bool:
        """
        Check if the caller (agent or user) is authorized to access this memory item.
        Respects scopes (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, PRIVATE)
        and explicit required_permissions tags.
        """
        # 1. Scope hierarchy check
        role_levels = {
            "OWNER": 100,
            "ADMIN": 80,
            "MANAGER": 60,
            "MEMBER": 40,
            "VIEWER": 20,
        }
        level = role_levels.get(caller_role.upper(), 40)

        if item.scope == MemoryScope.RESTRICTED.value and level < 80:  # Admin/Owner only
            return False
        if item.scope == MemoryScope.CONFIDENTIAL.value and level < 60:  # Manager+ only
            return False
        if item.scope == MemoryScope.PRIVATE.value and level < 100:
            return False

        # 2. Specific permissions check (if required_permissions is specified)
        if item.required_permissions:
            caller_set = set(caller_permissions)
            # If caller has admin override or matches required tag
            if "role:ADMIN" in caller_set or "role:OWNER" in caller_set:
                return True
            if not any(req in caller_set for req in item.required_permissions):
                return False

        return True

    @staticmethod
    def calculate_relevance(item: MemoryItem, task_objective: str) -> float:
        """
        Calculate semantic/keyword relevance between memory content and task objective.
        Combines intrinsic relevance score, confidence, and keyword overlap.
        """
        tokens = set(re.findall(r"\w+", task_objective.lower()))
        item_text = (f"{item.title} {item.summary or ''} {item.content}").lower()

        overlap = sum(1 for t in tokens if len(t) > 3 and t in item_text)
        keyword_score = min(5.0, overlap * 1.5)

        total_score = (item.relevance_score * 0.4) + (item.confidence * 2.0) + keyword_score
        return round(total_score, 2)

    @classmethod
    def assemble_minimal_context(
        cls,
        request: ContextAssemblyRequest,
        candidate_memories: list[MemoryItem],
        company_id: str | None = None,
    ) -> ContextAssemblyResponse:
        """
        Executes full context assembly:
        1. Filters by authorization
        2. Scores and ranks by task relevance (incorporating LanceDB semantic vector distance when available)
        3. Formulates minimal, clean, non-leaking prompt segment
        """
        required_domains = cls.identify_required_domains(
            request.task_objective, request.target_domains
        )

        # Retrieve LanceDB semantic matches if company_id is provided
        vector_scores: dict[str, float] = {}
        if company_id:
            try:
                from nexora.domains.memory.vector_store import LanceVectorStore

                vs = LanceVectorStore.get_instance()
                matches = vs.search_hybrid(
                    company_id=str(company_id),
                    query=request.task_objective,
                    target_domains=required_domains,
                    limit=request.max_items * 2,
                )
                for m in matches:
                    m_id = str(m.get("id"))
                    # Convert distance to bonus score (lower distance = higher score)
                    dist = float(m.get("_distance", 1.0))
                    bonus = max(0.0, (1.0 - dist) * 10.0)
                    vector_scores[m_id] = bonus
            except Exception:
                pass

        # 1. Filter by domain and authorization
        authorized = []
        for mem in candidate_memories:
            if mem.domain in required_domains:
                if cls.is_authorized(mem, request.caller_role, request.caller_permissions):
                    base_score = cls.calculate_relevance(mem, request.task_objective)
                    semantic_bonus = vector_scores.get(str(mem.id), 0.0)
                    total_score = round(base_score + semantic_bonus, 2)
                    authorized.append((total_score, mem))

        # 2. Sort by relevance descending
        authorized.sort(key=lambda x: x[0], reverse=True)

        # 3. Select top N up to max_items and max_context_tokens
        selected_items: list[tuple[float, MemoryItem]] = authorized[: request.max_items]

        # 4. Construct minimal prompt and snippet list
        snippets = []
        prompt_parts = [
            "### ORGANIZATIONAL CONTEXT (MINIMAL RELEVANT KNOWLEDGE)",
            f"Task Objective: {request.task_objective}",
            "---",
        ]

        total_estimated_tokens = 20  # base framing tokens
        for score, item in selected_items:
            from nexora.core.security import FillerScrubber

            raw_text = item.summary if item.summary else item.content[:300]
            excerpt = FillerScrubber.strip_filler(raw_text)
            if len(item.content) > 300 and not item.summary:
                excerpt += "..."

            item_tokens = len(excerpt.split()) + 20
            if total_estimated_tokens + item_tokens > request.max_context_tokens:
                break

            total_estimated_tokens += item_tokens
            snippets.append(
                AssembledMemorySnippet(
                    memory_id=item.id,
                    domain=item.domain,
                    title=item.title,
                    excerpt=excerpt,
                    relevance_score=score,
                    confidence=item.confidence,
                    source=item.source,
                )
            )

            prompt_parts.append(
                f"[{item.domain} MEMORY] {item.title} (Confidence: {int(item.confidence * 100)}%)\n"
                f"{excerpt}\n"
            )

        # 5. Inject Pre-Indexed Codebase Knowledge Graph Context (Zero-grep traversal)
        try:
            from nexora.domains.memory.code_graph import CodebaseKnowledgeGraphEngine

            code_engine = CodebaseKnowledgeGraphEngine()
            code_ctx = code_engine.assemble_code_context(request.task_objective, max_symbols=8)
            if code_ctx:
                prompt_parts.append(code_ctx)
                total_estimated_tokens += len(code_ctx.split())
        except Exception:
            pass

        prompt_parts.append("---")
        raw_assembled_prompt = "\n".join(prompt_parts)

        # Apply least-privilege context transmission: scrub all embedded secrets and PII
        from nexora.core.security import PromptSanitizer

        sanitized_prompt = PromptSanitizer.sanitize_for_external_llm(raw_assembled_prompt)

        # Apply Built-in Token Compression
        compression_applied = False
        uncompressed_tokens = total_estimated_tokens
        tokens_saved = 0
        compression_ratio = 0.0

        if getattr(request, "compress_context", True):
            from nexora.core.compression import TokenCompressor

            strat = getattr(request, "compression_strategy", "AGGRESSIVE")
            comp_res = TokenCompressor.compress(sanitized_prompt, strategy=strat)
            assembled_prompt = comp_res.compressed_text
            compression_applied = True
            uncompressed_tokens = comp_res.original_tokens
            total_estimated_tokens = comp_res.compressed_tokens
            tokens_saved = comp_res.tokens_saved
            compression_ratio = comp_res.compression_ratio_pct
        else:
            assembled_prompt = sanitized_prompt

        return ContextAssemblyResponse(
            task_objective=request.task_objective,
            total_memories_evaluated=len(candidate_memories),
            authorized_memories_selected=len(snippets),
            estimated_context_tokens=total_estimated_tokens,
            domains_consulted=required_domains,
            assembled_context_prompt=assembled_prompt,
            snippets=snippets,
            compression_applied=compression_applied,
            uncompressed_context_tokens=uncompressed_tokens,
            tokens_saved=tokens_saved,
            compression_ratio_pct=round(compression_ratio, 2),
        )


class KnowledgeGraphFactExtractor:
    """
    Lightweight, high-density entity & relation extractor and sub-graph fact formatter.
    Replaces verbose document blocks with high-information triples, reducing context tokens by 60-80%.
    """

    RELATION_PATTERNS = [
        (
            r"(?i)\b([\w\.\-]+)\s+(?:uses|utilizes|connects to|depends on)\s+([\w\.\-]+)\b",
            "DEPENDS_ON",
        ),
        (r"(?i)\b([\w\.\-]+)\s+(?:handles|processes|manages)\s+([\w\.\-]+)\b", "MANAGES"),
        (r"(?i)\b([\w\.\-]+)\s+(?:enforces|requires|restricts)\s+([\w\.\-]+)\b", "ENFORCES"),
        (r"(?i)\b([\w\.\-]+)\s+(?:belongs to|part of)\s+([\w\.\-]+)\b", "PART_OF"),
    ]

    @classmethod
    def extract_triples(cls, text: str) -> list[tuple[str, str, str]]:
        """Extracts candidate (subject, predicate, object) relations from text."""
        triples: list[tuple[str, str, str]] = []
        for pattern, predicate in cls.RELATION_PATTERNS:
            matches = re.findall(pattern, text)
            for subj, obj in matches:
                s_clean = subj.strip()
                o_clean = obj.strip()
                if len(s_clean) > 2 and len(o_clean) > 2 and s_clean.lower() != o_clean.lower():
                    triples.append((s_clean, predicate, o_clean))
        return list(set(triples))

    @classmethod
    def format_subgraph_facts(cls, triples: list[tuple[str, str, str]], max_facts: int = 15) -> str:
        """Formats 1-2 hop triples into ultra-compact, token-efficient markdown fact fragments."""
        if not triples:
            return ""
        lines = ["### KNOWLEDGE GRAPH FACTS"]
        for s, p, o in triples[:max_facts]:
            lines.append(f"- [{s}] --({p.lower()})--> [{o}]")
        return "\n".join(lines)
