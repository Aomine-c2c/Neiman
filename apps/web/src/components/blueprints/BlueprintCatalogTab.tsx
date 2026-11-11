'use client';

import {
  Layers,
  Sparkles,
  Search,
  Filter,
  Eye,
  Copy,
  Download,
  Play,
  Sliders,
  RotateCw,
} from 'lucide-react';
import { CompanyBlueprint } from '@/lib/api/blueprints';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Technology: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  'Finance & Capital': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Marketing & Creative': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Media & Entertainment': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  'Information Security': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  'Science & Academia': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Commerce & Retail': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Gaming & Interactive': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  'Infrastructure & Support': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Education & Training': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
  'Heavy Industry & Mining': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
};

interface BlueprintCatalogTabProps {
  blueprints: CompanyBlueprint[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  isInstantiating: boolean;
  onQuickLaunch: (bpKey: string, companyName: string) => void;
  onCustomizeLaunch: (bp: CompanyBlueprint) => void;
  onInspect: (bp: CompanyBlueprint) => void;
  onDuplicate: (id: string) => void;
  onExport: (bp: CompanyBlueprint) => void;
}

export function BlueprintCatalogTab({
  blueprints,
  isLoading,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  isInstantiating,
  onQuickLaunch,
  onCustomizeLaunch,
  onInspect,
  onDuplicate,
  onExport,
}: BlueprintCatalogTabProps) {
  const softwareBlueprints = blueprints.filter(
    (bp) => bp.key === 'software_development_company' || bp.category === 'Technology' || !bp.is_system_template
  );
  const softwareBlueprint = blueprints.find((bp) => bp.key === 'software_development_company');
  const categories = ['ALL', ...Array.from(new Set(softwareBlueprints.map((b) => b.category)))];
  const filteredBlueprints = softwareBlueprints.filter((bp) => {
    const matchesCategory = selectedCategory === 'ALL' || bp.category === selectedCategory;
    const matchesQuery =
      bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.metadata_tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Blueprint overview */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-secondary/30 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
              Blueprint preview
            </span>
            <h2 className="text-base font-bold text-foreground mt-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Create from a company blueprint
            </h2>
            <p className="text-xs text-muted-foreground">
              Blueprints define records and starting plans. Provider access, repository access, tests, and task execution are configured separately.
            </p>
          </div>
        </div>

        <div className="pt-1">
          {/* Software Company Hero Card */}
          <div className="p-5 rounded-xl border border-indigo-500/40 bg-card/90 hover:bg-card transition-all flex flex-col justify-between space-y-4 shadow-sm">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                    SOFTWARE DEVELOPMENT COMPANY
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{softwareBlueprint?.name || 'Loading blueprint…'}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/80 text-foreground border border-border">
                  {softwareBlueprint?.agents.length ?? '—'} Agent Profiles &bull; {softwareBlueprint?.departments.length ?? '—'} Departments &bull; Supervisor Paused
                </span>
              </div>
              <h3 className="font-bold text-base text-foreground mt-2">
                Software development company
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                Creates the agent and department records defined by this blueprint. It does not provision people, verify provider credentials, or report completed engineering work.
              </p>
            </div>

            {/* Blueprint agent profiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 border-t border-border/60">
              {(softwareBlueprint?.agents ?? []).map((agent) => (
                <div key={`${agent.name}-${agent.role_title}`} className="rounded-lg bg-secondary/30 border border-border/50 p-2 text-left">
                  <p className="text-[11px] font-semibold text-foreground truncate">{agent.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{agent.role_title}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-muted-foreground font-mono">
                Task execution remains paused until an operator starts the supervisor.
              </span>
              <button
                type="button"
                disabled={!softwareBlueprint || isInstantiating}
                onClick={() => softwareBlueprint && onCustomizeLaunch(softwareBlueprint)}
                className="flex items-center justify-center gap-2 py-2 px-5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
              >
                {isInstantiating ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                Review & Create Company
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-NEIMAN-surface/60 border border-border p-3.5 rounded-xl">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search blueprints by name, tech stack, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/40 border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mr-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Blueprints */}
      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
          <RotateCw className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm">Loading NEIMAN blueprint catalog...</p>
        </div>
      ) : filteredBlueprints.length === 0 ? (
        <div className="p-12 text-center bg-NEIMAN-surface border border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No blueprints match your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredBlueprints.map((bp) => {
            const catStyle = CATEGORY_COLORS[bp.category] || {
              bg: 'bg-secondary/40',
              text: 'text-foreground',
              border: 'border-border',
            };
            return (
              <div
                key={bp.id}
                className="flex flex-col justify-between bg-NEIMAN-surface border border-border/80 hover:border-primary/50 transition-all rounded-xl p-5 shadow-sm hover:shadow-md group"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm leading-tight group-hover:text-primary transition-colors">
                          {bp.name}
                        </h3>
                        <span
                          className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {bp.category}
                        </span>
                      </div>
                    </div>

                    {/* Autonomy Badge */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-secondary/80 text-foreground border border-border">
                        L{bp.default_autonomy} Autonomy
                      </span>
                    </div>
                  </div>

                  {/* Tagline & Description */}
                  <p className="text-xs font-medium text-foreground/90 line-clamp-1 mb-1.5">{bp.tagline}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    {bp.description}
                  </p>

                  {/* Key Stats Bar */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-secondary/30 border border-border/50 mb-4 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-mono">Depts</div>
                      <div className="text-xs font-semibold text-foreground">{bp.departments?.length || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-mono">Agents</div>
                      <div className="text-xs font-semibold text-foreground">{bp.agents?.length || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-mono">Workflows</div>
                      <div className="text-xs font-semibold text-foreground">{bp.workflows?.length || 0}</div>
                    </div>
                  </div>

                  {/* Tags */}
                  {bp.metadata_tags && bp.metadata_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {bp.metadata_tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onInspect(bp)}
                      title="Inspect and Customize"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDuplicate(bp.id)}
                      title="Duplicate Blueprint"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onExport(bp)}
                      title="Export JSON Specification"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isInstantiating}
                      onClick={() => onQuickLaunch(bp.key || bp.id, bp.company_definition?.name || bp.name)}
                      title="Create company records with blueprint defaults"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Quick Create
                    </button>
                    <button
                      onClick={() => onCustomizeLaunch(bp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      Customize
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
