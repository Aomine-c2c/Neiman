'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Check,
  RotateCcw,
  Sliders,
  Sparkles,
  Plus,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Pin,
  Save,
  X,
  Shield,
  Code2,
  Briefcase,
  Settings,
  Layers,
} from 'lucide-react';

export type RoleLayoutPreset =
  | 'COMMAND'
  | 'ENGINEERING'
  | 'EXECUTIVE'
  | 'FOUNDER'
  | 'SECURITY'
  | 'OPERATIONS'
  | 'CUSTOM';

export interface PanelVisibility {
  workforce: boolean;
  activity: boolean;
  executiveGate: boolean;
  systemHealth: boolean;
  intelligence: boolean;
  evolution: boolean;
  timeline: boolean;
  workflowExecution?: boolean;
}

export interface LayoutSettings {
  preset: RoleLayoutPreset;
  density: 'compact' | 'expanded';
  animationIntensity: 'cinematic' | 'subtle' | 'reduced';
  panelVisibility: PanelVisibility;
  minimizedPanels: Record<string, boolean>;
  pinnedPanels: Record<string, boolean>;
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  preset: 'COMMAND',
  density: 'compact',
  animationIntensity: 'cinematic',
  panelVisibility: {
    workforce: true,
    activity: true,
    executiveGate: true,
    systemHealth: true,
    intelligence: true,
    evolution: false,
    timeline: true,
  },
  minimizedPanels: {},
  pinnedPanels: {
    workforce: true,
    executiveGate: true,
  },
};

export const ROLE_PRESETS: Record<
  Exclude<RoleLayoutPreset, 'CUSTOM'>,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string; visibility: PanelVisibility }
> = {
  COMMAND: {
    label: 'Command',
    icon: Briefcase,
    description: 'Balanced view for overall organizational operations and central Cognitive Core topology',
    visibility: {
      workforce: true,
      activity: true,
      executiveGate: true,
      systemHealth: true,
      intelligence: true,
      evolution: false,
      timeline: true,
    },
  },
  ENGINEERING: {
    label: 'Engineering',
    icon: Code2,
    description: 'Execution graphs, agents, logs, model routing, and technical diagnostics',
    visibility: {
      workforce: true,
      activity: true,
      executiveGate: false,
      systemHealth: false,
      intelligence: true,
      evolution: true,
      timeline: true,
    },
  },
  EXECUTIVE: {
    label: 'Executive',
    icon: Shield,
    description: 'Organizational health, resource allocation, approvals, performance, and evolution proposals',
    visibility: {
      workforce: false,
      activity: false,
      executiveGate: true,
      systemHealth: true,
      intelligence: false,
      evolution: true,
      timeline: true,
    },
  },
  FOUNDER: {
    label: 'Founder & Executive',
    icon: Briefcase,
    description: 'Executive Gate sign-offs, workforce capability, high-level FinOps, and core organization topology',
    visibility: {
      workforce: true,
      activity: false,
      executiveGate: true,
      systemHealth: true,
      intelligence: true,
      evolution: false,
      timeline: true,
    },
  },
  SECURITY: {
    label: 'Security & Sentinel',
    icon: Shield,
    description: 'Executive approvals, perimeter incident telemetry, hardware isolation, and threat defense',
    visibility: {
      workforce: false,
      activity: true,
      executiveGate: true,
      systemHealth: true,
      intelligence: false,
      evolution: false,
      timeline: true,
    },
  },
  OPERATIONS: {
    label: 'Operations & FinOps',
    icon: Settings,
    description: 'Compute resource allocation, financial burn rate, intelligence provider SLAs, and evolution proposals',
    visibility: {
      workforce: true,
      activity: false,
      executiveGate: true,
      systemHealth: true,
      intelligence: true,
      evolution: true,
      timeline: true,
    },
  },
};

interface CanvasLayoutManagerProps {
  isEditing: boolean;
  onToggleEditing: () => void;
  layout: LayoutSettings;
  onChangeLayout: (newLayout: LayoutSettings) => void;
}

export function CanvasLayoutManager({
  isEditing,
  onToggleEditing,
  layout,
  onChangeLayout,
}: CanvasLayoutManagerProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const applyPreset = (presetKey: Exclude<RoleLayoutPreset, 'CUSTOM'>) => {
    const preset = ROLE_PRESETS[presetKey];
    onChangeLayout({
      ...layout,
      preset: presetKey,
      panelVisibility: { ...preset.visibility },
    });
  };

  const togglePanelVisibility = (panelKey: keyof PanelVisibility) => {
    onChangeLayout({
      ...layout,
      preset: 'CUSTOM',
      panelVisibility: {
        ...layout.panelVisibility,
        [panelKey]: !layout.panelVisibility[panelKey],
      },
    });
  };

  const restoreDefaults = () => {
    onChangeLayout(DEFAULT_LAYOUT);
  };

  if (!isEditing) {
    return null;
  }

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-5xl rounded-2xl border-2 border-primary/50 bg-card/95 text-card-foreground backdrop-blur-2xl p-4 shadow-2xl font-mono text-xs animate-slide-down select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full bg-primary animate-ping" />
          <span className="font-bold text-primary text-sm uppercase tracking-widest">
            LAYOUT CONFIGURATION DECK // OPERATING CANVAS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={restoreDefaults}
            className="px-2.5 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={onToggleEditing}
            className="px-4 py-1.5 rounded-lg border border-primary bg-primary text-primary-foreground font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save & Exit Edit Mode</span>
          </button>
        </div>
      </div>

      {/* Preset Role Selectors */}
      <div className="space-y-2 mb-4">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
          1. Role-Based Preset Topologies
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.entries(ROLE_PRESETS) as Array<[Exclude<RoleLayoutPreset, 'CUSTOM'>, typeof ROLE_PRESETS[keyof typeof ROLE_PRESETS]]>).map(
            ([key, p]) => {
              const Icon = p.icon;
              const isSelected = layout.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/15 shadow-sm'
                      : 'border-border bg-secondary/40 hover:border-primary/40 hover:bg-secondary/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <div className="font-bold text-foreground text-xs">{p.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-1 line-clamp-2">
                    {p.description}
                  </div>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Widget Visibility Toggles */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            2. Operational Panel Docking & Widgets
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-2.5 py-1 rounded bg-secondary border border-primary/40 text-[10px] text-primary font-semibold hover:bg-primary/15 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>Add Widget / Panel</span>
            </button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-border bg-card p-2 shadow-2xl z-50 space-y-1">
                {(Object.keys(layout.panelVisibility) as Array<keyof PanelVisibility>).map((panelKey) => {
                  const isVisible = layout.panelVisibility[panelKey];
                  return (
                    <button
                      key={panelKey}
                      type="button"
                      onClick={() => {
                        togglePanelVisibility(panelKey);
                        setShowAddMenu(false);
                      }}
                      className="w-full flex items-center justify-between p-1.5 rounded hover:bg-secondary text-left text-[10px]"
                    >
                      <span className="uppercase text-foreground font-mono">{panelKey}</span>
                      {isVisible ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">Active</span>
                      ) : (
                        <span className="text-primary text-[9px] font-bold">+ Add</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.entries(layout.panelVisibility) as Array<[keyof PanelVisibility, boolean]>).map(
            ([panelKey, isVisible]) => (
              <button
                key={panelKey}
                type="button"
                onClick={() => togglePanelVisibility(panelKey)}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${
                  isVisible
                    ? 'border-primary/60 bg-primary/15 text-primary font-bold'
                    : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {isVisible ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3" />}
                <span>{panelKey}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Density & Animation Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border text-[10px]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border">
          <span className="text-muted-foreground uppercase">Canvas Information Density</span>
          <div className="flex items-center gap-1">
            {(['compact', 'expanded'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChangeLayout({ ...layout, density: d })}
                className={`px-2.5 py-1 rounded uppercase text-[9px] font-bold ${
                  layout.density === d
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border">
          <span className="text-muted-foreground uppercase">Animation Intensity</span>
          <div className="flex items-center gap-1">
            {(['cinematic', 'subtle', 'reduced'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onChangeLayout({ ...layout, animationIntensity: a })}
                className={`px-2 py-1 rounded uppercase text-[9px] font-bold ${
                  layout.animationIntensity === a
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
