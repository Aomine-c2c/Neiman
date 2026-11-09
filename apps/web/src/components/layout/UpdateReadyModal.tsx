'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, GitCommit } from 'lucide-react';
import { systemUpdatesApi, UpdateStatus } from '@/lib/api/systemUpdates';

interface UpdateReadyModalProps {
  onOpenUpdateCenter?: () => void;
}

export function UpdateReadyModal({ onOpenUpdateCenter }: UpdateReadyModalProps) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkGitHubUpdates() {
      try {
        const res = await systemUpdatesApi.getStatus();
        if (mounted && res && res.update_available && !dismissed) {
          setUpdateStatus(res);
        }
      } catch {
        // Silently ignore if offline or check fails
      }
    }

    const timer = setTimeout(() => {
      checkGitHubUpdates();
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [dismissed]);

  if (!updateStatus || !updateStatus.update_available || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-fade-in font-mono"
    >
      <div className="bg-[#080808] border border-[#D71921]/60 shadow-[0_0_24px_rgba(215,25,33,0.18)] p-4 space-y-3 relative text-foreground rounded-xl">
        {/* Header Indicator */}
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#D71921] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#D71921]">
              GITHUB // REPO UPDATE AVAILABLE
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted/20 px-1 py-0.5 border border-border/40">
            {updateStatus.commits_behind} new {updateStatus.commits_behind === 1 ? 'commit' : 'commits'}
          </span>
        </div>

        {/* Content */}
        <div className="space-y-1.5 text-xs">
          <p className="font-semibold text-foreground tracking-tight flex items-center gap-1.5">
            <GitCommit className="h-3.5 w-3.5 text-primary" />
            {updateStatus.remote_commit} (origin/main)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed truncate">
            {updateStatus.latest_summary || 'New commits published to GitHub repository.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/30">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              if (onOpenUpdateCenter) {
                onOpenUpdateCenter();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D71921] hover:bg-[#b0131a] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
          >
            <span>Review & Update</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
