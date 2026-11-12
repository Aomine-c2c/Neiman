'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Bot,
  GitFork,
  Activity,
  ShieldAlert,
  Sparkles,
  Layers,
  ArrowRight,
  Clock,
  X,
  Zap,
  Database,
  Command,
  AlertTriangle,
} from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { Task, ApprovalRequest } from '@/lib/api/controlRoom';
import { NEIMAN_CONFIG } from '@neiman/config';

interface CommandResult {
  id: string;
  label: string;
  description?: string;
  category: 'agent' | 'task' | 'action' | 'navigation' | 'workflow' | 'approval';
  icon: React.ReactNode;
  risk?: 'high' | 'critical';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  onNavigate: (target: string) => void;
  onSelectAgent: (agentId: string) => void;
}

const HISTORY_KEY = NEIMAN_CONFIG.STORAGE_KEYS.COMMAND_HISTORY;
const MAX_HISTORY = NEIMAN_CONFIG.OPERATIONAL_LIMITS.MAX_COMMAND_HISTORY;

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveHistory(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const h = loadHistory().filter((s) => s !== query).slice(0, MAX_HISTORY - 1);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([query, ...h]));
  } catch { /* ignore */ }
}

export function CommandPalette({
  isOpen,
  onClose,
  agents,
  tasks,
  approvals,
  onNavigate,
  onSelectAgent,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmAction, setConfirmAction] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useMemo(loadHistory, [isOpen]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setConfirmAction(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Build dynamic result list
  const results: CommandResult[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list: CommandResult[] = [];

    // Quick action shortcuts
    const quickActions: CommandResult[] = [
      {
        id: 'show-blocked',
        label: 'Show blocked tasks',
        description: 'Filter tasks with BLOCKED status',
        category: 'action',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
        action: () => onNavigate('tasks'),
      },
      {
        id: 'evolution-proposals',
        label: 'Review evolution proposals',
        description: 'Open Evolution Engine panel',
        category: 'action',
        icon: <Sparkles className="h-3.5 w-3.5 text-violet-400" />,
        action: () => onNavigate('evolution'),
      },
      {
        id: 'pending-approvals',
        label: 'Pending approvals',
        description: `${approvals.filter(a => a.status === 'PENDING').length} awaiting decision`,
        category: 'approval',
        icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />,
        action: () => onNavigate('approvals'),
      },
      {
        id: 'resource-consumption',
        label: 'Resource consumption by department',
        description: 'Open resources overview',
        category: 'navigation',
        icon: <Layers className="h-3.5 w-3.5 text-sky-400" />,
        action: () => onNavigate('resources'),
      },
      {
        id: 'intelligence-gateway',
        label: 'Intelligence gateway status',
        description: 'Model provider routing and health',
        category: 'navigation',
        icon: <Zap className="h-3.5 w-3.5 text-cyan-400" />,
        action: () => onNavigate('intelligence'),
      },
      {
        id: 'memory-graph',
        label: 'Organizational memory graph',
        description: 'Browse knowledge, decisions, and procedures',
        category: 'navigation',
        icon: <Database className="h-3.5 w-3.5 text-emerald-400" />,
        action: () => onNavigate('memory'),
      },
      {
        id: 'create-agent',
        label: 'Create a new agent',
        description: 'Opens agent configuration — requires API connection',
        category: 'action',
        icon: <Bot className="h-3.5 w-3.5 text-cyan-400" />,
        risk: 'high',
        action: () => onNavigate('agents'),
      },
      {
        id: 'open-workflows',
        label: 'Workflow execution graph',
        description: 'Live execution paths, retries, dependencies',
        category: 'workflow',
        icon: <GitFork className="h-3.5 w-3.5 text-indigo-400" />,
        action: () => onNavigate('workflows'),
      },
      {
        id: 'live-activity',
        label: 'Live activity stream',
        description: 'Agent events, routing changes, incidents',
        category: 'navigation',
        icon: <Activity className="h-3.5 w-3.5 text-emerald-400" />,
        action: () => onNavigate('activity'),
      },
    ];

    // Agent results
    const agentResults: CommandResult[] = agents
      .filter((ag) => !q || ag.name.toLowerCase().includes(q) || ag.role_id?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((ag) => ({
        id: `agent-${ag.id}`,
        label: `Inspect ${ag.name}`,
        description: `${ag.role_id || 'Agent'} · ${ag.status}`,
        category: 'agent' as const,
        icon: (
          <span
            className={`h-2 w-2 rounded-full shrink-0 mt-0.5 ${
              ag.status === 'WORKING' || ag.status === 'ACTIVE'
                ? 'bg-emerald-400'
                : ag.status === 'BLOCKED' || ag.status === 'FAILED'
                ? 'bg-rose-400'
                : 'bg-zinc-500'
            }`}
          />
        ),
        action: () => {
          onSelectAgent(ag.id);
          saveHistory(`Inspect ${ag.name}`);
        },
      }));

    // Task results
    const taskResults: CommandResult[] = tasks
      .filter((t) => !q || t.title?.toLowerCase().includes(q) || t.status?.toLowerCase().includes(q))
      .slice(0, 4)
      .map((t) => ({
        id: `task-${t.id}`,
        label: t.title || t.id,
        description: `Status: ${t.status}`,
        category: 'task' as const,
        icon: <Activity className="h-3.5 w-3.5 text-cyan-400" />,
        action: () => onNavigate('tasks'),
      }));

    if (!q) {
      // No query — show quick actions + recent agents
      list.push(...quickActions.slice(0, 6));
      list.push(...agentResults.slice(0, 3));
    } else {
      // Fuzzy filter quick actions
      list.push(...quickActions.filter((a) => a.label.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)));
      list.push(...agentResults);
      list.push(...taskResults);
    }

    return list;
  }, [query, agents, tasks, approvals, onNavigate, onSelectAgent]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = results[selectedIndex];
        if (!item) return;
        if (item.risk && !confirmAction) { setConfirmAction(item); return; }
        item.action();
        saveHistory(query || item.label);
        onClose();
      }
    },
    [results, selectedIndex, confirmAction, query, onClose]
  );

  // Keep selected in bounds when results change
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  const categoryColors: Record<CommandResult['category'], string> = {
    agent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    task: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    action: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    navigation: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    workflow: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    approval: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Palette */}
      <div className="relative w-full max-w-xl animate-fade-in">
        <div className="neiman-panel rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-cyan-500/20">
            <Command className="h-4 w-4 text-cyan-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); setConfirmAction(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Search agents, tasks, commands…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border/40 text-[9px] font-mono text-muted-foreground">Esc</kbd>
          </div>

          {/* Confirmation prompt */}
          {confirmAction && (
            <div className="px-4 py-3 border-b border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-300 font-bold">{confirmAction.label}</span>
                <span className="text-muted-foreground">— requires API connection. Press Enter to proceed.</span>
              </div>
              <button type="button" onClick={() => setConfirmAction(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* History chips (no query) */}
          {!query && history.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 border-b border-border/20 overflow-x-auto">
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuery(h)}
                  className="shrink-0 px-2 py-0.5 rounded border border-border/40 bg-secondary/30 text-[9px] text-muted-foreground hover:text-foreground font-mono whitespace-nowrap"
                >
                  {h}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-xs font-mono">
                No results for &quot;{query}&quot;
              </div>
            ) : (
              results.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.risk && !confirmAction) { setConfirmAction(item); return; }
                    item.action();
                    saveHistory(query || item.label);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    idx === selectedIndex
                      ? 'bg-cyan-500/12 border-l-2 border-cyan-400'
                      : 'border-l-2 border-transparent hover:bg-secondary/30'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{item.label}</span>
                    {item.description && (
                      <span className="block text-[10px] text-muted-foreground font-mono truncate">{item.description}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.risk && (
                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        {item.risk}
                      </span>
                    )}
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${categoryColors[item.category]}`}>
                      {item.category}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border/20 flex items-center justify-between text-[9px] text-muted-foreground font-mono">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1 py-0.5 rounded bg-secondary border border-border/40">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-secondary border border-border/40">↵</kbd> execute</span>
              <span><kbd className="px-1 py-0.5 rounded bg-secondary border border-border/40">Esc</kbd> close</span>
            </div>
            <span className="text-cyan-400/60">NEIMAN Command Hub</span>
          </div>
        </div>
      </div>
    </div>
  );
}
