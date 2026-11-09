/**
 * NEIMAN Source Graph API Client
 * Provides Sourcegraph-grade code intelligence: file viewer, definitions,
 * cross-references, blast radius impact analysis, and query parsing.
 */

import { api } from './client';
import { CodeSymbolNode } from './memory';

export interface GitBlameLine {
  line_number: number;
  commit_sha: string;
  author: string;
  date: string;
  summary: string;
}

export interface SourceFileViewResponse {
  file_path: string;
  language: string;
  total_lines: number;
  size_bytes: number;
  content: string;
  symbols: CodeSymbolNode[];
  blame: GitBlameLine[];
  imports: string[];
  callers: string[];
}

export interface SymbolDefinitionResult {
  symbol_name: string;
  symbol_id: string;
  symbol_kind: string;
  file_path: string;
  line_number: number;
  signature?: string | null;
  docstring?: string | null;
  snippet: string;
  surrounding_code: string;
  total_callers: number;
  total_callees: number;
  callers: string[];
  callees: string[];
}

export interface ReferenceLocation {
  file_path: string;
  line_number: number;
  caller_symbol: string;
  context_line: string;
  relation: string;
}

export interface SymbolReferencesResult {
  symbol_name: string;
  symbol_id: string;
  total_references: number;
  references: ReferenceLocation[];
  impacted_files: string[];
}

export interface BlastRadiusResponse {
  target: string;
  target_kind: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  direct_dependents: string[];
  transitive_dependents: string[];
  impacted_endpoints: Array<{
    id: string;
    name: string;
    file_path: string;
    signature: string;
  }>;
  impacted_tests: string[];
  total_impacted_files: number;
  impact_graph_nodes: Array<{
    id: string;
    name: string;
    kind: string;
    file_path: string;
  }>;
  impact_graph_edges: Array<{
    source: string;
    target: string;
    relation: string;
  }>;
}

export interface SourceGraphQueryFilter {
  raw_query: string;
  term: string;
  lang?: string | null;
  path_pattern?: string | null;
  symbol_type?: string | null;
  is_regex: boolean;
}

export interface SourceGraphSearchResult {
  file_path: string;
  line_number: number;
  match_snippet: string;
  symbol_name?: string | null;
  symbol_kind?: string | null;
  surrounding_lines: string[];
}

export interface SourceGraphSearchResponse {
  raw_query: string;
  parsed_filter: SourceGraphQueryFilter;
  total_matches: number;
  duration_ms: number;
  results: SourceGraphSearchResult[];
  facets: Record<string, number>;
}

export const sourceGraphApi = {
  getSourceFile: (
    companyId: string,
    filePath: string,
    startLine: number = 1,
    maxLines: number = 1000
  ): Promise<SourceFileViewResponse> =>
    api.get<SourceFileViewResponse>(
      `/api/v1/companies/${companyId}/memory/source-graph/file?file_path=${encodeURIComponent(
        filePath
      )}&start_line=${startLine}&max_lines=${maxLines}`
    ),

  getDefinition: (
    companyId: string,
    symbol: string
  ): Promise<SymbolDefinitionResult> =>
    api.get<SymbolDefinitionResult>(
      `/api/v1/companies/${companyId}/memory/source-graph/definition?symbol=${encodeURIComponent(
        symbol
      )}`
    ),

  getReferences: (
    companyId: string,
    symbol: string,
    limit: number = 50
  ): Promise<SymbolReferencesResult> =>
    api.get<SymbolReferencesResult>(
      `/api/v1/companies/${companyId}/memory/source-graph/references?symbol=${encodeURIComponent(
        symbol
      )}&limit=${limit}`
    ),

  getBlastRadius: (
    companyId: string,
    target: string
  ): Promise<BlastRadiusResponse> =>
    api.get<BlastRadiusResponse>(
      `/api/v1/companies/${companyId}/memory/source-graph/blast-radius?target=${encodeURIComponent(
        target
      )}`
    ),

  search: (
    companyId: string,
    query: string,
    limit: number = 30
  ): Promise<SourceGraphSearchResponse> =>
    api.get<SourceGraphSearchResponse>(
      `/api/v1/companies/${companyId}/memory/source-graph/search?q=${encodeURIComponent(
        query
      )}&limit=${limit}`
    ),
};

