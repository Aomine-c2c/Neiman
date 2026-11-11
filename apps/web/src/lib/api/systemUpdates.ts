/**
 * NEIMAN System Updates Client API
 */

import { api } from './client';

export interface UpdateStatus {
  version: string;
  current_commit: string;
  remote_commit: string | null;
  update_available: boolean;
  branch: string;
  commits_behind: number;
  latest_summary: string | null;
  last_checked_at: string;
  is_updating: boolean;
  check_error?: string | null;
}

export interface UpdateProgress {
  is_updating: boolean;
  stage: string;
  stage_index: number;
  total_stages: number;
  stage_name: string;
  progress_percent: number;
  log_tail: string[];
  error: string | null;
  completed_at: string | null;
}

export const systemUpdatesApi = {
  getStatus: () =>
    api.get<UpdateStatus>('/api/v1/system/updates/status'),

  trigger: () =>
    api.post<{ status: string; message: string }>('/api/v1/system/updates/trigger'),

  getProgress: () =>
    api.get<UpdateProgress>('/api/v1/system/updates/progress'),
};

export interface ProviderKeyUpdate {
  openai_api_key?: string | null;
  anthropic_api_key?: string | null;
  gemini_api_key?: string | null;
  groq_api_key?: string | null;
  openrouter_api_key?: string | null;
  mistral_api_key?: string | null;
  deepseek_api_key?: string | null;
  cerebras_api_key?: string | null;
  together_ai_api_key?: string | null;
  cohere_api_key?: string | null;
  xai_api_key?: string | null;
  kilo_api_key?: string | null;
  meta_api_key?: string | null;
  ollama_api_key?: string | null;
  ollama_host?: string | null;
  xiaomimimo_api_key?: string | null;
  minimax_api_key?: string | null;
  upstage_api_key?: string | null;
  arcee_api_key?: string | null;
  poolside_api_key?: string | null;
}

export interface ProviderKeyStatus {
  openai_configured: boolean;
  anthropic_configured: boolean;
  gemini_configured: boolean;
  groq_configured?: boolean;
  openrouter_configured?: boolean;
  mistral_configured?: boolean;
  deepseek_configured?: boolean;
  cerebras_configured?: boolean;
  together_ai_configured?: boolean;
  cohere_configured?: boolean;
  xai_configured?: boolean;
  kilo_configured?: boolean;
  meta_configured?: boolean;
  ollama_configured?: boolean;
  ollama_host: string;
  xiaomimimo_configured?: boolean;
  minimax_configured?: boolean;
  upstage_configured?: boolean;
  arcee_configured?: boolean;
  poolside_configured?: boolean;
  openai_fingerprint: string | null;
  anthropic_fingerprint: string | null;
  gemini_fingerprint: string | null;
  groq_fingerprint?: string | null;
  openrouter_fingerprint?: string | null;
  mistral_fingerprint?: string | null;
  deepseek_fingerprint?: string | null;
  cerebras_fingerprint?: string | null;
  together_ai_fingerprint?: string | null;
  cohere_fingerprint?: string | null;
  xai_fingerprint?: string | null;
  kilo_fingerprint?: string | null;
  meta_fingerprint?: string | null;
  ollama_fingerprint?: string | null;
  xiaomimimo_fingerprint?: string | null;
  minimax_fingerprint?: string | null;
  upstage_fingerprint?: string | null;
  arcee_fingerprint?: string | null;
  poolside_fingerprint?: string | null;
}

export const systemConfigApi = {
  getProviderKeys: () =>
    api.get<ProviderKeyStatus>('/api/v1/system/provider-keys'),

  updateProviderKeys: (body: ProviderKeyUpdate) =>
    api.patch<ProviderKeyStatus>('/api/v1/system/provider-keys', body),

  getExtendedHealth: () =>
    api.get<{
      version: string;
      environment: string;
      auth_disabled: boolean;
      providers: Record<string, { configured: boolean; status: string; available_models?: string[] }>;
    }>('/api/v1/system/health-extended'),

  resetSetup: async (confirmationPhrase?: string) => {
    const confirmation = confirmationPhrase?.trim() ?? '';
    if (confirmation !== 'RESET NEIMAN OPERATIONAL DATA') {
      throw new Error('Setup reset cancelled: enter RESET NEIMAN OPERATIONAL DATA to confirm.');
    }
    return api.post<{
      status: string;
      message: string;
      archived_backup?: string;
      archived_backups?: string[];
      warnings?: string[];
    }>(
      '/api/v1/system/setup/reset',
      { confirmation }
    );
  },
};

