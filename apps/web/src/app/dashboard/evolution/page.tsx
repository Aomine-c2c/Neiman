'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  TrendingUp,
  FlaskConical,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  Bot,
  Cpu,
  Zap,
  Activity,
  AlertTriangle,
  Play,
  RotateCw,
  Plus,
  Sliders,
  X,
  History,
  Check,
  ChevronRight,
  Target,
  BarChart3,
  Scale,
  Search,
  BookOpen,
  Eye,
  FileText,
  Workflow,
  Radio,
  CheckSquare,
  XCircle,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import {
  evolutionApi,
  type OrganizationalAdaptation,
  type CustomKPI,
  type OrganizationalSnapshot,
  type PerformanceDimension,
} from '@/lib/api/evolution';

type SectionKey =
  | 'OBSERVATIONS'
  | 'DIAGNOSES'
  | 'PROPOSALS'
  | 'SIMULATIONS'
  | 'VALIDATIONS'
  | 'DEPLOYMENTS'
  | 'ROLLBACKS'
  | 'LESSONS';

interface SectionDef {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countKey?: string;
  description: string;
}

const SECTIONS: SectionDef[] = [
  { key: 'OBSERVATIONS', label: 'OBSERVATIONS', icon: Eye, description: 'Live anomaly detection, telemetry alerts, and variance signals' },
  { key: 'DIAGNOSES', label: 'DIAGNOSES', icon: Activity, description: 'Synthesized root-cause analyses and system bottlenecks' },
  { key: 'PROPOSALS', label: 'PROPOSALS', icon: Sparkles, description: 'Self-proposed organizational adaptations and improvements' },
  { key: 'SIMULATIONS', label: 'SIMULATIONS', icon: FlaskConical, description: 'Controlled synthetic lab trials and Monte Carlo stress tests' },
  { key: 'VALIDATIONS', label: 'VALIDATIONS', icon: Scale, description: 'Constitutional checks, regression bounds, and safety evaluations' },
  { key: 'DEPLOYMENTS', label: 'DEPLOYMENTS', icon: Zap, description: 'Active deployed adaptations running in live production' },
  { key: 'ROLLBACKS', label: 'ROLLBACKS', icon: RotateCcw, description: 'Safely reverted changes with pre-state snapshots preserved' },
  { key: 'LESSONS', label: 'LESSONS', icon: BookOpen, description: 'Permanent organizational memory and acquired system knowledge' },
];

interface ProposalModel {
  id: string;
  proposed_change: string;
  why: string;
  evidence: string;
  expected_benefit: string;
  resource_impact: string;
  risk: 'Low' | 'Medium' | 'High';
  validation: string;
  status: 'PENDING' | 'SIMULATED' | 'VALIDATED' | 'APPROVED' | 'REJECTED' | 'DEPLOYED';
  adaptation_type: string;
  created_at: string;
  simulation_metrics?: {
    latency_delta_pct?: number;
    cost_delta_pct?: number;
    quality_score?: number;
    synthetic_runs?: number;
  };
}

const DEFAULT_PROPOSALS: ProposalModel[] = [
  {
    id: 'prop-api-rel-agent',
    proposed_change: 'Create a dedicated API Reliability Agent.',
    why: 'Repeated provider failures detected.',
    evidence: '12 failures across 4 projects.',
    expected_benefit: 'Improved incident handling.',
    resource_impact: '+1 agent\n+estimated model usage',
    risk: 'Low',
    validation: 'Not yet simulated.',
    status: 'PENDING',
    adaptation_type: 'CREATE_NEW_AGENT',
    created_at: '2026-10-02T10:15:00Z',
  },
  {
    id: 'prop-gemini-routing',
    proposed_change: 'Route code synthesis subtasks to Gemini 1.5 Pro with Claude 3.5 Sonnet fallback.',
    why: 'Peak query latency spikes and elevated token burn during bulk refactoring workflows.',
    evidence: '38% latency spike during sprint planning; $412 excess token spend in Project Alpha.',
    expected_benefit: '40% reduction in p99 response latency and 32% lower inference costs.',
    resource_impact: 'Zero agent delta\nEstimated -$180/mo model usage',
    risk: 'Low',
    validation: 'Passed synthetic lab simulation (50 test workloads, 0 schema violations).',
    status: 'VALIDATED',
    adaptation_type: 'CHANGE_MODEL_ROUTING',
    created_at: '2026-10-01T14:20:00Z',
    simulation_metrics: {
      latency_delta_pct: -38,
      cost_delta_pct: -32,
      quality_score: 98,
      synthetic_runs: 50,
    },
  },
  {
    id: 'prop-parallel-concurrency',
    proposed_change: 'Expand concurrent architectural review slots from 4 to 8.',
    why: 'Deliberation queues for Architecture Council exceeding SLA by 4.2 hours.',
    evidence: '9 architecture decisions stalled waiting for Council deliberation slots.',
    expected_benefit: '60% faster deliberation turnaround without compromising consensus quality.',
    resource_impact: '4 additional parallel worker threads\n+15% token concurrency surge',
    risk: 'Medium',
    validation: 'Simulated with Monte Carlo workload trial: verified zero deadlocks.',
    status: 'SIMULATED',
    adaptation_type: 'MODIFY_RESOURCE_ALLOCATION',
    created_at: '2026-10-01T09:00:00Z',
    simulation_metrics: {
      latency_delta_pct: -52,
      cost_delta_pct: 12,
      quality_score: 99,
      synthetic_runs: 75,
    },
  },
];

const DEFAULT_OBSERVATIONS = [
  {
    id: 'obs-1',
    metric: 'Provider Outage Spike',
    target: 'OpenAI GPT-4o Provider Gateway',
    timestamp: '12 mins ago',
    severity: 'HIGH',
    value: '4.8% failure rate',
    details: '12 connection drops and timeout errors detected across 4 projects (Alpha, Beta, Delta, Core).',
  },
  {
    id: 'obs-2',
    metric: 'Latency Drift',
    target: 'Architecture Synthesis Workflow',
    timestamp: '45 mins ago',
    severity: 'MEDIUM',
    value: 'p95 = 4,820ms',
    details: 'Deliberation synthesis latency increased by +42% after introducing multi-agent debate stages.',
  },
  {
    id: 'obs-3',
    metric: 'Budget Run-rate Anomaly',
    target: 'Code Review Agent Cluster',
    timestamp: '2 hours ago',
    severity: 'LOW',
    value: '$24.50 / hr vs $15.00 benchmark',
    details: 'Uncached prompt payloads causing repetitive context window consumption.',
  },
  {
    id: 'obs-4',
    metric: 'Tool Invocation Timeout',
    target: 'Postgres Vector Retrieval',
    timestamp: '3 hours ago',
    severity: 'MEDIUM',
    value: '3 timeouts in 100 queries',
    details: 'Subagent context queries experiencing lock contention during bulk embeddings generation.',
  },
];

const DEFAULT_DIAGNOSES = [
  {
    id: 'diag-1',
    title: 'Upstream Provider Instability & Absence of Autonomous Fallback Gate',
    severity: 'HIGH',
    impacted_services: 'Agent Core, Coding Workforce, CI Bot',
    root_cause: 'Lack of dedicated API reliability supervisor to trigger instant circuit-breakers and fallback model failover.',
    recommended_action: 'Deploy an automated API Reliability Agent with cross-provider heartbeat probes.',
    linked_proposal: 'Create a dedicated API Reliability Agent.',
  },
  {
    id: 'diag-2',
    title: 'Suboptimal Model Routing for High-Volume Deterministic Tasks',
    severity: 'MEDIUM',
    impacted_services: 'Code Synthesis, Schema Validation, Unit Test Gen',
    root_cause: 'Expensive frontier reasoning models utilized for standard boilerplate generation where high-throughput models suffice.',
    recommended_action: 'Dynamic routing policy steering repetitive code generation to Gemini 1.5 Pro.',
    linked_proposal: 'Route code synthesis subtasks to Gemini 1.5 Pro.',
  },
  {
    id: 'diag-3',
    title: 'Deliberation Slot Starvation during Multi-Agent Synthesis',
    severity: 'MEDIUM',
    impacted_services: 'Agent Councils, Architecture Committee',
    root_cause: 'Council execution bounded to 4 parallel workers, creating a bottleneck during cross-functional reviews.',
    recommended_action: 'Increase parallel execution pool to 8 slots with priority queuing.',
    linked_proposal: 'Expand concurrent architectural review slots from 4 to 8.',
  },
];

const DEFAULT_VALIDATIONS = [
  {
    id: 'val-1',
    proposal_title: 'Route code synthesis subtasks to Gemini 1.5 Pro',
    constitutional_status: 'PASSED',
    safety_boundary: 'Article 3: Zero unauthorized policy alteration & mandatory schema integrity check',
    test_runs: 50,
    regressions: 0,
    verdict: 'Approved by Automated Constitutional Checker. Ready for deployment.',
  },
  {
    id: 'val-2',
    proposal_title: 'Expand concurrent architectural review slots to 8',
    constitutional_status: 'PASSED',
    safety_boundary: 'Article 7: Budget ceiling bound < $200/mo and human supervisor override access',
    test_runs: 75,
    regressions: 0,
    verdict: 'Resource quota approved. Passed thread safety and dead-lock stress test.',
  },
  {
    id: 'val-3',
    proposal_title: 'Autonomous System Prompt Mutation (Deprecated)',
    constitutional_status: 'BLOCKED',
    safety_boundary: 'Article 1: Core values & objective hierarchy cannot be self-modified without human executive sign-off',
    test_runs: 10,
    regressions: 3,
    verdict: 'Rejected by Constitutional Safety Gate. Self-prompt mutation violates boundary.',
  },
];

const DEFAULT_DEPLOYMENTS = [
  {
    id: 'dep-1',
    title: 'Optimized Memory Context Compression v2.4',
    deployed_at: '2026-09-28 14:10 UTC',
    deployed_by: 'Chief Operating Officer (Automated Promotion)',
    snapshot_id: 'snap-0091-pre-compression',
    status: 'ACTIVE_HEALTHY',
    telemetry: 'Token burn reduced by 28%; zero memory recall degradation recorded over 4,200 queries.',
  },
  {
    id: 'dep-2',
    title: 'Adaptive Circuit-Breaker for Anthropic API',
    deployed_at: '2026-09-24 09:30 UTC',
    deployed_by: 'Reliability Engineering Council',
    snapshot_id: 'snap-0084-pre-breaker',
    status: 'ACTIVE_HEALTHY',
    telemetry: 'Prevented 14 cascading workflow failures during upstream cloud outage on Sep 29.',
  },
];

const DEFAULT_ROLLBACKS = [
  {
    id: 'rb-1',
    title: 'Aggressive Aggregator Model Quantization',
    rolled_back_at: '2026-09-20 18:22 UTC',
    rolled_back_by: 'Supervisory Safety Interceptor',
    snapshot_restored: 'snap-0078-pre-quant',
    reason: 'Output hallucinations in legal compliance checking rose from 0.1% to 2.4%.',
    lesson_learned: 'Legal analysis agents must remain pinned to FP16 frontier models; do not apply 4-bit quantization to compliance reasoning.',
  },
  {
    id: 'rb-2',
    title: 'Autonomous Slack Webhook Notifier',
    rolled_back_at: '2026-09-15 11:05 UTC',
    rolled_back_by: 'Lead Architect',
    snapshot_restored: 'snap-0062-pre-webhook',
    reason: 'Uncapped notifications created notification fatigue during automated refactoring loops.',
    lesson_learned: 'Event triggers must enforce rate-limits and digest summaries rather than raw event streaming.',
  },
];

const DEFAULT_LESSONS = [
  {
    id: 'les-1',
    category: 'Model Specialization',
    headline: 'High-risk reasoning vs High-throughput execution',
    lesson: 'Tiered routing outperforms single-model architecture. High-stakes architectural synthesis requires frontier reasoning, while deterministic transformations should run on cost-optimized models with deterministic schema validators.',
    acquired_from: 'Adaptation #AD-0042 & Rollback #RB-001',
    date: '2026-09-21',
  },
  {
    id: 'les-2',
    category: 'Provider Reliability',
    headline: 'Multi-provider fallback chains prevent cascading agent halts',
    lesson: 'Never permit single-provider dependency for mission-critical workflows. All core reasoning nodes must configure at least 2 alternate providers with matching prompt contracts.',
    acquired_from: 'Incident INC-882 & Evolution Proposal #PROP-API',
    date: '2026-09-29',
  },
  {
    id: 'les-3',
    category: 'Deliberation Governance',
    headline: 'Explicit disagreement visualization eliminates false consensus',
    lesson: 'Agents instructed to reach rapid consensus frequently hide latent edge-case risks. Forcing adversarial council perspectives before synthesis improves architectural resilience.',
    acquired_from: 'Architecture Council Post-Mortem',
    date: '2026-09-30',
  },
];

export default function EvolutionCenterPage() {
  const qc = useQueryClient();
  const previewMode = isDevelopmentAuthBypassEnabled();
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id;

  const [activeSection, setActiveSection] = useState<SectionKey>('PROPOSALS');

  // Queries from existing backend
  const { data: serverAdaptations = [], refetch: refetchAdaptations } = useQuery({
    queryKey: ['adaptations', companyId],
    queryFn: () => evolutionApi.listAdaptations(companyId!),
    enabled: !!companyId,
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ['evolution-snapshots', companyId],
    queryFn: () => evolutionApi.listSnapshots(companyId!),
    enabled: !!companyId,
  });

  const { data: simulationScenarios = [] } = useQuery({
    queryKey: ['simulation-scenarios', companyId],
    queryFn: () => evolutionApi.listSimulationScenarios(companyId!),
    enabled: !!companyId,
  });

  const mappedProposals: ProposalModel[] = useMemo(() => {
    if (serverAdaptations && serverAdaptations.length > 0) {
      return serverAdaptations.map((a) => ({
        id: a.id,
        proposed_change: a.title,
        why: a.trigger_diagnosis || a.expected_improvement || 'Identified system optimization opportunity.',
        evidence: Array.isArray(a.evidence) && a.evidence.length > 0 ? JSON.stringify(a.evidence) : 'Telemetry observations in current operational cycles.',
        expected_benefit: a.expected_improvement || 'Measurable throughput and quality improvements.',
        resource_impact: a.risk_level || 'Low',
        risk: (a.risk_level === 'HIGH' ? 'High' : a.risk_level === 'MEDIUM' ? 'Medium' : 'Low') as 'Low' | 'Medium' | 'High',
        validation: a.validation_passed ? 'Constitutional validation passed' : 'Not yet simulated.',
        status: (a.status || 'PENDING') as ProposalModel['status'],
        adaptation_type: a.adaptation_type,
        created_at: a.created_at,
      }));
    }
    return previewMode ? DEFAULT_PROPOSALS : [];
  }, [serverAdaptations, previewMode]);

  const [proposals, setProposals] = useState<ProposalModel[]>(mappedProposals);
  useEffect(() => {
    setProposals(mappedProposals);
  }, [mappedProposals]);

  const [selectedProposal, setSelectedProposal] = useState<ProposalModel | null>(mappedProposals[0] || null);
  useEffect(() => {
    if (!selectedProposal || !proposals.some((p) => p.id === selectedProposal.id)) {
      setSelectedProposal(proposals[0] || null);
    }
  }, [proposals, selectedProposal]);

  const observations = previewMode ? DEFAULT_OBSERVATIONS : [];
  const diagnoses = previewMode ? DEFAULT_DIAGNOSES : [];
  const validations = previewMode ? DEFAULT_VALIDATIONS : [];
  const deployments = previewMode ? DEFAULT_DEPLOYMENTS : [];
  const rollbacks = previewMode ? DEFAULT_ROLLBACKS : [];
  const lessons = previewMode ? DEFAULT_LESSONS : [];

  const [reviewModalProposal, setReviewModalProposal] = useState<ProposalModel | null>(null);

  // New Proposal Modal
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [propChange, setPropChange] = useState('');
  const [propWhy, setPropWhy] = useState('');
  const [propEvidence, setPropEvidence] = useState('');
  const [propBenefit, setPropBenefit] = useState('');
  const [propResource, setPropResource] = useState('+1 agent\n+estimated model usage');
  const [propRisk, setPropRisk] = useState<'Low' | 'Medium' | 'High'>('Low');

  // Rollback form
  const [rbReason, setRbReason] = useState('');
  const [rbLesson, setRbLesson] = useState('');

  // Action handlers
  const handleSimulate = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId) {
          return {
            ...p,
            status: 'SIMULATED',
            validation: 'Synthetic simulation complete: 40 workload runs, 0 errors, -34% latency.',
            simulation_metrics: {
              latency_delta_pct: -34,
              cost_delta_pct: -20,
              quality_score: 99,
              synthetic_runs: 40,
            },
          };
        }
        return p;
      })
    );
    if (selectedProposal?.id === proposalId) {
      setSelectedProposal((prev) =>
        prev
          ? {
              ...prev,
              status: 'SIMULATED',
              validation: 'Synthetic simulation complete: 40 workload runs, 0 errors, -34% latency.',
              simulation_metrics: {
                latency_delta_pct: -34,
                cost_delta_pct: -20,
                quality_score: 99,
                synthetic_runs: 40,
              },
            }
          : null
      );
    }
  };

  const handleApprove = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId) {
          return {
            ...p,
            status: 'APPROVED',
            validation: 'Approved by human supervisor. Queued for atomic snapshot & deployment.',
          };
        }
        return p;
      })
    );
    if (selectedProposal?.id === proposalId) {
      setSelectedProposal((prev) =>
        prev
          ? {
              ...prev,
              status: 'APPROVED',
              validation: 'Approved by human supervisor. Queued for atomic snapshot & deployment.',
            }
          : null
      );
    }
  };

  const handleReject = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId) {
          return {
            ...p,
            status: 'REJECTED',
            validation: 'Proposal rejected during executive review.',
          };
        }
        return p;
      })
    );
    if (selectedProposal?.id === proposalId) {
      setSelectedProposal((prev) =>
        prev
          ? {
              ...prev,
              status: 'REJECTED',
              validation: 'Proposal rejected during executive review.',
            }
          : null
      );
    }
  };

  const handleCreateProposal = () => {
    if (!propChange.trim()) return;
    const newP: ProposalModel = {
      id: `prop-${Date.now()}`,
      proposed_change: propChange,
      why: propWhy || 'Identified system optimization opportunity.',
      evidence: propEvidence || 'Telemetry observations in current sprint.',
      expected_benefit: propBenefit || 'Measurable throughput and quality improvements.',
      resource_impact: propResource,
      risk: propRisk,
      validation: 'Not yet simulated.',
      status: 'PENDING',
      adaptation_type: 'CUSTOM_ADAPTATION',
      created_at: new Date().toISOString(),
    };
    setProposals([newP, ...proposals]);
    setSelectedProposal(newP);
    setShowProposeModal(false);
    setPropChange('');
    setPropWhy('');
    setPropEvidence('');
    setPropBenefit('');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner / Philosophy */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  NEIMAN Evolution Center
                </h1>
                <span className="badge badge-primary text-xs">Self-Improvement Engine</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Where the organization proposes, simulates, validates, and records improvements to itself.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowProposeModal(true)}
            className="btn btn-primary gap-1.5 text-xs h-9 px-3"
          >
            <Plus className="h-4 w-4" />
            Propose Change
          </button>
        </div>
      </div>

      {/* Core Principle Callout */}
      <div className="p-3.5 rounded-xl border border-border/70 bg-secondary/30 backdrop-blur-sm flex items-start gap-3 text-xs">
        <Scale className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">
            Principle of Transparent Evolution:
          </span>{' '}
          <span className="text-muted-foreground">
            Evolution in NEIMAN is never an opaque or mysterious AI black box. Every change begins with an observable signal, establishes concrete diagnostic evidence, requires synthetic validation, and is permanently auditable with zero-downtime rollback.
          </span>
        </div>
      </div>

      {/* 8 Main Section Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide border-b border-border/60">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.key;
          let badgeCount: number | null = null;
          if (sec.key === 'OBSERVATIONS') badgeCount = observations.length;
          if (sec.key === 'DIAGNOSES') badgeCount = diagnoses.length;
          if (sec.key === 'PROPOSALS') badgeCount = proposals.length;
          if (sec.key === 'SIMULATIONS') badgeCount = simulationScenarios.length || (previewMode ? 3 : 0);
          if (sec.key === 'VALIDATIONS') badgeCount = validations.length;
          if (sec.key === 'DEPLOYMENTS') badgeCount = deployments.length;
          if (sec.key === 'ROLLBACKS') badgeCount = rollbacks.length;
          if (sec.key === 'LESSONS') badgeCount = lessons.length;

          return (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-card text-foreground shadow-sm border border-border ring-1 ring-primary/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span>{sec.label}</span>
              {badgeCount !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans ${
                    isActive ? 'bg-primary/20 text-primary font-bold' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: OBSERVATIONS */}
      {activeSection === 'OBSERVATIONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider">
                Telemetry Observations & Anomaly Detections
              </h3>
              <p className="text-xs text-muted-foreground">
                Continuous real-time monitoring signals that trigger evolutionary diagnoses.
              </p>
            </div>
            <span className="badge badge-outline text-xs font-mono">
              Live Ingestion Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {observations.length === 0 ? (
              <div className="col-span-full p-12 text-center border border-dashed border-border rounded-xl">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Telemetry Anomalies Detected</h4>
                <p className="text-xs text-muted-foreground mt-1">Autonomous sentinel telemetry is observing runtime workloads. No degradation thresholds exceeded.</p>
              </div>
            ) : (
              observations.map((obs) => (
                <div
                  key={obs.id}
                  className="p-4 rounded-xl border border-border bg-card space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          obs.severity === 'HIGH'
                            ? 'bg-rose-500 animate-pulse'
                            : obs.severity === 'MEDIUM'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                      />
                      <h4 className="text-xs font-bold text-foreground font-mono">{obs.metric}</h4>
                    </div>
                    <span
                      className={`badge text-[10px] ${
                        obs.severity === 'HIGH'
                          ? 'badge-destructive'
                          : obs.severity === 'MEDIUM'
                          ? 'badge-warning'
                          : 'badge-outline'
                      }`}
                    >
                      {obs.severity}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Target:</span>
                      <span className="font-semibold text-foreground">{obs.target}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground font-mono">
                      <span>Observed Signal:</span>
                      <span className="font-bold text-primary">{obs.value}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Detected:</span>
                      <span>{obs.timestamp}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground pt-2 border-t border-border/60">
                    {obs.details}
                  </p>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => {
                        setActiveSection('DIAGNOSES');
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-mono"
                    >
                      View Synthesized Diagnosis &rarr;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: DIAGNOSES */}
      {activeSection === 'DIAGNOSES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider">
                Root-Cause Diagnoses
              </h3>
              <p className="text-xs text-muted-foreground">
                Synthesized explanations connecting raw observations to architectural vulnerabilities.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {diagnoses.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-xl">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Active Diagnoses</h4>
                <p className="text-xs text-muted-foreground mt-1">Root cause analysis will trigger automatically when recurring failure patterns or bottlenecks are observed.</p>
              </div>
            ) : (
              diagnoses.map((diag) => (
                <div
                  key={diag.id}
                  className="p-5 rounded-xl border border-border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        DIAGNOSIS ID: {diag.id}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">{diag.title}</h4>
                    </div>
                    <span
                      className={`badge text-[10px] ${
                        diag.severity === 'HIGH' ? 'badge-destructive' : 'badge-warning'
                      }`}
                    >
                      {diag.severity} SEVERITY
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono bg-secondary/30 p-3 rounded-lg border border-border/50">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">IMPACTED SUBSYSTEMS</span>
                      <span className="text-foreground font-semibold">{diag.impacted_services}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">LINKED PROPOSAL</span>
                      <span className="text-primary font-semibold">{diag.linked_proposal}</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="font-semibold text-foreground text-[11px] block">ROOT CAUSE:</span>
                    <p className="text-muted-foreground">{diag.root_cause}</p>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <div className="text-muted-foreground">
                      <strong className="text-foreground">Recommendation:</strong> {diag.recommended_action}
                    </div>
                    <button
                      onClick={() => {
                        setActiveSection('PROPOSALS');
                      }}
                      className="btn btn-outline text-xs h-7 px-2.5 gap-1 shrink-0"
                    >
                      Inspect Proposal
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: PROPOSALS (CENTRAL FOCUS) */}
      {activeSection === 'PROPOSALS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Evolution Proposals ({proposals.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Structured self-improvement proposals generated to remedy diagnoses and enhance capacity.
              </p>
            </div>
            <button
              onClick={() => setShowProposeModal(true)}
              className="btn btn-primary text-xs gap-1.5 h-8 px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              New Proposal
            </button>
          </div>

          {/* Grid of Standard Evolution Proposal Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {proposals.length === 0 ? (
              <div className="col-span-full p-12 text-center border border-dashed border-border rounded-xl">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Adaptation Proposals Yet</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Proposals represent autonomous or operator-initiated changes to improve organizational throughput, routing, or agent architecture.
                </p>
                <button
                  type="button"
                  onClick={() => setShowProposeModal(true)}
                  className="btn btn-primary text-xs gap-1.5 h-8 px-4 mt-4 inline-flex items-center"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create First Proposal
                </button>
              </div>
            ) : (
              proposals.map((proposal) => {
              const isSelected = selectedProposal?.id === proposal.id;
              const riskColor =
                proposal.risk === 'High'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : proposal.risk === 'Medium'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

              return (
                <div
                  key={proposal.id}
                  className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-card shadow-lg ring-1 ring-primary/40'
                      : 'border-border bg-card/60 hover:bg-card hover:border-border/90'
                  }`}
                >
                  {/* Card Header & Status */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase block">
                          PROPOSAL &bull; {proposal.id}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                              proposal.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : proposal.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : proposal.status === 'VALIDATED' || proposal.status === 'SIMULATED'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                : 'bg-secondary text-muted-foreground border-border'
                            }`}
                          >
                            {proposal.status}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {new Date(proposal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* RISK BADGE */}
                      <div className="text-right">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase block">
                          RISK
                        </span>
                        <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${riskColor}`}>
                          {proposal.risk}
                        </span>
                      </div>
                    </div>

                    {/* SPECIFIED PROPOSAL CARD FIELDS */}
                    <div className="space-y-3.5 text-xs">
                      {/* PROPOSED CHANGE */}
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          PROPOSED CHANGE
                        </span>
                        <h4 className="text-sm font-bold text-foreground mt-0.5 leading-snug">
                          &quot;{proposal.proposed_change}&quot;
                        </h4>
                      </div>

                      {/* WHY */}
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          WHY
                        </span>
                        <p className="text-foreground/90 mt-0.5">{proposal.why}</p>
                      </div>

                      {/* EVIDENCE */}
                      <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          EVIDENCE
                        </span>
                        <p className="text-foreground font-mono text-[11px] mt-0.5">{proposal.evidence}</p>
                      </div>

                      {/* EXPECTED BENEFIT */}
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          EXPECTED BENEFIT
                        </span>
                        <p className="text-emerald-400 font-medium mt-0.5 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          {proposal.expected_benefit}
                        </p>
                      </div>

                      {/* RESOURCE IMPACT */}
                      <div className="p-2.5 rounded-lg bg-card border border-border/60">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          RESOURCE IMPACT
                        </span>
                        <div className="text-[11px] font-mono text-foreground mt-0.5 whitespace-pre-line leading-relaxed">
                          {proposal.resource_impact}
                        </div>
                      </div>

                      {/* VALIDATION */}
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          VALIDATION
                        </span>
                        <div className="mt-0.5 flex items-start gap-1.5 text-[11px] font-mono text-cyan-400">
                          <FlaskConical className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{proposal.validation}</span>
                        </div>
                        {proposal.simulation_metrics && (
                          <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-[10px]">
                            <div className="p-1.5 rounded bg-secondary/40 border border-border text-center">
                              <span className="text-muted-foreground block">LATENCY</span>
                              <span className="font-bold text-emerald-400">
                                {proposal.simulation_metrics.latency_delta_pct}%
                              </span>
                            </div>
                            <div className="p-1.5 rounded bg-secondary/40 border border-border text-center">
                              <span className="text-muted-foreground block">COST</span>
                              <span className="font-bold text-emerald-400">
                                {proposal.simulation_metrics.cost_delta_pct}%
                              </span>
                            </div>
                            <div className="p-1.5 rounded bg-secondary/40 border border-border text-center">
                              <span className="text-muted-foreground block">QUALITY</span>
                              <span className="font-bold text-cyan-400">
                                {proposal.simulation_metrics.quality_score}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SPECIFIED CARD ACTIONS: SIMULATE, REVIEW, APPROVE, REJECT */}
                  <div className="p-4 border-t border-border/70 bg-secondary/20 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* SIMULATE */}
                      <button
                        type="button"
                        onClick={() => handleSimulate(proposal.id)}
                        className="btn btn-secondary text-xs h-8 px-3 gap-1 font-mono"
                        title="Run synthetic chaos and benchmark trial"
                      >
                        <Play className="h-3 w-3 fill-current text-primary" />
                        SIMULATE
                      </button>

                      {/* REVIEW */}
                      <button
                        type="button"
                        onClick={() => setReviewModalProposal(proposal)}
                        className="btn btn-outline text-xs h-8 px-3 gap-1 font-mono"
                      >
                        <Eye className="h-3 w-3" />
                        REVIEW
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* REJECT */}
                      <button
                        type="button"
                        onClick={() => handleReject(proposal.id)}
                        className="btn btn-outline text-xs h-8 px-3 gap-1 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-mono"
                      >
                        <XCircle className="h-3 w-3" />
                        REJECT
                      </button>

                      {/* APPROVE */}
                      <button
                        type="button"
                        onClick={() => handleApprove(proposal.id)}
                        className="btn btn-primary text-xs h-8 px-3 gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-mono"
                      >
                        <Check className="h-3 w-3" />
                        APPROVE
                      </button>
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* SECTION 4: SIMULATIONS */}
      {activeSection === 'SIMULATIONS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                Controlled Benchmark Simulations
              </h3>
              <p className="text-xs text-muted-foreground">
                Hypothetical synthetic branches tested under realistic task concurrency before touching production.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {simulationScenarios.length > 0 ? (
              simulationScenarios.map((sc) => (
                <div key={sc.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <span className={`badge text-[10px] font-mono ${sc.status === 'PROMOTED' ? 'badge-success' : 'badge-outline'}`}>
                    {sc.status}
                  </span>
                  <h4 className="text-sm font-bold text-foreground">{sc.name}</h4>
                  <p className="text-xs text-muted-foreground">{sc.description || 'Simulation benchmark scenario.'}</p>
                </div>
              ))
            ) : previewMode ? (
              <>
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <span className="badge badge-success text-[10px] font-mono">STRESS TRIAL PASSED</span>
                  <h4 className="text-sm font-bold text-foreground">API Reliability Subagent Branch</h4>
                  <p className="text-xs text-muted-foreground">
                    Injected 100 simulated OpenAI outages and HTTP 429 rate limit triggers over 500 tasks.
                  </p>
                  <div className="pt-2 border-t border-border/60 text-xs font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outage Mitigation:</span>
                      <span className="text-emerald-400 font-bold">100% failover to Claude 3.5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User-Facing Errors:</span>
                      <span className="text-foreground">0 errors</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trial Latency Delta:</span>
                      <span className="text-amber-400">+120ms during failover</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <span className="badge badge-success text-[10px] font-mono">BENCHMARK TRIAL PASSED</span>
                  <h4 className="text-sm font-bold text-foreground">Gemini 1.5 Pro Routing Trial</h4>
                  <p className="text-xs text-muted-foreground">
                    Tested against 1,200 code refactoring snippets with automatic syntax and test validation.
                  </p>
                  <div className="pt-2 border-t border-border/60 text-xs font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost Reduction:</span>
                      <span className="text-emerald-400 font-bold">-38% token cost</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Syntactic Compliance:</span>
                      <span className="text-cyan-400 font-bold">99.8% valid AST</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">p95 Latency:</span>
                      <span className="text-emerald-400 font-bold">1.4s vs 3.2s baseline</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <span className="badge badge-warning text-[10px] font-mono">STRESS TEST WARNING</span>
                  <h4 className="text-sm font-bold text-foreground">16 Concurrent Council Slots</h4>
                  <p className="text-xs text-muted-foreground">
                    High concurrency test simulating 16 simultaneous architecture debates.
                  </p>
                  <div className="pt-2 border-t border-border/60 text-xs font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Context Window Saturation:</span>
                      <span className="text-rose-400 font-bold">88% utilization</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recommended Cap:</span>
                      <span className="text-foreground">8 slots max</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resource Forecast:</span>
                      <span className="text-amber-400">Exceeds tier quota</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-full p-12 text-center border border-dashed border-border rounded-xl">
                <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Simulation Scenarios Active</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Create a sandbox trial or benchmark run to simulate proposal metrics under stress workloads before production approval.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: VALIDATIONS */}
      {activeSection === 'VALIDATIONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider">
                Constitutional & Safety Validations
              </h3>
              <p className="text-xs text-muted-foreground">
                Strict governance gates preventing unverified, regressive, or constitutionally non-compliant adaptations.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {validations.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-xl">
                <Scale className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Validations Recorded</h4>
                <p className="text-xs text-muted-foreground mt-1">Safety boundaries and constitutional constraints are evaluated before proposal deployment.</p>
              </div>
            ) : (
              validations.map((val) => (
                <div
                  key={val.id}
                  className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-foreground text-sm">{val.proposal_title}</h4>
                    <span
                      className={`badge text-[10px] font-mono font-bold ${
                        val.constitutional_status === 'PASSED' ? 'badge-success' : 'badge-destructive'
                      }`}
                    >
                      {val.constitutional_status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-secondary/30 border border-border/50 font-mono text-[11px] space-y-1">
                    <span className="text-muted-foreground block text-[9px] uppercase">
                      GOVERNANCE BOUNDARY CHECK
                    </span>
                    <span className="text-foreground font-semibold">{val.safety_boundary}</span>
                  </div>

                  <p className="text-muted-foreground text-xs">{val.verdict}</p>

                  <div className="pt-2 border-t border-border/40 flex justify-between text-[11px] font-mono text-muted-foreground">
                    <span>Regression Tests: {val.test_runs} runs</span>
                    <span className={val.regressions === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      Regressions: {val.regressions}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 6: DEPLOYMENTS */}
      {activeSection === 'DEPLOYMENTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider">
                Active Live Deployments
              </h3>
              <p className="text-xs text-muted-foreground">
                Validated adaptations currently executing in the live organization.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {deployments.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-xl">
                <Layers className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Live Adaptations Deployed</h4>
                <p className="text-xs text-muted-foreground mt-1">Deployments are activated once simulations succeed and supervisor approval is confirmed.</p>
              </div>
            ) : (
              deployments.map((dep) => (
                <div
                  key={dep.id}
                  className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                        PRODUCTION DEPLOYMENT &bull; {dep.id}
                      </span>
                      <h4 className="text-sm font-bold text-foreground mt-0.5">{dep.title}</h4>
                    </div>
                    <span className="badge badge-success text-[10px] font-mono">HEALTHY</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-2 rounded bg-card/60 border border-border">
                      <span className="text-muted-foreground block text-[10px]">DEPLOYED AT</span>
                      <span className="text-foreground">{dep.deployed_at}</span>
                    </div>
                    <div className="p-2 rounded bg-card/60 border border-border">
                      <span className="text-muted-foreground block text-[10px]">AUTHORIZED BY</span>
                      <span className="text-foreground">{dep.deployed_by}</span>
                    </div>
                    <div className="p-2 rounded bg-card/60 border border-border">
                      <span className="text-muted-foreground block text-[10px]">SAFETY SNAPSHOT</span>
                      <span className="text-primary font-bold">{dep.snapshot_id}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground pt-1">{dep.telemetry}</p>

                  <div className="pt-2 border-t border-border/60 flex justify-end">
                    <button
                      onClick={() => setShowRollbackModal(true)}
                      className="btn btn-outline text-xs h-7 px-2.5 gap-1 hover:text-rose-400 font-mono"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Rollback this Deployment
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 7: ROLLBACKS */}
      {activeSection === 'ROLLBACKS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider">
                Rollbacks & Snapshot Restorations
              </h3>
              <p className="text-xs text-muted-foreground">
                Safely rolled back adaptations with full organizational learning records.
              </p>
            </div>
            <button
              onClick={() => setShowRollbackModal(true)}
              className="btn btn-outline text-xs h-8 px-3 gap-1 font-mono"
            >
              <RotateCcw className="h-3 w-3" />
              Manual Rollback
            </button>
          </div>

          <div className="space-y-3">
            {rollbacks.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-xl">
                <History className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">Zero Rollback Incidents</h4>
                <p className="text-xs text-muted-foreground mt-1">System rollback journal is clean. No degraded adaptations reverted.</p>
              </div>
            ) : (
              rollbacks.map((rb) => (
                <div
                  key={rb.id}
                  className="p-5 rounded-xl border border-purple-500/30 bg-purple-950/10 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider block">
                        REVERTED &bull; {rb.id}
                      </span>
                      <h4 className="text-sm font-bold text-foreground mt-0.5">{rb.title}</h4>
                    </div>
                    <span className="badge badge-outline text-[10px] font-mono text-purple-300 border-purple-400/40">
                      ROLLED BACK
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px] bg-secondary/30 p-2.5 rounded-lg border border-border/50">
                    <div>
                      <span className="text-muted-foreground block text-[9px]">ROLLED BACK AT</span>
                      <span className="text-foreground">{rb.rolled_back_at}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[9px]">EXECUTED BY</span>
                      <span className="text-foreground">{rb.rolled_back_by}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[9px]">RESTORED SNAPSHOT</span>
                      <span className="text-cyan-400 font-bold">{rb.snapshot_restored}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div>
                      <strong className="text-foreground block text-[11px]">ROLLBACK TRIGGER REASON:</strong>
                      <p className="text-muted-foreground">{rb.reason}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border/60">
                      <strong className="text-purple-300 block text-[11px] flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        ORGANIZATIONAL LESSON ACQUIRED:
                      </strong>
                      <p className="text-foreground/90 mt-1 leading-relaxed">{rb.lesson_learned}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 8: LESSONS */}
      {activeSection === 'LESSONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Evolutionary Lessons & Permanent Organizational Memory
              </h3>
              <p className="text-xs text-muted-foreground">
                Knowledge accumulated through experience, preventing recurring mistakes and cementing best practices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {lessons.length === 0 ? (
              <div className="col-span-full p-12 text-center border border-dashed border-border rounded-xl">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Retrospective Lessons Logged</h4>
                <p className="text-xs text-muted-foreground mt-1">Permanent organizational memory will capture architectural insights following evolutionary cycles.</p>
              </div>
            ) : (
              lessons.map((les) => (
                <div
                  key={les.id}
                  className="p-5 rounded-2xl border border-border bg-card space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-secondary text-[10px] font-mono uppercase">
                        {les.category}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">{les.date}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground leading-snug">{les.headline}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">{les.lesson}</p>
                  </div>

                  <div className="pt-3 border-t border-border/50 text-[10px] font-mono text-muted-foreground flex justify-between">
                    <span>Provenance:</span>
                    <span className="text-primary font-semibold">{les.acquired_from}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: NEW PROPOSAL */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass rounded-2xl p-6 ring-1 ring-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Propose Organization Evolution</h3>
              </div>
              <button onClick={() => setShowProposeModal(false)} className="btn btn-ghost h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Define the proposed change transparently with explicit rationale, evidence, and resource impact.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">PROPOSED CHANGE</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder='e.g. "Create a dedicated API Reliability Agent."'
                  value={propChange}
                  onChange={(e) => setPropChange(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">WHY (Problem Observed)</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder='e.g. "Repeated provider failures detected."'
                  value={propWhy}
                  onChange={(e) => setPropWhy(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">EVIDENCE (Telemetry / Occurrences)</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder='e.g. "12 failures across 4 projects."'
                  value={propEvidence}
                  onChange={(e) => setPropEvidence(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">EXPECTED BENEFIT</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder='e.g. "Improved incident handling."'
                  value={propBenefit}
                  onChange={(e) => setPropBenefit(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">RESOURCE IMPACT</label>
                <textarea
                  rows={2}
                  className="input h-auto text-xs py-2 font-mono"
                  placeholder="+1 agent&#10;+estimated model usage"
                  value={propResource}
                  onChange={(e) => setPropResource(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">RISK LEVEL</label>
                <div className="flex items-center gap-3">
                  {(['Low', 'Medium', 'High'] as const).map((lvl) => (
                    <label key={lvl} className="flex items-center gap-1.5 cursor-pointer font-mono">
                      <input
                        type="radio"
                        name="risk"
                        checked={propRisk === lvl}
                        onChange={() => setPropRisk(lvl)}
                        className="text-primary"
                      />
                      <span>{lvl}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button onClick={() => setShowProposeModal(false)} className="btn btn-outline text-xs">
                Cancel
              </button>
              <button
                onClick={handleCreateProposal}
                disabled={!propChange.trim()}
                className="btn btn-primary text-xs gap-1.5"
              >
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVIEW PROPOSAL */}
      {reviewModalProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl glass rounded-2xl p-6 ring-1 ring-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  DELIBERATIVE REVIEW &bull; {reviewModalProposal.id}
                </span>
                <h3 className="text-base font-bold text-foreground">
                  {reviewModalProposal.proposed_change}
                </h3>
              </div>
              <button onClick={() => setReviewModalProposal(null)} className="btn btn-ghost h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                  WHY THIS CHANGE IS SOUGHT
                </span>
                <p className="text-foreground">{reviewModalProposal.why}</p>
              </div>

              <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                  SUPPORTING EVIDENCE
                </span>
                <p className="text-foreground font-mono">{reviewModalProposal.evidence}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                  <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                    PROJECTED BENEFIT
                  </span>
                  <p className="text-emerald-400 font-semibold">{reviewModalProposal.expected_benefit}</p>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                  <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                    ASSESSED RISK
                  </span>
                  <p className="font-mono font-bold text-foreground">{reviewModalProposal.risk}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                  VALIDATION & BENCHMARKS
                </span>
                <p className="text-cyan-400 font-mono text-[11px]">{reviewModalProposal.validation}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                onClick={() => {
                  handleReject(reviewModalProposal.id);
                  setReviewModalProposal(null);
                }}
                className="btn btn-outline text-xs text-rose-400 hover:bg-rose-500/10"
              >
                Reject Proposal
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleSimulate(reviewModalProposal.id);
                    setReviewModalProposal(null);
                  }}
                  className="btn btn-secondary text-xs gap-1"
                >
                  <Play className="h-3.5 w-3.5 text-primary" />
                  Run Simulation
                </button>
                <button
                  onClick={() => {
                    handleApprove(reviewModalProposal.id);
                    setReviewModalProposal(null);
                  }}
                  className="btn btn-primary text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve for Rollout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL ROLLBACK */}
      {showRollbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass rounded-2xl p-6 ring-1 ring-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-rose-400" />
                <h3 className="text-base font-bold text-foreground">Rollback Deployment with Learning</h3>
              </div>
              <button onClick={() => setShowRollbackModal(false)} className="btn btn-ghost h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              In NEIMAN, rollbacks are preserved as organizational knowledge. Record the reason and lessons learned to commit into Company Memory.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Rollback Reason (Observed Issue)</label>
                <textarea
                  rows={2}
                  className="input h-auto text-xs py-2"
                  placeholder="Describe the regression, unexpected failure, or constraint violation..."
                  value={rbReason}
                  onChange={(e) => setRbReason(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Organizational Learning Notes</label>
                <textarea
                  rows={3}
                  className="input h-auto text-xs py-2"
                  placeholder="What guideline or boundary should the organization remember from this experience?"
                  value={rbLesson}
                  onChange={(e) => setRbLesson(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button onClick={() => setShowRollbackModal(false)} className="btn btn-outline text-xs">
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRollbackModal(false);
                  setRbReason('');
                  setRbLesson('');
                  setActiveSection('ROLLBACKS');
                }}
                disabled={!rbReason.trim()}
                className="btn btn-primary text-xs bg-rose-500 hover:bg-rose-600 text-white gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Confirm Rollback & Commit Memory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
