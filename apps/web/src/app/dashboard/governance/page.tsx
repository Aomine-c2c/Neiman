'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Shield,
  FileText,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Search,
  Check,
  X,
  Plus,
  Activity,
  Layers,
  Sparkles,
  Lock,
  ArrowUpRight,
  Flame,
  Send,
  HelpCircle,
  Eye,
  Terminal,
} from 'lucide-react';
import {
  governanceApi,
  CompanyConstitution,
  AutonomyConfig,
  ApprovalRequest,
  EscalationRecord,
  GovernanceAuditLog,
  GovernanceActionEvaluationRequest,
  AutonomyConfigCreate,
  GovernanceRiskLevel,
  SandboxExecutionResult,
} from '@/lib/api/governance';
import { useOrganizationContext } from '@/lib/organizationContext';

const AUTONOMY_LEVELS = [
  { level: 0, label: 'LEVEL 0 — OBSERVE', desc: 'Read-only, telemetry gathering, zero action capacity' },
  { level: 1, label: 'LEVEL 1 — RECOMMEND', desc: 'Proposes plans & options, requires user trigger to run' },
  { level: 2, label: 'LEVEL 2 — EXECUTE WITH APPROVAL', desc: 'Default for high-risk actions, staged until human approval' },
  { level: 3, label: 'LEVEL 3 — EXECUTE WITHIN POLICY', desc: 'Autonomous within constitutional and threshold constraints' },
  { level: 4, label: 'LEVEL 4 — AUTONOMOUS', desc: 'Broad execution authority with post-action audit logging' },
  { level: 5, label: 'LEVEL 5 — AUTONOMOUS + ADAPTIVE', desc: 'Self-adjusting strategies, exception handling, and auto-fallback' },
];

const RISK_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  MEDIUM: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  HIGH: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  CRITICAL: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

export default function GovernancePage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'constitution' | 'matrix' | 'evaluator' | 'approvals' | 'escalations' | 'audits' | 'sandbox'>('constitution');

  // Execution Sandbox State
  const [sandboxLang, setSandboxLang] = useState<'bash' | 'python'>('python');
  const [sandboxCode, setSandboxCode] = useState('import os\nprint(f"Executing in isolated sandbox company={os.environ.get(\'NEIMAN_COMPANY_ID\')}")\n');
  const [sandboxTimeout, setSandboxTimeout] = useState(15.0);
  const [sandboxResult, setSandboxResult] = useState<SandboxExecutionResult | null>(null);

  // Audit filter state
  const [auditQuery, setAuditQuery] = useState('');
  const [auditResultFilter, setAuditResultFilter] = useState('');

  // Evaluator Simulator State
  const [evalActorName, setEvalActorName] = useState('Payment Gateway Agent');
  const [evalActionName, setEvalActionName] = useState('EXECUTE_CREDIT_PAYMENT');
  const [evalTarget, setEvalTarget] = useState('PaymentGateway:Stripe');
  const [evalReason, setEvalReason] = useState('SaaS infrastructure invoice disbursement $1,250');
  const [evalRiskLevel, setEvalRiskLevel] = useState<GovernanceRiskLevel>('HIGH');

  // New Autonomy Config State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newConfigLevel, setNewConfigLevel] = useState(2);
  const [newConfigRisk, setNewConfigRisk] = useState<GovernanceRiskLevel>('HIGH');
  const [newConfigTool, setNewConfigTool] = useState('');
  const [newConfigAction, setNewConfigAction] = useState('');
  const [newConfigRequiresApproval, setNewConfigRequiresApproval] = useState(true);
  const [newConfigRationale, setNewConfigRationale] = useState('');

  // Queries
  const { data: constitution, isLoading: isConstLoading, refetch: refetchConst } = useQuery({
    queryKey: ['governance-constitution', companyId],
    queryFn: () => governanceApi.getConstitution(companyId),
    enabled: !!companyId,
  });

  const { data: autonomyConfigs = [], refetch: refetchConfigs } = useQuery({
    queryKey: ['governance-autonomy-configs', companyId],
    queryFn: () => governanceApi.listAutonomyConfigs(companyId),
    enabled: !!companyId,
  });

  const { data: approvals = [], refetch: refetchApprovals } = useQuery({
    queryKey: ['governance-approvals', companyId],
    queryFn: () => governanceApi.listApprovals(companyId),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.NORMAL,
  });

  const { data: escalations = [], refetch: refetchEscalations } = useQuery({
    queryKey: ['governance-escalations', companyId],
    queryFn: () => governanceApi.listEscalations(companyId),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.NORMAL,
  });

  const { data: audits = [], refetch: refetchAudits } = useQuery({
    queryKey: ['governance-audits', companyId, auditQuery, auditResultFilter],
    queryFn: () =>
      governanceApi.queryAudits(companyId, {
        target_q: auditQuery || undefined,
        result: auditResultFilter || undefined,
        limit: NEIMAN_CONFIG.OPERATIONAL_LIMITS.DEFAULT_PAGE_SIZE * 2,
      }),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.MEDIUM,
  });

  // Mutations
  const evaluateMutation = useMutation({
    mutationFn: (req: GovernanceActionEvaluationRequest) => governanceApi.evaluateAction(companyId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance-approvals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['governance-audits', companyId] });
    },
  });

  const decideApprovalMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      governanceApi.decideApproval(companyId, id, { decision, reviewer_notes: 'Reviewed in Governance Center' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance-approvals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['governance-audits', companyId] });
    },
  });

  const runSandboxMutation = useMutation({
    mutationFn: () =>
      governanceApi.executeInSandbox(companyId, {
        code: sandboxCode,
        language: sandboxLang,
        timeout_seconds: sandboxTimeout,
      }),
    onSuccess: (data) => {
      setSandboxResult(data);
    },
  });

  const handleRunSandbox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !sandboxCode.trim()) return;
    runSandboxMutation.mutate();
  };

  const createConfigMutation = useMutation({
    mutationFn: (data: AutonomyConfigCreate) => governanceApi.createAutonomyConfig(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance-autonomy-configs', companyId] });
      setShowConfigModal(false);
      setNewConfigTool('');
      setNewConfigAction('');
      setNewConfigRationale('');
    },
  });

  const handleSimulateEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    evaluateMutation.mutate({
      actor_name: evalActorName,
      action_name: evalActionName,
      target: evalTarget,
      reason: evalReason,
      declared_risk_level: evalRiskLevel,
    });
  };

  const handleCreateConfig = (e: React.FormEvent) => {
    e.preventDefault();
    createConfigMutation.mutate({
      autonomy_level: newConfigLevel,
      risk_level: newConfigRisk,
      requires_explicit_approval: newConfigRequiresApproval,
      tool_name: newConfigTool || undefined,
      action_name: newConfigAction || undefined,
      rationale: newConfigRationale || undefined,
    });
  };

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;
  const openEscalationsCount = escalations.filter((e) => e.status === 'OPEN').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card/80 to-primary/10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Shield className="h-3.5 w-3.5" />
              NEIMAN Organizational Governance Layer
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Company Constitution & Autonomy Matrix
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Every company in NEIMAN is bounded by a living Company Constitution, hierarchical 6-tier autonomy levels (Levels 0–5), explicit human-in-the-loop approval gates for high-risk operations, and consequential action audit logs.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                refetchConst();
                refetchConfigs();
                refetchApprovals();
                refetchEscalations();
                refetchAudits();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" /> Refresh Telemetry
            </button>
          </div>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Constitution Version</span>
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            v{constitution?.version ?? 1}.0
          </div>
          <div className="text-[10px] text-emerald-400 font-mono">Enforcing Active Charter</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Autonomy Rules</span>
            <Sliders className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {autonomyConfigs.length}
          </div>
          <div className="text-[10px] text-muted-foreground">Hierarchical overrides</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pending Approvals</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {pendingApprovalsCount}
          </div>
          <div className="text-[10px] text-amber-400 font-semibold">Human-in-the-loop gates</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Open Escalations</span>
            <Flame className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {openEscalationsCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Blocked agent events</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Audited Actions</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {audits.length}
          </div>
          <div className="text-[10px] text-muted-foreground">Consequential records</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab('constitution')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'constitution'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <FileText className="h-4 w-4" />
          Company Constitution
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'matrix'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Sliders className="h-4 w-4" />
          Autonomy Matrix (0–5)
        </button>

        <button
          onClick={() => setActiveTab('evaluator')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'evaluator'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Sparkles className="h-4 w-4" />
          Action Evaluation Simulator
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'approvals'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Approval Gates ({pendingApprovalsCount})
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'audits'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Eye className="h-4 w-4" />
          Consequential Action Audit Viewer ({audits.length})
        </button>

        <button
          onClick={() => setActiveTab('sandbox')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'sandbox'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Terminal className="h-4 w-4" />
          Execution Sandbox
        </button>
      </div>

      {/* TAB 1: COMPANY CONSTITUTION */}
      {activeTab === 'constitution' && (
        <div className="space-y-6">
          {/* Mission & Purpose */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider block">Company Mission</span>
            <p className="text-base text-foreground font-medium leading-relaxed">{constitution?.mission}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Core Values */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider block">Values & Ethics</span>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {constitution?.values.map((v, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Operating Principles */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider block">Operating Principles</span>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {constitution?.operating_principles.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Prohibited Actions */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Prohibited Actions
              </span>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {constitution?.prohibited_actions.map((pa, i) => (
                  <li key={i} className="flex items-start gap-2 text-rose-300">
                    <X className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{pa}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Domain Rules Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Security Rules */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Security Rules
              </span>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {constitution?.security_rules.map((sr, i) => (
                  <li key={i} className="list-disc list-inside">{sr}</li>
                ))}
              </ul>
            </div>

            {/* Financial Rules */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Financial Ceilings</span>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {constitution?.financial_rules.map((fr, i) => (
                  <li key={i} className="list-disc list-inside">{fr}</li>
                ))}
              </ul>
            </div>

            {/* Data Classification Rules */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider block">Data Residency Rules</span>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {constitution?.data_rules.map((dr, i) => (
                  <li key={i} className="list-disc list-inside">{dr}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUTONOMY MATRIX (0 TO 5) */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Autonomy Level Legend */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {AUTONOMY_LEVELS.map((al) => (
              <div key={al.level} className="p-3 rounded-xl border border-border bg-card space-y-1">
                <span className="text-xs font-bold text-primary font-mono block">Level {al.level}</span>
                <span className="text-[11px] font-semibold text-foreground block">{al.label.split('—')[1]}</span>
                <p className="text-[10px] text-muted-foreground leading-tight">{al.desc}</p>
              </div>
            ))}
          </div>

          {/* Configured Rules */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Hierarchical Autonomy Configuration</h2>
                <p className="text-xs text-muted-foreground">Configurable per company, department, role, agent, tool, and action.</p>
              </div>
              <button
                onClick={() => setShowConfigModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" /> Add Rule
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3">Scope Target</th>
                    <th className="p-3">Autonomy Level</th>
                    <th className="p-3">Risk Tier</th>
                    <th className="p-3">Requires Explicit Approval</th>
                    <th className="p-3">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {autonomyConfigs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Defaulting to Constitutional Baseline (Level 3 within policy, Level 2 for High Risk).
                      </td>
                    </tr>
                  ) : (
                    autonomyConfigs.map((ac) => (
                      <tr key={ac.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-semibold text-foreground font-mono">
                          {ac.tool_name ? `Tool: ${ac.tool_name}` : ac.action_name ? `Action: ${ac.action_name}` : 'Company Default'}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold">
                            Level {ac.autonomy_level}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${RISK_BADGES[ac.risk_level]?.bg} ${RISK_BADGES[ac.risk_level]?.text} ${RISK_BADGES[ac.risk_level]?.border}`}>
                            {ac.risk_level}
                          </span>
                        </td>
                        <td className="p-3">
                          {ac.requires_explicit_approval ? (
                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" /> Mandatory Gate
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Auto-permitted</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate">{ac.rationale || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EVALUATION SIMULATOR */}
      {activeTab === 'evaluator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Action Governance Evaluator</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Simulate whether an organizational action is permitted, prohibited by constitution, or routed to a human approval gate.
              </p>
            </div>

            <form onSubmit={handleSimulateEvaluation} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Actor Name</label>
                <input
                  type="text"
                  value={evalActorName}
                  onChange={(e) => setEvalActorName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Action Name</label>
                  <input
                    type="text"
                    value={evalActionName}
                    onChange={(e) => setEvalActionName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Declared Risk Tier</label>
                  <select
                    value={evalRiskLevel}
                    onChange={(e) => setEvalRiskLevel(e.target.value as GovernanceRiskLevel)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH (Requires Approval Gate)</option>
                    <option value="CRITICAL">CRITICAL (Strict Oversight)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Target Resource / Endpoint</label>
                <input
                  type="text"
                  value={evalTarget}
                  onChange={(e) => setEvalTarget(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Explicit Reason (Why action is taken)</label>
                <textarea
                  rows={2}
                  value={evalReason}
                  onChange={(e) => setEvalReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={evaluateMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {evaluateMutation.isPending ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" /> Evaluating Constitution & Policies...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" /> Evaluate Action Authority
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Outcome Screen */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-base font-semibold text-foreground">Governance Decision</h2>
                {evaluateMutation.data && (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${evaluateMutation.data.allowed
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : evaluateMutation.data.is_prohibited
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                  >
                    {evaluateMutation.data.allowed
                      ? 'PERMITTED'
                      : evaluateMutation.data.is_prohibited
                        ? 'PROHIBITED'
                        : 'APPROVAL REQUIRED'}
                  </span>
                )}
              </div>

              {evaluateMutation.isPending && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                  <RotateCw className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Checking constitutional clauses and risk gates...</p>
                </div>
              )}

              {evaluateMutation.data && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground block">Effective Autonomy Level</span>
                      <span className="text-xs font-bold text-primary font-mono">
                        Level {evaluateMutation.data.effective_autonomy_level} ({evaluateMutation.data.effective_autonomy_label})
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground block">Approval Gate Status</span>
                      <span className="text-xs font-semibold text-foreground">
                        {evaluateMutation.data.requires_approval ? 'Active Gate Created' : 'Direct Execution'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-background space-y-1">
                    <span className="text-xs font-semibold text-foreground block">Governance Evaluation Rationale</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {evaluateMutation.data.reason}
                    </p>
                  </div>

                  {evaluateMutation.data.approval_request_id && (
                    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex justify-between items-center">
                      <span>Approval Ticket ID: {evaluateMutation.data.approval_request_id.slice(0, 8)}...</span>
                      <button
                        onClick={() => setActiveTab('approvals')}
                        className="underline font-semibold hover:text-amber-200"
                      >
                        View in Approval Queue →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!evaluateMutation.data && !evaluateMutation.isPending && (
                <div className="py-20 text-center space-y-2 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs">Dispatch an action specification to test organizational boundaries.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: APPROVAL GATES */}
      {activeTab === 'approvals' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Human-in-the-Loop Approval Queue</h2>
            <span className="text-xs text-muted-foreground">High-Risk & Level 2 Operations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Title & Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Risk Level</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No approval requests currently pending.
                    </td>
                  </tr>
                ) : (
                  approvals.map((app) => (
                    <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-semibold text-foreground">
                        <div>{app.title}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{app.action}</div>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">{app.target}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${RISK_BADGES[app.risk_level]?.bg} ${RISK_BADGES[app.risk_level]?.text} ${RISK_BADGES[app.risk_level]?.border}`}>
                          {app.risk_level}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs">{app.reason}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${app.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : app.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {app.status === 'PENDING' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => decideApprovalMutation.mutate({ id: app.id, decision: 'APPROVED' })}
                              disabled={decideApprovalMutation.isPending}
                              className="px-2.5 py-1 rounded bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => decideApprovalMutation.mutate({ id: app.id, decision: 'REJECTED' })}
                              disabled={decideApprovalMutation.isPending}
                              className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-semibold hover:bg-rose-500/30 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT VIEWER */}
      {activeTab === 'audits' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Search consequential action logs (target, reason keywords)..."
                className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={auditResultFilter}
              onChange={(e) => setAuditResultFilter(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">All Results</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Consequential Action Audit Records</h2>
              <span className="text-xs text-muted-foreground">Every action has: Actor, Authority, Timestamp, Action, Target, Reason, Result</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Authority</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Reason (Why it happened)</th>
                    <th className="p-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {audits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        No consequential actions recorded matching filters.
                      </td>
                    </tr>
                  ) : (
                    audits.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono text-muted-foreground">
                          {new Date(a.created_at).toLocaleTimeString()}
                        </td>
                        <td className="p-3 font-semibold text-foreground">
                          <div>{a.actor_name}</div>
                          <div className="text-[10px] text-muted-foreground">{a.actor_type}</div>
                        </td>
                        <td className="p-3 font-mono text-primary text-[11px]">{a.authority}</td>
                        <td className="p-3 font-mono text-foreground">{a.action}</td>
                        <td className="p-3 font-mono text-muted-foreground">{a.target}</td>
                        <td className="p-3 text-muted-foreground max-w-sm">{a.reason}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${a.result === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : a.result === 'BLOCKED'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-amber-500/10 text-amber-400'
                              }`}
                          >
                            {a.result}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: EXECUTION SANDBOX */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  Zero-Trust Tool & Script Execution Sandbox
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Ephemeral isolated execution container with AST safety verification, secret stripping, and process timeout boundaries.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-primary/10 text-primary border border-primary/20">
                  Container: neiman_sandbox_{companyId.slice(0, 8)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRunSandbox} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Runtime Environment</label>
                  <select
                    value={sandboxLang}
                    onChange={(e) => setSandboxLang(e.target.value as 'bash' | 'python')}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                  >
                    <option value="python">Python 3 (AST Inspected)</option>
                    <option value="bash">Bash Subprocess (Restricted)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Execution Timeout (Seconds)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="0.5"
                    value={sandboxTimeout}
                    onChange={(e) => setSandboxTimeout(parseFloat(e.target.value) || 15.0)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={runSandboxMutation.isPending || !sandboxCode.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {runSandboxMutation.isPending ? (
                      <>
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        Executing in Sandbox...
                      </>
                    ) : (
                      <>
                        <Terminal className="h-3.5 w-3.5" />
                        Execute Isolated Payload
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-foreground">Code / Script Payload</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSandboxCode(
                          sandboxLang === 'python'
                            ? 'import os\nprint(f"Company ID: {os.environ.get(\'NEIMAN_COMPANY_ID\')}")\nwith open("summary.txt", "w") as f:\n    f.write("Sandbox job successful")\nprint("Generated summary.txt")\n'
                            : 'echo "Active sandbox directory: $(pwd)"\necho "test output" > test.txt\nls -la\n'
                        )
                      }
                      className="text-[11px] text-primary hover:underline"
                    >
                      Load Safe Sample
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSandboxCode(
                          sandboxLang === 'python'
                            ? 'import ctypes\nctypes.CDLL(None)\n'
                            : 'rm -rf /\n'
                        )
                      }
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Load Blocked Sample
                    </button>
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={sandboxCode}
                  onChange={(e) => setSandboxCode(e.target.value)}
                  placeholder="Enter code or command to execute in sandbox..."
                  className="w-full rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-100 focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>
            </form>

            {/* Sandbox Execution Output Console */}
            {sandboxResult && (
              <div className="mt-4 rounded-xl border border-border bg-zinc-950 p-4 space-y-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">STATUS:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sandboxResult.status === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : sandboxResult.status === 'FORBIDDEN'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : sandboxResult.status === 'TIMED_OUT'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {sandboxResult.status}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">EXIT: {sandboxResult.exit_code}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">LATENCY: {sandboxResult.duration_ms}ms</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    ID: {sandboxResult.execution_id}
                  </div>
                </div>

                {sandboxResult.violation_reason && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300 text-xs">
                    <span className="font-semibold block mb-0.5">SECURITY GATE REJECTION:</span>
                    {sandboxResult.violation_reason}
                  </div>
                )}

                {sandboxResult.files_created.length > 0 && (
                  <div>
                    <span className="text-zinc-400 block mb-1">FILES CREATED IN ISOLATED WORKSPACE:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sandboxResult.files_created.map((f, i) => (
                        <span key={i} className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 text-[11px]">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-zinc-400 block mb-1">STANDARD OUTPUT:</span>
                  <pre className="rounded bg-black/60 p-3 text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-48 text-[11px]">
                    {sandboxResult.stdout || '<empty>'}
                  </pre>
                </div>

                {sandboxResult.stderr && (
                  <div>
                    <span className="text-zinc-400 block mb-1">STANDARD ERROR / DIAGNOSTICS:</span>
                    <pre className="rounded bg-black/60 p-3 text-rose-400 overflow-x-auto whitespace-pre-wrap max-h-48 text-[11px]">
                      {sandboxResult.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-foreground">Add Custom Autonomy Rule</h3>
            <form onSubmit={handleCreateConfig} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Autonomy Level</label>
                <select
                  value={newConfigLevel}
                  onChange={(e) => setNewConfigLevel(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  {AUTONOMY_LEVELS.map((al) => (
                    <option key={al.level} value={al.level}>
                      {al.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Target Tool (Optional)</label>
                  <input
                    type="text"
                    value={newConfigTool}
                    onChange={(e) => setNewConfigTool(e.target.value)}
                    placeholder="e.g. database_write"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Target Action (Optional)</label>
                  <input
                    type="text"
                    value={newConfigAction}
                    onChange={(e) => setNewConfigAction(e.target.value)}
                    placeholder="e.g. issue_refund"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Rationale</label>
                <input
                  type="text"
                  value={newConfigRationale}
                  onChange={(e) => setNewConfigRationale(e.target.value)}
                  placeholder="Why this autonomy rule applies"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reqApproval"
                  checked={newConfigRequiresApproval}
                  onChange={(e) => setNewConfigRequiresApproval(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <label htmlFor="reqApproval" className="text-xs text-muted-foreground">
                  Require explicit human approval before execution
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createConfigMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Save Autonomy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
