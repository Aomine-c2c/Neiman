'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  GitBranch,
  Play,
  Plus,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  Sparkles,
  Bot,
  Wrench,
  Scale,
  RefreshCw,
  ChevronRight,
  X,
  FileCode,
  Zap,
  Undo2,
  Redo2,
  CheckCircle2,
  Sliders,
  Maximize2,
  Eye,
  Edit3,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { useOrganizationContext } from '@/lib/organizationContext';
import {
  workflowsApi,
  Workflow,
  WorkflowExecution,
  WorkflowStep,
} from '@/lib/api/workflows';
import { agentsApi, Agent } from '@/lib/api/agents';
import dynamic from 'next/dynamic';

const WorkflowCanvas = dynamic(
  () => import('@/components/workflow/WorkflowCanvas').then((mod) => mod.WorkflowCanvas),
  { loading: () => <div className="flex h-96 items-center justify-center border border-border rounded-xl bg-card/40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> }
);
const WorkflowPalette = dynamic(
  () => import('@/components/workflow/WorkflowPalette').then((mod) => mod.WorkflowPalette),
  { ssr: false }
);
const WorkflowInspector = dynamic(
  () => import('@/components/workflow/WorkflowInspector').then((mod) => mod.WorkflowInspector),
  { ssr: false }
);
import { WorkflowValidationPanel } from '@/components/workflow/WorkflowValidationPanel';
import type { NodePaletteItem } from '@/components/workflow/WorkflowPalette';

// Canonical 5-Stage Autonomous Engineering Pipeline
const CANONICAL_SOFTWARE_PIPELINE: WorkflowStep[] = [
  // Stage 1: Ingestion & Quality Gate
  { id: 's-1', name: 'Trigger: Requirement Ingestion', type: 'TRIGGER', config: { trigger_mode: 'EVENT', event_name: 'requirement_submitted' }, next_step_id: 's-2', position: { x: 60, y: 120 } },
  { id: 's-2', name: 'Requirement Quality & Completeness Gate', type: 'VALIDATION', config: { rubric: 'REQUIREMENT_COMPLETENESS', threshold: 0.85, testability_required: true }, next_step_id: 's-3', position: { x: 340, y: 120 } },
  
  // Stage 2: Spec, Council Deliberation & ADR
  { id: 's-3', name: 'Product Agent: Synthesize Spec', type: 'AGENT', config: { agent_name: 'Product Agent', instruction: 'Evaluate requirement, map domain constraints, and produce formal spec.' }, next_step_id: 's-4', position: { x: 620, y: 120 } },
  { id: 's-4', name: 'Council Deliberation & ADR Ratification', type: 'DECISION', config: { council_name: 'Architecture & Security Council', require_dissent_record: true, produce_adr: true }, next_step_id: 's-5', position: { x: 900, y: 120 } },

  // Stage 3: Project Workspace Binding & Human Governance Gate
  { id: 's-5', name: 'Project Workspace & Target Branch Link', type: 'TOOL', config: { tool_name: 'workspace_branch_binder', target_folder: './', default_branch: 'main' }, next_step_id: 's-6', position: { x: 900, y: 320 } },
  { id: 's-6', name: 'Human Executive Approval Gate', type: 'APPROVAL', config: { title: 'CTO Architectural & Deployment Sign-off', risk_level: 'HIGH', required_role: 'EXECUTIVE' }, next_step_id: 's-7', position: { x: 620, y: 320 } },

  // Stage 4: Parallel Git Worktrees with Boundary Matrix
  { id: 's-7', name: 'Parallel Git Worktrees (API / Web)', type: 'PARALLEL', config: { isolation_mode: 'GIT_WORKTREES', branch_count: 2, domains: ['apps/api', 'apps/web'], conflict_strategy: 'AUTO_REBASE_OR_SYNTHESIZE' }, next_step_id: 's-8', position: { x: 340, y: 320 } },

  // Stage 5: Verification, Testing & Closeout
  { id: 's-8', name: 'QA & Linter Automated Test Runner', type: 'TOOL', config: { tool_name: 'automated_test_runner', arguments: 'pytest && npm test --strict' }, next_step_id: 's-9', position: { x: 60, y: 320 } },
  { id: 's-9', name: 'Production Convergence & Closeout', type: 'SUCCESS', config: { message: 'Candidate changes verified, rebased, and audited in production.' }, position: { x: 60, y: 500 } },
];

export default function WorkflowsDashboardPage() {
  const qc = useQueryClient();
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id;

  // Selected workflow & steps state
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>(CANONICAL_SOFTWARE_PIPELINE);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(CANONICAL_SOFTWARE_PIPELINE[0]?.id || null);

  // History stack for Undo/Redo
  const [history, setHistory] = useState<WorkflowStep[][]>([CANONICAL_SOFTWARE_PIPELINE]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // View Mode: 'editor' | 'cards' | 'observability'
  const [viewMode, setViewMode] = useState<'editor' | 'cards' | 'observability'>('editor');
  const [showValidation, setShowValidation] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);

  // New Workflow Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // 1. Fetch Workflows
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows', companyId],
    queryFn: () => workflowsApi.list(companyId!),
    enabled: !!companyId,
  });

  // 2. Fetch Agents for assignment
  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  // 3. Fetch Executions for selected workflow
  const {
    data: executions = [],
    isLoading: executionsLoading,
    refetch: refetchExecutions,
  } = useQuery({
    queryKey: ['workflow-executions', companyId, selectedWorkflow?.id],
    queryFn: () => workflowsApi.listExecutions(companyId!, selectedWorkflow!.id),
    enabled: !!companyId && !!selectedWorkflow?.id,
    refetchInterval: viewMode === 'observability' ? NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.REALTIME : NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.NORMAL,
  });

  // Select first workflow automatically
  React.useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflow) {
      const first = workflows[0];
      setSelectedWorkflow(first);
      const loadedSteps = first.steps && first.steps.length > 0 ? first.steps : CANONICAL_SOFTWARE_PIPELINE;
      setSteps(loadedSteps);
      setSelectedStepId((prevId) => {
        if (prevId && loadedSteps.some((s) => s.id === prevId)) return prevId;
        return loadedSteps[0]?.id || null;
      });
    }
  }, [workflows, selectedWorkflow]);

  // Synchronize history for undo/redo
  const pushState = (newSteps: WorkflowStep[]) => {
    setSteps(newSteps);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), newSteps]);
    setHistoryIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSteps(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSteps(history[historyIndex + 1]);
    }
  };

  // Node Mutations
  const handleAddNode = (item: NodePaletteItem) => {
    const id = `node-${Date.now()}`;
    const newStep: WorkflowStep = {
      id,
      name: item.label,
      type: item.type,
      config: { ...item.defaultConfig },
      position: { x: 300 + Math.random() * 80, y: 200 + Math.random() * 80 },
    };
    setSteps((prev) => {
      const next = [...prev, newStep];
      setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
      setHistoryIndex((idx) => idx + 1);
      return next;
    });
    setSelectedStepId(id);
  };

  const handleUpdateStep = (updated: WorkflowStep) => {
    pushState(steps.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleUpdateStepPosition = (stepId: string, pos: { x: number; y: number }) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, position: pos } : s))
    );
  };

  const handleDeleteStep = (stepId: string) => {
    pushState(steps.filter((s) => s.id !== stepId));
    if (selectedStepId === stepId) setSelectedStepId(null);
  };

  // 4. Save Workflow Mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (selectedWorkflow) {
        return workflowsApi.update(companyId!, selectedWorkflow.id, {
          steps,
        });
      }
      return workflowsApi.create(companyId!, {
        name: 'Software Delivery Pipeline',
        description: 'Autonomous development lifecycle: requirement -> architect -> CTO approval -> deploy',
        trigger_type: 'EVENT',
        steps,
      });
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['workflows', companyId] });
      setSelectedWorkflow(saved);
    },
  });

  // 5. Trigger Execution Mutation
  const triggerMutation = useMutation({
    mutationFn: (wfId: string) =>
      workflowsApi.triggerExecution(companyId!, wfId, {
        title: `Run ${new Date().toLocaleTimeString()}`,
        input_payload: { requirement: 'Implement User Audit Stream', priority: 'HIGH' },
      }),
    onSuccess: (exec) => {
      qc.invalidateQueries({ queryKey: ['workflow-executions', companyId, selectedWorkflow?.id] });
      setSelectedExecution(exec);
      setViewMode('observability');
    },
  });

  // 6. Resume Execution (after approval)
  const resumeMutation = useMutation({
    mutationFn: (execId: string) => workflowsApi.resumeExecution(companyId!, execId),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['workflow-executions', companyId, selectedWorkflow?.id] });
      setSelectedExecution(updated);
    },
  });

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <GitBranch className="h-12 w-12 text-muted-foreground mb-3 opacity-60" />
        <h2 className="text-lg font-bold text-foreground">No Organization Selected</h2>
        <p className="text-sm text-muted-foreground">Select an active company to build and execute workflows.</p>
      </div>
    );
  }

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null;
  const activeExec = selectedExecution || (executions.length > 0 ? executions[0] : null);

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col bg-background animate-fade-in -mx-4 -mb-4 -mt-2 overflow-hidden select-none">
      {/* 1. TOP CONTROL BAR */}
      <div className="h-14 border-b border-border bg-card/80 px-4 flex items-center justify-between gap-4 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <GitBranch className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              {workflows.length > 0 ? (
                <select
                  value={selectedWorkflow?.id || ''}
                  onChange={(e) => {
                    const found = workflows.find((w) => w.id === e.target.value);
                    if (found) {
                      setSelectedWorkflow(found);
                      const loadedSteps = found.steps && found.steps.length > 0 ? (found.steps as WorkflowStep[]) : CANONICAL_SOFTWARE_PIPELINE;
                      setSteps(loadedSteps);
                      setSelectedStepId(loadedSteps[0]?.id || null);
                    }
                  }}
                  className="font-bold text-sm text-foreground bg-secondary/80 border border-border rounded-lg px-2 py-1 max-w-[280px] truncate focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-sm text-foreground">
                  {selectedWorkflow?.name || 'Software Delivery Pipeline'}
                </span>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border">
                {steps.length} Nodes
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block max-w-xl truncate">
              {selectedWorkflow?.description || 'Visual workflow composer & live autonomous execution observer'}
            </p>
          </div>
        </div>

        {/* Center: Mode Switcher & Undo/Redo */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-secondary/40 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Step Pipeline Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                viewMode === 'editor'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Canvas Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('observability')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                viewMode === 'observability'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Live Observability</span>
            </button>
          </div>

          {/* Undo / Redo */}
          {viewMode === 'editor' && (
            <div className="hidden md:flex items-center gap-1 border-l border-border pl-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right Actions: Validation, Save & Run */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowValidation(!showValidation)}
            className={`btn btn-outline text-xs h-8 px-2.5 gap-1.5 ${showValidation ? 'border-primary text-primary' : ''}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Validation</span>
          </button>

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn btn-outline text-xs h-8 px-2.5 gap-1.5 text-foreground"
          >
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Save Workflow</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedWorkflow) triggerMutation.mutate(selectedWorkflow.id);
            }}
            disabled={triggerMutation.isPending || !selectedWorkflow}
            className="btn btn-primary text-xs h-8 px-3 gap-1.5"
          >
            {triggerMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>Run Workflow</span>
          </button>
        </div>
      </div>

      {/* 2. OBSERVABILITY TELEMETRY BANNER (IF LIVE RUN ACTIVE) */}
      {viewMode === 'observability' && activeExec && (
        <div className="h-10 bg-secondary/50 border-b border-border px-6 flex items-center justify-between text-xs font-mono shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Run: <strong className="text-foreground">{activeExec.title}</strong></span>
            <span>•</span>
            <span>Status: <strong className="text-amber-400">{activeExec.status}</strong></span>
            <span>•</span>
            <span>Step: <strong className="text-primary">{activeExec.current_step_name || 'In Progress'}</strong> ({activeExec.current_step_index}/{activeExec.total_steps})</span>
          </div>

          <div className="flex items-center gap-4">
            <span>
              Tokens:{' '}
              <strong className="text-foreground">
                {activeExec.tokens_consumed != null ? activeExec.tokens_consumed.toLocaleString() : 'Unavailable'}
              </strong>
            </span>
            <span>•</span>
            <span>
              Spend:{' '}
              <strong className="text-emerald-400">
                {activeExec.cost_usd != null ? `$${activeExec.cost_usd.toFixed(4)}` : 'Unavailable'}
              </strong>
            </span>
            {activeExec.status === 'WAITING_APPROVAL' && (
              <button
                type="button"
                onClick={() => resumeMutation.mutate(activeExec.id)}
                disabled={resumeMutation.isPending}
                className="btn btn-primary h-6 px-2 text-[10px] gap-1"
              >
                <Shield className="h-3 w-3" />
                Resume Gate
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN WORKFLOW STUDIO CANVAS & PANELS */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: 16-Node Palette */}
        {viewMode === 'editor' && (
          <WorkflowPalette onAddNode={handleAddNode} />
        )}

        {/* Center: Step Pipeline Cards OR Interactive Pan/Zoom Canvas */}
        <div className="flex-1 relative h-full flex flex-col overflow-y-auto">
          {viewMode === 'cards' ? (
            <div className="p-6 w-full space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Stage-by-Stage Delivery Pipeline
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Click any pipeline stage below to inspect or modify its assigned agent, validation rubric, or tool configuration.
                  </p>
                </div>
                <span className="text-xs font-mono text-primary font-semibold">
                  {steps.length} Connected Stages
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {steps.map((st, idx) => {
                  const isSelected = selectedStepId === st.id;
                  const agentName = (st.config?.agent_name as string) || (st.config?.tool_name as string) || st.type;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStepId(st.id)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all space-y-2.5 ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-secondary text-primary font-bold">
                          STAGE {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-muted-foreground uppercase">{st.type}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{st.name}</h3>
                      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
                        <span className="truncate font-mono text-[11px]">{agentName}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <WorkflowCanvas
              steps={steps}
              selectedStepId={selectedStepId}
              onSelectStep={(id) => setSelectedStepId(id)}
              onUpdateStepPosition={handleUpdateStepPosition}
              isLiveExecution={viewMode === 'observability'}
              activeExecution={activeExec}
            />
          )}

          {/* Floating Validation Panel */}
          {showValidation && (
            <div className="absolute bottom-4 left-4 z-30 w-96">
              <WorkflowValidationPanel
                steps={steps}
                onSelectStep={(id) => {
                  setSelectedStepId(id);
                  setShowValidation(false);
                }}
                onClose={() => setShowValidation(false)}
              />
            </div>
          )}
        </div>

        {/* Right: Properties Inspector */}
        <WorkflowInspector
          step={selectedStep}
          allSteps={steps}
          agents={agents}
          onUpdateStep={handleUpdateStep}
          onDeleteStep={handleDeleteStep}
          onClose={() => setSelectedStepId(null)}
        />
      </div>
    </div>
  );
}
