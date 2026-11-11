'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Bot,
  Wrench,
  GitBranch,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Cpu,
  UserCheck,
  CheckCircle,
  XCircle,
  CheckSquare,
} from 'lucide-react';
import {
  WorkflowStep,
  WorkflowExecution,
  WorkflowNodeType,
} from '@/lib/api/workflows';
import { NODE_PALETTE_ITEMS } from './WorkflowPalette';

interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onUpdateStepPosition: (stepId: string, pos: { x: number; y: number }) => void;
  // Observability
  isLiveExecution?: boolean;
  activeExecution?: WorkflowExecution | null;
}

const NODE_ICONS: Record<string, React.ElementType> = {
  TRIGGER: Play,
  WEBHOOK: Globe,
  AGENT: Bot,
  MODEL_SELECTION: Cpu,
  TASK: CheckSquare,
  TOOL: Wrench,
  RESOURCE_REQUEST: Zap,
  CONDITION: GitBranch,
  PARALLEL: Layers,
  DELAY: Clock,
  APPROVAL: Shield,
  HUMAN_REVIEW: UserCheck,
  ESCALATION: AlertTriangle,
  VALIDATION: CheckCircle2,
  SUCCESS: CheckCircle,
  FAILURE: XCircle,
};

export function WorkflowCanvas({
  steps,
  selectedStepId,
  onSelectStep,
  onUpdateStepPosition,
  isLiveExecution = false,
  activeExecution = null,
}: WorkflowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Node Dragging state
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Handle Pan Events
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background
    if ((e.target as HTMLElement).closest('.workflow-node')) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    } else if (draggingStepId) {
      const step = steps.find((s) => s.id === draggingStepId);
      if (step) {
        const newX = Math.round((e.clientX - dragOffset.x) / zoom);
        const newY = Math.round((e.clientY - dragOffset.y) / zoom);
        onUpdateStepPosition(draggingStepId, { x: newX, y: newY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingStepId(null);
  };

  // Node Drag start
  const handleNodeDragStart = (e: React.MouseEvent, step: WorkflowStep) => {
    e.stopPropagation();
    onSelectStep(step.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left + (step.position?.x ?? 0) * zoom - (rect.left - pan.x),
      y: e.clientY - rect.top + (step.position?.y ?? 0) * zoom - (rect.top - pan.y),
    });
    setDraggingStepId(step.id);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.4));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 50, y: 50 });
  };

  // Determine node operational state if inspecting a live execution
  const getNodeExecutionStatus = (stepId: string) => {
    if (!isLiveExecution || !activeExecution) return null;
    if (activeExecution.current_step_id === stepId) {
      if (activeExecution.status === 'WAITING_APPROVAL') return 'WAITING';
      return 'CURRENT';
    }
    const record = activeExecution.step_records?.find((r) => r.step_id === stepId);
    if (record) {
      if (record.status === 'COMPLETED') return 'COMPLETED';
      if (record.status === 'FAILED') return 'FAILED';
      if (record.status === 'WAITING_APPROVAL') return 'WAITING';
      return 'RUNNING';
    }
    return 'PENDING';
  };

  // Calculate layout coordinates if missing
  const positionedSteps = useMemo(() => {
    return steps.map((s, idx) => {
      if (s.position) return s;
      // Auto-layout in a flowing curve if no position is saved
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      return {
        ...s,
        position: {
          x: 100 + col * 260,
          y: 100 + row * 180,
        },
      };
    });
  }, [steps]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative flex-1 h-full w-full overflow-hidden bg-background select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* 1. FLOATING ZOOM & CANVAS CONTROLS */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-xl border border-border bg-card/90 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="text-[11px] font-mono px-1.5 text-muted-foreground min-w-[42px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border-l border-border"
          title="Reset 100%"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* 2. LIVE OBSERVABILITY LEGEND (IF RUNNING) */}
      {isLiveExecution && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 shadow-lg backdrop-blur-md text-xs font-mono">
          <span className="flex items-center gap-1.5 text-amber-400 font-bold">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            CURRENT NODE
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            COMPLETED
          </span>
          <span className="flex items-center gap-1 text-purple-400">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            WAITING GATE
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            FAILED
          </span>
        </div>
      )}

      {/* 3. SVG EDGE CONNECTORS LAYER */}
      <svg
        className="absolute inset-0 pointer-events-none z-0 w-full h-full"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <marker
            id="workflow-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="hsl(var(--primary))" opacity="0.8" />
          </marker>
          <marker
            id="workflow-arrow-cond"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(168, 85, 247, 0.8)" />
          </marker>
        </defs>

        {positionedSteps.map((step) => {
          const fromPos = step.position || { x: 100, y: 100 };
          const fromX = fromPos.x + 200; // Center right edge of node
          const fromY = fromPos.y + 40; // Center height

          // Target 1: next_step_id
          const nextStep = positionedSteps.find((s) => s.id === step.next_step_id);
          const trueStep = positionedSteps.find((s) => s.id === step.condition?.true_step);
          const falseStep = positionedSteps.find((s) => s.id === step.condition?.false_step);

          const renderEdge = (target: WorkflowStep, label?: string, isBranch?: boolean) => {
            const toPos = target.position || { x: 300, y: 100 };
            const toX = toPos.x;
            const toY = toPos.y + 40;

            const deltaX = Math.abs(toX - fromX) * 0.5;
            const pathData = `M ${fromX} ${fromY} C ${fromX + deltaX} ${fromY}, ${toX - deltaX} ${toY}, ${toX} ${toY}`;

            return (
              <g key={`${step.id}-${target.id}-${label || 'main'}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={isBranch ? 'rgba(168, 85, 247, 0.6)' : 'rgba(255, 255, 255, 0.25)'}
                  strokeWidth="2"
                  strokeDasharray={isBranch ? '4 4' : 'none'}
                  markerEnd={isBranch ? 'url(#workflow-arrow-cond)' : 'url(#workflow-arrow)'}
                />
                {label && (
                  <text
                    x={(fromX + toX) / 2}
                    y={(fromY + toY) / 2 - 8}
                    fill={label === 'TRUE' ? '#34d399' : '#f87171'}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          };

          return (
            <React.Fragment key={step.id}>
              {nextStep && renderEdge(nextStep)}
              {trueStep && renderEdge(trueStep, 'TRUE', true)}
              {falseStep && renderEdge(falseStep, 'FALSE', true)}
            </React.Fragment>
          );
        })}
      </svg>

      {/* 4. WORKFLOW NODES LAYER */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {positionedSteps.map((step) => {
          const Icon = NODE_ICONS[step.type] || Bot;
          const isSelected = selectedStepId === step.id;
          const execStatus = getNodeExecutionStatus(step.id);
          const pos = step.position || { x: 100, y: 100 };

          // Status aura classes for live observability
          let statusBorder = 'border-border';
          let statusGlow = '';
          if (execStatus === 'CURRENT') {
            statusBorder = 'border-amber-400 ring-2 ring-amber-400/50';
            statusGlow = 'animate-pulse shadow-lg shadow-amber-400/20';
          } else if (execStatus === 'COMPLETED') {
            statusBorder = 'border-emerald-500/80';
            statusGlow = 'shadow-md shadow-emerald-500/10';
          } else if (execStatus === 'WAITING') {
            statusBorder = 'border-purple-400';
            statusGlow = 'shadow-md shadow-purple-400/20';
          } else if (execStatus === 'FAILED') {
            statusBorder = 'border-rose-500 ring-2 ring-rose-500/50';
            statusGlow = 'shadow-lg shadow-rose-500/20';
          } else if (isSelected) {
            statusBorder = 'border-primary ring-2 ring-primary/40';
          }

          return (
            <div
              key={step.id}
              data-testid={`workflow-node-${step.id}`}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                position: 'absolute',
              }}
              onMouseDown={(e) => handleNodeDragStart(e, step)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectStep(step.id);
              }}
              className={`
                workflow-node pointer-events-auto w-52 p-3.5 rounded-2xl border bg-card/95
                shadow-xl backdrop-blur-md transition-shadow cursor-pointer select-none
                ${statusBorder} ${statusGlow} hover:border-primary/60
              `}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-secondary text-primary shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                      {step.type}
                    </span>
                    <h4 className="text-xs font-bold text-foreground truncate">
                      {step.name}
                    </h4>
                  </div>
                </div>

                {/* Live Exec Status Pill */}
                {execStatus && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                      execStatus === 'CURRENT'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : execStatus === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : execStatus === 'WAITING'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : execStatus === 'FAILED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    {execStatus}
                  </span>
                )}
              </div>

              {/* Node Details Preview */}
              <div className="mt-2.5 pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground space-y-0.5">
                {step.type === 'AGENT' && (
                  <div className="truncate">
                    Agent: <strong className="text-foreground">{String(step.config?.agent_name || 'Assigned')}</strong>
                  </div>
                )}
                {step.type === 'TOOL' && (
                  <div className="truncate">
                    Tool: <strong className="text-amber-400">{String(step.config?.tool_name || 'external_tool')}</strong>
                  </div>
                )}
                {step.type === 'APPROVAL' && (
                  <div className="truncate">
                    Risk: <strong className="text-rose-400">{String(step.config?.risk_level || 'HIGH')}</strong>
                  </div>
                )}
                {step.type === 'CONDITION' && (
                  <div className="truncate">
                    IF: <strong className="text-purple-400">{step.condition?.expression || 'true'}</strong>
                  </div>
                )}
                {step.next_step_id ? (
                  <div className="text-primary truncate">
                    → Next: {steps.find((s) => s.id === step.next_step_id)?.name || 'Step'}
                  </div>
                ) : (
                  <div className="text-muted-foreground/60 italic">Terminal Step</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. MINIMAP OVERVIEW (BOTTOM-RIGHT) */}
      <div className="absolute bottom-4 right-4 z-20 w-44 h-28 rounded-xl border border-border bg-card/85 shadow-2xl backdrop-blur-md p-2 overflow-hidden pointer-events-none">
        <span className="text-[9px] font-mono uppercase text-muted-foreground font-bold block mb-1">
          Mini Map
        </span>
        <div className="relative w-full h-full bg-secondary/30 rounded border border-border/40">
          {positionedSteps.map((s) => {
            const px = ((s.position?.x ?? 0) / 2000) * 100;
            const py = ((s.position?.y ?? 0) / 1400) * 100;
            return (
              <div
                key={s.id}
                style={{ left: `${Math.min(Math.max(px, 5), 85)}%`, top: `${Math.min(Math.max(py, 5), 80)}%` }}
                className={`absolute h-2 w-3 rounded-xs ${selectedStepId === s.id ? 'bg-primary' : 'bg-muted-foreground/50'}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
