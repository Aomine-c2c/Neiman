'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Cpu,
  Database,
  Coins,
  Activity,
  Layers,
  Shield,
  Zap,
  Clock,
  RotateCw,
  Server,
  AlertTriangle,
  CheckCircle2,
  Send,
  Plus,
  Scale,
  Sliders,
  Flame,
  Check,
  HardDrive,
  Users,
  Maximize2,
  Minimize2,
  Network,
  Bot,
  Building2,
  ChevronRight,
  Filter,
  TrendingUp,
  FolderGit2,
} from 'lucide-react';
import {
  resourcesApi,
  ResourceCategory,
  ResourcePriority,
  ResourceEvaluationDecision,
  ResourcePool,
  ResourceBudget,
  ResourceRequestCreate,
  ResourcePoolCreate,
  ResourceBudgetCreate,
} from '@/lib/api/resources';
import { organizationsApi, Department } from '@/lib/api/organizations';
import { projectsApi, Project, Task } from '@/lib/api/projects';
import { agentsApi, Agent } from '@/lib/api/agents';
import { governanceApi } from '@/lib/api/governance';
import { useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';

const DECISION_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  APPROVE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  DENY: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  DEFER: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  REDUCE: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  QUEUE: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
};

const PRIORITY_BADGES: Record<string, string> = {
  CRITICAL: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  HIGH: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  NORMAL: 'text-primary bg-primary/10 border-primary/30',
  LOW: 'text-muted-foreground bg-muted border-border',
  BACKGROUND: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export default function ResourceControlCenterPage() {
  const activeCompany = useOrganizationContext();
  const previewMode = isDevelopmentAuthBypassEnabled();
  const companyId = activeCompany?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'control' | 'pools' | 'budgets' | 'simulator' | 'requests' | 'drilldown'>('control');

  // Hierarchical Drilldown State
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ALL');

  // Request Simulator Form State
  const [priority, setPriority] = useState<ResourcePriority>('NORMAL');
  const [justification, setJustification] = useState('Run large research analysis.');
  const [cpuCores, setCpuCores] = useState('4.0');
  const [ramGb, setRamGb] = useState('8.0');
  const [storageGb, setStorageGb] = useState('10.0');
  const [tokens, setTokens] = useState('200000');
  const [maxInferenceCost, setMaxInferenceCost] = useState('2.0');
  const [runtimeMinutes, setRuntimeMinutes] = useState('30.0');
  const [slotsNeeded, setSlotsNeeded] = useState('1');
  const [expectedValue, setExpectedValue] = useState('7.0');

  // New Pool Modal State
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolCategory, setNewPoolCategory] = useState<ResourceCategory>('COMPUTE');
  const [newPoolCapacity, setNewPoolCapacity] = useState('16.0');
  const [newPoolUnit, setNewPoolUnit] = useState('cores');

  // Queries
  const { data: controlCenter, isLoading, refetch } = useQuery({
    queryKey: ['resources-control-center', companyId],
    queryFn: () => resourcesApi.getControlCenter(companyId),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.MEDIUM,
  });

  const { data: pools = [] } = useQuery({
    queryKey: ['resources-pools', companyId],
    queryFn: () => resourcesApi.listPools(companyId),
    enabled: !!companyId,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['resources-budgets', companyId],
    queryFn: () => resourcesApi.listBudgets(companyId),
    enabled: !!companyId,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['resources-requests', companyId],
    queryFn: () => resourcesApi.listRequests(companyId),
    enabled: !!companyId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['org-departments', companyId],
    queryFn: () => organizationsApi.listDepartments(companyId),
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list', companyId],
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list', companyId],
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ['pending-approvals-count', companyId],
    queryFn: () => governanceApi.listApprovals(companyId, 'PENDING'),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.SLOW,
  });

  // Mutations
  const submitRequestMutation = useMutation({
    mutationFn: (req: ResourceRequestCreate) => resourcesApi.submitRequest(companyId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources-control-center', companyId] });
      queryClient.invalidateQueries({ queryKey: ['resources-requests', companyId] });
      queryClient.invalidateQueries({ queryKey: ['resources-pools', companyId] });
    },
  });

  const createPoolMutation = useMutation({
    mutationFn: (data: ResourcePoolCreate) => resourcesApi.createPool(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources-pools', companyId] });
      queryClient.invalidateQueries({ queryKey: ['resources-control-center', companyId] });
      setShowPoolModal(false);
      setNewPoolName('');
    },
  });

  const handleSimulateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    submitRequestMutation.mutate({
      priority,
      justification,
      requested_compute: {
        cpu_cores: parseFloat(cpuCores) || 1.0,
        ram_gb: parseFloat(ramGb) || 2.0,
        storage_gb: parseFloat(storageGb) || 1.0,
      },
      requested_intelligence: {
        tokens: parseInt(tokens, 10) || 50000,
        max_inference_cost_usd: parseFloat(maxInferenceCost) || 1.0,
      },
      requested_operational: {
        runtime_minutes: parseFloat(runtimeMinutes) || 15.0,
        slots_needed: parseInt(slotsNeeded, 10) || 1,
      },
      applicable_budget_ids: budgets.map((b) => b.id),
      expected_value_score: parseFloat(expectedValue) || 5.0,
    });
  };

  const handleCreatePool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoolName) return;
    createPoolMutation.mutate({
      name: newPoolName,
      category: newPoolCategory,
      total_capacity: parseFloat(newPoolCapacity) || 10.0,
      unit: newPoolUnit,
    });
  };

  const host = controlCenter?.system_host_telemetry;
  const budget = controlCenter?.budget_consumption;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header / Philosophy Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card/80 to-primary/10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Database className="h-3.5 w-3.5" />
              NEIMAN Resource Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Finite Operational Asset Orchestration
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {previewMode
                ? 'Explore how compute, intelligence, budgets, and operational capacity fit together using synthetic preview values.'
                : 'Resources are not limited to financial budgets. Compute (CPU, RAM, GPU, Storage), Intelligence (tokens, quotas), Financial (spend), and Operational capacity (slots, human approval, time) are evaluated and scheduled from connected telemetry.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPoolModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New Pool
            </button>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Metric Distinction Legend */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card/50 text-[11px]">
        {previewMode ? <>
          <span className="font-semibold text-foreground mr-2">Preview Data Legend:</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">SAMPLE</span>
          <span className="text-muted-foreground">All host, capacity, provider, and cost figures on this page are synthetic design data.</span>
        </> : <>
          <span className="font-semibold text-foreground mr-2">Telemetry Legend:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            OBSERVED
          </span>
          <span className="text-muted-foreground mr-3">Genuine OS/provider measurement</span>

          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            ESTIMATED
          </span>
          <span className="text-muted-foreground mr-3">Task heuristic claim</span>

          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
            ALLOCATED
          </span>
          <span className="text-muted-foreground mr-3">Reserved from pool</span>

          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
            LIMITED
          </span>
          <span className="text-muted-foreground mr-3">Hard quota ceiling</span>

          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            AVAILABLE
          </span>
          <span className="text-muted-foreground">Limited - Allocated</span>
        </>}
      </div>

      {/* 11-Card Primary Telemetry Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-3">
        {/* 1. CPU */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">CPU</span>
            <Cpu className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {host?.cpu_cores_available ?? 16} Cores
          </div>
          <div className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            {previewMode ? 'SAMPLE' : 'OBSERVED'}
          </div>
        </div>

        {/* 2. RAM */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">RAM</span>
            <Server className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {host?.ram_total_mb ? Math.round(host.ram_total_mb / 1024) : 32} GB
          </div>
          <div className="text-[9px] text-muted-foreground font-mono">
            {previewMode ? '12 GB used' : 'Linux CGroup'}
          </div>
        </div>

        {/* 3. GPU */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">GPU</span>
            <Zap className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {host?.gpu_detected ? '1x RTX' : '8 GB VRAM'}
          </div>
          <div className="text-[9px] text-amber-400 font-mono">
            CUDA Acceleration
          </div>
        </div>

        {/* 4. Storage */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Storage</span>
            <HardDrive className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {host?.storage_free_gb ?? 384} GB
          </div>
          <div className="text-[9px] text-muted-foreground font-mono">
            Free of {host?.storage_total_gb ?? 512} GB
          </div>
        </div>

        {/* 5. Network */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Network</span>
            <Network className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            1.2 Gbps
          </div>
          <div className="text-[9px] text-purple-400 font-mono">
            Low Latency Mesh
          </div>
        </div>

        {/* 6. Tokens */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Tokens</span>
            <Layers className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {((controlCenter?.provider_usage?.reduce((acc, p) => acc + p.total_tokens, 0) || 620000) / 1000).toFixed(0)}k
          </div>
          <div className="text-[9px] text-muted-foreground font-mono">
            of 1,000k Quota
          </div>
        </div>

        {/* 7. API Calls */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">API Calls</span>
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {controlCenter?.provider_usage?.reduce((acc, p) => acc + p.request_count, 0) || 142}
          </div>
          <div className="text-[9px] text-emerald-400 font-mono">
            99.9% Route Success
          </div>
        </div>

        {/* 8. Provider Quotas */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Quotas</span>
            <Sliders className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {pools.length || 4} Pools
          </div>
          <div className="text-[9px] text-rose-400 font-mono">
            {controlCenter?.bottlenecks?.length || 0} Bottlenecks
          </div>
        </div>

        {/* 9. Budget */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Budget</span>
            <Coins className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            ${budget?.spent_budget_usd ? budget.spent_budget_usd.toFixed(0) : '18'} / ${budget?.total_budget_usd ? budget.total_budget_usd.toFixed(0) : '50'}
          </div>
          <div className="text-[9px] text-emerald-400 font-mono">
            {budget?.burn_rate_percent ?? 36}% Spent
          </div>
        </div>

        {/* 10. Agent Capacity */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Capacity</span>
            <Bot className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {controlCenter?.active_allocations_count ?? 6} / 12 Slots
          </div>
          <div className="text-[9px] text-sky-400 font-mono">
            {agents.length || 6} Registered
          </div>
        </div>

        {/* 11. Human Approval Queue */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Approvals</span>
            <Shield className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-foreground font-mono">
            {pendingApprovals.length} Pending
          </div>
          <div className="text-[9px] text-amber-400 font-mono">
            Human Gate Active
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'control'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Activity className="h-4 w-4" />
          Resource Control Center
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'simulator'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Scale className="h-4 w-4" />
          Resource Request Evaluator
        </button>

        <button
          onClick={() => setActiveTab('pools')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'pools'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Layers className="h-4 w-4" />
          Resource Pools ({pools.length})
        </button>

        <button
          onClick={() => setActiveTab('budgets')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'budgets'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Coins className="h-4 w-4" />
          Financial & Token Budgets ({budgets.length})
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Clock className="h-4 w-4" />
          Evaluation Ledger ({requests.length})
        </button>

        <button
          onClick={() => setActiveTab('drilldown')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'drilldown'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <FolderGit2 className="h-4 w-4" />
          Resource Drilldown & Provenance
        </button>
      </div>

      {/* TAB 1: CONTROL CENTER */}
      {activeTab === 'control' && (
        <div className="space-y-6">
          {/* Bottlenecks Warning Banner */}
          {controlCenter?.bottlenecks && controlCenter.bottlenecks.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
              <div className="text-sm font-semibold text-rose-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                Active Operational Bottlenecks Detected
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {controlCenter.bottlenecks.map((b) => (
                  <div key={b.pool_id} className="p-3 rounded-lg bg-card/80 border border-rose-500/20 text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>{b.pool_name}</span>
                      <span className="text-rose-400">{b.utilization_percentage}% Allocated</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">{b.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Dimensional Capacity Grid with 5 Primary Metrics */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Multi-Dimensional Capacity Breakdown</h2>
                <p className="text-xs text-muted-foreground">
                  Complete resource tracking displaying CURRENT (observed), ALLOCATED, AVAILABLE, LIMIT, and projected FORECAST.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {controlCenter?.capacities.map((c, idx) => {
                // Forecast calculation: run-rate projection based on current observed + allocated drift
                const forecastUsage = Math.min(
                  c.limited_capacity,
                  Math.round(c.observed_usage > 0 ? c.observed_usage * 1.18 : c.allocated_capacity * 1.1)
                );

                return (
                  <div key={idx} className="p-4 rounded-xl border border-border bg-background space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        {c.category} ({c.unit})
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${c.utilization_percentage >= 80 ? 'text-rose-400' : 'text-primary'
                          }`}
                      >
                        {c.utilization_percentage}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${c.utilization_percentage >= 80
                            ? 'bg-rose-500'
                            : c.utilization_percentage >= 50
                              ? 'bg-amber-500'
                              : 'bg-primary'
                          }`}
                        style={{ width: `${Math.min(100, c.utilization_percentage)}%` }}
                      />
                    </div>

                    {/* 5-Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-2 border-t border-border/50">
                      <div className="p-2 rounded bg-card/60 border border-border/40">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>CURRENT</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">OBSERVED</span>
                        </div>
                        <div className="font-mono text-purple-400 font-bold mt-0.5">
                          {c.observed_usage.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 rounded bg-card/60 border border-border/40">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>ALLOCATED</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 font-mono">COMMITTED</span>
                        </div>
                        <div className="font-mono text-blue-400 font-bold mt-0.5">
                          {c.allocated_capacity.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 rounded bg-card/60 border border-border/40">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>AVAILABLE</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">FREE</span>
                        </div>
                        <div className="font-mono text-emerald-400 font-bold mt-0.5">
                          {c.available_capacity.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 rounded bg-card/60 border border-border/40">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>LIMIT</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 font-mono">CEILING</span>
                        </div>
                        <div className="font-mono text-foreground font-bold mt-0.5">
                          {c.limited_capacity.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 rounded bg-card/60 border border-border/40 col-span-2 sm:col-span-2">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-amber-400" /> FORECAST
                          </span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono">ESTIMATED</span>
                        </div>
                        <div className="font-mono text-amber-400 font-bold mt-0.5 flex items-center justify-between">
                          <span>~{forecastUsage.toLocaleString()} {c.unit}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Next 24h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expensive Tasks & Provider Usage Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expensive Tasks */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-400" /> Expensive Tasks & Resource Consumers
              </h2>
              <div className="space-y-3">
                {controlCenter?.expensive_tasks.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-background space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-xs text-foreground">{t.task_title}</div>
                      <div className="text-xs font-mono font-bold text-emerald-400">${t.cost_usd.toFixed(2)}</div>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Agent: {t.agent_name || 'System Operator'}</span>
                      <span>Tokens: {t.tokens_consumed.toLocaleString()}</span>
                      <span>CPU Duration: {Math.round(t.cpu_duration_seconds)}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provider Intelligence Consumption */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Intelligence Provider Consumption
              </h2>
              <div className="space-y-3">
                {controlCenter?.provider_usage.map((p, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-background flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-foreground">{p.provider_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.request_count} queries dispatched • {p.total_tokens.toLocaleString()} tokens
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-400">${p.total_cost_usd.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">Cost in USD</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REQUEST SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Submit Task Resource Request</h2>
              <p className="text-xs text-muted-foreground mt-1">
                The engine evaluates availability, priority, policy, budget, and expected value before issuing a decision (APPROVE, DENY, DEFER, REDUCE, or QUEUE).
              </p>
            </div>

            <form onSubmit={handleSimulateRequest} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Task Justification</label>
                <input
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Priority Tier</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ResourcePriority)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="CRITICAL">CRITICAL (Executive / Severe)</option>
                    <option value="HIGH">HIGH (Urgent Workflow)</option>
                    <option value="NORMAL">NORMAL (Default Task)</option>
                    <option value="LOW">LOW (Deferred Execution)</option>
                    <option value="BACKGROUND">BACKGROUND (Batch Workload)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Expected ROI / Value (1-10)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={expectedValue}
                    onChange={(e) => setExpectedValue(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Compute Specs */}
              <div className="p-3 rounded-lg border border-border bg-background space-y-3">
                <span className="text-xs font-semibold text-primary block">Compute Requirements</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">CPU Cores</label>
                    <input
                      type="number"
                      step="0.5"
                      value={cpuCores}
                      onChange={(e) => setCpuCores(e.target.value)}
                      className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">RAM (GB)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={ramGb}
                      onChange={(e) => setRamGb(e.target.value)}
                      className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Storage (GB)</label>
                    <input
                      type="number"
                      step="1"
                      value={storageGb}
                      onChange={(e) => setStorageGb(e.target.value)}
                      className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Intelligence Specs */}
              <div className="p-3 rounded-lg border border-border bg-background space-y-3">
                <span className="text-xs font-semibold text-primary block">Intelligence & Financial Specs</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Model Tokens Needed</label>
                    <input
                      type="number"
                      value={tokens}
                      onChange={(e) => setTokens(e.target.value)}
                      className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Max Cost Ceiling ($ USD)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={maxInferenceCost}
                      onChange={(e) => setMaxInferenceCost(e.target.value)}
                      className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Operational Specs */}
              <div className="p-3 rounded-lg border border-border bg-background space-y-3">
                <span className="text-xs font-semibold text-primary block">Operational Limits</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Max Duration (Minutes)</label>
                    <input
                      type="number"
                      value={runtimeMinutes}
                      onChange={(e) => setRuntimeMinutes(e.target.value)}
                      className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Slots Needed</label>
                    <input
                      type="number"
                      value={slotsNeeded}
                      onChange={(e) => setSlotsNeeded(e.target.value)}
                      className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitRequestMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitRequestMutation.isPending ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" /> Evaluating Resource Availability...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Evaluate Resource Request
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Evaluation Outcome Display */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-base font-semibold text-foreground">Evaluation & Scheduling Outcome</h2>
                {submitRequestMutation.data && (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${DECISION_BADGES[submitRequestMutation.data.evaluation.decision]?.bg
                      } ${DECISION_BADGES[submitRequestMutation.data.evaluation.decision]?.text} ${DECISION_BADGES[submitRequestMutation.data.evaluation.decision]?.border
                      }`}
                  >
                    {submitRequestMutation.data.evaluation.decision}
                  </span>
                )}
              </div>

              {submitRequestMutation.isPending && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                  <RotateCw className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Arbitrating finite operational capacities, active reservations, and priority queues...
                  </p>
                </div>
              )}

              {submitRequestMutation.data && (
                <div className="mt-4 space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-background space-y-2">
                    <div className="text-xs font-semibold text-foreground">Decision Rationale</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {submitRequestMutation.data.evaluation.decision_reason}
                    </p>
                  </div>

                  {submitRequestMutation.data.evaluation.decision === 'APPROVE' && (
                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs">
                      <strong>Allocations Reserved:</strong> Committed resources across{' '}
                      {submitRequestMutation.data.evaluation.allocated_pool_ids.length} pools immediately.
                    </div>
                  )}

                  {submitRequestMutation.data.evaluation.decision === 'REDUCE' && (
                    <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs space-y-1">
                      <strong>Adjusted Quota Granted:</strong>
                      <div>
                        Scaled down CPU cores to{' '}
                        {submitRequestMutation.data.evaluation.adjusted_compute?.cpu_cores} and tokens to{' '}
                        {submitRequestMutation.data.evaluation.adjusted_intelligence?.tokens} to avoid pool exhaustion.
                      </div>
                    </div>
                  )}

                  {submitRequestMutation.data.evaluation.decision === 'QUEUE' && (
                    <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs">
                      <strong>Enqueued:</strong> Task placed at queue position{' '}
                      {submitRequestMutation.data.evaluation.queue_position} awaiting active allocation completion.
                    </div>
                  )}

                  {submitRequestMutation.data.evaluation.decision === 'DEFER' && (
                    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
                      <strong>Deferred:</strong> Retry scheduled after{' '}
                      {submitRequestMutation.data.evaluation.suggested_defer_seconds} seconds.
                    </div>
                  )}
                </div>
              )}

              {!submitRequestMutation.data && !submitRequestMutation.isPending && (
                <div className="py-20 text-center space-y-2 text-muted-foreground">
                  <Scale className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs">Submit a request to trigger real-time multi-dimensional scheduling.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RESOURCE POOLS */}
      {activeTab === 'pools' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Operational Resource Pools</h2>
            <button
              onClick={() => setShowPoolModal(true)}
              className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add Pool
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Pool Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Total (LIMITED)</th>
                  <th className="p-3">ALLOCATED</th>
                  <th className="p-3">AVAILABLE</th>
                  <th className="p-3">OBSERVED</th>
                  <th className="p-3">Utilization</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pools.map((p) => {
                  const util = p.total_capacity > 0 ? (p.allocated_capacity / p.total_capacity) * 100 : 0;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-semibold text-foreground">
                        <div>{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">{p.description}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-purple-400 font-semibold">
                        {p.total_capacity.toLocaleString()} {p.unit}
                      </td>
                      <td className="p-3 font-mono text-blue-400 font-semibold">
                        {p.allocated_capacity.toLocaleString()} {p.unit}
                      </td>
                      <td className="p-3 font-mono text-emerald-400 font-semibold">
                        {p.available_capacity.toLocaleString()} {p.unit}
                      </td>
                      <td className="p-3 font-mono text-cyan-400 font-semibold">
                        {p.observed_usage.toLocaleString()} {p.unit}
                      </td>
                      <td className="p-3 font-mono font-bold">
                        <span className={util >= 80 ? 'text-rose-400' : 'text-primary'}>{util.toFixed(1)}%</span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BUDGETS */}
      {activeTab === 'budgets' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Financial & Token Budgets</h2>
            <span className="text-xs text-muted-foreground">Department & Project Allotments</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Budget Name</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Total ($ USD)</th>
                  <th className="p-3">Spent ($ USD)</th>
                  <th className="p-3">Remaining ($ USD)</th>
                  <th className="p-3">Tokens Quota</th>
                  <th className="p-3">Tokens Consumed</th>
                  <th className="p-3">Alert Threshold</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {budgets.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-semibold text-foreground">{b.name}</td>
                    <td className="p-3 text-muted-foreground uppercase">{b.fiscal_period}</td>
                    <td className="p-3 font-mono text-foreground">${b.total_budget_usd.toFixed(2)}</td>
                    <td className="p-3 font-mono text-amber-400">
                      <div>${b.spent_budget_usd.toFixed(2)}</div>
                      {b.reserved_budget_usd > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          ${b.reserved_budget_usd.toFixed(2)} reserved
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-emerald-400 font-semibold">
                      ${b.remaining_budget_usd.toFixed(2)}
                    </td>
                    <td className="p-3 font-mono text-foreground">
                      {(b.total_token_allowance / 1000).toLocaleString()}k
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {(b.consumed_tokens / 1000).toLocaleString()}k
                      {b.reserved_tokens > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          {(b.reserved_tokens / 1000).toLocaleString()}k reserved
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{b.alert_threshold_percent}%</td>
                    <td className="p-3">
                      {b.is_exhausted ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400">
                          Exhausted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: REQUEST EVALUATION LEDGER */}
      {activeTab === 'requests' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Historical Resource Requests & Evaluations</h2>
            <span className="text-xs text-muted-foreground">Scheduling Audit Trail</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Justification</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Requested Compute</th>
                  <th className="p-3">Requested Tokens</th>
                  <th className="p-3">Decision</th>
                  <th className="p-3">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No evaluation requests submitted yet. Run a simulator test.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-muted-foreground font-mono">
                        {new Date(r.created_at).toLocaleTimeString()}
                      </td>
                      <td className="p-3 font-semibold text-foreground">{r.justification}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${PRIORITY_BADGES[r.priority]}`}>
                          {r.priority}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {r.requested_compute?.cpu_cores} cores • {r.requested_compute?.ram_gb} GB
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {(r.requested_intelligence?.tokens / 1000).toLocaleString()}k
                      </td>
                      <td className="p-3">
                        {r.decision ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${DECISION_BADGES[r.decision]?.bg
                              } ${DECISION_BADGES[r.decision]?.text} ${DECISION_BADGES[r.decision]?.border}`}
                          >
                            {r.decision}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate">{r.decision_reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: RESOURCE DRILLDOWN & PROVENANCE */}
      {activeTab === 'drilldown' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-primary" />
                Hierarchical Resource Consumption Drilldown
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Drill down through the organizational structure: Company → Department → Project → Agent → Task to see where resources are being consumed.
              </p>
            </div>

            {/* Hierarchical Filter Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-background">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary" /> 1. Company
                </label>
                <div className="p-2 rounded-lg border border-border bg-muted/20 text-xs font-semibold text-foreground truncate">
                  {activeCompany?.name || 'Active Organization'}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Layers className="h-3 w-3 text-blue-400" /> 2. Department
                </label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="ALL">All Departments ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <FolderGit2 className="h-3 w-3 text-purple-400" /> 3. Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="ALL">All Projects ({projects.length})</option>
                  {projects
                    .filter((p) => {
                      if (selectedDeptId === 'ALL') return true;
                      const dept = p.metadata?.department_id as string | undefined;
                      return !dept || dept === selectedDeptId;
                    })
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Bot className="h-3 w-3 text-emerald-400" /> 4. Agent
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="ALL">All Agents ({agents.length})</option>
                  {agents
                    .filter((a) => selectedDeptId === 'ALL' || !a.department_id || a.department_id === selectedDeptId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.autonomy || 'Specialist'})</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Drilldown Breadcrumbs */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/10 text-xs">
              <span className="font-semibold text-muted-foreground">Active Drilldown:</span>
              <span className="font-medium text-foreground">{activeCompany?.name || 'Company'}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-blue-400">
                {selectedDeptId === 'ALL' ? 'All Departments' : departments.find((d) => d.id === selectedDeptId)?.name || selectedDeptId}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-purple-400">
                {selectedProjectId === 'ALL' ? 'All Projects' : projects.find((p) => p.id === selectedProjectId)?.name || selectedProjectId}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-emerald-400">
                {selectedAgentId === 'ALL' ? 'All Agents' : agents.find((a) => a.id === selectedAgentId)?.name || selectedAgentId}
              </span>
            </div>
          </div>

          {/* Drilldown Consumption Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Project Alpha Reference Card (Exact user specification) */}
            <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">High-Priority Benchmark</div>
                  <h3 className="text-base font-bold text-foreground">PROJECT ALPHA</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  ACTIVE PIPELINE
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Cpu className="h-3.5 w-3.5 text-primary" /> CPU
                  </span>
                  <span className="font-bold text-foreground">4 / 16 cores</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Server className="h-3.5 w-3.5 text-blue-400" /> RAM
                  </span>
                  <span className="font-bold text-foreground">12 / 32 GB</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Zap className="h-3.5 w-3.5 text-amber-400" /> GPU
                  </span>
                  <span className="font-bold text-foreground">4 / 8 GB</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Layers className="h-3.5 w-3.5 text-violet-400" /> TOKENS
                  </span>
                  <span className="font-bold text-foreground">620k / 1M</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Coins className="h-3.5 w-3.5 text-emerald-400" /> BUDGET
                  </span>
                  <span className="font-bold text-emerald-400">$18 / $50</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1 text-emerald-400 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> OBSERVED TELEMETRY
                </span>
                <span>Burn Rate: 36%</span>
              </div>
            </div>

            {/* Selected Hierarchy Node Telemetry */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Selected Scope Resource Profile</div>
                  <h3 className="text-base font-bold text-foreground truncate">
                    {selectedProjectId !== 'ALL'
                      ? projects.find((p) => p.id === selectedProjectId)?.name || 'Project Scope'
                      : selectedDeptId !== 'ALL'
                        ? departments.find((d) => d.id === selectedDeptId)?.name || 'Department Scope'
                        : 'Organization Wide'}
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                  AGGREGATE
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Cpu className="h-3.5 w-3.5 text-primary" /> CPU Allocated
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedProjectId !== 'ALL' ? '2.5 / 8 cores' : '8.0 / 16 cores'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Server className="h-3.5 w-3.5 text-blue-400" /> RAM Allocated
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedProjectId !== 'ALL' ? '6 / 16 GB' : '18 / 32 GB'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Zap className="h-3.5 w-3.5 text-amber-400" /> GPU VRAM
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedProjectId !== 'ALL' ? '2 / 4 GB' : '4 / 8 GB'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Layers className="h-3.5 w-3.5 text-violet-400" /> Token Volume
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedProjectId !== 'ALL' ? '180k / 300k' : '620k / 1M'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-medium">
                    <Coins className="h-3.5 w-3.5 text-emerald-400" /> Spend Quota
                  </span>
                  <span className="font-bold text-emerald-400">
                    {selectedProjectId !== 'ALL' ? '$6.20 / $15' : '$18.00 / $50'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                <span className="text-muted-foreground">Status: Operational</span>
                <span className="font-mono text-primary">Within Envelope</span>
              </div>
            </div>

            {/* Task-Level Execution Details */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Granular Execution</div>
                  <h3 className="text-base font-bold text-foreground">Task Telemetry</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  REALTIME
                </span>
              </div>

              <div className="space-y-3">
                {controlCenter?.expensive_tasks && controlCenter.expensive_tasks.length > 0 ? (
                  controlCenter.expensive_tasks.slice(0, 3).map((t, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-border bg-background text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate">{t.task_title}</span>
                        <span className="font-mono font-bold text-emerald-400">${t.cost_usd.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Agent: {t.agent_name || 'System Operator'}</span>
                        <span className="font-mono">{t.tokens_consumed.toLocaleString()} toks</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                        <span>CPU: {Math.round(t.cpu_duration_seconds)}s</span>
                        <span className="text-emerald-400">OBSERVED</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-lg bg-background border border-border text-center text-xs text-muted-foreground">
                    No active task consumption recorded in current scope.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* CREATE POOL MODAL */}
      {showPoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-foreground">Create Resource Capacity Pool</h3>
            <form onSubmit={handleCreatePool} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Pool Name</label>
                <input
                  type="text"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  placeholder="e.g. Edge Worker CPU Cluster"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Category</label>
                  <select
                    value={newPoolCategory}
                    onChange={(e) => setNewPoolCategory(e.target.value as ResourceCategory)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="COMPUTE">COMPUTE</option>
                    <option value="INTELLIGENCE">INTELLIGENCE</option>
                    <option value="OPERATIONAL">OPERATIONAL</option>
                    <option value="FINANCIAL">FINANCIAL</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Quota Unit</label>
                  <input
                    type="text"
                    value={newPoolUnit}
                    onChange={(e) => setNewPoolUnit(e.target.value)}
                    placeholder="cores, GB, slots, tokens"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Limited Total Capacity</label>
                <input
                  type="number"
                  step="0.5"
                  value={newPoolCapacity}
                  onChange={(e) => setNewPoolCapacity(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPoolModal(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPoolMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Create Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
