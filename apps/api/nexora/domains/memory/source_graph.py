"""
NEIMAN OS Source Graph & Code Intelligence Engine
Provides Sourcegraph-grade code intelligence across the monorepo:
1. Cross-file Symbol Definition & Reference Resolution
2. File Viewer with AST Symbol Overlay and Git Blame
3. Transitive Blast Radius & Impact Analysis (Affected Endpoints & Tests)
4. Sourcegraph Query Syntax Parser (lang:, file:, type:, regex)
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from collections import defaultdict

from pydantic import BaseModel, Field

from nexora.domains.memory.code_graph import (
    CodebaseKnowledgeGraphEngine,
    CodeSymbolNode,
)


# =====================================================================
# PYDANTIC SCHEMAS
# =====================================================================


class GitBlameLine(BaseModel):
    line_number: int
    commit_sha: str
    author: str
    date: str
    summary: str


class SourceFileViewResponse(BaseModel):
    file_path: str
    language: str
    total_lines: int
    size_bytes: int
    content: str
    symbols: list[CodeSymbolNode]
    blame: list[GitBlameLine] = Field(default_factory=list)
    imports: list[str] = Field(default_factory=list)
    callers: list[str] = Field(default_factory=list)


class SymbolDefinitionResult(BaseModel):
    symbol_name: str
    symbol_id: str
    symbol_kind: str
    file_path: str
    line_number: int
    signature: str | None = None
    docstring: str | None = None
    snippet: str
    surrounding_code: str
    total_callers: int
    total_callees: int
    callers: list[str] = Field(default_factory=list)
    callees: list[str] = Field(default_factory=list)


class ReferenceLocation(BaseModel):
    file_path: str
    line_number: int
    caller_symbol: str
    context_line: str
    relation: str  # CALLS, IMPORTS, REFERENCES


class SymbolReferencesResult(BaseModel):
    symbol_name: str
    symbol_id: str
    total_references: int
    references: list[ReferenceLocation]
    impacted_files: list[str]


class BlastRadiusResponse(BaseModel):
    target: str  # symbol_name or file_path
    target_kind: str  # SYMBOL or FILE
    risk_level: str  # LOW | MEDIUM | HIGH | CRITICAL
    risk_score: float  # 0.0 - 100.0
    direct_dependents: list[str]
    transitive_dependents: list[str]
    impacted_endpoints: list[dict[str, str]]
    impacted_tests: list[str]
    total_impacted_files: int
    impact_graph_nodes: list[dict[str, str]]
    impact_graph_edges: list[dict[str, str]]


class SourceGraphQueryFilter(BaseModel):
    raw_query: str
    term: str
    lang: str | None = None
    path_pattern: str | None = None
    symbol_type: str | None = None
    is_regex: bool = False


class SourceGraphSearchResult(BaseModel):
    file_path: str
    line_number: int
    match_snippet: str
    symbol_name: str | None = None
    symbol_kind: str | None = None
    surrounding_lines: list[str] = Field(default_factory=list)


class SourceGraphSearchResponse(BaseModel):
    raw_query: str
    parsed_filter: SourceGraphQueryFilter
    total_matches: int
    duration_ms: float
    results: list[SourceGraphSearchResult]
    facets: dict[str, int] = Field(default_factory=dict)


# =====================================================================
# SOURCE GRAPH SERVICE IMPLEMENTATION
# =====================================================================


class SourceGraphService:
    """
    Core engine for Source Graph code intelligence, definitions,
    references, blast radius calculation, and query parsing.
    """

    def __init__(self, workspace_root: str | None = None):
        self.workspace_root = os.path.abspath(workspace_root or os.getcwd())
        self.code_engine = CodebaseKnowledgeGraphEngine(workspace_root=self.workspace_root)

    def _safe_resolve_path(self, rel_path: str) -> str:
        """Sanitizes and resolves relative path within workspace root to prevent path traversal."""
        clean_rel = rel_path.strip().lstrip("/")
        full_path = os.path.abspath(os.path.join(self.workspace_root, clean_rel))
        if not full_path.startswith(self.workspace_root):
            raise ValueError(f"Access denied: path '{rel_path}' escapes workspace boundary.")
        return full_path

    def _detect_language(self, path: str) -> str:
        ext = os.path.splitext(path)[1].lower()
        mapping = {
            ".py": "python",
            ".ts": "typescript",
            ".tsx": "typescript-react",
            ".js": "javascript",
            ".jsx": "javascript-react",
            ".rs": "rust",
            ".json": "json",
            ".md": "markdown",
            ".toml": "toml",
            ".yaml": "yaml",
            ".yml": "yaml",
            ".sh": "bash",
            ".css": "css",
        }
        return mapping.get(ext, "plaintext")

    def get_source_file(
        self, file_path: str, start_line: int = 1, max_lines: int = 1000
    ) -> SourceFileViewResponse:
        """
        Reads source file content, extracts associated AST symbols, and generates git blame.
        """
        full_path = self._safe_resolve_path(file_path)
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            raise FileNotFoundError(f"Source file '{file_path}' not found.")

        # Stream lines to avoid unbounded heap growth on large files
        total_lines = 0
        start_idx = max(0, start_line - 1)
        end_idx = start_idx + max_lines
        sliced_lines: list[str] = []

        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            for idx, line in enumerate(f):
                total_lines += 1
                if start_idx <= idx < end_idx:
                    sliced_lines.append(line)

        end_idx = min(total_lines, end_idx)
        size_bytes = os.path.getsize(full_path)
        language = self._detect_language(file_path)
        sliced_content = "".join(sliced_lines)

        # AST symbols residing in this file
        indexer, _ = self.code_engine.get_or_build_index()
        norm_path = os.path.normpath(file_path)
        file_symbols = [
            node
            for node in indexer.nodes.values()
            if node.file_path and os.path.normpath(node.file_path) == norm_path
        ]
        file_symbols.sort(key=lambda s: s.line_number or 0)

        # Imports & Callers for this file
        file_imports: list[str] = []
        file_callers: list[str] = []
        mod_id = f"mod:{file_path}"

        for edge in indexer.edges:
            if edge.source == mod_id and edge.relation == "IMPORTS":
                file_imports.append(edge.target.replace("mod:", ""))
            elif edge.target == mod_id and edge.relation in ("IMPORTS", "CALLS"):
                file_callers.append(edge.source.replace("mod:", ""))

        # Git Blame extraction (fallback if git not available or untracked)
        blame_lines: list[GitBlameLine] = []
        try:
            cmd = ["git", "blame", "-L", f"{start_idx + 1},{end_idx}", "--porcelain", file_path]
            res = subprocess.run(
                cmd, cwd=self.workspace_root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3
            )
            if res.returncode == 0:
                current_sha = "0000000"
                current_author = "Unknown"
                current_summary = "Commit"
                current_date = "2026-11-09"
                line_no = start_idx + 1

                for line in res.stdout.splitlines():
                    if re.match(r"^[0-9a-f]{40}", line):
                        current_sha = line.split()[0][:8]
                    elif line.startswith("author "):
                        current_author = line[7:]
                    elif line.startswith("summary "):
                        current_summary = line[8:]
                    elif line.startswith("author-time "):
                        # Convert epoch timestamp
                        try:
                            epoch = int(line[12:])
                            current_date = time.strftime("%Y-%m-%d", time.gmtime(epoch))
                        except Exception:
                            pass
                    elif line.startswith("\t"):
                        blame_lines.append(
                            GitBlameLine(
                                line_number=line_no,
                                commit_sha=current_sha,
                                author=current_author,
                                date=current_date,
                                summary=current_summary,
                            )
                        )
                        line_no += 1
        except Exception:
            pass

        return SourceFileViewResponse(
            file_path=file_path,
            language=language,
            total_lines=total_lines,
            size_bytes=size_bytes,
            content=sliced_content,
            symbols=file_symbols,
            blame=blame_lines,
            imports=list(set(file_imports))[:15],
            callers=list(set(file_callers))[:15],
        )

    def find_definition(self, symbol_name: str) -> SymbolDefinitionResult | None:
        """
        Locates the exact declaration/definition of a symbol, with line number and source snippet.
        """
        indexer, _ = self.code_engine.get_or_build_index()
        s_lower = symbol_name.strip().lower()

        # Find matching node (prioritize exact name match)
        target: CodeSymbolNode | None = None
        for node in indexer.nodes.values():
            if node.name.lower() == s_lower:
                target = node
                break

        if not target:
            # Substring match fallback
            for node in indexer.nodes.values():
                if s_lower in node.name.lower():
                    target = node
                    break

        if not target or not target.file_path:
            return None

        # Read snippet from file with bounded stream window
        snippet = target.signature or f"{target.kind} {target.name}"
        surrounding = ""
        full_path = self._safe_resolve_path(target.file_path)
        if os.path.exists(full_path):
            try:
                line_idx = (target.line_number or 1) - 1
                start = max(0, line_idx - 3)
                end = line_idx + 13
                surr_lines: list[str] = []
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    for idx, line in enumerate(f):
                        if idx >= end:
                            break
                        if start <= idx < end:
                            surr_lines.append(line)
                        if idx == line_idx:
                            snippet = line.strip()
                surrounding = "".join(surr_lines)
            except Exception:
                pass

        return SymbolDefinitionResult(
            symbol_name=target.name,
            symbol_id=target.id,
            symbol_kind=target.kind,
            file_path=target.file_path,
            line_number=target.line_number or 1,
            signature=target.signature,
            docstring=target.docstring,
            snippet=snippet,
            surrounding_code=surrounding,
            total_callers=len(target.incoming_refs),
            total_callees=len(target.outgoing_refs),
            callers=[c.split(":")[-1] for c in target.incoming_refs[:8]],
            callees=[c.split(":")[-1] for c in target.outgoing_refs[:8]],
        )

    def find_references(self, symbol_name: str, limit: int = 50) -> SymbolReferencesResult:
        """
        Finds all caller sites, import occurrences, and usages of a symbol across the monorepo.
        """
        indexer, _ = self.code_engine.get_or_build_index()
        s_lower = symbol_name.strip().lower()

        target_node: CodeSymbolNode | None = None
        for node in indexer.nodes.values():
            if node.name.lower() == s_lower:
                target_node = node
                break

        target_id = target_node.id if target_node else f"sym:{symbol_name}"
        references: list[ReferenceLocation] = []
        impacted_files: set[str] = set()

        # Check incoming edges in AST knowledge graph
        for edge in indexer.edges:
            if edge.target == target_id or (target_node and edge.target == target_node.name):
                file_p = edge.file_path or "unknown"
                impacted_files.add(file_p)
                caller_sym = edge.source.split(":")[-1]

                # Attempt to extract exact line from file using streaming search
                line_no = edge.line_number or 1
                ctx_line = f"{caller_sym} -> {edge.relation} {symbol_name}"
                if file_p != "unknown":
                    full_p = self._safe_resolve_path(file_p)
                    if os.path.exists(full_p):
                        try:
                            with open(full_p, "r", encoding="utf-8", errors="replace") as f:
                                for idx, l in enumerate(f):
                                    if symbol_name in l:
                                        line_no = idx + 1
                                        ctx_line = l.strip()
                                        break
                        except Exception:
                            pass

                references.append(
                    ReferenceLocation(
                        file_path=file_p,
                        line_number=line_no,
                        caller_symbol=caller_sym,
                        context_line=ctx_line,
                        relation=edge.relation,
                    )
                )

        # Fallback disk grep if AST references count is small
        if len(references) < limit:
            for n in indexer.nodes.values():
                if n.file_path and n.file_path not in impacted_files:
                    full_p = self._safe_resolve_path(n.file_path)
                    if os.path.exists(full_p):
                        try:
                            with open(full_p, "r", encoding="utf-8", errors="replace") as f:
                                for idx, line_text in enumerate(f):
                                    if symbol_name in line_text and not line_text.strip().startswith(("#", "//", "/*")):
                                        impacted_files.add(n.file_path)
                                        references.append(
                                            ReferenceLocation(
                                                file_path=n.file_path,
                                                line_number=idx + 1,
                                                caller_symbol=n.name,
                                                context_line=line_text.strip(),
                                                relation="REFERENCES",
                                            )
                                        )
                                        if len(references) >= limit:
                                            break
                        except Exception:
                            pass
                if len(references) >= limit:
                    break

        return SymbolReferencesResult(
            symbol_name=symbol_name,
            symbol_id=target_id,
            total_references=len(references),
            references=references[:limit],
            impacted_files=sorted(list(impacted_files)),
        )

    def calculate_blast_radius(self, target: str) -> BlastRadiusResponse:
        """
        Calculates transitive impact & blast radius if `target` (file or symbol) is changed.
        Identifies impacted API endpoints, affected test suites, and assigns a risk tier.
        """
        indexer, _ = self.code_engine.get_or_build_index()
        is_file = "/" in target or target.endswith((".py", ".ts", ".tsx", ".rs"))

        # Find initial node(s)
        initial_ids: set[str] = set()
        if is_file:
            norm_target = os.path.normpath(target)
            mod_id = f"mod:{target}"
            initial_ids.add(mod_id)
            for node in indexer.nodes.values():
                if node.file_path and os.path.normpath(node.file_path) == norm_target:
                    initial_ids.add(node.id)
        else:
            t_lower = target.lower()
            for node in indexer.nodes.values():
                if node.name.lower() == t_lower:
                    initial_ids.add(node.id)

        if not initial_ids:
            return BlastRadiusResponse(
                target=target,
                target_kind="FILE" if is_file else "SYMBOL",
                risk_level="LOW",
                risk_score=5.0,
                direct_dependents=[],
                transitive_dependents=[],
                impacted_endpoints=[],
                impacted_tests=[],
                total_impacted_files=0,
                impact_graph_nodes=[],
                impact_graph_edges=[],
            )

        # Pre-build incoming edge adjacency index for O(1) lookup (reduces BFS from O(V * E) to O(V + E))
        incoming_edges: dict[str, list] = defaultdict(list)
        for edge in indexer.edges:
            incoming_edges[edge.target].append(edge)

        # BFS Transitive Graph Traversal (up to 4 hops)
        visited = set(initial_ids)
        current_layer = set(initial_ids)
        direct_deps: set[str] = set()
        transitive_deps: set[str] = set()
        graph_nodes: list[dict[str, str]] = []
        graph_edges: list[dict[str, str]] = []

        for hop in range(4):
            next_layer = set()
            for cur_id in current_layer:
                # O(1) lookup of incoming edges for cur_id
                for edge in incoming_edges.get(cur_id, []):
                    if edge.source not in visited:
                        visited.add(edge.source)
                        next_layer.add(edge.source)
                        src_name = edge.source.split(":")[-1]

                        if hop == 0:
                            direct_deps.add(src_name)
                        else:
                            transitive_deps.add(src_name)

                        graph_edges.append({
                            "source": edge.source,
                            "target": edge.target,
                            "relation": edge.relation,
                        })

                        src_node = indexer.nodes.get(edge.source)
                        graph_nodes.append({
                            "id": edge.source,
                            "name": src_name,
                            "kind": src_node.kind if src_node else "MODULE",
                            "file_path": src_node.file_path if src_node else (edge.file_path or ""),
                        })

            current_layer = next_layer
            if not current_layer or len(visited) >= 80:
                break

        # Categorize Impacted Endpoints & Impacted Tests
        impacted_endpoints: list[dict[str, str]] = []
        impacted_tests: set[str] = set()
        impacted_files: set[str] = set()

        for vid in visited:
            node = indexer.nodes.get(vid)
            if node:
                if node.file_path:
                    impacted_files.add(node.file_path)
                    if "test" in node.file_path.lower():
                        impacted_tests.add(node.file_path)
                if node.kind == "ENDPOINT":
                    impacted_endpoints.append({
                        "id": node.id,
                        "name": node.name,
                        "file_path": node.file_path or "",
                        "signature": node.signature or "",
                    })

        # Calculate Risk Score (0 - 100)
        # Weights: endpoints (+15 each), tests (+5 each), direct deps (+4 each), transitive (+2 each)
        score = (
            len(impacted_endpoints) * 15.0
            + len(impacted_tests) * 5.0
            + len(direct_deps) * 4.0
            + len(transitive_deps) * 2.0
        )
        risk_score = min(100.0, max(5.0, score))

        if risk_score >= 65.0 or len(impacted_endpoints) >= 4:
            risk_level = "CRITICAL"
        elif risk_score >= 40.0 or len(impacted_endpoints) >= 2:
            risk_level = "HIGH"
        elif risk_score >= 18.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return BlastRadiusResponse(
            target=target,
            target_kind="FILE" if is_file else "SYMBOL",
            risk_level=risk_level,
            risk_score=round(risk_score, 1),
            direct_dependents=sorted(list(direct_deps))[:15],
            transitive_dependents=sorted(list(transitive_deps))[:25],
            impacted_endpoints=impacted_endpoints[:10],
            impacted_tests=sorted(list(impacted_tests))[:10],
            total_impacted_files=len(impacted_files),
            impact_graph_nodes=graph_nodes[:40],
            impact_graph_edges=graph_edges[:50],
        )

    def parse_query_filter(self, raw_query: str) -> SourceGraphQueryFilter:
        """
        Parses Sourcegraph query tokens:
        e.g. `lang:python type:endpoint file:apps/api auth`
        """
        clean = raw_query.strip()
        lang = None
        path_pattern = None
        symbol_type = None

        # Extract lang:
        lang_match = re.search(r"\blang:([a-zA-Z0-9_-]+)\b", clean)
        if lang_match:
            lang = lang_match.group(1).lower()
            clean = clean.replace(lang_match.group(0), "").strip()

        # Extract file: or path:
        file_match = re.search(r"\b(?:file|path):([^\s]+)\b", clean)
        if file_match:
            path_pattern = file_match.group(1)
            clean = clean.replace(file_match.group(0), "").strip()

        # Extract type:
        type_match = re.search(r"\btype:([a-zA-Z0-9_-]+)\b", clean)
        if type_match:
            symbol_type = type_match.group(1).upper()
            clean = clean.replace(type_match.group(0), "").strip()

        is_regex = clean.startswith("/") and clean.endswith("/") and len(clean) > 2
        term = clean[1:-1] if is_regex else clean

        return SourceGraphQueryFilter(
            raw_query=raw_query,
            term=term,
            lang=lang,
            path_pattern=path_pattern,
            symbol_type=symbol_type,
            is_regex=is_regex,
        )

    def search_code(self, query: str, limit: int = 30) -> SourceGraphSearchResponse:
        """
        Executes Sourcegraph query across AST knowledge symbols and file text.
        """
        t0 = time.perf_counter()
        parsed = self.parse_query_filter(query)
        indexer, _ = self.code_engine.get_or_build_index()

        results: list[SourceGraphSearchResult] = []
        facets: dict[str, int] = {}
        term_lower = parsed.term.lower()

        regex_pattern = None
        if parsed.is_regex:
            try:
                regex_pattern = re.compile(parsed.term, re.IGNORECASE)
            except Exception:
                regex_pattern = None

        # 1. Search AST Symbols
        for node in indexer.nodes.values():
            if parsed.lang and self._detect_language(node.file_path) != parsed.lang:
                continue
            if parsed.path_pattern and parsed.path_pattern not in node.file_path:
                continue
            if parsed.symbol_type and node.kind != parsed.symbol_type:
                continue

            matches_term = False
            if regex_pattern:
                matches_term = bool(regex_pattern.search(node.name) or (node.signature and regex_pattern.search(node.signature)))
            elif term_lower:
                matches_term = term_lower in node.name.lower() or (node.signature and term_lower in node.signature.lower())
            else:
                matches_term = True  # filter only

            if matches_term:
                lang = self._detect_language(node.file_path)
                facets[f"lang:{lang}"] = facets.get(f"lang:{lang}", 0) + 1
                dir_name = os.path.dirname(node.file_path).split("/")[0] if "/" in node.file_path else "root"
                facets[f"dir:{dir_name}"] = facets.get(f"dir:{dir_name}", 0) + 1

                snippet = node.signature or f"{node.kind} {node.name}"
                results.append(
                    SourceGraphSearchResult(
                        file_path=node.file_path,
                        line_number=node.line_number or 1,
                        match_snippet=snippet,
                        symbol_name=node.name,
                        symbol_kind=node.kind,
                    )
                )

            if len(results) >= limit * 2:
                break

        duration_ms = (time.perf_counter() - t0) * 1000.0

        return SourceGraphSearchResponse(
            raw_query=query,
            parsed_filter=parsed,
            total_matches=len(results),
            duration_ms=round(duration_ms, 2),
            results=results[:limit],
            facets=facets,
        )

