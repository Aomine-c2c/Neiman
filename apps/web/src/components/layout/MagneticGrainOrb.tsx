'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import { governanceApi } from '@/lib/api/governance';
import { useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import type { ControlRoomState, Task, ApprovalRequest } from '@/lib/api/controlRoom';

interface MagneticGrainOrbProps {
  state?: ControlRoomState | null;
  onOpenDrawer?: (drawerId: string) => void;
  className?: string;
  compact?: boolean;
}

interface SurfaceGrainMeta {
  index: number;
  id: string;
  type: 'TASK' | 'APPROVAL' | 'MILESTONE' | 'AGENT';
  title: string;
  status: string;
  priority?: string;
  assignedAgent?: string;
  targetDrawer: string;
  colorHex: number;
}

export function MagneticGrainOrb({
  state,
  onOpenDrawer,
  className = '',
  compact = false,
}: MagneticGrainOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';

  const [, setIsHovered] = useState(false);
  const [hoveredGrain, setHoveredGrain] = useState<{
    meta: SurfaceGrainMeta;
    screenX: number;
    screenY: number;
  } | null>(null);

  const isPreview = isDevelopmentAuthBypassEnabled();
  const { data: audits = [] } = useQuery({
    queryKey: ['governance-audits-live', companyId],
    queryFn: () => governanceApi.queryAudits(companyId, { limit: 10 }),
    enabled: !!companyId && !isPreview,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.RAPID,
  });

  const latestAudit = audits.length > 0 ? audits[0] : null;
  const hasAlert = audits.some((a) => a.result === 'DENIED' || a.result === 'BLOCKED');
  const hasApproval =
    (state?.approvals ?? []).some((a) => a.status === 'PENDING') ||
    audits.some((a) => a.result === 'PENDING');

  // Real enterprise metrics from state
  const tasks = useMemo(() => state?.tasks ?? [], [state?.tasks]);
  const approvals = useMemo(() => state?.approvals ?? [], [state?.approvals]);
  const agents = useMemo(() => state?.agents ?? [], [state?.agents]);
  const projects = useMemo(() => state?.projects ?? [], [state?.projects]);

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'PENDING').length;
  const blockedTasksCount = tasks.filter((t) => t.status === 'BLOCKED').length;
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;
  const workingAgentsCount = agents.filter((a) => a.status === 'WORKING').length;

  // Calculate genuine project advancement percentage
  const totalTasks = tasks.length;
  let totalMilestones = 0;
  let completedMilestones = 0;
  projects.forEach((p) => {
    (p.milestones || []).forEach((m) => {
      totalMilestones++;
      if (m.completed) completedMilestones++;
    });
  });

  const advancementPct = useMemo(() => {
    const totalUnits = totalTasks + totalMilestones;
    if (totalUnits === 0) return 45; // Baseline healthy preview stage
    const completedUnits = completedCount + completedMilestones;
    return Math.min(100, Math.max(10, Math.round((completedUnits / totalUnits) * 100)));
  }, [totalTasks, totalMilestones, completedCount, completedMilestones]);

  // Dynamic Accretion: Particle count determined directly by project advancement
  // Nucleus: 2,400 grains -> Supercluster: 14,000 grains
  const particleCount = useMemo(() => {
    const minGrains = 2400;
    const maxGrains = 14000;
    return Math.round(minGrains + (maxGrains - minGrains) * (advancementPct / 100));
  }, [advancementPct]);

  // Accretion Tier Label
  const accretionTier = useMemo(() => {
    if (advancementPct < 25) return { name: 'Tier I · Nucleus', color: 'text-sky-400' };
    if (advancementPct < 60) return { name: 'Tier II · Accreting Cluster', color: 'text-violet-400' };
    if (advancementPct < 85) return { name: 'Tier III · High Density Shell', color: 'text-emerald-400' };
    return { name: 'Tier IV · Supercluster Diamond', color: 'text-amber-400' };
  }, [advancementPct]);

  // Three.js 3D Magnetic Grain Sphere Engine (Pure Cellular Accretion)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = compact ? 240 : (container.clientWidth || 560);
    const height = compact ? 240 : (container.clientHeight || 380);

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.z = compact ? 150 : 190;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. High-Density Fibonacci Sphere mapped to advancement particleCount
    const actualParticleCount = compact ? Math.min(5400, particleCount) : particleCount;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(actualParticleCount * 3);
    const basePositions = new Float32Array(actualParticleCount * 3);
    const colors = new Float32Array(actualParticleCount * 3);
    const phases = new Float32Array(actualParticleCount);

    const baseRadius = compact ? 54 : 68;

    // Standard NEIMAN System Palette
    const cEmerald = new THREE.Color(0x10b981); // Completed
    const cSky = new THREE.Color(0x38bdf8);     // In-Progress Tasks
    const cViolet = new THREE.Color(0x8b5cf6);  // Cognitive / Swarm
    const cAmber = new THREE.Color(0xf59e0b);   // Pending Backlog
    const cRuby = new THREE.Color(0xef4444);    // Blocked / Sign-off

    // Map designated actual tasks & approvals directly onto surface grain indices
    const grainMetadataMap = new Map<number, SurfaceGrainMeta>();

    // Step allocation across Fibonacci indices
    let grainSlot = 12;
    const slotStep = Math.max(14, Math.floor(particleCount / 40));

    // 1. Pending Approvals (Ruby grains)
    approvals
      .filter((a) => a.status === 'PENDING')
      .slice(0, 4)
      .forEach((appr: ApprovalRequest) => {
        if (grainSlot < particleCount) {
          grainMetadataMap.set(grainSlot, {
            index: grainSlot,
            id: appr.id,
            type: 'APPROVAL',
            title: appr.reason || `Executive Gate Sign-off (${appr.action_type})`,
            status: 'PENDING SIGN-OFF',
            priority: appr.risk_level || 'HIGH',
            assignedAgent: appr.agent_id ? `Agent ${appr.agent_id.slice(0, 6)}` : 'System Boundary',
            targetDrawer: 'approvals',
            colorHex: 0xef4444,
          });
          grainSlot += slotStep;
        }
      });

    // 2. In-Progress Tasks (Sky Blue grains)
    tasks
      .filter((t) => t.status === 'IN_PROGRESS')
      .slice(0, 8)
      .forEach((task: Task) => {
        if (grainSlot < particleCount) {
          const assigned = agents.find((ag) => ag.id === task.assigned_agent_id);
          grainMetadataMap.set(grainSlot, {
            index: grainSlot,
            id: task.id,
            type: 'TASK',
            title: task.title,
            status: 'IN PROGRESS',
            priority: task.priority,
            assignedAgent: assigned?.name || 'Autonomous Agent',
            targetDrawer: 'tasks',
            colorHex: 0x38bdf8,
          });
          grainSlot += slotStep;
        }
      });

    // 3. Blocked Tasks (Amber grains)
    tasks
      .filter((t) => t.status === 'BLOCKED')
      .slice(0, 4)
      .forEach((task: Task) => {
        if (grainSlot < particleCount) {
          grainMetadataMap.set(grainSlot, {
            index: grainSlot,
            id: task.id,
            type: 'TASK',
            title: task.title,
            status: 'BLOCKED',
            priority: task.priority,
            targetDrawer: 'tasks',
            colorHex: 0xf59e0b,
          });
          grainSlot += slotStep;
        }
      });

    // 4. Completed Tasks (Emerald grains)
    tasks
      .filter((t) => t.status === 'COMPLETED')
      .slice(0, 6)
      .forEach((task: Task) => {
        if (grainSlot < particleCount) {
          grainMetadataMap.set(grainSlot, {
            index: grainSlot,
            id: task.id,
            type: 'TASK',
            title: task.title,
            status: 'COMPLETED',
            priority: task.priority,
            targetDrawer: 'tasks',
            colorHex: 0x10b981,
          });
          grainSlot += slotStep;
        }
      });

    // Fill points buffer
    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const variance = (Math.random() - 0.5) * 4.5;
      const r = baseRadius + variance;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;

      phases[i] = Math.random() * Math.PI * 2;

      const normY = (y / baseRadius + 1) / 2;
      const pColor = new THREE.Color();

      // Check if grain is a designated interactive item
      const itemMeta = grainMetadataMap.get(i);
      if (itemMeta) {
        pColor.setHex(itemMeta.colorHex);
      } else if (normY > 0.65) {
        const t = (normY - 0.65) / 0.35;
        pColor.copy(cSky).lerp(cEmerald, t);
      } else if (normY > 0.4) {
        const t = (normY - 0.4) / 0.25;
        pColor.copy(cViolet).lerp(cSky, t);
      } else if (normY > 0.2) {
        const t = (normY - 0.2) / 0.2;
        pColor.copy(cAmber).lerp(cViolet, t);
      } else {
        const t = normY / 0.2;
        if (hasApproval || hasAlert || pendingApprovalsCount > 0) {
          pColor.copy(cRuby).lerp(cAmber, t * 0.5);
        } else {
          pColor.copy(cAmber).lerp(cEmerald, t);
        }
      }

      colors[i * 3] = pColor.r;
      colors[i * 3 + 1] = pColor.g;
      colors[i * 3 + 2] = pColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle texture - crisp concentric luminescent core
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const pointTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 2.3,
      map: pointTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 3. Phosphorescent Coronas for Designated Work Grains
    const coronaGroup = new THREE.Group();
    scene.add(coronaGroup);

    const coronaGeom = new THREE.SphereGeometry(2.8, 14, 14);
    const coronaList: Array<{ mesh: THREE.Mesh; index: number; colorHex: number }> = [];

    grainMetadataMap.forEach((meta) => {
      const cMat = new THREE.MeshBasicMaterial({
        color: meta.colorHex,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });
      const cMesh = new THREE.Mesh(coronaGeom, cMat);
      coronaGroup.add(cMesh);
      coronaList.push({ mesh: cMesh, index: meta.index, colorHex: meta.colorHex });
    });

    // 4. Great-Circle Neural Constellation Arcs (Connecting tasks)
    const arcGroup = new THREE.Group();
    scene.add(arcGroup);

    const arcLines: Array<{ line: THREE.Line; meta1: SurfaceGrainMeta; meta2: SurfaceGrainMeta; mat: THREE.LineBasicMaterial }> = [];
    const designatedEntries = Array.from(grainMetadataMap.values());

    for (let j = 0; j < designatedEntries.length; j++) {
      for (let k = j + 1; k < designatedEntries.length; k++) {
        const m1 = designatedEntries[j];
        const m2 = designatedEntries[k];
        // Connect related tasks or active items in proximity
        if (m1.type === m2.type || m1.targetDrawer === m2.targetDrawer || (j % 2 === 0 && k === j + 1)) {
          const v1 = new THREE.Vector3(
            basePositions[m1.index * 3],
            basePositions[m1.index * 3 + 1],
            basePositions[m1.index * 3 + 2]
          ).normalize();

          const v2 = new THREE.Vector3(
            basePositions[m2.index * 3],
            basePositions[m2.index * 3 + 1],
            basePositions[m2.index * 3 + 2]
          ).normalize();

          // Great-circle interpolation points along sphere surface
          const arcPoints: THREE.Vector3[] = [];
          const arcSegs = 24;
          for (let s = 0; s <= arcSegs; s++) {
            const frac = s / arcSegs;
            const pt = new THREE.Vector3().copy(v1).lerp(v2, frac).normalize().multiplyScalar(baseRadius * 1.015);
            arcPoints.push(pt);
          }

          const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPoints);
          const arcMat = new THREE.LineBasicMaterial({
            color: m1.colorHex,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
          });
          const arcLine = new THREE.Line(arcGeom, arcMat);
          arcGroup.add(arcLine);
          arcLines.push({ line: arcLine, meta1: m1, meta2: m2, mat: arcMat });
        }
      }
    }

    // 5. Highlight indicator mesh for hovered surface grain
    const highlightGeom = new THREE.SphereGeometry(4.0, 16, 16);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const highlightMesh = new THREE.Mesh(highlightGeom, highlightMat);
    scene.add(highlightMesh);

    // 6. Raycasting & Mouse Interaction directly on Points
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 4.2; // Generous hit area for surface picking
    const mouse = new THREE.Vector2(-999, -999);

    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    let activeHoveredMeta: SurfaceGrainMeta | null = null;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / width) * 2 - 1;
      const mouseY = -(((e.clientY - rect.top) / height) * 2 - 1);

      targetRotY = mouseX * 0.55;
      targetRotX = mouseY * 0.35;

      mouse.x = mouseX;
      mouse.y = mouseY;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(particles);

      if (intersects.length > 0) {
        let hitMeta: SurfaceGrainMeta | null = null;
        for (const hit of intersects) {
          if (hit.index !== undefined && grainMetadataMap.has(hit.index)) {
            hitMeta = grainMetadataMap.get(hit.index)!;
            break;
          }
        }

        if (!hitMeta && intersects[0].index !== undefined) {
          const idx = intersects[0].index;
          Array.from(grainMetadataMap.entries()).forEach(([gIdx, meta]) => {
            if (!hitMeta && Math.abs(gIdx - idx) < 18) {
              hitMeta = meta;
            }
          });
        }

        if (hitMeta) {
          activeHoveredMeta = hitMeta;
          setHoveredGrain({
            meta: hitMeta,
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top,
          });
          document.body.style.cursor = 'pointer';

          // Illuminate connected constellation neural arcs
          arcLines.forEach(({ meta1, meta2, mat }) => {
            if (meta1.id === hitMeta!.id || meta2.id === hitMeta!.id) {
              mat.opacity = 0.85;
              mat.color.setHex(0xffffff);
            } else {
              mat.opacity = 0.08;
              mat.color.setHex(meta1.colorHex);
            }
          });

          // Position highlight ring at particle 3D position
          const hitIdx = hitMeta.index;
          const pos = geometry.attributes.position as THREE.BufferAttribute;
          const hx = pos.getX(hitIdx);
          const hy = pos.getY(hitIdx);
          const hz = pos.getZ(hitIdx);
          highlightMesh.position.set(hx, hy, hz);
          highlightMesh.applyMatrix4(particles.matrixWorld);
          highlightMat.color.setHex(hitMeta.colorHex);
          highlightMat.opacity = 0.85;
        } else {
          activeHoveredMeta = null;
          setHoveredGrain(null);
          highlightMat.opacity = 0;
          arcLines.forEach(({ mat, meta1 }) => {
            mat.opacity = 0.18;
            mat.color.setHex(meta1.colorHex);
          });
          document.body.style.cursor = 'default';
        }
      } else {
        activeHoveredMeta = null;
        setHoveredGrain(null);
        highlightMat.opacity = 0;
        arcLines.forEach(({ mat, meta1 }) => {
          mat.opacity = 0.18;
          mat.color.setHex(meta1.colorHex);
        });
        document.body.style.cursor = 'default';
      }
    };

    const handleClick = () => {
      if (activeHoveredMeta) {
        onOpenDrawer?.(activeHoveredMeta.targetDrawer);
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleClick);

    // 7. Organic Ferrofluid Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();

      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      particles.rotation.y = time * 0.12 + currentRotY;
      particles.rotation.x = Math.sin(time * 0.15) * 0.08 + currentRotX;

      coronaGroup.rotation.copy(particles.rotation);
      arcGroup.rotation.copy(particles.rotation);

      // Ferrofluid surface breathing displacement
      const waveVelocity = 2.0 + (workingAgentsCount > 0 ? 0.4 : 0);
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];

        const isDesignated = grainMetadataMap.has(i);
        const wave =
          Math.sin(by * 0.08 + time * waveVelocity + phases[i]) *
          Math.cos(bx * 0.08 + time * 1.8) *
          (isDesignated ? 4.2 : 2.8);

        const displacement = 1.0 + wave / baseRadius;

        posArray[i * 3] = bx * displacement;
        posArray[i * 3 + 1] = by * displacement;
        posArray[i * 3 + 2] = bz * displacement;
      }
      posAttr.needsUpdate = true;

      // Update positions of phosphorescent coronas to stay locked to displaced surface grains
      coronaList.forEach(({ mesh, index }) => {
        mesh.position.set(posArray[index * 3], posArray[index * 3 + 1], posArray[index * 3 + 2]);
        const pulse = 1.0 + Math.sin(time * 4 + index) * 0.2;
        mesh.scale.set(pulse, pulse, pulse);
      });

      // Pulse highlight mesh if grain is hovered
      if (activeHoveredMeta) {
        const pulse = 1.0 + Math.sin(time * 6) * 0.3;
        highlightMesh.scale.set(pulse, pulse, pulse);
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleClick);
      document.body.style.cursor = 'default';
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      pointTexture.dispose();
      highlightGeom.dispose();
      highlightMat.dispose();
      coronaGeom.dispose();
      coronaGroup.clear();
      arcGroup.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    particleCount,
    hasAlert,
    hasApproval,
    pendingApprovalsCount,
    workingAgentsCount,
    tasks,
    approvals,
    agents,
    compact,
    onOpenDrawer,
  ]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none ${compact ? 'p-1' : 'py-2'} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredGrain(null);
      }}
    >
      {/* 3D THREE.JS ACCRETION SPHERE CONTAINER */}
      <div
        className={`relative flex items-center justify-center overflow-visible ${
          compact
            ? 'w-[240px] h-[240px]'
            : 'w-[320px] sm:w-[440px] md:w-[520px] xl:w-[560px] h-[300px] sm:h-[350px] xl:h-[380px]'
        }`}
      >
        {/* Subtle ambient halo glow */}
        <div
          className={`pointer-events-none absolute rounded-full bg-primary/10 dark:bg-sky-500/15 blur-2xl opacity-70 ${
            compact ? 'h-[160px] w-[160px]' : 'h-[220px] w-[220px] xl:h-[280px] xl:w-[280px]'
          }`}
        />

        {/* Three.js canvas container */}
        <div
          ref={mountRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing pointer-events-auto"
        />

        {/* Interactive Floating HUD Tooltip for Picked Surface Grains */}
        {hoveredGrain && (
          <div
            className="pointer-events-none absolute z-30 transform -translate-x-1/2 -translate-y-full pb-3 transition-opacity duration-150 animate-in fade-in"
            style={{
              left: `${hoveredGrain.screenX}px`,
              top: `${hoveredGrain.screenY}px`,
            }}
          >
            <div className="rounded-lg border border-border/80 bg-background/90 backdrop-blur-md px-3.5 py-2 shadow-2xl font-mono text-left max-w-xs">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{
                    backgroundColor:
                      hoveredGrain.meta.colorHex === 0xef4444
                        ? '#ef4444'
                        : hoveredGrain.meta.colorHex === 0xf59e0b
                        ? '#f59e0b'
                        : hoveredGrain.meta.colorHex === 0x10b981
                        ? '#10b981'
                        : '#38bdf8',
                  }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Grain #{hoveredGrain.meta.index} · {hoveredGrain.meta.type}
                </span>
                {hoveredGrain.meta.priority && (
                  <span className="ml-auto text-[9px] px-1.5 py-0.2 rounded border border-border/50 bg-secondary/50 uppercase text-foreground">
                    {hoveredGrain.meta.priority}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
                {hoveredGrain.meta.title}
              </p>
              {hoveredGrain.meta.assignedAgent && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Actor: <span className="text-foreground">{hoveredGrain.meta.assignedAgent}</span>
                </p>
              )}
              <div className="mt-1.5 pt-1 border-t border-border/40 text-[9px] text-muted-foreground flex items-center justify-between">
                <span>Click to inspect</span>
                <span className="text-primary font-bold">↵</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Telemetry Status & Multi-Segment Grain Accretion Pill */}
      {!compact && (
        <div className="mt-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 z-20 font-mono text-[10px]">
          {latestAudit ? (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-card/90 px-2.5 py-0.5 rounded border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D71921] animate-ping" />
              <span>Audit: {latestAudit.actor_name || 'Agent'} — {latestAudit.action}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-card/90 px-2.5 py-0.5 rounded border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className={accretionTier.color}>{accretionTier.name}</span>
              <span className="text-muted-foreground">({advancementPct}%)</span>
            </div>
          )}

          {/* Work Distribution Breakdown Pill with Total Grain Count */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/60 px-2.5 py-0.5 rounded border border-border">
            <span className="flex items-center gap-1.5">
              <span className="text-foreground font-semibold">
                {particleCount.toLocaleString()}
              </span>{' '}
              Grains
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-foreground font-semibold">{completedCount}</span> Done
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span className="text-foreground font-semibold">{inProgressCount}</span> Active
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-foreground font-semibold">{pendingTasksCount}</span> Backlog
            </span>
            {pendingApprovalsCount > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1.5 text-[#D71921]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D71921] animate-ping" />
                  <span className="font-bold">{pendingApprovalsCount}</span> Sign-Off
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

