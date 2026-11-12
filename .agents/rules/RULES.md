---
trigger: always_on
---

# NEIMAN Architecture & Engineering Rules

## 1. Application Clients & Delivery Surfaces
* **Next.js + React** → Primary, canonical web interface (`apps/web`).
* **Tauri** → Desktop application wrapper (`apps/web/src-tauri`) providing native OS performance and system integration.
* **TUI** → Optional terminal user interface for operator environments and headless administrative control.

## 2. Language & Type Safety
* **TypeScript Throughout Frontend**: Strict TypeScript typing across all components, API clients, hooks, store models, and utilities (`strict: true`, zero untyped `any` business logic).

## 3. Theming & Aesthetics
* **Light Mode as Default**: The platform boots into clean, high-contrast, modern Light Mode by default.
* **Dark Mode Available**: Sleek obsidian / cyber-glow Dark Mode is fully supported and toggled with persistent user preference in `localStorage`.
* **Shared Design System**: Single source of truth for tokens, HSL palette variables, typography, border styling, and animations in `globals.css` and `tailwind.config.ts`.
* **Accessible Components**: Accessible ARIA roles, semantic HTML, high-contrast text ratios, visible focus indicators, and reduced-motion compliance.

## 4. Interaction & Ergonomics
* **Desktop-Optimized & Responsive**: Adaptive grid and flex topologies scaling from mobile viewports to multi-monitor desktop command centers.
* **Keyboard-First Navigation**: Global hotkeys, accessible focus traps, drawer dismissals with `Escape`, and rapid navigation.
* **Command Palette**: Universal `Cmd/Ctrl + K` command hub to navigate across all operational organizational domains instantly.
* **Real-Time Activity**: Dynamic telemetry feeds, live worker states, circuit-breaker updates, and observable workflow execution streams.

## 5. Architectural Integrity & Truth in Presentation
* **No Fake Functionality**: Buttons, toggles, and controls must trigger real, working routines. Never leave dummy non-functional UI controls.
* **No Hardcoded Mock Data Presented as Real**: Live operational screens consume verified backend state. Synthetic data is restricted strictly to labeled, unpersisted, isolated local development UI preview fixtures.
* **State Completeness**: Every view and data-driven component must explicitly handle:
  1. `Loading` state (skeletons / indicators).
  2. `Empty` state (clear zero-state calls to action).
  3. `Error` state (retry mechanisms and clear root-cause error feedback).
  4. `Permission` state (unauthorized access gating, role requirements, and read-only boundaries).
* **API-First Architecture**: Frontend must consume backend domain APIs rather than duplicating business logic or reimplementing governance decisions client-side.

## 6. Zero-Filler, High-Density Communication & Token Compression
* **Zero Polite Fluff / Preamble**: No conversational filler (`"Sure!", "Certainly", "In conclusion"`). Start directly on the technical payload.
* **Sentence Fragments over Prose Paragraphs**: Bullet points, compact clauses, dense status labels. Eliminate decorative transitions.
* **100% Technical Rigor**: Preserve exact file links, symbol names, commit SHAs, line numbers, and error codes verbatim. High information density, zero tokens wasted.
* **Engine Output Scrubbing**: All autonomous agent generation steps in NEIMAN OS must strip redundant discourse markers and format execution summaries as concise, actionable telemetry.