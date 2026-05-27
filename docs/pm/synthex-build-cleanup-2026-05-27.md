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
  - Summary: 8/8 public smoke checks passed
  - The script now parses `/api/health` JSON and reports live `buildId=f7a59e2`.
- `node scripts/production-verify.js`: passed as deprecated compatibility wrapper
  - Summary: 8/8 public smoke checks passed.
- Release commit parity verifier: local script fixed
  - Set `EXPECTED_GIT_SHA=<release commit SHA>` to require `/api/health.buildId` to match the deployed release prefix.
  - `env EXPECTED_GIT_SHA=6d01f97e8ef43da6602d2eb622c45ecbee6b41b5 node scripts/verify-deployment.js` correctly failed 7/8 because live production still reports `buildId=f7a59e2`.
  - Targeted ESLint on `scripts/verify-deployment.js`: passed.
- Public Playwright production subset: passed
  - `npm run e2e:prod:public:bash`
  - Result: 6 passed
- Production Playwright mode split: local harness fixed
  - `e2e:prod:public:bash` runs only unauthenticated security and signup-rendering checks without requiring production credentials.
  - `e2e:prod:critical:*` now sets `PW_REQUIRE_PROD_CREDS=1`, so authenticated release-gate runs fail fast when `PROD_TEST_EMAIL` or `PROD_TEST_PASSWORD` is missing.
  - `npm run e2e:prod:critical:bash -- --grep "@production Security Headers" --project=chromium` without credentials exited 1 with the expected missing-credentials error before running tests.
- Vercel production env metadata: core production env names present, values not printed or pulled
  - Confirmed names include `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, Supabase public/service keys, Redis, Stripe, AI provider keys, `CRON_SECRET`, `FIELD_ENCRYPTION_KEY`, and journey pixel signing key.
- Repeatable production env metadata verifier: local script added and passed
  - `npm run verify:prod-env`: 16/16 required production env names present, secret values not requested or printed.
  - Required names include database, Supabase, Redis, cron, auth, field encryption, journey pixel signing, OpenRouter, Stripe, and owner access envs.
  - Recommended provider groups were 4/8 complete. Twitter/X, LinkedIn, and Meta/Facebook/Instagram credential groups are still warnings until those provider workflows are verified or explicitly out of release scope.
- Consolidated `/shipit` gate reporter: local script added
  - `npm run shipit:status` checks local working tree cleanliness, branch, origin parity, readiness packet presence, stale partial artifact, and whether live gates were skipped.
  - `npm run shipit:status:live` additionally runs Vercel production env metadata and deployed SHA parity checks.
  - Initial pre-commit run correctly failed while the reporter itself was uncommitted and local commits were ahead of `origin/main`.
  - Current post-RLS-Batch-2 live run still blocks: clean working tree, local RLS coverage passes, but local `HEAD` is 20 commits ahead of `origin/main`, live production reports `buildId=f7a59e2`, and DB access is unavailable for adversarial RLS.
- RLS coverage command: local runtime fixed, source blocker surfaced
  - `npm run rls:coverage` now uses plain Node via `scripts/validate-rls-coverage.js` instead of `npx tsx`, avoiding the sandbox IPC failure from `tsx`.
  - The validator now reaches the real source check.
  - Initial post-runtime-fix result: 214 Prisma models, 195 RLS-enabled migration entries, 62 uncovered models.
  - Current result after `supabase/migrations/20260527043900_enable_rls_for_policy_backed_tables.sql`: 43 uncovered models remain.
  - The new migration only enables RLS for 19 tables that already had tenant-scoped policy pairs in the Phase 2 RLS batch. It intentionally does not invent new policies for tables that still need table-specific policy design or documented exemptions.
  - Current result after `supabase/migrations/20260527050000_rls_batch_2_founder_org_and_service_tables.sql`: 214 Prisma models, 257 RLS-enabled migration entries, 0 uncovered models.
  - Batch 2 enables RLS for the remaining 43 Prisma-backed tables. It adds authenticated scoped policies only where the row owner is unambiguous: founder-owned, tenant/org-owned, or parent-owned child tables.
  - Batch 2 intentionally leaves `blog_posts`, `bookkeeper_transactions`, `credentials_vault`, `edge_function_logs`, `health_score_config`, `industry_baselines`, `industry_templates`, `intervention_config`, `intervention_templates`, `model_metrics`, `pipeline_cost_ledger`, `seasonal_signals`, and `waitlist_entries` service-role-only until a product/security owner approves public-read or direct-authenticated access.
  - Batch 2 intentionally avoids `USING (true)` and service-role policies because the live adversarial RLS gate treats `USING (true)` as open-by-default.
- Runtime health bodies:
  - `/api/health/ready`: HTTP 200 body returned `status:"degraded"` with DB connected at 1976ms, environment healthy, cache healthy, 0 unhealthy checks.
  - `/api/health/db`: healthy, connected, 1838ms.
  - `/api/health/redis`: healthy, `redis-cloud`, connected.
  - `/api/health/ai`: healthy, 116ms.
  - `/api/health/stripe`: healthy, 230ms.
- Readiness cache probe alignment: local source fixed
  - `/api/health/ready` and `/api/health` now use `@/lib/redis-unified`, matching `/api/health/redis`.
  - This removes the old source-level mismatch where readiness could report the legacy Upstash-only wrapper's memory fallback while the Redis endpoint reported Redis Cloud.
  - `npm test -- --runInBand tests/unit/api/health-ready.test.ts`: 1 suite passed, 1 test passed.
  - `npm run type-check`: passed.
  - Targeted ESLint on the changed health files and test: passed.
  - `git diff --check`: passed.
- Cron source guard coverage: passed
  - 40 configured `vercel.json` cron entries map to route files using `verifyCronRequest`.
  - 41 `/api/cron/**/route.ts` files use `verifyCronRequest`.
  - `npm test -- --runInBand tests/auth/cron-route-coverage.test.ts __tests__/unit/auth/cron-auth.test.ts`: 2 suites passed, 13 tests passed.
- Scheduled non-`/api/cron` route hardening: local source fixed
  - `/api/competitors/track/execute` no longer accepts spoofable `x-vercel-cron: 1`.
  - `/api/reports/scheduled/execute` now uses `verifyCronRequest`.
- Dependency audit: production dependency surface passed
  - `npm audit --omit=dev --audit-level=low --json --cache /private/tmp/synthex-npm-cache --logs-dir /private/tmp/synthex-npm-logs`: 0 vulnerabilities.
  - Full dependency audit still reports 7 low-severity dev-only findings through Storybook's webpack polyfill chain: `@storybook/nextjs` -> `node-polyfill-webpack-plugin` -> `node-stdlib-browser` -> `crypto-browserify` -> `elliptic`.
  - `npm view elliptic version` returned `6.6.1`; the active advisory range is `<=6.6.1`, so there is no patched `elliptic` override available at the registry at this time.
  - `npm audit fix --dry-run --json` did not identify a clean source change; it proposed no vulnerability-removing package change and only reported optional platform package additions under the default Node 20 shell.

## Current Readiness State

The local build surface is now consolidated around one main repo and the baseline code gates are green with an ephemeral local `JWT_SECRET`.

Archived local builds are now inventoried in:

- `docs/pm/synthex-archived-builds-inventory-2026-05-27.md`
- `docs/pm/synthex-archived-builds-inventory-2026-05-27.json`

The archive inventory found that several old branch heads are not ancestors of `origin/main` but are patch-equivalent to current main. The Phase 2 RLS/SOC2, journey HMAC, hygiene, duplicate Phase 3, Phase 5 TenantConfig, Phase 1 measurement, and production-verification archived branches were assessed on 2026-05-27. Their code/test/planning payloads are already present in current main, superseded by safer current files, or preserved as historical evidence. Phase 5 exposed stale TenantConfig tests that were fixed on current main. The historical production sign-off packet was imported under `docs/sign-off`, but its verdict is `NOT READY`; it does not count as current `/shipit` evidence.

Not yet `/shipit`:

- Production env metadata now proves required/core names exist. Values still need runtime validation, and Twitter/X, LinkedIn, and Meta/Facebook/Instagram provider groups still need credentials or an explicit release-scope decision.
- Production dependency audit is clean at low threshold. Full dependency audit still has 7 low-severity dev-only Storybook/polyfill findings with no patched `elliptic` version currently available.
- Several runtime warnings during build are expected without local production env, but must be verified against Vercel production env before release.
- The stale partial Documents artifact still exists outside the canonical path because filesystem moves from Documents to quarantine hung twice.
- Public runtime liveness/readiness headers, unauthenticated API guard checks, signup form rendering, and Vercel latest production deployment state have been re-verified in this cleanup pass.
- Production currently serves GitHub SHA `f7a59e2dacb65727a93950091560555d3a2bf5ed`; the cleanup, cron hardening, production-smoke repair, readiness Redis probe, dependency audit documentation, release-parity verifier, and RLS Batch 2 commits are local-only until explicitly pushed and redeployed.
- Supabase CLI live RLS verification is blocked locally until a Supabase access token or database URL is provided. `supabase projects list` returned `Access token not provided`.
- Local RLS schema coverage is no longer blocking: `npm run rls:coverage` now passes with 0 uncovered Prisma models. Live Supabase RLS correctness is still blocked until DB access is available and `npm run rls:adversarial` can inspect `pg_policies` after deployment/migration.
- Authenticated browser flows, RLS live database state, production env completeness, provider-backed workflows, and deployed release-commit parity have not been fully re-verified. The production Playwright harness now separates public smoke from credential-required critical paths so these gates cannot be confused in the next release pass.
- `npm run shipit:status` is now the local roll-up command for the current blockers. It is expected to remain blocking until local commits are pushed/deployed and live parity is verified.

Current readiness packet:

- `docs/sign-off/SYNTHEX-PRODUCTION-READY-2026-05-27.md`
