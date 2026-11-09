'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  GitFork,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Terminal,
  Activity,
  Layers,
  FileCode,
  ShieldAlert,
  Play,
  Pause,
  X,
} from 'lucide-react';
import type { Task } from '@/lib/api/controlRoom';

export interface WorkflowStep {
  id: string;
  name: string;
  stage: 'Ingestion' | 'Reasoning' | 'Verification' | 'Synthesis' | 'Commit';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'RETRYING' | 'BLOCKED' | 'FAILED' | 'PENDING';
  assignedAgent: string;
  durationMs: number;
  retries: number;
  maxRetries: number;
  dependencies: string[];
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  logs: string[];
}

interface WorkflowExecutionPanelProps {
  tasks?: Task[];
  isSimulated?: boolean;
  onOpenDrawer?: (drawerId: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  onClose?: () => void;
  onSelectTask?: (taskId: string) => void;
}

const DEFAULT_STEPS: WorkflowStep[] = [
  {
    id: 'step-01',
    name: 'Source Ingestion & Sanitization',
    stage: 'Ingestion',
    status: 'COMPLETED',
    assignedAgent: 'Eli Okafor',
    durationMs: 420,
    retries: 0,
    maxRetries: 3,
    dependencies: [],
    inputPayload: { source: 'vector_store://memories/org_dna', token_size: 4096 },
    outputPayload: { clean_tokens: 3840, status: 'SANITIZED' },
    logs: [
      '[12:40:01] Ingestion pipeline started on worker enclave',
      '[12:40:02] Token boundaries validated against gVisor sandbox',
      '[12:40:02] Ingestion completed in 420ms',
    ],
  },
  {
    id: 'step-02',
    name: 'Multi-Perspective Deliberation',
    stage: 'Reasoning',
    status: 'COMPLETED',
    assignedAgent: 'Mara Chen',
    durationMs: 1180,
    retries: 0,
    maxRetries: 3,
    dependencies: ['step-01'],
    inputPayload: { model: 'claude-3-5-sonnet', prompt_version: 'v4.2' },
    outputPayload: { consensus_reached: true, confidence: 0.96 },
    logs: [
      '[12:40:03] Reasoning payload dispatched to Anthropic Gateway',
      '[12:40:04] TTFT: 195ms, streaming completed',
      '[12:40:04] Synthesis verified without hallucinations',
    ],
  },
  {
    id: 'step-03',
    name: 'Constitutional Constraint Validation',
    stage: 'Verification',
    status: 'IN_PROGRESS',
    assignedAgent: 'Sora Patel',
    durationMs: 840,
    retries: 1,
    maxRetries: 2,
    dependencies: ['step-02'],
    inputPayload: { policy_set: 'security_boundary_v3', check_level: 'STRICT' },
    logs: [
      '[12:40:05] Evaluating against constitutional policy rule #14',
      '[12:40:05] Warning: Outbound egress requires human authorization gate',
      '[12:40:06] Retry #1 initiated with bounded permission scope',
    ],
  },
  {
    id: 'step-04',
    name: 'Cross-Agent Speculative Synthesis',
    stage: 'Synthesis',
    status: 'PENDING',
    assignedAgent: 'Noah Williams',
    durationMs: 0,
    retries: 0,
    maxRetries: 3,
    dependencies: ['step-03'],
    inputPayload: { speculative_tokens: 2048 },
    logs: ['[Waiting] Pending successful completion of step-03 verification'],
  },
  {
    id: 'step-05',
    name: 'State Commit & Memory Vectorization',
    stage: 'Commit',
    status: 'PENDING',
    assignedAgent: 'Eli Okafor',
    durationMs: 0,
    retries: 0,
    maxRetries: 3,
    dependencies: ['step-04'],
    inputPayload: { destination: 'lance_vector_store' },
    logs: ['[Waiting] Pending execution pipeline completion'],
  },
];

export function WorkflowExecutionPanel({
  tasks = [],
  isSimulated = false,
  onOpenDrawer,
  isMinimized = false,
  onToggleMinimize,
  onClose,
  onSelectTask,
}: WorkflowExecutionPanelProps) {
  const initialSteps: WorkflowStep[] = useMemo(() => {
    if (tasks.length > 0) {
      const stageNames: WorkflowStep['stage'][] = ['Ingestion', 'Reasoning', 'Verification', 'Synthesis', 'Commit'];
      return tasks.map((t, idx) => {
        const dur = Math.max(0, new Date(t.updated_at).getTime() - new Date(t.created_at).getTime());
        return {
          id: t.id,
          name: t.title,
          stage: stageNames[idx % stageNames.length],
          status: (t.status === 'COMPLETED'
            ? 'COMPLETED'
            : t.status === 'IN_PROGRESS'
            ? 'IN_PROGRESS'
            : t.status === 'BLOCKED'
            ? 'BLOCKED'
            : t.status === 'CANCELLED'
            ? 'FAILED'
            : 'PENDING') as WorkflowStep['status'],
          assignedAgent: t.assigned_agent_id ? `Agent ${t.assigned_agent_id.slice(0, 8)}` : 'Unassigned',
          durationMs: Number.isFinite(dur) ? dur : 0,
          retries: 0,
          maxRetries: 3,
          dependencies: idx > 0 ? [tasks[idx - 1].id] : [],
          inputPayload: { task_id: t.id, project_id: t.project_id },
          outputPayload: t.status === 'COMPLETED' ? { status: 'COMPLETED' } : undefined,
          logs: t.description ? [t.description] : [`Task ${t.title} registered in execution graph`],
        };
      });
    }
    return isSimulated ? DEFAULT_STEPS : [];
  }, [tasks, isSimulated]);

  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const [selectedStepId, setSelectedStepId] = useState<string>(initialSteps[0]?.id || '');
  useEffect(() => {
    if (!steps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(steps[0]?.id || '');
    }
  }, [steps, selectedStepId]);

  const [inspectPayload, setInspectPayload] = useState<boolean>(false);

  const selectedStep = steps.find((s) => s.id === selectedStepId) || steps[0];

  const handleRetryStep = (stepId: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              status: 'IN_PROGRESS',
              retries: s.retries + 1,
              logs: [...s.logs, `[${new Date().toLocaleTimeString()}] Manual retry triggered by operator`],
            }
          : s
      )
    );
  };

  const getStatusBadge = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'COMPLETED':
        return {
          label: 'DONE',
          dot: 'bg-emerald-400',
          text: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        };
      case 'IN_PROGRESS':
        return {
          label: 'RUNNING',
          dot: 'bg-amber-400 animate-pulse',
          text: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        };
      case 'RETRYING':
        return {
          label: 'RETRY',
          dot: 'bg-rose-400 animate-pulse',
          text: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
        };
      case 'BLOCKED':
        return {
          label: 'BLOCKED',
          dot: 'bg-rose-500',
          text: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
        };
      case 'FAILED':
        return {
          label: 'FAILED',
          dot: 'bg-rose-500',
          text: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
        };
      default:
        return {
          label: 'QUEUE',
          dot: 'bg-zinc-500',
          text: 'text-zinc-400 border-zinc-700 bg-zinc-800/40',
        };
    }
  };

  const completedCount = steps.filter((s) => s.status === 'COMPLETED').length;

  if (isMinimized) {
    return (
      <div
        className="rounded-xl border border-cyan-500/30 bg-[#060b18] backdrop-blur-xl p-2.5 font-mono text-xs flex items-center justify-between shadow-2xl w-72"
        style={{ backgroundColor: '#060b18' }}
      >
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4 text-cyan-400" />
          <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">Workflow Pipeline</span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
            {steps.length > 0 ? `STAGE ${completedCount}/${steps.length}` : 'STANDBY'}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMinimize}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground text-[10px]"
        >
          Expand
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-cyan-500/30 bg-[#060b18] backdrop-blur-2xl p-3 font-mono text-xs shadow-2xl flex flex-col gap-2.5 w-84 select-text max-h-[460px]"
      style={{ backgroundColor: '#060b18' }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4 text-cyan-400" />
          <span className="font-bold text-foreground text-xs uppercase tracking-wider">
            Execution Graph // DAG
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </div>

        <div className="flex items-center gap-1">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Minimize panel"
            >
              -
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Close panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* DAG Stages Timeline Stream */}
      {steps.length === 0 ? (
        <div className="py-6 px-3 text-center border border-dashed border-cyan-500/20 rounded-lg">
          <GitFork className="h-5 w-5 mx-auto mb-1.5 text-cyan-400/50" />
          <p className="font-semibold text-foreground text-xs">No Active Workflow Tasks</p>
          <p className="text-[10px] mt-1 text-muted-foreground">Execution graph will render dynamically once workflow tasks are dispatched.</p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto max-h-[160px] pr-1">
          {steps.map((stg, idx) => {
            const badge = getStatusBadge(stg.status);
            const isSelected = selectedStepId === stg.id;

            return (
              <div
                key={stg.id}
                onClick={() => setSelectedStepId(stg.id)}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_12px_rgba(0,242,254,0.15)]'
                    : 'border-border/40 bg-secondary/20 hover:bg-secondary/40 hover:border-border/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[9px] text-muted-foreground font-bold w-4 shrink-0">
                    0{idx + 1}
                  </span>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${badge.dot}`} />
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-[11px] truncate">{stg.name}</div>
                    <div className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                      <span>{stg.assignedAgent}</span>
                      <span>•</span>
                      <span>{stg.durationMs > 0 ? `${stg.durationMs}ms` : 'Queued'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Step Technical Drill-down */}
      {selectedStep && (
        <div className="border border-cyan-500/20 rounded-lg p-2.5 bg-black/40 space-y-2 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-300 uppercase tracking-wider text-[9px]">
              Step Inspector // {selectedStep.id}
            </span>
            <div className="flex items-center gap-1">
              {selectedStep.status === 'IN_PROGRESS' || selectedStep.status === 'BLOCKED' ? (
                <button
                  type="button"
                  onClick={() => handleRetryStep(selectedStep.id)}
                  className="px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold transition-all flex items-center gap-1 text-[9px]"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Retry</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setInspectPayload((p) => !p)}
                className="px-1.5 py-0.5 rounded border border-border/40 hover:bg-secondary text-muted-foreground hover:text-foreground text-[9px]"
              >
                {inspectPayload ? 'Logs' : 'Payload'}
              </button>
            </div>
          </div>

          {inspectPayload ? (
            <div className="space-y-1">
              <span className="text-muted-foreground block text-[9px]">Input / Output JSON Metadata:</span>
              <pre className="p-2 rounded bg-black/60 border border-border/30 text-[9px] text-emerald-400 font-mono overflow-x-auto max-h-24">
                {JSON.stringify({ input: selectedStep.inputPayload, output: selectedStep.outputPayload }, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-muted-foreground block text-[9px]">Live Execution Logs:</span>
              <div className="p-2 rounded bg-black/60 border border-border/30 text-[9px] text-cyan-300/90 font-mono space-y-0.5 max-h-24 overflow-y-auto">
                {selectedStep.logs.map((log, lIdx) => (
                  <div key={lIdx} className="truncate">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[9px] pt-1 border-t border-border/30">
            <div>
              <span className="text-muted-foreground">Retries:</span>{' '}
              <span className="text-foreground font-bold">{selectedStep.retries}/{selectedStep.maxRetries}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Dependencies:</span>{' '}
              <span className="text-foreground font-bold">
                {selectedStep.dependencies.length ? selectedStep.dependencies.join(', ') : 'None (Root)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1 border-t border-border/20">
        <span>Deterministic DAG execution</span>
        {onOpenDrawer && (
          <button
            type="button"
            onClick={() => onOpenDrawer('workflows')}
            className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
          >
            <span>Full Orchestrator</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}
