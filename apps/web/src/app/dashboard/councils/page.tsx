'use client';

import React, { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Scale,
  Plus,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Bot,
  FileText,
  MessageSquare,
  Shield,
  Check,
  Send,
  Copy,
  ListTodo,
  Zap,
  Database,
  TestTube,
  ArrowRight,
  Play,
} from 'lucide-react';
import { useOrganizationContext } from '@/lib/organizationContext';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import {
  councilsApi,
  type AgentCouncil,
  type CouncilDeliberation,
  type CouncilMember,
  type ReviewItem,
  type DisagreementRecord,
  type QuorumVotingModel,
  type QuorumResult,
} from '@/lib/api/councils';
import { ctoApi, type CTODirectiveResponse } from '@/lib/api/cto';

const CANONICAL_COUNCIL_MEMBERS: CouncilMember[] = [
  {
    role_title: 'CTO',
    agent_name: 'Chief Technology Agent',
    perspective: 'Strategic Feasibility & Business Alignment',
    model_identifier: 'claude-3-5-sonnet',
    model_provider: 'anthropic',
  },
  {
    role_title: 'Architect',
    agent_name: 'Systems Architect Agent',
    perspective: 'Scalability, Modularity & Distributed Systems',
    model_identifier: 'claude-3-5-sonnet',
    model_provider: 'anthropic',
  },
  {
    role_title: 'Security',
    agent_name: 'Cybersecurity Agent',
    perspective: 'Zero-Trust, Attack Vectors & Compliance',
    model_identifier: 'gpt-4o',
    model_provider: 'openai',
  },
  {
    role_title: 'Backend',
    agent_name: 'Backend Engineering Agent',
    perspective: 'Implementation Complexity & Latency Budget',
    model_identifier: 'gemini-2.5-pro',
    model_provider: 'google',
  },
  {
    role_title: 'QA Lead',
    agent_name: 'Quality Assurance Agent',
    perspective: 'Testability, Chaos Tolerance & Edge Cases',
    model_identifier: 'gpt-4o-mini',
    model_provider: 'openai',
  },
];

interface DirectiveSuggestion {
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  description: string;
  prompt: string;
}

const DIRECTIVE_SUGGESTIONS: DirectiveSuggestion[] = [
  {
    id: 'security',
    title: 'AppSec & Boundary Guardrails',
    icon: Shield,
    badge: 'Security',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    description: 'Audit AST call graphs and implement cryptographic secret and PII egress masking across microservices.',
    prompt: 'Audit AST call graphs and implement cryptographic secret and PII egress masking across microservices.',
  },
  {
    id: 'infra',
    title: 'High-Availability & Circuit Breakers',
    icon: Zap,
    badge: 'Infra',
    badgeColor: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    description: 'Configure low-latency health probes, exponential retries, and circuit-breaker failover across all model providers.',
    prompt: 'Configure low-latency health probes, exponential retries, and circuit-breaker failover across all model providers.',
  },
  {
    id: 'testing',
    title: 'TDD & Regression Test Automation',
    icon: TestTube,
    badge: 'Testing',
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    description: 'Enforce strict test-driven development (TDD) and scaffold end-to-end regression test suites with 90% coverage threshold.',
    prompt: 'Enforce strict test-driven development (TDD) and scaffold end-to-end regression test suites with 90% coverage threshold.',
  },
  {
    id: 'schema',
    title: 'Schema & Reversible Migrations',
    icon: Database,
    badge: 'Database',
    badgeColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    description: 'Design normalized relational schema migrations with composite indexing, zero downtime, and strict foreign keys.',
    prompt: 'Design normalized relational schema migrations with composite indexing, zero downtime, and strict foreign keys.',
  },
];

type RightArtifactTab = 'SPEC' | 'TASKS' | 'ADR';

interface ChatTurn {
  id: string;
  sender: string;
  role: string;
  body: string;
  stance?: string;
  keyPoints?: string[];
  risks?: string[];
}

export default function CouncilsDashboardPage() {
  const qc = useQueryClient();
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id;

  const [selectedCouncil, setSelectedCouncil] = useState<AgentCouncil | null>(null);
  const [selectedDelib, setSelectedDelib] = useState<CouncilDeliberation | null>(null);
  const [artifactTab, setArtifactTab] = useState<RightArtifactTab>('SPEC');
  const [votingModel, setVotingModel] = useState<QuorumVotingModel>('WEIGHTED');
  const [quorumResult, setQuorumResult] = useState<QuorumResult | null>(null);
  const [copiedAdr, setCopiedAdr] = useState(false);

  // Conversation / Directive composer state
  const [composerText, setComposerText] = useState('');
  const [localTurns, setLocalTurns] = useState<ChatTurn[]>([]);
  const [latestDirectivePlan, setLatestDirectivePlan] = useState<CTODirectiveResponse | null>(null);

  // New Deliberation Modal
  const [showStartDelib, setShowStartDelib] = useState(false);
  const [delibTitle, setDelibTitle] = useState('');
  const [delibProblem, setDelibProblem] = useState('');

  // 1. Fetch Councils
  const { data: councils = [], isLoading: councilsLoading } = useQuery({
    queryKey: ['councils', companyId],
    queryFn: () => councilsApi.list(companyId!),
    enabled: !!companyId,
  });

  // 2. Fetch Deliberations for selected council
  const { data: deliberations = [] } = useQuery({
    queryKey: ['council-deliberations', companyId, selectedCouncil?.id],
    queryFn: () => councilsApi.listDeliberations(companyId!, selectedCouncil!.id),
    enabled: !!companyId && !!selectedCouncil?.id,
  });

  // 2b. Fetch Proactive Architectural Proposals & Initiatives
  const { data: ctoProposals = [] } = useQuery({
    queryKey: ['cto-proposals', companyId],
    queryFn: () => ctoApi.getProposals(companyId!),
    enabled: !!companyId,
  });

  React.useEffect(() => {
    if (councils.length > 0 && !selectedCouncil) {
      setSelectedCouncil(councils[0]);
    }
  }, [councils, selectedCouncil]);

  React.useEffect(() => {
    if (deliberations.length > 0 && !selectedDelib) {
      setSelectedDelib(deliberations[0]);
    }
  }, [deliberations, selectedDelib]);

  // 3. Create Canonical Architecture Council
  const createCouncilMutation = useMutation({
    mutationFn: () =>
      councilsApi.create(companyId!, {
        name: 'Architecture & Technical Governance Council',
        charter:
          'Evaluates cross-cutting system design, multi-model intelligence routing, and reliability tradeoffs.',
        council_type: 'PERMANENT',
        members: CANONICAL_COUNCIL_MEMBERS,
      }),
    onSuccess: (council) => {
      qc.invalidateQueries({ queryKey: ['councils', companyId] });
      setSelectedCouncil(council);
    },
  });

  // 4. Start Deliberation Run
  const startDelibMutation = useMutation({
    mutationFn: () =>
      councilsApi.startDeliberation(companyId!, selectedCouncil!.id, {
        title: delibTitle || 'Architectural Trade-Off Deliberation',
        problem_statement:
          delibProblem ||
          'Evaluate service boundaries, failure modes, and schema migration safety for the next engineering milestone.',
        auto_execute_deliberation: true,
      }),
    onSuccess: (delib) => {
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
      setSelectedDelib(delib);
      setShowStartDelib(false);
      setDelibTitle('');
      setDelibProblem('');
      setArtifactTab('SPEC');
    },
  });

  // 5. Direct CTO Directive / Conversation Turn
  const directiveMutation = useMutation({
    mutationFn: (prompt: string) =>
      ctoApi.sendDirective(companyId!, {
        directive: prompt,
        priority: 'HIGH',
      }),
    onSuccess: (res, prompt) => {
      const isConversation = res.intent === 'CONVERSATION';
      const replyBody =
        res.analysis ||
        res.summary ||
        (isConversation
          ? 'CTO acknowledged. How can I assist with your architecture or technical directives?'
          : 'Directive accepted — execution tasks decomposed.');

      setLocalTurns((prev) => [
        ...prev,
        {
          id: `op-${Date.now()}`,
          sender: 'Operator',
          role: 'Human Lead',
          body: prompt,
        },
        {
          id: res.directive_id || `cto-${Date.now()}`,
          sender: res.cto_agent_name || 'Chief Technology Agent',
          role: 'CTO',
          body: replyBody,
          stance: isConversation ? 'CONVERSATION' : 'SYNTHESIZED',
        },
      ]);
      setLatestDirectivePlan(res);
      setComposerText('');
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
    },
    onError: (err: unknown) => {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        'Failed to dispatch directive to CTO agent. Verify backend connectivity and try again.';
      setLocalTurns((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'System Sentinel',
          role: 'Error',
          body: errorMsg,
        },
      ]);
    },
  });

  const [activeDispatchingPrompt, setActiveDispatchingPrompt] = useState<string | null>(null);

  const handleAutoDispatch = async (promptText: string, autoTickSwarm = true) => {
    if (!promptText.trim() || !companyId || directiveMutation.isPending) return;
    setActiveDispatchingPrompt(promptText);
    try {
      await directiveMutation.mutateAsync(promptText);
      if (autoTickSwarm) {
        try {
          await ctoApi.triggerTick(companyId);
          qc.invalidateQueries({ queryKey: ['tasks', companyId] });
        } catch {
          // background supervisor cycle notice
        }
      }
    } finally {
      setActiveDispatchingPrompt(null);
    }
  };

  const handleDebateProposal = async (proposalTitle: string, proposalRationale?: string) => {
    let targetCouncil = selectedCouncil;
    if (!targetCouncil && councils.length > 0) {
      targetCouncil = councils[0];
    }
    if (!targetCouncil) {
      try {
        targetCouncil = await createCouncilMutation.mutateAsync();
      } catch {
        return;
      }
    }
    if (!targetCouncil) return;

    try {
      const delib = await councilsApi.startDeliberation(companyId!, targetCouncil.id, {
        title: `Council Deliberation: ${proposalTitle}`,
        problem_statement:
          proposalRationale ||
          `Evaluate architectural, security, and reliability tradeoffs for: ${proposalTitle}`,
        auto_execute_deliberation: true,
      });
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, targetCouncil.id] });
      setSelectedCouncil(targetCouncil);
      setSelectedDelib(delib);
      setArtifactTab('SPEC');
    } catch {
      // handled
    }
  };

  // 6. Ratify Decision Mutation
  const ratifyMutation = useMutation({
    mutationFn: (delibId: string) =>
      councilsApi.ratifyDecision(companyId!, delibId, {
        decision:
          selectedDelib?.synthesis_proposal?.synthesized_decision ||
          'Ratified synthesized architectural consensus with fault-isolated adapters.',
        rationale: 'Ratified by supervisory operator from CTO & Councils Workspace.',
        record_in_memory: true,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
      setSelectedDelib(updated);
      setArtifactTab('ADR');
    },
  });

  // 7. Quorum Evaluation Mutation
  const quorumMutation = useMutation({
    mutationFn: (overrideVote?: 'APPROVE' | 'REJECT' | 'VETO' | null) =>
      councilsApi.evaluateQuorum(companyId!, selectedCouncil!.id, selectedDelib!.id, {
        voting_model: votingModel,
        override_vote: overrideVote,
      }),
    onSuccess: (result) => {
      setQuorumResult(result);
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
    },
  });

  const handleComposerSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = composerText.trim();
    if (!trimmed || directiveMutation.isPending) return;
    directiveMutation.mutate(trimmed);
  };

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-3 opacity-60" />
        <h2 className="text-lg font-bold text-foreground">No Repository Connected</h2>
        <p className="text-sm text-muted-foreground">Select an active software workspace to consult your CTO & Councils.</p>
      </div>
    );
  }

  const reviews: ReviewItem[] = selectedDelib?.independent_reviews || [];
  const disagreements: DisagreementRecord[] = selectedDelib?.disagreements_recorded || [];

  const topProposal = ctoProposals[0];
  const delibMitigations = selectedDelib?.synthesis_proposal?.recommended_mitigations;
  const directiveTaskTitles = latestDirectivePlan?.tasks?.map((t) => t.title) || [];
  const proposalTaskTitles = (topProposal?.proposed_tasks || []).map((t) => t.title);

  const actionItems: string[] =
    delibMitigations && delibMitigations.length > 0
      ? delibMitigations
      : directiveTaskTitles.length > 0
      ? directiveTaskTitles
      : proposalTaskTitles;

  const liveSpecText =
    selectedDelib?.synthesis_proposal?.synthesized_decision ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION'
      ? latestDirectivePlan.analysis || latestDirectivePlan.summary
      : null) ||
    (topProposal
      ? `${topProposal.title}\n\n${topProposal.rationale}\n\nImpact Assessment:\n${topProposal.impact_assessment}`
      : null) ||
    'No architectural specification synthesized yet. Start a deliberation or send a technical directive to the CTO.';

  const technicalRationale =
    selectedDelib?.decision_rationale ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION' && (latestDirectivePlan.tasks_created_count > 0 || (latestDirectivePlan.tasks && latestDirectivePlan.tasks.length > 0))
      ? `Autonomous CTO decomposed directive into ${latestDirectivePlan.tasks_created_count || latestDirectivePlan.tasks?.length || 0} sequential engineering work items mapped across specialized workforce agents.`
      : null) ||
    (topProposal ? `Proactive architectural initiative formulated by Autonomous CTO: ${topProposal.category} priority.` : null);

  const adrStatus =
    selectedDelib?.status ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION' && (latestDirectivePlan.tasks_created_count > 0 || (latestDirectivePlan.tasks && latestDirectivePlan.tasks.length > 0))
      ? 'DIRECTIVE_DISPATCHED'
      : topProposal ? 'PROPOSAL_ACTIVE' : 'DRAFT');

  const adrDecision =
    selectedDelib?.synthesis_proposal?.synthesized_decision ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION'
      ? latestDirectivePlan.analysis || latestDirectivePlan.summary
      : null) ||
    (topProposal ? `${topProposal.title}: ${topProposal.rationale}` : 'Awaiting deliberation synthesis or architectural directive');

  const handleCopyAdr = () => {
    const title = selectedDelib?.title || latestDirectivePlan?.directive || 'Architectural Specification';
    const status = adrStatus;
    const context = selectedDelib?.problem_statement || latestDirectivePlan?.directive || 'System architecture directive';
    const decision = adrDecision;
    const rationale =
      selectedDelib?.decision_rationale ||
      (selectedDelib?.synthesis_proposal?.consensus_points || []).map((c) => `- ${c}`).join('\n') ||
      technicalRationale ||
      'Synthesized by autonomous architecture engine.';

    const adrMd = `# ADR: ${title}\n\n## Status\n${status}\n\n## Context\n${context}\n\n## Decision\n${decision}\n\n## Rationale\n${rationale}`;
    navigator.clipboard?.writeText(adrMd);
    setCopiedAdr(true);
    setTimeout(() => setCopiedAdr(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-5 pb-10 animate-fade-in">
      {/* Top Bar: Session Switcher & Convene Council Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              CTO & Architecture Councils
            </h1>
            <p className="text-xs text-muted-foreground">
              Debate system architecture with your AI CTO & specialist council, and inspect the live evolving specification & ADR.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Deliberation Session Selector */}
          {deliberations.length > 0 && (
            <select
              aria-label="Select council deliberation session"
              value={selectedDelib?.id || ''}
              onChange={(e) => {
                const found = deliberations.find((d) => d.id === e.target.value);
                if (found) setSelectedDelib(found);
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary"
            >
              {deliberations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.status})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              if (councils.length === 0) {
                createCouncilMutation.mutate();
              } else {
                setShowStartDelib(true);
              }
            }}
            disabled={createCouncilMutation.isPending || startDelibMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
          >
            {createCouncilMutation.isPending || startDelibMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>
              {councils.length === 0 ? 'Initialize Architecture Council' : 'New Council Deliberation'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Left Unified Conversation (7 cols) | Right Live Spec/Plan/ADR Artifact Pane (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* ── LEFT PANE: UNIFIED MULTI-AGENT CONVERSATION THREAD ── */}
        <section
          aria-label="Unified CTO and Council Conversation"
          className="lg:col-span-7 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-h-[520px]"
        >
          {/* Thread Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {selectedDelib ? selectedDelib.title : 'Direct CTO Architecture Thread'}
                </h2>
              </div>
              {selectedDelib && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {selectedDelib.problem_statement}
                </p>
              )}
            </div>
            {selectedDelib && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                {selectedDelib.status}
              </span>
            )}
          </div>

          {/* Conversation Messages Stream */}
          <div className="p-4 space-y-4 flex-1 min-h-[380px] max-h-[600px] overflow-y-auto divide-y divide-border/50">
            {reviews.length === 0 && localTurns.length === 0 && !councilsLoading ? (
              <div className="py-2 space-y-4">
                {/* 1. Active Architectural Proposal Deck (if available) */}
                {topProposal ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[11px] font-mono font-bold tracking-wider text-primary uppercase">
                          Active Proposal for Execution
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                        {topProposal.category || 'SECURITY PRIORITY'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        {topProposal.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {topProposal.rationale}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleAutoDispatch(
                            `Implement and execute architectural proposal: ${topProposal.title}`,
                            true
                          )
                        }
                        disabled={directiveMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
                      >
                        {directiveMutation.isPending &&
                        activeDispatchingPrompt?.includes(topProposal.title) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span>Decompose &amp; Dispatch to Swarm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDebateProposal(topProposal.title, topProposal.rationale)}
                        disabled={startDelibMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
                      >
                        {startDelibMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Scale className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span>Debate with Specialist Council</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* 2. Proactive Codebase Analysis & Directive Generator Header */}
                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Architectural Command Hub
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Dispatch high-impact engineering directives directly into the autonomous worker swarm.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleAutoDispatch(
                        'Inspect system architecture, API boundaries, security controls, and test coverage. Synthesize 3 high-priority technical proposals and engineering tasks.',
                        true
                      )
                    }
                    disabled={directiveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all shrink-0 disabled:opacity-50"
                  >
                    {directiveMutation.isPending &&
                    activeDispatchingPrompt?.includes('Inspect system architecture') ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>Analyze Codebase &amp; Synthesize Proposals</span>
                  </button>
                </div>

                {/* 3. 4 Categorized Quick-Directive Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {DIRECTIVE_SUGGESTIONS.map((chip) => {
                    const Icon = chip.icon;
                    const isRunning =
                      directiveMutation.isPending && activeDispatchingPrompt === chip.prompt;

                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleAutoDispatch(chip.prompt, true)}
                        disabled={directiveMutation.isPending}
                        className="flex flex-col justify-between p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 hover:bg-secondary/40 transition-all text-left group shadow-xs disabled:opacity-50 min-h-[92px]"
                      >
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-secondary text-primary shrink-0 group-hover:scale-105 transition-transform">
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                {chip.title}
                              </span>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${chip.badgeColor}`}
                            >
                              {chip.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 pl-7">
                            {chip.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-muted-foreground/80 group-hover:text-primary pt-2 pl-7">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              <span>Dispatching...</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5">
                              <span>1-Click Autonomous Dispatch</span>
                              <ArrowRight className="h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {reviews.map((rev, idx) => {
                  const stance = rev.objections.length > 0 ? 'OBJECTS' : 'SUPPORTS';
                  const stanceColor =
                    stance === 'SUPPORTS'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';

                  return (
                    <div key={`${rev.agent_name}-${idx}`} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AgentAvatar
                            name={rev.agent_name || rev.role}
                            roleTitle={rev.role}
                            size={24}
                            showStatus={false}
                          />
                          <span className="text-xs font-semibold text-foreground">
                            {rev.agent_name || rev.role}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {rev.role}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${stanceColor}`}>
                          {stance} · {Math.round(rev.confidence * 100)}%
                        </span>
                      </div>

                      <p className="text-sm text-foreground leading-relaxed pl-8">
                        {rev.proposal}
                      </p>

                      {rev.evidence.length > 0 && (
                        <ul className="pl-8 space-y-1 text-xs text-muted-foreground list-disc list-inside">
                          {rev.evidence.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      )}

                      {rev.risks.length > 0 && (
                        <div className="pl-8 flex flex-wrap gap-1.5 pt-1">
                          {rev.risks.map((risk, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {risk}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {localTurns.map((turn) => {
                  const isError = turn.role === 'Error';
                  const isUser = turn.sender === 'Operator';
                  return (
                    <div key={turn.id} className="pt-3 space-y-1.5 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isUser ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-foreground text-xs font-bold">
                              Op
                            </div>
                          ) : isError ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold">
                              !
                            </div>
                          ) : (
                            <AgentAvatar
                              name={turn.sender}
                              roleTitle={turn.role}
                              size={24}
                              showStatus={false}
                            />
                          )}
                          <span className="text-xs font-semibold text-foreground">{turn.sender}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                            {turn.role}
                          </span>
                        </div>
                        {turn.stance && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                              turn.stance === 'SYNTHESIZED'
                                ? 'text-primary bg-primary/10 border-primary/20'
                                : 'text-muted-foreground bg-secondary border-border'
                            }`}
                          >
                            {turn.stance}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-sm leading-relaxed pl-8 whitespace-pre-wrap ${
                          isError ? 'text-rose-600 dark:text-rose-400 font-mono text-xs' : 'text-foreground'
                        }`}
                      >
                        {turn.body}
                      </p>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Prompt Composer */}
          <form
            onSubmit={handleComposerSubmit}
            className="p-3 border-t border-border bg-secondary/20 flex items-center gap-2"
          >
            <input
              type="text"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="Ask the CTO or challenge the Council's architectural assumptions…"
              aria-label="Send message to CTO and Council"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!composerText.trim() || directiveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {directiveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Send</span>
            </button>
          </form>
        </section>

        {/* ── RIGHT PANE: LIVE EVOLVING SPEC, TASK BREAKDOWN & ADR ARTIFACT ── */}
        <section
          aria-label="Live Specification and ADR Artifact Pane"
          className="lg:col-span-5 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-h-[520px]"
        >
          {/* Artifact Segmented Tabs */}
          <div
            role="tablist"
            aria-label="Artifact Inspector Tabs"
            className="grid grid-cols-3 gap-1 p-1.5 border-b border-border bg-secondary/30"
          >
            <button
              type="button"
              role="tab"
              aria-label="Live Spec & Architecture"
              aria-selected={artifactTab === 'SPEC'}
              onClick={() => setArtifactTab('SPEC')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors ${
                artifactTab === 'SPEC'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">Architecture Spec</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-label={`Task Breakdown (${actionItems.length})`}
              aria-selected={artifactTab === 'TASKS'}
              onClick={() => setArtifactTab('TASKS')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors ${
                artifactTab === 'TASKS'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListTodo className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">Tasks ({actionItems.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-label="Decision Record (ADR)"
              aria-selected={artifactTab === 'ADR'}
              onClick={() => setArtifactTab('ADR')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors ${
                artifactTab === 'ADR'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">Decision Record (ADR)</span>
            </button>
          </div>

          {/* Tab 1: Live Spec & Architecture */}
          {artifactTab === 'SPEC' && (
            <div className="p-4 space-y-4 flex-1">
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase font-semibold text-primary">
                  Synthesized Architectural Recommendation
                </span>
                <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                  {liveSpecText}
                </p>
              </div>

              {technicalRationale && (
                <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Technical Rationale & Execution
                  </span>
                  <p className="text-xs text-foreground leading-relaxed">
                    {technicalRationale}
                  </p>
                </div>
              )}

              {disagreements.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase text-amber-500">
                    Recorded Dissent & Trade-offs ({disagreements.length})
                  </span>
                  {disagreements.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1"
                    >
                      <p className="font-semibold text-foreground">{d.topic}</p>
                      <p className="text-muted-foreground">{d.mitigation}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedDelib && selectedDelib.status !== 'RESOLVED' && (
                <div className="pt-2 border-t border-border flex justify-end">
                  <button
                    type="button"
                    onClick={() => ratifyMutation.mutate(selectedDelib.id)}
                    disabled={ratifyMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {ratifyMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    <span>Ratify Specification & Commit ADR</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Proposed Task Breakdown */}
          {artifactTab === 'TASKS' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Extracted Implementation Tasks
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {actionItems.length} items
                </span>
              </div>

              {actionItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No tasks extracted yet. Synthesize a specification or council deliberation first.
                </p>
              ) : (
                <div className="space-y-2">
                  {actionItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/20 p-3 text-xs"
                    >
                      <span className="font-mono text-[11px] text-primary font-bold">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-foreground font-medium flex-1">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Decision Record (ADR) & Quorum */}
          {artifactTab === 'ADR' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Architecture Decision Record (ADR)
                </span>
                <button
                  type="button"
                  onClick={handleCopyAdr}
                  className="inline-flex items-center gap-1 rounded border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
                >
                  {copiedAdr ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedAdr ? 'Copied' : 'Copy Markdown'}</span>
                </button>
              </div>

              <div className="rounded-lg border border-border bg-secondary/20 p-3.5 space-y-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">STATUS: </span>
                  <span className="text-primary font-bold">{adrStatus}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">DECISION: </span>
                  <span className="text-foreground font-sans">
                    {adrDecision}
                  </span>
                </div>
              </div>

              {selectedDelib && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Quorum Model</span>
                    <div className="flex items-center gap-1">
                      {(['MAJORITY', 'WEIGHTED', 'UNANIMOUS'] as QuorumVotingModel[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setVotingModel(m)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            votingModel === m
                              ? 'bg-primary text-primary-foreground font-bold'
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => quorumMutation.mutate(null)}
                    disabled={quorumMutation.isPending}
                    className="w-full rounded-lg border border-border bg-secondary/50 hover:bg-secondary py-2 text-xs font-semibold text-foreground transition-colors"
                  >
                    Evaluate Council Quorum Vote
                  </button>
                  {quorumResult && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Outcome: {quorumResult.status}
                      </span>
                      <span className="font-mono text-primary">
                        {quorumResult.total_weight > 0 ? Math.round((quorumResult.approve_weight / quorumResult.total_weight) * 100) : 0}% approval
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modal: Start New Council Deliberation */}
      {showStartDelib && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Start Architecture Deliberation</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Topic / Decision Title</label>
                <input
                  type="text"
                  value={delibTitle}
                  onChange={(e) => setDelibTitle(e.target.value)}
                  placeholder="e.g. Event-Driven Billing Microservice Split"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Architectural Problem Statement & Constraints
                </label>
                <textarea
                  rows={4}
                  value={delibProblem}
                  onChange={(e) => setDelibProblem(e.target.value)}
                  placeholder="Describe the engineering trade-offs, performance constraints, or security concerns for the Council to evaluate…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStartDelib(false)}
                className="px-3.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => startDelibMutation.mutate()}
                disabled={startDelibMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                {startDelibMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Convene Council</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
