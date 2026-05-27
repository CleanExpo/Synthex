# Synthex Production Readiness Packet - 2026-05-27

| Field | Value |
|---|---|
| Date | 2026-05-27 |
| Evidence captured | 2026-05-27 01:09-04:51 UTC |
| Canonical local checkout | `/Users/phill-mac/pi-seo-workspace/Synthex` |
| Working path used | `/Users/phill-mac/Documents/Synthex` |
| GitHub repo | `https://github.com/CleanExpo/Synthex.git` |
| Source gate baseline commit | `c319db75 docs(pm): SYN-971 preserve stale signoff evidence` |
| Production domain probed | `https://synthex.social` |
| Linear trace | `SYN-971` |

## Verdict

**Not `/shipit` yet.**

The consolidated local source tree is clean and the local source gates passed. The public production domain and health endpoints are reachable on Vercel. Production sign-off is still blocked until live environment, database, auth, billing, provider, and browser-flow gates are verified against real production configuration.

## Verified in this packet

| Gate | Result | Evidence |
|---|---|---|
| Git working tree at start of readiness capture | PASS | `git status --short --branch` returned `## main...origin/main [ahead 8]` with no uncommitted files. |
| Prisma schema/client | PASS | `npm run db:validate` exited 0; Prisma schema valid; Prisma Client generated v7.7.0. |
| TypeScript | PASS | `npm run type-check` exited 0. |
| Lint | PASS | `npm run lint` exited 0. |
| Jest suite | PASS | `npm test -- --runInBand` exited 0: 236 passed, 10 skipped, 246 total suites; 3639 passed, 201 skipped, 27 todo, 3867 total tests. |
| Production build | PASS with local-only secret | `JWT_SECRET=synthex-local-build-only-do-not-use-in-production npm run build` exited 0; compiled successfully; TypeScript completed; generated 614/614 static pages. |
| Public homepage reachability | PASS | `curl -I https://synthex.social` returned `HTTP/2 200`, `server: Vercel`, `x-matched-path: /`, `x-vercel-cache: HIT`. |
| Live liveness endpoint | PASS | `curl -I https://synthex.social/api/health/live` returned `HTTP/2 200`, `x-health-check: liveness`, `x-matched-path: /api/health/live`. |
| Live readiness endpoint | PASS | `curl -I https://synthex.social/api/health/ready` returned `HTTP/2 200`, `x-health-check: readiness`, `x-health-status: ready`. |
| Security headers on public probes | PASS observed | Public responses included CSP, HSTS, `x-frame-options: DENY`, `x-content-type-options: nosniff`, referrer policy, and permissions policy headers. |
| Vercel project discovery | PASS | Vercel connector found team `unite-group`, project `synthex` (`prj_gbQmHn6quoHgG3AswRrDoUlYaF40`), Node `22.x`, domains including `synthex.social`. |
| Vercel latest production deployment | READY, not current local cleanup commits | Latest production deployment `dpl_5W2y8xmL8ooPVjhXLWAgEQH1yUPK` is `READY`, target `production`, URL `synthex-3d3tptj8u-unite-group.vercel.app`, serving GitHub SHA `f7a59e2dacb65727a93950091560555d3a2bf5ed`. Local cleanup branch is ahead of `origin/main`, so these cleanup/sign-off commits are not deployed yet. |
| Public production smoke script | PASS | `node scripts/verify-deployment.js` exited 0 against `https://synthex.social`: 8/8 checks passed. The script now includes `/api/health` JSON parsing and prints the live `buildId`. |
| Public Playwright production subset | PASS | `npm run e2e:prod:public:bash` exited 0 against `https://synthex.social`: 6 passed. This public mode does not require production credentials. |
| Authenticated production Playwright preflight | PASS local guard | `npm run e2e:prod:critical:bash -- --grep "@production Security Headers" --project=chromium` without `PROD_TEST_EMAIL`/`PROD_TEST_PASSWORD` exited 1 before running tests with a clear missing-credentials error. Critical production mode now sets `PW_REQUIRE_PROD_CREDS=1`, so authenticated coverage cannot silently skip during release-gate runs. |
| Production verification scripts | PASS repaired | `scripts/verify-deployment.js` now runs as ESM and checks current public health/auth routes. `scripts/production-verify.js` delegates to it instead of crashing. Targeted ESLint with `--no-ignore` exited 0. |
| Release commit parity verifier | PASS local script, production mismatch correctly detected | `env EXPECTED_GIT_SHA=6d01f97e8ef43da6602d2eb622c45ecbee6b41b5 node scripts/verify-deployment.js` failed the `/api/health` release identity check because live production reported `buildId=f7a59e2`. This is expected until the local cleanup commits are pushed and deployed. |
| Current live `/shipit` status | BLOCKED as expected | `npm run shipit:status:live` after local RLS Batch 2 reported a clean working tree and passing local RLS coverage, but blocked because local `HEAD` is 20 commits ahead of `origin/main`, Supabase DB access is unavailable for adversarial RLS, and live production still reports `buildId=f7a59e2` instead of the local release commit prefix. |
| Vercel production env metadata | PASS names present, values not inspected | `vercel env ls production --scope unite-group --non-interactive --format json` confirmed production metadata for core names including `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `FIELD_ENCRYPTION_KEY`, and `JOURNEY_PIXEL_SIGNING_KEY_PRIMARY`. Secret values were not printed or pulled. |
| Repeatable production env metadata verifier | PASS with provider warnings | `npm run verify:prod-env` exited 0. It checked Vercel production env names only, printed no secret values, and confirmed 16/16 required names present. Recommended provider groups were 4/8 complete; warnings remain for Twitter/X, LinkedIn, and Meta/Facebook/Instagram credential groups. |
| Consolidated `/shipit` gate reporter | PASS local harness, blockers correctly surfaced | `npm run shipit:status` now runs a local gate report for working tree cleanliness, branch, origin parity, readiness packet presence, stale partial artifact, and whether live gates were skipped. Pre-commit run correctly failed while this reporter was uncommitted and local commits were ahead of `origin/main`. |
| RLS schema coverage command | PASS local source | `npm run rls:coverage` now runs through plain Node instead of `tsx`; after the Batch 2 migration it reports 214 Prisma models, 257 RLS-enabled migration entries, 0 uncovered, and exits 0. This is a local schema-presence gate only, separate from the live Supabase adversarial check. |
| Policy-backed RLS enablement batch | PARTIAL local source | `supabase/migrations/20260527043900_enable_rls_for_policy_backed_tables.sql` enables RLS for 19 tables that already had tenant-scoped policy pairs in the Phase 2 RLS batch. This reduced uncovered models from 62 to 43 without inventing new policies. |
| RLS Batch 2 migration | PASS local source, not live verified | `supabase/migrations/20260527050000_rls_batch_2_founder_org_and_service_tables.sql` enables RLS for the remaining 43 Prisma-backed tables. Clearly founder/org/parent-scoped tables get authenticated scoped policies; platform/reference/sensitive internal tables remain service-role-only. The migration intentionally avoids `USING (true)` and service-role policies. |
| Runtime readiness body | PARTIAL | `curl -sS https://synthex.social/api/health/ready` returned `status:"degraded"` with DB `Connected` at 1976ms, environment `healthy`, cache `healthy` message `Mode: memory`, and 0 unhealthy checks. |
| Runtime service health endpoints | PASS observed | Public GET probes returned healthy JSON for `/api/health/db` (`connected:true`, 1838ms), `/api/health/redis` (`redis-cloud`, connected), `/api/health/ai` (`healthy`, 116ms), and `/api/health/stripe` (`healthy`, 230ms). |
| Readiness cache probe alignment | PASS local source, not deployed yet | `/api/health/ready` and `/api/health` now use the same unified Redis health service as `/api/health/redis`, so local source reports the actual Redis Cloud/Vercel implementation instead of the legacy Upstash-only wrapper's memory fallback. Targeted health-ready Jest, type-check, targeted ESLint, and `git diff --check` passed. |
| Cron source guard coverage | PASS local source | All 40 configured `vercel.json` cron entries map to route files using `verifyCronRequest`; all 41 `/api/cron/**/route.ts` files use `verifyCronRequest`. Focused Jest result: 2 suites passed, 13 tests passed. |
| Scheduled non-`/api/cron` route hardening | PASS local source, not deployed yet | `app/api/competitors/track/execute/route.ts` no longer accepts spoofable `x-vercel-cron: 1` as auth. `app/api/reports/scheduled/execute/route.ts` now uses `verifyCronRequest` instead of a one-off shared-secret check. |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=low --json --cache /private/tmp/synthex-npm-cache --logs-dir /private/tmp/synthex-npm-logs` returned 0 production vulnerabilities. |
| Full dependency audit | ACCEPTANCE REVIEW NEEDED | Full audit reports 7 low-severity dev-only findings through Storybook's webpack polyfill chain and `elliptic`. `npm view elliptic version` returned `6.6.1`; the advisory range is `<=6.6.1`, so no patched `elliptic` version is currently available to override to. |

## Local build caveats

The local production build passed only after providing an ephemeral local `JWT_SECRET`. This proves the source can build, but it does not prove production secrets are correctly configured.

The build emitted expected local-environment warnings because real production services are not present in this shell:

- OpenRouter API key not configured.
- `REDIS_URL` not set, so Redis code used local fallback behavior.
- Twitter API credentials not configured.
- `DATABASE_URL` not configured; Prisma client creation skipped during static collection.
- Public benchmark route returned fallback data because Prisma was not initialized.

These warnings are not source build failures, but they remain release-gate items for the real deployment.

## Still blocking `/shipit`

| Gate | Status | Required next evidence |
|---|---|---|
| Vercel production deployment state | PARTIAL | Project and latest deployment are verified `READY`, but production serves GitHub SHA `f7a59e2...`, not the current local `HEAD`. Final sign-off requires explicit push approval, deployment, and `EXPECTED_GIT_SHA=<release commit> node scripts/verify-deployment.js` proving `/api/health.buildId` matches the release commit prefix. |
| Production environment variables | PARTIAL | `npm run verify:prod-env` confirms required/core Vercel production variable names exist without printing values. Values were not pulled or validated directly. Recommended provider groups still warn for Twitter/X, LinkedIn, and Meta/Facebook/Instagram credentials. Final sign-off still needs deploy log/runtime validation after the local commits are pushed. |
| Supabase live RLS/adversarial checks | BLOCKED ON ACCESS | `supabase projects list` failed locally with `Access token not provided`; no `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, or `DATABASE_URL` is available in the shell. Vercel has DB env metadata, but secrets were not pulled locally. |
| RLS schema coverage | PASS LOCAL SOURCE | `npm run rls:coverage` now passes with 0 uncovered Prisma models after the policy-backed and Batch 2 RLS migrations. This does not prove live `pg_policies` safety until the migrations are applied and `npm run rls:adversarial` is run against production Supabase. |
| Immutable audit log mutation check | NOT VERIFIED CURRENT | Re-run against production and verify insert allowed, update/delete blocked. |
| Authenticated browser smoke flows | NOT VERIFIED | Public unauthenticated Playwright subset passed. The critical Playwright command now fails fast unless production credentials are supplied. Authenticated journeys still need real production test credentials and captured output for sign-in, tenant isolation, core agency workflows, billing portal path, and representative protected routes. |
| Stripe webhook/idempotency | NOT VERIFIED CURRENT | Verify live webhook endpoint, signature handling, idempotency backend, and billing portal behavior. |
| Cron guard/live schedule coverage | PARTIAL | Local source coverage is now verified and hardened for configured Vercel cron paths. Live production still serves SHA `f7a59e2...`; final sign-off requires push/deploy and a post-deploy source/deployed-SHA parity check. |
| Readiness health parity | PARTIAL | Local source now aligns readiness cache checks with the unified Redis Cloud health implementation. Live production still showed the old readiness cache message from the deployed SHA during this packet, so post-deploy verification must re-probe `/api/health/ready`, `/api/health`, and `/api/health/redis`. |
| Provider integrations | NOT VERIFIED CURRENT | Verify OpenRouter/OpenAI, Twitter/X, Meta or publishing gates, and any other provider-backed workflows using production env and safe non-publishing test paths. |
| Dependency audit | PARTIAL | Production dependency audit is clean. Full dependency audit still needs an explicit acceptance decision for 7 low-severity dev-only Storybook/polyfill findings, or removal/isolation of Storybook from the release tree if policy requires zero full-tree findings. |
| Stale local partial artifact | OPEN LOCAL HYGIENE | `/Users/phill-mac/Documents/Synthex_PARTIAL_ORPHAN_20260526-230400` still exists outside the canonical checkout and should remain ignored as stale until it can be archived safely. |
| Consolidated gate command | PARTIAL | `npm run shipit:status` is available for local checks and `npm run shipit:status:live` is available for Vercel env plus deployed SHA parity. The command is expected to stay blocking until the release commit is pushed/deployed and live parity passes. |

## Current operating state

Synthex is now consolidated around the main GitHub repo and local source validation is green at source gate baseline commit `c319db75`, with follow-up readiness evidence, production smoke script repair, cron route hardening, readiness Redis probe alignment, shipit gate reporting, and local RLS schema coverage now green across all Prisma models.

This packet upgrades the state from "local builds scattered and unverified" to "single canonical local repo with green local gates and reachable public health probes." It does not grant production sign-off.
