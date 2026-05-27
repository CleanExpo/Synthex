# Synthex Production Readiness Packet - 2026-05-27

| Field | Value |
|---|---|
| Date | 2026-05-27 |
| Evidence captured | 2026-05-27 01:09-03:45 UTC |
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
| Public production smoke script | PASS | `node scripts/verify-deployment.js` exited 0 against `https://synthex.social`: 7/7 checks passed. |
| Public Playwright production subset | PASS | `PW_SKIP_WEBSERVER=1 BASE_URL=https://synthex.social ... playwright test tests/e2e/production-critical-paths.spec.ts --grep '@production Security Headers\|Signup' --project=chromium` exited 0: 6 passed. |
| Production verification scripts | PASS repaired | `scripts/verify-deployment.js` now runs as ESM and checks current public health/auth routes. `scripts/production-verify.js` delegates to it instead of crashing. Targeted ESLint with `--no-ignore` exited 0. |
| Vercel production env metadata | PASS names present, values not inspected | `vercel env ls production --scope unite-group --non-interactive --format json` confirmed production metadata for core names including `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `FIELD_ENCRYPTION_KEY`, and `JOURNEY_PIXEL_SIGNING_KEY_PRIMARY`. Secret values were not printed or pulled. |
| Runtime readiness body | PARTIAL | `curl -sS https://synthex.social/api/health/ready` returned `status:"degraded"` with DB `Connected` at 1976ms, environment `healthy`, cache `healthy` message `Mode: memory`, and 0 unhealthy checks. |
| Runtime service health endpoints | PASS observed | Public GET probes returned healthy JSON for `/api/health/db` (`connected:true`, 1838ms), `/api/health/redis` (`redis-cloud`, connected), `/api/health/ai` (`healthy`, 116ms), and `/api/health/stripe` (`healthy`, 230ms). |
| Cron source guard coverage | PASS local source | All 40 configured `vercel.json` cron entries map to route files using `verifyCronRequest`; all 41 `/api/cron/**/route.ts` files use `verifyCronRequest`. Focused Jest result: 2 suites passed, 13 tests passed. |
| Scheduled non-`/api/cron` route hardening | PASS local source, not deployed yet | `app/api/competitors/track/execute/route.ts` no longer accepts spoofable `x-vercel-cron: 1` as auth. `app/api/reports/scheduled/execute/route.ts` now uses `verifyCronRequest` instead of a one-off shared-secret check. |

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
| Vercel production deployment state | PARTIAL | Project and latest deployment are verified `READY`, but production serves GitHub SHA `f7a59e2...`, not the current local cleanup commits. Final sign-off requires explicit push approval, deployment, and verification that the deployed SHA matches the release commit. |
| Production environment variables | PARTIAL | Vercel metadata confirms required/core production variable names exist; values were not pulled or validated directly. Runtime readiness says environment is healthy. Final sign-off still needs deploy log/runtime validation after the local commits are pushed. |
| Supabase live RLS/adversarial checks | BLOCKED ON ACCESS | `supabase projects list` failed locally with `Access token not provided`; no `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, or `DATABASE_URL` is available in the shell. Vercel has DB env metadata, but secrets were not pulled locally. |
| Immutable audit log mutation check | NOT VERIFIED CURRENT | Re-run against production and verify insert allowed, update/delete blocked. |
| Authenticated browser smoke flows | NOT VERIFIED | Public unauthenticated Playwright subset passed. Authenticated journeys still need real production test credentials and captured output for sign-in, tenant isolation, core agency workflows, billing portal path, and representative protected routes. |
| Stripe webhook/idempotency | NOT VERIFIED CURRENT | Verify live webhook endpoint, signature handling, idempotency backend, and billing portal behavior. |
| Cron guard/live schedule coverage | PARTIAL | Local source coverage is now verified and hardened for configured Vercel cron paths. Live production still serves SHA `f7a59e2...`; final sign-off requires push/deploy and a post-deploy source/deployed-SHA parity check. |
| Provider integrations | NOT VERIFIED CURRENT | Verify OpenRouter/OpenAI, Twitter/X, Meta or publishing gates, and any other provider-backed workflows using production env and safe non-publishing test paths. |
| Dependency audit | OPEN | Earlier install reported 6 low severity vulnerabilities; review whether they are acceptable or fixable before final release. |
| Stale local partial artifact | OPEN LOCAL HYGIENE | `/Users/phill-mac/Documents/Synthex_PARTIAL_ORPHAN_20260526-230400` still exists outside the canonical checkout and should remain ignored as stale until it can be archived safely. |

## Current operating state

Synthex is now consolidated around the main GitHub repo and local source validation is green at source gate baseline commit `c319db75`, with follow-up readiness evidence and production smoke script repair layered on top.

This packet upgrades the state from "local builds scattered and unverified" to "single canonical local repo with green local gates and reachable public health probes." It does not grant production sign-off.
