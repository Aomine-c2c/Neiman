'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bot, Sparkles, Zap, ArrowRight, Shield, Layers, Play } from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { Task, Project } from '@/lib/api/controlRoom';

interface SwarmCanvasProps {
  agents: Agent[];
  tasks: Task[];
  projects: Project[];
  onSelectAgent?: (agentId: string) => void;
  onSelectTask?: (taskId: string) => void;
}

interface ParticleNode {
  id: string;
  name: string;
  type: 'agent' | 'task' | 'project';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  status: string;
  role?: string;
  color: string;
}

export function SwarmCanvas({
  agents,
  tasks,
  projects,
  onSelectAgent,
  onSelectTask,
}: SwarmCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<ParticleNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<ParticleNode | null>(null);
  const nodesRef = useRef<ParticleNode[]>([]);
  const animFrameId = useRef<number>(0);

  // Initialize nodes based on real agents, projects, and active tasks
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = 480;

    const newNodes: ParticleNode[] = [];

    // Projects as central orbital anchors
    projects.slice(0, 3).forEach((p, idx) => {
      newNodes.push({
        id: p.id,
        name: p.name,
        type: 'project',
        x: (width / (Math.min(projects.length, 3) + 1)) * (idx + 1),
        y: height * 0.35,
        vx: 0,
        vy: 0,
        radius: 22,
        status: p.status,
        color: '#FFFFFF',
      });
    });

    // Agents as free-floating thinking particles
    agents.forEach((ag, idx) => {
      const isWorking = ag.status === 'WORKING' || ag.status === 'RUNNING';
      newNodes.push({
        id: ag.id,
        name: ag.name,
        type: 'agent',
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (height - 120) + 60,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: isWorking ? 16 : 12,
        status: ag.status,
        role: ag.autonomy,
        color: isWorking ? '#D71921' : ag.status === 'AVAILABLE' ? '#10B981' : '#737373',
      });
    });

    // Active tasks orbiting
    tasks.filter((t) => (t.status as string) === 'IN_PROGRESS' || (t.status as string) === 'PENDING' || (t.status as string) === 'TODO').slice(0, 8).forEach((t) => {
      newNodes.push({
        id: t.id,
        name: t.title,
        type: 'task',
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (height - 120) + 60,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 8,
        status: t.status,
        color: t.status === 'IN_PROGRESS' ? '#F59E0B' : '#38BDF8',
      });
    });

    nodesRef.current = newNodes;
  }, [agents, tasks, projects]);

  // Canvas physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = containerRef.current?.clientWidth || 800);
    let height = (canvas.height = 480);

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      width = canvas.width = containerRef.current.clientWidth;
      height = canvas.height = 480;
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Subtle Dot-Matrix Grid Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      const spacing = 24;
      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const nodes = nodesRef.current;

      // 2. Draw Connection Lines between Agents & Projects/Tasks
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Connect if close enough or assigned
          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, 0.15 - dist / 1000)})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // 3. Update & Draw Nodes
      nodes.forEach((node) => {
        // Light floating motion
        node.x += node.vx;
        node.y += node.vy;

        // Bounce on boundaries
        if (node.x < node.radius) { node.x = node.radius; node.vx *= -1; }
        if (node.x > width - node.radius) { node.x = width - node.radius; node.vx *= -1; }
        if (node.y < node.radius) { node.y = node.radius; node.vy *= -1; }
        if (node.y > height - node.radius) { node.y = height - node.radius; node.vy *= -1; }

        // Glow ring around working nodes
        if (node.status === 'WORKING' || node.status === 'IN_PROGRESS') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(215, 25, 33, 0.12)';
          ctx.fill();
        }

        // Inner circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Outline
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();

        // Center Pip for Nothing OS style
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#080808';
        ctx.fill();

        // Node label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.name.length > 14 ? node.name.slice(0, 12) + '..' : node.name, node.x, node.y + node.radius + 12);
      });

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Hover detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hit = nodesRef.current.find((n) => {
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    });

    setHoveredNode(hit || null);
  };

  const handleClick = () => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
      if (hoveredNode.type === 'agent' && onSelectAgent) {
        onSelectAgent(hoveredNode.id);
      } else if (hoveredNode.type === 'task' && onSelectTask) {
        onSelectTask(hoveredNode.id);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl overflow-hidden font-mono select-none"
    >
      {/* Canvas Top HUD Bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border/60 bg-background/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#D71921] shadow-[0_0_8px_#D71921] animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            AI SWARM TOPOLOGY CANVAS
          </span>
          <span className="text-[10px] px-2 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border/40">
            {agents.length} AGENTS // {tasks.length} TASKS
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D71921]" />
            <span>Working</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#38BDF8]" />
            <span>Task</span>
          </div>
        </div>
      </div>

      {/* Main Interactive HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="w-full h-[480px] cursor-crosshair block"
      />

      {/* Hover Info Card */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute bottom-4 left-5 z-20 flex items-center gap-3 rounded-xl border border-border/80 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl animate-in fade-in-50"
        >
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: hoveredNode.color }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground uppercase">{hoveredNode.name}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground uppercase border border-border/40">
                {hoveredNode.type}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Status: {hoveredNode.status}</p>
          </div>
        </div>
      )}
    </div>
  );
}
