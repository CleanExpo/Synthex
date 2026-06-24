# Spec — competitive-local-strategy (SYN-1049 foundation uplift)

## Finish line
Every artefact this connector produces (benchmark reports, SWOT reviews, displacement plans, citation-gap analyses, positioning recommendations) is foundation-checked and brand-voice-gated before it lands in the CEO batched-review queue.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — verification gates for category/competitor claims, universal taboos
- `.claude/memory/verification-gates.md` — gate state for any claim referenced
- `lib/services/competitive-intel.ts` — `CompetitiveIntelligence` class / `competitiveIntel` singleton (benchmark, content-gap, hashtag, sentiment, strategic-insight methods)
- `lib/social/competitor-fetcher.ts` — public profile lookup across Twitter, Instagram, YouTube, Facebook, Reddit
- `app/dashboard/competitors/page.tsx` — competitor tracking UI surface

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every competitor/category claim in connector output is verification-gated against `ceo-foundation.md` + `verification-gates.md` before it is stated as fact.
- [ ] Every quantitative claim (review counts, engagement rates, percentile rankings, growth figures) carries exactly one evidence tag (`[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`).
- [ ] Client-facing artefacts route through `brand-voice-enforce` before the CEO batched-review queue; a REJECT blocks until the quoted string is fixed.
- [ ] Projected displacement / ranking outcomes are framed as hypotheses, never stated as achieved fact.

## Referenced paths (only ones VERIFIED to exist on disk)
- `lib/services/competitive-intel.ts`
- `lib/social/competitor-fetcher.ts`
- `app/dashboard/competitors/page.tsx`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)
- none

## Verification
- `grep -q "ceo-foundation" .claude/skills/competitive-local-strategy/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
