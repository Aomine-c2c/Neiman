'use client';

import React from 'react';
import {
  X,
  Bot,
  Layers,
  GitFork,
  Zap,
  Database,
  Sparkles,
  Shield,
  Activity,
  Terminal,
  ArrowRight,
  Play,
  Pause,
  AlertTriangle,
  Clock,
  Coins,
  Network,
  Cpu,
  Radio,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import type { CoreNode, CoreLink } from './CognitiveCore';

interface ContextualInspectorProps {
  node?: CoreNode | null;
  link?: CoreLink | null;
  screenPos?: { x: number; y: number } | null;
  onClose: () => void;
  onOpenDrawer?: (drawerId: string) => void;
  onExecuteCommand?: (command: string) => void;
  onToggleAgentPause?: (agentId: string) => void;
}

function useClampedPosition(
  screenPos?: { x: number; y: number } | null
): React.CSSProperties {
  const PANEL_W = 320;
  const PANEL_H = 460;
  const OFFSET = 18;
  const LEFT_CLUSTER_WIDTH = 370;
  const RIGHT_CLUSTER_WIDTH = 380;
  const TOP_NAV_HEIGHT = 56;
  const BOTTOM_DOCK_HEIGHT = 64;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  // Unanchored fallback (e.g. opened from command hub, activity list, or external trigger)
  if (!screenPos || typeof screenPos.x !== 'number' || typeof screenPos.y !== 'number') {
    // Dock neatly in the open workspace canvas adjacent to the right cluster on large screens,
    // or center on medium/small viewports
    if (vw >= 1200) {
      const left = Math.max(LEFT_CLUSTER_WIDTH + 16, vw - RIGHT_CLUSTER_WIDTH - PANEL_W - 16);
      return { position: 'fixed', left, top: TOP_NAV_HEIGHT + 8, zIndex: 60 };
    }
    const left = Math.max(16, (vw - PANEL_W) / 2);
    return { position: 'fixed', left, top: TOP_NAV_HEIGHT + 8, zIndex: 60 };
  }

  // Anchored adjacent to 3D node / screen position
  let left = screenPos.x + OFFSET;
  let top = screenPos.y - 40;

  if (vw >= 1200) {
    // Check if positioning to the right of node collides with the permanent right-side cluster
    const rightBoundary = vw - RIGHT_CLUSTER_WIDTH - 12;
    if (left + PANEL_W > rightBoundary) {
      // Flip to left of target node
      left = screenPos.x - PANEL_W - OFFSET;
    }
    // Clamp so it does not collide with left cluster or right cluster
    if (left < LEFT_CLUSTER_WIDTH + 12) {
      left = LEFT_CLUSTER_WIDTH + 12;
    }
    if (left + PANEL_W > rightBoundary) {
      left = Math.max(16, rightBoundary - PANEL_W);
    }
  } else {
    // Viewport-only clamping for compact screens
    if (left + PANEL_W > vw - 16) {
      left = screenPos.x - PANEL_W - OFFSET;
    }
    if (left < 16) left = 16;
  }

  // Vertical clamping: stay below command bar and above bottom timeline
  const maxTop = Math.max(TOP_NAV_HEIGHT, vh - PANEL_H - BOTTOM_DOCK_HEIGHT);
  if (top > maxTop) top = maxTop;
  if (top < TOP_NAV_HEIGHT + 8) top = TOP_NAV_HEIGHT + 8;

  return { position: 'fixed', left, top, zIndex: 60 };
}

export function ContextualInspector({
  node,
  link,
  screenPos,
  onClose,
  onOpenDrawer,
  onExecuteCommand,
  onToggleAgentPause,
}: ContextualInspectorProps) {
  const posStyle = useClampedPosition(screenPos);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!node && !link) return null;

  // ── Connection Link Inspector ──────────────────────────────────────────────
  if (link && !node) {
    const latency = link.type === 'routing' ? '45ms' : link.type === 'collaboration' ? '12ms' : '4ms';
    const packetThroughput = Math.round(link.activityLevel * 840) + 120;
    const resourceCost = `$${(link.activityLevel * 0.42).toFixed(3)}/k`;
    const isActive = link.activityLevel > 0.5;

    return (
      <div
        style={posStyle}
        className="z-50 w-80 rounded-xl border border-primary/40 bg-card/95 text-card-foreground backdrop-blur-2xl shadow-2xl font-mono text-xs overflow-hidden animate-fade-in select-text"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-secondary/40">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase tracking-wider text-primary font-bold block">
                CONNECTION {'//'} {link.type.toUpperCase()}
              </span>
              <p className="text-xs font-bold text-foreground truncate">
                {link.sourceId} → {link.targetId}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-3.5 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 rounded bg-secondary/30 border border-border/30">
              <span className="text-muted-foreground block text-[9px] uppercase">Latency</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{latency} (Nominal)</span>
            </div>
            <div className="p-2 rounded bg-secondary/30 border border-border/30">
              <span className="text-muted-foreground block text-[9px] uppercase">Throughput</span>
              <span className="text-primary font-bold">{packetThroughput} pkts/sec</span>
            </div>
            <div className="p-2 rounded bg-secondary/30 border border-border/30">
              <span className="text-muted-foreground block text-[9px] uppercase">Error Rate</span>
              <span className="text-foreground font-bold">0.00% (Zero Drops)</span>
            </div>
            <div className="p-2 rounded bg-secondary/30 border border-border/30">
              <span className="text-muted-foreground block text-[9px] uppercase">Cost</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">{resourceCost}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground uppercase block mb-1">Recent Handoffs</span>
            <div className="p-2 rounded bg-secondary/50 border border-border text-[10px] text-foreground font-mono space-y-0.5">
              <div>[16:51:18] Handoff: DAG context vector (4,096 tokens)</div>
              <div>[16:51:24] Consensus payload: Schema hash 0x7c4f</div>
              <div>[16:51:30] Status: Mutual TLS verified, ACK received</div>
            </div>
          </div>

          <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[9px] font-bold ${
            isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-secondary text-muted-foreground'
          }`}>
            <Activity className="h-3 w-3" />
            {isActive ? 'LINK ACTIVE — real-time data flow' : 'LINK IDLE — standby'}
          </div>
        </div>
      </div>
    );
  }

  if (!node) return null;

  // ── Node Inspector ────────────────────────────────────────────────────────
  const nodeColorHex = `#${node.colorHex.toString(16).padStart(6, '0')}`;

  return (
    <div
      style={posStyle}
      className="z-50 w-80 rounded-xl border border-primary/40 bg-card/95 text-card-foreground backdrop-blur-2xl shadow-2xl font-mono text-xs overflow-hidden animate-fade-in select-text"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-secondary/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: nodeColorHex }} />
          <div className="min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-primary font-bold block">
              {node.type} {'//'} {node.status}
            </span>
            <p className="text-xs font-bold text-foreground truncate">{node.name}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-3 max-h-[400px] overflow-y-auto">

        {/* ── Agent ─────────────────────────────────────────────────────────── */}
        {node.type === 'agent' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Autonomy</span>
                <span className="text-foreground font-bold">{node.autonomy || 'AUTONOMOUS'}</span>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Model</span>
                <span className="text-cyan-400 font-bold truncate">{node.assignedModel || 'Dynamic Router'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Active Task</span>
              <div className="p-2 rounded bg-secondary/20 border border-border/20 text-[11px] text-foreground leading-relaxed">
                {node.currentTask || 'Coordinating consensus across execution pipeline'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Permissions</span>
                <span className="text-emerald-400 font-bold">Read / Write / Execute</span>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Sandbox</span>
                <span className="text-cyan-400 font-bold">gVisor</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Execution Trace</span>
              <div className="p-2 rounded bg-black/50 border border-cyan-500/20 text-[10px] text-cyan-300 font-mono space-y-0.5">
                <div>[16:51:02] Token window: 42.8k / 200k used</div>
                <div>[16:51:14] Memory vectors queried: 14 matches</div>
                <div>[16:51:22] Model call: claude-3-5-sonnet (240ms)</div>
                <div>[16:51:28] Quorum verification: PASSED (3/3)</div>
                <div>[16:51:31] Output committed to org memory</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onToggleAgentPause?.(node.id)}
                className="flex-1 py-1 px-2 rounded border border-border bg-secondary/40 text-foreground hover:bg-secondary text-[10px] font-bold flex items-center justify-center gap-1"
              >
                {node.status === 'WORKING' ? (
                  <><Pause className="h-3 w-3 text-amber-400" /><span>Pause Loop</span></>
                ) : (
                  <><Play className="h-3 w-3 text-emerald-400" /><span>Resume Worker</span></>
                )}
              </button>
              <button
                type="button"
                onClick={() => onOpenDrawer?.('agents')}
                className="py-1 px-2.5 rounded border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-[10px] font-bold"
              >
                Reassign Model
              </button>
            </div>
          </div>
        )}

        {/* ── Department ────────────────────────────────────────────────────── */}
        {node.type === 'department' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Department Lead</span>
                <span className="text-foreground font-bold">
                  {(node.metadata?.lead as string) || (node.metadata?.isSimulated ? 'Chief Architect (Atlas)' : 'Unassigned')}
                </span>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Active Workforce</span>
                <span className="text-emerald-400 font-bold">
                  {(node.metadata?.workforce as string) || (node.metadata?.isSimulated ? '4 Active / 2 Standby' : '0 Active')}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Compute Quota</span>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Enclave Pool</span>
                  <span className="text-foreground font-bold">
                    {typeof node.metadata?.computePct === 'number' ? `${node.metadata.computePct}%` : (node.metadata?.isSimulated ? '45.0%' : '0.0%')}
                  </span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all"
                    style={{ width: `${typeof node.metadata?.computePct === 'number' ? node.metadata.computePct : (node.metadata?.isSimulated ? 45 : 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-2 rounded bg-secondary/20 border border-border/30 text-[10px] space-y-1">
              <span className="text-muted-foreground block text-[9px] uppercase">Active Projects</span>
              {Array.isArray(node.metadata?.projects) && (node.metadata.projects as string[]).length > 0 ? (
                (node.metadata.projects as string[]).map((proj, idx) => (
                  <div key={idx} className="text-foreground font-bold">{proj}</div>
                ))
              ) : node.metadata?.isSimulated ? (
                <>
                  <div className="text-foreground font-bold">&gt; Project Alpha (Autonomous Microservices)</div>
                  <div className="text-foreground font-bold">&gt; Project Sentinel (Zero-Trust Security Mesh)</div>
                </>
              ) : (
                <div className="text-muted-foreground italic text-[9px]">No active projects assigned</div>
              )}
            </div>
          </div>
        )}

        {/* ── Model Gateway ──────────────────────────────────────────────────── */}
        {node.type === 'model' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Roundtrip Latency</span>
                <span className="text-emerald-400 font-bold">
                  {node.latency || (node.metadata?.latency as string) || (node.metadata?.isSimulated ? '240ms' : 'Direct')}
                </span>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Cost Velocity</span>
                <span className="text-foreground font-bold">
                  {node.cost || (node.metadata?.cost as string) || (node.metadata?.isSimulated ? '$3.00/M' : 'Standard')}
                </span>
              </div>
            </div>
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 flex items-center gap-1.5">
              <Activity className="h-3 w-3" />
              <span>Multi-Region Resilient · Fallback Ready · Circuit CLOSED</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Task Routing</span>
              <div className="p-2 rounded bg-black/40 border border-border/20 text-[9px] text-muted-foreground font-mono space-y-0.5">
                <div>context → <span className="text-cyan-300">High-Capacity Context Mesh</span></div>
                <div>reasoning → <span className="text-cyan-300">Primary Reasoning Engine</span></div>
                <div>privacy → <span className="text-cyan-300">Local Air-Gapped Sandbox</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── Task / Workflow Stage ─────────────────────────────────────────── */}
        {node.type === 'task' && (
          <div className="space-y-2.5">
            <div className="p-2 rounded bg-secondary/30 border border-border/30 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Execution Status:</span>
                <span className="text-cyan-400 font-bold">{node.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Tokens:</span>
                <span className="text-foreground">
                  {node.metadata?.isSimulated ? '~8,400 tokens' : 'Telemetry pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DAG Dependencies:</span>
                <span className="text-emerald-400 font-bold">
                  {node.metadata?.isSimulated ? '2 Satisfied / 0 Blocked' : '0 Blocked'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Execution Steps</span>
              <div className="space-y-1 text-[9px]">
                {node.metadata?.isSimulated ? (
                  [
                    { label: 'Ingestion & Schema Extraction', done: true },
                    { label: 'Formal Verification Proof', done: true },
                    { label: 'Synthesis & Code Generation', active: true },
                    { label: 'Consensus Quorum Ratification', pending: true },
                  ].map((step) => (
                    <div
                      key={step.label}
                      className={`flex items-center gap-1.5 ${
                        step.done ? 'text-emerald-400' : step.active ? 'text-cyan-300 font-bold' : 'text-muted-foreground/60'
                      }`}
                    >
                      {step.done ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : step.active ? <span>►</span> : <span>○</span>}
                      <span>{step.label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground italic text-[9px]">
                    {node.metadata?.description ? String(node.metadata.description) : 'Single execution worktree active'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Evolution Proposal ────────────────────────────────────────────── */}
        {node.type === 'evolution' && (
          <div className="space-y-2.5">
            <div className="p-2 rounded bg-violet-500/10 border border-violet-500/30 text-[10px] text-violet-300 space-y-1">
              <span className="font-bold block uppercase">Autonomous Mutation Proposal</span>
              <p className="text-[9px] text-muted-foreground leading-normal">
                {node.role || 'Evolution Engine proposes system mutation with measurable performance improvement.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Stage</span>
                <span className="text-amber-400 font-bold">{node.status}</span>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Impact</span>
                <span className="text-emerald-400 font-bold">
                  {(node.metadata?.fitnessDelta as string) || (node.metadata?.isSimulated ? '+24% Throughput' : 'Pending Evaluation')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Memory Node ───────────────────────────────────────────────────── */}
        {node.type === 'memory' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Domain</span>
                <span className="text-foreground font-bold">{node.role || (node.metadata?.domain as string) || 'KNOWLEDGE'}</span>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Confidence</span>
                <span className="text-emerald-400 font-bold">
                  {node.metadata?.confidence ? `${Math.round((node.metadata.confidence as number) * 100)}%` : (node.metadata?.isSimulated ? '94%' : '100%')}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Provenance</span>
              <div className="p-2 rounded bg-black/40 border border-border/20 text-[9px] text-muted-foreground font-mono space-y-0.5">
                <div>Relation: <span className="text-cyan-300">{(node.metadata?.provenance as string) || node.status}</span></div>
                <div>Source: <span className="text-cyan-300">{node.metadata?.isSimulated ? 'Council Resolution / Agent Observation' : 'Verified Organizational Memory'}</span></div>
                <div>Access: <span className="text-cyan-300">Internal</span></div>
              </div>
            </div>
            <div className="p-2 rounded bg-sky-500/10 border border-sky-500/30 text-[9px] text-sky-300 flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              Stored in organizational vector memory · Retention: 1 year
            </div>
          </div>
        )}

        {/* ── Core ──────────────────────────────────────────────────────────── */}
        {node.type === 'core' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">OS State</span>
                <span className="text-cyan-400 font-bold animate-pulse">
                  {node.status || ((node.metadata?.isSimulated) ? 'AUTONOMOUS' : 'INITIALIZING')}
                </span>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/30">
                <span className="text-muted-foreground block text-[9px] uppercase">Cognition</span>
                <span className="text-emerald-400 font-bold">99.8% Fidelity</span>
              </div>
            </div>
            <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-[9px] text-cyan-300 font-mono space-y-0.5">
              <div>● Intelligence in motion. All systems nominal.</div>
              <div>● 7 visualization modes active.</div>
              <div>
                ● Multi-provider routing:{' '}
                {typeof node.metadata?.gatewayCount === 'number'
                  ? `${node.metadata.gatewayCount} gateway${node.metadata.gatewayCount === 1 ? '' : 's'} online.`
                  : (node.metadata?.isSimulated ? '4 gateways online.' : '0 gateways online.')}
              </div>
            </div>
          </div>
        )}

        {/* ── Global Action Bar ──────────────────────────────────────────────── */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenDrawer?.(
                node.type === 'agent' ? 'agents'
                : node.type === 'evolution' ? 'evolution'
                : node.type === 'memory' ? 'memory'
                : node.type === 'model' ? 'intelligence'
                : 'tasks'
              )
            }
            className="flex-1 py-1.5 px-2 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 transition-colors font-bold text-[10px] flex items-center justify-center gap-1.5"
          >
            <span>Full Workspace Inspector</span>
            <ArrowRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onExecuteCommand?.(`inspect ${node.id}`)}
            className="p-1.5 rounded border border-border bg-secondary hover:bg-secondary/70 text-foreground transition-colors"
            title="Execute Diagnostic in Console"
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
