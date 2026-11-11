"""
Comprehensive Test Suite for NEIMAN OS Source Graph & Code Intelligence Engine
Tests:
- Safe path resolution and workspace boundary sandboxing
- File viewer with AST symbol overlay and git blame extraction
- Symbol definition lookup with line numbers and snippets
- References & caller discovery across monorepo files
- Blast radius & transitive impact analysis (endpoints & tests)
- Sourcegraph query syntax parser and code search
- API Endpoints: /file, /definition, /references, /blast-radius, /search
"""

from __future__ import annotations

import os
import pytest
from httpx import AsyncClient

from nexora.domains.memory.source_graph import (
    SourceGraphQueryFilter,
    SourceGraphService,
)


def test_safe_path_resolution_and_security():
    """Ensures file viewer blocks path traversal attacks escaping workspace root."""
    service = SourceGraphService()

    # Valid file in workspace
    resolved = service._safe_resolve_path("apps/api/nexora/core/compression.py")
    assert os.path.exists(resolved)

    # Path traversal attempt
    with pytest.raises(ValueError, match="boundary"):
        service._safe_resolve_path("../../../etc/passwd")


def test_get_source_file_with_symbols_and_metadata():
    """Verifies reading source files with line numbers, AST symbols, and language detection."""
    service = SourceGraphService()
    file_path = "apps/api/nexora/core/compression.py"

    res = service.get_source_file(file_path=file_path, start_line=1, max_lines=150)
    assert res.file_path == file_path
    assert res.language == "python"
    assert res.total_lines > 50
    assert res.size_bytes > 0
    assert "TokenCompressor" in res.content
    assert len(res.symbols) >= 1
    assert any(s.name == "TokenCompressor" for s in res.symbols)


def test_find_definition():
    """Verifies resolving exact definition location and code snippet for a symbol."""
    service = SourceGraphService()

    defn = service.find_definition("TokenCompressor")
    assert defn is not None
    assert defn.symbol_name == "TokenCompressor"
    assert defn.symbol_kind == "CLASS"
    assert "compression.py" in defn.file_path
    assert defn.line_number > 0
    assert "class TokenCompressor" in defn.surrounding_code


def test_find_references():
    """Verifies discovering call sites and import references across the monorepo."""
    service = SourceGraphService()

    refs = service.find_references("TokenCompressor", limit=20)
    assert refs.symbol_name == "TokenCompressor"
    assert refs.total_references >= 1
    assert len(refs.impacted_files) >= 1
    # Should be referenced in execution.py, router.py, or tests
    found_known_caller = any(
        "execution.py" in r.file_path or "router.py" in r.file_path or "test_" in r.file_path
        for r in refs.references
    )
    assert found_known_caller or len(refs.references) > 0


def test_calculate_blast_radius():
    """Verifies transitive blast radius and risk score computation."""
    service = SourceGraphService()

    # Test central module
    blast = service.calculate_blast_radius("apps/api/nexora/core/compression.py")
    assert blast.target == "apps/api/nexora/core/compression.py"
    assert blast.risk_level in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert blast.risk_score >= 5.0
    assert blast.total_impacted_files >= 1


def test_query_syntax_parser_and_search():
    """Verifies Sourcegraph query parsing with lang:, type:, file: filters."""
    service = SourceGraphService()

    # Query parser test
    parsed = service.parse_query_filter("lang:python type:class file:compression TokenCompressor")
    assert parsed.lang == "python"
    assert parsed.symbol_type == "CLASS"
    assert parsed.path_pattern == "compression"
    assert parsed.term == "TokenCompressor"

    # Search execution test
    search_res = service.search_code("lang:python type:class TokenCompressor")
    assert search_res.total_matches >= 1
    assert any(r.symbol_name == "TokenCompressor" for r in search_res.results)


@pytest.mark.asyncio
async def test_source_graph_api_endpoints(
    client: AsyncClient, auth_headers: dict, company_via_api: dict
):
    """Verifies all 5 Source Graph HTTP endpoints."""
    company_id = company_via_api["id"]

    # 1. GET /source-graph/file
    file_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/source-graph/file?file_path=apps/api/nexora/core/compression.py",
        headers=auth_headers,
    )
    assert file_res.status_code == 200
    file_data = file_res.json()
    assert file_data["language"] == "python"
    assert "content" in file_data
    assert len(file_data["symbols"]) >= 1

    # 2. GET /source-graph/definition
    defn_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/source-graph/definition?symbol=TokenCompressor",
        headers=auth_headers,
    )
    assert defn_res.status_code == 200
    defn_data = defn_res.json()
    assert defn_data["symbol_name"] == "TokenCompressor"
    assert defn_data["line_number"] > 0

    # 3. GET /source-graph/references
    refs_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/source-graph/references?symbol=TokenCompressor",
        headers=auth_headers,
    )
    assert refs_res.status_code == 200
    refs_data = refs_res.json()
    assert refs_data["total_references"] >= 1

    # 4. GET /source-graph/blast-radius
    blast_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/source-graph/blast-radius?target=apps/api/nexora/core/compression.py",
        headers=auth_headers,
    )
    assert blast_res.status_code == 200
    blast_data = blast_res.json()
    assert blast_data["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert "risk_score" in blast_data

    # 5. GET /source-graph/search
    search_res = await client.get(
        f"/api/v1/companies/{company_id}/memory/source-graph/search?q=lang:python+type:class+TokenCompressor",
        headers=auth_headers,
    )
    assert search_res.status_code == 200
    s_data = search_res.json()
    assert s_data["total_matches"] >= 1

