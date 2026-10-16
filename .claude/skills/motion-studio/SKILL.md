---
name: motion-studio
description: >-
  Make Claude-Motion-quality motion graphics (animated stats, comparisons,
  case studies, how-tos, lists, explainers) for a portfolio brand or client,
  from their own content, as a durable orchestrated job: SPM sizes it,
  the Orchestrator runs brief → house style → plan → fact check → render →
  one-still-per-second critique → one-defect fixes → human approval → export.
  Uses Synthex lib/motion + Remotion compositions, or writes a Claude Motion
  brief for Team/Enterprise claude.ai. Use when asked for a motion video,
  animated explainer, "Claude Motion", or a video generation option that is
  not AI footage. IDE-only.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: action-skill
  triggers:
    - claude motion
    - motion graphics
    - animated explainer
    - animate this report
    - motion video
  requires:
    - spm
    - remotion-brand-research
    - remotion-motion-language
    - remotion-script
    - remotion-direction
    - remotion-composition-builder
    - remotion-professionalism
    - remotion-production
    - brand-voice-enforce
---

# Motion Studio — the durable motion-graphics agent

Spec: `docs/ree/MOTION-STUDIO-SPEC.md`. Code: `lib/motion/` (brief, house style, fact guard, planner, Claude hand-off, job state machine), API `POST /api/brand-video/motion-plan`, panel in Brand Video Studio. Research: 2nd Brain `claude-motion-studio-2026-10`.

**What it is:** motion graphics built as code from the brand's own words, numbers, charts and real photos — the same principle as Claude Motion (no video-generation model, no generated footage or people). It complies with `.claude/rules/real-images-only.md`: photos come only from the owned reference library or the client's supplied real images.

## Roles

- **SPM (`/spm`)** — front door. Sizes the request, confirms the brand is approved (brand preflight), the source exists, and the output's purpose, audience and placement. Locks a Done contract for anything beyond a single video.
- **Orchestrator (this skill)** — runs the job through the state machine in `lib/motion/job.ts` and records each event id, so a retry never repeats a step:
  `BRIEFED → PLANNED (or BLOCKED_FACTS) → RENDERED → CRITIQUED (or NEEDS_FIX ×≤3 → ESCALATED) → APPROVED → EXPORTED`.
- **Specialists (existing skills):** `remotion-brand-research` / `remotion-motion-language` (house style), `remotion-script` + `remotion-direction` (brief and shots), `remotion-composition-builder` (new composition when none fits), `remotion-professionalism` (critic), `remotion-production` (render evidence), `brand-voice-enforce` (words).
- **Human** — approves the exact rendered file before anything is exported or published. No auto-publish, ever.

## Procedure

1. **Brief, not wish.** Fill the `MotionBrief`: brand, placement (muted feed vs with sound), length, audience, CTA, the **source** (the only place facts may come from), content by kind, and any derived figures (declared operation and inputs).
2. **House style.** `resolveHouseStyle(slug)` from BrandConfig colour, typography and motion tokens. If `BrandConfig.motion` is a stub, run `remotion-brand-research` → `remotion-motion-language` first. Style only — never another brand's logos, product shots or trademarks.
3. **Plan + fact check.** `POST /api/brand-video/motion-plan` (or `planMotion()`): returns the composition, props, on-screen lines, fact check and the Claude Motion brief. **422 UNSUPPORTED = a number is not in the source; fix the brief, never the guard.** 422 PARTIAL = layout problem (too many words for a muted feed, no composition for that aspect).
4. **Render** (choose one):
   - **Remotion (default):** render the planned composition locally with the props (`npx remotion render lib/remotion/index.tsx <plan.compositionId> out.mp4 --props=props.json` with `props.json` = `plan.props`; entry `lib/remotion/index.tsx` registers the root; see `scripts/render-brand-videos.ts` for the programmatic path), or `remotion-render-pipeline`. Add ElevenLabs narration only for placements with sound, using the brand voice ID (confirm it first).
   - **Claude Motion (Team/Enterprise claude.ai):** paste the returned brief into a chat; export MP4 1080p. Check the plan's on-screen lines against the result.
5. **Critique.** Extract one still per second (`plan.critiqueFrames`) and a 200px-wide copy; `remotion-professionalism` judges each like a senior brand design director: legibility, clipping, hierarchy (one hero element at 60–70% of the frame), pacing, brand fit, "does it look generated or cheap?". Record defects.
6. **Fix one defect at a time** ("Fix one defect, then finish: … Keep everything else exactly as it is."), re-render, re-critique. Three rounds max, then escalate to a human.
7. **Approve and export.** A human approves the exact MP4 (hash). Then export or hand to scheduling (`marketing-operations-director`). Record the event.

## Guardrails

- No spend without approval: Claude Motion uses plan usage heavily (one creator reported 90% of monthly org credits); build one, check, then the next. Remotion renders are local by default; no server render is configured.
- **Remotion licence:** company use may need a paid Remotion company licence — confirm Unite Group's status before client work `[UNCONFIRMED]`.
- Every on-screen number traces to the source or a recomputed declared derivation. Availability claims ("24/7") must be in the source or the brand's `*.claims.md` approved facts.
- Muted placements: every point readable as on-screen text (≤ 8 words per line).
- Real images only; no stock; no invented people, quotes or testimonials.
