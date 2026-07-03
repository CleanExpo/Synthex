# Spec — business-dna (SYN-1049 foundation uplift)

## Finish line

Every Brand DNA profile and persona artefact this connector produces is checked against the locked CEO foundation and passes the `brand-voice-enforce` gate before it lands in the CEO batched-review queue or is persisted to the Synthex brand profile.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — voice tag (Q2.5.5), brand-specific taboos (Phase 3.X), audience-evidence base
- `.claude/memory/verification-gates.md`
- A user-supplied website URL (or pasted homepage text / brand kit when scraping is blocked)
- `lib/ai/website-analyzer.ts` — two-tier scraper (Firecrawl primary → native fetch fallback) returning description, audience, tone, products, credentials, social links
- `.claude/skills/synthex-standards/references/content-standards.md` — content quality reference

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Extracted DNA includes vocabulary pulled verbatim from the source (not inferred generics) and an explicit "what the brand is NOT" exclusion list.
- [ ] Target audience is defined by the outcome they seek, not demographics alone.
- [ ] Every client-facing artefact passes `brand-voice-enforce` before reaching the CEO batched-review queue.
- [ ] DNA fields persist only via the documented mapping (`POST /api/personas` for tone/vocabulary; `app/dashboard/settings/brand-profile` for visual style) — no ad-hoc writes.

## Referenced paths (only ones VERIFIED to exist on disk)

- `lib/ai/website-analyzer.ts`
- `app/api/personas/route.ts` (the `POST /api/personas` endpoint)
- `app/dashboard/settings/brand-profile`
- `.claude/skills/synthex-standards/references/content-standards.md`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)

- `lib/ai/brand-context-builder.ts` — referenced in SKILL.md "Storing to Synthex Brand Profile" (brand name, USP, audience mapping) but not present on disk.

## Verification

- `grep -q "ceo-foundation" .claude/skills/business-dna/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
- Resolving the `lib/ai/brand-context-builder.ts` drift (tracked, not fixed here).
