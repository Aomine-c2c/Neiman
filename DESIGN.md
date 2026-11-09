---
name: NEIMAN OS Design System
description: Sovereign Command Deck — Precision Engineering and Telemetry Architecture
colors:
  primary: "#4F46E5"
  primary-dark: "#5B73F8"
  bg-light: "#F8FAFC"
  bg-dark: "#0B0E14"
  surface-light: "#FFFFFF"
  surface-dark: "#11151F"
  text-light: "#0F172A"
  text-dark: "#F1F5F9"
  border-light: "#DCE3EC"
  border-dark: "#232A3B"
  accent-success: "#059669"
  accent-warning: "#B45309"
  accent-danger: "#E11D48"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  card-surface:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
    padding: "20px 24px"
---

# Design System: NEIMAN OS

## Overview

**Creative North Star: "The Sovereign Command Deck"**

NEIMAN OS is built for operators who value information density, precision, and architectural calm over decorative spectacle. It blends the crisp, typographic restraint of modern developer instruments (Linear, Vercel) with the real-time observability of an aerospace telemetry center. Every pixel is purposeful, legible, and directly tied to live underlying state.

The interface defaults to a clean Light Ceramic Canvas (`#F8FAFC`) with deep Slate ink (`#0F172A`) for effortless daytime readability, while fully supporting an Obsidian Cyber-Glow dark mode (`#0B0E14`) with luminous indigo accents. Cliché AI tells—such as purple-violet gradients, decorative grid-line wallpapers, and artificial side-tab accent bars—are strictly banished.

**Key Characteristics:**
- **Calm, High-Contrast Precision:** 4.5:1+ WCAG contrast ratios across all states, light and dark.
- **Tonal Hierarchy:** Depth is conveyed via subtle 1px hairlines and structured background surfaces rather than loud drop shadows.
- **High-Scanability Telemetry:** Tabular figures (`font-variant-numeric: tabular-nums`), monospaced timestamps, and state beacons communicate system health in milliseconds.
- **Keyboard-First Ergonomics:** Universal command palette (`Cmd/Ctrl + K`), visible focus indicators, and accessible interactive landmarks.

## Colors

The palette balances authoritative neutral foundations with purposeful semantic telemetry beacons.

### Primary
- **Precision Indigo** (`#4F46E5` / dark: `#5B73F8`): Used strictly for primary actions, active navigation states, and verified system focal points.

### Semantic Telemetry
- **Nominal Emerald** (`#059669` / `#10B981`): Healthy worker state, passing checks, 200 OK responses.
- **Gate Amber** (`#B45309` / `#F59E0B`): Human-in-the-loop approval gates, rate-limit cooldowns, degraded fallback tiers.
- **Circuit Rose** (`#E11D48` / `#F43F5E`): Quota exhaustion, critical policy violations, circuit-breaker trips.

### Neutral
- **Alabaster Canvas** (`#F8FAFC`): Default light mode ground.
- **Carbon Obsidian** (`#0B0E14` / `#11151F`): Default dark mode ground and elevated card surface.
- **Slate Ink** (`#0F172A` / `#F1F5F9`): Primary text token; ensures crisp contrast against canvas.
- **Hairline Border** (`#DCE3EC` / `#232A3B`): Crisp 1px structural dividing lines.

### Named Rules
**The Rarity Rule.** The primary indigo accent is restricted to <= 10% of any given operational viewport. Its scarcity preserves intentional hierarchy.
**The No-Grey-On-Color Rule.** On colored or accented surfaces, secondary text is tinted directly from the surface hue or pure foreground, never generic muted grey.

## Typography

**Display Font:** Inter (`sans-serif`)
**Body Font:** Inter (`sans-serif`)
**Telemetry/Mono Font:** JetBrains Mono (`monospace`, `tnum`)

**Character:** Inter provides neutral, highly legible sans-serif structure with optical kerning; JetBrains Mono delivers unmistakable distinction for metrics, model names, tokens, and timestamps.

### Hierarchy
- **Display** (SemiBold 600, 2.25rem / 36px, line-height 1.2, tracking -0.025em): Major section headers and executive dashboard titles.
- **Headline** (SemiBold 600, 1.5rem / 24px, line-height 1.3, tracking -0.02em): Domain cards, council proposals, model fleet directories.
- **Title** (Medium 500, 1.125rem / 18px, line-height 1.4, tracking -0.01em): Sub-panel headers, list headers, modal dialog titles.
- **Body** (Regular 400, 0.875rem / 14px, line-height 1.5, max-width 70ch): Core documentation, proposal descriptions, agent dialogue.
- **Label / Telemetry** (Medium 500, 0.75rem / 12px, tracking +0.02em, tabular-nums): Latency numbers, model IDs, token counts, timestamps.

### Named Rules
**The No-Eyebrow Rule.** No kicker or eyebrow labels above headings. The headline carries its own context without decorative scaffolding.
**The Tabular Numbers Rule.** All metrics, countdowns, timestamps, and pricing displays must enforce tabular figures (`font-variant-numeric: tabular-nums`).

## Layout

- **Container Model:** Max-width constrained layouts (`max-w-7xl` or full-bleed command center) with adaptive grid columns.
- **Spatial Grid:** 8px base grid rhythm (`4px`, `8px`, `16px`, `24px`, `32px`, `48px`).
- **Responsive Adaptivity:** Grid topologies collapse cleanly from triple-pane desktop command centers to single-column tablet and mobile views.

## Elevation & Depth

Surfaces are flat at rest, relying on tonal contrast and 1px crisp hairline borders for structural boundary definition. Soft shadows are reserved exclusively for floating elements (command palette dialogs, dropdown popovers, slide-over panels).

### Shadow Vocabulary
- **Popover Elevation** (`box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.06)`): Used on dropdown menus, command palettes, and floating action cards.

## Shapes

- **Card Radius:** Standardized at 12px (`rounded-xl` or `rounded-lg`).
- **Control Radius:** Standardized at 6px (`rounded-md`) for buttons, inputs, and toggles.
- **Pills:** Full pill radius (`rounded-full`) is strictly reserved for status badges, tags, and telemetry beacons.

## Components

### Buttons
- **Shape:** 6px radius (`rounded-md`).
- **Primary:** Solid Precision Indigo (`#4F46E5`), white text, 8px 16px padding.
- **Hover/Focus:** Subtle luminance shift (`bg-primary/90`), visible 2px offset focus ring.
- **Secondary:** Transparent with 1px border (`border-border`), subtle background fill on hover (`hover:bg-secondary`).

### Telemetry Badges / Pills
- **Style:** Compact pill (`rounded-full px-2.5 py-0.5 text-xs font-mono`).
- **State:** Toned background with matching border and ink (e.g. `bg-emerald-500/10 text-emerald-600 border-emerald-500/20`).

### Cards & Panels
- **Corner Style:** 12px radius (`rounded-xl`).
- **Border:** 1px hairline (`border border-border`).
- **State Completeness:** Explicit skeletons for `loading`, zero-state illustrations for `empty`, retry triggers for `error`, permission boundary gates for `unauthorized`.

## Do's and Don'ts

### Do:
- **Do** maintain 100% truth in presentation: all buttons, toggles, and metrics must connect to verified backend routines.
- **Do** enforce tabular numbers (`tnum`) across all pricing, latency, token, and countdown displays.
- **Do** provide accessible keyboard shortcuts (`Cmd/Ctrl + K`, `Escape`) and visible focus indicators.
- **Do** preserve clean high-contrast light mode as the default experience.

### Don't:
- **Don't** use decorative purple/violet AI gradients or cyan-on-dark neon clichés.
- **Don't** use asymmetrical colored side-tabs or thick border-left accents on cards.
- **Don't** use kicker or eyebrow text above headings.
- **Don't** present hardcoded mock data as live operational state.
- **Don't** use decorative hairline grid-line backgrounds unless on an actual canvas, map, or blueprint viewport.

