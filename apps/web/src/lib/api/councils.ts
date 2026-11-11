/**
 * NEIMAN Agent Councils API Client
 */

import { api } from './client';

export interface CouncilMember {
  role_title: string;
  agent_name: string;
  perspective: string;
  model_identifier: string;
  model_provider: string;
  agent_id?: string;
}

export interface AgentCouncil {
  id: string;
  company_id: string;
  name: string;
  charter: string;
  council_type: 'PERMANENT' | 'TEMPORARY';
  is_active: boolean;
  synthesis_agent_id?: string | null;
  members: CouncilMember[];
  created_at: string;
  updated_at: string;
}

export interface ReviewItem {
  agent_name: string;
  role: string;
  perspective: string;
  model: string;
  proposal: string;
  evidence: string[];
  risks: string[];
  assumptions: string[];
  confidence: number;
  objections: string[];
}

export interface DisagreementRecord {
  topic: string;
  dissenting_agents: string[];
  dissenting_models: string[];
  argument: string;
  counter_argument: string;
  mitigation: string;
}

export interface CouncilDeliberation {
  id: string;
  council_id: string;
  company_id: string;
  title: string;
  problem_statement: string;
  context_data: Record<string, unknown>;
  current_stage:
  | 'PROPOSAL'
  | 'INDEPENDENT_REVIEW'
  | 'OBJECTIONS'
  | 'DISCUSSION'
  | 'SYNTHESIS'
  | 'DECISION'
  | 'RECORD';
  status: 'PENDING' | 'DELIBERATING' | 'SYNTHESIZED' | 'RESOLVED' | 'STALEMATE';
  proposals: unknown[];
  independent_reviews: ReviewItem[];
  objections: unknown[];
  discussion_threads: unknown[];
  synthesis_proposal?: {
    title: string;
    synthesized_decision: string;
    consensus_points: string[];
    unresolved_dissent: string[];
    recommended_mitigations: string[];
  } | null;
  final_decision?: string | null;
  decision_rationale?: string | null;
  disagreements_recorded: DisagreementRecord[];
  decision_id?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const councilsApi = {
  list: (companyId: string) =>
    api.get<AgentCouncil[]>(`/api/v1/companies/${companyId}/councils`),

  get: (companyId: string, councilId: string) =>
    api.get<AgentCouncil>(`/api/v1/companies/${companyId}/councils/${councilId}`),

  create: (
    companyId: string,
    body: {
      name: string;
      charter: string;
      council_type?: string;
      members?: CouncilMember[];
    }
  ) => api.post<AgentCouncil>(`/api/v1/companies/${companyId}/councils`, body),

  listDeliberations: (companyId: string, councilId: string) =>
    api.get<CouncilDeliberation[]>(
      `/api/v1/companies/${companyId}/councils/${councilId}/deliberations`
    ),

  startDeliberation: (
    companyId: string,
    councilId: string,
    body: {
      title: string;
      problem_statement: string;
      context_data?: Record<string, unknown>;
      auto_execute_deliberation?: boolean;
    }
  ) =>
    api.post<CouncilDeliberation>(
      `/api/v1/companies/${companyId}/councils/${councilId}/deliberations`,
      body
    ),

  getDeliberation: (companyId: string, deliberationId: string) =>
    api.get<CouncilDeliberation>(
      `/api/v1/companies/${companyId}/councils/deliberations/${deliberationId}`
    ),

  ratifyDecision: (
    companyId: string,
    deliberationId: string,
    body: {
      decision: string;
      rationale: string;
      record_in_memory?: boolean;
    }
  ) =>
    api.post<CouncilDeliberation>(
      `/api/v1/companies/${companyId}/councils/deliberations/${deliberationId}/decide`,
      body
    ),

  evaluateQuorum: (
    companyId: string,
    councilId: string,
    deliberationId: string,
    body: {
      voting_model: 'UNANIMOUS' | 'MAJORITY' | 'WEIGHTED' | 'VETO_ENABLED';
      override_vote?: 'APPROVE' | 'REJECT' | 'VETO' | null;
    }
  ) =>
    api.post<QuorumResult>(
      `/api/v1/companies/${companyId}/councils/${councilId}/deliberations/${deliberationId}/quorum`,
      body
    ),
};

export type QuorumVotingModel = 'UNANIMOUS' | 'MAJORITY' | 'WEIGHTED' | 'VETO_ENABLED';
export type VoteDecision = 'APPROVE' | 'REJECT' | 'ABSTAIN' | 'VETO';

export interface MemberBallot {
  member_id: string;
  agent_name: string;
  role_title: string;
  perspective: string;
  vote: VoteDecision;
  vote_weight: number;
  is_veto_holder: boolean;
  rationale: string;
  objections: string[];
  mitigations_demanded: string[];
}

export interface QuorumResult {
  deliberation_id: string;
  council_id: string;
  voting_model: QuorumVotingModel;
  quorum_passed: boolean;
  status: 'PASSED' | 'REJECTED' | 'VETOED' | 'TIE';
  total_eligible_votes: number;
  total_weight: number;
  approve_weight: number;
  reject_weight: number;
  abstain_weight: number;
  veto_exercised: boolean;
  veto_by?: string | null;
  veto_rationale?: string | null;
  enactment_action_taken: string;
  ballots: MemberBallot[];
  adr_markdown: string;
  ratified_at: string;
}
