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
  ChevronDown,
  Code2,
  MessageSquarePlus,
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
  onAttachOutputToChat?: (label: string, content: string, autoPrompt?: string) => void;
  onLastExitStatusChange?: (status: { exitCode: number; command: string; errorSnippet?: string }) => void;
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
  onAttachOutputToChat,
  onLastExitStatusChange,
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
  const [showQuickDropdown, setShowQuickDropdown] = useState<boolean>(false);
  const [lastExitCode, setLastExitCode] = useState<number>(0);
  const [lastCommandRun, setLastCommandRun] = useState<string>('');
  const [lastErrorOutput, setLastErrorOutput] = useState<string>('');

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
    setLastCommandRun(trimmed);

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

      const exitCode = typeof res.exit_code === 'number' ? res.exit_code : res.stderr ? 1 : 0;
      setLastExitCode(exitCode);
      if (exitCode !== 0 || res.stderr) {
        setLastErrorOutput(res.stderr || res.stdout || `Command '${trimmed}' exited with ${exitCode}`);
      } else {
        setLastErrorOutput('');
      }
      onLastExitStatusChange?.({
        exitCode,
        command: trimmed,
        errorSnippet: res.stderr || undefined,
      });

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
      setLastExitCode(1);
      setLastErrorOutput(message);
      onLastExitStatusChange?.({
        exitCode: 1,
        command: trimmed,
        errorSnippet: message,
      });
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

  const handleAttachOutput = () => {
    const tail = (outputBuffer || '').slice(-1500).trim();
    if (!tail) return;
    if (onAttachOutputToChat) {
      onAttachOutputToChat(`Terminal (${lastCommandRun || 'bash'})`, tail);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:insert-chat-context', {
          detail: {
            filePath: `Terminal:${lastCommandRun || 'bash'}`,
            snippet: `\n\`\`\`bash\n${tail}\n\`\`\``,
          },
        })
      );
    }
  };

  const handleSendErrorToCto = () => {
    const snippet = (lastErrorOutput || outputBuffer.slice(-1200)).trim();
    const prompt = `Diagnose and fix this terminal error from \`${lastCommandRun || 'bash'}\` (exit ${lastExitCode}):\n\`\`\`bash\n${snippet}\n\`\`\``;
    if (onAttachOutputToChat) {
      onAttachOutputToChat(`Terminal Error (exit ${lastExitCode})`, snippet, prompt);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:insert-chat-context', {
          detail: {
            filePath: `Terminal Error (exit ${lastExitCode})`,
            snippet: `\n\`\`\`bash\n$ ${lastCommandRun}\n${snippet}\n\`\`\``,
            promptText: prompt,
          },
        })
      );
    }
  };

  return (
    <div
      aria-label="Integrated Bash Terminal"
      className={`flex flex-col rounded-xl border border-border bg-card text-foreground overflow-hidden shadow-sm transition-all ${className}`}
    >
      {/* ── Terminal Header & Tabs ── */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-border bg-secondary/40 px-3 py-1.5 text-xs select-none gap-2 shrink-0 min-w-0">
        {/* Left: Tab bar */}
        <div role="tablist" aria-label="Terminal sessions" className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mr-1.5 text-foreground font-semibold shrink-0">
            <TerminalIcon className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            <span className="font-mono text-[11px] tracking-wider">BASH TERMINAL</span>
          </div>

          {sessions.map((sess) => {
            const isActive = sess.id === activeSession?.id;
            return (
              <div
                key={sess.id}
                className={`group flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-md font-mono text-[11px] transition-colors shrink-0 ${
                  isActive
                    ? 'bg-background text-foreground font-semibold border border-border shadow-xs'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveSessionId(sess.id)}
                  className="flex items-center gap-1.5 min-h-6 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      sess.is_active ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-muted-foreground/50'
                    }`}
                  />
                  <span className="truncate max-w-[130px]">{sess.title}</span>
                </button>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteSessionMutation.mutate(sess.id)}
                    aria-label={`Close ${sess.title}`}
                    className="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="flex items-center gap-1 min-h-6 px-2 py-0.5 rounded-md border border-dashed border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3 w-3" />
            <span className="text-[11px] font-mono">New</span>
          </button>
        </div>

        {/* Right: Actions and Live Status */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 w-full sm:w-auto relative">
          {/* Send Error to CTO button when last command exited non-zero */}
          {(lastExitCode !== 0 || Boolean(lastErrorOutput)) && (
            <button
              type="button"
              onClick={handleSendErrorToCto}
              title="Send failed command & stderr to CTO in Chat"
              className="inline-flex items-center gap-1 min-h-6 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 font-mono text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Send Error to CTO (Exit {lastExitCode || 1})</span>
            </button>
          )}

          {/* Compact Quick Commands Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQuickDropdown((v) => !v)}
              aria-expanded={showQuickDropdown}
              title="Quick DevOps Commands"
              className="inline-flex items-center gap-1 min-h-6 px-2 py-0.5 rounded-md bg-background border border-border text-foreground hover:bg-secondary font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Zap className="h-3 w-3 text-amber-700 dark:text-amber-400" />
              <span>Quick</span>
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {showQuickDropdown && (
              <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-lg border border-border bg-card p-1 shadow-xl space-y-0.5 font-mono text-[11px]">
                {COMMON_COMMANDS.map((c) => (
                  <button
                    key={c.cmd}
                    type="button"
                    onClick={() => {
                      setShowQuickDropdown(false);
                      handleExecuteCommand(c.cmd);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-secondary text-foreground flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{c.label}</span>
                    <Play className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CWD pill */}
          {activeSession && (
            <button
              type="button"
              onClick={handleCopyCwd}
              title={`Working Directory: ${activeSession.working_dir} (Click to copy)`}
              className="hidden md:inline-flex items-center gap-1 min-h-6 px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground hover:text-foreground font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Folder className="h-3 w-3" />
              <span className="truncate max-w-[140px]">
                {activeSession.working_dir.replace(/^\/home\/[^\/]+/, '~')}
              </span>
              {copiedCwd ? (
                <Check className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <Copy className="h-2.5 w-2.5 opacity-70" />
              )}
            </button>
          )}

          {/* Connection status pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background border border-border font-mono text-[11px] tabular-nums">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                wsConnected ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-600 dark:bg-amber-400'
              }`}
            />
            <span className="text-foreground">{wsConnected ? 'LIVE PTY' : 'REST'}</span>
          </div>

          {/* Attach Output to Chat */}
          <button
            type="button"
            onClick={handleAttachOutput}
            title="Attach terminal output to Chat"
            aria-label="Attach Output to Chat"
            className="inline-flex items-center gap-1 min-h-6 px-2 py-0.5 rounded text-foreground hover:bg-secondary transition-colors font-mono text-[11px] border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageSquarePlus className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
            <span className="hidden lg:inline">Attach</span>
          </button>

          {/* Clear screen */}
          <button
            type="button"
            onClick={() => {
              setOutputBuffer('');
              setLastExitCode(0);
              setLastErrorOutput('');
            }}
            title="Clear output (Ctrl+L)"
            aria-label="Clear Terminal"
            className="min-h-6 min-w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* Copy output */}
          <button
            type="button"
            onClick={handleCopyOutput}
            title="Copy Last Output"
            aria-label="Copy Terminal Output"
            className="min-h-6 min-w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copiedOutput ? (
              <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Font toggle */}
          <button
            type="button"
            onClick={() => setFontSize(fontSize === 'xs' ? 'sm' : 'xs')}
            title="Toggle terminal font size"
            aria-label={`Terminal font size: ${fontSize === 'xs' ? 'Small' : 'Medium'}`}
            className="min-h-6 px-1.5 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {fontSize === 'xs' ? '12px' : '14px'}
          </button>

          {/* Maximize / Restore */}
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              aria-label={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
              className="min-h-6 min-w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="min-h-6 min-w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Console Output Buffer ── */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className={`flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 bg-background font-mono select-text cursor-text ${
          fontSize === 'sm' ? 'text-sm' : 'text-xs'
        }`}
      >
        {outputBuffer ? (
          <AnsiRenderer content={outputBuffer} />
        ) : (
          <div className="text-muted-foreground py-4 text-center select-none font-mono text-xs">
            Terminal session ready. Enter a bash command or choose a quick action above.
          </div>
        )}
      </div>

      {/* ── Interactive Command Prompt Bar (REST fallback when LIVE PTY is disconnected) ── */}
      {!wsConnected && (
        <div className="flex items-center gap-2 border-t border-border bg-secondary/30 px-3 py-1.5 text-xs font-mono shrink-0 focus-within:ring-1 focus-within:ring-ring">
          <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center shrink-0">
            <span>neiman</span>
            <span className="text-muted-foreground">@</span>
            <span className="text-foreground">host</span>
            <span className="text-muted-foreground">:</span>
            <span className="text-blue-700 dark:text-blue-400 font-normal truncate max-w-[120px] sm:max-w-[200px]">
              {activeSession?.working_dir.split('/').pop() || 'workspace'}
            </span>
            <span className="text-foreground ml-1">$</span>
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
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none font-mono text-xs sm:text-sm"
          />

          <button
            type="button"
            onClick={() => handleExecuteCommand(inputCommand)}
            disabled={!inputCommand.trim() || isExecuting}
            aria-label="Submit Bash Command"
            className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isExecuting ? (
              <RotateCw className="h-3 w-3 animate-spin" />
            ) : (
              <CornerDownLeft className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">Run</span>
          </button>
        </div>
      )}
    </div>
  );
}

