'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { OrbState, OrbSize } from 'thinking-orbs';

// Dynamic import for ThinkingOrb to ensure client-only canvas rendering
const ThinkingOrbCanvas = dynamic(
  () => import('thinking-orbs').then((mod) => mod.ThinkingOrb),
  { ssr: false }
);

interface AgentOrbProps {
  status?: string;
  size?: OrbSize;
  color?: string;
  className?: string;
}

export function AgentOrb({
  status = 'AVAILABLE',
  size = 20,
  color,
  className = '',
}: AgentOrbProps) {
  // Map agent runtime statuses to thinking-orbs states
  let state: OrbState = 'breathing';
  let orbColor = color;

  switch (status.toUpperCase()) {
    case 'WORKING':
    case 'RUNNING':
    case 'ACTIVE':
      state = 'working';
      orbColor = orbColor || '#D71921'; // Nothing Red
      break;
    case 'SOLVING':
    case 'DECIDING':
      state = 'solving';
      orbColor = orbColor || '#D71921';
      break;
    case 'SEARCHING':
    case 'RETRIEVING':
    case 'ANALYZING':
      state = 'searching';
      orbColor = orbColor || '#EDEDED';
      break;
    case 'CONNECTING':
    case 'DISPATCHING':
      state = 'connecting';
      orbColor = orbColor || '#EDEDED';
      break;
    case 'LISTENING':
    case 'WAITING':
      state = 'listening';
      orbColor = orbColor || '#737373';
      break;
    case 'WEAVING':
    case 'SYNTHESIZING':
      state = 'weaving';
      orbColor = orbColor || '#D71921';
      break;
    case 'SHAPING':
      state = 'shaping';
      orbColor = orbColor || '#D71921';
      break;
    case 'PAUSED':
    case 'OFFLINE':
    case 'AVAILABLE':
    default:
      state = 'breathing';
      orbColor = orbColor || '#737373';
      break;
  }

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <ThinkingOrbCanvas
        state={state}
        size={size}
        theme="dark"
        color={orbColor}
        speed={state === 'working' ? 1.2 : 0.8}
        dotSize={1.1}
      />
    </div>
  );
}
