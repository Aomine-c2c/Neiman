'use client';

import React, { FormEvent, useEffect } from 'react';
import { Boxes, ChevronDown, Loader2, Send, Sparkles, X } from 'lucide-react';
import type { MCPServerConfig, SkillConfig } from '@/lib/api/mcp';
import {
  SLASH_COMMANDS,
  SQUAD_MENTIONS,
  type ContextAttachment,
} from './types';

interface CouncilComposerProps {
  composerText: string;
  onChangeComposerText: (text: string) => void;
  onSubmit: (e: FormEvent) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  canMutate: boolean;
  isSending: boolean;
  showMentionMenu: boolean;
  onToggleMentionMenu: (open: boolean) => void;
  showSlashMenu: boolean;
  onToggleSlashMenu: (open: boolean) => void;
  showSkillsPopover: boolean;
  onToggleSkillsPopover: (open: boolean) => void;
  mcpServers: MCPServerConfig[];
  activeSkills: SkillConfig[];
  skillsLoading: boolean;
  contextAttachments: ContextAttachment[];
  onRemoveAttachment: (id: string) => void;
  onAddSkillAttachment: (skillName: string, skillId: string) => void;
  onQuickDispatch: (cmd: string) => void;
  onOpenMcpDrawer: () => void;
  councilMode?: boolean;
  onEnhancePrompt?: () => void;
  isEnhancing?: boolean;
}

export function CouncilComposer({
  composerText,
  onChangeComposerText,
  onSubmit,
  textareaRef,
  canMutate,
  isSending,
  showMentionMenu,
  onToggleMentionMenu,
  showSlashMenu,
  onToggleSlashMenu,
  showSkillsPopover,
  onToggleSkillsPopover,
  mcpServers,
  activeSkills,
  skillsLoading,
  contextAttachments,
  onRemoveAttachment,
  onAddSkillAttachment,
  onQuickDispatch,
  onOpenMcpDrawer,
  councilMode = false,
  onEnhancePrompt,
  isEnhancing = false,
}: CouncilComposerProps) {
  useEffect(() => {
    if (!showMentionMenu && !showSlashMenu && !showSkillsPopover) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggleMentionMenu(false);
        onToggleSlashMenu(false);
        onToggleSkillsPopover(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showMentionMenu, showSlashMenu, showSkillsPopover, onToggleMentionMenu, onToggleSlashMenu, onToggleSkillsPopover]);

  return (
    <div className="p-3 border-t border-border bg-secondary/20 space-y-2 shrink-0">
      {showMentionMenu && (
        <div
          role="menu"
          aria-label="Squad agent mentions"
          className="rounded-lg border border-border bg-card p-2 shadow-lg flex flex-wrap gap-1.5 animate-slide-up"
        >
          {SQUAD_MENTIONS.map((m) => (
            <button
              key={m.tag}
              type="button"
              role="menuitem"
              onClick={() => {
                onChangeComposerText(`${composerText ? `${composerText} ` : ''}${m.tag} `);
                onToggleMentionMenu(false);
                textareaRef.current?.focus();
              }}
              className="min-h-7 px-2 py-1 rounded-md border border-border hover:border-primary/40 text-xs font-mono text-foreground hover:bg-secondary flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-bold text-primary">{m.tag}</span>
              <span className="text-xs text-muted-foreground">({m.role})</span>
            </button>
          ))}
        </div>
      )}

      {showSlashMenu && (
        <div
          role="menu"
          aria-label="Slash commands"
          className="rounded-lg border border-border bg-card p-2 shadow-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1 animate-slide-up"
        >
          {SLASH_COMMANDS.map((s) => (
            <button
              key={s.cmd}
              type="button"
              role="menuitem"
              onClick={() => {
                onChangeComposerText(`${s.cmd} `);
                onToggleSlashMenu(false);
                textareaRef.current?.focus();
              }}
              className="p-2 rounded-md text-left text-xs hover:bg-secondary border border-transparent hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-bold font-mono text-primary block">{s.cmd}</span>
              <span className="text-xs text-muted-foreground truncate block">{s.desc}</span>
            </button>
          ))}
        </div>
      )}

      {showSkillsPopover && (
        <div
          role="dialog"
          aria-label="Skills and MCP Gateways"
          className="rounded-lg border border-border bg-card p-3 shadow-lg space-y-2 animate-slide-up"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border pb-1.5">
            <span className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Skills &amp; Registered MCP Gateways
            </span>
            <button
              type="button"
              onClick={onOpenMcpDrawer}
              className="min-h-6 px-1.5 text-xs font-mono text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Open Hub
            </button>
          </div>
          {skillsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Loading skills and MCP servers…</span>
            </div>
          ) : mcpServers.length === 0 && activeSkills.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active MCP servers or skills configured.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {mcpServers.map((s) => (
                <span
                  key={s.id}
                  className="px-2 py-0.5 rounded text-xs font-mono border border-border bg-secondary/50 text-foreground"
                >
                  MCP: {s.name}
                </span>
              ))}
              {activeSkills.map((sk) => (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => {
                    onAddSkillAttachment(sk.name, sk.id);
                    onToggleSkillsPopover(false);
                  }}
                  className="min-h-6 px-2 py-0.5 rounded text-xs font-mono border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  + {sk.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {contextAttachments.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {contextAttachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 pl-2 pr-1 py-0.5 text-xs font-mono text-primary"
            >
              <span className="truncate max-w-[220px]">{att.label}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                aria-label={`Remove ${att.label}`}
                className="min-h-6 min-w-6 flex items-center justify-center rounded hover:bg-primary/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!councilMode && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onToggleMentionMenu(!showMentionMenu);
                onToggleSlashMenu(false);
                onToggleSkillsPopover(false);
              }}
              aria-expanded={showMentionMenu}
              className="min-h-7 px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>@Agent</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                onToggleSlashMenu(!showSlashMenu);
                onToggleMentionMenu(false);
                onToggleSkillsPopover(false);
              }}
              aria-expanded={showSlashMenu}
              className="min-h-7 px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              /Commands
            </button>
            <button
              type="button"
              onClick={() => {
                onToggleSkillsPopover(!showSkillsPopover);
                onToggleMentionMenu(false);
                onToggleSlashMenu(false);
              }}
              aria-expanded={showSkillsPopover}
              className="min-h-7 px-2.5 py-1 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-xs font-mono text-foreground flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
              <span>+ Skills &amp; MCP</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickDispatch('/workflow')}
              className="hidden sm:inline-flex min-h-7 items-center px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              /workflow
            </button>
            <button
              type="button"
              onClick={() => onQuickDispatch('/git')}
              className="hidden sm:inline-flex min-h-7 items-center px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              /git
            </button>
          </div>

          <span className="text-xs font-mono text-muted-foreground hidden md:inline">
            Shift+Enter newline · Enter send
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={composerText}
          onChange={(e) => onChangeComposerText(e.target.value)}
          disabled={!canMutate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
          placeholder={
            !canMutate
              ? 'Read-only workspace mode — operator input disabled'
              : councilMode
              ? 'Message Solomon (CTO)...'
              : 'Ask the CTO, debate with the Council, or send /run, /workflow, /git commands…'
          }
          aria-label="Send message to CTO and Council"
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-sans min-h-[44px] max-h-[120px] leading-relaxed transition-colors disabled:opacity-60"
        />
        {onEnhancePrompt && (
          <button
            type="button"
            onClick={onEnhancePrompt}
            disabled={!canMutate || !composerText.trim() || isEnhancing || isSending}
            title="Enhance prompt for Solomon (CTO)"
            aria-label="Enhance prompt"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-all shrink-0 self-end h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isEnhancing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Enhance</span>
          </button>
        )}
        <button
          type="submit"
          disabled={!canMutate || !composerText.trim() || isSending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xs shrink-0 self-end h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isSending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
