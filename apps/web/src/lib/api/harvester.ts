/**
 * Web Harvester & Public Data Gathering API Client
 */

import { api } from './client';

export type HarvestPlatform =
  | 'github'
  | 'reddit'
  | 'hackernews'
  | 'wikipedia'
  | 'duckduckgo'
  | 'web_page';

export interface GatheredItem {
  id: string;
  title: string;
  url: string;
  snippet: string;
  author_or_source?: string | null;
  timestamp?: string | null;
  score_or_metric?: number | null;
  raw_content?: string | null;
  metadata?: Record<string, unknown>;
}

export interface HarvestResponse {
  platform: HarvestPlatform;
  query_or_target: string;
  total_items: number;
  duration_ms: number;
  items: GatheredItem[];
  markdown_summary: string;
  cached: boolean;
}

export interface HarvestRequest {
  platform: HarvestPlatform;
  query_or_target: string;
  mode?: string | null;
  limit?: number;
}

export const harvesterApi = {
  gather: (companyId: string, req: HarvestRequest): Promise<HarvestResponse> =>
    api.post<HarvestResponse>(`/api/v1/companies/${companyId}/harvester/gather`, req),

  quickSearch: (companyId: string, query: string, limit: number = 5): Promise<HarvestResponse> =>
    api.get<HarvestResponse>(
      `/api/v1/companies/${companyId}/harvester/quick-search?q=${encodeURIComponent(query)}&limit=${limit}`
    ),
};
