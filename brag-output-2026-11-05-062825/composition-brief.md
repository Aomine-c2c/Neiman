# HyperFrames Composition Brief: NEIMAN

## Objective
Create a short, shareable product film for NEIMAN that shows its operational command center and operator review model accurately.

## Output
- Composition directory: `brag-output-2026-11-05-062825/composition/`
- Rendered video: `brag-output-2026-11-05-062825/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `/home/devine-general/Projects/Sila`
- Primary files read: `README.md`, `DESIGN_SYSTEM.md`, `apps/web/src/app/globals.css`, `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/components/control-room/ControlRoomDashboard.tsx`, `apps/web/src/components/control-room/CommandCenterReferenceLayout.tsx`
- Product name: NEIMAN — Autonomous Organization OS
- Tagline / strongest claim: “Intelligence in motion.”
- Key UI or visual moment to recreate: Control Room panels for workforce, CTO directives, approvals, live audit telemetry, and provider health.
- Copy that must appear verbatim:
  - “NEIMAN”
  - “Intelligence in motion.”
  - “HUMAN REVIEW”
  - “AUDIT TRAIL”

## Creative Direction
- Tone preset: polished
- Creative direction: restrained operations-console film; confident, candid, technically grounded
- Interpretation: measured transitions and readable type; show operator controls and review paths without suggesting unverified work or live status.
- Angle: An operational command center that keeps human authority visible.
- Hook: “Build the organization. Keep the operator in charge.”
- Outro / punchline: “NEIMAN — Intelligence in motion.”
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Fabricated metrics, provider status, audit events, task completion, or claims that agents act without operator governance

## Visual Identity
- Background: `#030712`
- Text: `#f8fafc`
- Accent: `#00f2fe`
- Display font: JetBrains Mono
- Body font: JetBrains Mono
- Visual references from the project: compact cyan-bordered Control Room panels, dark command canvas, small uppercase telemetry labels.

## Storyboard
Use `brag-plan.md` as the creative contract.

Scene summary:
1. Operator authority — 3.6s — wordmark and hook.
2. Control Room — 5.0s — source-faithful panels, explicitly labeled workspace preview, no invented telemetry.
3. Governed work — 5.4s — directive, work, human review, audit trail.
4. Brand close — 6.0s — supported product capabilities and tagline.

## Audio
- Audio role: restrained professional support.
- Audio arc: soft instrumental under the interface; fade to silence at the close.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: volume 0.18; gentle fade-in and fade-out.
- Music cue guidance: bundled preset at `/home/devine-general/Projects/Sila/.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`; estimated 109.96 BPM; candidate major anchors at 8.74s, 13.11s, and 17.47s.
- Audio-reactive treatment: none.
- Audio-coupled moments: restrained panel reveal and one soft review-gate accent.
- SFX selection guidance: one low-key interface accent; avoid typing or success sounds.
- SFX analysis guidance: `/home/devine-general/Projects/Sila/.agents/skills/brag/assets/sfx/sfx-analysis.md` if available.
- Exact SFX choice: use only if a matching low-risk asset exists; otherwise the music bed is sufficient.
- Audio files: `composition/assets/music/`.

## HyperFrames Instructions
Use the scaffolded HyperFrames project and native clip/timeline conventions. The composition must show a source-faithful UI, keep all text readable, and be between 15–25 seconds. Do not publish remotely. Run `npx hyperframes check` before rendering. Preview the composition and wait for user approval before rendering the final video.
