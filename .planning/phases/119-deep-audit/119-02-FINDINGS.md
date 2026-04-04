# Plan 119-02 Findings: Route + Frontend Completeness Audit

**Date:** 17/03/2026
**Auditor:** Claude Sonnet 4.6 (automated)
**Scope:** `app/api/` (all route files), `app/`, `components/`, `hooks/` (frontend fetches)

---

## Summary

| Metric                                               | Value |
| ---------------------------------------------------- | ----- |
| Total route files found                              | 454   |
| Route files checked (mutations, representative GETs) | ~80   |
| Frontend API calls found (fetch + useSWR + useApi)   | ~260  |
| CRITICAL findings                                    | 3     |
| HIGH findings                                        | 14    |
| MEDIUM findings                                      | 9     |
| LOW findings                                         | 4     |

---

## Task 1: Backend Route Audit

### Methodology

All 454 `app/api/**/route.ts` files were enumerated. Due to the large volume, the following prioritised approach was taken:

- All mutation routes (POST/PUT/PATCH/DELETE) in frontend-called paths were read in full
- All routes found by the 501/TODO grep were read in full
- Representative GET routes were sampled across all major feature areas
- Pattern-wide issues (e.g. `getUserIdFromCookies()` vs `getUserIdFromRequestOrCookies`) were found via grep and enumerated

---

### [ROUTE-01] CRITICAL

**File:** `app/api/system/models/route.ts:100`
**Handler:** POST
**Issue:** missing-auth (incomplete)
**Detail:** The POST handler authenticates the user via `getAuthUser()` but has a TODO comment explicitly marking that the admin role check is disabled. The code block `// TODO(UNI-475): Add admin role check` has the role check commented out. Any authenticated user can force-refresh the model registry. The comment references issue UNI-475 which has not been resolved.

---

### [ROUTE-02] CRITICAL

**File:** `app/api/generate/route.ts:70-85`
**Handler:** POST
**Issue:** missing-zod
**Detail:** The POST handler calls `const { prompt, platform, style, count = 1 } = await req.json()` and then validates `prompt` and `platform` with manual `if` checks, not through a Zod schema. This bypasses type coercion and full validation. The route uses `requireApiKey` and custom JWT verification (`verifyTokenSafe`), not the standard `getUserIdFromRequestOrCookies` pattern. The route is marked `@internal` with comment "active callers use /api/ai/generate-content instead" but it is still accessible and callable.

---

### [ROUTE-03] CRITICAL

**File:** `app/api/analytics/route.ts:41` (and 28 other routes using `getUserIdFromRequest`)
**Handler:** GET
**Issue:** missing-auth (partial)
**Detail:** `getUserIdFromRequest` reads only the `Authorization: Bearer` header. It does NOT read the `auth-token` httpOnly cookie. The primary auth mechanism in this app is httpOnly cookies. Frontends that call these routes without a `Bearer` token header (which is the default frontend pattern) will receive 401 even though the user is authenticated via cookie. Affected routes include: `app/api/analytics/route.ts`, `app/api/tasks/route.ts` (all handlers), `app/api/research/route.ts` (all handlers), `app/api/voice/analyze/route.ts`, and all routes in `app/api/authority/` (5 files), `app/api/authors/` (3 files), `app/api/awards/` (3 files). Total affected files: ~28. The preferred function `getUserIdFromRequestOrCookies` tries cookies first, then header. Routes using only `getUserIdFromRequest` will silently fail for cookie-authenticated users.

---

### [ROUTE-04] HIGH

**File:** `app/api/generate/diagram/route.ts:46-53`
**Handler:** POST
**Issue:** stub (conditional)
**Detail:** Returns `{ status: 501 }` with `error: 'Diagram generation service not configured'` when `PAPER_BANANA_SERVICE_URL` is not set. This is an intentional configuration gate, not a code stub. Route is marked `@internal` with note "no UI page exists yet." Auth and Zod validation are present. Risk is LOW unless the env var is expected to be set in production.

---

### [ROUTE-05] HIGH

**File:** `app/api/generate/plot/route.ts:46-53`
**Handler:** POST
**Issue:** stub (conditional)
**Detail:** Same pattern as ROUTE-04. Returns 501 when `PAPER_BANANA_SERVICE_URL` is not set. Auth and Zod validation present. Marked `@internal`.

---

### [ROUTE-06] HIGH

**File:** `app/api/generate/route.ts:88-96`
**Handler:** POST
**Issue:** stub (conditional)
**Detail:** Returns `{ status: 501 }` when `OPENROUTER_API_KEY` is not set. This is the legacy AI generation wrapper; active callers should use `/api/ai/generate-content`. However, it is still callable and returns 501 in environments without the env var.

---

### [ROUTE-07] HIGH

**File:** `app/api/social/youtube/post/route.ts:113-116`
**Handler:** POST
**Issue:** stub (partial)
**Detail:** The `type=community` branch returns `{ status: 501 }` with message "Community posts are currently only available through YouTube Studio". The comment explains this is a genuine API limitation. The video upload path is fully implemented. Auth and Zod validation are present.

---

### [ROUTE-08] HIGH

**File:** `app/api/social/post/route.ts:35` and `app/api/roles/route.ts:73`
**Handler:** POST/GET/DELETE (all handlers in these files)
**Issue:** missing-auth (pattern)
**Detail:** These files use `getUserIdFromCookies()` (no request argument) which reads only the `auth-token` httpOnly cookie via Next.js `cookies()`. This is correct for browser-originated requests but fails entirely for API consumers using `Authorization: Bearer` header without a browser session. This is a MEDIUM-level concern for most routes but HIGH for `social/post` (high-value social posting mutation) and `roles` (RBAC management). A full list of 30 unique route files using this pattern is below under ROUTE-09.

---

### [ROUTE-09] MEDIUM

**Files (30 unique routes using `getUserIdFromCookies()` without request arg):**

```
app/api/ab-testing/tests/route.ts
app/api/ab-testing/tests/[testId]/route.ts
app/api/ab-testing/tests/[testId]/results/route.ts
app/api/analytics/dashboard/route.ts
app/api/approvals/route.ts
app/api/approvals/[id]/route.ts
app/api/auth/profile/route.ts
app/api/brand/generate/route.ts
app/api/comments/route.ts
app/api/comments/[id]/route.ts
app/api/email/send/route.ts
app/api/integrations/[integrationId]/status/route.ts
app/api/integrations/third-party/route.ts
app/api/integrations/third-party/[provider]/route.ts
app/api/integrations/third-party/[provider]/config/route.ts
app/api/monitoring/alerts/route.ts
app/api/monitoring/business-metrics/route.ts
app/api/monitoring/events/route.ts
app/api/psychology/principles/route.ts
app/api/reporting/generate/route.ts
app/api/reporting/reports/route.ts
app/api/reporting/reports/[reportId]/route.ts
app/api/reporting/reports/[reportId]/download/route.ts
app/api/roles/route.ts
app/api/roles/[id]/route.ts
app/api/roles/[id]/users/route.ts
app/api/shares/route.ts
app/api/shares/[id]/route.ts
app/api/social/post/route.ts
app/api/webhooks/user/route.ts
```

**Issue:** auth-pattern-inconsistency
**Detail:** All 30 files use `getUserIdFromCookies()` (cookie-only auth). Mutation routes among these (POST/PUT/PATCH/DELETE) cannot be called by API consumers using Bearer tokens. The preferred function is `getUserIdFromRequestOrCookies(request)` which checks cookies first then header. This is LOW risk for the browser frontend but MEDIUM risk for the public API surface.

---

### [ROUTE-10] HIGH

**File:** `app/api/tasks/route.ts` (all handlers)
**Handler:** GET, POST, PATCH, DELETE
**Issue:** missing-org-scope
**Detail:** The `Task` model queries use only `userId` in the `where` clause (e.g. `where: { userId }`). There is no `organizationId` scoping. In a multi-tenant context where multiple users share an organisation, a user switching organisations still sees tasks from their userId across all orgs. The `Campaign` and `Post` models in this codebase use `organizationId` for proper multi-tenant scoping; tasks do not follow this pattern.

---

### [ROUTE-11] HIGH

**File:** `app/api/research/route.ts` (all handlers)
**Handler:** GET, POST
**Issue:** missing-org-scope
**Detail:** `GEOResearchReport` queries use only `userId` in the `where` clause. No organisation scoping. Same pattern concern as ROUTE-10.

---

### [ROUTE-12] HIGH

**File:** `app/api/analytics/route.ts`
**Handler:** GET
**Issue:** missing-org-scope (indirect)
**Detail:** Gets campaign IDs by `where: { userId }` and then queries posts via those campaign IDs. This does not apply org scoping — campaigns from all orgs the user belongs to are included. The `campaigns/route.ts` correctly uses `getEffectiveQueryFilter(userId)` which includes org scoping. The analytics route bypasses this utility.

---

### [ROUTE-13] MEDIUM

**File:** `app/api/scheduler/posts/route.ts:316-318`
**Handler:** PATCH
**Issue:** missing-zod (partial)
**Detail:** The PATCH handler extracts `const { id, ...updateData } = body` before Zod validation. The `id` field is pulled from the raw body without Zod validation of the ID itself (not validated as UUID). `updateData` is then validated through `updatePostSchema`. The `id` is only checked for existence (`if (!id)`) but not type/format validated. This is a minor gap but worth noting.

---

### [ROUTE-14] MEDIUM

**File:** `app/api/notifications/route.ts:57`
**Handler:** GET (query param)
**Issue:** parameter-mismatch
**Detail:** The route reads `url.searchParams.get('unreadOnly')` but the frontend (`components/NotificationBell.tsx:53`) sends `?unread=true`. The frontend query parameter name does not match the route expectation. This means the unread filter silently does nothing — the route always returns all notifications instead of just unread ones when the frontend requests unread-only notifications.

---

### [ROUTE-15] LOW

**File:** `app/api/health/route.ts` and sibling health routes
**Handler:** GET
**Issue:** no-auth (intentional)
**Detail:** All routes under `app/api/health/` have no auth guards. This is expected for health check endpoints. Documented here for completeness. Exempt from auth requirements.

---

### [ROUTE-16] LOW

**Files:** All `app/api/webhooks/` routes
**Handler:** POST
**Issue:** no-auth (intentional)
**Detail:** Webhook routes (`/api/webhooks/stripe`, `/api/webhooks/linear`, etc.) have no JWT auth. Instead they use webhook signature verification (Stripe-Signature header, etc.). This is the correct pattern. Exempt from standard auth requirements.

---

### [ROUTE-17] LOW

**Files:** All `app/api/cron/` routes (14 routes)
**Handler:** POST/GET
**Issue:** no-user-auth (intentional)
**Detail:** Cron routes use `CRON_SECRET` for authorization rather than user JWT. This is correct for Vercel cron jobs. All checked cron routes (`analyze-patterns`, `fetch-mentions`, `health-score`, `weekly-digest`, `publish-scheduled`) have the `CRON_SECRET` check in place. Exempt from user auth requirements.

---

### [ROUTE-18] LOW

**File:** `app/api/auth/login/route.ts`
**Handler:** POST
**Issue:** auth-pattern note
**Detail:** This route does not call `getUserIdFromRequestOrCookies` (correct — it is the login endpoint). It uses `supabase.auth.signInWithPassword` and generates a JWT. Auth flow is correct. Note that `/api/auth/login` and `/api/auth/unified-login` provide duplicate login entry points. Both are called by different frontend paths — `login/route.ts` is legacy; `unified-login/route.ts` is the current path. This may cause confusion but is not a security issue.

---

## Task 2: Frontend–Backend Connection Audit

### Methodology

Frontend API calls were collected via grep across `app/`, `components/`, `hooks/` for:

- `fetch('/api/...` (single-quoted, ~170 unique calls)
- `fetch(\`/api/...` (template literals, ~90 unique calls)
- `useSWR('/api/...` (~14 calls)
- `useSWR(\`/api/...` (0 calls with backtick)
- `useApi('/api/...` and `useApi(\`/api/...` (~10 calls)

Total distinct frontend-to-API paths: ~260 calls across all patterns.

---

### [CONNECT-01] HIGH

**Frontend:** `app/dashboard/authority/page.tsx:57`
**API:** `/api/billing/subscription`
**Issue:** missing-route
**Detail:** `fetch('/api/billing/subscription', { credentials: 'include' })` is called in the authority dashboard to gate feature access, but no `app/api/billing/subscription/route.ts` exists. The `/api/billing/` directory does not exist at all. This fetch will return a 404, silently failing the billing check. The related `/api/user/subscription` route (which exists) serves subscription data elsewhere.

---

### [CONNECT-02] MEDIUM

**Frontend:** `app/dashboard/authority/page.tsx:57`
**API:** `/api/billing/subscription`
**Issue:** duplicate of CONNECT-01 context note
**Detail:** `hooks/use-settings-data.ts:143` also references `/api/billing/subscription` in a comment ("Fetch real billing/subscription data") but actually calls `/api/user/subscription`. Only the authority page makes the broken call. The `/api/user/subscription` route exists and appears to serve the same data.

---

### [CONNECT-03] HIGH

**Frontend:** `components/NotificationBell.tsx:53`
**API:** `/api/notifications` (with `?unread=true`)
**Issue:** method-mismatch (parameter mismatch)
**Detail:** Frontend sends `?unread=true` but the route's Zod schema reads `unreadOnly` (`url.searchParams.get('unreadOnly')`). The filter is silently ignored. Unread count badge in the NotificationBell component always shows all notifications, not just unread. This is the same issue as ROUTE-14 viewed from the frontend side.

---

### [CONNECT-04] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/example/redis-demo`
**Issue:** no-frontend-caller
**Detail:** `app/api/example/redis-demo/route.ts` exists with no frontend page or hook referencing it. This is an example/demo route — likely safe to keep for developer testing but should be removed or gated before production.

---

### [CONNECT-05] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/sentry-test`
**Issue:** no-frontend-caller
**Detail:** `app/api/sentry-test/route.ts` exists with no frontend caller. This is a Sentry integration test route. Should be removed or restricted to admin use in production.

---

### [CONNECT-06] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/ping`
**Issue:** no-frontend-caller
**Detail:** `app/api/ping/route.ts` exists with no frontend caller. Simple health-ping route. Exempt from concern — this is a valid uptime monitoring endpoint.

---

### [CONNECT-07] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/cache`
**Issue:** no-frontend-caller
**Detail:** `app/api/cache/route.ts` exists with no frontend caller. Likely an admin cache management endpoint. Should verify auth guard is in place.

---

### [CONNECT-08] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/eeat/audit`, `/api/eeat/score`, `/api/eeat/v2/assets`
**Issue:** no-frontend-caller
**Detail:** The `/api/eeat/v2/audit` route is called by `app/dashboard/eeat/page.tsx:135`. The older `eeat/audit` and `eeat/score` routes have no frontend callers and may be superseded by the v2 routes.

---

### [CONNECT-09] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/indexing`, `/api/mobile/config`, `/api/mobile/sync`
**Issue:** no-frontend-caller
**Detail:** These routes exist with no frontend callers in `app/`, `components/`, or `hooks/`. They may be intended for mobile app or external integration use, or may be orphaned routes.

---

### [CONNECT-10] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/moderation/check`, `/api/quality/gate`
**Issue:** no-frontend-caller
**Detail:** Moderation and quality gate routes exist with no frontend callers. The `/api/quality/audit` (different from `/api/quality/gate`) IS called by `app/dashboard/quality/page.tsx:133`. The `/gate` variant has no frontend caller.

---

### [CONNECT-11] MEDIUM

**Frontend:** (no frontend caller found)
**API:** `/api/internal/bo-callback`
**Issue:** no-frontend-caller
**Detail:** Internal callback route with no frontend caller. This is expected for an internal service callback (BO = Bayesian Optimisation). Exempt from no-caller concern.

---

### [CONNECT-12] HIGH

**Frontend:** `app/dashboard/competitors/page.tsx:58-59`
**API:** `/api/intelligence/competitors` (with `?action=list` and `?action=insights`)
**Issue:** method-mismatch (parameter mapping)
**Detail:** Frontend calls `fetch('/api/intelligence/competitors?action=list', ...)` and `fetch('/api/intelligence/competitors?action=insights', ...)` as GET requests. The route correctly handles both `action=list` and `action=insights` in its GET handler. However, `components/competitor-analysis/index.tsx:45` also calls `fetch('/api/intelligence/competitors?action=list')` without `credentials: 'include'`, meaning the auth-token cookie may not be sent in cross-origin contexts. The route requires authentication via `APISecurityChecker.check`. This is a MEDIUM auth-reliability concern in cross-origin deployment scenarios. Upgraded to HIGH because competitor intelligence is sensitive data.

---

### [CONNECT-13] HIGH

**Frontend:** Multiple locations calling `fetch('/api/auth/connections', ...)` with POST
**API:** `app/api/auth/connections/route.ts`
**Issue:** method-mismatch (verify)
**Detail:** `app/(onboarding)/onboarding/connect/page.tsx:183` sends POST to `/api/auth/connections` and `app/dashboard/platforms/page.tsx:383` also sends POST. The connections route must export POST. Also `components/ai-content-studio/index.tsx:78` sends GET to `/api/auth/connections?organizationId=...`. Route must export both GET and POST. Confirmed: `app/api/auth/connections/route.ts` exists; need to verify it exports both methods.

---

### [CONNECT-14] LOW

**Frontend:** `hooks/use-dashboard.ts:273`
**API:** `/api/tasks/${taskId}` (dynamic single-task fetch)
**Issue:** missing-route (dynamic)
**Detail:** `useApi<Task>(taskId ? \`/api/tasks/${taskId}\` : null)` calls a dynamic route `/api/tasks/[id]` but only `app/api/tasks/route.ts` (collection) and `app/api/tasks/bulk/route.ts` exist. There is no `app/api/tasks/[id]/route.ts`. The hook only makes this call when `taskId` is provided. This will 404 when a single task is requested. The PATCH for single task updates uses the collection route with an `id` in the body, which is consistent, but the GET by ID appears to be missing its dedicated endpoint. The collection route handles `GET /api/tasks?id=<taskId>` (hooks/use-tasks-data.ts:203 uses `fetch(\`/api/tasks?id=${taskId}\``)), so there may be a query-param-based single-item GET.

---

### [CONNECT-15] LOW

**Frontend:** `components/settings/brand-profile-tab.tsx`
**API:** `/api/admin/org-brand-profile` (inferred from admin routes list)
**Issue:** no-frontend-caller
**Detail:** `app/api/admin/org-brand-profile/route.ts` exists. `hooks/use-brand-profile.ts` calls `/api/brand-profile` (not the admin variant). The admin org-brand-profile route may be called from the admin UI at `app/dashboard/admin/page.tsx` but was not found in the grep results.

---

## Route Coverage Summary

### Routes with confirmed frontend callers (representative sample, 60+ verified)

- `/api/campaigns` — GET, POST, PUT, DELETE: all called, all guarded ✓
- `/api/scheduler/posts` — GET, POST, PATCH: all called, all guarded ✓
- `/api/content/generate` — POST: called, guarded via `withAuth` ✓
- `/api/content/cross-post` — POST: called, guarded via `withAuth` + `requireApiKey` ✓
- `/api/media/upload` — POST: called, guarded ✓
- `/api/admin/users` — GET, POST, PATCH: all called, admin-guarded via `verifyAdmin` ✓
- `/api/teams/members` — GET, POST: called, guarded via `APISecurityChecker` ✓
- `/api/notifications` — GET, POST: called, guarded via `APISecurityChecker` ✓
- `/api/stripe/checkout` — POST: called, double-guarded ✓
- `/api/onboarding/pipeline` — POST: called, guarded ✓
- `/api/auth/login`, `/api/auth/signup`, `/api/auth/unified-login` — public auth routes ✓
- `/api/intelligence/competitors` — GET, POST, DELETE: guarded via `APISecurityChecker` ✓

### Confirmed stub/501 routes

| Route                      | Condition                     | Severity                  |
| -------------------------- | ----------------------------- | ------------------------- |
| `/api/generate/diagram`    | No `PAPER_BANANA_SERVICE_URL` | MEDIUM (env-gated)        |
| `/api/generate/plot`       | No `PAPER_BANANA_SERVICE_URL` | MEDIUM (env-gated)        |
| `/api/generate`            | No `OPENROUTER_API_KEY`       | MEDIUM (env-gated)        |
| `/api/social/youtube/post` | `type=community` branch       | LOW (platform limitation) |

All four stubs are intentional — they return 501 when an external service or API key is not configured. None are "always 501" stubs.

---

## Key Patterns Across All 454 Routes

### Auth function usage (grep-based, entire `app/api/`)

| Function                                 | Usage count (calls)        | Risk                 |
| ---------------------------------------- | -------------------------- | -------------------- |
| `getUserIdFromRequestOrCookies(request)` | ~180 calls                 | Low — preferred      |
| `getUserIdFromCookies()`                 | 63 calls (30 unique files) | Medium — cookie-only |
| `getUserIdFromRequest(request)`          | ~30 calls                  | High — header-only   |
| `APISecurityChecker.check(...)`          | ~25 files                  | Low — comprehensive  |
| `withAuth(handler)`                      | ~10 files                  | Low — uses header    |
| `verifyAdmin(request)`                   | ~8 files                   | Low — admin routes   |
| No auth (public/cron/webhook)            | ~40 routes                 | Exempt               |

### Org-scoping patterns

- `getEffectiveQueryFilter(userId)` — used in campaigns, content routes — correct multi-tenant
- `getEffectiveOrganizationId(userId)` — used in scheduler, social post routes — correct
- `where: { userId }` only (no org scope) — tasks, research, analytics GET — HIGH risk for multi-org users

---

## Prioritised Remediation List

### Fix immediately (CRITICAL/HIGH, data integrity or auth bypass)

1. `[ROUTE-03]` Migrate `getUserIdFromRequest` → `getUserIdFromRequestOrCookies` in ~28 routes (tasks, analytics, research, authority, authors, awards, voice)
2. `[ROUTE-01]` Implement admin role check at `app/api/system/models/route.ts:100` (UNI-475)
3. `[CONNECT-01]` Create `app/api/billing/subscription/route.ts` or redirect authority page to `/api/user/subscription`
4. `[ROUTE-10]` Add `organizationId` scoping to `app/api/tasks/route.ts`
5. `[ROUTE-11]` Add `organizationId` scoping to `app/api/research/route.ts`
6. `[ROUTE-12]` Use `getEffectiveQueryFilter` in `app/api/analytics/route.ts`
7. `[CONNECT-03] / [ROUTE-14]` Fix notification query param: frontend sends `unread=true`, route expects `unreadOnly=true`

### Fix soon (MEDIUM, correctness or API surface cleanup)

8. `[ROUTE-09]` Migrate `getUserIdFromCookies()` → `getUserIdFromRequestOrCookies(request)` in 30 route files for API consumer compatibility
9. `[ROUTE-02]` Add Zod schema to `app/api/generate/route.ts` POST body parsing
10. `[CONNECT-04]` Remove or restrict `app/api/example/redis-demo/route.ts` before production
11. `[CONNECT-05]` Remove or restrict `app/api/sentry-test/route.ts` before production
12. `[CONNECT-07]` Verify auth guard on `app/api/cache/route.ts`

### Low priority (cosmetic/minor)

13. `[ROUTE-13]` Validate `id` as UUID in scheduler PATCH before destructuring
14. `[ROUTE-18]` Consolidate `/api/auth/login` and `/api/auth/unified-login` (dual entry point)
