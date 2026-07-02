# Spec — google-search-console (SYN-1049 foundation uplift)

## Finish line

Every artefact this connector produces — GSC data interpretation, indexing triage, coverage analysis, sitemap and clicks-drop diagnostics, and any client-facing reporting derived from them — is foundation-checked and gate-passed (brand-voice-enforce) before it lands.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — verification gates for metric/traffic claims, universal taboos
- `.claude/memory/verification-gates.md` — gate state for any claim referenced
- `.claude/rules/fabel-evidence-standard.md` — evidence-tag standard ([VERIFIED]/[INFERENCE]/[UNCONFIRMED])
- Live GSC data via `lib/google/search-console-oauth.ts` (`getSearchAnalytics`, `getUrlInspection`, `getCoverageReport`, `listSitemaps`, etc.)
- Cron-snapshot metrics from `GSCSnapshot` / `GSCProperty` Prisma models (populated by `gsc-monitor` cron)

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every metric/traffic claim emitted (clicks, impressions, CTR, position, coverage counts) carries exactly one evidence tag; projected results are never stated as fact (respects GSC 2-day data lag and averaged-position caveats from Domain Knowledge).
- [ ] Client-facing artefacts route through `brand-voice-enforce` before the CEO batched-review queue; a REJECT blocks until the quoted offending string is fixed.
- [ ] Diagnostic outputs distinguish [VERIFIED] live GSC/URL-Inspection data from [INFERENCE] decision-tree conclusions and [UNCONFIRMED] causes (e.g. thin content, algorithm rollout).

## Referenced paths (only ones VERIFIED to exist on disk)

- `lib/google/search-console-oauth.ts`
- `lib/google/google-auth.ts`
- `hooks/useGSCProperties.ts`
- `hooks/useSearchConsole.ts`
- `app/api/cron/gsc-monitor/route.ts`
- `app/api/cron/gsc-auto-index/route.ts`
- `app/api/seo/search-console/properties/route.ts`
- `app/api/seo/search-console/analytics/route.ts`
- `app/api/seo/search-console/indexing-status/route.ts`
- `app/api/seo/search-console/indexing/route.ts`
- `app/api/seo/search-console/sitemaps/route.ts`
- `app/api/seo/search-console/sitemaps/submit/route.ts`

## Known drift (referenced but missing on disk)

- none

## Verification

- `grep -q "ceo-foundation" .claude/skills/google-search-console/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
