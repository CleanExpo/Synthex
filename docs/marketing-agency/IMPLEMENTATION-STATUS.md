# Marketing Agency Implementation Status

## Baseline

- Date: 2026-05-16
- Branch: codex/marketing-agency-green-path
- Dependency install: pass - `npm ci` completed; warning remains because repo expects Node 22.x and current shell is Node v26.0.0.
- Typecheck: pass - `npm run type-check`
- Lint: pass - `npm run lint`
- Tests: pass - `npm test -- --runInBand` now passes after fixing the jsdom `window` mutation in `tests/unit/lib/prisma.test.ts`.
- Build: pass - `npm run build` now passes with local gitignored placeholder values in `.env.local`.

## Current Milestone

- Milestone: M11 Video Production Mapping
- Status: green for code/test/build/playwright/Lighthouse actionable gates; SEO remains below threshold because private dashboard routes are intentionally blocked by `robots.txt`.

## Known Pre-Existing Failures

- Environment warning: `package.json` requires Node 22.x; current shell is Node v26.0.0.
- Prisma CLI drift: the plan's `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` command is stale for Prisma 7.7.0; the equivalent current command is `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
- Lighthouse SEO remains below threshold because authenticated dashboard routes are intentionally blocked by `robots.txt`.

## Latest Green Commands

- `npm ci`
- `npm run type-check`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npx jest tests/unit/marketing-agency/types.test.ts --runInBand`
- `npx jest tests/unit/marketing-agency/qa.test.ts --runInBand`
- `npx jest tests/unit/marketing-agency/orchestrator.test.ts --runInBand`
- `npx jest tests/unit/marketing-agency/campaign-route.test.ts --runInBand`
- `npx jest tests/unit/marketing-agency --runInBand`
- `npx playwright test tests/e2e/marketing-agency.spec.ts`
- `npx jest tests/unit/marketing-agency/remotion-scene-data.test.ts --runInBand`
- `npx prisma validate`
- `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /tmp/marketing-agency-schema.sql`
- `npx jest tests/unit/marketing-agency/persistence.test.ts --runInBand`
- `npx jest tests/unit/marketing-agency/provider-gates.test.ts --runInBand`
- `npx playwright test tests/e2e/marketing-agency.spec.ts`
- `npm run --silent marketing-agency:video-plan > /tmp/restoreassist-video-plan.json`
- `npm run --silent marketing-agency:apify-intel > /tmp/restoreassist-apify-intel.json`
- `npx lighthouse http://localhost:3010/dashboard/marketing-agency/restoreassist-launch --chrome-flags='--headless --no-sandbox' --extra-headers='{\"Cookie\":\"auth-token=...; cookie-consent=accepted\"}' --output=json --output-path=/tmp/lighthouse-marketing-agency-final-clean.json --quiet`
- `git diff --check`

## Completed Implementation Slices

- M2: Added `lib/marketing-agency/types.ts`, `lib/marketing-agency/fixtures/restoreassist.ts`, and `tests/unit/marketing-agency/types.test.ts`.
- M3: Added `lib/marketing-agency/evidence.ts`, `lib/marketing-agency/licensing.ts`, `lib/marketing-agency/qa.ts`, and `tests/unit/marketing-agency/qa.test.ts`.
- M4: Added `lib/marketing-agency/orchestrator.ts`, `lib/marketing-agency/export-manifest.ts`, `lib/marketing-agency/artlist/mock.ts`, and `tests/unit/marketing-agency/orchestrator.test.ts`.
- M5: Added authenticated `app/api/marketing-agency/campaigns/route.ts` and `tests/unit/marketing-agency/campaign-route.test.ts`.
- M6: Added `/dashboard/marketing-agency`, `/dashboard/marketing-agency/restoreassist-launch`, review panels under `components/marketing-agency/`, and `tests/e2e/marketing-agency.spec.ts`.
- M7: Added `lib/marketing-agency/remotion/scene-data.ts` and `tests/unit/marketing-agency/remotion-scene-data.test.ts`.
- M8: Added additive Prisma models for marketing agency campaigns, source refs, claims, assets, QA reports, and export packages; added org-scoped persistence reads in `lib/marketing-agency/persistence.ts` with ownership tests.
- M9: Added Artlist, HeyGen, and Meta adapter boundaries with mock-safe defaults, typed live-configuration errors, HeyGen consent enforcement, and Meta export-only creative specs.
- M10: Added `docs/marketing-agency/IMPLEMENTATION-COMPLETION-REPORT.md`; full Jest and production build now pass, browser smoke passed, and Lighthouse actionable audits now pass for the RestoreAssist review route.
- M11: Expanded RestoreAssist from a single storyboard placeholder to five persona/platform video cuts with strategy, audio direction, format, CTA metadata, ranking hypotheses, pure-data Remotion composition plans, a dry-run production manifest command, human-in-the-loop visual/audio testing, and a credential-gated Apify intelligence command.
