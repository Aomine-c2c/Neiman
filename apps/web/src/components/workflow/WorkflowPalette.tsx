'use client';

import React, { useState } from 'react';
import {
  Play,
  Bot,
  CheckSquare,
  Wrench,
  GitBranch,
  Layers,
  Shield,
  UserCheck,
  Zap,
  Cpu,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Search,
  Sparkles,
  Info,
} from 'lucide-react';
import { WorkflowNodeType } from '@/lib/api/workflows';

export interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  category: 'Triggers' | 'Agents & Intelligence' | 'Tasks & Execution' | 'Logic & Flow' | 'Governance & Approvals' | 'Terminals';
  description: string;
  icon: React.ElementType;
  defaultConfig: Record<string, unknown>;
  color: string;
  badgeBg: string;
}

export const NODE_PALETTE_ITEMS: NodePaletteItem[] = [
  // 1. Triggers
  {
    type: 'TRIGGER',
    label: 'Trigger',
    category: 'Triggers',
    description: 'Entrypoint initiating execution on manual trigger, cron schedule, or organizational signal.',
    icon: Play,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
    defaultConfig: { trigger_mode: 'EVENT', event_name: 'new_requirement_ingested' },
  },
  {
    type: 'WEBHOOK',
    label: 'Webhook',
    category: 'Triggers',
    description: 'Listen for inbound webhooks from external systems or dispatch outbound JSON payloads.',
    icon: Globe,
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/30',
    defaultConfig: { url: 'https://api.NEIMAN.internal/webhook', method: 'POST' },
  },

  // 2. Agents & Intelligence
  {
    type: 'AGENT',
    label: 'Agent',
    category: 'Agents & Intelligence',
    description: 'Delegate step to an autonomous organizational agent (Product, Architect, Security, QA).',
    icon: Bot,
    color: 'text-primary',
    badgeBg: 'bg-primary/10 border-primary/30',
    defaultConfig: { agent_name: 'Product Agent', instruction: 'Evaluate requirement and draft functional specification.' },
  },
  {
    type: 'MODEL_SELECTION',
    label: 'Model Selection',
    category: 'Agents & Intelligence',
    description: 'Select or route between Claude 3.5, Gemini 2.5, OpenAI GPT-4o, or Local Qwen.',
    icon: Cpu,
    color: 'text-violet-400',
    badgeBg: 'bg-violet-500/10 border-violet-500/30',
    defaultConfig: { provider: 'anthropic', model: 'claude-3-5-sonnet', fallback: 'google' },
  },

  // 3. Tasks & Execution
  {
    type: 'TASK',
    label: 'Task',
    category: 'Tasks & Execution',
    description: 'Create and track a decomposed project backlog task with expected outcome criteria.',
    icon: CheckSquare,
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 border-blue-500/30',
    defaultConfig: { task_title: 'Implement Core Microservice', priority: 'HIGH' },
  },
  {
    type: 'TOOL',
    label: 'Tool',
    category: 'Tasks & Execution',
    description: 'Execute external or container tools: Git operations, SAST scans, compiler, cloud deployers.',
    icon: Wrench,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 border-amber-500/30',
    defaultConfig: { tool_name: 'automated_test_runner', arguments: '--coverage' },
  },
  {
    type: 'RESOURCE_REQUEST',
    label: 'Resource Request',
    category: 'Tasks & Execution',
    description: 'Dynamically allocate token envelopes, compute cluster instances, or temporary memory.',
    icon: Zap,
    color: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/30',
    defaultConfig: { token_quota: 50000, compute_tier: 'GPU_ACCELERATED' },
  },

  // 4. Logic & Flow
  {
    type: 'CONDITION',
    label: 'Condition',
    category: 'Logic & Flow',
    description: 'Branch execution based on structured JSON conditions or Boolean evaluation logic.',
    icon: GitBranch,
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/30',
    defaultConfig: { expression: 'output.risk_score < 0.2' },
  },
  {
    type: 'PARALLEL',
    label: 'Parallel',
    category: 'Logic & Flow',
    description: 'Split process into concurrent parallel branches (e.g. Frontend, Backend, and DB migrations).',
    icon: Layers,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/30',
    defaultConfig: { branch_count: 3, join_strategy: 'ALL_SUCCESS' },
  },
  {
    type: 'DELAY',
    label: 'Delay',
    category: 'Logic & Flow',
    description: 'Pause execution for a specified duration before advancing to the next step.',
    icon: Clock,
    color: 'text-slate-400',
    badgeBg: 'bg-slate-500/10 border-slate-500/30',
    defaultConfig: { duration_seconds: 60 },
  },

  // 5. Governance & Approvals
  {
    type: 'APPROVAL',
    label: 'Approval',
    category: 'Governance & Approvals',
    description: 'Human-in-the-Loop formal gate: halts execution until designated human executive signs off.',
    icon: Shield,
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 border-rose-500/30',
    defaultConfig: { title: 'Production Release Sign-off', risk_level: 'CRITICAL', required_role: 'EXECUTIVE' },
  },
  {
    type: 'HUMAN_REVIEW',
    label: 'Human Review',
    category: 'Governance & Approvals',
    description: 'Interactive QA inspection checkpoint for qualitative artifact and design validation.',
    icon: UserCheck,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 border-amber-500/30',
    defaultConfig: { review_aspects: ['Design Compliance', 'Security Audit'], timeout_hours: 24 },
  },
  {
    type: 'ESCALATION',
    label: 'Escalation',
    category: 'Governance & Approvals',
    description: 'Trigger immediate operational escalation upon repeated failures or policy violations.',
    icon: AlertTriangle,
    color: 'text-red-500',
    badgeBg: 'bg-red-500/10 border-red-500/30',
    defaultConfig: { escalation_channel: 'security-leads', urgency: 'CRITICAL' },
  },
  {
    type: 'VALIDATION',
    label: 'Validation',
    category: 'Governance & Approvals',
    description: 'Assert schema integrity, constitutional boundaries, and quality benchmark rubrics.',
    icon: CheckCircle2,
    color: 'text-teal-400',
    badgeBg: 'bg-teal-500/10 border-teal-500/30',
    defaultConfig: { rubric: 'CONSTITUTIONAL_COMPLIANCE', threshold: 0.95 },
  },

  // 6. Terminals
  {
    type: 'SUCCESS',
    label: 'Success',
    category: 'Terminals',
    description: 'Terminal node marking workflow completion, artifact packaging, and closeout.',
    icon: CheckCircle,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
    defaultConfig: { message: 'Workflow execution successfully completed.' },
  },
  {
    type: 'FAILURE',
    label: 'Failure',
    category: 'Terminals',
    description: 'Terminal failure node dispatching dead-letter events and failure notifications.',
    icon: XCircle,
    color: 'text-rose-500',
    badgeBg: 'bg-rose-500/10 border-rose-500/30',
    defaultConfig: { reason: 'Process failed execution parameters.' },
  },
];

interface WorkflowPaletteProps {
  onAddNode: (item: NodePaletteItem) => void;
}

export function WorkflowPalette({ onAddNode }: WorkflowPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = ['ALL', 'Triggers', 'Agents & Intelligence', 'Tasks & Execution', 'Logic & Flow', 'Governance & Approvals', 'Terminals'];

  const filtered = NODE_PALETTE_ITEMS.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="w-72 bg-card border-r border-border flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-border space-y-2.5 bg-secondary/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Node Palette
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
            16 Nodes
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-8 py-1 text-xs h-8 bg-background border-border/80 w-full"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-md text-[10px] whitespace-nowrap font-medium transition-colors ${selectedCategory === cat
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
            >
              {cat === 'Agents & Intelligence' ? 'Agents' : cat === 'Governance & Approvals' ? 'Governance' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Nodes List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              role="button"
              tabIndex={0}
              data-testid={`palette-item-${item.type}`}
              onClick={() => onAddNode(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAddNode(item);
                }
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/NEIMAN-node', JSON.stringify(item));
              }}
              className="group p-2.5 rounded-xl border border-border/70 bg-secondary/30 hover:bg-secondary hover:border-primary/50 cursor-pointer transition-all space-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${item.badgeBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                  </div>
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {item.label}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                  + Add
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
