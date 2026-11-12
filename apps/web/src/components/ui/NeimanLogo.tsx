'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';
import anime from 'animejs';
import { cn } from '@/lib/utils';

export interface NeimanLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'splash';
  showWordmark?: boolean;
  withGlow?: boolean;
  solvingMotion?: boolean;
  className?: string;
  priority?: boolean;
}

const SIZE_MAP = {
  xs: { icon: 20, text: 'text-xs', height: 20 },
  sm: { icon: 26, text: 'text-sm', height: 26 },
  md: { icon: 34, text: 'text-base', height: 34 },
  lg: { icon: 46, text: 'text-xl', height: 46 },
  xl: { icon: 64, text: 'text-2xl', height: 64 },
  splash: { icon: 96, text: 'text-4xl', height: 96 },
};

const HANDLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

interface MahoragaWheelProps {
  px: number;
  withGlow: boolean;
  adaptationMotion: boolean;
}

/**
 * Interactive Eight-Handled Dharma Wheel (Mahoraga's Wheel) powered by Anime.js
 * stepped 45-degree mechanical click-turns and golden aura pulses.
 */
function MahoragaWheel({ px, withGlow, adaptationMotion }: MahoragaWheelProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const wheelRef = useRef<SVGSVGElement | null>(null);
  const auraRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef(0);

  const gradMainId = `mh-gold-main-${uid}`;
  const gradBevelId = `mh-gold-bevel-${uid}`;
  const gradHighlightId = `mh-gold-hl-${uid}`;
  const gradPommelId = `mh-pommel-${uid}`;
  const gradHubId = `mh-hub-${uid}`;

  const triggerAdaptationTurn = useCallback(() => {
    if (!adaptationMotion || !wheelRef.current) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const startAngle = angleRef.current;
    const nextAngle = startAngle + 45;
    angleRef.current = nextAngle;

    anime.remove(wheelRef.current);
    anime
      .timeline({ targets: wheelRef.current })
      .add({
        rotate: startAngle - 5,
        duration: 95,
        easing: 'easeOutQuad',
      })
      .add({
        rotate: nextAngle,
        duration: 540,
        easing: 'spring(1, 80, 12, 0)',
      });

    if (auraRef.current) {
      anime.remove(auraRef.current);
      anime({
        targets: auraRef.current,
        scale: [0.82, 1.38],
        opacity: [0.75, 0],
        duration: 680,
        easing: 'easeOutExpo',
      });
    }
  }, [adaptationMotion]);

  useEffect(() => {
    if (!adaptationMotion) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const interval = window.setInterval(triggerAdaptationTurn, 4500);
    const handleAdaptEvent = () => triggerAdaptationTurn();

    window.addEventListener('neiman:wheel-adapt', handleAdaptEvent);
    window.addEventListener('neiman:council-deliberate', handleAdaptEvent);

    const currentWheel = wheelRef.current;
    const currentAura = auraRef.current;

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('neiman:wheel-adapt', handleAdaptEvent);
      window.removeEventListener('neiman:council-deliberate', handleAdaptEvent);
      if (currentWheel) anime.remove(currentWheel);
      if (currentAura) anime.remove(currentAura);
    };
  }, [adaptationMotion, triggerAdaptationTurn]);

  return (
    <div
      onMouseEnter={triggerAdaptationTurn}
      className={cn(
        'relative shrink-0 inline-flex items-center justify-center transition-transform duration-300 group-hover:scale-105',
        withGlow && 'drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]'
      )}
      style={{ width: px, height: px }}
    >
      {/* Adaptation Pulse Ring (Gold shockwave emitted on each 45-degree click) */}
      {adaptationMotion && (
        <div
          ref={auraRef}
          className="absolute inset-0 rounded-full border-2 border-[#F59E0B]/70 pointer-events-none opacity-0"
          aria-hidden="true"
        />
      )}

      {/* Subtle Ambient Aura */}
      {withGlow && (
        <div
          className="absolute inset-0.5 rounded-full bg-[#F59E0B]/15 blur-sm pointer-events-none"
          aria-hidden="true"
        />
      )}

      <svg
        ref={wheelRef}
        viewBox="0 0 200 200"
        width={px}
        height={px}
        role="img"
        aria-label="NEIMAN — Mahoraga Eight-Handled Dharma Wheel"
        className="w-full h-full relative z-10 overflow-visible"
        style={{ transformOrigin: '50% 50%' }}
      >
        <defs>
          <linearGradient id={gradMainId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="22%" stopColor="#FDE68A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="78%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>

          <linearGradient id={gradBevelId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#78350F" />
            <stop offset="30%" stopColor="#D97706" />
            <stop offset="65%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#FEF3C7" />
          </linearGradient>

          <linearGradient id={gradHighlightId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>

          <radialGradient id={gradPommelId} cx="35%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="35%" stopColor="#FCD34D" />
            <stop offset="72%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#78350F" />
          </radialGradient>

          <radialGradient id={gradHubId} cx="40%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="70%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#451A03" />
          </radialGradient>
        </defs>

        {/* 8 Spokes & 8 Protruding Dharma Wheel Handles */}
        {HANDLE_ANGLES.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 100 100)`}>
            {/* Inner Spoke Base Collar */}
            <rect
              x="95"
              y="75"
              width="10"
              height="5"
              rx="1.5"
              fill={`url(#${gradBevelId})`}
              stroke="#78350F"
              strokeWidth="0.9"
            />
            {/* Tapered Spoke Shaft */}
            <polygon
              points="96.2,76 103.8,76 104.8,51 95.2,51"
              fill={`url(#${gradMainId})`}
              stroke="#78350F"
              strokeWidth="0.9"
            />
            {/* Spoke Center Highlight */}
            <line
              x1="100"
              y1="75"
              x2="100"
              y2="51"
              stroke={`url(#${gradHighlightId})`}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Outer Spoke Rim Collar */}
            <rect
              x="94.5"
              y="48.5"
              width="11"
              height="4.5"
              rx="1.5"
              fill={`url(#${gradBevelId})`}
              stroke="#78350F"
              strokeWidth="0.8"
            />

            {/* Protruding Handle Base Mount */}
            <rect
              x="93.5"
              y="34.5"
              width="13"
              height="5.5"
              rx="1.8"
              fill={`url(#${gradBevelId})`}
              stroke="#78350F"
              strokeWidth="1"
            />
            {/* Handle Tapered Grip */}
            <polygon
              points="95.8,35 104.2,35 103.2,17.5 96.8,17.5"
              fill={`url(#${gradMainId})`}
              stroke="#78350F"
              strokeWidth="1"
            />
            {/* Handle Specular Ridge */}
            <line
              x1="100"
              y1="34.5"
              x2="100"
              y2="18"
              stroke={`url(#${gradHighlightId})`}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Handle Upper Collar Ring */}
            <rect
              x="94.5"
              y="16"
              width="11"
              height="3.8"
              rx="1.5"
              fill={`url(#${gradHighlightId})`}
              stroke="#78350F"
              strokeWidth="0.9"
            />
            {/* Terminal Sphere Pommel */}
            <circle
              cx="100"
              cy="10.5"
              r="6.2"
              fill={`url(#${gradPommelId})`}
              stroke="#78350F"
              strokeWidth="1.1"
            />
            <circle cx="98.2" cy="8.7" r="1.8" fill="#FFFBEB" opacity="0.85" />
          </g>
        ))}

        {/* Concentric Outer Rim Assembly */}
        <circle cx="100" cy="100" r="61" fill="none" stroke="#78350F" strokeWidth="2" />
        <circle
          cx="100"
          cy="100"
          r="56"
          fill="none"
          stroke={`url(#${gradMainId})`}
          strokeWidth="10.5"
        />
        <circle
          cx="100"
          cy="100"
          r="56"
          fill="none"
          stroke={`url(#${gradBevelId})`}
          strokeWidth="5.5"
        />
        <circle
          cx="100"
          cy="100"
          r="56"
          fill="none"
          stroke={`url(#${gradHighlightId})`}
          strokeWidth="1.8"
        />
        <circle cx="100" cy="100" r="50.5" fill="none" stroke="#78350F" strokeWidth="1.5" />

        {/* Rim Studs */}
        {HANDLE_ANGLES.map((deg) => {
          const radMain = (deg * Math.PI) / 180;
          const radMid = ((deg + 22.5) * Math.PI) / 180;
          return (
            <React.Fragment key={`rivet-${deg}`}>
              <circle
                cx={100 + 56 * Math.sin(radMain)}
                cy={100 - 56 * Math.cos(radMain)}
                r="3.1"
                fill={`url(#${gradPommelId})`}
                stroke="#78350F"
                strokeWidth="0.9"
              />
              <circle
                cx={100 + 56 * Math.sin(radMid)}
                cy={100 - 56 * Math.cos(radMid)}
                r="1.9"
                fill="#FEF3C7"
                stroke="#78350F"
                strokeWidth="0.7"
              />
            </React.Fragment>
          );
        })}

        {/* Central Hub Assembly */}
        <circle
          cx="100"
          cy="100"
          r="24"
          fill={`url(#${gradBevelId})`}
          stroke="#78350F"
          strokeWidth="1.6"
        />
        <circle
          cx="100"
          cy="100"
          r="18.5"
          fill="#271203"
          stroke={`url(#${gradHighlightId})`}
          strokeWidth="1.5"
        />
        <circle
          cx="100"
          cy="100"
          r="13.5"
          fill="none"
          stroke={`url(#${gradMainId})`}
          strokeWidth="3"
        />
        <circle
          cx="100"
          cy="100"
          r="7.5"
          fill={`url(#${gradHubId})`}
          stroke="#78350F"
          strokeWidth="1.2"
        />
        <circle cx="98" cy="98" r="2.2" fill="#FFFFFF" opacity="0.9" />
      </svg>
    </div>
  );
}

export function NeimanLogo({
  size = 'md',
  showWordmark = true,
  withGlow = true,
  solvingMotion = true,
  className,
}: NeimanLogoProps) {
  const { icon: px, text: textClass } = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 select-none font-sans tracking-wider group',
        className
      )}
    >
      <MahoragaWheel px={px} withGlow={withGlow} adaptationMotion={solvingMotion} />

      {showWordmark && (
        <span
          className={cn(
            'font-bold uppercase tracking-wider text-foreground',
            textClass
          )}
        >
          NEIMAN
        </span>
      )}
    </div>
  );
}

export function NeimanIcon({
  size = 28,
  withGlow = true,
  solvingMotion = true,
  className,
}: {
  size?: number;
  withGlow?: boolean;
  solvingMotion?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center justify-center group', className)}>
      <MahoragaWheel px={size} withGlow={withGlow} adaptationMotion={solvingMotion} />
    </div>
  );
}
