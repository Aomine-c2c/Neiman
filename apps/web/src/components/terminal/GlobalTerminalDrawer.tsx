'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Terminal as TerminalIcon,
  Code2,
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { BashTerminal } from './BashTerminal';
import { runtimeApi, type RuntimeExecuteResult } from '@/lib/api/runtime';

const DEFAULT_SNIPPETS: Record<'python' | 'node' | 'bash', string> = {
  python: `import sys, platform\nprint(f"Python {sys.version.split()[0]} on {platform.system()}")`,
  node: `console.log("Node.js Sandbox:", process.version);`,
  bash: `echo "Sandbox CWD: $(pwd)" && uname -a`,
};

export function GlobalTerminalDrawer() {
  const pathname = usePathname();
  const { activeCompany } = useAuthStore();
  const companyId = activeCompany?.id || '';
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [activeDockTab, setActiveDockTab] = useState<'terminal' | 'sandbox' | 'history'>('terminal');

  // Sandbox Playground state
  const [sandboxLang, setSandboxLang] = useState<'python' | 'node' | 'bash'>('python');
  const [sandboxCode, setSandboxCode] = useState<string>(DEFAULT_SNIPPETS.python);
  const [sandboxOutput, setSandboxOutput] = useState<RuntimeExecuteResult | null>(null);

  const { data: executions = [], isLoading: historyLoading } = useQuery({
    queryKey: ['runtime-executions-dock', companyId],
    queryFn: () => runtimeApi.listExecutions(companyId, { limit: 15 }),
    enabled: !!companyId && isOpen && activeDockTab === 'history',
  });

  const executeSandboxMutation = useMutation({
    mutationFn: (payload: { language: 'python' | 'node' | 'bash'; code: string }) =>
      (runtimeApi.execute || runtimeApi.executeCode)(companyId, {
        language: payload.language,
        code: payload.code,
        timeout_seconds: 15,
      }),
    onSuccess: (res) => {
      setSandboxOutput(res);
      qc.invalidateQueries({ queryKey: ['runtime-executions-dock', companyId] });
    },
  });

  // Global hotkey listener: Ctrl + ` (backtick) or Alt + T
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === '`') || (e.altKey && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen && !isMaximized) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, isMaximized]);

  // Expose toggle & open-sandbox events for header, sidebar, or inline chat code blocks
  useEffect(() => {
    const handleToggleEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: 'terminal' | 'sandbox' | 'history'; code?: string; language?: 'python' | 'node' | 'bash' }>).detail;
      if (detail?.tab) {
        setActiveDockTab(detail.tab);
        if (detail.code) setSandboxCode(detail.code);
        if (detail.language) setSandboxLang(detail.language);
        setIsOpen(true);
      } else {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('neiman:toggle-terminal', handleToggleEvent);
    return () => window.removeEventListener('neiman:toggle-terminal', handleToggleEvent);
  }, []);

  if (!isOpen || !companyId || pathname === '/dashboard' || pathname === '/dashboard/councils') {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Global Terminal Dock"
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-200 animate-slide-up shadow-2xl ${
        isMaximized
          ? 'top-12 h-[calc(100vh-3rem)]'
          : 'h-[380px] sm:h-[440px]'
      }`}
    >
      <div className="h-full w-full bg-zinc-950/95 backdrop-blur-md border-t-2 border-primary/60 flex flex-col">
        {/* Top Mode Switcher Strip: Bash Terminal | Sandbox Playground | Run History */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs font-mono shrink-0">
          <div className="flex items-center gap-1" role="tablist" aria-label="Execution Runtime Dock Tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeDockTab === 'terminal'}
              onClick={() => setActiveDockTab('terminal')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                activeDockTab === 'terminal'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <TerminalIcon className="h-3.5 w-3.5" />
              <span>Bash Terminal</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDockTab === 'sandbox'}
              onClick={() => setActiveDockTab('sandbox')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                activeDockTab === 'sandbox'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Sandbox Playground</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDockTab === 'history'}
              onClick={() => setActiveDockTab('history')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                activeDockTab === 'history'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Run History</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              aria-label={isMaximized ? 'Restore Dock' : 'Maximize Dock'}
              className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Runtime Dock"
              className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Interactive Bash Terminal */}
        {activeDockTab === 'terminal' && (
          <div className="flex-1 min-h-0">
            <BashTerminal
              companyId={companyId}
              className="h-full border-none rounded-none"
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized((prev) => !prev)}
              onClose={() => setIsOpen(false)}
            />
          </div>
        )}

        {/* Tab 2: Isolated Sandbox Playground */}
        {activeDockTab === 'sandbox' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800 text-zinc-100 font-mono text-xs overflow-hidden">
            <div className="flex flex-col p-3 gap-2 min-h-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(['python', 'node', 'bash'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        setSandboxLang(lang);
                        setSandboxCode(DEFAULT_SNIPPETS[lang]);
                      }}
                      className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold ${
                        sandboxLang === lang
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    executeSandboxMutation.mutate({ language: sandboxLang, code: sandboxCode })
                  }
                  disabled={executeSandboxMutation.isPending || !sandboxCode.trim()}
                  className="inline-flex items-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {executeSandboxMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  <span>Execute in Sandbox</span>
                </button>
              </div>
              <textarea
                value={sandboxCode}
                onChange={(e) => setSandboxCode(e.target.value)}
                aria-label="Sandbox Code Input"
                className="flex-1 w-full rounded border border-zinc-800 bg-zinc-900/90 p-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex flex-col p-3 gap-2 min-h-0 overflow-y-auto bg-zinc-950">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>SANDBOX STDOUT / STDERR</span>
                {sandboxOutput && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sandboxOutput.status === 'SUCCESS'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {sandboxOutput.status} • exit {sandboxOutput.exit_code} • {sandboxOutput.duration_ms}ms
                  </span>
                )}
              </div>
              {sandboxOutput ? (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {sandboxOutput.stdout && (
                    <pre className="p-2.5 rounded bg-zinc-900 text-emerald-300 whitespace-pre-wrap text-xs">
                      {sandboxOutput.stdout}
                    </pre>
                  )}
                  {sandboxOutput.stderr && (
                    <pre className="p-2.5 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 whitespace-pre-wrap text-xs">
                      {sandboxOutput.stderr}
                    </pre>
                  )}
                  {sandboxOutput.violation_reason && (
                    <p className="text-rose-400 text-xs">
                      Security Gate: {sandboxOutput.violation_reason}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-sans">
                  Run a snippet in the isolated runtime or click &ldquo;Run in Sandbox&rdquo; on any code block in chat.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Execution History */}
        {activeDockTab === 'history' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3 text-xs font-mono text-zinc-200 space-y-2">
            {historyLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading sandbox execution audit log…</span>
              </div>
            ) : executions.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 font-sans">
                No sandbox executions recorded yet.
              </div>
            ) : (
              executions.map((ex) => (
                <div
                  key={ex.execution_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {ex.status === 'SUCCESS' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] uppercase font-bold text-primary">
                      {ex.language}
                    </span>
                    <span className="truncate text-zinc-300 max-w-md">
                      {ex.code_snippet.replace(/\s+/g, ' ').slice(0, 80)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-zinc-400 tabular-nums">
                    <span>exit {ex.exit_code}</span>
                    <span>{ex.duration_ms}ms</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
