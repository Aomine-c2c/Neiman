'use client';

import React from 'react';
import {
  Sliders,
  Trash2,
  X,
  Bot,
  Wrench,
  Shield,
  GitBranch,
  Cpu,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Zap,
  Info,
} from 'lucide-react';
import { WorkflowStep, WorkflowNodeType } from '@/lib/api/workflows';
import { Agent } from '@/lib/api/agents';

interface WorkflowInspectorProps {
  step: WorkflowStep | null;
  allSteps: WorkflowStep[];
  agents: Agent[];
  onUpdateStep: (updated: WorkflowStep) => void;
  onDeleteStep: (stepId: string) => void;
  onClose: () => void;
}

export function WorkflowInspector({
  step,
  allSteps,
  agents,
  onUpdateStep,
  onDeleteStep,
  onClose,
}: WorkflowInspectorProps) {
  if (!step) {
    return (
      <div className="w-80 bg-card border-l border-border p-6 flex flex-col items-center justify-center text-center text-muted-foreground select-none">
        <Sliders className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-foreground">No Node Selected</h4>
        <p className="text-[11px] mt-1 max-w-xs">
          Click any workflow node on the canvas to inspect and configure its operational parameters.
        </p>
      </div>
    );
  }

  const nextStepOptions = allSteps.filter((s) => s.id !== step.id);
  const cfg = step.config || {};

  const handleConfigChange = (key: string, value: unknown) => {
    onUpdateStep({
      ...step,
      config: {
        ...cfg,
        [key]: value,
      },
    });
  };

  return (
    <div className="w-84 bg-card border-l border-border flex flex-col h-full select-none animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/20">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-xs font-bold text-foreground">Node Properties</h3>
            <span className="text-[10px] font-mono text-muted-foreground">Type: {step.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDeleteStep(step.id)}
            className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Delete Node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Close Inspector"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin">
        {/* Step Name */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            Display Label
          </label>
          <input
            type="text"
            value={step.name}
            onChange={(e) => onUpdateStep({ ...step, name: e.target.value })}
            className="input text-xs w-full"
            placeholder="Step Name"
          />
        </div>

        {/* Next Step Connection */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            Successor Node (Next Step)
          </label>
          <select
            value={step.next_step_id || ''}
            onChange={(e) => onUpdateStep({ ...step, next_step_id: e.target.value || undefined })}
            className="input text-xs w-full font-mono"
          >
            <option value="">None (Terminal / Branch End)</option>
            {nextStepOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type})
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Fields Based on Node Type */}
        {/* 1. AGENT NODE */}
        {step.type === 'AGENT' && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold block">
              Autonomous Agent Delegation
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Assignee Agent
              </label>
              <select
                value={String(cfg.agent_name || '')}
                onChange={(e) => handleConfigChange('agent_name', e.target.value)}
                className="input text-xs w-full"
              >
                <option value="Product Agent">Product Agent</option>
                <option value="Architect Agent">Architect Agent</option>
                <option value="Security Agent">Security Agent</option>
                <option value="QA Test Agent">QA Test Agent</option>
                <option value="SRE Monitoring Agent">SRE Monitoring Agent</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.name}>
                    {ag.name} ({ag.autonomy})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Assigned Skill Specification
              </label>
              <select
                value={String(cfg.skill || '')}
                onChange={(e) => handleConfigChange('skill', e.target.value)}
                className="input text-xs w-full font-mono"
              >
                <option value="">No Specialized Skill (Standard Agent Identity)</option>
                <option value="programmatic-seo">programmatic-seo (Marketingskills)</option>
                <option value="content-research-writer">content-research-writer (Awesome Claude Skills)</option>
                <option value="schema">schema (Marketingskills)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Prompt Metaprompt / Instruction
              </label>
              <textarea
                rows={3}
                value={String(cfg.instruction || '')}
                onChange={(e) => handleConfigChange('instruction', e.target.value)}
                placeholder="Give exact mission prompt..."
                className="input text-xs w-full resize-none font-mono py-1.5"
              />
            </div>
          </div>
        )}

        {/* 2. TOOL NODE */}
        {step.type === 'TOOL' && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold block">
              Tool Invocation Configuration
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Tool Identifier
              </label>
              <select
                value={String(cfg.tool_name || '')}
                onChange={(e) => handleConfigChange('tool_name', e.target.value)}
                className="input text-xs w-full font-mono"
              >
                <option value="firecrawl_scrape_page">firecrawl_scrape_page (Firecrawl MCP)</option>
                <option value="firecrawl_crawl_sitemap">firecrawl_crawl_sitemap (Firecrawl MCP)</option>
                <option value="sanity_mutate_document">sanity_mutate_document (Sanity MCP)</option>
                <option value="sanity_query_groq">sanity_query_groq (Sanity MCP)</option>
                <option value="sanity_publish_batch">sanity_publish_batch (Sanity MCP)</option>
                <option value="gsc_inspect_url">gsc_inspect_url (Google Search Console MCP)</option>
                <option value="gsc_query_search_analytics">gsc_query_search_analytics (GSC MCP)</option>
                <option value="gsc_submit_sitemap">gsc_submit_sitemap (GSC MCP)</option>
                <option value="gsc_query_crawl_issues">gsc_query_crawl_issues (GSC MCP)</option>
                <option value="automated_test_runner">automated_test_runner</option>
                <option value="sast_security_scanner">sast_security_scanner</option>
                <option value="cloud_infra_deployer">cloud_infra_deployer</option>
                <option value="git_repo_manager">git_repo_manager</option>
                <option value="changelog_generator">changelog_generator</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                CLI / Environment Arguments
              </label>
              <input
                type="text"
                value={String(cfg.arguments || '')}
                onChange={(e) => handleConfigChange('arguments', e.target.value)}
                placeholder="e.g. --coverage --strict"
                className="input text-xs w-full font-mono"
              />
            </div>
          </div>
        )}

        {/* 3. CONDITION NODE */}
        {step.type === 'CONDITION' && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold block">
              Conditional Branching Logic
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Evaluation Expression
              </label>
              <input
                type="text"
                value={step.condition?.expression || String(cfg.expression || '')}
                onChange={(e) => {
                  handleConfigChange('expression', e.target.value);
                  onUpdateStep({
                    ...step,
                    condition: {
                      expression: e.target.value,
                      true_step: step.condition?.true_step,
                      false_step: step.condition?.false_step,
                    },
                  });
                }}
                placeholder="e.g. output.quality_score >= 0.9"
                className="input text-xs w-full font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-emerald-400 mb-1">
                  True Branch Step
                </label>
                <select
                  value={step.condition?.true_step || ''}
                  onChange={(e) =>
                    onUpdateStep({
                      ...step,
                      condition: {
                        expression: step.condition?.expression || '',
                        true_step: e.target.value || undefined,
                        false_step: step.condition?.false_step,
                      },
                    })
                  }
                  className="input text-xs w-full font-mono"
                >
                  <option value="">Select step…</option>
                  {nextStepOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-rose-400 mb-1">
                  False Branch Step
                </label>
                <select
                  value={step.condition?.false_step || ''}
                  onChange={(e) =>
                    onUpdateStep({
                      ...step,
                      condition: {
                        expression: step.condition?.expression || '',
                        true_step: step.condition?.true_step,
                        false_step: e.target.value || undefined,
                      },
                    })
                  }
                  className="input text-xs w-full font-mono"
                >
                  <option value="">Select step…</option>
                  {nextStepOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 4. APPROVAL NODE */}
        {(step.type === 'APPROVAL' || step.type === 'HUMAN_REVIEW') && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
              Human-in-the-Loop Governance
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Risk Classification
              </label>
              <select
                value={String(cfg.risk_level || 'HIGH')}
                onChange={(e) => handleConfigChange('risk_level', e.target.value)}
                className="input text-xs w-full font-mono"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Sign-off Authority Role
              </label>
              <select
                value={String(cfg.required_role || 'EXECUTIVE')}
                onChange={(e) => handleConfigChange('required_role', e.target.value)}
                className="input text-xs w-full"
              >
                <option value="EXECUTIVE">Chief Technology Officer / Executive</option>
                <option value="SECURITY_LEAD">Security Sentinel Lead</option>
                <option value="DEPARTMENT_MANAGER">Department Manager</option>
                <option value="ANY_ADMIN">Any Company Admin</option>
              </select>
            </div>
          </div>
        )}

        {/* 5. MODEL SELECTION */}
        {step.type === 'MODEL_SELECTION' && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400 font-bold block">
              Intelligence Provider Mesh
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Preferred Provider
              </label>
              <select
                value={String(cfg.provider || 'auto')}
                onChange={(e) => handleConfigChange('provider', e.target.value)}
                className="input text-xs w-full"
              >
                <option value="auto">Dynamic Model Router (Policy Optimized)</option>
                <option value="anthropic">Anthropic API Gateway</option>
                <option value="google">Google Gemini API Gateway</option>
                <option value="openai">OpenAI API Gateway</option>
                <option value="local">Local Air-Gapped Engine</option>
              </select>
            </div>
          </div>
        )}

        {/* 6. DELAY NODE */}
        {step.type === 'DELAY' && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Execution Timer Delay
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Pause Duration (Seconds)
              </label>
              <input
                type="number"
                min="1"
                value={Number(cfg.duration_seconds || 60)}
                onChange={(e) => handleConfigChange('duration_seconds', Number(e.target.value))}
                className="input text-xs w-full font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
