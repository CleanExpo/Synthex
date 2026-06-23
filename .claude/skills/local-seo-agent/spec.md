# Spec — local-seo-agent (SYN-1049 foundation uplift)

## Finish line
Every client-facing local-SEO artefact this connector orchestrates (onboarding plans, keyword maps, service-area page copy, citation/review/audit deliverables, monthly report cards) is foundation-checked and `brand-voice-enforce` gate-passed before it lands.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — GBP compliance (Q3.2.3), AI-search realism, schema discipline
- `.claude/memory/verification-gates.md` — gate state for any claim referenced
- `.claude/rules/fabel-evidence-standard.md` — evidence-tag standard for every claim
- Orchestrated sub-skills (declared in SKILL.md `requires`): `google-search-console`, `google-business-profile`, `competitive-local-strategy`, `google-updates-sentinel`

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every client-facing artefact (monthly report card, service-area page copy, review/citation deliverable) routes through `brand-voice-enforce` before the CEO batched-review queue.
- [ ] GBP review-generation and listing tactics stay inside the Q3.2.3 GBP-compliance rule (no incentivised reviews, no review gating, no artificial profiles).
- [ ] Every quantitative metric in a report card or audit carries exactly one evidence tag — projected results are never stated as fact.

## Referenced paths (only ones VERIFIED to exist on disk)
- `.claude/memory/ceo-foundation.md` [VERIFIED]
- `.claude/memory/verification-gates.md` [VERIFIED]
- `.claude/rules/fabel-evidence-standard.md` [VERIFIED]

## Known drift (referenced but missing on disk)
- none — SKILL.md references orchestrated skill names and hook/function identifiers (e.g. `fetchAnalytics`, `useGBPReviews`) but no `lib/...` or `app/api/...` file paths.

## Verification
- `grep -q "ceo-foundation" .claude/skills/local-seo-agent/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
