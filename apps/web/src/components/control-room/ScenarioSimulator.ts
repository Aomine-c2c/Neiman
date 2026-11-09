/**
 * NEIMAN Operational Scenario Simulator
 * Provides 11 realistic, dynamic operational states for the Command Canvas.
 * Supports testing, demonstrations, resilience checks, and operator training.
 */

import type { ControlRoomState, ApprovalRequest } from '@/lib/api/controlRoom';
import type { OrganizationalAdaptation } from '@/lib/api/evolution';
import type { ActivityEvent } from '@neiman/events';

export type OperationalScenarioKey =
  | 'NORMAL_OPERATIONS'
  | 'HIGH_ACTIVITY'
  | 'PROVIDER_DEGRADATION'
  | 'AGENT_FAILURE'
  | 'BLOCKED_WORKFLOW'
  | 'RESOURCE_PRESSURE'
  | 'PENDING_APPROVAL'
  | 'SECURITY_INCIDENT'
  | 'EVOLUTION_PROPOSAL'
  | 'EMPTY_ORGANIZATION'
  | 'RECONNECTING_OFFLINE';

export interface ScenarioDefinition {
  key: OperationalScenarioKey;
  label: string;
  tagline: string;
  severity: 'nominal' | 'info' | 'warning' | 'critical';
  cognitionStatus: string;
  fidelityPct: number;
  alertBanner?: {
    title: string;
    description: string;
    actionLabel?: string;
    actionType?: string;
  };
}

export const SCENARIO_DEFINITIONS: Record<OperationalScenarioKey, ScenarioDefinition> = {
  NORMAL_OPERATIONS: {
    key: 'NORMAL_OPERATIONS',
    label: 'Normal Operations',
    tagline: 'All autonomous systems operating within nominal boundaries',
    severity: 'nominal',
    cognitionStatus: 'ACTIVE // NOMINAL',
    fidelityPct: 99.8,
  },
  HIGH_ACTIVITY: {
    key: 'HIGH_ACTIVITY',
    label: 'High Swarm Activity',
    tagline: 'Peak concurrent inference execution across multi-agent pipelines',
    severity: 'info',
    cognitionStatus: 'MAX_THROUGHPUT // PEAK LOAD',
    fidelityPct: 98.4,
  },
  PROVIDER_DEGRADATION: {
    key: 'PROVIDER_DEGRADATION',
    label: 'Provider Degradation',
    tagline: 'Anthropic Claude 3.5 latency spike (1,450ms) — Fallback active',
    severity: 'warning',
    cognitionStatus: 'REROUTING // CIRCUIT BREAKER',
    fidelityPct: 94.2,
    alertBanner: {
      title: 'INTELLIGENCE GATEWAY DEGRADATION',
      description: 'Claude 3.5 Sonnet p99 latency exceeded 1,200ms threshold. Rerouting active traffic to Gemini 1.5 Pro and local DeepSeek-R1.',
      actionLabel: 'Inspect Gateway',
      actionType: 'GATEWAY_INSPECT',
    },
  },
  AGENT_FAILURE: {
    key: 'AGENT_FAILURE',
    label: 'Agent Execution Failure',
    tagline: 'Atlas (Chief Architect) encountered sandbox memory fault',
    severity: 'critical',
    cognitionStatus: 'AGENT_FAULT // RECOVERY REQ',
    fidelityPct: 91.0,
    alertBanner: {
      title: 'AGENT EXECUTION FAULT DETECTED',
      description: 'Agent Atlas threw CGroup OOM in container cgroup_arch_01. Worker isolated. Self-healing restart available.',
      actionLabel: 'Restart Sandbox',
      actionType: 'AGENT_RESTART',
    },
  },
  BLOCKED_WORKFLOW: {
    key: 'BLOCKED_WORKFLOW',
    label: 'Blocked Workflow DAG',
    tagline: 'Microservice Migration DAG paused awaiting schema verification',
    severity: 'warning',
    cognitionStatus: 'PIPELINE_BLOCKED // HUMAN REVIEW',
    fidelityPct: 95.1,
    alertBanner: {
      title: 'DAG STAGE EXECUTION HALTED',
      description: 'Pipeline stage 3 (Schema Migration) blocked due to unresolved cross-service foreign key conflict.',
      actionLabel: 'Inspect Pipeline',
      actionType: 'WORKFLOW_INSPECT',
    },
  },
  RESOURCE_PRESSURE: {
    key: 'RESOURCE_PRESSURE',
    label: 'Resource & GPU Pressure',
    tagline: 'GPU VRAM at 94% — Monthly token burn rate at 88% ceiling',
    severity: 'warning',
    cognitionStatus: 'RESOURCE_THROTTLED // QUOTA LIMIT',
    fidelityPct: 92.5,
    alertBanner: {
      title: 'RESOURCE ISOLATION THRESHOLD WARNING',
      description: 'Local GPU VRAM pool nearing exhaustion (22.8GB / 24GB). Monthly spend at 88% of $50,000 threshold.',
      actionLabel: 'Expand Quota',
      actionType: 'RESOURCE_EXPAND',
    },
  },
  PENDING_APPROVAL: {
    key: 'PENDING_APPROVAL',
    label: 'Pending Executive Approval',
    tagline: 'High-impact production database migration awaiting human sign-off',
    severity: 'warning',
    cognitionStatus: 'EXECUTIVE_GATE // SIGN-OFF REQUIRED',
    fidelityPct: 97.9,
    alertBanner: {
      title: 'EXECUTIVE GATE ESCALATION',
      description: 'DevOps Agent Atlas requested automated credential rotation and live database schema alteration.',
      actionLabel: 'Review Gate',
      actionType: 'APPROVAL_GATE',
    },
  },
  SECURITY_INCIDENT: {
    key: 'SECURITY_INCIDENT',
    label: 'Sentinel Security Incident',
    tagline: 'Unauthorized outbound network socket blocked by Sentinel sandbox',
    severity: 'critical',
    cognitionStatus: 'DEFENSE_ACTIVE // THREAT QUARANTINED',
    fidelityPct: 88.6,
    alertBanner: {
      title: 'SECURITY PERIMETER BREACH INTERCEPTED',
      description: 'Sentinel quarantined container cgroup_crawler_04 after egress attempt to unverified external IP 198.51.100.42:8443.',
      actionLabel: 'Inspect Defense Log',
      actionType: 'SECURITY_INSPECT',
    },
  },
  EVOLUTION_PROPOSAL: {
    key: 'EVOLUTION_PROPOSAL',
    label: 'Evolution Proposal Ready',
    tagline: 'Autonomous organization adaptation synthesized (+24% efficiency)',
    severity: 'info',
    cognitionStatus: 'EVOLUTION_SYNTHESIZED // VALIDATION',
    fidelityPct: 99.4,
    alertBanner: {
      title: 'ORGANIZATIONAL ADAPTATION PROPOSAL DETECTED',
      description: 'NEIMAN Evolution Engine detected prompt distillation & routing efficiency opportunity (+24% latency reduction, -18% token cost).',
      actionLabel: 'Review Proposal',
      actionType: 'EVOLUTION_INSPECT',
    },
  },
  EMPTY_ORGANIZATION: {
    key: 'EMPTY_ORGANIZATION',
    label: 'Empty Organization Slate',
    tagline: 'Brand new autonomous organization workspace initialized',
    severity: 'nominal',
    cognitionStatus: 'INITIALIZED // READY FOR SEEDING',
    fidelityPct: 100.0,
  },
  RECONNECTING_OFFLINE: {
    key: 'RECONNECTING_OFFLINE',
    label: 'Reconnecting / Telemetry Lost',
    tagline: 'Real-time telemetry stream reconnecting with exponential backoff',
    severity: 'critical',
    cognitionStatus: 'STREAM_LOST // RECONNECTING (2s)',
    fidelityPct: 0.0,
    alertBanner: {
      title: 'TELEMETRY STREAM DISCONNECTED',
      description: 'WebSocket & SSE connection dropped. Re-establishing secure mutual-TLS telemetry bridge...',
      actionLabel: 'Force Reconnect',
      actionType: 'RECONNECT',
    },
  },
};

/**
 * Apply operational scenario transformations onto base ControlRoomState
 */
export function applyScenarioToState(
  baseState: ControlRoomState,
  scenarioKey: OperationalScenarioKey
): {
  state: ControlRoomState;
  definition: ScenarioDefinition;
  isSimulated: boolean;
} {
  const definition = SCENARIO_DEFINITIONS[scenarioKey] || SCENARIO_DEFINITIONS.NORMAL_OPERATIONS;

  if (scenarioKey === 'NORMAL_OPERATIONS') {
    return {
      state: baseState,
      definition,
      isSimulated: false,
    };
  }

  const companyId = baseState.company_id || 'default_co';

  // Clone base state for non-destructive overrides
  const state: ControlRoomState = {
    ...baseState,
    agents: baseState.agents ? [...baseState.agents] : [],
    tasks: baseState.tasks ? [...baseState.tasks] : [],
    approvals: baseState.approvals ? [...baseState.approvals] : [],
    resources: { ...baseState.resources },
    activity: baseState.activity ? [...baseState.activity] : [],
    providers: baseState.providers ? [...baseState.providers] : [],
  };

  switch (scenarioKey) {
    case 'HIGH_ACTIVITY': {
      state.agents = state.agents.map((ag) => ({
        ...ag,
        status: 'WORKING',
        intelligence_config: {
          ...(ag.intelligence_config || {}),
          model: 'Claude 3.5 Sonnet',
          autonomy: 'AUTONOMOUS',
        },
      }));
      state.tasks = state.tasks.map((t) => ({ ...t, status: 'IN_PROGRESS' }));
      state.resources = {
        ...state.resources,
        compute_used_pct: 78.4,
        token_usage_total: 128400,
        budget_spent_usd: 18450,
      };
      state.providers = [
        { id: 'p1', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'ONLINE', active_requests: 18, avg_latency_ms: 220, total_tokens: 82000, cost_usd: 12.4 },
        { id: 'p2', name: 'Gemini 1.5 Pro', provider: 'Google', status: 'ONLINE', active_requests: 12, avg_latency_ms: 190, total_tokens: 34000, cost_usd: 4.8 },
        { id: 'p3', name: 'GPT-4o', provider: 'OpenAI', status: 'ONLINE', active_requests: 8, avg_latency_ms: 240, total_tokens: 28000, cost_usd: 5.6 },
        { id: 'p4', name: 'DeepSeek-R1 Local', provider: 'Self-Hosted', status: 'ONLINE', active_requests: 24, avg_latency_ms: 45, total_tokens: 65000, cost_usd: 0.0 },
      ];
      break;
    }

    case 'PROVIDER_DEGRADATION': {
      state.providers = [
        { id: 'p1', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'DEGRADED', active_requests: 4, avg_latency_ms: 1450, total_tokens: 42000, cost_usd: 8.2 },
        { id: 'p2', name: 'Gemini 1.5 Pro', provider: 'Google', status: 'ONLINE', active_requests: 26, avg_latency_ms: 210, total_tokens: 58000, cost_usd: 9.1 },
        { id: 'p3', name: 'DeepSeek-R1 Local', provider: 'Self-Hosted', status: 'ONLINE', active_requests: 32, avg_latency_ms: 48, total_tokens: 92000, cost_usd: 0.0 },
      ];
      const degradedEv: ActivityEvent = {
        id: `deg-${Date.now()}`,
        company_id: companyId,
        event_type: 'provider_switched',
        severity: 'HIGH',
        title: 'Claude 3.5 Degraded Latency',
        summary: 'p99 response time reached 1,450ms. Automatic failover rerouted traffic to Gemini 1.5 Pro.',
        timestamp: new Date().toISOString(),
        payload: {
          provider: 'Anthropic',
          latency_ms: 1450,
          action: 'AUTOMATIC_REROUTING_INITIATED',
          fallback_target: 'Gemini 1.5 Pro',
        },
      };
      state.activity.unshift(degradedEv);
      break;
    }

    case 'AGENT_FAILURE': {
      if (state.agents.length > 0) {
        state.agents[0] = {
          ...state.agents[0],
          status: 'FAILED',
          responsibilities: [...(state.agents[0].responsibilities || []), 'QUARANTINED: CGroup OOM SIGKILL'],
        };
      }
      const failureEv: ActivityEvent = {
        id: `fail-${Date.now()}`,
        company_id: companyId,
        event_type: 'task_failed',
        severity: 'CRITICAL',
        title: 'Agent Atlas Memory Fault',
        summary: 'CGroup memory limit exceeded in container cgroup_arch_01. Worker quarantined.',
        agent_name: state.agents[0]?.name || 'Atlas',
        timestamp: new Date().toISOString(),
        payload: {
          error_code: 'ERR_CGROUP_MEMORY_OVERFLOW',
          allocated_mb: 2048,
          used_mb: 2049,
          quarantine: true,
        },
      };
      state.activity.unshift(failureEv);
      break;
    }

    case 'BLOCKED_WORKFLOW': {
      state.tasks = state.tasks.map((t, idx) =>
        idx === 1 ? { ...t, status: 'BLOCKED', title: '[BLOCKED] Schema Migration DAG Stage 3' } : t
      );
      const blockedEv: ActivityEvent = {
        id: `block-${Date.now()}`,
        company_id: companyId,
        event_type: 'task_failed',
        severity: 'HIGH',
        title: 'Microservice Migration DAG Blocked',
        summary: 'Schema verification stage paused awaiting foreign key resolution.',
        timestamp: new Date().toISOString(),
        payload: {
          workflow_id: 'wf-microservice-migration',
          blocked_step: 'Schema Verification',
          reason: 'ForeignKeyConstraintViolation: users_organizations_fkey',
        },
      };
      state.activity.unshift(blockedEv);
      break;
    }

    case 'RESOURCE_PRESSURE': {
      state.resources = {
        compute_used_pct: 94.6,
        memory_used_gb: 14.8,
        memory_limit_gb: 16.0,
        token_usage_total: 184500,
        intelligence_cost_usd: 44200,
        budget_allocated_usd: 50000,
        budget_spent_usd: 44200,
      };
      const resourceEv: ActivityEvent = {
        id: `res-${Date.now()}`,
        company_id: companyId,
        event_type: 'resource_threshold',
        severity: 'HIGH',
        title: 'GPU VRAM & Budget Threshold Warning',
        summary: 'H100 VRAM reached 94.2% allocation. Monthly capital burn at 88% of ceiling.',
        timestamp: new Date().toISOString(),
        payload: {
          gpu_vram_pct: 94.2,
          budget_burn_pct: 88.4,
          recommendation: 'Expand CGroup quota or throttle background batch inference',
        },
      };
      state.activity.unshift(resourceEv);
      break;
    }

    case 'PENDING_APPROVAL': {
      const urgentApproval: ApprovalRequest = {
        id: `appr-urgent-${Date.now()}`,
        company_id: state.company_id,
        action_type: 'PRODUCTION_DATABASE_MIGRATION',
        target_resource: 'aws_rds_aurora_cluster_prod',
        risk_level: 'CRITICAL',
        status: 'PENDING',
        reason: 'Atlas Agent requested zero-downtime column partition schema rotation in production.',
        details: {
          estimated_duration: '4m 30s',
          backup_snapshot_id: 'snap-20261018-095521',
          risk_assessment: 'Potential transient connection timeout during failover',
          projected_cost: '$0.00',
        },
        created_at: new Date().toISOString(),
      };
      state.approvals = [urgentApproval, ...state.approvals];
      const apprEv: ActivityEvent = {
        id: `apprev-${Date.now()}`,
        company_id: companyId,
        event_type: 'approval_requested',
        severity: 'HIGH',
        title: 'Executive Gate Approval Required',
        summary: 'Critical escalation: Production database partition migration queued for human review.',
        timestamp: new Date().toISOString(),
        payload: {
          approval_id: urgentApproval.id,
          risk: 'CRITICAL',
        },
      };
      state.activity.unshift(apprEv);
      break;
    }

    case 'SECURITY_INCIDENT': {
      const secEv: ActivityEvent = {
        id: `sec-${Date.now()}`,
        company_id: companyId,
        event_type: 'resource_threshold',
        severity: 'CRITICAL',
        title: 'Sentinel Egress Breach Quarantined',
        summary: 'Container cgroup_crawler_04 attempted unauthorized socket connection to 198.51.100.42:8443.',
        timestamp: new Date().toISOString(),
        payload: {
          alert_level: 'CRITICAL',
          source_container: 'cgroup_crawler_04',
          target_ip: '198.51.100.42:8443',
          action_taken: 'PACKET_DROPPED_CONTAINER_FROZEN',
        },
      };
      state.activity.unshift(secEv);
      break;
    }

    case 'EVOLUTION_PROPOSAL': {
      const adaptationProposal: OrganizationalAdaptation = {
        id: `adapt-${Date.now()}`,
        company_id: state.company_id,
        title: 'Speculative Prompt Template Distillation',
        adaptation_type: 'CHANGE_MODEL_ROUTING',
        stage: 'PROPOSE',
        status: 'PROPOSED',
        trigger_diagnosis: 'High token latency detected on recurring consensus queries',
        evidence: [{ sample_latency: 840, benchmark: 220 }],
        previous_state: { routing: 'Static Round Robin' },
        proposed_state: { routing: 'Speculative Cache-First Mesh' },
        expected_improvement: '+24% Speed, -18% Token Cost',
        risk_assessment: 'Low risk fallback to origin model on cache miss',
        risk_level: 'LOW',
        simulation_results: { latency_gain_pct: 24, cost_savings_pct: 18 },
        validation_passed: true,
        actual_result: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.evolutionProposals = [adaptationProposal, ...(state.evolutionProposals || [])];
      const evoEv: ActivityEvent = {
        id: `evo-${Date.now()}`,
        company_id: companyId,
        event_type: 'evolution_proposed',
        severity: 'INFO',
        title: 'Organizational Adaptation Synthesized',
        summary: 'Evolution Engine detected 24% speedup opportunity via prompt distillation.',
        timestamp: new Date().toISOString(),
        payload: {
          proposal_id: adaptationProposal.id,
          projected_impact: '+24% Speed, -18% Token Cost',
        },
      };
      state.activity.unshift(evoEv);
      break;
    }

    case 'EMPTY_ORGANIZATION': {
      state.agents = [];
      state.tasks = [];
      state.approvals = [];
      state.projects = [];
      state.resources = {
        compute_used_pct: 0,
        memory_used_gb: 0,
        memory_limit_gb: 16,
        token_usage_total: 0,
        intelligence_cost_usd: 0,
        budget_allocated_usd: 50000,
        budget_spent_usd: 0,
      };
      state.activity = [];
      break;
    }

    case 'RECONNECTING_OFFLINE': {
      state.providers = state.providers.map((p) => ({ ...p, status: 'OFFLINE' }));
      break;
    }
  }

  return {
    state,
    definition,
    isSimulated: true,
  };
}
