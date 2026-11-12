'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Layers,
  Network,
  GitFork,
  Zap,
  Cpu,
  Database,
  Sparkles,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Radio,
} from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { Department } from '@/lib/api/organizations';
import type {
  Task,
  Project,
  ApprovalRequest,
  ResourceSummary,
  MemoryItem,
  ModelProviderInfo,
} from '@/lib/api/controlRoom';
import type { OrganizationalAdaptation } from '@/lib/api/evolution';
import type { ActivityEvent } from '@neiman/events';

export type CognitiveCoreMode =
  | 'TOPOLOGY'
  | 'COLLABORATION'
  | 'WORKFLOW'
  | 'ROUTING'
  | 'RESOURCE_FLOW'
  | 'MEMORY_GRAPH'
  | 'EVOLUTION';

export interface CoreNode {
  id: string;
  name: string;
  code?: string;
  type: 'core' | 'department' | 'agent' | 'task' | 'model' | 'memory' | 'evolution';
  status: string;
  role?: string;
  autonomy?: string;
  assignedModel?: string;
  currentTask?: string;
  latency?: string;
  cost?: string;
  computePct?: number;
  colorHex: number;
  radius: number;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  pulsePhase: number;
  metadata?: Record<string, unknown>;
}

export interface CoreLink {
  sourceId: string;
  targetId: string;
  type: 'hierarchy' | 'collaboration' | 'data' | 'routing' | 'dependency';
  colorHex: number;
  curvature: number;
  activityLevel: number;
  dashed?: boolean;
}

interface ProjectedBadge {
  id: string;
  name: string;
  code?: string;
  subtitle?: string;
  status?: string;
  colorHex: number;
  x: number;
  y: number;
  visible: boolean;
  type: string;
}

interface CognitiveCoreProps {
  agents: Agent[];
  departments?: Department[];
  tasks: Task[];
  projects: Project[];
  approvals: ApprovalRequest[];
  resources: ResourceSummary;
  activity: ActivityEvent[];
  memories?: MemoryItem[];
  providers?: ModelProviderInfo[];
  evolutionProposals?: OrganizationalAdaptation[];
  isSimulated?: boolean;
  activeMode: CognitiveCoreMode;
  onModeChange: (mode: CognitiveCoreMode) => void;
  selectedNodeId?: string | null;
  onSelectNode: (node: CoreNode | null, screenPos?: { x: number; y: number }) => void;
  selectedLinkId?: string | null;
  onSelectLink?: (link: CoreLink | null) => void;
  timelineMinutes?: number;
  className?: string;
}

const MODES: Array<{ id: CognitiveCoreMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'TOPOLOGY', label: 'Topology', icon: Layers },
  { id: 'COLLABORATION', label: 'Collaboration', icon: Network },
  { id: 'WORKFLOW', label: 'Workflows', icon: GitFork },
  { id: 'ROUTING', label: 'Model Routing', icon: Zap },
  { id: 'RESOURCE_FLOW', label: 'Resource Flow', icon: Cpu },
  { id: 'MEMORY_GRAPH', label: 'Memory Graph', icon: Database },
  { id: 'EVOLUTION', label: 'Evolution', icon: Sparkles },
];

export function CognitiveCore({
  agents,
  departments = [],
  tasks,
  projects,
  approvals,
  resources,
  activity,
  memories = [],
  providers = [],
  evolutionProposals = [],
  isSimulated = false,
  activeMode,
  onModeChange,
  selectedNodeId,
  onSelectNode,
  onSelectLink,
  timelineMinutes = 0,
  className = '',
}: CognitiveCoreProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showHUDLabels, setShowHUDLabels] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<CoreNode | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [projectedBadges, setProjectedBadges] = useState<ProjectedBadge[]>([]);

  // Refs — keep Three.js state stable across renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesRef = useRef<Map<string, CoreNode>>(new Map());
  const linksRef = useRef<CoreLink[]>([]);
  const selectedIdRef = useRef<string | null>(selectedNodeId || null);
  const autoRotateRef = useRef(autoRotate);
  const showHUDLabelsRef = useRef(showHUDLabels);
  const rotRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Keep refs in sync with state/props without triggering re-renders
  selectedIdRef.current = selectedNodeId || null;
  autoRotateRef.current = autoRotate;
  showHUDLabelsRef.current = showHUDLabels;

  // ── Build reactive node universe per mode ──────────────────────────────────
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, CoreNode>();
    const linkList: CoreLink[] = [];

    // 1. NEIMAN Central Core (Always at origin, rendered by coreGroup)
    nodeMap.set('neiman-core', {
      id: 'neiman-core',
      name: 'NEIMAN COGNITIVE CORE',
      code: 'CORE',
      type: 'core',
      status: (isSimulated || agents.length > 0) ? 'AUTONOMOUS' : 'INITIALIZING',
      role: 'Organizational Singularity Hub',
      colorHex: 0x00f2fe,
      radius: 7.5,
      position: new THREE.Vector3(0, 0, 0),
      targetPosition: new THREE.Vector3(0, 0, 0),
      pulsePhase: 0,
      metadata: {
        isSimulated,
        gatewayCount: providers.length > 0 ? providers.filter((p) => p.status === 'ONLINE').length : (isSimulated ? 4 : 0),
      },
    });

    if (activeMode === 'TOPOLOGY') {
      const deptColors = [0x06b6d4, 0xf43f5e, 0xf59e0b, 0x10b981, 0x8b5cf6, 0xec4899, 0x3b82f6];
      // Both branches share one shape so `rawDept` is always addressable
      // (simulated departments simply have no backing record).
      const activeDepts: Array<{
        id: string;
        code: string;
        name: string;
        subtitle: string;
        color: number;
        angle: number;
        rawDept?: Department;
      }> = departments.length > 0
        ? departments.map((d, i) => {
            const deptAgents = agents.filter((a) => a.department_id === d.id);
            return {
              id: d.id,
              code: d.name.slice(0, 3).toUpperCase(),
              name: d.name,
              subtitle: `${deptAgents.length} AGENTS · ACTIVE`,
              color: deptColors[i % deptColors.length],
              angle: (Math.PI * 2 * i) / departments.length,
              rawDept: d,
            };
          })
        : (isSimulated
            ? [
                { id: 'dept-eng', code: 'ENG', name: 'Engineering & Architecture', subtitle: '4 AGENTS · 98% FIDELITY', color: 0x06b6d4, angle: 0 },
                { id: 'dept-sec', code: 'SEC', name: 'Security & Sentinel Ops', subtitle: 'RUNTIME GUARD · ACTIVE', color: 0xf43f5e, angle: (Math.PI * 2) / 5 },
                { id: 'dept-gov', code: 'GOV', name: 'Executive & Alignment', subtitle: 'POLICY CONSENSUS', color: 0xf59e0b, angle: ((Math.PI * 2) / 5) * 2 },
                { id: 'dept-ops', code: 'OPS', name: 'Autonomous Ops & Infra', subtitle: 'CGROUP BALANCED', color: 0x10b981, angle: ((Math.PI * 2) / 5) * 3 },
                { id: 'dept-intel', code: 'INT', name: 'Cognitive Intelligence', subtitle: 'DISTRIBUTED INFERENCE', color: 0x8b5cf6, angle: ((Math.PI * 2) / 5) * 4 },
              ]
            : []);

      const orbitRadius = 64;
      activeDepts.forEach((d) => {
        const x = Math.cos(d.angle) * orbitRadius;
        const y = Math.sin(d.angle) * orbitRadius * 0.32;
        const z = Math.sin(d.angle) * orbitRadius * 0.88;
        const v = new THREE.Vector3(x, y, z);

        const deptManagerId = d.rawDept?.manager_id;
        nodeMap.set(d.id, {
          id: d.id,
          code: d.code,
          name: d.name,
          role: d.subtitle,
          type: 'department',
          status: 'ACTIVE',
          colorHex: d.color,
          radius: 4.8,
          position: new THREE.Vector3(x, y, z),
          targetPosition: v,
          pulsePhase: Math.random() * Math.PI,
          metadata: {
            lead: deptManagerId ? `Lead ${deptManagerId.slice(0, 8)}` : (isSimulated ? 'Chief Architect (Atlas)' : 'Unassigned'),
            workforce: departments.length > 0
              ? `${agents.filter((a) => a.department_id === d.id).length} Active`
              : (isSimulated ? '4 Active / 2 Standby' : '0 Active'),
            computePct: isSimulated ? 45.0 : 0.0,
            projects: projects.filter((p) => p.status === 'ACTIVE').map((p) => `> ${p.name}`),
            isSimulated,
          },
        });

        linkList.push({
          sourceId: 'neiman-core',
          targetId: d.id,
          type: 'hierarchy',
          colorHex: d.color,
          curvature: 0.14,
          activityLevel: 0.85,
        });
      });

      // Workforce Swarm Agents clustered in secondary orbits around their departments
      agents.forEach((ag, idx) => {
        const total = Math.max(agents.length, 1);
        const theta = (idx / total) * Math.PI * 2;
        const outerOrbit = 106;
        const x = Math.cos(theta) * outerOrbit;
        const y = Math.sin(theta * 1.4) * 24;
        const z = Math.sin(theta) * outerOrbit;

        const isWorking = ag.status === 'WORKING' || ag.status === 'ACTIVE';
        const color = isWorking ? 0x10b981 : ag.status === 'BLOCKED' ? 0xf43f5e : 0x06b6d4;

        nodeMap.set(ag.id, {
          id: ag.id,
          code: ag.name.slice(0, 3).toUpperCase(),
          name: ag.name,
          type: 'agent',
          status: ag.status,
          role: ag.role_id ?? undefined,
          autonomy: ag.autonomy,
          currentTask: isWorking ? 'Executing distributed inference' : 'Listening on message bus',
          assignedModel: (typeof ag.intelligence_config?.model === 'string' && ag.intelligence_config.model) || (isSimulated ? 'Simulated Model' : 'Dynamic Router'),
          colorHex: color,
          radius: isWorking ? 2.8 : 2.3,
          position: new THREE.Vector3(x, y, z),
          targetPosition: new THREE.Vector3(x, y, z),
          pulsePhase: idx * 0.45,
          metadata: {
            isSimulated,
          },
        });

        const targetParent = activeDepts.length > 0
          ? (activeDepts.find((d) => d.id === ag.department_id)?.id || activeDepts[idx % activeDepts.length].id)
          : 'neiman-core';

        linkList.push({
          sourceId: targetParent,
          targetId: ag.id,
          type: 'hierarchy',
          colorHex: color,
          curvature: 0.18,
          activityLevel: isWorking ? 1 : 0.25,
        });
      });
    } else if (activeMode === 'COLLABORATION') {
      // Mesh Topology: spherical consensus constellation
      agents.forEach((ag, idx) => {
        const total = Math.max(agents.length, 1);
        const phi = Math.acos(-1 + (2 * idx) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;
        const r = 76 + (idx % 2 === 0 ? 12 : -8);
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta) * 0.75;
        const z = r * Math.cos(phi);

        const isWorking = ag.status === 'WORKING' || ag.status === 'ACTIVE';
        nodeMap.set(ag.id, {
          id: ag.id,
          code: ag.name.slice(0, 3).toUpperCase(),
          name: ag.name,
          type: 'agent',
          status: ag.status,
          role: ag.role_id ?? undefined,
          autonomy: ag.autonomy,
          currentTask: 'Dynamic consensus coordination',
          colorHex: isWorking ? 0x00f2fe : 0x8b5cf6,
          radius: 2.8,
          position: new THREE.Vector3(x, y, z),
          targetPosition: new THREE.Vector3(x, y, z),
          pulsePhase: Math.random() * Math.PI,
          metadata: {
            isSimulated,
          },
        });
      });

      const agentIds = Array.from(nodeMap.keys()).filter((k) => k !== 'neiman-core');
      for (let i = 0; i < agentIds.length; i++) {
        const next = agentIds[(i + 1) % agentIds.length];
        linkList.push({
          sourceId: agentIds[i],
          targetId: next,
          type: 'collaboration',
          colorHex: 0x00f2fe,
          curvature: 0.22,
          activityLevel: 0.9,
        });
        if (i % 2 === 0) {
          linkList.push({
            sourceId: 'neiman-core',
            targetId: agentIds[i],
            type: 'data',
            colorHex: 0x8b5cf6,
            curvature: 0.1,
            activityLevel: 0.7,
          });
        }
      }
    } else if (activeMode === 'WORKFLOW') {
      // Linear DAG Execution pipeline stages
      const stages = (isSimulated || tasks.length > 0)
        ? [
            { id: 'stg-0', code: 'STG-01', name: 'Ingestion & Triage', status: 'COMPLETED', color: 0x10b981 },
            { id: 'stg-1', code: 'STG-02', name: 'Reasoning & Planning', status: 'COMPLETED', color: 0x10b981 },
            { id: 'stg-2', code: 'STG-03', name: 'Verification & Gate', status: 'IN_PROGRESS', color: 0xf59e0b },
            { id: 'stg-3', code: 'STG-04', name: 'Synthesis & Generation', status: 'PENDING', color: 0x06b6d4 },
            { id: 'stg-4', code: 'STG-05', name: 'Commit & Distribution', status: 'PENDING', color: 0x64748b },
          ]
        : [];

      stages.forEach((stg, sIdx) => {
        const x = (sIdx - 2) * 52;
        nodeMap.set(stg.id, {
          id: stg.id,
          code: stg.code,
          name: stg.name,
          role: `Pipeline Stage ${sIdx + 1}`,
          type: 'task',
          status: stg.status,
          colorHex: stg.color,
          radius: 3.8,
          position: new THREE.Vector3(x, 14, 0),
          targetPosition: new THREE.Vector3(x, 14, 0),
          pulsePhase: sIdx * 0.8,
          metadata: {
            isSimulated,
          },
        });

        if (sIdx > 0) {
          linkList.push({
            sourceId: stages[sIdx - 1].id,
            targetId: stg.id,
            type: 'dependency',
            colorHex: stg.status === 'COMPLETED' ? 0x10b981 : 0x06b6d4,
            curvature: 0.04,
            activityLevel: sIdx <= 2 ? 1 : 0.35,
          });
        }
      });

      tasks.slice(0, 8).forEach((tsk, tIdx) => {
        const parentStage = stages.length > 0 ? stages[tIdx % stages.length].id : 'neiman-core';
        const pNode = nodeMap.get(parentStage);
        const baseX = pNode ? pNode.targetPosition.x : 0;
        const x = baseX + ((tIdx % 2 === 0 ? 1 : -1) * 14);
        const y = -28 - (tIdx % 3) * 10;
        const z = (Math.random() - 0.5) * 22;
        const isDone = tsk.status === 'COMPLETED';
        const isAct = tsk.status === 'IN_PROGRESS';

        nodeMap.set(tsk.id, {
          id: tsk.id,
          code: `TSK-${tIdx + 1}`,
          name: tsk.title,
          type: 'task',
          status: tsk.status,
          colorHex: isDone ? 0x10b981 : isAct ? 0xf59e0b : 0xf43f5e,
          radius: 2.6,
          position: new THREE.Vector3(x, y, z),
          targetPosition: new THREE.Vector3(x, y, z),
          pulsePhase: tIdx * 0.5,
          metadata: {
            isSimulated,
            description: tsk.description,
          },
        });

        linkList.push({
          sourceId: parentStage,
          targetId: tsk.id,
          type: 'dependency',
          colorHex: isAct ? 0xf59e0b : 0x06b6d4,
          curvature: 0.25,
          activityLevel: isAct ? 1 : 0.4,
        });
      });
    } else if (activeMode === 'ROUTING') {
      const routingPositions: Array<[number, number, number]> = [
        [-65, 22, 0],
        [65, 22, 0],
        [0, -55, 25],
        [0, 58, -25],
        [-45, -35, -20],
        [45, -35, 20],
      ];

      const activeProviders = providers.length > 0
        ? providers.map((p, idx) => ({
            id: p.id,
            code: p.name.slice(0, 6).toUpperCase(),
            name: p.name,
            subtitle: `${p.provider} · ${p.avg_latency_ms ? `${p.avg_latency_ms}ms` : (p.status === 'ONLINE' ? 'Active' : 'Offline')}`,
            color: p.status === 'ONLINE' ? 0x06b6d4 : p.status === 'DEGRADED' ? 0xf59e0b : 0xf43f5e,
            pos: routingPositions[idx % routingPositions.length],
            latency: p.avg_latency_ms ? `${p.avg_latency_ms}ms` : undefined,
            cost: p.cost_usd ? `$${p.cost_usd.toFixed(2)}/M` : undefined,
            status: p.status,
          }))
        : (isSimulated
            ? [
                { id: 'mod-claude', code: 'CLAUDE', name: 'Anthropic Claude 3.5 Sonnet', subtitle: '240ms · $3.00/M · TIER-1', color: 0x06b6d4, pos: [-65, 22, 0] as [number, number, number], latency: '240ms', cost: '$3.00/M', status: 'ONLINE' },
                { id: 'mod-gpt4o', code: 'GPT-4O', name: 'OpenAI GPT-4o Omni', subtitle: '190ms · $2.50/M · REASONING', color: 0x10b981, pos: [65, 22, 0] as [number, number, number], latency: '190ms', cost: '$2.50/M', status: 'ONLINE' },
                { id: 'mod-gemini', code: 'GEMINI', name: 'Google Gemini 1.5 Pro', subtitle: '310ms · $1.25/M · CONTEXT', color: 0x8b5cf6, pos: [0, -55, 25] as [number, number, number], latency: '310ms', cost: '$1.25/M', status: 'ONLINE' },
                { id: 'mod-deepseek', code: 'LOCAL', name: 'DeepSeek-R1 Local Air-Gapped', subtitle: '45ms · $0.00/M · AIR-GAPPED', color: 0xf59e0b, pos: [0, 58, -25] as [number, number, number], latency: '45ms', cost: '$0.00/M', status: 'ONLINE' },
              ]
            : []);

      activeProviders.forEach((m) => {
        nodeMap.set(m.id, {
          id: m.id,
          code: m.code,
          name: m.name,
          role: m.subtitle,
          type: 'model',
          status: m.status,
          latency: m.latency,
          cost: m.cost,
          colorHex: m.color,
          radius: 4.2,
          position: new THREE.Vector3(...m.pos),
          targetPosition: new THREE.Vector3(...m.pos),
          pulsePhase: Math.random() * Math.PI,
          metadata: {
            isSimulated,
            latency: m.latency,
            cost: m.cost,
          },
        });

        linkList.push({
          sourceId: 'neiman-core',
          targetId: m.id,
          type: 'routing',
          colorHex: m.color,
          curvature: 0.16,
          activityLevel: m.status === 'ONLINE' ? 1 : 0.3,
        });
      });

      if (activeProviders.length >= 2) {
        linkList.push({
          sourceId: activeProviders[0].id,
          targetId: activeProviders[1].id,
          type: 'routing',
          colorHex: 0x8b5cf6,
          curvature: 0.35,
          activityLevel: 0.5,
          dashed: true,
        });
      }
    } else if (activeMode === 'RESOURCE_FLOW') {
      const computeVal = resources.compute_used_pct ?? (isSimulated ? 38 : 0);
      const spentVal = resources.budget_spent_usd ?? (isSimulated ? 14200 : 0);
      const allocatedVal = resources.budget_allocated_usd ?? (isSimulated ? 50000 : 0);
      const tokensVal = resources.token_usage_total ?? (isSimulated ? 42800 : 0);

      const pools = [
        {
          id: 'res-compute',
          code: 'CGROUP',
          name: 'Compute Enclave CGroup',
          subtitle: `${computeVal}% CPU/VRAM Allocated`,
          color: 0x06b6d4,
          pos: [-64, -18, 0] as [number, number, number],
        },
        {
          id: 'res-capital',
          code: 'FINOPS',
          name: 'Capital Treasury Pool',
          subtitle: `$${(spentVal / 1000).toFixed(1)}k Spent / $${(allocatedVal / 1000).toFixed(0)}k Cap`,
          color: 0x10b981,
          pos: [64, -18, 0] as [number, number, number],
        },
        {
          id: 'res-tokens',
          code: 'TOKENS',
          name: 'Token Velocity Stream',
          subtitle: `${(tokensVal / 1000).toFixed(1)}k Ingested / s`,
          color: 0x8b5cf6,
          pos: [0, 55, 18] as [number, number, number],
        },
      ];

      pools.forEach((p) => {
        nodeMap.set(p.id, {
          id: p.id,
          code: p.code,
          name: p.name,
          role: p.subtitle,
          type: 'department',
          status: 'NOMINAL',
          colorHex: p.color,
          radius: 4.6,
          position: new THREE.Vector3(...p.pos),
          targetPosition: new THREE.Vector3(...p.pos),
          pulsePhase: 1,
          metadata: {
            isSimulated,
          },
        });

        linkList.push({
          sourceId: 'neiman-core',
          targetId: p.id,
          type: 'data',
          colorHex: p.color,
          curvature: 0.15,
          activityLevel: 1,
        });
      });
    } else if (activeMode === 'MEMORY_GRAPH') {
      const triples = memories.length > 0
        ? memories.map((mem, idx) => ({
            s: mem.domain,
            p: mem.scope || 'knowledge',
            o: mem.title,
            color: [0x06b6d4, 0x10b981, 0x8b5cf6, 0xf59e0b, 0xf43f5e][idx % 5],
            domain: mem.domain,
            code: mem.domain.slice(0, 4).toUpperCase(),
            rawMem: mem,
          }))
        : (isSimulated
            ? [
                { s: 'Architecture Council', p: 'enacted_adr', o: 'gRPC Microservices', color: 0x06b6d4, domain: 'ARCHITECTURE', code: 'ARCH' },
                { s: 'Security Sentinel', p: 'verified_boundary', o: 'Docker Sandbox', color: 0x10b981, domain: 'SECURITY', code: 'SEC' },
                { s: 'Chief Architect', p: 'assigned_task', o: 'Consensus Quorum', color: 0x8b5cf6, domain: 'PROJECT', code: 'EXEC' },
                { s: 'Intelligence Router', p: 'routed_fallback', o: 'DeepSeek Local', color: 0xf59e0b, domain: 'POLICY', code: 'ROUT' },
                { s: 'Governance Engine', p: 'ratified_policy', o: 'Zero-Trust Network', color: 0xf43f5e, domain: 'GOVERNANCE', code: 'GOV' },
              ]
            : []);

      triples.forEach((tr, i) => {
        const angle = (i / triples.length) * Math.PI * 2;
        const sId = `mem-s-${i}`;
        const oId = `mem-o-${i}`;
        const sx = Math.cos(angle) * 54;
        const sy = Math.sin(angle) * 18;
        const sz = Math.sin(angle) * 54;
        const ox = Math.cos(angle + 0.35) * 85;
        const oy = Math.sin(angle) * -22;
        const oz = Math.sin(angle + 0.35) * 85;

        nodeMap.set(sId, {
          id: sId,
          code: tr.code,
          name: tr.s,
          role: `${tr.domain} // SUBJECT`,
          type: 'memory',
          status: 'VERIFIED',
          colorHex: tr.color,
          radius: 3.2,
          position: new THREE.Vector3(sx, sy, sz),
          targetPosition: new THREE.Vector3(sx, sy, sz),
          pulsePhase: i,
          metadata: {
            domain: tr.domain,
            provenance: tr.p,
            isSimulated,
          },
        });

        nodeMap.set(oId, {
          id: oId,
          code: 'VEC',
          name: tr.o,
          role: `${tr.p} // OBJECT`,
          type: 'memory',
          status: tr.p,
          colorHex: 0x00f2fe,
          radius: 2.8,
          position: new THREE.Vector3(ox, oy, oz),
          targetPosition: new THREE.Vector3(ox, oy, oz),
          pulsePhase: i + 0.5,
          metadata: {
            domain: tr.domain,
            provenance: tr.p,
            isSimulated,
          },
        });

        linkList.push({
          sourceId: sId,
          targetId: oId,
          type: 'data',
          colorHex: tr.color,
          curvature: 0.2,
          activityLevel: 0.85,
        });
        linkList.push({
          sourceId: 'neiman-core',
          targetId: sId,
          type: 'data',
          colorHex: 0x38bdf8,
          curvature: 0.1,
          activityLevel: 0.5,
        });
      });
    } else if (activeMode === 'EVOLUTION') {
      const proposals = evolutionProposals.length > 0
        ? evolutionProposals.map((pr, idx) => ({
            id: pr.id,
            code: `EVO-${idx + 1}`,
            name: `${pr.adaptation_type}: ${pr.title.slice(0, 32)}`,
            subtitle: pr.expected_improvement || 'Pending Benchmarks',
            status: pr.status,
            color: (pr.status === 'APPROVED' || pr.status === 'DEPLOYED' || pr.status === 'SUCCESSFUL')
              ? 0x10b981
              : pr.status === 'REJECTED'
              ? 0xf43f5e
              : 0xf59e0b,
            angle: (Math.PI * 2 * idx) / evolutionProposals.length,
            fitnessDelta: pr.expected_improvement || undefined,
          }))
        : (isSimulated
            ? [
                { id: 'evo-1', code: 'ADR-42', name: 'ADR-42: Dynamic Cache Eviction', subtitle: '+34% Latency Reduction', status: 'CANDIDATE', color: 0xf59e0b, angle: 0, fitnessDelta: '+34%' },
                { id: 'evo-2', code: 'ADR-43', name: 'ADR-43: Local Token Compression', subtitle: '-22% API Capital Burn', status: 'VALIDATING', color: 0x10b981, angle: (Math.PI * 2) / 3, fitnessDelta: '-22%' },
                { id: 'evo-3', code: 'ADR-44', name: 'ADR-44: Autonomous Fallback Mesh', subtitle: 'Zero Downtime Failover', status: 'PROPOSED', color: 0x8b5cf6, angle: ((Math.PI * 2) / 3) * 2, fitnessDelta: '+100%' },
              ]
            : []);

      proposals.forEach((pr) => {
        const r = 68;
        const x = Math.cos(pr.angle) * r;
        const y = Math.sin(pr.angle * 2) * 22;
        const z = Math.sin(pr.angle) * r;

        nodeMap.set(pr.id, {
          id: pr.id,
          code: pr.code,
          name: pr.name,
          role: pr.subtitle,
          type: 'evolution',
          status: pr.status,
          colorHex: pr.color,
          radius: 3.8,
          position: new THREE.Vector3(x, y, z),
          targetPosition: new THREE.Vector3(x, y, z),
          pulsePhase: Math.random() * Math.PI,
          metadata: {
            isSimulated,
            fitnessDelta: pr.fitnessDelta,
          },
        });

        linkList.push({
          sourceId: 'neiman-core',
          targetId: pr.id,
          type: 'data',
          colorHex: pr.color,
          curvature: 0.28,
          activityLevel: 0.9,
        });
      });
    }

    return { nodes: nodeMap, links: linkList };
  }, [activeMode, agents, departments, tasks, projects, resources, memories, providers, evolutionProposals, isSimulated]);

  // Sync node map and links into refs each render (animation loop reads these)
  nodesRef.current = nodes;
  linksRef.current = links;

  // ── Three.js Scene — initialized ONCE ─────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // Scene with deep obsidian fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060b18, 0.0022);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 2000);
    camera.position.set(0, 32, 235);
    cameraRef.current = camera;

    // Renderer with ACES tone mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── LIGHTING SETUP ────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0a1226, 2.6);
    const corePointLight = new THREE.PointLight(0x00f2fe, 4.5, 450);
    corePointLight.position.set(0, 0, 0);
    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    keyLight.position.set(120, 160, 200);
    const fillLight = new THREE.DirectionalLight(0x818cf8, 1.4);
    fillLight.position.set(-120, -100, -150);
    scene.add(ambientLight, corePointLight, keyLight, fillLight);

    // ── Background Guides & Polar Orbit Planes ───────────────────────────────
    const guideGroup = new THREE.Group();
    scene.add(guideGroup);

    // Subtle Department Orbit Guide Ring (Radius 64)
    const deptOrbitGeom = new THREE.RingGeometry(63.7, 64.3, 96);
    const deptOrbitMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const deptOrbitMesh = new THREE.Mesh(deptOrbitGeom, deptOrbitMat);
    deptOrbitMesh.rotation.x = Math.PI / 2.3;
    guideGroup.add(deptOrbitMesh);

    // Subtle Outer Swarm Orbit Guide Ring (Radius 106)
    const agentOrbitGeom = new THREE.RingGeometry(105.7, 106.3, 128);
    const agentOrbitMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const agentOrbitMesh = new THREE.Mesh(agentOrbitGeom, agentOrbitMat);
    agentOrbitMesh.rotation.x = Math.PI / 2.3;
    guideGroup.add(agentOrbitMesh);

    // ── Drift Particle Field (1,200 floating cybernetic stellar points) ────────
    const dustCount = 1200;
    const dustGeom = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    const dustVel = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3]     = (Math.random() - 0.5) * 600;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 450;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 600;
      const speed = 0.03 + Math.random() * 0.04;
      const dir = Math.random() * Math.PI * 2;
      dustVel[i * 3]     = Math.cos(dir) * speed;
      dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
      dustVel[i * 3 + 2] = Math.sin(dir) * speed;
    }

    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 1.1,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
    });
    const dustPoints = new THREE.Points(dustGeom, dustMat);
    scene.add(dustPoints);

    // ── Accretion Disk Particles (Inward-swirling reactor particles) ───────────
    const ACCRETION_COUNT = 160;
    const accGeom = new THREE.BufferGeometry();
    const accPos = new Float32Array(ACCRETION_COUNT * 3);
    const accAngles = new Float32Array(ACCRETION_COUNT);
    const accRadii = new Float32Array(ACCRETION_COUNT);
    const accSpeeds = new Float32Array(ACCRETION_COUNT);

    for (let i = 0; i < ACCRETION_COUNT; i++) {
      accRadii[i] = 14 + Math.random() * 22;
      accAngles[i] = Math.random() * Math.PI * 2;
      accSpeeds[i] = 0.015 + Math.random() * 0.025;
      accPos[i * 3] = Math.cos(accAngles[i]) * accRadii[i];
      accPos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      accPos[i * 3 + 2] = Math.sin(accAngles[i]) * accRadii[i];
    }
    accGeom.setAttribute('position', new THREE.BufferAttribute(accPos, 3));
    const accMat = new THREE.PointsMaterial({
      size: 1.8,
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.75,
    });
    const accretionPoints = new THREE.Points(accGeom, accMat);

    // ── Scene Groups ──────────────────────────────────────────────────────────
    const coreGroup   = new THREE.Group();
    const nodesGroup  = new THREE.Group();
    const linksGroup  = new THREE.Group();
    const glowGroup   = new THREE.Group();
    const flowGroup   = new THREE.Group();
    scene.add(coreGroup, nodesGroup, linksGroup, glowGroup, flowGroup);
    coreGroup.add(accretionPoints);

    // ── NEIMAN Central Singularity Reactor ─────────────────────────────────────
    // 1. Singularity Core (Bright White-Hot Inner Sphere)
    const singularityGeom = new THREE.SphereGeometry(5.2, 32, 32);
    const singularityMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f2fe,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.9,
    });
    const singularityMesh = new THREE.Mesh(singularityGeom, singularityMat);
    coreGroup.add(singularityMesh);

    // 2. Quantum Lattice Cage (Cyan Wireframe Icosahedron)
    const latticeGeom = new THREE.IcosahedronGeometry(8.5, 1);
    const latticeMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const latticeMesh = new THREE.Mesh(latticeGeom, latticeMat);
    coreGroup.add(latticeMesh);

    // 3. Outer Geodesic Shield (Translucent Faceted Shell)
    const shieldGeom = new THREE.IcosahedronGeometry(11.8, 1);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
      roughness: 0.3,
    });
    const shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
    coreGroup.add(shieldMesh);

    // 4. Concentric Gyroscopic Gimbal Rings
    const makeGimbalRing = (r: number, tube: number, color: number, opacity: number) => {
      const g = new THREE.TorusGeometry(r, tube, 16, 96);
      const m = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.7,
        transparent: true,
        opacity,
      });
      return new THREE.Mesh(g, m);
    };

    const gimbalRing1 = makeGimbalRing(16.5, 0.25, 0x00f2fe, 0.75);
    gimbalRing1.rotation.x = Math.PI / 3;
    coreGroup.add(gimbalRing1);

    const gimbalRing2 = makeGimbalRing(22.5, 0.22, 0x8b5cf6, 0.55);
    gimbalRing2.rotation.y = Math.PI / 4;
    coreGroup.add(gimbalRing2);

    const gimbalRing3 = makeGimbalRing(28.5, 0.18, 0x06b6d4, 0.38);
    gimbalRing3.rotation.z = Math.PI / 6;
    coreGroup.add(gimbalRing3);

    // 5. Periodic Expanding Shockwave Ring
    const shockwaveGeom = new THREE.RingGeometry(5, 5.8, 64);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const shockwaveMesh = new THREE.Mesh(shockwaveGeom, shockwaveMat);
    shockwaveMesh.rotation.x = Math.PI / 2;
    coreGroup.add(shockwaveMesh);

    // ── Mouse / Drag Interaction ──────────────────────────────────────────────
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { isDragging = true; prevMouseX = e.clientX; prevMouseY = e.clientY; }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const rot = rotRef.current;

      if (isDragging) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        rot.targetY += dx * 0.005;
        rot.targetX += dy * 0.005;
        rot.targetX = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rot.targetX));
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }

      // Hover raycasting (screen-space projected radius check)
      const hitNodes: CoreNode[] = [];
      nodesRef.current.forEach((n) => {
        const nodeWorld = n.position.clone().applyEuler(new THREE.Euler(rot.x, rot.y, 0));
        const screenPos = nodeWorld.clone().project(camera);
        const sx = ((screenPos.x + 1) * rect.width) / 2;
        const sy = ((-screenPos.y + 1) * rect.height) / 2;
        if (Math.hypot(e.clientX - rect.left - sx, e.clientY - rect.top - sy) < n.radius * 2.8 + 10) {
          hitNodes.push(n);
        }
      });

      if (hitNodes.length > 0) {
        setHoveredNode(hitNodes[0]);
        setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredNode(null);
        setHoverPos(null);
        document.body.style.cursor = 'default';
      }
    };

    const onMouseUp = () => { isDragging = false; };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const rot = rotRef.current;
      let closest: CoreNode | null = null;
      let closestDist = 999;
      let closestScreenX = 0;
      let closestScreenY = 0;

      nodesRef.current.forEach((n) => {
        const nodeWorld = n.position.clone().applyEuler(new THREE.Euler(rot.x, rot.y, 0));
        const sp = nodeWorld.clone().project(camera);
        const sx = ((sp.x + 1) * rect.width) / 2;
        const sy = ((-sp.y + 1) * rect.height) / 2;
        const dist = Math.hypot(e.clientX - rect.left - sx, e.clientY - rect.top - sy);
        if (dist < n.radius * 2.8 + 12 && dist < closestDist) {
          closestDist = dist;
          closest = n;
          closestScreenX = rect.left + sx;
          closestScreenY = rect.top + sy;
        }
      });

      if (closest) {
        onSelectNode(closest, { x: closestScreenX, y: closestScreenY });
        onSelectLink?.(null);
      } else {
        // Raycast links
        let closestLink: CoreLink | null = null;
        let closestLinkDist = 999;
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        linksRef.current.forEach((l) => {
          const sNode = nodesRef.current.get(l.sourceId);
          const tNode = nodesRef.current.get(l.targetId);
          if (sNode && tNode) {
            const sWorld = sNode.position.clone().applyEuler(new THREE.Euler(rot.x, rot.y, 0));
            const tWorld = tNode.position.clone().applyEuler(new THREE.Euler(rot.x, rot.y, 0));
            const ss = sWorld.clone().project(camera);
            const ts = tWorld.clone().project(camera);
            const sx = ((ss.x + 1) * rect.width) / 2;
            const sy = ((-ss.y + 1) * rect.height) / 2;
            const tx = ((ts.x + 1) * rect.width) / 2;
            const ty = ((-ts.y + 1) * rect.height) / 2;
            const ddx = tx - sx;
            const ddy = ty - sy;
            const lenSq = ddx * ddx + ddy * ddy;
            if (lenSq > 0) {
              const u = Math.max(0, Math.min(1, ((px - sx) * ddx + (py - sy) * ddy) / lenSq));
              const dist = Math.hypot(px - (sx + u * ddx), py - (sy + u * ddy));
              if (dist < 14 && dist < closestLinkDist) {
                closestLinkDist = dist;
                closestLink = l;
              }
            }
          }
        });

        if (closestLink) {
          onSelectLink?.(closestLink);
          onSelectNode(null);
        } else {
          onSelectNode(null);
          onSelectLink?.(null);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.16;
      camera.position.z = Math.max(110, Math.min(420, camera.position.z));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);
    container.addEventListener('wheel', onWheel, { passive: false });

    // ── Node Compound Group Cache ─────────────────────────────────────────────
    // For each node, we create a high-tech compound group with:
    // 1. Shaded jewel core (MeshStandardMaterial)
    // 2. Outer holographic reticle cage (Icosahedron/Octahedron wireframe)
    // 3. Equatorial micro-ring
    interface NodeMeshEntry {
      group: THREE.Group;
      coreMesh: THREE.Mesh;
      cageMesh: THREE.Mesh;
      ringMesh: THREE.Mesh | null;
      haloMesh: THREE.Mesh | null;
    }
    const nodeMeshMap = new Map<string, NodeMeshEntry>();
    let glowRing: THREE.Mesh | null = null;

    // Flow particle pool — reused across frames
    const FLOW_PARTICLE_COUNT = 140;
    const flowPtGeom = new THREE.BufferGeometry();
    const flowPtPos = new Float32Array(FLOW_PARTICLE_COUNT * 3);
    const flowPtColors = new Float32Array(FLOW_PARTICLE_COUNT * 3);
    flowPtGeom.setAttribute('position', new THREE.BufferAttribute(flowPtPos, 3));
    flowPtGeom.setAttribute('color', new THREE.BufferAttribute(flowPtColors, 3));
    const flowPtMat = new THREE.PointsMaterial({
      size: 2.4,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
    });
    const flowPoints = new THREE.Points(flowPtGeom, flowPtMat);
    flowGroup.add(flowPoints);

    // ── 60fps Render Loop ─────────────────────────────────────────────────────
    let animId: number;
    let frameCount = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const rot = rotRef.current;
      frameCount++;

      // Camera orientation damping
      rot.x += (rot.targetX - rot.x) * 0.08;
      rot.y += (rot.targetY - rot.y) * 0.08;

      if (autoRotateRef.current && !isDragging) {
        rot.targetY += 0.0016;
      }

      // ── Central Singularity Core Animations ─────────────────────────────────
      const corePulse = 1.0 + Math.sin(time * 3.5) * 0.07;
      singularityMesh.scale.set(corePulse, corePulse, corePulse);
      latticeMesh.rotation.y = time * 0.45;
      latticeMesh.rotation.x = time * 0.25;
      shieldMesh.rotation.y = -time * 0.2;
      shieldMesh.rotation.z = time * 0.15;

      gimbalRing1.rotation.z = time * 0.4;
      gimbalRing2.rotation.z = -time * 0.3;
      gimbalRing3.rotation.y = time * 0.2;

      // Accretion disk particle swirl
      const accPosArr = accGeom.attributes.position.array as Float32Array;
      for (let i = 0; i < ACCRETION_COUNT; i++) {
        accAngles[i] += accSpeeds[i];
        accPosArr[i * 3]     = Math.cos(accAngles[i]) * accRadii[i];
        accPosArr[i * 3 + 2] = Math.sin(accAngles[i]) * accRadii[i];
      }
      accGeom.attributes.position.needsUpdate = true;

      // Shockwave ring expansion (period 2.8s)
      const shockwaveProgress = (time % 2.8) / 2.8;
      const shockwaveRadius = 6 + shockwaveProgress * 32;
      const shockwaveScale = shockwaveRadius / 5;
      shockwaveMesh.scale.set(shockwaveScale, shockwaveScale, shockwaveScale);
      shockwaveMat.opacity = Math.max(0, 0.75 * (1 - shockwaveProgress));

      // Drift particle field update
      const dposArr = dustGeom.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dposArr[i * 3]     += dustVel[i * 3];
        dposArr[i * 3 + 1] += dustVel[i * 3 + 1];
        dposArr[i * 3 + 2] += dustVel[i * 3 + 2];
        if (Math.abs(dposArr[i * 3]) > 300)     dposArr[i * 3]     *= -0.95;
        if (Math.abs(dposArr[i * 3 + 1]) > 225) dposArr[i * 3 + 1] *= -0.95;
        if (Math.abs(dposArr[i * 3 + 2]) > 300) dposArr[i * 3 + 2] *= -0.95;
      }
      dustGeom.attributes.position.needsUpdate = true;

      // ── Node Sync: Smooth Lerp & Multi-layered 3D Mesh Render ──────────────
      const activeNodes = nodesRef.current;
      const currentSelectedId = selectedIdRef.current;
      const connectedNodeIds = new Set<string>();

      if (currentSelectedId) {
        connectedNodeIds.add(currentSelectedId);
        linksRef.current.forEach((l) => {
          if (l.sourceId === currentSelectedId) connectedNodeIds.add(l.targetId);
          if (l.targetId === currentSelectedId) connectedNodeIds.add(l.sourceId);
        });
      }

      activeNodes.forEach((node, id) => {
        // Skip separate mesh for neiman-core since coreGroup handles the reactor
        if (id === 'neiman-core') return;

        // Smooth position lerp toward target (mode transition animation)
        node.position.lerp(node.targetPosition, 0.05);

        let entry = nodeMeshMap.get(id);
        if (!entry) {
          const group = new THREE.Group();

          // 1. Jewel Core (Shaded with specular highlight & depth)
          const coreGeom = new THREE.SphereGeometry(node.radius, 24, 24);
          const coreMat = new THREE.MeshStandardMaterial({
            color: node.colorHex,
            emissive: node.colorHex,
            emissiveIntensity: 0.48,
            roughness: 0.2,
            metalness: 0.85,
            transparent: true,
            opacity: 0.94,
          });
          const coreMesh = new THREE.Mesh(coreGeom, coreMat);
          group.add(coreMesh);

          // 2. Holographic Reticle Wireframe Cage
          const cageGeom = new THREE.OctahedronGeometry(node.radius * 1.38);
          const cageMat = new THREE.MeshBasicMaterial({
            color: node.colorHex,
            wireframe: true,
            transparent: true,
            opacity: 0.38,
          });
          const cageMesh = new THREE.Mesh(cageGeom, cageMat);
          group.add(cageMesh);

          // 3. Planar Tech Micro-Ring (For departments, models, and major nodes)
          let ringMesh: THREE.Mesh | null = null;
          if (node.radius >= 3.6) {
            const ringGeom = new THREE.TorusGeometry(node.radius * 1.6, 0.12, 8, 36);
            const ringMat = new THREE.MeshBasicMaterial({
              color: node.colorHex,
              transparent: true,
              opacity: 0.42,
            });
            ringMesh = new THREE.Mesh(ringGeom, ringMat);
            ringMesh.rotation.x = Math.PI / 3;
            group.add(ringMesh);
          }

          nodesGroup.add(group);
          entry = { group, coreMesh, cageMesh, ringMesh, haloMesh: null };
          nodeMeshMap.set(id, entry);
        }

        const isSelected = currentSelectedId === id;
        const isConnected = connectedNodeIds.has(id);
        const isHovered = hoveredNode?.id === id;

        // Position & Local Rotations
        entry.group.position.copy(node.position);
        entry.cageMesh.rotation.y = time * 0.7 + node.pulsePhase;
        entry.cageMesh.rotation.x = time * 0.35;
        if (entry.ringMesh) {
          entry.ringMesh.rotation.z = time * 0.5;
        }

        // Opacity & Emissive Lighting
        const targetOpacity = currentSelectedId
          ? (isSelected ? 1.0 : isConnected ? 0.9 : 0.16)
          : 0.94;
        (entry.coreMesh.material as THREE.MeshStandardMaterial).opacity = targetOpacity;
        (entry.cageMesh.material as THREE.MeshBasicMaterial).opacity = targetOpacity * 0.4;
        (entry.coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isSelected ? 1.3 : isHovered ? 0.85 : 0.48;

        // Scale
        const baseScale = isSelected ? 1.45 : isHovered ? 1.25 : 1.0;
        const pulse = isSelected ? baseScale + Math.sin(time * 5 + node.pulsePhase) * 0.08 : baseScale;
        entry.group.scale.setScalar(pulse);
      });

      // Remove defunct node groups
      nodeMeshMap.forEach((entry, id) => {
        if (!activeNodes.has(id)) {
          nodesGroup.remove(entry.group);
          entry.coreMesh.geometry.dispose();
          (entry.coreMesh.material as THREE.Material).dispose();
          entry.cageMesh.geometry.dispose();
          (entry.cageMesh.material as THREE.Material).dispose();
          if (entry.ringMesh) {
            entry.ringMesh.geometry.dispose();
            (entry.ringMesh.material as THREE.Material).dispose();
          }
          nodeMeshMap.delete(id);
        }
      });

      // ── Selection Targeting Bracket / Glow Ring ─────────────────────────────
      glowGroup.clear();
      if (currentSelectedId && currentSelectedId !== 'neiman-core') {
        const selNode = activeNodes.get(currentSelectedId);
        if (selNode) {
          if (!glowRing) {
            const rg = new THREE.RingGeometry(selNode.radius * 1.5, selNode.radius * 1.7, 48);
            const rm = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, side: THREE.DoubleSide });
            glowRing = new THREE.Mesh(rg, rm);
          }
          glowRing.position.copy(selNode.position);
          glowRing.lookAt(camera.position);
          const ringPulse = 1.0 + Math.sin(time * 4) * 0.08;
          glowRing.scale.setScalar(ringPulse);
          (glowRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(time * 3) * 0.2;
          glowGroup.add(glowRing);
        }
      }

      // ── Link Rendering ──────────────────────────────────────────────────────
      linksGroup.clear();
      const currentLinks = linksRef.current;
      const activeCurves: Array<{ curve: THREE.QuadraticBezierCurve3; color: THREE.Color; activityLevel: number }> = [];

      currentLinks.forEach((link) => {
        const src = activeNodes.get(link.sourceId);
        const tgt = activeNodes.get(link.targetId);
        if (!src || !tgt) return;

        const isLinkConnected = currentSelectedId
          ? link.sourceId === currentSelectedId || link.targetId === currentSelectedId
          : true;

        const midPoint = new THREE.Vector3().addVectors(src.position, tgt.position).multiplyScalar(0.5);
        midPoint.y += link.curvature * 36;

        const curve = new THREE.QuadraticBezierCurve3(src.position, midPoint, tgt.position);
        const points = curve.getPoints(24);
        const geom = new THREE.BufferGeometry().setFromPoints(points);

        const baseOpacity = currentSelectedId ? (isLinkConnected ? 0.8 : 0.06) : 0.28;
        const animOpacity = baseOpacity + Math.sin(time * 4 + link.curvature * 8) * 0.08;
        const mat = new THREE.LineBasicMaterial({
          color: link.colorHex,
          transparent: true,
          opacity: animOpacity,
        });
        linksGroup.add(new THREE.Line(geom, mat));

        if (link.activityLevel > 0.4) {
          activeCurves.push({ curve, color: new THREE.Color(link.colorHex), activityLevel: link.activityLevel });
        }
      });

      // ── Flow Particles along active links ───────────────────────────────────
      const PARTICLES_PER_LINK = 4;
      let ptIdx = 0;
      for (let ci = 0; ci < activeCurves.length && ptIdx < FLOW_PARTICLE_COUNT; ci++) {
        const { curve, color } = activeCurves[ci];
        for (let p = 0; p < PARTICLES_PER_LINK && ptIdx < FLOW_PARTICLE_COUNT; p++, ptIdx++) {
          const phase = (p / PARTICLES_PER_LINK);
          const progress = ((time * 0.35 + phase + ci * 0.17) % 1);
          const pt = curve.getPoint(progress);
          flowPtPos[ptIdx * 3]     = pt.x;
          flowPtPos[ptIdx * 3 + 1] = pt.y;
          flowPtPos[ptIdx * 3 + 2] = pt.z;
          flowPtColors[ptIdx * 3]     = color.r;
          flowPtColors[ptIdx * 3 + 1] = color.g;
          flowPtColors[ptIdx * 3 + 2] = color.b;
        }
      }
      for (let i = ptIdx; i < FLOW_PARTICLE_COUNT; i++) {
        flowPtPos[i * 3] = flowPtPos[i * 3 + 1] = flowPtPos[i * 3 + 2] = 9999;
      }
      flowPtGeom.attributes.position.needsUpdate = true;
      flowPtGeom.attributes.color.needsUpdate = true;

      // ── Apply Global Rotation to Scene Groups ───────────────────────────────
      const euler = new THREE.Euler(rot.x, rot.y, 0);
      nodesGroup.rotation.copy(euler);
      linksGroup.rotation.copy(euler);
      coreGroup.rotation.x = rot.x;
      coreGroup.rotation.y = rot.y;
      glowGroup.rotation.copy(euler);
      flowGroup.rotation.copy(euler);
      guideGroup.rotation.copy(euler);

      // ── Project Screen-Space HUD Badges (Throttled every 2 frames) ──────────
      if (showHUDLabelsRef.current && frameCount % 2 === 0) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const badges: ProjectedBadge[] = [];

        activeNodes.forEach((n) => {
          // Display HUD labels for primary nodes (departments, models, pipeline stages, pools, proposals, core)
          const isPrimary =
            n.type === 'core' ||
            n.type === 'department' ||
            n.type === 'model' ||
            n.type === 'evolution' ||
            n.id.startsWith('stg-') ||
            n.id.startsWith('res-');

          if (!isPrimary && hoveredNode?.id !== n.id && selectedIdRef.current !== n.id) {
            return;
          }

          const worldPos = n.position.clone().applyEuler(euler);
          const sp = worldPos.clone().project(camera);

          // Check if within visible viewport bounds and in front of camera
          if (sp.z < 1.0 && sp.x >= -0.95 && sp.x <= 0.95 && sp.y >= -0.92 && sp.y <= 0.92) {
            const sx = ((sp.x + 1) * w) / 2;
            const sy = ((-sp.y + 1) * h) / 2;
            badges.push({
              id: n.id,
              name: n.name,
              code: n.code,
              subtitle: n.role,
              status: n.status,
              colorHex: n.colorHex,
              x: sx,
              y: sy,
              visible: true,
              type: n.type,
            });
          }
        });

        setProjectedBadges(badges);
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Keyboard Shortcuts (1-7 for modes, Space for rotate, R for reset)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        setAutoRotate((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        if (cameraRef.current) cameraRef.current.position.set(0, 32, 235);
        rotRef.current = { x: 0, y: 0, targetX: 0, targetY: 0 };
      } else if (e.key === 'h' || e.key === 'H') {
        setShowHUDLabels((prev) => !prev);
      } else if (e.key === '1') onModeChange('TOPOLOGY');
      else if (e.key === '2') onModeChange('COLLABORATION');
      else if (e.key === '3') onModeChange('WORKFLOW');
      else if (e.key === '4') onModeChange('ROUTING');
      else if (e.key === '5') onModeChange('RESOURCE_FLOW');
      else if (e.key === '6') onModeChange('MEMORY_GRAPH');
      else if (e.key === '7') onModeChange('EVOLUTION');
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
      container.removeEventListener('wheel', onWheel);
      renderer.dispose();
      container.innerHTML = '';
      document.body.style.cursor = 'default';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Scene init runs once; reactive state synced via refs

  // Camera reset
  const handleResetCamera = useCallback(() => {
    if (cameraRef.current) cameraRef.current.position.set(0, 32, 235);
    rotRef.current = { x: 0, y: 0, targetX: 0, targetY: 0 };
  }, []);

  return (
    <div className={`relative w-full h-full flex flex-col font-mono select-none overflow-hidden ${className}`}>
      {/* ── Mode Selector Bar ──────────────────────────────────────────────── */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-1 rounded-lg border border-cyan-500/25 bg-[#060b18]/90 backdrop-blur-xl shadow-2xl">
        {MODES.map((mode, idx) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onModeChange(mode.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider transition-all duration-150 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent'
              }`}
              title={`${mode.label} (Press ${idx + 1})`}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{mode.label}</span>
              <span className="text-[9px] opacity-40 font-mono hidden md:inline">{idx + 1}</span>
            </button>
          );
        })}
      </div>

      {/* ── Camera & HUD Controls Toolbar (Top Right) ──────────────────────── */}
      <div className="absolute right-3 top-12 z-30 flex flex-col gap-0.5 p-1 rounded-md border border-cyan-500/25 bg-[#060b18]/85 backdrop-blur-md shadow-lg">
        <button
          type="button"
          onClick={() => { if (cameraRef.current) cameraRef.current.position.z = Math.max(110, cameraRef.current.position.z - 25); }}
          className="p-1.5 rounded hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-400 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => { if (cameraRef.current) cameraRef.current.position.z = Math.min(420, cameraRef.current.position.z + 25); }}
          className="p-1.5 rounded hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-400 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`p-1.5 rounded transition-colors ${autoRotate ? 'text-cyan-400 bg-cyan-500/15' : 'text-muted-foreground hover:bg-secondary'}`}
          title="Toggle Auto-Rotation (Space)"
        >
          <Compass className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowHUDLabels((prev) => !prev)}
          className={`p-1.5 rounded transition-colors ${showHUDLabels ? 'text-cyan-400 bg-cyan-500/15' : 'text-muted-foreground hover:bg-secondary'}`}
          title="Toggle HUD Callouts (H)"
        >
          {showHUDLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleResetCamera}
          className="p-1.5 rounded hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-400 transition-colors"
          title="Reset Camera (R)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Cyber Radar / Minimap */}
        <div className="mt-0.5 pt-0.5 border-t border-cyan-500/20 flex flex-col items-center">
          <div className="relative h-11 w-11 rounded-full border border-cyan-500/30 bg-black/60 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,254,0.18)_0%,transparent_75%)]" />
            <div className="absolute h-px w-full bg-cyan-500/20" />
            <div className="absolute h-full w-px bg-cyan-500/20" />
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2fe]" />
            <div className="absolute top-0.5 text-[6px] font-bold text-cyan-400/80 font-mono">RADAR</div>
          </div>
        </div>
      </div>

      {/* ── WebGL Canvas ───────────────────────────────────────────────────── */}
      <div ref={mountRef} className="w-full flex-1 min-h-[380px] cursor-grab active:cursor-grabbing" />

      {/* ── Screen-Space Projected HUD Badges Layer ────────────────────────── */}
      {showHUDLabels && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {projectedBadges.map((badge) => {
            const isHovered = hoveredNode?.id === badge.id;
            const isSelected = selectedNodeId === badge.id;
            const colorHexStr = `#${badge.colorHex.toString(16).padStart(6, '0')}`;

            return (
              <div
                key={badge.id}
                style={{
                  left: `${badge.x}px`,
                  top: `${badge.y}px`,
                  transform: 'translate(-50%, -135%)',
                }}
                className="absolute pointer-events-auto transition-transform duration-75 ease-out"
                onClick={(e) => {
                  e.stopPropagation();
                  const node = nodesRef.current.get(badge.id);
                  if (node) {
                    const rect = mountRef.current?.getBoundingClientRect();
                    const screenX = (rect?.left ?? 0) + badge.x;
                    const screenY = (rect?.top ?? 0) + badge.y;
                    onSelectNode(node, { x: screenX, y: screenY });
                  }
                }}
              >
                <div
                  className={`flex flex-col px-2 py-1 rounded backdrop-blur-md border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#060b18]/95 border-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.4)] scale-110'
                      : isHovered
                      ? 'bg-[#060b18]/90 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.3)] scale-105'
                      : 'bg-[#060b18]/75 border-cyan-500/25 hover:border-cyan-400/50'
                  }`}
                  style={{ minWidth: '90px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse"
                      style={{ backgroundColor: colorHexStr }}
                    />
                    <span className="text-[9px] font-bold tracking-wider text-cyan-300 uppercase truncate">
                      {badge.code ? `[${badge.code}]` : ''} {badge.name.split(':')[0]}
                    </span>
                  </div>
                  {badge.subtitle && (
                    <span className="text-[8px] text-muted-foreground font-mono truncate mt-0.5 max-w-[130px]">
                      {badge.subtitle}
                    </span>
                  )}
                </div>

                {/* Connecting Reticle Line down to 3D node origin */}
                <div
                  className="mx-auto h-2 w-px"
                  style={{ backgroundColor: isSelected ? '#00f2fe' : `${colorHexStr}66` }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Hover Tooltip (Full Context Diagnostic) ────────────────────────── */}
      {hoveredNode && hoverPos && (
        <div
          className="pointer-events-none absolute z-40 transform -translate-x-1/2 -translate-y-full pb-3 animate-fade-in"
          style={{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }}
        >
          <div className="neiman-panel rounded-lg px-3 py-1.5 shadow-2xl font-mono text-left max-w-xs border border-cyan-500/40 bg-[#060b18]/95 backdrop-blur-xl">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="h-2 w-2 rounded-full animate-pulse shrink-0"
                style={{ backgroundColor: `#${hoveredNode.colorHex.toString(16).padStart(6, '0')}` }}
              />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                {hoveredNode.type} · {hoveredNode.status}
              </span>
            </div>
            <p className="text-xs font-bold text-foreground truncate">{hoveredNode.name}</p>
            {hoveredNode.role && <p className="text-[10px] text-cyan-400 mt-0.5">{hoveredNode.role}</p>}
            {hoveredNode.currentTask && <p className="text-[9px] text-muted-foreground truncate">{hoveredNode.currentTask}</p>}
            {hoveredNode.latency && <p className="text-[9px] text-muted-foreground">Latency: {hoveredNode.latency}</p>}
            <div className="mt-1 pt-1 border-t border-border/40 text-[8px] text-muted-foreground flex justify-between">
              <span>Click to inspect & control</span>
              <span className="text-cyan-400">↵</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode label chip (Bottom Left) ──────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded border border-cyan-500/25 bg-[#060b18]/85 backdrop-blur-md text-[9px] font-mono text-cyan-400 uppercase tracking-widest shadow-lg">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="font-bold">{activeMode.replace('_', ' ')}</span>
        <span className="text-muted-foreground/60">|</span>
        <span className="text-[8px] text-muted-foreground">60 FPS // ACES TONE</span>
        {timelineMinutes > 0 && <span className="text-amber-400 ml-1">T-{timelineMinutes}m</span>}
      </div>
    </div>
  );
}
