'use client';

import React from 'react';
import {
  Scale,
  Terminal,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Lock,
} from 'lucide-react';
import type { CouncilDeliberation } from '@/lib/api/councils';

interface CouncilHeaderBarProps {
  selectedDelib: CouncilDeliberation | null;
  displayStatus: string | null;
  terminalOpen: boolean;
  rightPanelOpen: boolean;
  canMutate: boolean;
  onToggleTerminal: () => void;
  onStartNewChat: () => void;
  onToggleRightPanel: () => void;
}

export function CouncilHeaderBar({
  selectedDelib,
  displayStatus,
  terminalOpen,
  rightPanelOpen,
  canMutate,
  onToggleTerminal,
  onStartNewChat,
  onToggleRightPanel,
}: CouncilHeaderBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30 shrink-0 gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground border border-border shrink-0">
          <Scale className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <h2 className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-[340px]">
            {selectedDelib ? selectedDelib.title : 'Direct CTO & Squad Architecture Thread'}
          </h2>
          {displayStatus && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-mono font-semibold bg-secondary text-foreground border border-border tabular-nums">
              {displayStatus}
            </span>
          )}
          {!canMutate && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
              title="Read-only workspace mode — operator mutations disabled"
            >
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Read-only</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onToggleTerminal}
          className={`min-h-7 text-xs font-mono px-2.5 py-1 rounded border transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            terminalOpen
              ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
              : 'border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle Integrated Bash Terminal (Ctrl+`)"
          aria-label="Toggle Integrated Bash Terminal"
          aria-pressed={terminalOpen}
        >
          <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Terminal</span>
        </button>

        <button
          type="button"
          onClick={onStartNewChat}
          aria-label="New CTO Chat Thread"
          title="Start New CTO & Squad Chat Thread"
          className="min-h-7 inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        <button
          type="button"
          onClick={onToggleRightPanel}
          aria-label={rightPanelOpen ? 'Collapse Context Panel' : 'Expand Context Panel'}
          aria-expanded={rightPanelOpen}
          title={rightPanelOpen ? 'Collapse Spec & Tasks Panel' : 'Open Spec & Tasks Panel'}
          className="min-h-7 min-w-7 flex items-center justify-center p-1 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rightPanelOpen ? (
            <PanelRightClose className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelRightOpen className="h-4 w-4 text-primary" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
