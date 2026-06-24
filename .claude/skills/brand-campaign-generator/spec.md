# Spec — brand-campaign-generator (SYN-1049 foundation uplift)

## Finish line

Every campaign this connector produces is checked against the locked foundation
and has passed the `brand-voice-enforce` gate before it reaches the CEO
batched-review queue or the Synthex scheduler.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — universal + brand-specific taboos, voice
  tag (Q2.5.5), Phase 4 voice amendments, cross-client boundary (Phase 3.4).
- `.claude/memory/verification-gates.md` — gate state for any referenced metric.
- Business DNA profile (via `business-dna` skill or user-described brand).

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Generated posts route through `brand-voice-enforce` before review/schedule.
- [ ] Every post scores ≥ 80 via `lib/ai/content-scorer.ts` (existing rule, retained).
- [ ] Platform-distinct hooks; exactly one CTA per piece (existing rule, retained).
- [ ] Quantitative claims carry an evidence tag; no projected result stated as fact.

## Referenced lib paths (verified to exist)
- `lib/ai/content-generator.ts`
- `lib/ai/content-scorer.ts`
- `lib/ai/content-repurposer.ts`
- `lib/ai/api-credential-injector.ts`
- `app/api/scheduler/` (real scheduling route; the SKILL body's `/api/schedule` is pre-existing drift, logged on SYN-1049)

## Verification
- `grep -q "ceo-foundation" .claude/skills/brand-campaign-generator/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to the existing campaign workflow, scoring, or scheduling behaviour.
