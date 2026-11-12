"""
REST API Router for NEIMAN Organizational Memory System.
Endpoints for:
- 10-domain memory items management
- Searchable Knowledge Base interface
- Context Assembly Engine (Task -> Authorized -> Relevant -> Minimal prompt)
- Decision Records (deliberation, options, evidence, outcomes, lessons learned)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_member
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.memory.code_graph import (
    CodebaseGraphIndexSummary,
    CodebaseKnowledgeGraphEngine,
    CodebaseSubgraphResponse,
    HybridSearchResponse,
    SymbolSearchResponse,
)
from nexora.domains.memory.source_graph import (
    BlastRadiusResponse,
    SourceFileViewResponse,
    SourceGraphSearchResponse,
    SourceGraphService,
    SymbolDefinitionResult,
    SymbolReferencesResult,
)
from nexora.domains.memory.graphify import GraphifyEngine, GraphifyNetworkResponse
from nexora.domains.memory.memgpt import (
    CoreMemoryBlockSchema,
    CoreMemoryUpdateSchema,
    MemGPTEngine,
    MemGPTPromptContext,
)
from nexora.domains.memory.schemas import (
    ContextAssemblyRequest,
    ContextAssemblyResponse,
    DecisionRecordCreate,
    DecisionRecordOutcomeUpdate,
    DecisionRecordResponse,
    MemoryItemCreate,
    MemoryItemResponse,
)
from nexora.domains.memory.service import MemoryService

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(prefix="/companies/{company_id}/memory", tags=["Organizational Memory"])


@router.get("/items", response_model=list[MemoryItemResponse])
async def list_memories(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    domain: str | None = Query(
        None,
        description="COMPANY | DEPARTMENT | AGENT | PROJECT | CUSTOMER | DECISION | POLICY | EXPERIMENT | FAILURE | KNOWLEDGE_BASE",
    ),
    scope: str | None = Query(
        None, description="PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED | PRIVATE"
    ),
    department_id: uuid.UUID | None = None,
    agent_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    _: None = Depends(require_member()),
):
    service = MemoryService(db)
    return await service.list_memories(
        company_id=company_id,
        domain=domain,
        scope=scope,
        department_id=department_id,
        agent_id=agent_id,
        project_id=project_id,
        limit=limit,
    )


@router.post("/items", response_model=MemoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_memory_item(
    company_id: uuid.UUID,
    data: MemoryItemCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    service = MemoryService(db)
    return await service.create_memory(company_id, data, owner_id=current_user.id)


@router.get("/items/{memory_id}", response_model=MemoryItemResponse)
async def get_memory_item(
    company_id: uuid.UUID,
    memory_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    service = MemoryService(db)
    return await service.get_memory(company_id, memory_id)


@router.get("/search", response_model=list[MemoryItemResponse])
async def search_knowledge_base(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    q: str = Query(..., min_length=1, description="Search keywords"),
    domain: str | None = Query(None),
    scope: str | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
    _: None = Depends(require_member()),
):
    """
    Searchable organizational knowledge base interface across all 10 memory domains.
    """
    service = MemoryService(db)
    return await service.search_memories(
        company_id, query=q, domain=domain, scope=scope, limit=limit
    )


@router.post("/assemble-context", response_model=ContextAssemblyResponse)
async def assemble_context(
    company_id: uuid.UUID,
    data: ContextAssemblyRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Task Context Assembly Engine:
    TASK -> identify required knowledge -> retrieve memories -> apply permissions -> rank relevance -> construct minimal prompt.
    Ensures external AI models never receive unauthorized or excess company memory.
    """
    service = MemoryService(db)
    return await service.assemble_context_for_task(company_id, data)


# ==========================================
# DECISION RECORDS
# ==========================================


@router.get("/decisions", response_model=list[DecisionRecordResponse])
async def list_decision_records(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(50, ge=1, le=100),
    _: None = Depends(require_member()),
):
    service = MemoryService(db)
    return await service.list_decision_records(company_id, limit=limit)


@router.post(
    "/decisions", response_model=DecisionRecordResponse, status_code=status.HTTP_201_CREATED
)
async def create_decision_record(
    company_id: uuid.UUID,
    data: DecisionRecordCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    service = MemoryService(db)
    return await service.create_decision_record(company_id, data, user_id=current_user.id)


@router.post("/decisions/{decision_id}/outcome", response_model=DecisionRecordResponse)
async def record_decision_outcome(
    company_id: uuid.UUID,
    decision_id: uuid.UUID,
    data: DecisionRecordOutcomeUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Record actual outcome and lessons learned to enable ongoing organizational learning.
    """
    service = MemoryService(db)
    return await service.record_decision_outcome(company_id, decision_id, data)


# ==========================================
# KNOWLEDGE GRAPH TRIPLES
# ==========================================


@router.get("/graph", response_model=dict)
async def get_knowledge_graph(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None, description="Search term matching entity name or description"),
    entity_type: str | None = Query(
        None,
        description="Filter by entity type (SYSTEM, GOVERNANCE, SECURITY, ENGINE, DATABASE, CONCEPT, etc.)",
    ),
    _: None = Depends(require_member()),
):
    """
    Returns full or sub-graph nodes and edges for the company knowledge graph,
    supporting interactive full-text search and entity type filtering.
    """
    service = MemoryService(db)
    entities, relations = await service.get_knowledge_graph(
        company_id,
        limit=limit,
        q=q,
        entity_type=entity_type,
    )
    return {
        "entities": [
            {
                "id": str(e.id),
                "name": e.name,
                "entity_type": e.entity_type,
                "description": e.description,
                "properties": e.properties,
            }
            for e in entities
        ],
        "relations": [
            {
                "id": str(r.id),
                "source_id": str(r.source_id),
                "target_id": str(r.target_id),
                "relation_type": r.relation_type,
                "weight": r.weight,
                "provenance": r.provenance,
            }
            for r in relations
        ],
        "total_entities": len(entities),
        "total_relations": len(relations),
        "query": q,
        "entity_type": entity_type,
    }


@router.post("/graph/extract", response_model=dict)
async def extract_knowledge_facts(
    company_id: uuid.UUID,
    data: dict,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Extracts semantic triples from raw text and registers them into the Knowledge Graph.
    """
    service = MemoryService(db)
    text = data.get("text", "")
    provenance = data.get("provenance", "manual_extraction")
    count = await service.extract_and_store_graph_facts(company_id, text, provenance=provenance)
    return {"status": "ok", "facts_extracted": count}


# ==========================================
# MEMGPT VIRTUAL HIERARCHICAL CONTEXT
# ==========================================


@router.get("/agents/{agent_id}/memgpt", response_model=MemGPTPromptContext)
async def get_agent_memgpt_context(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Retrieves full MemGPT virtual context: Core Memory (Persona & Human blocks)
    plus active FIFO Recall queue and eviction counters.
    """
    engine = MemGPTEngine(db)
    # Ensure initialized
    await engine.initialize_agent_core_memory(
        agent_id, company_id, persona_text="Autonomous NEIMAN Agent Specialist."
    )
    return await engine.assemble_memgpt_prompt_context(agent_id, company_id)


@router.get("/agents/{agent_id}/memgpt/blocks", response_model=list[CoreMemoryBlockSchema])
async def list_agent_core_memory_blocks(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Lists the agent's Core Memory blocks (RAM) e.g. persona, human, scratchpad.
    """
    engine = MemGPTEngine(db)
    await engine.initialize_agent_core_memory(
        agent_id, company_id, persona_text="Autonomous NEIMAN Agent Specialist."
    )
    return await engine.get_core_memory_blocks(agent_id)


@router.post("/agents/{agent_id}/memgpt/blocks", response_model=CoreMemoryBlockSchema)
async def update_agent_core_memory_block(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    payload: CoreMemoryUpdateSchema,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Direct self-editing tool for agent or user: updates core_memory block (replace or append).
    """
    engine = MemGPTEngine(db)
    return await engine.update_core_memory(agent_id, company_id, payload)


@router.post("/agents/{agent_id}/memgpt/recall", response_model=dict)
async def append_agent_recall_message(
    company_id: uuid.UUID,
    agent_id: uuid.UUID,
    payload: dict,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Appends a message to the agent's FIFO recall queue and triggers automatic eviction when full.
    """
    engine = MemGPTEngine(db)
    role = payload.get("role", "user")
    message = payload.get("message", "")
    log = await engine.append_recall_message(agent_id, company_id, role=role, message=message)
    return {
        "status": "ok",
        "log_id": str(log.id),
        "is_evicted": log.is_evicted,
        "estimated_tokens": log.estimated_tokens,
    }


# ==========================================
# GRAPHIFY & OBSIDIAN BIDIRECTIONAL GRAPH
# ==========================================


@router.get("/graphify", response_model=GraphifyNetworkResponse)
async def get_graphify_network(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_member()),
):
    """
    Computes and returns the Graphify bidirectional network topology with
    Obsidian markdown vault export and central clustering metrics.
    """
    engine = GraphifyEngine(db)
    return await engine.build_network(company_id)


# ==========================================
# CODEBASE KNOWLEDGE GRAPH & PRE-INDEXING
# ==========================================


@router.get("/code-graph/index", response_model=CodebaseGraphIndexSummary)
async def get_codebase_graph_index(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    force_refresh: bool = Query(False, description="Force re-scan and rebuild codebase AST index"),
    sync_db: bool = Query(
        False, description="Persist top AST nodes to KnowledgeEntity and KnowledgeRelation"
    ),
    _: None = Depends(require_member()),
):
    """
    Retrieves or triggers the pre-indexed Codebase AST Knowledge Graph.
    Replaces brute-force grep filesystem searches with fast pre-compiled topological graphs.
    """
    engine = CodebaseKnowledgeGraphEngine(db=db)
    _idx, summary = engine.get_or_build_index(force_refresh=force_refresh)
    if sync_db:
        await engine.sync_to_database(company_id=company_id)
    return summary


@router.get("/code-graph/symbols", response_model=SymbolSearchResponse)
async def search_codebase_symbols(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    q: str = Query(
        ..., min_length=1, description="Symbol name, function, class, or module to lookup"
    ),
    limit: int = Query(25, ge=1, le=100),
    _: None = Depends(require_member()),
):
    """
    Instant symbol graph query: returns symbol definitions, callers, callees, and dependencies
    in sub-milliseconds from pre-indexed memory rather than grepping files.
    """
    engine = CodebaseKnowledgeGraphEngine(db=db)
    return engine.search_symbols(query=q, limit=limit)


@router.post("/code-graph/reindex", response_model=CodebaseGraphIndexSummary)
async def trigger_codebase_reindex(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    sync_vector: bool = Query(True, description="Embed and sync AST symbols to LanceDB vector index"),
    sync_db: bool = Query(True, description="Sync relational graph entities to database"),
    max_files: int = Query(2000, ge=50, le=10000),
    _: None = Depends(require_member()),
):
    """
    Triggers complete pre-indexing of the codebase AST Knowledge Graph and vector embeddings.
    """
    engine = CodebaseKnowledgeGraphEngine(db=db)
    _idx, summary = engine.get_or_build_index(
        force_refresh=True, max_files=max_files, sync_vector=sync_vector
    )
    if sync_db:
        await engine.sync_to_database(company_id=company_id)
    return summary


@router.get("/code-graph/hybrid", response_model=HybridSearchResponse)
async def hybrid_search_codebase(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    q: str = Query(..., min_length=1, description="Natural language objective or symbol query"),
    limit: int = Query(15, ge=1, le=50),
    _: None = Depends(require_member()),
):
    """
    Hybrid semantic vector retrieval + topological AST graph caller/callee traversal.
    """
    engine = CodebaseKnowledgeGraphEngine(db=db)
    return engine.hybrid_search(query=q, limit=limit)


@router.get("/code-graph/subgraph", response_model=CodebaseSubgraphResponse)
async def get_codebase_subgraph(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    symbol_id: str = Query(..., description="Root symbol ID or module path to expand"),
    depth: int = Query(2, ge=1, le=4),
    _: None = Depends(require_member()),
):
    """
    Returns localized topological neighborhood subgraph around a code symbol.
    """
    engine = CodebaseKnowledgeGraphEngine(db=db)
    return engine.get_subgraph(symbol_id=symbol_id, depth=depth)


# =====================================================================
# SOURCE GRAPH & CODE INTELLIGENCE ENDPOINTS
# =====================================================================


@router.get("/source-graph/file", response_model=SourceFileViewResponse)
async def get_source_file_view(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    file_path: str = Query(..., description="Relative workspace path of the source file"),
    start_line: int = Query(1, ge=1),
    max_lines: int = Query(1000, ge=10, le=5000),
    _: None = Depends(require_member()),
):
    """
    Retrieves source file content, associated AST symbols, imports, callers, and git blame.
    """
    service = SourceGraphService(company_id=str(company_id))
    try:
        return service.get_source_file(file_path=file_path, start_line=start_line, max_lines=max_lines)
    except FileNotFoundError:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Source file '{file_path}' not found.")
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/source-graph/definition", response_model=SymbolDefinitionResult | None)
async def get_symbol_definition(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    symbol: str = Query(..., min_length=1, description="Symbol name to resolve definition"),
    _: None = Depends(require_member()),
):
    """
    Resolves symbol definition: exact line number, declaration signature, docstring, and code snippet.
    """
    service = SourceGraphService(company_id=str(company_id))
    result = service.find_definition(symbol_name=symbol)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' definition not found in source graph.")
    return result


@router.get("/source-graph/references", response_model=SymbolReferencesResult)
async def get_symbol_references(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    symbol: str = Query(..., min_length=1, description="Symbol name to resolve references"),
    limit: int = Query(50, ge=1, le=200),
    _: None = Depends(require_member()),
):
    """
    Finds all caller sites, import occurrences, and references across the monorepo for a symbol.
    """
    service = SourceGraphService(company_id=str(company_id))
    return service.find_references(symbol_name=symbol, limit=limit)


@router.get("/source-graph/blast-radius", response_model=BlastRadiusResponse)
async def get_blast_radius(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    target: str = Query(..., min_length=1, description="Symbol name or file path to evaluate impact"),
    _: None = Depends(require_member()),
):
    """
    Computes transitive blast radius & risk level: affected downstream files, impacted HTTP endpoints, and tests.
    """
    service = SourceGraphService(company_id=str(company_id))
    return service.calculate_blast_radius(target=target)


@router.get("/source-graph/search", response_model=SourceGraphSearchResponse)
async def search_source_graph(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    q: str = Query(..., min_length=1, description="Sourcegraph query: e.g. 'lang:python type:class auth'"),
    limit: int = Query(30, ge=1, le=100),
    _: None = Depends(require_member()),
):
    """
    Advanced Sourcegraph-grade code and symbol search with filter tokens (lang:, file:, type:, regex).
    """
    service = SourceGraphService(company_id=str(company_id))
    return service.search_code(query=q, limit=limit)
