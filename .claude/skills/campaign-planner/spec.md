# Spec — campaign-planner (SYN-1049 foundation uplift)

## Finish line

Every content calendar / posting schedule this connector produces is foundation-checked against the locked cadence map and taboos, then gate-passed through `brand-voice-enforce`, before it lands in the CEO batched-review queue or the scheduling system.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — cadence map (Q2.5.3), universal + brand-specific taboos, frequency cap
- `.claude/memory/verification-gates.md`
- Business DNA for the brand (`.claude/skills/business-dna/`) — content pillars, voice, audience outcome
- Campaign parameters collected from the user (goal, duration, platforms, frequency, key dates, budget, CTA)

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every calendar slot names platform + specific hook angle + content pillar (from Business DNA) + CTA direction — never a generic "Educational post" placeholder.
- [ ] Per-platform cadence respects the foundation cadence map / frequency cap (Q2.5.3) rather than a generic Mon/Wed/Fri three-pillar arc.
- [ ] Generated batch content is scored via `lib/ai/content-scorer.ts` and routed through `brand-voice-enforce` before scheduling.
- [ ] Posting times carry an evidence tag (`[INFERENCE]` for default best-time guidance; `[VERIFIED]` only when backed by Synthex analytics).

## Referenced paths (only ones VERIFIED to exist on disk)

- `lib/ai/content-scorer.ts`
- `app/api/analytics/`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)

- `app/api/schedule/` — referenced in SKILL.md (Batch Content Generation: `POST /api/schedule`, and Reference: `app/api/schedule/`). The actual directory on disk is `app/api/scheduler/`. Path drift — confirm the correct scheduling endpoint before relying on it.

## Verification

- `grep -q "ceo-foundation" .claude/skills/campaign-planner/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
