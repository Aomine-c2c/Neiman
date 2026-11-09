import { api } from './client';

export type DecisionStatus = 'OPEN' | 'IN_REVIEW' | 'DECIDED' | 'IMPLEMENTED' | 'EVALUATED';

export interface DecisionRecord {
  id: string;
  company_id: string;
  title: string;
  problem: string;
  proposals: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  participants: Array<Record<string, unknown>>;
  decision: string | null;
  rationale: string | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  status: DecisionStatus;
  decided_at: string | null;
  decided_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecisionCreate {
  title: string;
  problem: string;
  expected_outcome?: string;
}

export const decisionsApi = {
  list: (companyId: string) =>
    api.get<DecisionRecord[]>(`/api/v1/companies/${companyId}/decisions`),

  create: (companyId: string, body: DecisionCreate) =>
    api.post<DecisionRecord>(`/api/v1/companies/${companyId}/decisions`, body),

  resolve: (
    companyId: string,
    decisionId: string,
    body: { decision: string; rationale: string; expected_outcome?: string }
  ) => api.post<DecisionRecord>(
    `/api/v1/companies/${companyId}/decisions/${decisionId}/resolve`, body
  ),

  recordOutcome: (companyId: string, decisionId: string, actual_outcome: string) =>
    api.post<DecisionRecord>(
      `/api/v1/companies/${companyId}/decisions/${decisionId}/outcome`, { actual_outcome }
    ),
};
