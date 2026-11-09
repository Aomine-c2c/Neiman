'use client';

import React from 'react';
import { Database, ArrowRight, Share2, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { memoryApi } from '@/lib/api/memory';
import { useOrganizationContext } from '@/lib/organizationContext';
import { NEIMAN_CONFIG } from '@neiman/config';

interface KnowledgeGraphStreamProps {
  onOpenDrawer?: (drawerId: string) => void;
}

export function KnowledgeGraphStream({ onOpenDrawer }: KnowledgeGraphStreamProps) {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';

  const { data: graph } = useQuery({
    queryKey: ['kg-stream-stats', companyId],
    queryFn: () => memoryApi.getKnowledgeGraph(companyId, { limit: NEIMAN_CONFIG.OPERATIONAL_LIMITS.DEFAULT_SEARCH_LIMIT * 2 }),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
  });

  const triples = [
    { source: 'Architecture Council', predicate: 'enacted_adr', target: 'gRPC Microservices Migration', time: '14:22:10' },
    { source: 'Security Sentinel', predicate: 'verified_boundary', target: 'Isolated Docker Worktree Sandbox', time: '14:18:05' },
    { source: 'Chief Architect Agent', predicate: 'assigned_task', target: 'Dynamic Consensus Quorum Engine', time: '14:10:44' },
    { source: 'Intelligence Router', predicate: 'routed_fallback', target: 'Local DeepSeek-R1 Air-Gapped', time: '13:58:20' },
  ];

  return (
    <div className="flex flex-col h-full font-mono overflow-hidden">
      {/* Pane Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-foreground" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground">
            Organizational Memory & Knowledge Graph
          </span>
          <span className="text-[8px] px-1.5 py-0.2 rounded border border-border bg-secondary text-muted-foreground">
            {graph?.entities?.length ?? 142} ENTITIES
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenDrawer?.('memory')}
          className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <span>Explore</span>
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* High-Density Triples Feed */}
      <div className="flex-1 overflow-y-auto max-h-56 divide-y divide-border/40 select-text text-xs">
        {triples.map((t, idx) => (
          <div
            key={idx}
            onClick={() => onOpenDrawer?.('memory')}
            className="p-2 hover:bg-secondary/40 transition-colors cursor-pointer group space-y-0.5"
          >
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span className="uppercase font-bold tracking-wider text-primary">[{t.predicate}]</span>
              <span>{t.time}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] truncate">
              <span className="font-semibold text-foreground truncate">{t.source}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground/90 truncate">{t.target}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
