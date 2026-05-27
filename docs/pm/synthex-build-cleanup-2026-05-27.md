# Synthex Build Cleanup - 2026-05-27

## Canonical Repository

- GitHub: `https://github.com/CleanExpo/Synthex.git`
- Active local checkout: `/Users/phill-mac/pi-seo-workspace/Synthex`
- Convenience symlinks:
  - `/Users/phill-mac/Documents/Synthex -> /Users/phill-mac/pi-seo-workspace/Synthex`
  - `/Users/phill-mac/Synthex -> /Users/phill-mac/pi-seo-workspace/Synthex`
- Current baseline: `main` at `f7a59e2 feat(agency): v12.0 In-House Agency OS (SYN-971) (#300)`

## Archived Local Builds

Old local Synthex app checkouts were preserved, not deleted, under:

`/Users/phill-mac/Local-Quarantine/Synthex-cleanup-20260526-230400/archived-local-builds`

Archived app checkouts:

- `Synthex`
- `Synthex-audit`
- `Synthex-hygiene`
- `Synthex-journey-hmac`
- `Synthex-owner-override`
- `Synthex-phase1`
- `Synthex-phase2`
- `Synthex-phase3`
- `Synthex-phase4`
- `Synthex-phase5`
- `Synthex-prod-verify`
- `Synthex-srleak`
- `Synthex-testimonial`

The previous dirty `/Users/phill-mac/pi-seo-workspace/Synthex` checkout was preserved at:

`/Users/phill-mac/Local-Quarantine/Synthex-cleanup-20260526-230400/pi-seo-workspace-Synthex-before-fresh-clone`

The stale partial iCloud/Documents artifact is no longer the active repo path. It remains at:

`/Users/phill-mac/Documents/Synthex_PARTIAL_ORPHAN_20260526-230400`

This partial folder resisted cross-folder moves twice and should be treated as a stale generated artifact, not source truth.

## Dependency Setup Notes

The repo requires Node `22.x` per `.node-version` and `.nvmrc`.

The default shell initially used Node `20.20.2`, which is not valid for this project. Validation used:

`/Users/phill-mac/.nvm/versions/node/v22.22.3/bin/node`

`npm ci` initially failed because npm attempted to write logs/cache under the user home and then hit npm's `Exit handler never called!` failure. The successful install used npm cache/log dirs under `/private/tmp`:

`NPM_CONFIG_CACHE=/private/tmp/synthex-npm-cache NPM_CONFIG_LOGS_DIR=/private/tmp/synthex-npm-logs node npm-cli.js ci --ignore-scripts`

Because scripts were ignored, Prisma generation and the local brand-config package build were run explicitly.

## Verification Evidence

Commands run from `/Users/phill-mac/Documents/Synthex` after cleanup:

- `npm run db:validate` with Node 22/npm 11: passed
  - Prisma schema valid
  - Prisma Client generated, v7.7.0
- `npm run type-check`: passed
- `npm run lint`: passed
- `npm test -- --runInBand`: passed
  - Earlier cleanup pass: Test Suites: 235 passed, 10 skipped, 245 total; Tests: 3632 passed, 201 skipped, 27 todo, 3860 total
  - Current 2026-05-27 readiness pass: Test Suites: 236 passed, 10 skipped, 246 total; Tests: 3639 passed, 201 skipped, 27 todo, 3867 total
- `npm run build` without env: failed as expected because `JWT_SECRET` is required in production build collection
- `JWT_SECRET=synthex-local-build-only-do-not-use-in-production npm run build`: passed
  - Next.js compiled successfully
  - TypeScript completed
  - Static generation completed for 614 pages
- Public production probes: passed
  - `curl -I https://synthex.social`: `HTTP/2 200`, Vercel served `/`
  - `curl -I https://synthex.social/api/health/live`: `HTTP/2 200`, `x-health-check: liveness`
  - `curl -I https://synthex.social/api/health/ready`: `HTTP/2 200`, `x-health-check: readiness`, `x-health-status: ready`
- Vercel connector: project `synthex` (`prj_gbQmHn6quoHgG3AswRrDoUlYaF40`) latest production deployment `dpl_5W2y8xmL8ooPVjhXLWAgEQH1yUPK` is `READY` on GitHub SHA `f7a59e2dacb65727a93950091560555d3a2bf5ed`.
- `node scripts/verify-deployment.js`: passed against `https://synthex.social`
  - Summary: 7/7 public smoke checks passed
- `node scripts/production-verify.js`: passed as deprecated compatibility wrapper
  - Summary: 7/7 public smoke checks passed
- Public Playwright production subset: passed
  - `tests/e2e/production-critical-paths.spec.ts --grep '@production Security Headers|Signup' --project=chromium`
  - Result: 6 passed
- Vercel production env metadata: core production env names present, values not printed or pulled
  - Confirmed names include `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, Supabase public/service keys, Redis, Stripe, AI provider keys, `CRON_SECRET`, `FIELD_ENCRYPTION_KEY`, and journey pixel signing key.
- Runtime health bodies:
  - `/api/health/ready`: HTTP 200 body returned `status:"degraded"` with DB connected at 1976ms, environment healthy, cache healthy, 0 unhealthy checks.
  - `/api/health/db`: healthy, connected, 1838ms.
  - `/api/health/redis`: healthy, `redis-cloud`, connected.
  - `/api/health/ai`: healthy, 116ms.
  - `/api/health/stripe`: healthy, 230ms.
- Cron source guard coverage: passed
  - 40 configured `vercel.json` cron entries map to route files using `verifyCronRequest`.
  - 41 `/api/cron/**/route.ts` files use `verifyCronRequest`.
  - `npm test -- --runInBand tests/auth/cron-route-coverage.test.ts __tests__/unit/auth/cron-auth.test.ts`: 2 suites passed, 13 tests passed.
- Scheduled non-`/api/cron` route hardening: local source fixed
  - `/api/competitors/track/execute` no longer accepts spoofable `x-vercel-cron: 1`.
  - `/api/reports/scheduled/execute` now uses `verifyCronRequest`.

## Current Readiness State

The local build surface is now consolidated around one main repo and the baseline code gates are green with an ephemeral local `JWT_SECRET`.

Archived local builds are now inventoried in:

- `docs/pm/synthex-archived-builds-inventory-2026-05-27.md`
- `docs/pm/synthex-archived-builds-inventory-2026-05-27.json`

The archive inventory found that several old branch heads are not ancestors of `origin/main` but are patch-equivalent to current main. The Phase 2 RLS/SOC2, journey HMAC, hygiene, duplicate Phase 3, Phase 5 TenantConfig, Phase 1 measurement, and production-verification archived branches were assessed on 2026-05-27. Their code/test/planning payloads are already present in current main, superseded by safer current files, or preserved as historical evidence. Phase 5 exposed stale TenantConfig tests that were fixed on current main. The historical production sign-off packet was imported under `docs/sign-off`, but its verdict is `NOT READY`; it does not count as current `/shipit` evidence.

Not yet `/shipit`:

- Production env must provide real `JWT_SECRET`, `DATABASE_URL`, Redis, AI, Twitter/social, and provider credentials as appropriate.
- `npm audit` reported 6 low severity vulnerabilities after dependency install.
- Several runtime warnings during build are expected without local production env, but must be verified against Vercel production env before release.
- The stale partial Documents artifact still exists outside the canonical path because filesystem moves from Documents to quarantine hung twice.
- Public runtime liveness/readiness headers, unauthenticated API guard checks, signup form rendering, and Vercel latest production deployment state have been re-verified in this cleanup pass.
- Production currently serves GitHub SHA `f7a59e2dacb65727a93950091560555d3a2bf5ed`; the cleanup commits are local-only until explicitly pushed and redeployed.
- Supabase CLI live RLS verification is blocked locally until a Supabase access token or database URL is provided. `supabase projects list` returned `Access token not provided`.
- Authenticated browser flows, RLS live database state, production env completeness, provider-backed workflows, and deployed release-commit parity have not been fully re-verified.

Current readiness packet:

- `docs/sign-off/SYNTHEX-PRODUCTION-READY-2026-05-27.md`
