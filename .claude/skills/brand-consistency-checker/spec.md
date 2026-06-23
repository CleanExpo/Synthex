# Spec — brand-consistency-checker (SYN-1049 foundation uplift)

## Finish line
Every brand-consistency audit this connector produces is foundation-checked against the locked CEO foundation and passes the `brand-voice-enforce` gate before it lands in the CEO batched-review queue.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — voice tag (Q2.5.5), Phase 4 voice amendments, universal + brand-specific taboos (Phase 1 / Phase 3.X)
- `.claude/memory/verification-gates.md` — gate state for any claim referenced
- Business DNA profile for the brand under audit (`.claude/skills/business-dna/`)
- `.claude/skills/synthex-standards/references/content-standards.md` — anti-pattern phrase list
- `lib/ai/content-scorer.ts` — Platform Fit and Engagement dimension scoring
- The content to audit (paste, post ID, or scheduled post reference)

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every audit returns the structured BRAND CONSISTENCY REPORT (vocabulary match %, anti-pattern count with each phrase listed, CTA quality Pass/Fail, tone match /10, overall verdict) — never vague feedback.
- [ ] Each flagged issue is line-level and includes an exact-phrase replacement fix.
- [ ] Anti-pattern phrases from content-standards.md are flagged, never silently approved.
- [ ] A verdict of CONDITIONAL/REVISE/FAIL blocks publish until the named issues are fixed.

## Referenced paths (only ones VERIFIED to exist on disk)
- `lib/ai/content-scorer.ts` [VERIFIED]
- `lib/ai/content-generator.ts` [VERIFIED]
- `app/dashboard/settings/brand-profile` [VERIFIED]
- `.claude/skills/business-dna/` [VERIFIED]
- `.claude/skills/synthex-standards/references/content-standards.md` [VERIFIED]
- `.claude/skills/platform-content-adaptor/` [VERIFIED]
- `.claude/memory/ceo-foundation.md` [VERIFIED]
- `.claude/memory/verification-gates.md` [VERIFIED]
- `.claude/rules/fabel-evidence-standard.md` [VERIFIED]

## Known drift (referenced but missing on disk)
- none

## Verification
- `grep -q "ceo-foundation" .claude/skills/brand-consistency-checker/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
