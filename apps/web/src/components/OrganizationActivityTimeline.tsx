'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { ActivityEvent } from '@neiman/events';
import type { AuditLog } from '@/lib/api/controlRoom';

export type TimelineTone = 'complete' | 'attention' | 'approval' | 'blocked' | 'activity';

export interface TimelineItem {
  id: string;
  at: string;
  headline: string;
  tone: TimelineTone;
}

interface OrganizationActivityTimelineProps {
  events?: ActivityEvent[];
  audits?: AuditLog[];
  maxItems?: number;
  freshIds?: Set<string>;
  emptyHint?: string;
}

const TONE_DOT: Record<TimelineTone, string> = {
  complete: 'bg-emerald-400',
  attention: 'bg-amber-400',
  approval: 'bg-amber-400',
  blocked: 'bg-rose-400',
  activity: 'bg-sky-400',
};

export function formatClock(dateString?: string) {
  if (!dateString) return '--:--';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function toneForActivity(event: ActivityEvent): TimelineTone {
  if (event.event_type === 'approval_requested') return 'approval';
  if (event.event_type === 'task_failed' || event.event_type === 'provider_failed') return 'blocked';
  if (event.severity === 'CRITICAL' || event.severity === 'HIGH') return 'attention';
  if (event.event_type === 'agent_completed' || event.event_type === 'workflow_completed' || event.event_type === 'approval_completed') {
    return 'complete';
  }
  return 'activity';
}

export function activityHeadline(event: ActivityEvent) {
  if (event.summary?.trim()) return event.summary.trim();
  if (event.agent_name && event.title) return `${event.agent_name} ${event.title}`.trim();
  return event.title || 'Organization event';
}

function auditHeadline(audit: AuditLog) {
  const actor = audit.actor_type === 'AGENT' ? 'Agent' : audit.actor_type === 'USER' ? 'Human' : 'System';
  if (audit.target) return `${actor} ${audit.action} — ${audit.target}`;
  return `${actor} ${audit.action}`;
}

function toneForAudit(audit: AuditLog): TimelineTone {
  const blob = `${audit.action} ${audit.result ?? ''}`.toLowerCase();
  if (blob.includes('approval') || blob.includes('pending')) return 'approval';
  if (blob.includes('blocked') || blob.includes('denied') || blob.includes('concern')) return 'blocked';
  if (blob.includes('complet')) return 'complete';
  return 'activity';
}

export function buildTimelineItems(events: ActivityEvent[] = [], audits: AuditLog[] = []): TimelineItem[] {
  const fromEvents: TimelineItem[] = events.map((event) => ({
    id: event.id,
    at: event.timestamp,
    headline: activityHeadline(event),
    tone: toneForActivity(event),
  }));
  if (fromEvents.length > 0) {
    return fromEvents.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }
  return audits
    .map((audit) => ({
      id: audit.id,
      at: audit.created_at,
      headline: auditHeadline(audit),
      tone: toneForAudit(audit),
    }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function OrganizationActivityTimeline({
  events = [],
  audits = [],
  maxItems = 8,
  freshIds,
  emptyHint = 'When agents start work, events appear here with a clock time.',
}: OrganizationActivityTimelineProps) {
  const items = buildTimelineItems(events, audits).slice(0, maxItems);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center">
        <Clock className="mx-auto mb-2 h-5 w-5 text-muted-foreground/70" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">No activity yet</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{emptyHint}</p>
        <Link href="/dashboard/agents" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
          Hire an agent to begin
        </Link>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 pl-14 before:absolute before:bottom-2 before:left-[2.15rem] before:top-2 before:w-px before:bg-border">
      {items.map((item) => {
        const isFresh = freshIds?.has(item.id);
        return (
          <li
            key={item.id}
            className={`relative ${isFresh ? 'animate-slide-down animate-flash-highlight' : ''}`}
          >
            <time
              dateTime={item.at}
              className="absolute left-0 top-0 w-10 font-mono text-[11px] font-semibold tabular-nums text-foreground"
            >
              {formatClock(item.at)}
            </time>
            <span
              className={`absolute left-[1.9rem] top-1.5 h-2 w-2 rounded-full ring-4 ring-background ${TONE_DOT[item.tone]} ${
                item.tone === 'approval' || item.tone === 'blocked' ? 'animate-pulse' : ''
              }`}
              aria-hidden="true"
            />
            <p className="text-sm leading-6 text-foreground">{item.headline}</p>
          </li>
        );
      })}
    </ol>
  );
}
