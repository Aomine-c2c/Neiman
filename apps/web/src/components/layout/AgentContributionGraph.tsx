'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCommit, ChevronDown, ChevronUp, Users, Flame } from 'lucide-react';
import { activityApi, type ActivityEvent } from '@/lib/api/activity';

export interface AgentContributionGraphProps {
  companyId?: string;
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string | null) => void;
  selectedDate?: string | null;
  onSelectDate?: (dateStr: string | null) => void;
  defaultExpanded?: boolean;
  collapsed?: boolean;
}

interface DayContribution {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  agentBreakdown: Record<string, number>;
  events: Array<{ title: string; agent: string; type: string }>;
}

const DEFAULT_AGENTS = [
  { id: 'cto', name: 'Chief Technology Agent', shortName: 'CTO' },
  { id: 'architect', name: 'Systems Architect Agent', shortName: 'Architect' },
  { id: 'security', name: 'Cybersecurity Agent', shortName: 'Security' },
  { id: 'backend', name: 'Backend Engineering Agent', shortName: 'Backend' },
  { id: 'qa', name: 'Quality Assurance Agent', shortName: 'QA Lead' },
];

export function AgentContributionGraph({
  companyId = '',
  selectedAgentId = null,
  onSelectAgent,
  selectedDate = null,
  onSelectDate,
  defaultExpanded = false,
  collapsed = false,
}: AgentContributionGraphProps) {
  const [activeAgentFilter, setActiveAgentFilter] = useState<string | null>(selectedAgentId);
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(selectedDate);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [hoveredDay, setHoveredDay] = useState<DayContribution | null>(null);

  // Sync external prop if provided
  React.useEffect(() => {
    if (selectedAgentId !== undefined) {
      setActiveAgentFilter(selectedAgentId);
    }
  }, [selectedAgentId]);

  React.useEffect(() => {
    if (selectedDate !== undefined) {
      setActiveDateFilter(selectedDate);
    }
  }, [selectedDate]);

  // Fetch real activity events from backend
  const { data: realEvents = [] } = useQuery<ActivityEvent[]>({
    queryKey: ['agent-activity-contributions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        return await activityApi.getRecentActivity(companyId, { limit: 200 });
      } catch {
        return [];
      }
    },
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  // Generate 16 weeks of calendar days (112 days) up to today using verified backend events only
  const { weeks, monthLabels, totalContributions, currentStreak } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const WEEKS_COUNT = 16;
    const DAYS_TOTAL = WEEKS_COUNT * 7;

    const currentDayOfWeek = today.getDay();
    const normalizedDayIndex = (currentDayOfWeek + 6) % 7;
    const daysToSubtract = DAYS_TOTAL - 1 - normalizedDayIndex;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToSubtract);

    // Map real events by YYYY-MM-DD
    const eventsByDate = new Map<string, ActivityEvent[]>();
    for (const ev of realEvents) {
      if (!ev.timestamp) continue;
      const dStr = ev.timestamp.slice(0, 10);
      const list = eventsByDate.get(dStr) || [];
      list.push(ev);
      eventsByDate.set(dStr, list);
    }

    const calculatedWeeks: DayContribution[][] = [];
    const months: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;
    let totalCount = 0;

    for (let w = 0; w < WEEKS_COUNT; w++) {
      const currentWeek: DayContribution[] = [];

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + w * 7 + d);

        const year = cellDate.getFullYear();
        const month = String(cellDate.getMonth() + 1).padStart(2, '0');
        const day = String(cellDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (cellDate.getMonth() !== lastMonth && d === 0) {
          months.push({
            label: cellDate.toLocaleString('default', { month: 'short' }),
            weekIndex: w,
          });
          lastMonth = cellDate.getMonth();
        }

        const isFuture = cellDate > today;
        let dayCount = 0;
        const agentMap: Record<string, number> = {};
        const eventsList: Array<{ title: string; agent: string; type: string }> = [];

        if (!isFuture) {
          const matchedReal = eventsByDate.get(dateStr) || [];
          for (const ev of matchedReal) {
            const evAgent = ev.agent_name || 'Agent';
            const agentMatches =
              !activeAgentFilter ||
              ev.agent_id === activeAgentFilter ||
              evAgent.toLowerCase().includes(activeAgentFilter.toLowerCase());

            if (agentMatches) {
              dayCount++;
              agentMap[evAgent] = (agentMap[evAgent] || 0) + 1;
              eventsList.push({
                title: ev.title || 'Contribution',
                agent: evAgent,
                type: ev.event_type || 'activity',
              });
            }
          }

          totalCount += dayCount;
        }

        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (dayCount > 0) {
          if (dayCount <= 2) level = 1;
          else if (dayCount <= 5) level = 2;
          else if (dayCount <= 9) level = 3;
          else level = 4;
        }

        currentWeek.push({
          date: cellDate,
          dateStr,
          count: dayCount,
          level,
          agentBreakdown: agentMap,
          events: eventsList,
        });
      }

      calculatedWeeks.push(currentWeek);
    }

    // Compute streak backwards from today across real recorded days
    const flatDays = calculatedWeeks.flat().filter((c) => c.date <= today);
    let streak = 0;
    for (let i = flatDays.length - 1; i >= 0; i--) {
      if (flatDays[i].count > 0) {
        streak++;
      } else if (i < flatDays.length - 1) {
        break;
      }
    }

    return {
      weeks: calculatedWeeks,
      monthLabels: months,
      totalContributions: totalCount,
      currentStreak: streak,
    };
  }, [realEvents, activeAgentFilter]);

  const recentDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return weeks
      .flat()
      .filter((c) => c.date <= today)
      .slice(-14);
  }, [weeks]);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 border-b border-border">
        <button
          type="button"
          title="Agent Contribution Graph"
          aria-label="Agent Contribution Graph"
          onClick={() => setIsExpanded((v) => !v)}
          className="min-h-7 min-w-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GitCommit className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const handleAgentClick = (agentId: string | null) => {
    setActiveAgentFilter(agentId);
    if (onSelectAgent) {
      onSelectAgent(agentId);
    }
  };

  const handleDayClick = (dateStr: string) => {
    const nextDate = activeDateFilter === dateStr ? null : dateStr;
    setActiveDateFilter(nextDate);
    if (onSelectDate) {
      onSelectDate(nextDate);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:filter-date', { detail: { date: nextDate } })
      );
    }
  };

  // High contrast monochrome levels adhering to:
  // "THE COLOURS SHOLD BE , BLACK,GREY ,WHITE OR ANY OTHER NEARETS"
  const getCellColor = (level: 0 | 1 | 2 | 3 | 4) => {
    switch (level) {
      case 0:
        return 'bg-secondary/40 dark:bg-white/[0.04] border-border/40 dark:border-white/[0.03]';
      case 1:
        return 'bg-zinc-400/60 dark:bg-zinc-700/70 border-zinc-500/50 dark:border-zinc-600/60';
      case 2:
        return 'bg-zinc-600/80 dark:bg-zinc-500/80 border-zinc-700/70 dark:border-zinc-400/70';
      case 3:
        return 'bg-zinc-800 dark:bg-zinc-300 border-zinc-900/80 dark:border-zinc-200/80';
      case 4:
        return 'bg-black dark:bg-white border-black dark:border-white shadow-xs';
    }
  };

  return (
    <div className="border-b border-border bg-card shrink-0">
      {/* Header bar with readable title and compact telemetry summary */}
      <div className="px-3 py-1.5 bg-secondary/20 border-b border-border/60 space-y-1">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <GitCommit className="h-3.5 w-3.5 text-foreground shrink-0" />
            <span className="text-[11px] font-semibold text-foreground tracking-tight truncate">
              Agent Contributions
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse contribution graph' : 'Expand contribution graph'}
            aria-expanded={isExpanded}
            className="min-h-6 min-w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Flame className="h-3 w-3 text-foreground shrink-0" />
              <span>{currentStreak}d streak</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border">
              {totalContributions} total
            </span>
          </div>
          {!isExpanded && (
            <div
              className="flex items-center gap-0.5 shrink-0"
              aria-hidden="true"
              title="14-day activity sparkline — expand to filter by date"
            >
              {recentDays.slice(-10).map((d) => (
                <span
                  key={d.dateStr}
                  className={`w-1.5 h-2.5 rounded-[1px] border ${getCellColor(d.level)} ${
                    activeDateFilter === d.dateStr ? 'ring-1 ring-primary' : ''
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {activeDateFilter && !isExpanded && (
        <div className="flex items-center justify-between px-3 py-1 bg-primary/10 border-b border-primary/20 text-[11px] font-mono text-primary">
          <span>Filtered: {activeDateFilter}</span>
          <button
            type="button"
            onClick={() => handleDayClick(activeDateFilter)}
            className="min-h-6 px-1.5 rounded underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="p-2.5 space-y-2">
          {/* Agent Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px] font-mono">
            <button
              type="button"
              onClick={() => handleAgentClick(null)}
              className={`min-h-6 px-2 py-0.5 rounded font-medium transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activeAgentFilter === null
                  ? 'bg-foreground text-background font-bold'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50'
              }`}
            >
              All Agents
            </button>
            {DEFAULT_AGENTS.map((ag) => {
              const isSelected = activeAgentFilter === ag.id || activeAgentFilter === ag.name;
              return (
                <button
                  key={ag.id}
                  type="button"
                  onClick={() => handleAgentClick(isSelected ? null : ag.id)}
                  className={`min-h-6 px-2 py-0.5 rounded font-medium transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? 'bg-foreground text-background font-bold'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50'
                  }`}
                  title={ag.name}
                >
                  {ag.shortName}
                </button>
              );
            })}
          </div>

          {/* GitHub-Style 7-row × 16-col Calendar Matrix */}
          <div className="relative">
            {/* Month Labels */}
            <div className="flex items-center text-[10px] font-mono text-muted-foreground pl-4 mb-1 h-3 relative">
              {monthLabels.map((m, idx) => (
                <span
                  key={idx}
                  style={{ left: `${m.weekIndex * 14 + 16}px` }}
                  className="absolute truncate"
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div className="flex gap-1 items-start">
              {/* Day-of-week labels (Mon, Wed, Fri) */}
              <div className="flex flex-col justify-between text-[10px] font-mono text-muted-foreground pr-1 pt-0.5 h-[84px] select-none shrink-0">
                <span>M</span>
                <span>W</span>
                <span>F</span>
              </div>

              {/* Heatmap Grid */}
              <div className="flex gap-1 items-center overflow-x-auto py-0.5 scrollbar-none flex-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1 shrink-0">
                    {week.map((day, dIdx) => {
                      const isDateSelected = activeDateFilter === day.dateStr;
                      return (
                        <button
                          key={dIdx}
                          type="button"
                          onClick={() => handleDayClick(day.dateStr)}
                          onMouseEnter={() => setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          aria-label={`${day.count} contributions on ${day.dateStr}`}
                          className={`w-2.5 h-2.5 rounded-[2px] border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${getCellColor(
                            day.level
                          )} ${
                            isDateSelected ? 'ring-1 ring-primary border-primary' : 'hover:ring-1 hover:ring-foreground'
                          }`}
                          title={`${day.count} contributions on ${day.dateStr} (Click to filter)`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Hover Tooltip / Detail Card */}
            {hoveredDay && (
              <div className="mt-1.5 p-1.5 rounded-md border border-border bg-card text-[11px] shadow-sm font-mono space-y-0.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {hoveredDay.count} contribution{hoveredDay.count === 1 ? '' : 's'}
                  </span>
                  <span>{hoveredDay.dateStr}</span>
                </div>
                {Object.keys(hoveredDay.agentBreakdown).length > 0 ? (
                  <div className="pt-0.5 text-muted-foreground text-[10px] truncate">
                    {Object.entries(hoveredDay.agentBreakdown)
                      .map(([agent, cnt]) => `${agent} (${cnt})`)
                      .join(' • ')}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground">No agent activity logged</div>
                )}
              </div>
            )}
          </div>

          {/* Footer Legend & Metrics */}
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
            <div className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-foreground" />
              <span>{currentStreak}d streak</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Less</span>
              <div className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-[1px] bg-secondary/40 dark:bg-white/[0.04] border border-border/40 dark:border-white/[0.03]" />
                <span className="w-2 h-2 rounded-[1px] bg-zinc-400/60 dark:bg-zinc-700/70" />
                <span className="w-2 h-2 rounded-[1px] bg-zinc-600/80 dark:bg-zinc-500/80" />
                <span className="w-2 h-2 rounded-[1px] bg-zinc-800 dark:bg-zinc-300" />
                <span className="w-2 h-2 rounded-[1px] bg-black dark:bg-white" />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
