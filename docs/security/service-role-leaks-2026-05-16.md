# Service-Role-Key Leak Inventory — 2026-05-16

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b` (Synthex Phase 2)
**Method:** `grep -rln "SUPABASE_SERVICE_ROLE_KEY\|serviceRoleKey" --include="*.ts" --include="*.tsx" app/`
**Why this matters:** Service-role keys bypass RLS entirely. A route that uses the service-role client AND a user-supplied `organization_id` (or similar) parameter is a tenant-isolation hole regardless of how strong the per-table RLS policy is.

## Counts
- Internal/scheduled routes using service_role (legitimate, no anon-key context): **9**
- Non-internal, user-facing or user-triggered routes using service_role: **46**
- `lib/` utilities referencing service_role: **15 files**
- Total references (`app/` + `lib/`): **89**

The non-internal 46 are the leak surface. The mandate's RLS work has zero protective value on any row read or written through these routes — they bypass RLS by design. **Tightening RLS without auditing these routes will provide false confidence.**

## Non-internal routes that use service_role

```
app/api/admin/upgrade-subscription/route.ts
app/api/analytics/anomalies/route.ts
app/api/analytics/post-performance-sync/route.ts
app/api/ask-synthex/route.ts
app/api/auth/oauth/google/callback/route.ts
app/api/backup/route.ts
app/api/clients/route.ts
app/api/dashboard/content-score-history/route.ts
app/api/dashboard/geo-score/route.ts
app/api/effect-report/[id]/pdf/route.ts
app/api/effect-report/by-period/route.ts
app/api/effect-report/generate/route.ts
app/api/effect-report/list/route.ts
app/api/email/send/route.ts
app/api/founder/delete-account/route.ts
app/api/health/pipelines/route.ts
app/api/intelligence/competitors/route.ts
app/api/journey/click/route.ts
app/api/journey/pulse-confirm/route.ts
app/api/journey/pulse/route.ts
app/api/media/generate/image/route.ts
app/api/media/generate/video/route.ts
app/api/media/generate/voice/route.ts
app/api/media/library/route.ts
app/api/media/upload/route.ts
app/api/moderation/check/route.ts
app/api/monitoring/errors/route.ts
app/api/monitoring/metrics/route.ts
app/api/notifications/route.ts
app/api/og/effect-report/route.tsx
app/api/optimize/auto-schedule/route.ts
app/api/patterns/cached/route.ts
app/api/predict/trends/route.ts
app/api/rate-limit/route.ts
app/api/recommendations/route.ts
app/api/results/testimonial-card/route.tsx
app/api/social/facebook/post/route.ts
app/api/social/instagram/post/route.ts
app/api/social/linkedin/post/route.ts
app/api/social/pinterest/post/route.ts
app/api/social/reddit/post/route.ts
app/api/social/threads/post/route.ts
app/api/social/tiktok/post/route.ts
app/api/social/twitter/post/route.ts
app/api/social/youtube/post/route.ts
app/api/user/account/route.ts
```

## Why these blocked the original "5-10 PR batched migration" plan

The mandate's hard rule says:
> If RLS batch breaks an existing API route (e.g., service_role usage in client code), STOP and document the leak

If we ship a tenant-scoped policy on (say) `leads` then test it via the adversarial spec, the spec passes because it uses anon/auth keys. But every existing route in the list above that reads `leads` via service_role STILL bypasses the policy — meaning a malicious cross-tenant query through one of these routes (e.g. a user-supplied `organization_id` query parameter passed straight to `.from('leads').select().eq('organization_id', userInput)`) still returns rows from any tenant.

**Triage required before batched migrations resume:**
1. For each of the 46 routes, classify:
   - **Legitimate service-role use** (no tenant-scoped data — pure ops, health, cron, public reads) → mark exempt
   - **Service-role with user-supplied tenant filter** → URGENT, fix the route to use the user-context client or add server-side tenant assertion
   - **Service-role with hardcoded internal scope** → move to `app/api/internal/`
2. Add a CI lint rule that fails any new non-`/internal/` route importing the service-role client without an `@allow-service-role` annotation backed by a security-team review.

This audit must precede the wider RLS rollout. Per the mandate's STOP clause, the batched RLS PR plan is **halted at batch 1** pending this triage.

## Recommended next-actions (sequenced)

1. Single-PR triage spreadsheet: classify all 46 routes (legitimate / refactor-required / move-to-internal)
2. Refactor (or move) the "user-supplied tenant filter" routes first — these are the live SOC 2 critical findings
3. Once leaks are closed, resume batched RLS PRs starting with the 14 high-exposure NO_POLICY tables already identified in Phase 1 baseline
