# Synthex Production Readiness Packet - 2026-05-27

| Field | Value |
|---|---|
| Date | 2026-05-27 |
| Evidence captured | 2026-05-27 01:09-01:22 UTC |
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
| Vercel production deployment state | NOT VERIFIED | Confirm production deployment commit, project status, build logs, and env set in Vercel dashboard/API. Header probes prove Vercel is serving the domain, not that the latest local commit is deployed. |
| Production environment variables | NOT VERIFIED | Confirm real production values exist for `JWT_SECRET`, `DATABASE_URL`, Redis, Stripe, AI providers, and social/provider credentials without exposing secret values. |
| Supabase live RLS/adversarial checks | NOT VERIFIED | Run the production RLS adversarial suite against the correct Synthex Supabase project and capture secure policy counts/results. |
| Immutable audit log mutation check | NOT VERIFIED CURRENT | Re-run against production and verify insert allowed, update/delete blocked. |
| Authenticated browser smoke flows | NOT VERIFIED | Exercise sign-in, tenant isolation, core agency workflows, billing portal path, and representative protected routes in browser automation or manual QA with captured output. |
| Stripe webhook/idempotency | NOT VERIFIED CURRENT | Verify live webhook endpoint, signature handling, idempotency backend, and billing portal behavior. |
| Cron guard/live schedule coverage | NOT VERIFIED CURRENT | Confirm all production cron routes enforce the configured secret and match Vercel schedule setup. |
| Provider integrations | NOT VERIFIED CURRENT | Verify OpenRouter/OpenAI, Twitter/X, Meta or publishing gates, and any other provider-backed workflows using production env and safe non-publishing test paths. |
| Dependency audit | OPEN | Earlier install reported 6 low severity vulnerabilities; review whether they are acceptable or fixable before final release. |
| Stale local partial artifact | OPEN LOCAL HYGIENE | `/Users/phill-mac/Documents/Synthex_PARTIAL_ORPHAN_20260526-230400` still exists outside the canonical checkout and should remain ignored as stale until it can be archived safely. |

## Current operating state

Synthex is now consolidated around the main GitHub repo and local source validation is green at source gate baseline commit `c319db75`.

This packet upgrades the state from "local builds scattered and unverified" to "single canonical local repo with green local gates and reachable public health probes." It does not grant production sign-off.
