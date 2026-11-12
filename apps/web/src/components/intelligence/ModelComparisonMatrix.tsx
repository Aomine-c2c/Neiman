'use client';

import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Clock,
  Coins,
  Shield,
  CheckCircle2,
  XCircle,
  Search,
  ArrowUpDown,
  Filter,
  Layers,
  Wrench,
  FileCode,
  Info,
} from 'lucide-react';
import { Model } from '@/lib/api/intelligence';

interface ModelComparisonMatrixProps {
  models: Model[];
  onSelectModel?: (model: Model) => void;
  selectedModelId?: string | null;
}

type SortField = 'display_name' | 'avg_latency_ms' | 'input_cost_per_million' | 'context_capacity' | 'availability_rate';

export function ModelComparisonMatrix({
  models,
  onSelectModel,
  selectedModelId,
}: ModelComparisonMatrixProps) {
  const [search, setSearch] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<string>('ALL');
  const [capabilityFilter, setCapabilityFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('avg_latency_ms');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Extract all unique capabilities across models
  const allCapabilities = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => m.capabilities.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [models]);

  const filteredAndSorted = useMemo(() => {
    return models
      .filter((m) => {
        if (privacyFilter !== 'ALL' && m.privacy_classification !== privacyFilter) return false;
        if (capabilityFilter !== 'ALL' && !m.capabilities.includes(capabilityFilter)) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            m.display_name.toLowerCase().includes(q) ||
            m.model_identifier.toLowerCase().includes(q) ||
            m.capabilities.some((c) => c.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField] ?? 0;
        let valB = b[sortField] ?? 0;
        if (typeof valA === 'string') {
          valA = (valA as string).toLowerCase();
          valB = ((valB as string) || '').toLowerCase();
        }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [models, search, privacyFilter, capabilityFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden select-none">
      {/* Table Header & Filters */}
      <div className="p-4 border-b border-border bg-secondary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            Factual Model Capabilities & Measurable Performance Benchmark
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Objective benchmarks: measured round-trip latencies, verified token capacity, cost schedules, and tool integration. Zero arbitrary rankings.
          </p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/80 border border-border/80 text-[10px] font-mono text-muted-foreground">
            <Info className="h-3 w-3 text-primary" />
            <span>Factual configuration & empirical measurements. Sorted objectively by criteria without subjective scores.</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Filter models or capability..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 py-1 text-xs h-8 bg-background border-border w-52"
            />
          </div>

          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className="input text-xs h-8 bg-background border-border font-mono py-1"
          >
            <option value="ALL">All Privacy Tiers</option>
            <option value="PUBLIC_CLOUD">PUBLIC_CLOUD</option>
            <option value="ON_PREMISE_ZERO_RETENTION">ON_PREMISE_ZERO_RETENTION</option>
          </select>

          <select
            value={capabilityFilter}
            onChange={(e) => setCapabilityFilter(e.target.value)}
            className="input text-xs h-8 bg-background border-border font-mono py-1"
          >
            <option value="ALL">All Capabilities</option>
            {allCapabilities.map((cap) => (
              <option key={cap} value={cap}>
                {cap}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Model Benchmark Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground border-b border-border font-mono text-[11px]">
            <tr>
              <th
                onClick={() => handleSort('display_name')}
                className="p-3.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Model & Identifier
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="p-3.5">Verified Capabilities</th>
              <th
                onClick={() => handleSort('context_capacity')}
                className="p-3.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Context Window
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('input_cost_per_million')}
                className="p-3.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Cost / 1M Tokens (In / Out)
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('avg_latency_ms')}
                className="p-3.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Measured Latency
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="p-3.5 text-center">Tool Support</th>
              <th className="p-3.5 text-center">Structured JSON</th>
              <th className="p-3.5">Privacy Classification</th>
              <th
                onClick={() => handleSort('availability_rate')}
                className="p-3.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Availability
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredAndSorted.map((m) => {
              const isSelected = selectedModelId === m.id || selectedModelId === m.model_identifier;
              const hasTools = m.tool_support ?? m.supports_tools ?? true;
              const hasStructured = m.structured_output_support ?? m.supports_structured_output ?? true;
              const avail = (m.availability_rate ?? 0.999) * 100;

              return (
                <tr
                  key={m.id}
                  onClick={() => onSelectModel?.(m)}
                  className={`
                    transition-colors cursor-pointer
                    ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/30'}
                  `}
                >
                  {/* Model */}
                  <td className="p-3.5">
                    <div className="font-bold text-foreground">{m.display_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{m.model_identifier}</div>
                  </td>

                  {/* Capabilities */}
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {m.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 rounded font-mono bg-secondary border border-border text-[10px] text-primary"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Context Window */}
                  <td className="p-3.5 font-mono text-foreground">
                    <span className="font-semibold">{Math.round(m.context_capacity / 1000).toLocaleString()}k</span>{' '}
                    <span className="text-muted-foreground text-[10px]">tokens</span>
                  </td>

                  {/* Cost */}
                  <td className="p-3.5 font-mono">
                    <span className="text-emerald-400 font-semibold">${m.input_cost_per_million.toFixed(2)}</span>
                    <span className="text-muted-foreground text-[10px]"> in</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-emerald-400 font-semibold">${m.output_cost_per_million.toFixed(2)}</span>
                    <span className="text-muted-foreground text-[10px]"> out</span>
                  </td>

                  {/* Latency */}
                  <td className="p-3.5 font-mono">
                    <span
                      className={`font-bold ${
                        m.avg_latency_ms < 350
                          ? 'text-emerald-400'
                          : m.avg_latency_ms < 600
                          ? 'text-amber-400'
                          : 'text-foreground'
                      }`}
                    >
                      {Math.round(m.avg_latency_ms)} ms
                    </span>
                  </td>

                  {/* Tools */}
                  <td className="p-3.5 text-center">
                    {hasTools ? (
                      <span className="inline-flex items-center text-emerald-400" title="Supported">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-muted-foreground/40" title="Not Supported">
                        <XCircle className="h-4 w-4" />
                      </span>
                    )}
                  </td>

                  {/* Structured Output */}
                  <td className="p-3.5 text-center">
                    {hasStructured ? (
                      <span className="inline-flex items-center text-emerald-400" title="Supported">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-muted-foreground/40" title="Not Supported">
                        <XCircle className="h-4 w-4" />
                      </span>
                    )}
                  </td>

                  {/* Privacy Classification */}
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                        m.privacy_classification === 'ON_PREMISE_ZERO_RETENTION'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-secondary text-muted-foreground border border-border'
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {m.privacy_classification}
                    </span>
                  </td>

                  {/* Availability */}
                  <td className="p-3.5 font-mono">
                    <span className="font-bold text-cyan-400">{avail.toFixed(1)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSorted.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-xs">
          No models matched the search query or active filter criteria.
        </div>
      )}
    </div>
  );
}
