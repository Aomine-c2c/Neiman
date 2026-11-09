import React from 'react';
import { render, screen } from '@testing-library/react';
import { ContextualInspector } from './ContextualInspector';
import type { CoreNode } from './CognitiveCore';

describe('ContextualInspector (Red Phase - Collision & Opacity Fixes)', () => {
  const mockDepartmentNode: CoreNode = {
    id: 'dept-sec',
    name: 'Security & Sentinel Ops',
    type: 'department',
    status: 'ACTIVE',
    colorHex: 0xf43f5e,
    radius: 4.8,
    position: { x: 0, y: 0, z: 0 } as any,
    targetPosition: { x: 0, y: 0, z: 0 } as any,
    pulsePhase: 0,
  };

  it('renders with a semantic theme-aware card background and no invalid tailwind opacity class', () => {
    const { container } = render(
      <ContextualInspector
        node={mockDepartmentNode}
        onClose={jest.fn()}
      />
    );

    const inspectorEl = container.firstElementChild as HTMLElement;
    expect(inspectorEl).toBeInTheDocument();

    // Verify invalid Tailwind class bg-[#060b18]/97 is NOT used
    expect(inspectorEl.className).not.toContain('bg-[#060b18]/97');

    // Verify semantic Light/Dark theme-aware card background is applied
    expect(inspectorEl.className).toContain('bg-card/95');
    expect(inspectorEl.className).toContain('text-card-foreground');
  });

  it('does NOT default to right: 16px when screenPos is null (prevents colliding with ExecutiveGatePanel)', () => {
    // Set desktop window dimensions
    window.innerWidth = 1440;
    window.innerHeight = 900;

    const { container } = render(
      <ContextualInspector
        node={mockDepartmentNode}
        screenPos={null}
        onClose={jest.fn()}
      />
    );

    const inspectorEl = container.firstElementChild as HTMLElement;
    expect(inspectorEl).toBeInTheDocument();

    // Must NOT be placed at right: 16px (where ExecutiveGatePanel lives)
    expect(inspectorEl.style.right).not.toBe('16px');

    // On 1440px desktop, the right cluster is from 1440 - 380 = 1060px to 1440px.
    // The inspector width is ~320px. Its left position should not exceed 1060 - 320 = 740px.
    const leftPx = parseInt(inspectorEl.style.left || '0', 10);
    expect(leftPx).toBeLessThanOrEqual(740);
  });

  it('flips to the left of the node when positioned near the right cluster', () => {
    window.innerWidth = 1440;
    window.innerHeight = 900;

    // Node is at x: 1200 (in the right section of the screen)
    const { container } = render(
      <ContextualInspector
        node={mockDepartmentNode}
        screenPos={{ x: 1200, y: 300 }}
        onClose={jest.fn()}
      />
    );

    const inspectorEl = container.firstElementChild as HTMLElement;
    const leftPx = parseInt(inspectorEl.style.left || '0', 10);

    // Should flip to the left of the node (<= 1200 - 320 = 880) and stay clear of right panel
    expect(leftPx).toBeLessThanOrEqual(1200 - 320);
  });
});
