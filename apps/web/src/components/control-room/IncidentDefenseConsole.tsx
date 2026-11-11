'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertOctagon } from 'lucide-react';
import type { ResourceSummary } from '@/lib/api/controlRoom';

interface IncidentDefenseConsoleProps {
  resources: ResourceSummary;
  onOpenDrawer?: (drawerId: string) => void;
}

export function IncidentDefenseConsole({ resources, onOpenDrawer }: IncidentDefenseConsoleProps) {
  const [panicActive, setPanicActive] = useState(false);

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-border bg-card/90 font-mono w-full shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-foreground" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground">
            Circuits & Defense
          </span>
        </div>
        <span className="text-[8px] px-1 py-0.2 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 font-bold tracking-wider">
          ARMED
        </span>
      </div>

      {/* Provider Circuit Health Indicators Table */}
      <div className="space-y-1 text-[9px]">
        {[
          { name: 'Anthropic (Claude 3.5)', status: 'OK', latency: '240ms' },
          { name: 'OpenAI (GPT-4o)', status: 'OK', latency: '190ms' },
          { name: 'Google (Gemini 1.5)', status: 'OK', latency: '310ms' },
          { name: 'Local (Ollama/vLLM)', status: 'OK', latency: '45ms' },
        ].map((circuit) => (
          <div
            key={circuit.name}
            className="flex items-center justify-between px-2 py-1 rounded border border-border/70 bg-secondary/30 text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium truncate max-w-[120px]">{circuit.name}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px]">
              <span className="text-muted-foreground">{circuit.latency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Panic Freeze / Circuit Control Row */}
      <div className="mt-0.5 pt-1.5 border-t border-border flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPanicActive(!panicActive)}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-bold tracking-wider uppercase transition-all ${
            panicActive
              ? 'bg-[#D71921] border-[#D71921] text-white'
              : 'border-[#D71921]/40 bg-[#D71921]/10 text-[#D71921] hover:bg-[#D71921]/20'
          }`}
        >
          <AlertOctagon className="h-3 w-3" />
          <span>{panicActive ? 'HALTED' : 'PANIC FREEZE'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenDrawer?.('intelligence')}
          className="text-[9px] text-muted-foreground hover:text-foreground underline transition-colors"
        >
          Routing Policy
        </button>
      </div>
    </div>
  );
}
