'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Terminal as TerminalIcon,
  Play,
  RotateCw,
  Plus,
  X,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Trash2,
  CornerDownLeft,
  Folder,
  Cpu,
  AlertTriangle,
  Zap,
  Sparkles,
  Shield,
  Layers,
  ArrowUp,
  ArrowDown,
  Power,
  ChevronRight,
  Code2,
} from 'lucide-react';
import {
  terminalApi,
  TerminalSession,
  TerminalExecResult,
} from '@/lib/api/terminal';
import { AnsiRenderer } from './AnsiRenderer';

export interface BashTerminalProps {
  companyId: string;
  initialSessionId?: string;
  className?: string;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

const COMMON_COMMANDS = [
  { label: 'git status', cmd: 'git status' },
  { label: 'git diff --stat', cmd: 'git diff --stat' },
  { label: 'ls -la', cmd: 'ls -la' },
  { label: 'pwd', cmd: 'pwd' },
  { label: 'pytest', cmd: 'python3 -m pytest apps/api/tests/test_terminal.py' },
  { label: 'npm test', cmd: 'npm --prefix apps/web test' },
  { label: 'uname -a', cmd: 'uname -a' },
  { label: 'free -h', cmd: 'free -h' },
];

const MAX_BUFFER_CHARS = 250_000;
const appendBoundedBuffer = (prev: string, chunk: string): string => {
  const merged = prev + chunk;
  return merged.length > MAX_BUFFER_CHARS ? merged.slice(merged.length - MAX_BUFFER_CHARS) : merged;
};

export function BashTerminal({
  companyId,
  initialSessionId,
  className = '',
  isMaximized = false,
  onToggleMaximize,
  onClose,
}: BashTerminalProps) {
  const queryClient = useQueryClient();

  // Active session selection
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
  const [outputBuffer, setOutputBuffer] = useState<string>('');
  const [inputCommand, setInputCommand] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const [copiedCwd, setCopiedCwd] = useState<boolean>(false);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<'xs' | 'sm'>('xs');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Fetch sessions
  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['terminal-sessions', companyId],
    queryFn: () => terminalApi.listSessions(companyId),
    enabled: !!companyId,
    refetchInterval: 10000,
  });

  // Sync activeSessionId with first session once loaded
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // 2. Fetch history & backlog when switching sessions
  useEffect(() => {
    if (!companyId || !activeSession?.id) return;

    let mounted = true;
    terminalApi
      .getHistory(companyId, activeSession.id)
      .then((res) => {
        if (mounted) {
          setOutputBuffer(res.backlog || '');
          if (res.history?.length) {
            setLocalHistory(res.history);
          }
        }
      })
      .catch((e) => {
        console.error('Failed to load terminal backlog', e);
      });

    return () => {
      mounted = false;
    };
  }, [companyId, activeSession?.id]);

  // 3. WebSocket Realtime PTY Connection
  useEffect(() => {
    if (!companyId || !activeSession?.id) return;

    const wsUrl = terminalApi.getWebSocketUrl(companyId, activeSession.id);
    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        // Periodic heartbeat ping
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init') {
            if (msg.backlog) {
              setOutputBuffer(msg.backlog.length > MAX_BUFFER_CHARS ? msg.backlog.slice(msg.backlog.length - MAX_BUFFER_CHARS) : msg.backlog);
            }
          } else if (msg.type === 'output' && msg.data) {
            setOutputBuffer((prev) => appendBoundedBuffer(prev, msg.data));
          }
        } catch {
          // Raw string chunk
          setOutputBuffer((prev) => appendBoundedBuffer(prev, event.data));
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = () => {
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [companyId, activeSession?.id]);

  // Auto-scroll to bottom on buffer update
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputBuffer, autoScroll]);

  // Focus input on mount and tab switch
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSession?.id]);

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: (title?: string) =>
      terminalApi.createSession(companyId, {
        title: title || `Terminal ${sessions.length + 1} (bash)`,
      }),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['terminal-sessions', companyId] });
      setActiveSessionId(newSession.id);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => terminalApi.deleteSession(companyId, sessionId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['terminal-sessions', companyId] });
      if (activeSessionId === deletedId) {
        const remaining = sessions.filter((s) => s.id !== deletedId);
        setActiveSessionId(remaining[0]?.id || null);
      }
    },
  });

  // Execute command handler (via WebSocket or REST fallback)
  const handleExecuteCommand = async (commandToRun: string) => {
    const trimmed = commandToRun.trim();
    if (!trimmed || isExecuting || !activeSession) return;

    // Built-in 'clear' command client-side handling
    if (trimmed === 'clear') {
      setOutputBuffer('');
      setInputCommand('');
      setHistoryIndex(-1);
      return;
    }

    // Add to command history with bounded capacity (prevents unbounded memory growth)
    setLocalHistory((prev) => [...prev.slice(-499), trimmed]);
    setHistoryIndex(-1);
    setInputCommand('');

    // If WebSocket is live, stream directly to PTY stdin
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: `${trimmed}\n` }));
      return;
    }

    // Otherwise, execute via REST fallback
    setIsExecuting(true);
    try {
      const res: TerminalExecResult = await terminalApi.execCommand(
        companyId,
        activeSession.id,
        trimmed
      );

      setOutputBuffer((prev) => {
        let chunk = `\n$ ${trimmed}\n${res.stdout}`;
        if (res.stderr) {
          chunk += `\n[error] ${res.stderr}`;
        }
        return appendBoundedBuffer(prev, chunk);
      });

      queryClient.invalidateQueries({ queryKey: ['terminal-sessions', companyId] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setOutputBuffer((prev) => appendBoundedBuffer(prev, `\n[execution failed]: ${message}\n`));
    } finally {
      setIsExecuting(false);
    }
  };

  // Keyboard navigation for command line history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteCommand(inputCommand);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (localHistory.length === 0) return;
      const nextIndex = historyIndex === -1 ? localHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputCommand(localHistory[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= localHistory.length) {
        setHistoryIndex(-1);
        setInputCommand('');
      } else {
        setHistoryIndex(nextIndex);
        setInputCommand(localHistory[nextIndex] || '');
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      // Send SIGINT
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'signal', signal: 'SIGINT' }));
      } else if (activeSession) {
        terminalApi.sendSignal(companyId, activeSession.id, 'SIGINT');
      }
      setOutputBuffer((prev) => prev + '^C\n');
      setInputCommand('');
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setOutputBuffer('');
    }
  };

  const handleCopyCwd = () => {
    if (!activeSession?.working_dir) return;
    navigator.clipboard.writeText(activeSession.working_dir);
    setCopiedCwd(true);
    setTimeout(() => setCopiedCwd(false), 2000);
  };

  const handleCopyOutput = () => {
    if (!outputBuffer) return;
    navigator.clipboard.writeText(outputBuffer);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  return (
    <div
      aria-label="Integrated Bash Terminal"
      className={`flex flex-col rounded-xl border border-border/80 bg-zinc-950 text-zinc-100 overflow-hidden shadow-xl transition-all ${className}`}
    >
      {/* ── Terminal Header & Tabs ── */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs select-none gap-2">
        {/* Left: Tab bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 mr-2 text-zinc-400 font-semibold shrink-0">
            <TerminalIcon className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline font-mono">BASH TERMINAL</span>
          </div>

          {sessions.map((sess) => {
            const isActive = sess.id === activeSession?.id;
            return (
              <div
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                className={`group flex items-center gap-1.5 px-3 py-1 rounded-md cursor-pointer font-mono text-xs transition-colors shrink-0 ${isActive
                    ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700/80 shadow-xs'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${sess.is_active ? 'bg-emerald-500' : 'bg-zinc-600'
                    }`}
                />
                <span className="truncate max-w-[140px]">{sess.title}</span>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSessionMutation.mutate(sess.id);
                    }}
                    aria-label={`Close ${sess.title}`}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => createSessionMutation.mutate()}
            disabled={createSessionMutation.isPending || sessions.length >= 8}
            aria-label="New Terminal Tab"
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-[11px]">New</span>
          </button>
        </div>

        {/* Right: Actions and Live Status */}
        <div className="flex items-center gap-2 shrink-0">
          {/* CWD pill */}
          {activeSession && (
            <button
              type="button"
              onClick={handleCopyCwd}
              title={`Working Directory: ${activeSession.working_dir} (Click to copy)`}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-300 font-mono text-[11px] hover:border-zinc-500 transition-colors"
            >
              <Folder className="h-3 w-3 text-primary" />
              <span className="truncate max-w-[180px]">
                {activeSession.working_dir.replace(/^\/home\/[^\/]+/, '~')}
              </span>
              {copiedCwd ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-2.5 w-2.5 opacity-60" />
              )}
            </button>
          )}

          {/* Connection status pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700 font-mono text-[10px]">
            <span
              className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
            />
            <span className="text-zinc-300">{wsConnected ? 'LIVE PTY' : 'REST'}</span>
          </div>

          {/* Clear screen */}
          <button
            type="button"
            onClick={() => setOutputBuffer('')}
            title="Clear output (Ctrl+L)"
            aria-label="Clear Terminal"
            className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* Copy output */}
          <button
            type="button"
            onClick={handleCopyOutput}
            title="Copy buffer"
            aria-label="Copy Terminal Output"
            className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            {copiedOutput ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Font toggle */}
          <button
            type="button"
            onClick={() => setFontSize(fontSize === 'xs' ? 'sm' : 'xs')}
            title="Toggle font size"
            className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors font-mono text-[10px]"
          >
            {fontSize.toUpperCase()}
          </button>

          {/* Maximize / Restore */}
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              aria-label={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
              className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Close */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Terminal Dock"
              className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── DevOps Quick Action Bar ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-950/60 overflow-x-auto text-[11px] scrollbar-none font-mono">
        <span className="text-zinc-500 text-[10px] uppercase font-bold shrink-0 flex items-center gap-1 mr-1">
          <Zap className="h-3 w-3 text-amber-400" />
          <span>Quick:</span>
        </span>
        {COMMON_COMMANDS.map((c) => (
          <button
            key={c.cmd}
            type="button"
            onClick={() => handleExecuteCommand(c.cmd)}
            className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-primary/50 text-zinc-300 hover:text-zinc-100 transition-colors shrink-0"
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Console Output Buffer ── */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className={`flex-1 overflow-y-auto p-4 bg-zinc-950 font-mono select-text cursor-text min-h-[220px] max-h-[550px] ${fontSize === 'sm' ? 'text-sm' : 'text-xs'
          }`}
      >
        {outputBuffer ? (
          <AnsiRenderer content={outputBuffer} />
        ) : (
          <div className="text-zinc-600 italic py-6 text-center select-none font-sans">
            Terminal session ready. Enter a bash command or choose a quick action above.
          </div>
        )}
      </div>

      {/* ── Interactive Command Prompt Bar ── */}
      <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono">
        <span className="text-emerald-400 font-bold flex items-center shrink-0">
          <span>neiman</span>
          <span className="text-zinc-500">@</span>
          <span className="text-cyan-400">host</span>
          <span className="text-zinc-500">:</span>
          <span className="text-blue-400 font-normal truncate max-w-[120px] sm:max-w-[200px]">
            {activeSession?.working_dir.split('/').pop() || 'sila'}
          </span>
          <span className="text-zinc-300 ml-1">$</span>
        </span>

        <input
          ref={inputRef}
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          placeholder="Type a bash command... (Up/Down for history, Ctrl+C to cancel, Ctrl+L to clear)"
          aria-label="Terminal Bash Command Input"
          className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono text-xs sm:text-sm"
        />

        <button
          type="button"
          onClick={() => handleExecuteCommand(inputCommand)}
          disabled={!inputCommand.trim() || isExecuting}
          aria-label="Submit Bash Command"
          className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          {isExecuting ? (
            <RotateCw className="h-3 w-3 animate-spin" />
          ) : (
            <CornerDownLeft className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">Run</span>
        </button>
      </div>
    </div>
  );
}

