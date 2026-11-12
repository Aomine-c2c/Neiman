"""
Unit and integration tests for Codebase AST Pre-Indexing Knowledge Graph Engine.
"""

import os
from pathlib import Path
import pytest
from httpx import AsyncClient

from nexora.domains.memory.code_graph import (
    CodebaseAstIndexer,
    CodebaseKnowledgeGraphEngine,
)
from nexora.domains.memory.vector_store import LanceVectorStore


def test_codebase_ast_indexer_multi_language(tmp_path: Path):
    # 1. Create sample Python file with classes, functions, and router endpoints
    py_file = tmp_path / "auth_service.py"
    py_file.write_text(
        '''
"""Authentication microservice module."""
from fastapi import APIRouter
router = APIRouter()

class TokenManager:
    """Manages JWT security tokens."""
    def verify(self, token: str) -> bool:
        return True

@router.get("/tokens/active")
def get_active_tokens():
    mgr = TokenManager()
    return mgr.verify("test")
'''
    )

    # 2. Create sample TypeScript file with interface and route handler
    ts_file = tmp_path / "route.ts"
    ts_file.write_text(
        """
import { NextRequest } from 'next/server';

export interface UserSession {
    userId: string;
    role: string;
}

export async function GET(request: NextRequest) {
    return new Response(JSON.stringify({ status: 'ok' }));
}
"""
    )

    # 3. Create sample Rust file with struct and function
    rs_file = tmp_path / "engine.rs"
    rs_file.write_text(
        """
use crate::common::AppState;

pub struct SecurityEngine {
    pub cipher: String,
}

pub fn execute_policy(rule: &str) -> bool {
    true
}
"""
    )

    indexer = CodebaseAstIndexer(tmp_path)
    summary = indexer.scan_and_index()

    assert summary.indexed_files == 3
    assert summary.total_symbols >= 6
    assert summary.files_by_language.get("python") == 1
    assert summary.files_by_language.get("typescript") == 1
    assert summary.files_by_language.get("rust") == 1

    # Verify Endpoint extraction
    endpoint_nodes = [n for n in indexer.nodes.values() if n.kind == "ENDPOINT"]
    assert len(endpoint_nodes) >= 2
    ep_names = [e.name for e in endpoint_nodes]
    assert any("GET /tokens/active" in n for n in ep_names)
    assert any("[GET]" in n for n in ep_names)

    # Verify Class and Interface extraction
    assert any(n.name == "TokenManager" and n.kind == "CLASS" for n in indexer.nodes.values())
    assert any(n.name == "UserSession" and n.kind == "INTERFACE" for n in indexer.nodes.values())
    assert any(n.name == "SecurityEngine" and n.kind == "STRUCT" for n in indexer.nodes.values())

    # Verify dependency relations
    assert len(indexer.edges) >= 4
    assert any(e.relation == "DEFINES" for e in indexer.edges)


def test_lancedb_code_symbols_vector_storage(tmp_path: Path):
    store = LanceVectorStore(str(tmp_path / "lancedb"))
    symbols = [
        {
            "id": "fn:auth.py:verify_jwt",
            "name": "verify_jwt",
            "kind": "FUNCTION",
            "file_path": "auth.py",
            "signature": "def verify_jwt(token: str) -> bool",
            "docstring": "Verifies cryptographic RSA signatures on incoming authorization headers",
        },
        {
            "id": "class:db.py:DatabasePool",
            "name": "DatabasePool",
            "kind": "CLASS",
            "file_path": "db.py",
            "signature": "class DatabasePool",
            "docstring": "Manages async PostgreSQL connection leases and pool exhaustion",
        },
    ]

    count = store.upsert_code_symbols(symbols)
    assert count == 2

    # Query semantic vector search
    matches = store.search_code_symbols("cryptographic JWT token verification", limit=5)
    assert len(matches) >= 1
    assert matches[0]["name"] == "verify_jwt"


def test_knowledge_graph_engine_hybrid_search_and_subgraph(tmp_path: Path):
    # Setup test workspace
    svc_file = tmp_path / "ledger.py"
    svc_file.write_text(
        """
class AuditLedger:
    def record_entry(self, note: str):
        pass

def process_transaction(amount: float):
    ledger = AuditLedger()
    ledger.record_entry("Payment")
"""
    )

    engine = CodebaseKnowledgeGraphEngine(workspace_root=str(tmp_path))
    _idx, summary = engine.get_or_build_index(force_refresh=True, sync_vector=True)
    assert summary.total_symbols >= 2

    # Hybrid search
    res = engine.hybrid_search("transaction payment processing", limit=5)
    assert res.total_matches >= 1
    assert len(res.matches) >= 1
    assert "PRE-INDEXED HYBRID KNOWLEDGE GRAPH MATCHES" in res.assembled_context

    # Subgraph extraction
    subgraph = engine.get_subgraph("AuditLedger", depth=2)
    assert subgraph.depth == 2
    assert len(subgraph.nodes) >= 1


@pytest.mark.asyncio
async def test_code_graph_api_endpoints(
    client: AsyncClient, auth_headers: dict, company_via_api: dict
):
    company_id = company_via_api["id"]

    # 1. GET /code-graph/index
    res = await client.get(
        f"/api/v1/companies/{company_id}/memory/code-graph/index",
        headers=auth_headers,
    )
    assert res.status_code == 200
    summary = res.json()
    assert summary["indexed_files"] >= 1
    assert summary["total_symbols"] >= 1
    assert "duration_ms" in summary

    # 2. POST /code-graph/reindex
    reindex_res = await client.post(
        f"/api/v1/companies/{company_id}/memory/code-graph/reindex?sync_vector=true&sync_db=false",
        headers=auth_headers,
    )
    assert reindex_res.status_code == 200
    reindex_data = reindex_res.json()
    assert reindex_data["total_symbols"] >= 1

    # 3. GET /code-graph/symbols
    sym_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/code-graph/symbols?q=service",
        headers=auth_headers,
    )
    assert sym_res.status_code == 200
    sym_data = sym_res.json()
    assert "symbols" in sym_data
    assert "callers" in sym_data

    # 4. GET /code-graph/hybrid
    hybrid_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/code-graph/hybrid?q=database+authentication",
        headers=auth_headers,
    )
    assert hybrid_res.status_code == 200
    hybrid_data = hybrid_res.json()
    assert "matches" in hybrid_data
    assert "assembled_context" in hybrid_data

    # 5. GET /code-graph/subgraph
    subgraph_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/code-graph/subgraph?symbol_id=service&depth=2",
        headers=auth_headers,
    )
    assert subgraph_res.status_code == 200
    subgraph_data = subgraph_res.json()
    assert "nodes" in subgraph_data
    assert "edges" in subgraph_data

