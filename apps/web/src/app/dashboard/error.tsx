'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('Dashboard rendering failed', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] px-5 py-10 text-slate-100">
      <section
        aria-labelledby="dashboard-error-title"
        className="w-full max-w-xl rounded-xl border border-rose-500/40 bg-slate-950 p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
          <div className="min-w-0">
            <h1 id="dashboard-error-title" className="font-mono text-sm font-bold uppercase tracking-wider text-rose-300">
              Dashboard could not render
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              The dashboard encountered a client error. Retry the page; if it happens again, share the error details below with support.
            </p>
          </div>
        </div>

        <details className="mt-5 rounded-lg border border-slate-700 bg-black/40 p-3">
          <summary className="cursor-pointer font-mono text-xs text-cyan-300">
            Runtime error details
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-300">
            {error.message || 'The browser did not provide an error message.'}
            {error.digest ? `\nError digest: ${error.digest}` : ''}
          </pre>
        </details>

        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-cyan-400/50 bg-cyan-500/10 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wide text-cyan-200 transition-colors hover:bg-cyan-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry dashboard
        </button>
      </section>
    </main>
  );
}
