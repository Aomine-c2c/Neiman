'use client';

import React from 'react';
import { Code2, Loader2, X } from 'lucide-react';
import type { SourceFileViewResponse } from '@/lib/api/sourceGraph';
import type { GitDiffResponse } from '@/lib/api/vcs';

interface CodeDiffViewerPanelProps {
  viewerFile: string | null;
  viewerMode: 'code' | 'diff';
  viewerCommitSha: string | null;
  viewerFileData?: SourceFileViewResponse | null;
  viewerFileLoading: boolean;
  viewerDiffData?: GitDiffResponse | null;
  viewerDiffLoading: boolean;
  lineSelectionStart: number;
  lineSelectionEnd: number;
  onChangeLineStart: (line: number) => void;
  onChangeLineEnd: (line: number) => void;
  onSetViewerMode: (mode: 'code' | 'diff') => void;
  onClearViewerCommitSha: () => void;
  onAttachLinesToComposer: () => void;
  onCloseViewer: () => void;
}

/**
 * On-demand code source and git diff viewer rendered in the right pane only when
 * a file or commit diff is actively selected.
 */
export function CodeDiffViewerPanel({
  viewerFile,
  viewerMode,
  viewerCommitSha,
  viewerFileData,
  viewerFileLoading,
  viewerDiffData,
  viewerDiffLoading,
  lineSelectionStart,
  lineSelectionEnd,
  onChangeLineStart,
  onChangeLineEnd,
  onSetViewerMode,
  onClearViewerCommitSha,
  onAttachLinesToComposer,
  onCloseViewer,
}: CodeDiffViewerPanelProps) {
  return (
    <section
      aria-label="Code and Diff Viewer"
      className="flex-[4] min-h-0 flex flex-col overflow-hidden bg-card"
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-secondary/30 shrink-0 gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Code2 className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-bold text-foreground truncate">
            {viewerCommitSha
              ? `Commit ${viewerCommitSha.slice(0, 8)}`
              : viewerFile
              ? viewerFile.split('/').pop()
              : 'Code & Diff'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClearViewerCommitSha();
              onSetViewerMode('code');
            }}
            className={`min-h-6 px-2 py-0.5 rounded text-xs font-mono border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              viewerMode === 'code' && !viewerCommitSha
                ? 'bg-primary/15 text-primary border-primary/40 font-bold'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            Source
          </button>
          <button
            type="button"
            onClick={() => onSetViewerMode('diff')}
            className={`min-h-6 px-2 py-0.5 rounded text-xs font-mono border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              viewerMode === 'diff' || Boolean(viewerCommitSha)
                ? 'bg-primary/15 text-primary border-primary/40 font-bold'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            Diff
          </button>
          <button
            type="button"
            onClick={onCloseViewer}
            aria-label="Close code and diff viewer"
            title="Close viewer"
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background text-foreground font-mono text-xs">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/40 text-xs gap-2 shrink-0">
          <span className="truncate text-foreground font-semibold">
            {viewerCommitSha
              ? `Commit Diff: ${viewerCommitSha.slice(0, 8)}`
              : viewerFile || 'No file selected'}
          </span>
          {viewerFile && viewerMode === 'code' && !viewerCommitSha && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-muted-foreground">Lines:</span>
              <input
                type="number"
                min={1}
                aria-label="Line selection start"
                value={lineSelectionStart}
                onChange={(e) => onChangeLineStart(Math.max(1, Number(e.target.value) || 1))}
                className="w-12 rounded bg-card border border-border px-1 py-0.5 text-xs text-center text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span>-</span>
              <input
                type="number"
                min={lineSelectionStart}
                aria-label="Line selection end"
                value={lineSelectionEnd}
                onChange={(e) =>
                  onChangeLineEnd(Math.max(lineSelectionStart, Number(e.target.value) || lineSelectionStart))
                }
                className="w-12 rounded bg-card border border-border px-1 py-0.5 text-xs text-center text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={onAttachLinesToComposer}
                className="min-h-6 px-2 py-0.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Attach #L{lineSelectionStart}-L{lineSelectionEnd}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {viewerFileLoading || viewerDiffLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Loading {viewerMode === 'diff' ? 'diff' : 'source'}…</span>
            </div>
          ) : viewerMode === 'diff' || viewerCommitSha ? (
            <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
              {viewerDiffData?.diff || 'No diff changes available for the selected target.'}
            </pre>
          ) : viewerFileData?.content ? (
            <div className="space-y-0.5">
              {viewerFileData.content.split('\n').map((line, idx) => {
                const lineNum = idx + 1;
                const inRange = lineNum >= lineSelectionStart && lineNum <= lineSelectionEnd;
                return (
                  <button
                    key={lineNum}
                    type="button"
                    onClick={() => {
                      onChangeLineStart(lineNum);
                      onChangeLineEnd(Math.min(lineNum + 15, viewerFileData.total_lines || lineNum + 15));
                    }}
                    className={`w-full text-left flex items-start gap-2 px-1.5 py-0.5 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      inRange ? 'bg-primary/15 text-foreground' : 'hover:bg-secondary/60 text-foreground'
                    }`}
                  >
                    <span className="w-8 text-right text-xs text-muted-foreground select-none tabular-nums shrink-0">
                      {lineNum}
                    </span>
                    <span className="whitespace-pre overflow-x-auto">{line}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-8 text-xs">
              No source content available for this file.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
