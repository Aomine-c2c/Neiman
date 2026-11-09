'use client';

import React from 'react';
import Image from 'next/image';
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
  xs: { icon: 18, text: 'text-xs', height: 18 },
  sm: { icon: 24, text: 'text-sm', height: 24 },
  md: { icon: 32, text: 'text-base', height: 32 },
  lg: { icon: 44, text: 'text-xl', height: 44 },
  xl: { icon: 64, text: 'text-2xl', height: 64 },
  splash: { icon: 96, text: 'text-4xl', height: 96 },
};

export function NeimanLogo({
  size = 'md',
  showWordmark = true,
  withGlow = true,
  solvingMotion = true,
  className,
  priority = false,
}: NeimanLogoProps) {
  const { icon: px, text: textClass } = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 select-none font-sans tracking-wider group',
        className
      )}
    >
      <div
        className={cn(
          'relative shrink-0 transition-all duration-500 group-hover:scale-105',
          withGlow && 'drop-shadow-[0_0_14px_rgba(14,243,206,0.5)]'
        )}
        style={{ width: px, height: px }}
      >
        {/* Ambient Orbital Solving Motion Ring */}
        {solvingMotion && (
          <div
            className="absolute -inset-1 rounded-full border border-[#0EF3CE]/20 border-dashed animate-[spin_12s_linear_infinite] group-hover:animate-[spin_4s_linear_infinite] pointer-events-none opacity-70"
            aria-hidden="true"
          />
        )}

        {/* Dynamic Solving Pulse Glow */}
        {solvingMotion && withGlow && (
          <div
            className="absolute inset-0 rounded-lg bg-[#0EF3CE]/10 blur-md animate-pulse pointer-events-none"
            aria-hidden="true"
          />
        )}

        <Image
          src="/neiman-icon.png"
          alt="NEIMAN — Rubik's Cube in Solving Motion"
          width={px}
          height={px}
          priority={priority}
          className={cn(
            'object-contain w-full h-full relative z-10 transition-transform duration-700',
            solvingMotion && 'group-hover:rotate-6'
          )}
        />
      </div>

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
    <div
      className={cn(
        'relative shrink-0 inline-block group',
        withGlow && 'drop-shadow-[0_0_10px_rgba(14,243,206,0.45)]',
        className
      )}
      style={{ width: size, height: size }}
    >
      {solvingMotion && (
        <div
          className="absolute -inset-0.5 rounded-full border border-[#0EF3CE]/25 border-dashed animate-[spin_12s_linear_infinite] pointer-events-none"
          aria-hidden="true"
        />
      )}
      <Image
        src="/neiman-icon.png"
        alt="NEIMAN — Rubik's Cube in Solving Motion"
        width={size}
        height={size}
        className="object-contain w-full h-full relative z-10"
      />
    </div>
  );
}
