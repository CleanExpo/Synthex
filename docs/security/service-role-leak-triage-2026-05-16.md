# Service-Role Leak Triage — 2026-05-16

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b` (Synthex Phase 2)
**Source inventory:** `docs/security/service-role-leaks-2026-05-16.md` (46 non-internal routes)
**Triage author:** Senior Security Engineer (Claude Opus 4.7)

## Classification framework

| Class | Definition | Action |
|---|---|---|
| **LEGITIMATE-CRON** | `app/api/cron/*` or scheduled-trigger routes that need service-role to bypass user-auth, gated by `CRON_SECRET` | Document, leave alone |
| **LEGITIMATE-ADMIN** | Admin routes that enforce `ADMIN_API_KEY` / `verifyAdmin` upstream AND need cross-org service-role access | Document, leave alone |
| **LEGITIMATE-SYSTEM** | Webhook / OAuth-callback / internal-only routes with no user identity at request time | Document, leave alone |
| **REFACTOR-AUTH-SCOPED** | User-facing routes using service-role to query data the user owns. Bypass RLS but currently server-derive the tenant from auth — still need migration to `withAuth` + `auth.clientId` so we never trust user-supplied tenant filters | Mark for refactor |
| **REFACTOR-CRITICAL** | User-supplied tenant filter (`searchParams.get('client_id')`) flows straight into `.eq('client_id', x)` via service-role. **Live SOC 2 critical finding.** | Refactor first |
| **MOVE-TO-INTERNAL** | Routes that should not be publicly reachable — admin tooling masquerading as user-facing | Relocate to `/api/admin/*` with `verifyAdmin` |

## Helper-pattern note

The Synthex codebase does NOT expose an `anon`-key/RLS-scoped server client. Tenant scoping is enforced at the **application layer** by `lib/auth/with-auth.ts` (`withAuth(handler)`) which injects an `AuthContext { userId, clientId, role }` derived from JWT cookie + Prisma `User.organizationId`. The refactor pattern is therefore:

1. Replace ad-hoc `getUserIdFromRequestOrCookies()` + manual Prisma org-lookup with `withAuth`.
2. Drop user-supplied `client_id` / `organization_id` query params — use `auth.clientId` from the wrapper.
3. Keep the service-role Supabase client for the actual DB read (Synthex's connection-pooler-broken path); the security boundary moves cleanly to the route entry.
4. Add a cross-tenant test in `__tests__/security/<route>-rls.test.ts`.

(A future deeper migration could swap to a cookie-bound `@supabase/ssr` server client so RLS itself enforces the boundary — out of scope for this triage.)

## Per-route classification (46 routes)

### REFACTOR-CRITICAL (6) — user-supplied tenant filter, currently exploitable

| # | Route | Class | Justification | Refactor target |
|---|---|---|---|---|
| 1 | `app/api/og/effect-report/route.tsx` | **REFACTOR-CRITICAL** | No auth at all. `?client_id=` flows into `.eq('client_id', clientId)` over `effect_reports` → returns full `report_data` JSON (business name, GEO score, attribution, achievement summary) for any tenant. **Fixed in this PR.** | `withAuth`-equivalent inline (Prisma not edge-compatible — switch to nodejs runtime), drop `client_id` param, use server-derived `organizationId` |
| 2 | `app/api/results/testimonial-card/route.tsx` | **REFACTOR-CRITICAL** | No auth. `?client_id=` flows into `.eq('organization_id', clientId)` over `organizations` + `client_geo_scores` + `brand_profiles` → leaks business name + GEO trend + brand colour for any tenant | Same as #1 — same refactor template |
| 3 | `app/api/journey/click/route.ts` | **REFACTOR-CRITICAL** | Unsigned email-tracking pixel. Takes `client_id` + `moment_id` from query string and mutates `client_journey_events` with service-role. Any caller can flip another tenant's journey events. | HMAC-sign the link token at email-send time; verify signature before writing |
| 4 | `app/api/journey/pulse/route.ts` | **REFACTOR-CRITICAL** | Same shape as #3 — unsigned 1×1-pixel survey response, accepts `client_id` + `moment_id` + `score` and writes to `client_journey_events` | Same HMAC fix |
| 5 | `app/api/journey/pulse-confirm/route.ts` | **REFACTOR-CRITICAL** | Same as #3–#4 — unsigned confirmation page that writes the survey response if not already done | Same HMAC fix |
| 6 | `app/api/effect-report/generate/route.ts` | **REFACTOR-CRITICAL** | Has `role === 'owner'` bypass that accepts `body.client_id` override. The `owner` role is per-organisation, not platform-wide — an owner of org A can supply org B's `client_id` and generate a report for org B's data (service-role bypasses RLS) | Drop the override OR look up cross-org membership server-side before honouring it |
| 7 | `app/api/ask-synthex/route.ts` | **REFACTOR-CRITICAL** | Same shape as #6 — `AskSynthexSchema.clientId` is user-supplied; `organizationId = parsed.data.clientId ?? auth.clientId`. The guard at line 441 blocks non-owners, but the per-org `owner` role can still cross-tenant | Same: tighten owner-bypass branch — assert `body.clientId === auth.clientId` unless caller is a platform-admin |

### REFACTOR-AUTH-SCOPED (10) — currently safe (server-derived tenant) but should migrate

These routes use service-role + server-derive the tenant from authenticated userId. They are NOT currently exploitable for cross-tenant access. The refactor consolidates them onto `withAuth` so the pattern is uniform, the request-param surface stays clean, and a future RLS-via-cookie-session migration is a one-touch swap.

| # | Route | Class | Justification | Refactor target |
|---|---|---|---|---|
| 8 | `app/api/dashboard/content-score-history/route.ts` | REFACTOR-AUTH-SCOPED | Hand-rolled `getUserIdFromRequestOrCookies` + Prisma `user.findUnique` — exact replication of `withAuth` | Replace with `withAuth(async (req, { clientId }) => ...)` |
| 9 | `app/api/dashboard/geo-score/route.ts` | REFACTOR-AUTH-SCOPED | `getUserIdFromRequestOrCookies` + `.eq('client_id', userId)` — uses userId as org key (legacy schema) | Migrate via `withAuth`, fix `client_id` to `auth.clientId` once schema check confirms |
| 10 | `app/api/notifications/route.ts` | REFACTOR-AUTH-SCOPED | Service-role + `.eq('user_id', userId)`. Safe today but should use `withAuth` for uniformity | `withAuth` wrap |
| 11 | `app/api/patterns/cached/route.ts` | REFACTOR-AUTH-SCOPED | Uses `getEffectiveOrganizationId(userId)`. Already scoped, but parallel-pattern to withAuth | `withAuth` wrap; keep multi-business resolver if `auth.clientId` doesn't cover it |
| 12 | `app/api/effect-report/list/route.ts` | REFACTOR-AUTH-SCOPED | Already uses `withAuth` ✓ — only the service-role client construction is the leak. Lower priority — already auth-scoped | Consolidate admin-client factory; no behaviour change |
| 13 | `app/api/effect-report/by-period/route.ts` | REFACTOR-AUTH-SCOPED | Same as above — `withAuth` ✓ | Same |
| 14 | `app/api/effect-report/[id]/pdf/route.ts` | REFACTOR-AUTH-SCOPED | Same — `withAuth` ✓. Must verify the report `[id]` belongs to `auth.clientId` before serving PDF | Add explicit `WHERE id = $1 AND client_id = $2` assertion |
| 15 | `app/api/email/send/route.ts` | REFACTOR-AUTH-SCOPED | `getUserIdFromRequestOrCookies` + service-role for delivery tracking | `withAuth` wrap |
| 16 | `app/api/media/upload/route.ts` | REFACTOR-AUTH-SCOPED | `getUserIdFromRequestOrCookies` + uploads to user-scoped Storage path | `withAuth` wrap |
| 17 | `app/api/analytics/post-performance-sync/route.ts` | REFACTOR-AUTH-SCOPED | `getUserIdFromRequestOrCookies` + Prisma org lookup | `withAuth` wrap |
| 18 | `app/api/health/pipelines/route.ts` | REFACTOR-AUTH-SCOPED | Already uses `withAuth` ✓ — only the admin client factory needs consolidation. Note: reads `edge_function_logs` which is system-wide; not tenant data | Lower priority. Document the cross-tenant read as intentional (it's a status board) |

### LEGITIMATE-CRON / SYSTEM (2) — scheduled or anonymous-system, no user auth at request time

| # | Route | Class | Justification |
|---|---|---|---|
| 19 | `app/api/backup/route.ts` | LEGITIMATE-CRON | `verifyCronSecret` Bearer check gates POST; service-role required to read all tenant tables for backup |
| 20 | `app/api/monitoring/errors/route.ts` | LEGITIMATE-SYSTEM | Internal error sink (client-side error reporter posts crashes); service-role for the audit-log insert. Validates user via cookie when present but accepts anon errors |

### LEGITIMATE-ADMIN (3) — admin-key gated, cross-org by design

| # | Route | Class | Justification |
|---|---|---|---|
| 21 | `app/api/admin/upgrade-subscription/route.ts` | LEGITIMATE-ADMIN | `verifyAdmin` enforces `ADMIN_API_KEY` (or admin JWT) before any DB call; cross-tenant subscription edits require service-role |
| 22 | `app/api/monitoring/metrics/route.ts` | LEGITIMATE-ADMIN | `verifyAdmin` gate ✓; aggregates `profiles.count` + `content_posts.count` system-wide |
| 23 | `app/api/rate-limit/route.ts` | LEGITIMATE-ADMIN | `ADMIN_API_KEY` gate ✓ on reset/inspect operations |

### LEGITIMATE-SYSTEM (3) — user-deletion or no-session-at-request-time flows

| # | Route | Class | Justification |
|---|---|---|---|
| 24 | `app/api/founder/delete-account/route.ts` | LEGITIMATE-SYSTEM | Privacy Act APP-11 user-data-deletion. Auth-checks the user, then needs service-role to call `supabase.auth.admin.deleteUser()` (admin API requires service-role by design) |
| 25 | `app/api/user/account/route.ts` | LEGITIMATE-SYSTEM | Same shape as #24 — user-initiated account delete + admin auth API call. Service-role needed for `auth.admin.deleteUser` |
| 26 | `app/api/auth/oauth/google/callback/route.ts` | LEGITIMATE-SYSTEM | Sign-IN flow. At request time the user has NO session — that's what this route mints. State validated via PKCE; user record is upserted by `google_id`. Cannot scope by `auth.uid()` because there is no auth yet |

### MOVE-TO-INTERNAL (11) — admin/system tooling currently routed as user-facing

These routes are written like internal services (often have an `@internal` JSDoc tag) but live at user-reachable paths. They have no per-user tenant scoping because they're not meant to be called per-user. Move to `app/api/internal/<x>` (or `app/api/admin/<x>`) and gate with `verifyAdmin` / `verifyCronSecret`.

| # | Route | Class | Justification | Target path |
|---|---|---|---|---|
| 27 | `app/api/analytics/anomalies/route.ts` | MOVE-TO-INTERNAL | `APISecurityChecker` gates auth but no tenant scoping in handler — calls `anomalyDetector` system-wide | `app/api/admin/analytics/anomalies` |
| 28 | `app/api/intelligence/competitors/route.ts` | MOVE-TO-INTERNAL | Same pattern — `APISecurityChecker` auth, no tenant scope | `app/api/admin/intelligence/competitors` |
| 29 | `app/api/moderation/check/route.ts` | MOVE-TO-INTERNAL | Has `@internal` JSDoc tag explicitly. Called by server-side publishing pipeline, not UI | `app/api/internal/moderation/check` |
| 30 | `app/api/media/library/route.ts` | MOVE-TO-INTERNAL | `APISecurityChecker` auth — but service operates on a system-wide media library | Refactor to `withAuth` + per-tenant library, OR move to admin |
| 31 | `app/api/predict/trends/route.ts` | MOVE-TO-INTERNAL | `APISecurityChecker` auth — calls `trendPredictor` on system trend data | `app/api/admin/predict/trends` |
| 32 | `app/api/recommendations/route.ts` | MOVE-TO-INTERNAL | `APISecurityChecker` auth — `contentRecommendationEngine(userId, ...)` but engine uses service-role with no further tenant assertion | Refactor engine to take `clientId`; OR move admin-only |
| 33 | `app/api/optimize/auto-schedule/route.ts` | MOVE-TO-INTERNAL | `APISecurityChecker` auth — calls system ML predictor | Same pattern |
| 34 | `app/api/clients/route.ts` | MOVE-TO-INTERNAL | `@internal` JSDoc — "not called directly by frontend UI", "agency client management workflows" | `app/api/admin/clients` |
| 35 | `app/api/media/generate/image/route.ts` | MOVE-TO-INTERNAL | `APISecurityChecker` auth — generation engine uses service-role for usage tracking. Per-tenant via `userId` from APISecurityChecker context — verify | Audit; promote `withAuth` if user-facing, internal if not |
| 36 | `app/api/media/generate/video/route.ts` | MOVE-TO-INTERNAL | Same as #35 |
| 37 | `app/api/media/generate/voice/route.ts` | MOVE-TO-INTERNAL | Same as #35 |

### Social posting routes (9) — REFACTOR-AUTH-SCOPED

All `app/api/social/<platform>/post/route.ts` (facebook, instagram, linkedin, pinterest, reddit, threads, tiktok, twitter, youtube) follow the same pattern: `getUserIdFromRequestOrCookies` → service-role to fetch `platform_connections` for the user → call the platform's API. They use server-derived `userId` to scope; not directly exploitable today, but should migrate to `withAuth`.

| # | Route | Class | Refactor target |
|---|---|---|---|
| 38 | `app/api/social/facebook/post/route.ts` | REFACTOR-AUTH-SCOPED | `withAuth` wrap; assert `platform_connections.user_id = auth.userId` |
| 39 | `app/api/social/instagram/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |
| 40 | `app/api/social/linkedin/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |
| 41 | `app/api/social/pinterest/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |
| 42 | `app/api/social/reddit/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |
| 43 | `app/api/social/threads/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |
| 44 | `app/api/social/tiktok/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |
| 45 | `app/api/social/twitter/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |
| 46 | `app/api/social/youtube/post/route.ts` | REFACTOR-AUTH-SCOPED | Same |

## Final breakdown (single-classification, 46 routes)

| Class | Count | Routes |
|---|---:|---|
| **REFACTOR-CRITICAL** | **7** | og/effect-report, results/testimonial-card, journey/click, journey/pulse, journey/pulse-confirm, effect-report/generate, ask-synthex |
| **REFACTOR-AUTH-SCOPED** | **20** | 11 listed above (#8–#18) + 9 social-post routes |
| **LEGITIMATE-CRON** | **1** | /backup |
| **LEGITIMATE-SYSTEM** | **3** | /monitoring/errors, /founder/delete-account, /user/account, /oauth/google/callback (4 — counted as 3 LEGITIMATE-SYSTEM + 1 LEGITIMATE-AUTH-CALLBACK; flatten as SYSTEM) |
| **LEGITIMATE-ADMIN** | **3** | /admin/upgrade-subscription, /monitoring/metrics, /rate-limit |
| **MOVE-TO-INTERNAL** | **11** | /analytics/anomalies, /intelligence/competitors, /moderation/check, /media/library, /predict/trends, /recommendations, /optimize/auto-schedule, /clients, /media/generate/image, /media/generate/video, /media/generate/voice |
| Adjusted total | **45** | (4 LEGITIMATE-SYSTEM rolled to 3 above for compactness; with the OAuth callback split out it sums to 46) |

Reconciled breakdown including the OAuth callback as its own LEGITIMATE-SYSTEM line: **7 + 20 + 1 + 4 + 3 + 11 = 46.**

## Triage gate

Per the mandate's STOP clause: Phase 2 RLS batches 2–6 may proceed once this triage doc is on `main`. The REFACTOR-CRITICAL set (#1–#7) MUST be patched before RLS batch 2 to prevent the case where a tightened RLS policy is silently bypassed by these routes. **This PR ships the fix for #1 (`/api/og/effect-report`); #2–#7 follow in subsequent PRs per the refactor priority list.** The remaining REFACTOR-AUTH-SCOPED routes are not blockers for the RLS rollout — they are a hygiene migration that should run in parallel batches of ≤5 per PR over the following sprint.
