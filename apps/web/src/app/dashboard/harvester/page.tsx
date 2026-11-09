'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Globe,
  Search,
  Github,
  BookOpen,
  Newspaper,
  Compass,
  FileText,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { useOrganizationContext } from '@/lib/organizationContext';
import { harvesterApi, HarvestPlatform, HarvestResponse, GatheredItem } from '@/lib/api/harvester';
import { ApiError } from '@/lib/api/client';

const PLATFORMS: Array<{
  id: HarvestPlatform;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaultTarget: string;
  placeholder: string;
  modes?: Array<{ id: string; label: string }>;
}> = [
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo Web',
    description: 'Instant zero-click web discovery & HTML search results without paid search API subscriptions.',
    icon: Search,
    color: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    defaultTarget: 'FastAPI performance benchmarks vs Node.js',
    placeholder: 'e.g. LLM context token compression algorithms',
  },
  {
    id: 'github',
    name: 'GitHub Public',
    description: 'Scrape public repositories, README documentation, commit history, and releases.',
    icon: Github,
    color: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
    defaultTarget: 'fastapi/fastapi',
    placeholder: 'e.g. vllm-project/vllm or search keywords',
    modes: [
      { id: 'search_repos', label: 'Search Repositories' },
      { id: 'readme', label: 'Fetch Raw README.md' },
    ],
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    description: 'Real-time trending stories, Ask/Show HN discussions, and tech industry signals via public Firebase.',
    icon: Newspaper,
    color: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
    defaultTarget: 'top',
    placeholder: 'Mode selector',
    modes: [
      { id: 'top', label: 'Top Stories' },
      { id: 'new', label: 'Newest Submissions' },
      { id: 'ask', label: 'Ask HN Discussions' },
      { id: 'show', label: 'Show HN Projects' },
    ],
  },
  {
    id: 'reddit',
    name: 'Reddit Discussions',
    description: 'Gather public threads, community sentiment, and upvoted technical discourse via native JSON.',
    icon: Compass,
    color: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    defaultTarget: 'LocalLLaMA',
    placeholder: 'e.g. LocalLLaMA, programming, MachineLearning',
    modes: [
      { id: 'hot', label: 'Hot Threads' },
      { id: 'top', label: 'Top Voted' },
      { id: 'new', label: 'Newest' },
    ],
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia Concepts',
    description: 'Extract encyclopedia summaries, factual entities, infobox parameters, and canonical knowledge.',
    icon: BookOpen,
    color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    defaultTarget: 'Artificial neural network',
    placeholder: 'e.g. Zero-knowledge proof, Vector database',
  },
  {
    id: 'web_page',
    name: 'Generic Web Scraper',
    description: 'Autonomous HTML-to-Markdown scraper: strips bloat/ads/scripts and isolates clean text for LLMs.',
    icon: FileText,
    color: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    defaultTarget: 'https://news.ycombinator.com',
    placeholder: 'https://example.com/blog/article',
  },
];

export default function WebHarvesterPage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';

  const [selectedPlatform, setSelectedPlatform] = useState<HarvestPlatform>('duckduckgo');
  const [targetInput, setTargetInput] = useState('FastAPI performance benchmarks vs Node.js');
  const [selectedMode, setSelectedMode] = useState<string>('search_repos');
  const [limit, setLimit] = useState<number>(5);

  const [copiedSummary, setCopiedSummary] = useState(false);
  const [harvestResult, setHarvestResult] = useState<HarvestResponse | null>(null);

  const activePlatformConfig = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  const harvestMutation = useMutation({
    mutationFn: () =>
      harvesterApi.gather(companyId, {
        platform: selectedPlatform,
        query_or_target: targetInput,
        mode: selectedMode,
        limit,
      }),
    onSuccess: (data) => {
      setHarvestResult(data);
    },
  });

  const handleSelectPlatform = (platform: (typeof PLATFORMS)[0]) => {
    setSelectedPlatform(platform.id);
    setTargetInput(platform.defaultTarget);
    if (platform.modes && platform.modes.length > 0) {
      setSelectedMode(platform.modes[0].id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Open Web Harvester</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Zero Paid APIs
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gathers public web intelligence from DuckDuckGo, GitHub, Reddit, Hacker News, Wikipedia, and raw HTML pages
            with sandboxed egress and markdown compression for AI agents.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border bg-card">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-muted-foreground">SSRF Shield:</span>
            <span className="text-emerald-400 font-bold">Enforced</span>
          </div>
        </div>
      </div>

      {/* 2. PLATFORM CARDS SELECTOR */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {PLATFORMS.map((plat) => {
          const isSelected = selectedPlatform === plat.id;
          const Icon = plat.icon;
          return (
            <button
              key={plat.id}
              type="button"
              onClick={() => handleSelectPlatform(plat)}
              className={`flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
                  : 'border-border bg-card hover:border-border/80 hover:bg-card/80'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`p-1.5 rounded-lg border ${plat.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <h3 className="text-xs font-bold text-foreground mt-2">{plat.name}</h3>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                  {plat.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. DISPATCH COCKPIT & RESULT VIEWER */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Input Directives Console */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Harvester Query Controller
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-primary border border-border">
                {activePlatformConfig.name}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Target Query, Subreddit, Repo, or URL
                </label>
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder={activePlatformConfig.placeholder}
                  className="input text-xs w-full"
                />
              </div>

              {activePlatformConfig.modes && activePlatformConfig.modes.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Harvesting Mode / Feed Filter
                  </label>
                  <select
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value)}
                    className="input text-xs w-full"
                  >
                    {activePlatformConfig.modes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Items Limit ({limit})
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <button
                type="button"
                disabled={harvestMutation.isPending || !targetInput.trim()}
                onClick={() => harvestMutation.mutate()}
                className="btn btn-primary w-full gap-2 text-xs py-2.5 mt-2"
              >
                {harvestMutation.isPending ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    Harvesting Free Intelligence...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Gather Data from {activePlatformConfig.name}
                  </>
                )}
              </button>

              {harvestMutation.error && (
                <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {harvestMutation.error instanceof ApiError
                      ? harvestMutation.error.message
                      : 'Failed to harvest platform data.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Platform Examples Tip */}
          <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Zero-API Architecture Directives
            </span>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>GitHub:</strong> Consumes public REST and raw.githubusercontent mirrors.</li>
              <li><strong>Reddit:</strong> Queries public JSON views without developer credentials.</li>
              <li><strong>Hacker News:</strong> Uses the free Firebase official real-time endpoint.</li>
              <li><strong>DuckDuckGo:</strong> Scrapes HTML Lite gateway with zero search API charges.</li>
              <li><strong>Wikipedia:</strong> Direct access to the Wikimedia REST summary API.</li>
            </ul>
          </div>
        </div>

        {/* Right: Live Gathered Intelligence Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl border border-border bg-card flex flex-col min-h-[500px] justify-between">
            <div>
              {/* Telemetry Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-border pb-3 mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Gathered Intelligence Stream
                  </h3>
                </div>

                {harvestResult && (
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      {harvestResult.total_items} ITEMS • {harvestResult.duration_ms.toFixed(0)}ms
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(harvestResult.markdown_summary);
                        setCopiedSummary(true);
                        setTimeout(() => setCopiedSummary(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-secondary hover:text-foreground text-muted-foreground"
                    >
                      {copiedSummary ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedSummary ? 'Copied' : 'Copy MD'}
                    </button>
                  </div>
                )}
              </div>

              {/* Body */}
              {!harvestResult ? (
                <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
                  <Globe className="h-10 w-10 mb-3 opacity-30 animate-pulse" />
                  <p className="text-xs font-semibold text-foreground">No platform query executed yet</p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                    Select a platform on the left and trigger a harvest mission to gather real-time data without paid APIs.
                  </p>
                </div>
              ) : harvestResult.items.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-xs font-mono">
                  No public results returned for &quot;{harvestResult.query_or_target}&quot;.
                </div>
              ) : (
                <div className="space-y-3">
                  {harvestResult.items.map((it) => (
                    <div
                      key={it.id || it.url}
                      className="p-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-primary/40 transition-colors space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          {it.title || it.url}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                        {it.score_or_metric !== null && it.score_or_metric !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-primary border border-border shrink-0">
                            ★ {it.score_or_metric}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {it.snippet}
                      </p>

                      <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                        <span>Source: {it.author_or_source || harvestResult.platform}</span>
                        {it.metadata && Object.keys(it.metadata).length > 0 && (
                          <span>
                            {Object.entries(it.metadata)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([k, v]) => `${k}: ${v}`)
                              .slice(0, 3)
                              .join(' • ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Markdown Summary Preview for Agent Contexts */}
            {harvestResult && harvestResult.markdown_summary && (
              <div className="mt-4 pt-3 border-t border-border">
                <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold block mb-1">
                  Synthesized Agent Context Prompt:
                </span>
                <pre className="p-2.5 rounded-lg bg-black/40 border border-border text-[10px] font-mono text-muted-foreground max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {harvestResult.markdown_summary}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
