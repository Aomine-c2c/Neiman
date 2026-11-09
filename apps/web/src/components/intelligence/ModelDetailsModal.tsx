'use client';

import React from 'react';
import {
  X,
  Cpu,
  Clock,
  Coins,
  Shield,
  CheckCircle2,
  XCircle,
  Layers,
  Wrench,
  FileCode,
  Globe,
  Zap,
} from 'lucide-react';
import { Model } from '@/lib/api/intelligence';

interface ModelDetailsModalProps {
  model: Model | null;
  onClose: () => void;
}

export function ModelDetailsModal({ model, onClose }: ModelDetailsModalProps) {
  if (!model) return null;

  const hasTools = model.tool_support ?? model.supports_tools ?? true;
  const hasStructured = model.structured_output_support ?? model.supports_structured_output ?? true;
  const avail = ((model.availability_rate ?? 0.999) * 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                Model Specification & Telemetry
              </span>
              <h2 className="text-base font-bold text-foreground">{model.display_name}</h2>
              <span className="text-xs font-mono text-primary">{model.model_identifier}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {model.description ||
            'High-efficiency intelligence model supporting complex autonomous reasoning, verified schemas, and tool execution.'}
        </p>

        {/* Measurable Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl border border-border/80 bg-secondary/40">
            <span className="text-muted-foreground text-[10px] block uppercase">Context Window</span>
            <strong className="text-foreground text-sm font-bold">
              {Math.round(model.context_capacity / 1000).toLocaleString()}k
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-border/80 bg-secondary/40">
            <span className="text-muted-foreground text-[10px] block uppercase">Avg Latency</span>
            <strong className="text-amber-400 text-sm font-bold">
              {Math.round(model.avg_latency_ms)} ms
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-border/80 bg-secondary/40">
            <span className="text-muted-foreground text-[10px] block uppercase">Input / 1M</span>
            <strong className="text-emerald-400 text-sm font-bold">
              ${model.input_cost_per_million.toFixed(2)}
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-border/80 bg-secondary/40">
            <span className="text-muted-foreground text-[10px] block uppercase">Output / 1M</span>
            <strong className="text-emerald-400 text-sm font-bold">
              ${model.output_cost_per_million.toFixed(2)}
            </strong>
          </div>
        </div>

        {/* Capabilities Pill List */}
        <div>
          <span className="text-xs font-semibold text-foreground block mb-2">
            Verified Capabilities & Modalities
          </span>
          <div className="flex flex-wrap gap-1.5">
            {model.capabilities.map((cap) => (
              <span
                key={cap}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-primary/10 border border-primary/30 text-primary"
              >
                {cap}
              </span>
            ))}
            {model.modalities?.map((mod) => (
              <span
                key={mod}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-secondary border border-border text-muted-foreground"
              >
                Modality: {mod}
              </span>
            ))}
          </div>
        </div>

        {/* Feature Checkpoints */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-secondary/20">
            {hasTools ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium text-foreground">Function & Tool Calling Support</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-secondary/20">
            {hasStructured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium text-foreground">Strict JSON Schema Validation</span>
          </div>
        </div>

        {/* Privacy & Availability Badge Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Privacy:</span>
            <strong className="text-foreground font-mono">{model.privacy_classification}</strong>
          </div>

          <div className="text-xs font-mono">
            <span className="text-muted-foreground">Availability SLA: </span>
            <strong className="text-cyan-400">{avail}%</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
