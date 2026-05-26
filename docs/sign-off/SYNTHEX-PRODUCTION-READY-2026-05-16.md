# Synthex Production Sign-Off — 2026-05-16

| Field | Value |
|---|---|
| Date | 2026-05-16 |
| Time | 11:18–11:25 UTC |
| Person on duty | Claude QA-Lead (autonomy mandate, branch `chore/synthex-phase6-production-verify`) |
| Production domain | `synthex.social` |
| Vercel project | `synthex` |
| Supabase project (PROD) | `znyjoyjsvjotlzjppzal` (Synthex, ap-southeast-1) |
| Live commit | `f2ac8d8c` Phase 2 (immutable audit log + RLS Batch 1 + SOC 2 docs) |

## Important correction

The plan referenced Supabase project `lksfwktwtmyznckodsau` — **that is the Unite-Group project, not Synthex.** Correct Synthex production project is `znyjoyjsvjotlzjppzal`. All RLS / audit-log / spot-check queries below were re-run against the correct project.

---

## Check results

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | Production HTTP health probes (5 endpoints) | **PASS** | [http-probes-2026-05-16.md](./http-probes-2026-05-16.md) — buildId f2ac8d8 confirmed live |
| 2 | Vercel production deploy state | **CONDITIONAL** | [vercel-deploy-state.md](./vercel-deploy-state.md) — production serves correct commit but GH Actions Deploy workflow fails on `vercel deploy` upload |
| 3 | RLS adversarial test (post-Batch 1) | **FAIL** | [rls-baseline-post-batch1.md](./rls-baseline-post-batch1.md) — secure count still 18 (expected 37); Batch 1 migration NOT in schema_migrations ledger |
| 4 | Immutable audit log mutation test | **PASS** | [immutable-audit-mutation-test.md](./immutable-audit-mutation-test.md) — INSERT succeeded, UPDATE + DELETE both correctly blocked (SQLSTATE 42501) |
| 5 | Stripe webhook idempotency health | **PASS** (caveat) | [stripe-webhook-health.md](./stripe-webhook-health.md) — Redis-backed (24h TTL), not DB-backed; Redis health endpoint green |
| 6 | CRON_SECRET enforcement (38 routes) | **PASS** | [cron-secret-coverage.md](./cron-secret-coverage.md) — 0 missing guards across all 38 cron routes |
| 7 | Cross-tenant RLS spot check | **CONDITIONAL FAIL** | [rls-spot-check.md](./rls-spot-check.md) — 1 NULL org_id in `campaigns` (id `cmm37zez50005l404mvrci9bx`); `posts` has no organization_id column (tenancy via FK chain, needs separate audit) |
| 8 | Billing portal route smoke | **PASS** | [billing-portal-smoke.md](./billing-portal-smoke.md) — 405 on unauth GET (POST-only route, correct) |
| 9 | Vibetest-use top-10 journeys | **DEFERRED** | [vibetest-gap.md](./vibetest-gap.md) — MCP server not installed (plan-permitted defer) |
| 10 | Browser-harness UI smoke tests | **DEFERRED** | [ui-smoke-gap.md](./ui-smoke-gap.md) — `tests/ui-smoke/` directory absent (plan-permitted defer) |
| 11 | Type-check clean on main | **FAIL** | [type-check.md](./type-check.md) — 15 `TS2304: Cannot find name 'withRateLimit'` errors, exit code 1 |

## Totals

- **PASS: 6** (1, 4, 5, 6, 8, and 2-conditional)
- **FAIL: 3** (3 RLS Batch 1 missing, 7 cross-tenant null, 11 type-check)
- **DEFERRED: 2** (9 vibetest, 10 ui-smoke)
- **CONDITIONAL: 1** (2 Vercel CI deploy step failing)

## Sign-off verdict: **NOT READY**

Three production defects block sign-off:

### Blocker A — Phase 2 RLS Batch 1 not applied to production
`secure` RLS-policy count remains at the Phase 1 baseline of 18; the expected jump to 37 did not happen. The `immutable_audit_log` migration is in the ledger (`20260515225502`) but Phase 2 PR #245's RLS Batch 1 migration is missing. **Action: apply Batch 1 migration to production, re-run the audit query, confirm secure==37.**

### Blocker B — Type-check failure on main (15 routes broken)
All 15 routes that call `withRateLimit(request, ...)` from PR RA-3024 are missing the import. At runtime each affected POST will throw `ReferenceError`. Routes span AI content, admin vault, analytics, demo, media, PR, psychology, and workflows. **Action: add `import { withRateLimit } from '@/lib/rate-limit';` to the 15 files listed in `type-check.md`, ship hotfix PR.**

### Blocker C — Cross-tenant null org_id in `campaigns`
Row `cmm37zez50005l404mvrci9bx` (name "Scheduled Posts", created 2026-02-26) has `organization_id = NULL` in a tenant table with RLS. This is either a backfill miss or an RLS policy permitting NULL through. **Action: triage the row (assign org or hard-delete) AND verify the campaigns RLS policy rejects NULL on read.**

## Conditional follow-ups (not blocking, but tracked)

1. GH Actions `Deploy` workflow upload step fails repeatedly — investigate or remove in favour of Vercel git integration.
2. `posts` table tenancy model uses FK chain to `content_calendars.organization_id` (presumably). Audit the explicit RLS policy.
3. Vibetest-use MCP server install (Wave 1 mandate).
4. Browser-harness `tests/ui-smoke/billing-portal.harness.py` (Phase 3 PR1 follow-up).
5. Stripe webhook idempotency is Redis-backed not DB-backed — update runbook so future sign-offs query Redis keyspace, not a non-existent `webhook_events` table.
6. SOC 2 audit-engagement decision still open (Phase 2 deliverable).
7. Stripe sensitive env unlock decision still open.
8. Service-role-key leak triage (carry-over from Phase 1).

## Test artefacts

Test row in `audit_events_immutable`: `id=3bcb21c4-697c-4989-bdad-85c508a10f58`, event_type `test.production_signoff`. Will remain in the immutable log permanently (correct behaviour).
