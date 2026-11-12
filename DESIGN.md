---
name: NEIMAN OS Design System
description: Sovereign Command Deck — Obsidian Monochrome & Semantic Telemetry Architecture
colors:
  primary: "#171717"
  primary-dark: "#FAFAFA"
  bg-light: "#FAFAFA"
  bg-dark: "#0A0A0A"
  surface-light: "#FFFFFF"
  surface-dark: "#141414"
  surface-elevated-light: "#F4F4F5"
  surface-elevated-dark: "#242424"
  text-light: "#171717"
  text-dark: "#F4F4F5"
  text-muted-light: "#71717A"
  text-muted-dark: "#999999"
  border-light: "#E0E0E0"
  border-dark: "#2E2E2E"
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
    textColor: "#FAFAFA"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#262626"
  card-surface:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
---

# Design System: NEIMAN OS

## Overview

**Creative North Star: "The Sovereign Command Deck"**

NEIMAN OS is built for operators who value information density, precision, and architectural calm over decorative spectacle. It blends the crisp, typographic restraint of modern developer instruments (Linear, Vercel, Cursor) with the real-time observability of an aerospace telemetry center. Every pixel is purposeful, legible, and directly tied to live underlying state.

The interface defaults to a clean Alabaster Monochrome Canvas (`#FAFAFA`) with deep Slate Black ink (`#171717`) for effortless daytime readability, while fully supporting an Obsidian Monochrome dark mode (`#0A0A0A` canvas, `#141414` elevated surface) with crisp off-white (`#F4F4F5`) focal actions and semantic telemetry beacons. Cliché AI tells—such as purple-violet gradients, decorative grid-line wallpapers, and artificial side-tab accent bars—are strictly banished.

**Key Characteristics:**
- **Calm, High-Contrast Precision:** 4.5:1+ WCAG contrast ratios across all states, light and dark.
- **Tonal Hierarchy:** Depth is conveyed via subtle 1px hairlines and structured background surfaces rather than loud drop shadows.
- **High-Scanability Telemetry:** Tabular figures (`font-variant-numeric: tabular-nums`), monospaced timestamps, and state beacons communicate system health in milliseconds.
- **Keyboard-First Ergonomics:** Universal command palette (`Cmd/Ctrl + K`), integrated bash terminal toggle (`Ctrl + \``), visible focus indicators, and accessible interactive landmarks.

## Colors

The palette balances authoritative monochrome foundations with purposeful semantic telemetry beacons.

### Primary
- **Sovereign Ink / Obsidian White** (`#171717` in Light Mode / `#FAFAFA` in Dark Mode): Used strictly for primary actions, active navigation states, and verified system focal points.

### Semantic Telemetry
- **Nominal Emerald** (`#059669` / `#10B981`): Healthy worker state, passing checks, `SUPPORTS` council stances, live PTY connections.
- **Gate Amber** (`#B45309` / `#F59E0B`): Human-in-the-loop approval gates, recorded dissent/trade-offs, rate-limit cooldowns.
- **Circuit Rose** (`#E11D48` / `#F43F5E`): Quota exhaustion, critical policy violations, `OBJECTS` council stances, circuit-breaker trips.

### Neutral
- **Alabaster Canvas** (`#FAFAFA`): Default light mode ground (`--background`).
- **Jet Obsidian** (`#0A0A0A` / `#141414`): Default dark mode ground (`--background`) and elevated card surface (`--card`).
- **Slate Ink** (`#171717` / `#F4F4F5`): Primary text token (`--foreground`); ensures crisp contrast against canvas.
- **Hairline Border** (`#E0E0E0` / `#2E2E2E`): Crisp 1px structural dividing lines (`--border`).

### Named Rules
**The Rarity Rule.** The primary high-contrast fill (`bg-primary`) is restricted to <= 10% of any given operational viewport. Its scarcity preserves intentional hierarchy.
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
- **Label / Telemetry** (Medium 500, 0.75rem / 12px, tracking +0.02em, tabular-nums): Latency numbers, model IDs, token counts, confidence percentages, timestamps.

### Named Rules
**The No-Eyebrow Rule.** No kicker or eyebrow labels above headings. The headline carries its own context without decorative scaffolding.
**The Tabular Numbers Rule.** All metrics, countdowns, confidence percentages, timestamps, and pricing displays must enforce tabular figures (`font-variant-numeric: tabular-nums`).

## Layout

- **Container Model:** Full-viewport 3-column command deck (`AppSidebar` + `Center Conversation & Terminal` + `Right Stacked Spec/Tasks/Git/ADR Artifact Pane`) with collapsible sections.
- **Spatial Grid:** 8px base grid rhythm (`4px`, `8px`, `16px`, `24px`, `32px`, `48px`).
- **Responsive Adaptivity:** Grid topologies collapse cleanly from triple-pane desktop command centers to single-column tablet and mobile views.

## Elevation & Depth

Surfaces are flat at rest, relying on tonal contrast and 1px crisp hairline borders for structural boundary definition. Soft shadows are reserved exclusively for floating elements (command palette dialogs, dropdown popovers, slide-over panels).

### Shadow Vocabulary
- **Popover Elevation** (`box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.06)`): Used on dropdown menus, command palettes, and floating action cards.

## Shapes

- **Card Radius:** Standardized at 12px (`rounded-xl`).
- **Control Radius:** Standardized at 8px (`rounded-lg`) or 6px (`rounded-md`) for buttons, inputs, and toggles.
- **Pills:** Full pill radius (`rounded-full`) or compact badge radius (`rounded`) is reserved for status badges, tags, and telemetry beacons.

## Components

### Buttons
- **Shape:** 8px radius (`rounded-lg`).
- **Primary:** Solid Sovereign Ink (`#171717` light / `#FAFAFA` dark), high-contrast foreground text, 8px 16px padding.
- **Hover/Focus:** Subtle luminance shift (`bg-primary/90`), visible focus ring (`focus-visible:ring-1 focus-visible:ring-ring`).
- **Secondary:** Transparent or elevated surface (`bg-secondary/50`) with 1px border (`border-border`), subtle background fill on hover (`hover:bg-secondary`).

### Telemetry Badges / Pills
- **Style:** Compact badge (`rounded px-2 py-0.5 text-[10px] font-mono tabular-nums`).
- **State:** Toned background with matching border and ink (e.g. `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` for `SUPPORTS`, `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20` for `OBJECTS`).

### Cards & Panels
- **Corner Style:** 12px radius (`rounded-xl`).
- **Border:** Uniform 1px hairline (`border border-border`). Never use thick `border-l-4` side accents.
- **State Completeness:** Explicit skeletons for `loading`, zero-state illustrations for `empty`, retry triggers for `error`, permission boundary gates for `unauthorized`.

## Do's and Don'ts

### Do:
- **Do** maintain 100% truth in presentation: all buttons, toggles, heatmaps, and metrics must connect to verified backend routines.
- **Do** enforce tabular numbers (`tnum`) across all pricing, latency, token, confidence, and countdown displays.
- **Do** provide accessible keyboard shortcuts (`Cmd/Ctrl + K`, `Ctrl + \``, `Escape`) and visible focus indicators.
- **Do** preserve clean high-contrast light mode as the default experience alongside Obsidian monochrome dark mode.

### Don't:
- **Don't** use decorative purple/violet AI gradients or cyan-on-dark neon clichés.
- **Don't** use asymmetrical colored side-tabs or thick border-left (`border-l-4`) accents on cards.
- **Don't** use kicker or eyebrow text above headings.
- **Don't** present hardcoded mock data or synthetic contribution history as live operational state.
- **Don't** use decorative hairline grid-line backgrounds unless on an actual canvas, map, or blueprint viewport.
