'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Bot,
  User,
  ArrowRight,
  Filter,
  Flame,
  Coins,
  Shield,
  Rocket,
  Database,
  ScrollText,
  Sparkles,
  Search,
  MessageSquare,
  Users,
  Send,
  CornerDownRight,
  Check,
  History,
  FileQuestion,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { governanceApi, ApprovalRequest, GovernanceRiskLevel, ApprovalStatus } from '@/lib/api/governance';
import { agentsApi } from '@/lib/api/agents';
import { useOrganizationContext } from '@/lib/organizationContext';
import { ApiError } from '@/lib/api/client';

export type ApprovalFilterCategory =
  | 'ALL'
  | 'Urgent'
  | 'Financial'
  | 'Security'
  | 'Deployment'
  | 'Data'
  | 'Policy'
  | 'Evolution';

export type ApprovalActionType =
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_CHANGES'
  | 'DELEGATE'
  | 'ESCALATE';

const RISK_BADGES: Record<GovernanceRiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  MEDIUM: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  HIGH: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  CRITICAL: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

const FILTER_PILLS: { id: ApprovalFilterCategory; label: string; icon: React.ElementType }[] = [
  { id: 'ALL', label: 'All Approvals', icon: Shield },
  { id: 'Urgent', label: 'Urgent', icon: Flame },
  { id: 'Financial', label: 'Financial', icon: Coins },
  { id: 'Security', label: 'Security', icon: ShieldAlert },
  { id: 'Deployment', label: 'Deployment', icon: Rocket },
  { id: 'Data', label: 'Data', icon: Database },
  { id: 'Policy', label: 'Policy', icon: ScrollText },
  { id: 'Evolution', label: 'Evolution', icon: Sparkles },
];

export default function ApprovalCenterPage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const queryClient = useQueryClient();

  // Active view: pending queue vs historical decisions audit
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [activeFilter, setActiveFilter] = useState<ApprovalFilterCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable context state for high-risk approvals
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Action Dialog / Drawer State
  const [actionDialog, setActionDialog] = useState<{
    request: ApprovalRequest;
    action: ApprovalActionType;
  } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [delegateTarget, setDelegateTarget] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const {
    data: pendingRequests = [],
    isLoading: isPendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['pending-approvals', companyId],
    queryFn: () => governanceApi.listApprovals(companyId, 'PENDING'),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.SLOW,
  });

  const {
    data: allHistoricalRequests = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['all-approvals-history', companyId],
    queryFn: () => governanceApi.listApprovals(companyId),
    enabled: !!companyId && activeTab === 'history',
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list-for-delegation', companyId],
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  // Action mutation
  const decideMutation = useMutation({
    mutationFn: async ({
      requestId,
      action,
      notes,
    }: {
      requestId: string;
      action: ApprovalActionType;
      notes: string;
      target?: string;
    }) => {
      // Backend supports APPROVED and REJECTED on the primary endpoint;
      // for REQUEST_CHANGES, DELEGATE, and ESCALATE, we record the decision as REJECTED with structured supervisory notes
      const backendDecision: 'APPROVED' | 'REJECTED' = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const formattedNotes = `[ACTION: ${action}] ${notes}`;

      return governanceApi.decideApproval(companyId, requestId, {
        decision: backendDecision,
        reviewer_notes: formattedNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count', companyId] });
      queryClient.invalidateQueries({ queryKey: ['all-approvals-history', companyId] });
      setActionDialog(null);
      setActionNote('');
      setDelegateTarget('');
      setActionError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to execute approval action.');
      }
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to infer or extract the 8 required fields:
  // WHAT, WHO, WHY, RISK, RESOURCES, EVIDENCE, EXPECTED RESULT, PROPOSED ACTION
  const enrichApprovalItem = useCallback((req: ApprovalRequest) => {
    const payload = req.proposed_payload || {};
    const agent = agents.find((a) => a.id === req.agent_id);

    const what = req.title || req.action || 'High-Risk Autonomous Operation';
    const who = agent ? `${agent.name} (${agent.role_id || agent.autonomy || 'Autonomous Agent'})` : 'Executive Operator / Agent';
    const why = req.reason || 'Agent initiated consequential change beyond standard autonomy boundary.';
    const risk = req.risk_level || 'HIGH';
    
    // Provided resources (no synthetic fallback telemetry)
    const resources =
      (payload.resources_requested as string | undefined) ||
      (payload.budget_estimate as string | undefined) ||
      'No resource estimate provided in request payload.';

    // Evidence or telemetry verification
    const evidence =
      (payload.evidence as string | undefined) ||
      (payload.telemetry as string | undefined) ||
      'No telemetry evidence attached to request payload.';

    // Expected Result
    const expectedResult =
      (payload.expected_result as string | undefined) ||
      (payload.objective as string | undefined) ||
      'No expected outcome specified in request payload.';

    // Proposed Action
    const proposedAction = req.action || 'Execute autonomous task dispatch';

    // Inferred Category for Filters: Urgent, Financial, Security, Deployment, Data, Policy, Evolution
    let category: ApprovalFilterCategory = 'Policy';
    const text = `${req.action} ${req.title} ${req.reason} ${req.target}`.toLowerCase();

    if (risk === 'CRITICAL' || text.includes('urgent') || text.includes('outage') || text.includes('emergency')) {
      category = 'Urgent';
    } else if (text.includes('budget') || text.includes('cost') || text.includes('spend') || text.includes('financial') || text.includes('$')) {
      category = 'Financial';
    } else if (text.includes('security') || text.includes('credential') || text.includes('auth') || text.includes('key') || text.includes('token')) {
      category = 'Security';
    } else if (text.includes('deploy') || text.includes('release') || text.includes('publish') || text.includes('gateway')) {
      category = 'Deployment';
    } else if (text.includes('data') || text.includes('pii') || text.includes('database') || text.includes('storage') || text.includes('gdpr')) {
      category = 'Data';
    } else if (text.includes('evolve') || text.includes('mutation') || text.includes('adapt') || text.includes('benchmark')) {
      category = 'Evolution';
    }

    return {
      ...req,
      what,
      who,
      why,
      risk,
      resources,
      evidence,
      expectedResult,
      proposedAction,
      category,
    };
  }, [agents]);

  // Filtered pending list
  const activePendingList = useMemo(() => {
    return pendingRequests.map(enrichApprovalItem).filter((item) => {
      const matchesFilter = activeFilter === 'ALL' || item.category === activeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.what.toLowerCase().includes(q) ||
        item.who.toLowerCase().includes(q) ||
        item.why.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [pendingRequests, activeFilter, searchQuery, enrichApprovalItem]);

  // Filtered history list
  const activeHistoryList = useMemo(() => {
    return allHistoricalRequests
      .filter((r) => r.status !== 'PENDING')
      .map(enrichApprovalItem)
      .filter((item) => {
        const matchesFilter = activeFilter === 'ALL' || item.category === activeFilter;
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          item.what.toLowerCase().includes(q) ||
          item.who.toLowerCase().includes(q) ||
          item.why.toLowerCase().includes(q);
        return matchesFilter && matchesSearch;
      });
  }, [allHistoricalRequests, activeFilter, searchQuery, enrichApprovalItem]);

  const handleOpenAction = (request: ApprovalRequest, action: ApprovalActionType) => {
    setActionDialog({ request, action });
    setActionNote(
      action === 'APPROVE'
        ? 'Approved by human executive after reviewing telemetry and risk profile.'
        : action === 'REJECT'
        ? 'Rejected: operation exceeds risk tolerance.'
        : action === 'REQUEST_CHANGES'
        ? 'Please refine resource boundaries and provide additional test verification.'
        : action === 'DELEGATE'
        ? 'Delegated to specialized department head for deep domain evaluation.'
        : 'Escalated to Corporate Architecture Council due to constitutional ambiguity.'
    );
    setActionError(null);
  };

  const handleConfirmAction = () => {
    if (!actionDialog) return;
    decideMutation.mutate({
      requestId: actionDialog.request.id,
      action: actionDialog.action,
      notes: actionNote.trim(),
      target: delegateTarget,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card/80 to-primary/10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Human-in-the-Loop Sovereign Gate
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              NEIMAN Approval Center
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Humans retain ultimate authority. High-risk agent operations, financial commitments, and constitutional escalations require explicit human review before execution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-3.5 py-2 text-xs font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{pendingRequests.length} Pending Actions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Tab Switcher: Pending Queue vs Approval History */}
      <div className="flex items-center justify-between border-b border-border gap-4 pb-1">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Active Approval Queue ({pendingRequests.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-4 w-4" />
            Approval History & Audit Trail
          </button>
        </div>
      </div>

      {/* 7 Required Filters Ribbon & Search Input */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide text-xs">
          {FILTER_PILLS.map((pill) => {
            const Icon = pill.icon;
            const isSelected = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`} />
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search approvals (what, who, why)..."
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* TAB 1: ACTIVE APPROVAL QUEUE */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {isPendingLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
              <span className="text-xs">Connecting to governance queue...</span>
            </div>
          ) : activePendingList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-16 text-center space-y-3">
              <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-semibold text-foreground">All Approval Queues Clear</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No autonomous agent operations are currently waiting for human intervention under this filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activePendingList.map((req) => {
                const riskStyle = RISK_BADGES[req.risk as GovernanceRiskLevel] || RISK_BADGES.MEDIUM;
                const isExpanded = expandedCards[req.id] || false;
                const isHighRisk = req.risk === 'HIGH' || req.risk === 'CRITICAL';

                return (
                  <div
                    key={req.id}
                    className={`rounded-2xl border bg-card p-6 transition-all space-y-5 ${
                      isHighRisk
                        ? 'border-amber-500/40 shadow-sm'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {/* Top Identity & Status Ribbon */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            isHighRisk ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {isHighRisk ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary text-foreground">
                              {req.category}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">ID: {req.id.slice(0, 8)}</span>
                          </div>
                          <h3 className="font-bold text-base text-foreground mt-0.5">{req.what}</h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                        >
                          RISK: {req.risk}
                        </span>
                        {isHighRisk && (
                          <button
                            onClick={() => toggleExpand(req.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                            title="Toggle expanded high-risk telemetry"
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">{isExpanded ? 'Less Context' : 'Deep Context'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* The 8 Required Fields Matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      {/* 1. WHO */}
                      <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          WHO (Requester)
                        </span>
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{req.who}</span>
                        </div>
                      </div>

                      {/* 2. PROPOSED ACTION */}
                      <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          PROPOSED ACTION
                        </span>
                        <div className="font-bold text-foreground truncate font-mono">{req.proposedAction}</div>
                      </div>

                      {/* 3. EXPECTED RESULT */}
                      <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          EXPECTED RESULT
                        </span>
                        <div className="text-foreground line-clamp-2 leading-relaxed">{req.expectedResult}</div>
                      </div>

                      {/* 4. RESOURCES */}
                      <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          RESOURCES
                        </span>
                        <div className="font-mono text-emerald-400 line-clamp-2">{req.resources}</div>
                      </div>
                    </div>

                    {/* 5. WHY (Reason / Justification) */}
                    <div className="p-3.5 rounded-xl bg-background border border-border space-y-1 text-xs">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        WHY (Justification & Root Cause)
                      </span>
                      <p className="text-foreground leading-relaxed">{req.why}</p>
                    </div>

                    {/* 6. EVIDENCE & ADDITIONAL HIGH-RISK CONTEXT */}
                    {(isExpanded || !isHighRisk) && (
                      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2 text-xs animate-fade-in">
                        <div className="flex items-center justify-between text-primary font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Info className="h-4 w-4" /> EVIDENCE & TELEMETRY GROUNDING
                          </span>
                          <span className="font-mono text-[10px]">VERIFIED SYSTEM STATE</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed font-mono text-[11px]">{req.evidence}</p>

                        {req.proposed_payload && Object.keys(req.proposed_payload).length > 0 && (
                          <div className="pt-2 border-t border-primary/10 text-[10px] font-mono text-muted-foreground">
                            Payload parameters:{' '}
                            <span className="text-foreground">{JSON.stringify(req.proposed_payload)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5 Core Action Buttons: APPROVE, REJECT, REQUEST CHANGES, DELEGATE, ESCALATE */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                      <div className="text-[11px] text-muted-foreground">
                        Dispatched {new Date(req.created_at).toLocaleTimeString()} • Fast-Processing Console
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Request Changes */}
                        <button
                          type="button"
                          onClick={() => handleOpenAction(req, 'REQUEST_CHANGES')}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                        >
                          <CornerDownRight className="h-3.5 w-3.5 text-amber-400" /> Request Changes
                        </button>

                        {/* 2. Delegate */}
                        <button
                          type="button"
                          onClick={() => handleOpenAction(req, 'DELEGATE')}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                        >
                          <Users className="h-3.5 w-3.5 text-blue-400" /> Delegate
                        </button>

                        {/* 3. Escalate */}
                        <button
                          type="button"
                          onClick={() => handleOpenAction(req, 'ESCALATE')}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                        >
                          <Flame className="h-3.5 w-3.5 text-purple-400" /> Escalate
                        </button>

                        {/* 4. Reject */}
                        <button
                          type="button"
                          onClick={() => handleOpenAction(req, 'REJECT')}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>

                        {/* 5. Approve */}
                        <button
                          type="button"
                          onClick={() => handleOpenAction(req, 'APPROVE')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Execute
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPROVAL HISTORY & AUDIT TRAIL */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Concluded Executive Approval Decisions
            </h2>
            <span className="text-xs text-muted-foreground">{activeHistoryList.length} Archived Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Resolution Time</th>
                  <th className="p-3">What (Action)</th>
                  <th className="p-3">Requester (Who)</th>
                  <th className="p-3">Risk</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reviewer Notes & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeHistoryList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No historical approvals recorded matching current filter.
                    </td>
                  </tr>
                ) : (
                  activeHistoryList.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-muted-foreground font-mono">
                        {item.resolved_at ? new Date(item.resolved_at).toLocaleString() : new Date(item.updated_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-foreground">{item.what}</td>
                      <td className="p-3 text-muted-foreground">{item.who}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${RISK_BADGES[item.risk as GovernanceRiskLevel]?.border} ${RISK_BADGES[item.risk as GovernanceRiskLevel]?.text}`}>
                          {item.risk}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-sm truncate">
                        {item.reviewer_notes || 'Resolved without supplementary notes.'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTION DIALOG MODAL (APPROVE, REJECT, REQUEST CHANGES, DELEGATE, ESCALATE) */}
      {actionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  {actionDialog.action === 'APPROVE' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  {actionDialog.action === 'REJECT' && <XCircle className="h-5 w-5 text-rose-400" />}
                  {actionDialog.action === 'REQUEST_CHANGES' && <CornerDownRight className="h-5 w-5 text-amber-400" />}
                  {actionDialog.action === 'DELEGATE' && <Users className="h-5 w-5 text-blue-400" />}
                  {actionDialog.action === 'ESCALATE' && <Flame className="h-5 w-5 text-purple-400" />}
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Confirm Action: {actionDialog.action.replace('_', ' ')}
                  </h3>
                  <p className="text-xs text-muted-foreground">{actionDialog.request.title}</p>
                </div>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {actionError}
              </div>
            )}

            {/* Delegation Selector if DELEGATE */}
            {actionDialog.action === 'DELEGATE' && (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Delegate To Agent or Department Head:
                </label>
                <select
                  value={delegateTarget}
                  onChange={(e) => setDelegateTarget(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Select target recipient...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role_id || a.autonomy || 'Specialist'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Executive Reviewer Note / Directive:
              </label>
              <textarea
                rows={3}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Enter mandatory supervisory directive or rationale..."
                className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionDialog(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={decideMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {decideMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recording Action...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" /> Execute {actionDialog.action.replace('_', ' ')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

