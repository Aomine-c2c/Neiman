'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileCode,
  Flame,
  Globe,
  Loader2,
  Play,
  RotateCw,
  Search,
  Shield,
  ShieldAlert,
  Terminal,
  X,
  XCircle,
} from 'lucide-react';
import { useOrganizationContext } from '@/lib/organizationContext';
import {
  runtimeApi,
  RuntimeExecutionRecord,
  RuntimeExecuteResult,
} from '@/lib/api/runtime';
import { BashTerminal } from '@/components/terminal/BashTerminal';

const CODE_TEMPLATES = {
  python: `import math

# Sample algorithm: compute prime numbers up to N
def find_primes(n):
    primes = []
    for num in range(2, n + 1):
        if all(num % i != 0 for i in range(2, int(math.isqrt(num)) + 1)):
            primes.append(num)
    return primes

primes = find_primes(50)
print(f"Verified {len(primes)} primes: {primes}")
`,
  node: `// Sample Node.js routine: generate SHA256 digest
const crypto = require('crypto');

const payload = "NEIMAN OS sovereign telemetry verification";
const hash = crypto.createHash('sha256').update(payload).digest('hex');

console.log("Input:", payload);
console.log("SHA-256 Digest:", hash);
`,
  bash: `# Sample shell audit: inspect system environment boundaries
echo "=== Host Environment Sanity Check ==="
echo "Current Date: $(date -u)"
echo "Process ID: $$"
echo "Working Directory: $(pwd)"
echo "Workspace Files: $(ls -la)"
`,
};

export default function RuntimeExecutionPage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'terminal' | 'playground' | 'history'>('terminal');
  const [selectedLanguage, setSelectedLanguage] = useState<'python' | 'node' | 'bash'>('python');
  const [codeContent, setCodeContent] = useState<string>(CODE_TEMPLATES.python);
  const [executionResult, setExecutionResult] = useState<RuntimeExecuteResult | null>(null);
  const [historyFilterLang, setHistoryFilterLang] = useState<string>('ALL');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('ALL');
  const [inspectExecution, setInspectExecution] = useState<RuntimeExecutionRecord | null>(null);

  // Switch template when language tab changes if untouched
  const handleSelectLanguage = (lang: 'python' | 'node' | 'bash') => {
    setSelectedLanguage(lang);
    setCodeContent(CODE_TEMPLATES[lang]);
  };

  // Queries
  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['runtime-metrics', companyId],
    queryFn: () => runtimeApi.getMetrics(companyId),
    enabled: !!companyId,
    refetchInterval: 10000,
  });

  const {
    data: executions = [],
    isLoading: executionsLoading,
    refetch: refetchExecutions,
  } = useQuery({
    queryKey: ['runtime-executions', companyId, historyFilterLang, historyFilterStatus],
    queryFn: () =>
      runtimeApi.listExecutions(companyId, {
        language: historyFilterLang,
        status: historyFilterStatus,
        limit: 50,
      }),
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  // Execute Code Mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      runtimeApi.executeCode(companyId, {
        code: codeContent,
        language: selectedLanguage,
        timeout_seconds: 15.0,
        agent_name: 'Operator Manual Execution',
      }),
    onSuccess: (data) => {
      setExecutionResult(data);
      queryClient.invalidateQueries({ queryKey: ['runtime-executions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['runtime-metrics', companyId] });
    },
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-foreground">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Terminal className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Sandboxed Execution Runtime
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Multi-language kernel-isolated runner (bubblewrap) with AST pre-validation, secret scrubbing, and bounded telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              refetchMetrics();
              refetchExecutions();
            }}
            aria-label="Refresh telemetry"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Pulse Metrics ── */}
      <section
        aria-label="Runtime Telemetry Metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Total Executions</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">
            {metrics?.total_executions ?? 0}
          </p>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            {metrics?.success_rate_pct ?? 100}% success rate
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">AST Violations Blocked</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {metrics?.blocked_violations ?? 0}
          </p>
          <span className="text-[11px] font-mono text-muted-foreground">
            Zero security escapes
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Average Latency</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">
            {metrics?.avg_latency_ms ?? 0}
            <span className="text-xs font-normal text-muted-foreground ml-1">ms</span>
          </p>
          <span className="text-[11px] font-mono text-muted-foreground">
            P95 bounded execution
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Sandbox Backend</span>
            <Shield className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 pt-1 truncate">
            {metrics?.sandbox_backend || 'bubblewrap_kernel_isolated'}
          </p>
          <span className="text-[11px] font-mono text-muted-foreground">
            Linux unshare jail active
          </span>
        </div>
      </section>

      {/* ── View Toggle Tabs ── */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'terminal'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>Interactive Bash Terminal</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            PTY LIVE
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('playground')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'playground'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>Code Playground</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Execution Ledger</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-secondary text-foreground">
            {executions.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: INTERACTIVE BASH TERMINAL ── */}
      {activeTab === 'terminal' && (
        <section aria-label="Integrated Terminal View" className="space-y-4">
          <BashTerminal companyId={companyId} className="min-h-[520px]" />
        </section>
      )}

      {/* ── TAB 2: INTERACTIVE PLAYGROUND ── */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Code Editor */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
              {/* Editor Header: Language Pickers & Run Action */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-1.5">
                  {(['python', 'node', 'bash'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleSelectLanguage(lang)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium uppercase transition-colors ${
                        selectedLanguage === lang
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      {lang === 'node' ? 'Node.js 26' : lang === 'python' ? 'Python 3.14' : 'Bash'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={executeMutation.isPending || !codeContent.trim()}
                  onClick={() => executeMutation.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {executeMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Executing Sandbox…</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Run in Sandbox (Ctrl+Enter)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Textarea Code Input */}
              <div className="p-3 bg-secondary/10">
                <textarea
                  rows={16}
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      if (!executeMutation.isPending && codeContent.trim()) {
                        executeMutation.mutate();
                      }
                    }
                  }}
                  aria-label="Sandbox code editor"
                  className="w-full bg-transparent font-mono text-xs leading-relaxed text-foreground resize-none focus:outline-none p-2 selection:bg-primary/20"
                  spellCheck={false}
                />
              </div>

              <div className="flex items-center justify-between px-4 py-2 border-t border-border/60 text-[11px] font-mono text-muted-foreground bg-secondary/20">
                <span>AST pre-check active • Secret scrubbing enabled</span>
                <span>Press Cmd/Ctrl + Enter to run</span>
              </div>
            </div>
          </div>

          {/* Right Column: Console Output Terminal */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Runtime Console
                  </span>
                </div>

                {executionResult && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        executionResult.status === 'SUCCESS'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : executionResult.status === 'FORBIDDEN'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {executionResult.status} (exit {executionResult.exit_code})
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {executionResult.duration_ms}ms
                    </span>
                  </div>
                )}
              </div>

              {/* Console Body */}
              <div className="p-4 font-mono text-xs min-h-[340px] max-h-[500px] overflow-auto bg-background/90 text-foreground space-y-3">
                {!executionResult ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground space-y-2">
                    <Code2 className="h-8 w-8 text-muted-foreground/60" />
                    <p>No execution dispatched yet</p>
                    <p className="text-[11px]">
                      Write or select a snippet and click &quot;Run in Sandbox&quot;.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Execution Meta Pill */}
                    <div className="rounded-lg border border-border bg-secondary/20 p-2 text-[11px] text-muted-foreground space-y-1">
                      <p>
                        <span className="font-semibold text-foreground">ID: </span>
                        {executionResult.execution_id}
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">Security Verdict: </span>
                        {executionResult.security_checks_passed ? (
                          <span className="text-emerald-500">PASSED</span>
                        ) : (
                          <span className="text-rose-500">FAILED: {executionResult.violation_reason}</span>
                        )}
                      </p>
                      {executionResult.files_created.length > 0 && (
                        <p>
                          <span className="font-semibold text-foreground">Artifacts: </span>
                          {executionResult.files_created.join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Stdout Output */}
                    {executionResult.stdout && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          Standard Output
                        </span>
                        <pre className="p-3 rounded-lg bg-secondary/30 border border-border text-foreground whitespace-pre-wrap break-all">
                          {executionResult.stdout}
                        </pre>
                      </div>
                    )}

                    {/* Stderr Output */}
                    {executionResult.stderr && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-rose-500">
                          Standard Error / Diagnostics
                        </span>
                        <pre className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-all">
                          {executionResult.stderr}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: EXECUTION LEDGER ── */}
      {activeTab === 'history' && (
        <section aria-label="Execution Ledger" className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Language:</span>
              {(['ALL', 'python', 'node', 'bash'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setHistoryFilterLang(lang)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono uppercase transition-colors ${
                    historyFilterLang === lang
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              {(['ALL', 'SUCCESS', 'FAILED', 'FORBIDDEN', 'TIMED_OUT'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setHistoryFilterStatus(st)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono uppercase transition-colors ${
                    historyFilterStatus === st
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            {executionsLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                <p className="mt-2 text-xs font-mono text-muted-foreground">Loading executions…</p>
              </div>
            ) : executions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileCode className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                <p className="mt-2 text-sm font-medium text-foreground">No matching executions</p>
                <p className="text-xs mt-1">Run code in the Playground or dispatch tasks to agents.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-muted-foreground font-mono text-[11px]">
                      <th className="py-2.5 px-4 font-semibold uppercase">Status</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Lang</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Agent / Initiator</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Code Snippet</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Duration</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Time</th>
                      <th className="py-2.5 px-4 font-semibold uppercase text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {executions.map((rec) => {
                      const isSuccess = rec.status === 'SUCCESS';
                      const isForbidden = rec.status === 'FORBIDDEN';
                      return (
                        <tr
                          key={rec.execution_id}
                          className="hover:bg-secondary/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                isSuccess
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : isForbidden
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {isSuccess ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : isForbidden ? (
                                <ShieldAlert className="h-3 w-3" />
                              ) : (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              <span>{rec.status}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold uppercase text-foreground">
                            {rec.language}
                          </td>
                          <td className="py-3 px-4 text-foreground truncate max-w-[140px]">
                            {rec.agent_name || 'System Runner'}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground truncate max-w-[260px]">
                            {rec.code_snippet}
                          </td>
                          <td className="py-3 px-4 font-mono text-foreground">
                            {rec.duration_ms}ms
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                            {rec.created_at ? rec.created_at.replace('T', ' ').slice(0, 19) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setInspectExecution(rec)}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Inspection Detail Modal ── */}
      {inspectExecution && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setInspectExecution(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Execution Detail — {inspectExecution.execution_id}
                </h2>
                <p className="text-xs font-mono text-muted-foreground">
                  {inspectExecution.language.toUpperCase()} • {inspectExecution.status} (exit {inspectExecution.exit_code}) • {inspectExecution.duration_ms}ms
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectExecution(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs max-h-[460px] overflow-auto">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                  Code Dispatched
                </span>
                <pre className="p-3 rounded-lg bg-secondary/30 border border-border whitespace-pre-wrap break-all">
                  {inspectExecution.code_snippet}
                </pre>
              </div>

              {inspectExecution.stdout && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Standard Output
                  </span>
                  <pre className="p-3 rounded-lg bg-secondary/30 border border-border text-foreground whitespace-pre-wrap break-all">
                    {inspectExecution.stdout}
                  </pre>
                </div>
              )}

              {inspectExecution.stderr && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-500 block mb-1">
                    Standard Error
                  </span>
                  <pre className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-all">
                    {inspectExecution.stderr}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

