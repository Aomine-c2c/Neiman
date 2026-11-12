'use client';

import {
  Sparkles,
  RotateCw,
  Sliders,
  Play,
  CheckCircle2,
  Layers,
  Check,
  DollarSign,
  Building2,
  Bot,
  Zap,
  Lock,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import {
  BuildMyCompanyProposal,
  BlueprintDepartment,
  BlueprintAgent,
  BlueprintWorkflow,
  BlueprintPolicy,
} from '@/lib/api/blueprints';

interface BuildMyCompanyTabProps {
  promptText: string;
  setPromptText: (text: string) => void;
  targetBudget: number;
  setTargetBudget: (budget: number) => void;
  preferredAutonomy: number;
  setPreferredAutonomy: (autonomy: number) => void;
  isSynthesizing: boolean;
  onSynthesize: () => void;
  proposal: BuildMyCompanyProposal | null;
  isEditingProposal: boolean;
  setIsEditingProposal: (val: boolean) => void;
  propEditName: string;
  setPropEditName: (name: string) => void;
  propEditMission: string;
  setPropEditMission: (mission: string) => void;
  propEditBudget: number;
  setPropEditBudget: (budget: number) => void;
  propEditAutonomy: number;
  setPropEditAutonomy: (autonomy: number) => void;
  isUpdatingProposal: boolean;
  onSaveProposalModifications: () => void;
  isSimulatingProposal: boolean;
  onSimulateProposal: () => void;
  onOpenApproval: () => void;
}

export function BuildMyCompanyTab({
  promptText,
  setPromptText,
  targetBudget,
  setTargetBudget,
  preferredAutonomy,
  setPreferredAutonomy,
  isSynthesizing,
  onSynthesize,
  proposal,
  isEditingProposal,
  setIsEditingProposal,
  propEditName,
  setPropEditName,
  propEditMission,
  setPropEditMission,
  propEditBudget,
  setPropEditBudget,
  propEditAutonomy,
  setPropEditAutonomy,
  isUpdatingProposal,
  onSaveProposalModifications,
  isSimulatingProposal,
  onSimulateProposal,
  onOpenApproval,
}: BuildMyCompanyTabProps) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-NEIMAN-surface to-background p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/20 text-primary border border-primary/30">
            <Sparkles className="h-6 w-6 text-amber-300 animate-pulse" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">BUILD MY COMPANY</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Describe any business or organization in plain English. NEIMAN will synthesize complete departments,
              roles, specialized agents, workflows, operational policies, risk mitigations, and budget estimates for
              your review before activation.
            </p>
          </div>
        </div>

        {/* Prompt Form */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Describe your organization & goals
            </label>
            <textarea
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. Build an autonomous venture capital syndication firm that monitors DeFi protocols, parses smart contract audits on GitHub, drafts investment memos, and alerts partners when APY exceeds 15% with TVL > $50M..."
              className="w-full bg-secondary/50 border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-foreground">Target Monthly Budget</span>
                <span className="font-mono text-emerald-400 font-semibold">${targetBudget}/mo</span>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="50"
                value={targetBudget}
                onChange={(e) => setTargetBudget(Number(e.target.value))}
                className="w-full accent-primary h-1.5 bg-secondary rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-foreground">Initial Autonomy Level</span>
                <span className="font-mono text-primary font-semibold">Level {preferredAutonomy}</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={preferredAutonomy}
                onChange={(e) => setPreferredAutonomy(Number(e.target.value))}
                className="w-full accent-primary h-1.5 bg-secondary rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1 font-mono">
                <span>L0: Observe</span>
                <span>L3: Policy</span>
                <span>L5: Adaptive</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={!promptText.trim() || isSynthesizing}
              onClick={onSynthesize}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-all shadow-md"
            >
              {isSynthesizing ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Synthesizing Organization...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Synthesize Blueprint Proposal
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Proposal Review Section */}
      {proposal && (
        <div className="bg-NEIMAN-surface border border-primary/40 rounded-2xl p-6 space-y-6 shadow-lg animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${proposal.status === 'INSTANTIATED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : proposal.status === 'SIMULATED'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                  {proposal.status === 'INSTANTIATED' ? 'INSTANTIATED LIVE' : proposal.status === 'SIMULATED' ? 'SIMULATION VALIDATED' : 'PROPOSED (PENDING REVIEW)'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">ID: {proposal.id.slice(0, 8)}...</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {proposal.proposed_blueprint?.name || 'Proposed Autonomous Organization'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {proposal.proposed_blueprint?.tagline || proposal.prompt}
              </p>
              <p className="text-xs italic text-primary/80 mt-1">
                &ldquo;{proposal.proposed_blueprint?.company_definition?.mission}&rdquo;
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingProposal(!isEditingProposal)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border hover:bg-secondary/40 text-foreground transition-all"
              >
                <Sliders className="h-3.5 w-3.5 text-primary" />
                {isEditingProposal ? 'Cancel Customization' : 'Modify Configuration'}
              </button>

              <button
                disabled={isSimulatingProposal}
                onClick={onSimulateProposal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all"
              >
                {isSimulatingProposal ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run Simulation
              </button>

              {proposal.status !== 'INSTANTIATED' && (
                <button
                  onClick={onOpenApproval}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & Instantiate
                </button>
              )}
            </div>
          </div>

          {/* In-Place Editing Panel */}
          {isEditingProposal && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-primary/20">
                <span className="font-bold text-primary font-mono uppercase tracking-wider">
                  Modify Proposed Organization
                </span>
                <span className="text-[10px] text-muted-foreground">Adjust parameters before approval</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Company Name</label>
                  <input
                    type="text"
                    className="input text-xs"
                    value={propEditName}
                    onChange={(e) => setPropEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Target Monthly Budget ($)</label>
                  <input
                    type="number"
                    className="input text-xs"
                    value={propEditBudget}
                    onChange={(e) => setPropEditBudget(Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="font-semibold block mb-1">Company Mission Statement</label>
                  <input
                    type="text"
                    className="input text-xs"
                    value={propEditMission}
                    onChange={(e) => setPropEditMission(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-primary/20">
                <button
                  onClick={() => setIsEditingProposal(false)}
                  className="btn btn-outline text-xs h-8"
                >
                  Cancel
                </button>
                <button
                  disabled={isUpdatingProposal}
                  onClick={onSaveProposalModifications}
                  className="btn btn-primary text-xs h-8 gap-1.5"
                >
                  {isUpdatingProposal && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
                  Save Modifications
                </button>
              </div>
            </div>
          )}

          {/* 12-Step Synthesis Pipeline Progression Breadcrumbs */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              12-Step Synthesis Pipeline Artifacts
            </h4>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
              {[
                'User Description',
                'Requirement Analysis',
                'Industry Identification',
                'Organizational Design',
                'Department Generation',
                'Role Generation',
                'Agent Generation',
                'Workflow Generation',
                'Policy Generation',
                'Resource Model',
                'Intelligence Requirements',
                'Risk Analysis',
              ].map((step, idx) => (
                <span
                  key={step}
                  className="px-2 py-0.5 rounded-md bg-secondary/40 text-foreground border border-border/60 flex items-center gap-1"
                >
                  <span className="text-primary font-bold">{idx + 1}.</span> {step}
                  <Check className="h-3 w-3 text-emerald-400" />
                </span>
              ))}
            </div>
          </div>

          {/* Simulation Lab Results Banner */}
          {proposal.simulation_results && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
                <span className="font-bold text-xs text-indigo-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-indigo-400" />
                  Controlled Workload Simulation Results ({proposal.simulation_results.test_workload_size} Synthetic Tasks)
                </span>
                <span className="badge badge-warning text-[10px]">EXPERIMENTAL RESULTS ONLY</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <span className="text-[10px] text-muted-foreground block">TASKS PASSED</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {proposal.simulation_results.simulated_tasks_succeeded} / {proposal.simulation_results.test_workload_size}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <span className="text-[10px] text-muted-foreground block">AVG LATENCY</span>
                  <span className="font-bold text-cyan-400 text-sm">
                    {proposal.simulation_results.avg_latency_ms}ms
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <span className="text-[10px] text-muted-foreground block">TRIAL COST</span>
                  <span className="font-bold text-emerald-300 text-sm">
                    ${proposal.simulation_results.estimated_run_cost_usd}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <span className="text-[10px] text-muted-foreground block">QUALITY BENCHMARK</span>
                  <span className="font-bold text-primary text-sm">
                    {proposal.simulation_results.quality_benchmark_pct}%
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-amber-200/80 italic">
                {proposal.simulation_results.dry_run_disclaimer}
              </p>
            </div>
          )}

          {/* 1. Operating Cost Breakdown & Complexity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                Resource & Operating Budget Breakdown
              </h4>
              <span className="text-[11px] font-mono text-muted-foreground">
                Estimated Operational Complexity: <span className="font-bold text-amber-400">{proposal.estimated_operational_complexity}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Token Budget</span>
                <div className="text-sm font-bold text-foreground">
                  ${proposal.estimated_operating_cost?.token_cost_usd ?? 100}/mo
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Compute & Storage</span>
                <div className="text-sm font-bold text-foreground">
                  ${proposal.estimated_operating_cost?.compute_cost_usd ?? 50}/mo
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Operational Slots</span>
                <div className="text-sm font-bold text-foreground">
                  6 Concurrency Slots
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">Total Monthly Budget</span>
                <div className="text-sm font-bold text-emerald-300">
                  ${proposal.estimated_operating_cost?.total_monthly_usd || 250}/mo
                </div>
              </div>
            </div>
          </div>

          {/* 2. Proposed Departments & Agents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-indigo-400" />
                Generated Departments ({proposal.proposed_blueprint?.departments?.length || 0})
              </h4>
              <div className="space-y-2">
                {proposal.proposed_blueprint?.departments?.map((dept: BlueprintDepartment, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-secondary/20 border border-border">
                    <div className="text-xs font-semibold text-foreground">{dept.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{dept.purpose}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3 flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-primary" />
                Generated Agents ({proposal.proposed_blueprint?.agents?.length || 0})
              </h4>
              <div className="space-y-2">
                {proposal.proposed_blueprint?.agents?.map((agent: BlueprintAgent, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-secondary/20 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{agent.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        L{agent.autonomy_level} Autonomy
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">{agent.role_title}</div>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                      {agent.system_instructions}
                    </p>
                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-border/40 text-[9px] font-mono text-muted-foreground">
                      <span>Model: {String(agent.intelligence_config?.model || 'claude-3-5-sonnet')}</span>
                      <span>Tools: {agent.tools?.length || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Workflows & Policies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-400" />
                Generated Workflows ({proposal.proposed_blueprint?.workflows?.length || 0})
              </h4>
              <div className="space-y-2">
                {proposal.proposed_blueprint?.workflows?.map((wf: BlueprintWorkflow, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-secondary/20 border border-border">
                    <div className="text-xs font-semibold text-foreground">{wf.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{wf.description}</div>
                    <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">
                      Stages: {wf.steps?.length || 0} ({wf.trigger_type})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-rose-400" />
                Policies & Constitution
              </h4>
              <div className="space-y-2">
                {proposal.proposed_blueprint?.policies?.map((pol: BlueprintPolicy, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-secondary/20 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{pol.name}</span>
                      <span className="text-[10px] font-mono text-rose-400">{pol.enforcement_level}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{pol.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Identified Operational Risks & Human Approval Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Potential Risks & Mitigations
              </h4>
              <div className="space-y-2">
                {proposal.risks_identified?.map((risk: BuildMyCompanyProposal['risks_identified'][number], i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span>{risk.category}</span>
                      <span className="text-[10px] uppercase font-mono">{risk.severity}</span>
                    </div>
                    <p className="text-[11px] text-foreground mt-1">{risk.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      <span className="font-semibold text-amber-400">Mitigation:</span> {risk.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-emerald-400" />
                Human Approval Requirements (Governance Gates)
              </h4>
              <div className="space-y-2">
                {proposal.human_approval_requirements?.map((req: BuildMyCompanyProposal['human_approval_requirements'][number], i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                      <span>{req.gate}</span>
                      <span className="text-[10px] uppercase font-mono text-emerald-400">{req.required_authority}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{req.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Approve Action */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Governance Rule: Never silently creates an organization without human review and confirmation.
            </span>
            {proposal.status !== 'INSTANTIATED' && (
              <button
                onClick={onOpenApproval}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" />
                Review, Approve & Instantiate Company
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
