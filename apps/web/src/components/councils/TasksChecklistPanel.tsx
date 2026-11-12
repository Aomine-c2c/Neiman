'use client';

import React, { memo, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Loader2,
  Play,
} from 'lucide-react';

interface ChecklistRowProps {
  item: string;
  isDone: boolean;
  assignedRole: string;
  priority: 'HIGH' | 'MED';
  canMutate: boolean;
  onToggle: () => void;
  onDelegate: () => void;
}

const ChecklistRow = memo(function ChecklistRow({
  item,
  isDone,
  assignedRole,
  priority,
  canMutate,
  onToggle,
  onDelegate,
}: ChecklistRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 p-1.5 rounded border transition-colors text-xs ${
        isDone
          ? 'border-border bg-secondary/30 text-muted-foreground'
          : 'border-border bg-card hover:border-primary/40 text-foreground'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Toggle task: ${item}`}
          aria-pressed={isDone}
          className={`min-h-6 min-w-6 flex items-center justify-center rounded border shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDone
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-border bg-background hover:border-primary/50'
          }`}
        >
          {isDone && <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />}
        </button>
        <span
          className={`text-xs truncate ${
            isDone ? 'line-through text-muted-foreground' : 'font-medium text-foreground'
          }`}
          title={item}
        >
          {item}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-xs font-mono border border-border/60">
          @{assignedRole}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${
            priority === 'HIGH'
              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          {priority}
        </span>
        <button
          type="button"
          disabled={!canMutate}
          onClick={onDelegate}
          title={`Delegate task to @${assignedRole}`}
          aria-label={`Delegate ${item} to ${assignedRole}`}
          className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Play className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

interface TasksChecklistPanelProps {
  tasksExpanded: boolean;
  onToggleTasksExpanded: () => void;
  actionItems: string[];
  completedCount: number;
  completedTaskMap: Record<string, boolean>;
  customChecklistTasks: Array<{ title: string; role: string; priority: 'HIGH' | 'MED' }>;
  canMutate: boolean;
  isAddingTask: boolean;
  taskError: string | null;
  onOpenBoardDrawer: () => void;
  onAddTask: (title: string) => void;
  onToggleTaskItem: (item: string) => void;
  onDelegateTask: (role: string, item: string) => void;
}

export function TasksChecklistPanel({
  tasksExpanded,
  onToggleTasksExpanded,
  actionItems,
  completedCount,
  completedTaskMap,
  customChecklistTasks,
  canMutate,
  isAddingTask,
  taskError,
  onOpenBoardDrawer,
  onAddTask,
  onToggleTaskItem,
  onDelegateTask,
}: TasksChecklistPanelProps) {
  const [newTaskInput, setNewTaskInput] = useState('');

  const handleSubmit = () => {
    const trimmed = newTaskInput.trim();
    if (!trimmed || !canMutate || isAddingTask) return;
    onAddTask(trimmed);
    setNewTaskInput('');
  };

  return (
    <section
      aria-label="Tasks and Checklist"
      className={`${
        tasksExpanded ? 'flex-[3] min-h-0' : 'shrink-0'
      } flex flex-col overflow-hidden bg-card transition-all`}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-secondary/30 shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ListTodo className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-bold text-foreground truncate">
            Tasks &amp; Checklist
          </span>
          <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60 shrink-0">
            {completedCount}/{actionItems.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenBoardDrawer}
            aria-label="Board"
            className="min-h-6 px-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Board ↗
          </button>
          <button
            type="button"
            onClick={onToggleTasksExpanded}
            title={tasksExpanded ? 'Collapse Tasks Panel' : 'Expand Tasks Panel'}
            aria-label={tasksExpanded ? 'Collapse Tasks Panel' : 'Expand Tasks Panel'}
            aria-expanded={tasksExpanded}
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tasksExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {tasksExpanded && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="w-full h-1 bg-secondary shrink-0">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${actionItems.length > 0 ? (completedCount / actionItems.length) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5 shrink-0 bg-background/40">
            <input
              type="text"
              value={newTaskInput}
              disabled={!canMutate || isAddingTask}
              onChange={(e) => setNewTaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              aria-label="New engineering task title"
              placeholder="+ Add engineering task to checklist…"
              className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canMutate || !newTaskInput.trim() || isAddingTask}
              className="min-h-7 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground text-xs font-mono font-semibold border border-border shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isAddingTask && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              <span>+ Add Task</span>
            </button>
          </div>

          {taskError && (
            <div role="alert" className="px-2.5 py-1 bg-rose-500/10 border-b border-rose-500/30 text-xs font-mono text-rose-700 dark:text-rose-400">
              {taskError}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            {actionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground space-y-1">
                <CheckSquare className="h-4 w-4 opacity-50" aria-hidden="true" />
                <p className="text-xs font-mono">No tasks in queue</p>
              </div>
            ) : (
              actionItems.map((item, idx) => {
                const isDone = completedTaskMap[item] ?? false;
                const customMeta = customChecklistTasks.find((c) => c.title === item);
                const assignedRole =
                  customMeta?.role ||
                  (idx % 3 === 0 ? 'Architect' : idx % 3 === 1 ? 'Backend' : 'QA Lead');
                const priority = customMeta?.priority || (idx === 0 ? 'HIGH' : 'MED');

                return (
                  <ChecklistRow
                    key={`${item}-${idx}`}
                    item={item}
                    isDone={isDone}
                    assignedRole={assignedRole}
                    priority={priority}
                    canMutate={canMutate}
                    onToggle={() => onToggleTaskItem(item)}
                    onDelegate={() => onDelegateTask(assignedRole, item)}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
