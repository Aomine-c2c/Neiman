'use client';

import React from 'react';
import { Briefcase, ArrowRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { Task, Project } from '@/lib/api/controlRoom';

interface TaskPipelineMatrixProps {
  tasks: Task[];
  projects: Project[];
  onOpenDrawer?: (drawerId: string) => void;
}

export function TaskPipelineMatrix({ tasks, projects, onOpenDrawer }: TaskPipelineMatrixProps) {
  const displayTasks = tasks.length > 0 ? tasks.slice(0, 5) : [
    { id: 't1', title: 'Compile distributed inference routing matrix', priority: 'HIGH', status: 'IN_PROGRESS' },
    { id: 't2', title: 'Verify token compression ratio benchmarks', priority: 'MEDIUM', status: 'IN_PROGRESS' },
    { id: 't3', title: 'Audit air-gapped local model weights', priority: 'CRITICAL', status: 'COMPLETED' },
    { id: 't4', title: 'Sync Knowledge Graph relation triples', priority: 'LOW', status: 'PENDING' },
  ];

  return (
    <div className="flex flex-col h-full font-mono overflow-hidden">
      {/* Pane Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-foreground" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground">
            Work Pipeline & Tasks Matrix
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded border border-border bg-secondary text-muted-foreground">
            {tasks.filter((t) => t.status === 'IN_PROGRESS').length} In Progress
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenDrawer?.('tasks')}
          className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <span>Worktrees</span>
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* High-Density Task List */}
      <div className="flex-1 overflow-y-auto max-h-56 divide-y divide-border/40 select-text text-xs">
        {displayTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onOpenDrawer?.('tasks')}
            className="flex items-center justify-between p-2 hover:bg-secondary/40 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 truncate pr-2">
              {task.status === 'COMPLETED' ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : task.status === 'IN_PROGRESS' ? (
                <Clock className="h-3 w-3 text-sky-500 animate-spin shrink-0" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="truncate max-w-[200px] sm:max-w-xs text-[11px] font-medium text-foreground">
                {task.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                  task.priority === 'CRITICAL'
                    ? 'border-[#D71921]/40 bg-[#D71921]/10 text-[#D71921]'
                    : task.priority === 'HIGH'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                    : 'border-border bg-secondary text-muted-foreground'
                }`}
              >
                {task.priority || 'NORMAL'}
              </span>
              <span className="text-[9px] uppercase font-bold text-muted-foreground">
                {task.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
