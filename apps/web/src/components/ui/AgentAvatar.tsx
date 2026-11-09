'use client';

import React, { useId, useMemo, useState } from 'react';

export type AgentRoleCategory =
  | 'architect'
  | 'security'
  | 'product'
  | 'operations'
  | 'finance'
  | 'legal'
  | 'data'
  | 'support'
  | 'research'
  | 'general';

export interface AgentAvatarProps {
  name: string;
  roleTitle?: string | null;
  departmentName?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  showStatus?: boolean;
  className?: string;
}

interface RoleTheme {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
}

/**
 * Palette mapped to Nothing OS cyber-glow / obsidian aesthetic
 */
const ROLE_THEMES: Record<AgentRoleCategory, RoleTheme> = {
  // Red/Crimson - Chief Architecture & Core Systems
  architect: {
    primary: '#D71921',
    secondary: '#8A0E13',
    accent: '#FF4D4D',
    glow: 'rgba(215, 25, 33, 0.45)',
    badgeBg: 'rgba(215, 25, 33, 0.12)',
    badgeBorder: 'rgba(215, 25, 33, 0.35)',
  },
  // Amber/Gold - Security, Compliance & Sentinel Defense
  security: {
    primary: '#F59E0B',
    secondary: '#92400E',
    accent: '#FCD34D',
    glow: 'rgba(245, 158, 11, 0.45)',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)',
  },
  // Purple/Violet - Product & Strategic Vision
  product: {
    primary: '#A855F7',
    secondary: '#581C87',
    accent: '#D8B4FE',
    glow: 'rgba(168, 85, 247, 0.45)',
    badgeBg: 'rgba(168, 85, 247, 0.12)',
    badgeBorder: 'rgba(168, 85, 247, 0.35)',
  },
  // Emerald/Cyan - Operations, Swarm & Orchestration
  operations: {
    primary: '#10B981',
    secondary: '#064E3B',
    accent: '#6EE7B7',
    glow: 'rgba(16, 185, 129, 0.45)',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeBorder: 'rgba(16, 185, 129, 0.35)',
  },
  // Golden/Bronze - Finance, Treasury & Resources
  finance: {
    primary: '#EAB308',
    secondary: '#713F12',
    accent: '#FEF08A',
    glow: 'rgba(234, 179, 8, 0.45)',
    badgeBg: 'rgba(234, 179, 8, 0.12)',
    badgeBorder: 'rgba(234, 179, 8, 0.35)',
  },
  // Rose/Indigo - Legal & Governance Policies
  legal: {
    primary: '#EC4899',
    secondary: '#831843',
    accent: '#FBCFE8',
    glow: 'rgba(236, 72, 153, 0.45)',
    badgeBg: 'rgba(236, 72, 153, 0.12)',
    badgeBorder: 'rgba(236, 72, 153, 0.35)',
  },
  // Sky/Blue - Data Engineering, Intelligence & Knowledge Graph
  data: {
    primary: '#0EA5E9',
    secondary: '#0C4A6E',
    accent: '#7DD3FC',
    glow: 'rgba(14, 165, 233, 0.45)',
    badgeBg: 'rgba(14, 165, 233, 0.12)',
    badgeBorder: 'rgba(14, 165, 233, 0.35)',
  },
  // Teal/Mint - Support, Human Liaison & Customer Bridge
  support: {
    primary: '#14B8A6',
    secondary: '#134E4A',
    accent: '#5EEAD4',
    glow: 'rgba(20, 184, 166, 0.45)',
    badgeBg: 'rgba(20, 184, 166, 0.12)',
    badgeBorder: 'rgba(20, 184, 166, 0.35)',
  },
  // Cyan/Indigo - Deep Research & Cognitive Synthesis
  research: {
    primary: '#6366F1',
    secondary: '#312E81',
    accent: '#A5B4FC',
    glow: 'rgba(99, 102, 241, 0.45)',
    badgeBg: 'rgba(99, 102, 241, 0.12)',
    badgeBorder: 'rgba(99, 102, 241, 0.35)',
  },
  // Monochromatic Nothing OS - Obsidian / Neutral
  general: {
    primary: '#EDEDED',
    secondary: '#262626',
    accent: '#FFFFFF',
    glow: 'rgba(237, 237, 237, 0.35)',
    badgeBg: 'rgba(255, 255, 255, 0.08)',
    badgeBorder: 'rgba(255, 255, 255, 0.25)',
  },
};

/**
 * Resolves role keyword heuristics into an avatar category
 */
export function resolveAgentRoleCategory(
  roleTitle?: string | null,
  deptName?: string | null,
  name?: string | null
): AgentRoleCategory {
  const combined = `${roleTitle || ''} ${deptName || ''} ${name || ''}`.toLowerCase();

  if (/(architect|engineer|developer|devops|infra|system|tech|software|stack)/i.test(combined)) {
    return 'architect';
  }
  if (/(security|sentinel|guard|shield|audit|compliance|vulnerability|auth)/i.test(combined)) {
    return 'security';
  }
  if (/(product|pm|strateg|growth|vision|roadmap|owner|lead)/i.test(combined)) {
    return 'product';
  }
  if (/(operation|ops|coo|dispatch|orchestrat|execution|pipeline|logistics)/i.test(combined)) {
    return 'operations';
  }
  if (/(finance|cfo|treasur|budget|cost|accounting|token|billing)/i.test(combined)) {
    return 'finance';
  }
  if (/(legal|counsel|policy|contract|governance|regulatory)/i.test(combined)) {
    return 'legal';
  }
  if (/(data|analyst|ml|vector|graph|database|intelligence|etl|bi)/i.test(combined)) {
    return 'data';
  }
  if (/(support|liaison|customer|client|success|helpdesk|crm)/i.test(combined)) {
    return 'support';
  }
  if (/(research|scientist|deep|reason|scholar|explore|experiment)/i.test(combined)) {
    return 'research';
  }
  return 'general';
}

/**
 * Computes deterministic hash for variations within the same role category
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Procedural SVG Cybernetic Glyph Generator
 */
export function ProceduralCyberGlyph({
  category,
  seed,
  size = 40,
}: {
  category: AgentRoleCategory;
  seed: string;
  size?: number;
}) {
  const theme = ROLE_THEMES[category] || ROLE_THEMES.general;
  const hash = useMemo(() => hashString(seed), [seed]);
  const uid = useId().replace(/:/g, '');

  // Render role-specific cybernetic geometry
  const renderRoleShape = () => {
    switch (category) {
      case 'architect':
        // Grid matrix with circuit nodes and micro-diamonds
        return (
          <g>
            <rect x="24" y="24" width="52" height="52" fill="none" stroke={theme.primary} strokeWidth="2" strokeDasharray="3 3" opacity="0.6" />
            <polygon points="50,22 78,50 50,78 22,50" fill="none" stroke={theme.accent} strokeWidth="2.5" />
            <circle cx="50" cy="50" r="10" fill={theme.primary} fillOpacity="0.25" stroke={theme.accent} strokeWidth="2" />
            <line x1="22" y1="50" x2="10" y2="50" stroke={theme.primary} strokeWidth="2" />
            <line x1="78" y1="50" x2="90" y2="50" stroke={theme.primary} strokeWidth="2" />
            <line x1="50" y1="22" x2="50" y2="10" stroke={theme.primary} strokeWidth="2" />
            <line x1="50" y1="78" x2="50" y2="90" stroke={theme.primary} strokeWidth="2" />
            <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
          </g>
        );

      case 'security':
        // Sentinel shield with lock lattice and crosshair target
        return (
          <g>
            <path
              d="M50 16 L76 26 V52 C76 68 64 81 50 86 C36 81 24 68 24 52 V26 Z"
              fill="none"
              stroke={theme.primary}
              strokeWidth="2.5"
            />
            <path
              d="M50 26 L68 34 V52 C68 63 59 73 50 77 C41 73 32 63 32 52 V34 Z"
              fill={theme.secondary}
              fillOpacity="0.3"
              stroke={theme.accent}
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <circle cx="50" cy="50" r="8" fill="none" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="50" y1="36" x2="50" y2="64" stroke="#FFFFFF" strokeWidth="1.5" />
            <line x1="36" y1="50" x2="64" y2="50" stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="2.5" fill={theme.accent} />
          </g>
        );

      case 'product':
        // Starburst beacon / vector prism
        return (
          <g>
            <circle cx="50" cy="50" r="28" fill="none" stroke={theme.primary} strokeWidth="1.5" strokeDasharray="2 4" />
            <polygon points="50,15 61,39 85,50 61,61 50,85 39,61 15,50 39,39" fill={theme.secondary} fillOpacity="0.25" stroke={theme.accent} strokeWidth="2.5" />
            <circle cx="50" cy="50" r="7" fill={theme.primary} stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="2" fill="#FFFFFF" />
          </g>
        );

      case 'operations':
        // Hexagonal swarm pulse & dynamic rings
        return (
          <g>
            <polygon points="50,16 79,33 79,67 50,84 21,67 21,33" fill="none" stroke={theme.primary} strokeWidth="2.5" />
            <polygon points="50,26 70,38 70,62 50,74 30,62 30,38" fill={theme.secondary} fillOpacity="0.35" stroke={theme.accent} strokeWidth="1.5" />
            <circle cx="50" cy="50" r="9" fill={theme.primary} fillOpacity="0.4" stroke={theme.accent} strokeWidth="2" />
            <circle cx="50" cy="33" r="3" fill="#FFFFFF" />
            <circle cx="70" cy="62" r="3" fill="#FFFFFF" />
            <circle cx="30" cy="62" r="3" fill="#FFFFFF" />
            <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
          </g>
        );

      case 'finance':
        // Precision vault cube & isometric facets
        return (
          <g>
            <polygon points="50,18 80,35 50,52 20,35" fill={theme.secondary} fillOpacity="0.5" stroke={theme.accent} strokeWidth="2" />
            <polygon points="20,35 50,52 50,84 20,67" fill={theme.secondary} fillOpacity="0.2" stroke={theme.primary} strokeWidth="2" />
            <polygon points="80,35 50,52 50,84 80,67" fill={theme.secondary} fillOpacity="0.7" stroke={theme.primary} strokeWidth="2" />
            <circle cx="50" cy="52" r="6" fill={theme.accent} stroke="#FFFFFF" strokeWidth="1.5" />
            <line x1="50" y1="26" x2="50" y2="44" stroke="#FFFFFF" strokeWidth="1.5" />
          </g>
        );

      case 'legal':
        // Scales of balance & cryptographic ring
        return (
          <g>
            <circle cx="50" cy="50" r="32" fill="none" stroke={theme.primary} strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="24" y1="36" x2="76" y2="36" stroke={theme.accent} strokeWidth="3" strokeLinecap="round" />
            <line x1="50" y1="20" x2="50" y2="78" stroke={theme.primary} strokeWidth="2.5" />
            {/* Left Pan */}
            <path d="M26 36 L18 56 Q26 64 34 56 Z" fill={theme.secondary} fillOpacity="0.4" stroke={theme.accent} strokeWidth="1.5" />
            {/* Right Pan */}
            <path d="M74 36 L66 56 Q74 64 82 56 Z" fill={theme.secondary} fillOpacity="0.4" stroke={theme.accent} strokeWidth="1.5" />
            <circle cx="50" cy="20" r="4" fill="#FFFFFF" />
            <rect x="38" y="76" width="24" height="6" rx="2" fill={theme.accent} />
          </g>
        );

      case 'data':
        // Synaptic neural network & vector graph
        return (
          <g>
            <circle cx="50" cy="28" r="6" fill={theme.primary} stroke={theme.accent} strokeWidth="2" />
            <circle cx="28" cy="64" r="6" fill={theme.primary} stroke={theme.accent} strokeWidth="2" />
            <circle cx="72" cy="64" r="6" fill={theme.primary} stroke={theme.accent} strokeWidth="2" />
            <circle cx="50" cy="52" r="8" fill={theme.secondary} stroke="#FFFFFF" strokeWidth="2" />
            <line x1="50" y1="28" x2="50" y2="52" stroke={theme.accent} strokeWidth="2" strokeDasharray="2 2" />
            <line x1="28" y1="64" x2="50" y2="52" stroke={theme.accent} strokeWidth="2" strokeDasharray="2 2" />
            <line x1="72" y1="64" x2="50" y2="52" stroke={theme.accent} strokeWidth="2" strokeDasharray="2 2" />
            <line x1="28" y1="64" x2="72" y2="64" stroke={theme.primary} strokeWidth="1.5" />
            <circle cx="50" cy="52" r="3" fill="#FFFFFF" />
          </g>
        );

      case 'support':
        // Humanoid liaison bridge & communicative soundwave
        return (
          <g>
            <circle cx="50" cy="34" r="14" fill={theme.secondary} fillOpacity="0.3" stroke={theme.accent} strokeWidth="2.5" />
            <circle cx="50" cy="34" r="5" fill="#FFFFFF" />
            <path d="M26 76 C26 58 38 54 50 54 C62 54 74 58 74 76" fill="none" stroke={theme.primary} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M16 48 C16 48 20 40 24 40" fill="none" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" />
            <path d="M84 48 C84 48 80 40 76 40" fill="none" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" />
            <circle cx="50" cy="68" r="2.5" fill={theme.accent} />
          </g>
        );

      case 'research':
        // Quantum atom / cognitive orbit ring
        return (
          <g>
            <ellipse cx="50" cy="50" rx="36" ry="14" fill="none" stroke={theme.primary} strokeWidth="2" transform="rotate(-30 50 50)" />
            <ellipse cx="50" cy="50" rx="36" ry="14" fill="none" stroke={theme.accent} strokeWidth="2" transform="rotate(30 50 50)" />
            <ellipse cx="50" cy="50" rx="36" ry="14" fill="none" stroke={theme.primary} strokeWidth="1.5" strokeDasharray="3 3" transform="rotate(90 50 50)" />
            <circle cx="50" cy="50" r="9" fill={theme.secondary} stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
            <circle cx="78" cy="34" r="2.5" fill={theme.accent} />
            <circle cx="22" cy="66" r="2.5" fill={theme.accent} />
          </g>
        );

      case 'general':
      default:
        // Monochromatic Nothing OS dot-matrix cybernetic core
        return (
          <g>
            <rect x="22" y="22" width="56" height="56" rx="10" fill="none" stroke={theme.primary} strokeWidth="2" />
            <circle cx="50" cy="50" r="14" fill="none" stroke={theme.primary} strokeWidth="2" strokeDasharray="3 3" />
            <rect x="42" y="42" width="16" height="16" fill={theme.primary} opacity="0.8" />
            <circle cx="32" cy="32" r="2" fill="#FFFFFF" />
            <circle cx="68" cy="32" r="2" fill="#FFFFFF" />
            <circle cx="32" cy="68" r="2" fill="#FFFFFF" />
            <circle cx="68" cy="68" r="2" fill="#FFFFFF" />
          </g>
        );
    }
  };

  // Micro-dots background matrix for Nothing OS authentic industrial texture
  const renderDotMatrix = () => {
    const dots: React.ReactElement[] = [];
    const step = 14;
    for (let x = 15; x <= 85; x += step) {
      for (let y = 15; y <= 85; y += step) {
        // Pseudo-random suppression to keep clean silhouette
        const dotId = (x * 13 + y * 7 + hash) % 10;
        if (dotId > 3) {
          dots.push(
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="1"
              fill={theme.primary}
              opacity="0.18"
            />
          );
        }
      }
    }
    return dots;
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="shrink-0 select-none overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={theme.glow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={`frame-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={theme.primary} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Cybernetic ambient glow backing */}
      <circle cx="50" cy="50" r="48" fill={`url(#glow-${uid})`} />

      {/* Outer obsidian circular chassis */}
      <circle cx="50" cy="50" r="46" fill="#0B0D11" stroke={`url(#frame-${uid})`} strokeWidth="1.5" />

      {/* Nothing OS dot matrix texture */}
      <g>{renderDotMatrix()}</g>

      {/* Role specific signature geometry */}
      {renderRoleShape()}

      {/* Corner calibration tick marks */}
      <line x1="8" y1="50" x2="14" y2="50" stroke={theme.primary} strokeWidth="1.5" opacity="0.7" />
      <line x1="86" y1="50" x2="92" y2="50" stroke={theme.primary} strokeWidth="1.5" opacity="0.7" />
      <line x1="50" y1="8" x2="50" y2="14" stroke={theme.primary} strokeWidth="1.5" opacity="0.7" />
      <line x1="50" y1="86" x2="50" y2="92" stroke={theme.primary} strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

/**
 * Maps agent names, slugs, or titles to pre-generated cyberpunk portrait avatars
 */
export function resolveAgentAvatarUrl(
  avatarUrl?: string | null,
  name?: string | null,
  roleTitle?: string | null
): string | null {
  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '') {
    return avatarUrl;
  }
  const str = `${name || ''} ${roleTitle || ''}`.toLowerCase();
  if (str.includes('cto') || str.includes('chief technology')) return '/avatars/cto_agent.png';
  if (str.includes('architect') || str.includes('principal software')) return '/avatars/lead_architect_agent.png';
  if (str.includes('product spec') || str.includes('specification') || str.includes('product manager')) return '/avatars/product_spec_agent.png';
  if (str.includes('scrum') || str.includes('sprint facilitator')) return '/avatars/scrum_master_agent.png';
  if (str.includes('backend') || str.includes('server engineer')) return '/avatars/backend_engineer_agent.png';
  if (str.includes('frontend') || str.includes('client engineer') || str.includes('ui engineer')) return '/avatars/frontend_engineer_agent.png';
  if (str.includes('database') || str.includes('migrations') || str.includes('data architecture')) return '/avatars/database_engineer_agent.png';
  if (str.includes('code reviewer') || str.includes('quality sentinel')) return '/avatars/code_reviewer_agent.png';
  if (str.includes('security') || str.includes('sentinel') || str.includes('secops')) return '/avatars/security_sentinel_agent.png';
  if (str.includes('qa') || str.includes('automation') || str.includes('test engineer')) return '/avatars/qa_automation_agent.png';
  if (str.includes('sre') || str.includes('reliability') || str.includes('sre guard')) return '/avatars/sre_guard_agent.png';
  if (str.includes('devops') || str.includes('release') || str.includes('ci/cd')) return '/avatars/devops_release_agent.png';
  if (str.includes('technical writer') || str.includes('documentation')) return '/avatars/technical_writer_agent.png';
  return null;
}

/**
 * Universal Agent Avatar Component
 */
export function AgentAvatar({
  name,
  roleTitle,
  departmentName,
  avatarUrl,
  status = 'AVAILABLE',
  size = 'md',
  showStatus = true,
  className = '',
}: AgentAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Convert standard size strings to pixels
  const pxSize = useMemo(() => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'xs':
        return 24;
      case 'sm':
        return 32;
      case 'md':
        return 44;
      case 'lg':
        return 56;
      case 'xl':
        return 72;
      default:
        return 44;
    }
  }, [size]);

  const category = useMemo(
    () => resolveAgentRoleCategory(roleTitle, departmentName, name),
    [roleTitle, departmentName, name]
  );

  const theme = ROLE_THEMES[category] || ROLE_THEMES.general;

  const resolvedUrl = useMemo(() => {
    if (imageError) return null;
    return resolveAgentAvatarUrl(avatarUrl, name, roleTitle);
  }, [avatarUrl, name, roleTitle, imageError]);

  // Status indicator colors
  const statusConfig = useMemo(() => {
    const st = (status || 'AVAILABLE').toUpperCase();
    switch (st) {
      case 'WORKING':
      case 'ACTIVE':
      case 'RUNNING':
        return {
          bg: 'bg-amber-400',
          ring: 'ring-amber-400/40',
          pulse: true,
          label: 'Working',
        };
      case 'BLOCKED':
      case 'FAILED':
        return {
          bg: 'bg-rose-500',
          ring: 'ring-rose-500/40',
          pulse: true,
          label: 'Blocked',
        };
      case 'WAITING':
      case 'PAUSED':
        return {
          bg: 'bg-sky-400',
          ring: 'ring-sky-400/40',
          pulse: false,
          label: 'Waiting',
        };
      case 'OFFLINE':
      case 'DISABLED':
        return {
          bg: 'bg-zinc-500',
          ring: 'ring-zinc-500/40',
          pulse: false,
          label: 'Offline',
        };
      case 'AVAILABLE':
      default:
        return {
          bg: 'bg-emerald-400',
          ring: 'ring-emerald-400/40',
          pulse: false,
          label: 'Available',
        };
    }
  }, [status]);

  const indicatorSize = Math.max(7, Math.round(pxSize * 0.22));

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl group ${className}`}
      style={{
        width: pxSize,
        height: pxSize,
      }}
      title={`${name} • ${roleTitle || category.toUpperCase()}`}
      aria-label={`${name} avatar, role: ${roleTitle || category}`}
    >
      {/* Outer Cyber Chassis & Glow Container */}
      <div
        className="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center border transition-all duration-300 shadow-sm"
        style={{
          backgroundColor: '#0A0C10',
          borderColor: theme.badgeBorder,
          boxShadow: `0 0 16px -4px ${theme.glow}`,
        }}
      >
        {resolvedUrl ? (
          <img
            src={resolvedUrl}
            alt={name}
            className="w-full h-full object-cover select-none"
            loading="eager"
            onError={() => setImageError(true)}
          />
        ) : (
          <ProceduralCyberGlyph
            category={category}
            seed={`${name}-${roleTitle || ''}-${departmentName || ''}`}
            size={pxSize}
          />
        )}
      </div>

      {/* Operational Status Dot (optional) */}
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background ${statusConfig.bg} ${
            statusConfig.pulse ? 'animate-pulse' : ''
          }`}
          style={{
            width: indicatorSize,
            height: indicatorSize,
          }}
          title={`Status: ${statusConfig.label}`}
        />
      )}
    </div>
  );
}
