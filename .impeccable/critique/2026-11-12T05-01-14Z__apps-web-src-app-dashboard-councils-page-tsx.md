---
target: apps/web/src/app/dashboard/councils/page.tsx
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
target_identity: "file:/home/devine-general/Projects/Sila/apps/web/src/app/dashboard/councils/page.tsx"
target_fingerprint: "sha256:92229bf7e74ac9f7b3529f355d494853ab10445ee977970bd4ee3165fc3c83fb"
target_path: /home/devine-general/Projects/Sila/apps/web/src/app/dashboard/councils/page.tsx
timestamp: 2026-11-12T05-01-14Z
slug: apps-web-src-app-dashboard-councils-page-tsx
---
Method: dual-agent (A: a8eddcc1-a98d-41d0-9604-653932f95409 · B: 493285c7-4b2b-42c0-9c57-b43b22ad8016)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Auto-ratification marks `RESOLVED` with empty spec & unresolved dissents (`councils/page.tsx:1041-1065`); `10 online` vs 8 sliced (`dashboard/layout.tsx:144`); errors silently dropped (`634, 646`). |
| 2 | Match System / Real World | 2 | Unexplained `MAJ/WEI/UNA`, `ADR`, `MCP`, `XS`; fake file export (`2493`); static commit message string (`3213`). |
| 3 | User Control and Freedom | 2 | Auto-ratify commits ADR without human click (`1044-1064`); page modals lack `Escape` close & focus traps; archived threads & custom tasks vanish on reload. |
| 4 | Consistency and Standards | 2 | Light Mode renders `bg-zinc-950` dark islands in Terminal & Code Viewer; mixed `.command-center-reference` vs Tailwind; inconsistent modal `Escape` handling. |
| 5 | Error Prevention | 1 | `useEffect` auto-ratifies on mount (`1051-1065`) using fallback string; 1-click `Commit` & `Decompose & Dispatch` lack confirmation; `canMutate` (`370`) unused. |
| 6 | Recognition Rather Than Recall | 2 | Opaque `MAJ`/`WEI`/`UNA` (`2775`) and `XS` (`BashTerminal.tsx:585`) labels; hover-only `opacity-0` actions hidden from keyboard/touch. |
| 7 | Flexibility and Efficiency | 3 | Strong `Cmd/Ctrl+K`, `Ctrl+backtick`, `1-7`, `@Agent`, `/command`, `#L1-L25` context injection; lacks keyboard splitter resize & mobile panel switcher. |
| 8 | Aesthetic and Minimalist Design | 2 | High noise floor: 10+ simultaneous regions, 16 `8px-10px` `undersized-ui-text` hits, 5 stacked amber pills, severe header/sidebar truncation (`AG...`, `CODE & DIFF ...`). |
| 9 | Error Recovery | 1 | `councilsError` and `deliberationsError` (`634, 646`) never rendered; `AppSidebar` & `FileTreeExplorer` swallow errors into empty arrays or `DEFAULT_*` mocks. |
| 10 | Help and Documentation | 3 | Slash-command popover (`329-338`) and placeholder hints help, though governance acronyms lack inline tooltips. |
| **Total** | | **19/40** | **Poor** |

## Design Specificity Verdict

**LLM assessment:** Partially authored for NEIMAN OS's multi-agent governance domain, but drifts toward a generic dark-IDE clone (`bg-zinc-950`, `#121215`) and violates `DESIGN.md` (Alabaster Light default, no purple/cyan glows, no grid-line wallpaper, no eyebrow kickers) and `RULES.md` §5 (contradictory `RESOLVED` badge beside `"No architectural specification synthesized yet"`, hardcoded `CANONICAL_COUNCIL_MEMBERS`, fake 5-stage pipeline).

**Deterministic scan:** Static `impeccable detect --json` on `.tsx` files returned `[]` (missed utility patterns). Live headless Chromium CDP scans on `http://localhost:3000/dashboard/councils` returned **41 findings** at `1440x900` Light (`undersized-ui-text`: 16, `low-contrast`: 7, `tiny-text`: 7, `dark-glow`: 5, `nested-cards`: 5, `pulsing-dot`: 1), **38** at `390x844` Light, and **36** at `1440x900` Dark (`low-contrast`: 2).

## Overall Impression

High-capability engineering workspace undermined by contradictory governance state, severe multi-pane noise, inaccessible `< 24px` controls, broken `< 1280px` right-pane visibility, and a 3,310-line client monolith containing two React Rules-of-Hooks crash bugs.

## What's Working

1. **Terminal <-> CTO Feedback Loop (`BashTerminal.tsx:362-395`)**: Direct `Send Error to CTO` and `Attach` actions eliminate manual copy-paste between PTY stderr and CTO directives.
2. **Line-Range Code Context Injection (`councils/page.tsx:2655-2701`)**: Selecting `#L1-L25` in Code & Diff Viewer attaches scoped source directly into Composer pills.
3. **Zero `any` Business Logic**: 0 `: any` or `as any` across `councils/page.tsx`, `AppSidebar.tsx`, `BashTerminal.tsx`, and `FileTreeExplorer.tsx`.

## Priority Issues

- **[P0] What**: Conditional `useMemo` after early `return` in `councils/page.tsx:1199-1239` & `AgentContributionGraph.tsx:195-236`
  - **Why it matters**: Throws React Error #310 and crashes the workspace when company/collapse state transitions.
  - **Fix**: Move `useMemo` hooks above early returns; remove `try/catch` around `useQueryClient()`.
  - **Suggested command**: $impeccable harden

- **[P0] What**: Contradictory `RESOLVED` vs empty Spec & auto-ratification `useEffect` (`councils/page.tsx:1011-1065`)
  - **Why it matters**: Displays `RESOLVED` + `✓ Ratified & Committed` while `synthesized_decision` is null and 5 dissents remain open.
  - **Fix**: Remove auto-ratification from `quorumMutation.onSuccess` and mount `useEffect`; block ratification until `synthesized_decision` exists and operator explicitly confirms.
  - **Suggested command**: $impeccable harden

- **[P0] What**: Right inspector `<aside>` (`hidden xl:flex`, `councils/page.tsx:2315`) & inline `w-72` mobile sidebar (`AppSidebar.tsx:395`)
  - **Why it matters**: Spec, Code/Diff, Tasks, Git, and docked hubs vanish below `1280px`; mobile `390px` view is crushed with 38 overflowing header items (`right: 744px`).
  - **Fix**: Render `<aside>` as a `< xl` slide-over drawer + mobile segmented view bar; convert `AppSidebar` to an off-canvas drawer below `md`.
  - **Suggested command**: $impeccable adapt

- **[P1] What**: Hardcoded mock fallbacks (`CANONICAL_COUNCIL_MEMBERS`, `DEFAULT_*`, `claude-3-5-sonnet`), fake 5-stage pipeline, unpersisted tasks/exports, and dropped `councilsError`/`deliberationsError`
  - **Why it matters**: Violates `RULES.md` §5 Truth in Presentation and `PRODUCT.md` Dynamic Model Discovery; hides backend errors with zero retry path.
  - **Fix**: Hydrate strictly from API with explicit `Loading`/`Empty`/`Error` retry states and `canMutate` permission gating.
  - **Suggested command**: $impeccable harden

- **[P1] What**: WCAG AA contrast failures (7 Light, 2 Dark), `8px-10px` micro-text, nested `<button>` in `<div onClick>`, invisible focus rings, and `26/51` targets `< 24px`
  - **Why it matters**: Fails WCAG 1.4.3, 2.1.1, 2.4.7, 2.5.8, and 4.1.2 for keyboard, screen-reader, and touch users.
  - **Fix**: Enforce `>= 11px` labels, `>= 4.5:1` semantic ink pairs, sibling `<button>` semantics, `focus-visible:ring-2`, and `>= 24px` (`44px` mobile) hit targets.
  - **Suggested command**: $impeccable audit

## Persona Red Flags

**Alex (Power User)**: Docked `/tasks`/`/git`/`/mcp` commands open a `hidden xl:flex` panel on `< 1280px` screens; custom tasks vanish on reload; bare `1-7` hotkeys risk hijacking interactive focus.

**Sam (Accessibility / Keyboard)**: Nested `<button>` inside `<div onClick>` (`councils/page.tsx:2944-2966`), zero `<h1>`, invisible focus ring on brand link, `opacity-0` hover-only actions, and modals missing `Escape` / focus traps.

**Jordan (First-Timer)**: `RESOLVED` deliberation showing `"No architectural specification synthesized yet..."` + 5 open dissents + unexplained `MAJ/WEI/UNA` and `XS` controls.

## Minor Observations

- Right Panel expands Spec, 5 Dissents, Tasks, and 23 Git files simultaneously; BashTerminal packs 11+ header buttons (`councils/page.tsx`, `BashTerminal.tsx`).
- `BashTerminal.tsx` hardcodes `bg-zinc-950` (81 palette hits vs 4 semantic tokens) during Light Mode; `globals.css` retains cyan glows, grid wallpaper, and `* { animation-duration: .01ms !important }`.
- `councils/page.tsx` is a 3,310-line client monolith; `dashboard/layout.tsx:250` `useEffect` lacks a dependency array; `10 online` mismatches `.slice(0, 8)`.

## Questions to Consider

- Should Panel 6/7/8 become a single-expanded accordion to cut extraneous cognitive load and eliminate `AG...` / `CODE & DIFF ...` truncation?
- Should `Ratify & Commit Spec` stay hard-blocked until `synthesized_decision` exists and all dissents are resolved or explicitly overridden?
- Should `BashTerminal` and `Code & Diff Viewer` adopt Light Ceramic Alabaster tokens by default to match `DESIGN.md`?
