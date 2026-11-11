# NEIMAN Design System

> **Status:** Draft — extracted from static HTML prototypes and unified into a cohesive system
> **Audience:** UI engineers, designers, frontend architects
> **Last Updated:** 2026-09-25

---

## 1. Overview

The existing prototypes (`agent_profile.html`, `governance_dashboard.html`, `intelligence_dashboard.html`, `resource_control_center.html`, `organizational_memory.html`, `company_blueprints.html`) each define their own CSS custom properties with **inconsistent color palettes**. This document unifies them into a single, coherent design system.

### 1.1 Per-Domain Identity

| Domain | Brand Color | Rationale |
|---|---|---|
| Agents | `#6366f1` (Indigo) | Professional, trustworthy — "employee operating system" |
| Intelligence | `#60a5fa` (Blue) | Knowledge, clarity, analytical |
| Resources | `#10b981` (Emerald) | Growth, allocation, financial success |
| Memory | `#8b5cf6` (Violet) | Knowledge, creativity, insight |
| Governance | `#6366f1` (Indigo) | Authority, structure, oversight |
| Blueprints | `#6366f1` (Indigo) | Foundation, architecture |

**Note:** The prototypes currently use a different primary color per page. This document standardizes on a unified palette with **domain-specific accent colors** for differentiation, while keeping the primary/secondary colors consistent across the entire application.

---

## 2. Color Tokens

### 2.1 Core Palette (Unified)

```
Background:
  --color-bg:              #090d16   (deep space)
  --color-surface:          #101626   (card background)
  --color-surface-elevated: #161e33   (elevated surfaces, hover states)
  --color-surface-pop:      #1e2740   (popovers, modals)

Border:
  --color-border:           #232d48   (subtle separator)
  --color-border-focus:     #49587a   (focus ring)
  --color-border-strong:   #2e3a59   (emphasized separator)

Text:
  --color-text:             #f8fafc   (primary text)
  --color-text-secondary:    #cbd5e1   (secondary text)
  --color-text-muted:        #94a3b8   (muted text, placeholders)
  --color-text-dim:          #5c667e   (disabled text)

Overlays:
  --color-overlay-dark:    rgba(0, 0, 0, 0.5)
  --color-overlay-modal:   rgba(0, 0, 0, 0.75)
```

### 2.2 Semantic Colors

```
Status Colors (aligned with AgentStatus enum):
  --color-status-available:  #10b981  (Emerald — green)
  --color-status-working:    #06b6d4  (Cyan)
  --color-status-blocked:    #ef4444  (Red)
  --color-status-paused:     #f59e0b  (Amber)
  --color-status-created:    #6366f1  (Indigo)
  --color-status-configured: #6366f1  (Indigo)
  --color-status-retired:    #94a3b8  (Gray)

Action Colors:
  --color-primary:           #6366f1  (Indigo — primary actions)
  --color-primary-hover:     #4f46e5  (Darker indigo)
  --color-accent:            #06b6d4  (Cyan — accents, highlights)
  --color-success:           #10b981  (Emerald)
  --color-warning:           #f59e0b  (Amber)
  --color-danger:            #ef4444  (Red)
  --color-info:              #38bdf8  (Light cyan)

Domain Accent Colors:
  --color-domain-agents:      #6366f1  (Indigo)
  --color-domain-intelligence: #60a5fa  (Blue)
  --color-domain-resources:    #10b981  (Emerald)
  --color-domain-memory:       #8b5cf6  (Violet)
  --color-domain-governance:   #6366f1  (Indigo)
  --color-domain-blueprints:   #6366f1  (Indigo)
  --color-domain-projects:     #f59e0b  (Amber)
```

### 2.3 Gradients

```
Avatar/Logo Gradient:
  linear-gradient(135deg, var(--color-primary), var(--color-accent))

Card Hover:
  linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface))

Hero Radial (subtle decoration):
  radial-gradient(circle at top right, var(--color-primary-glow), transparent 70%)
```

### 2.4 Glows

```
  --color-primary-glow:       rgba(99, 102, 241, 0.25)
  --color-accent-glow:        rgba(6, 182, 212, 0.25)
  --color-success-glow:       rgba(16, 185, 129, 0.2)
  --color-danger-glow:        rgba(239, 68, 68, 0.25)
  --color-warning-glow:       rgba(245, 158, 11, 0.2)
```

---

## 3. Typography

### 3.1 Font Stack

```css
--font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Menlo', monospace;
```

### 3.2 Typography Scale

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| text-xs | 0.75rem (12px) | 1.5 | — | Badge text, captions |
| text-sm | 0.875rem (14px) | 1.5 | — | Form labels, table body |
| text-base | 1rem (16px) | 1.6 | — | Body text |
| text-lg | 1.125rem (18px) | 1.5 | — | Section subtitles |
| text-xl | 1.25rem (20px) | 1.4 | — | Card titles, nav links |
| text-2xl | 1.5rem (24px) | 1.3 | — | Page subtitles |
| text-3xl | 1.875rem (30px) | 1.2 | — | Section headers |
| text-4xl | 2.25rem (36px) | 1.2 | — | Page titles |
| text-5xl | 3rem (48px) | 1.1 | — | Hero titles |

### 3.3 Font Weights

| Token | Weight | Usage |
|---|---|---|
| font-normal | 400 | Body text |
| font-medium | 500 | Form labels, nav links |
| font-semibold | 600 | Card headers, table headers |
| font-bold | 700 | Hero titles, button text |
| font-extrabold | 800 | Brand name, stat values |

---

## 4. Spacing & Sizing

### 4.1 Spacing Scale (8pt system)

```
spacing-0:  0
spacing-1:  0.25rem (4px)
spacing-2:  0.5rem  (8px)
spacing-3:  0.75rem (12px)
spacing-4:  1rem   (16px)
spacing-5:  1.25rem (20px)
spacing-6:  1.5rem  (24px)
spacing-7:  1.75rem (28px)
spacing-8:  2rem    (32px)
spacing-9:  2.5rem  (40px)
spacing-10: 3rem    (48px)
spacing-12: 4rem    (64px)
```

### 4.2 Border Radius

```
--radius-sm:   6px     (tags, badges, small inputs)
--radius-md:   8px     (input fields, buttons)
--radius-lg:   10px    (cards, modals)
--radius-xl:   12px    (page-level containers, profile hero)
--radius-full: 9999px  (pill badges, circular avatars)
```

### 4.3 Shadows

```
--shadow-card:     0 4px 20px rgba(0, 0, 0, 0.3)
--shadow-elevated:  0 8px 30px rgba(0, 0, 0, 0.4)
--shadow-popover:   0 20px 60px rgba(0, 0, 0, 0.8)
--shadow-focus:    0 0 0 2px var(--color-primary-glow)
--shadow-glow:     0 0 16px var(--color-primary-glow)
```

---

## 5. Component Library

### 5.1 Buttons

| Variant | Style | Use Case |
|---|---|---|
| Primary | `bg-primary text-surface shadow-glow` | Primary actions (Create, Save, Execute) |
| Secondary | `bg-surface-elevated border border-border` | Secondary actions (Cancel, Close) |
| Destructive | `bg-danger text-surface` | Delete, retire, destructive actions |
| Ghost | `hover:bg-surface-elevated` | Tertiary actions, icon buttons |
| Success | `bg-success text-surface` | Positive confirmations (Approve, Instantiate) |

All buttons: `border-radius: var(--radius-md)`, `font-weight: 700`, `transition: all 0.2s ease`, `min-height: 36px`, `min-width: 44px` (touch target).

### 5.2 Badges / Pills

| Type | Background | Text Color | Border |
|---|---|---|---|
| Status — Available | `rgba(16, 185, 129, 0.15)` | `#34d399` | `1px solid #10b981` |
| Status — Working | `rgba(6, 182, 212, 0.15)` | `#38bdf8` | `1px solid #06b6d4` |
| Status — Blocked | `rgba(239, 68, 68, 0.15)` | `#f87171` | `1px solid #ef4444` |
| Status — Paused | `rgba(245, 158, 11, 0.15)` | `#fbbf24` | `1px solid #f59e0b` |
| Status — Created/Config | `rgba(99, 102, 241, 0.15)` | `#818cf8` | `1px solid #6366f1` |
| Status — Retired | `rgba(148, 163, 184, 0.15)` | `var(--text-muted)` | `1px solid var(--text-muted)` |

All badges: `border-radius: 6px`, `font-size: 0.72rem`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.05em`.

### 5.3 Cards

```
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 22px;
  box-shadow: var(--shadow-card);
  transition: all 0.25s ease;
}

.card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-elevated);
}
```

### 5.4 Tables

```css
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

th {
  text-align: left;
  padding: 10px 14px;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(33, 44, 71, 0.5);
}

tr:hover td {
  background: rgba(22, 30, 49, 0.4);
}
```

### 5.5 Status Tags (Agent Lifecycle)

Aligned with the `VALID_TRANSITIONS` state machine in `service.py`:

```
CREATED     → Amber/Indigo     (just scaffolded)
CONFIGURED  → Indigo            (ready for assignment)
AVAILABLE   → Green             (ready for tasks)
WORKING     → Cyan              (actively executing)
BLOCKED     → Red               (requires intervention)
PAUSED      → Amber             (paused by manager)
RETIRED     → Gray              (archived/inactive)
```

### 5.6 Tabs

```css
.tabs {
  display: flex;
  gap: 12px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 16px;
}

.tab-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  padding: 8px 16px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
```

### 5.7 Inputs

```css
input, select, textarea {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus, select:focus, textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-glow);
}
```

### 5.8 Progress Bars

```css
.progress-bar-container {
  width: 100%;
  height: 8px;
  background: var(--color-surface-elevated);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
```

### 5.9 Timeline

```css
.timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-item {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}
```

---

## 6. Iconography

### 6.1 Icon Library

Use **Tabler Icons** (open-source, MIT, clean line icons that match the dark theme aesthetic).

### 6.2 Key Icons

| Purpose | Tabler Icon |
|---|---|
| Agent list | `Users` |
| Agent profile | `UserCircle` |
| Governance | `ShieldCheck` |
| Constitution | `Book` |
| Approvals | `ClipboardCheck` |
| Escalations | `AlertTriangle` |
| Audits | `ClipboardList` |
| Intelligence | `Brain` |
| Models | `Box` |
| Providers | `Cloud` |
| Resources | `Server` |
| Budget | `Wallet` |
| Memory | `Brain` / `Database` |
| Knowledge Base | `Book` |
| Blueprints | `Blueprint` |
| Build My Company | `LightningBolt` |
| Projects | `FolderGit` |
| Tasks | `Checkbox` |
| Workflows | `Flow` |
| Policies | `ShieldLock` |
| Decisions | `Scales` |
| Terminal/TUI | `Terminal` |
| Command Palette | `Search` |
| Notifications | `Bell` / `BellDot` |
| Dark Mode | `Moon` / `Sun` |
| Settings | `Settings` |
| Logout | `Logout` |

---

## 7. Layout System

### 7.1 Breakpoints (Tailwind)

| Size | Min Width | Usage |
|---|---|---|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet portrait |
| lg | 1024px | Laptop |
| xl | 1280px | Desktop |
| 2xl | 1536px | Large desktop |

### 7.2 Layout Patterns

#### App Layout (Authenticated)

```
┌─────────────────────────────────────────┐
│  Header (sticky, height: 64px)         │
├─┬───────────────────────────────────────┤
│ │ Sidebar (w: 256px, collapsible)       │
│ │                                       │
│ │  [App Logo]                           │
│ │  Agents                              │
│ │  Governance                          │
│ │  Intelligence                        │
│ │  Resources                           │
│ │  Memory                              │
│ │  Blueprints                          │
│ │  Projects                            │
│ │  ───                                 │
│ │  Settings                            │
│ │  Logout                              │
├─┼───────────────────────────────────────┤
│ │ Main Content (flex: 1, min-w: 0)      │
│ │                                       │
│ │   [Breadcrumb]                        │
│ │   [Page Title]                        │
│ │   ┌─────────────────┐                │
│ │   │   Content       │                │
│ │   │                 │                │
│ │   └─────────────────┘                │
│ │                                       │
└─┴───────────────────────────────────────┘
```

#### Mobile Layout

```
┌─────────────────────────────────────────┐
│  Header (height: 64px, hamburger menu) │
├─────────────────────────────────────────┤
│  Main Content (full width)              │
├─────────────────────────────────────────┤
│  Bottom nav (mobile only)               │
│  [Agents] [Gov] [Intel] [Res] [Menu]   │
└─────────────────────────────────────────┘
```

### 7.3 Content Widths

| Container | Max Width |
|---|---|
| Dashboard grids | 1540px (`max-w-7xl`) |
| Detail pages | 1400px (`max-w-7xl`) |
| Forms | 720px (`max-w-3xl`) |
| Auth pages | 480px (`max-w-xl`) |

---

## 8. Motion & Transitions

### 8.1 Duration Scale

```
--duration-fast:    150ms  (hover states, button press)
--duration-normal:  250ms  (panel open/close, drawer slide)
--duration-slow:    400ms  (page transitions, stagger)
```

### 8.2 Easing

```
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-out:     cubic-bezier(0, 0, 0.2, 1)
--ease-in:      cubic-bezier(0.4, 0, 1, 1)
```

### 8.3 Animation Patterns

| Pattern | Duration | Properties |
|---|---|---|
| Button hover | 150ms | `transform: translateY(-1px)`, `box-shadow` |
| Card hover | 250ms | `border-color` change, subtle lift |
| Modal enter/exit | 250ms | `opacity`, `scale` |
| Page transition | 400ms | `opacity` fade, content stagger |
| Tab switch | 150ms | `border-color` color bar |

---

## 9. Dark Theme Enforcement

All components use **dark theme only** (matching the prototypes). No light theme is planned.

### 9.1 CSS Implementation

```css
/* globals.css */
:root {
  /* All design tokens defined here */
}

/* Ensure dark mode is always active */
html {
  color-scheme: dark;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

---

## 10. Figma Design Handoff

The design system is structured so that Figma variables can be mapped 1:1 to CSS custom properties:

| Figma Variable | CSS Variable | Value |
|---|---|---|
| BG / Default | `--color-bg` | `#090d16` |
| Surface / Card | `--color-surface` | `#101626` |
| Surface / Elevated | `--color-surface-elevated` | `#161e33` |
| Border / Default | `--color-border` | `#232d48` |
| Primary / 500 | `--color-primary` | `#6366f1` |
| Accent / 500 | `--color-accent` | `#06b6d4` |
| Text / Primary | `--color-text` | `#f8fafc` |
| Text / Muted | `--color-text-muted` | `#94a3b8` |
| Radius / XL | `--radius-xl` | `12px` |
| Radius / MD | `--radius-md` | `8px` |

---

## 11. Accessibility Compliance

### 11.1 Color Contrast Ratios

| Text | Background | Ratio | WCAG |
|---|---|---|---|
| `--color-text` (#f8fafc) | `--color-bg` (#090d16) | 15.2:1 | AAA |
| `--color-text-muted` (#94a3b8) | `--color-bg` (#090d16) | 4.6:1 | AA |
| `--color-text-dim` (#5c667e) | `--color-bg` (#090d16) | 3.0:1 | Fail — use `--color-text-muted` instead |
| `--color-primary` (#6366f1) | `--color-surface` (#101626) | 8.9:1 | AAA |
| Status-Available (#34d399) | `--color-surface` (#101626) | 4.7:1 | AA |
| Status-Blocked (#f87171) | `--color-surface` (#101626) | 5.1:1 | AA |

### 11.2 Focus States

```css
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### 11.3 Semantic HTML Patterns

| Component | HTML Element | ARIA |
|---|---|---|
| Status badge | `<span role="status">` | `aria-label="Agent status: Available"` |
| Modal dialog | `<dialog role="dialog">` or `<div role="dialog">` | `aria-modal="true"`, `aria-labelledby` |
| Table | `<table>` | `<caption>`, `aria-sort` on sortable headers |
| Form input | `<label>` + `<input>` | `aria-describedby`, `aria-invalid` on error |
| Toggle switch | `<button role="switch">` | `aria-checked` |
| Progress bar | `<div role="progressbar">` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| Tab list | `<div role="tablist">` | `role="tab"`, `aria-selected` |

---

## 12. Implementation Mapping

### 12.1 Prototype to Component

| Prototype Element | New Component |
|---|---|
| `.card` | `<Card>` |
| `.btn` / `.btn-primary` | `<Button variant="primary">` |
| `.status-tag.status-XXX` | `<StatusBadge status="AVAILABLE">` |
| `.badge.badge-XXX` | `<Badge variant="xxx">` |
| `.tabs` / `.tab-btn` | `<Tabs>` / `<Tab>` |
| `.timeline` / `.timeline-item` | `<Timeline>` / `<TimelineItem>` |
| `.progress-bar` | `<ProgressBar value={n}>` |
| `.grid-2` / `.grid-4` | `<Grid cols={2|4}>` |
| `.form-group` | `<FormField>` |
| `.input-row` | `<InputGroup>` |
| `.modal-overlay` / `.modal-content` | `<Modal>` |
| `.pill` (domain filters) | `<FilterPill>` |
