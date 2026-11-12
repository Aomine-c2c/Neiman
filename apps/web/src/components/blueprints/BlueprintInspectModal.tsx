'use client';

import { useState, useEffect } from 'react';
import {
  Layers,
  Sliders,
  Check,
  X,
  Building2,
  Bot,
  Lock,
  Crosshair,
  Download,
  Play,
} from 'lucide-react';
import { CompanyBlueprint, CompanyBlueprintUpdate } from '@/lib/api/blueprints';

const AUTONOMY_LEVELS = [
  { level: 0, label: 'L0: Observe' },
  { level: 1, label: 'L1: Recommend' },
  { level: 2, label: 'L2: With Approval' },
  { level: 3, label: 'L3: Policy Constrained' },
  { level: 4, label: 'L4: Autonomous' },
  { level: 5, label: 'L5: Adaptive' },
];

interface BlueprintInspectModalProps {
  blueprint: CompanyBlueprint | null;
  onClose: () => void;
  onInstantiate: (blueprint: CompanyBlueprint) => void;
  onExport: (blueprint: CompanyBlueprint) => void;
  onUpdate: (blueprintId: string, data: CompanyBlueprintUpdate) => Promise<void>;
  isUpdating?: boolean;
}

export function BlueprintInspectModal({
  blueprint,
  onClose,
  onInstantiate,
  onExport,
  onUpdate,
  isUpdating = false,
}: BlueprintInspectModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editAutonomy, setEditAutonomy] = useState(3);

  useEffect(() => {
    if (blueprint) {
      setEditName(blueprint.name || '');
      setEditMission(blueprint.company_definition?.mission || blueprint.tagline || '');
      setEditAutonomy(blueprint.default_autonomy || 3);
      setIsEditing(false);
    }
  }, [blueprint]);

  if (!blueprint) return null;

  const handleSave = async () => {
    await onUpdate(blueprint.id, {
      name: editName,
      company_definition: {
        ...blueprint.company_definition,
        mission: editMission,
      },
      default_autonomy: editAutonomy,
    });
    setIsEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-lg">{blueprint.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-secondary font-mono text-muted-foreground border border-border">
                  v{blueprint.version}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{blueprint.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn btn-outline btn-xs gap-1.5"
              >
                <Sliders className="h-3.5 w-3.5" />
                Customize Blueprint
              </button>
            ) : (
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleSave}
                className="btn btn-primary btn-xs gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {isUpdating ? 'Saving...' : 'Save Customizations'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Customization Edit Fields (if editing) */}
        {isEditing && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3 font-mono text-xs">
            <div className="text-xs font-bold text-primary uppercase font-sans tracking-wider">
              Customizing Blueprint Before Activation
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted-foreground mb-1 font-sans">Blueprint Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-sans">
                  Default Autonomy (Level 0-5)
                </label>
                <select
                  value={editAutonomy}
                  onChange={(e) => setEditAutonomy(Number(e.target.value))}
                  className="input w-full text-xs"
                >
                  {AUTONOMY_LEVELS.map((al) => (
                    <option key={al.level} value={al.level}>
                      {al.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-muted-foreground mb-1 font-sans">Company Mission</label>
              <textarea
                rows={2}
                value={editMission}
                onChange={(e) => setEditMission(e.target.value)}
                className="input w-full text-xs h-auto resize-none"
              />
            </div>
          </div>
        )}

        {/* Blueprint Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Departments */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-indigo-400" />
              Departments ({blueprint.departments?.length || 0})
            </h4>
            <div className="space-y-2">
              {blueprint.departments?.map((dept, i) => (
                <div key={i} className="p-3 rounded-xl bg-secondary/20 border border-border">
                  <div className="text-xs font-semibold text-foreground">{dept.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{dept.purpose}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Agents */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-primary" />
              Configured Autonomous Agents ({blueprint.agents?.length || 0})
            </h4>
            <div className="space-y-2">
              {blueprint.agents?.map((agent, i) => (
                <div key={i} className="p-3 rounded-xl bg-secondary/20 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{agent.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      L{agent.autonomy_level}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    {agent.role_title} ({agent.department_name})
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {agent.system_instructions}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Constitution & Governance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-rose-400" />
              Constitution & Prohibited Actions
            </h4>
            <div className="p-3.5 rounded-xl bg-secondary/20 border border-border space-y-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-bold">Values</span>
                <div className="flex flex-wrap gap-1 mt-1 font-sans">
                  {blueprint.constitution?.values?.map((v, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-bold">
                  Prohibited Actions
                </span>
                <ul className="list-disc list-inside text-[11px] text-rose-300/90 mt-1 space-y-0.5 font-sans">
                  {blueprint.constitution?.prohibited_actions?.map((pa, i) => (
                    <li key={i}>{pa}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* KPIs & Approval Rules */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
              <Crosshair className="h-4 w-4 text-emerald-400" />
              Target KPIs & Approval Gates
            </h4>
            <div className="p-3.5 rounded-xl bg-secondary/20 border border-border space-y-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-bold">
                  Key Performance Indicators
                </span>
                <div className="space-y-1 mt-1 font-sans">
                  {blueprint.kpis?.map((kpi, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-foreground">{kpi.metric}</span>
                      <span className="font-mono text-emerald-400">{kpi.target}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-bold">Approval Gates</span>
                <div className="space-y-1 mt-1 font-sans">
                  {blueprint.approval_rules?.map((rule, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-foreground">{rule.operation}</span>
                      <span className="font-mono text-amber-400">{rule.risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => onExport(blueprint)}
            className="btn btn-outline text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export Specification
          </button>

          <button
            type="button"
            onClick={() => {
              onInstantiate(blueprint);
              onClose();
            }}
            className="btn btn-primary text-xs gap-2"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Instantiate Blueprint
          </button>
        </div>
      </div>
    </div>
  );
}
