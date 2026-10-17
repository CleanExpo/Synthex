# Motion Studio — Mission Control vision spec (fable-engine format)

**16/10/2026 · Synthex · REE workstream.** Founder request: embed Claude Motion as a video generation option in Synthex, REE the delivery skills, build the durable agent with the Orchestrator and SPM, through the Mission Control Vision Pathway.

## 1. Finish line

Done when a Synthex user can pick **Motion graphics** in Brand Video Studio, submit a brief built from their own content, and get a fact-checked, brand-styled plan and Claude Motion brief; and an operator can take that plan through render → critique → approval → export with every step recorded and no invented number on screen.

Rejected finish lines: "call Claude Motion from Synthex" (no public API `[VERIFIED: support.claude.com 17454997, claude.com dashboards-and-motion, 16/10/2026]`); "generate AI video footage" (conflicts with real-images-only).

## 2. Decision up front

Build Synthex's own Motion: the **same principle** as Claude Motion (code-built animation from your own content) on the Remotion stack Synthex already has (21 compositions, BrandConfig motion tokens, claims registers, Remotion skill suite). Add Claude Motion as an **optional hand-off** for teams on Claude Team/Enterprise. Phase M1 ships plan-only (no spend); rendering in production waits for the durable-substrate decision.

## 3. Goals and non-goals

**Goals:** Motion option in Brand Video Studio; brief schema; house style from BrandConfig; deterministic planner; fact guard; Claude Motion hand-off brief; durable job state machine; orchestrated operator skill.

**Non-goals (M1):** server-side rendering; persistence of motion jobs (needs a schema decision); AI-generated footage or people; auto-publishing; new providers or spend; Claude Motion automation (no API).

## 4. Approach

The method that tested best (six tutorials, 2nd Brain `claude-motion-studio-2026-10`) has three levers. Each maps to Synthex:

| Lever                                                          | Synthex                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Brief, not wish (what, length, exact words, where it plays)    | `MotionBriefSchema` + panel                                                      |
| House-style file (tokens + motion rules)                       | `resolveHouseStyle()` / `styleParagraph()` from BrandConfig                      |
| Self-critique (still every 1s, 200px check) + one-defect fixes | `plan.critiqueFrames`, `remotion-professionalism`, `oneDefectFix()`, job loop ≤3 |

Plus Synthex-specific: the **fact guard** (every figure from the source or a recomputed declared derivation) and the **durable state machine**.

## 5. Phased plan

| Phase                | Scope                                                                                                                                                        | Done when                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **M1 (this branch)** | `lib/motion`, `POST /api/brand-video/motion-plan`, Brand Video Studio panel, `motion-studio` skill, this spec                                                | Contract `w_8686427ff6ee` C1–C8 pass                                    |
| M1.1 (this branch)   | MotionStudio composition (brand fonts, signature motion, beats, CTA end card, 3 aspects + green screen); guide-shaped Claude Motion brief; required headline | Contract `w_12da3e14b979` C1–C10 pass; DR sample rendered and critiqued |
| M2                   | Claims-register facts loaded server-side; captions and ElevenLabs narration for sound placements; real-photo beats from the owned library                    | Each placement rendered and critiqued per second                        |
| M3                   | Durable execution on the approved substrate (Vercel Workflow or Inngest — REE Phase 4 decision); persisted motion jobs (schema approval); render worker      | A job survives restarts; replayed events are no-ops in production       |
| M4                   | Approval + export hand-off to scheduling; usage/cost receipts                                                                                                | Exact-artifact approval recorded; no publish without it                 |

## 6. Data model

M1 stores nothing. M3 needs a `motion_jobs` table (state, events, plan, render hash, approver) — schema approval required.

## 7. Security and cost guardrails

Auth + rate limit + brand preflight on the API; no DB, network or provider calls in M1 (tested). Claude Motion usage is plan-metered and heavy `[UNCONFIRMED: creator report of 90% monthly credits]`. Remotion company licence status `[UNCONFIRMED]`.

## 8. Risk and assumption register

- `[UNCONFIRMED]` Remotion company licence requirement for Unite Group.
- `[UNCONFIRMED]` Claude Motion API timing; we assume none.
- `[INFERENCE]` Deterministic planning plus an LLM-filled brief gives more consistent results than free-form generation; to be proved by side-by-side tests in M2.
- Portrait and square: covered since M1.1 by the brand-styled `MotionStudio` composition in 16:9, 9:16 and 1:1, plus a green-screen placement (RoboNuggets guide, 15/10/2026) for keying over real footage.
- The requested source video "How to use Claude MOTION better than 99% of people (in 3 simple steps)" was not found; the method is built from six other tutorials plus Anthropic's pages.

## 9. Open questions

1. Is Unite Group on Claude Team or Enterprise (Claude Motion hand-off)?
2. Remotion company licence: held?
3. Durable substrate: Vercel Workflow or Inngest?
4. Which brand pilots first (DR emergency explainers or CCW product how-tos)?
5. Approve the `motion_jobs` table for M3?

## 10. Verification plan

`donectl verify` on `/code/wt/synthex-motion` (C1–C8: unit suites, mutants, type-check, lint, full Jest, scope), then an independent review bound to the final SHA before any push.
