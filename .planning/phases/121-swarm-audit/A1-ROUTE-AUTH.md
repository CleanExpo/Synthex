# A1 — Route Security & Auth Audit

Generated: 2026-03-18
Agent: A1 (route-auditor)
Phase-119 baseline: 107 findings

---

## Audit Scope

- Auth migration check: `getUserIdFromRequest` → `getUserIdFromRequestOrCookies` across all `app/api/`
- UNI-475 / admin role check at `/api/system/models`
- ROUTE-10: `app/api/tasks/route.ts` — missing `organizationId`
- ROUTE-11: `app/api/research/route.ts` — missing `organizationId`
- CONNECT-01: `/api/billing/subscription` missing route
- CONNECT-03: `NotificationBell` query-param mismatch
- 20 unaudited routes across audience/, bio/, forecast/, listening/, predict/, sentinel/
- Demo/test routes: `app/api/example/redis-demo/` and `app/api/sentry-test/`
- Cookie-only auth (`getUserIdFromCookies`) pattern across API routes

---

## Findings

---

```
[A1-FINDING-001] CONFIRMED-RESOLVED
Status: CONFIRMED-RESOLVED
Phase-119 ref: FINDING-005 (formerly ROUTE-01 / UNI-475)
File: app/api/system/models/route.ts:96-105
Issue: POST handler now calls verifyAdmin(request) from lib/admin/verify-admin.ts which enforces admin/owner role check via x-admin-api-key header OR JWT + role lookup. The TODO comment is gone.
Fix: N/A — resolved
Linear: UNI-475
```

---

```
[A1-FINDING-002] CONFIRMED-RESOLVED
Status: CONFIRMED-RESOLVED
Phase-119 ref: FINDING-007 (formerly ROUTE-03)
File: app/api/ (all routes)
Issue: Phase-119 reported ~83 routes using getUserIdFromRequest (header-only). Grep across all app/api/ for getUserIdFromRequest (without OrCookies) returns zero matches. The migration is complete.
Fix: N/A — resolved
Linear: N/A
```

---

```
[A1-FINDING-003] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-022 (formerly ROUTE-10)
File: app/api/tasks/route.ts:122 (GET), app/api/tasks/route.ts:193 (POST PATCH DELETE)
Issue: Task model has no organizationId column (confirmed in prisma/schema.prisma). All four handlers (GET/POST/PATCH/DELETE) scope queries to userId only. In a multi-org context, a user who belongs to multiple organisations sees tasks across all their orgs regardless of active org context. The campaigns route (app/api/campaigns/route.ts) uses getEffectiveQueryFilter which correctly scopes by org — the tasks route does not.
Fix: Add organizationId to Task model (nullable, backward-compatible), then update all where clauses to include the org filter via getEffectiveQueryFilter(userId). Requires schema migration with explicit human approval.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-004] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-023 (formerly ROUTE-11)
File: app/api/research/route.ts:66 (GET), app/api/research/route.ts:114 (POST)
Issue: GEOResearchReport model has no organizationId field (confirmed in prisma/schema.prisma). GET and POST both scope queries to userId only. Same cross-org data exposure risk as FINDING-003.
Fix: Add organizationId to GEOResearchReport model, update both handlers to include org filter. Requires schema migration with explicit human approval.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-005] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-024 (formerly ROUTE-12)
File: app/api/analytics/route.ts:89-92
Issue: GET handler fetches campaign IDs via `where: { userId }` with no organizationId scoping. The campaigns route correctly uses getEffectiveQueryFilter(userId) which gates by org; the analytics route bypasses this entirely, returning analytics data for campaigns across all orgs the user belongs to.
Fix: Replace `where: { userId }` with `await getEffectiveQueryFilter(userId)` (same pattern as campaigns/route.ts), and add the zero-key guard to deny rather than expose cross-tenant data.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-006] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-025 (formerly CONNECT-01)
File: app/api/billing/ (directory does not exist)
Issue: app/dashboard/authority/page.tsx:57 calls fetch('/api/billing/subscription', { credentials: 'include' }) to gate the "authority" addon feature. No app/api/billing/ directory exists at all. The fetch returns 404 silently — hasAddon defaults to false, effectively disabling addon gate enforcement for all users.
Fix: Create app/api/billing/subscription/route.ts that reads the user's subscription from the database and returns { addons: string[] }, or redirect the call to the equivalent /api/user/subscription route which already exists.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-007] HIGH
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-026 (formerly CONNECT-03)
File: components/NotificationBell.tsx:53 vs app/api/notifications/route.ts:29,57
Issue: The checkForNewNotifications polling function sends GET /api/notifications?unread=true. The route's querySchema defines the param as unreadOnly (not unread), and reads url.searchParams.get('unreadOnly'). The unread=true param is silently ignored — the filter is never applied. Additionally, the polling function checks data.hasNew to decide whether to animate the bell, but the route returns unreadCount (an integer), not a hasNew boolean. The bell animation never triggers regardless of new notifications.
Fix: Either (a) rename the API param from unreadOnly to unread in the route querySchema and searchParams.get call, or (b) update the frontend to use ?unreadOnly=true. Also add hasNew: unreadCount > 0 to the route response shape, or update the frontend to check data.unreadCount > 0.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-008] MEDIUM
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-021 (formerly ROUTE-08)
File: app/api/social/post/route.ts:15,35,245 and app/api/roles/route.ts:16,73,137
Issue: Both high-value routes use getUserIdFromCookies() (cookie-only) rather than getUserIdFromRequestOrCookies(request). social/post handles production social media posting; roles handles RBAC management. These routes cannot be called by API consumers using Bearer tokens. Phase-119 reported 30 routes in this state; the social/post and roles routes are confirmed still using cookie-only auth. A broader count shows 30 unique route files still import getUserIdFromCookies.
Fix: Replace getUserIdFromCookies() with getUserIdFromRequestOrCookies(request) across the 30 affected files. Priority: social/post and roles first.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-009] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: app/api/example/redis-demo/route.ts
Issue: File exists and is marked @deprecated with comment "No active callers. Candidate for removal." The withSession stub in this file does NOT authenticate — it accepts anonymous requests (falls through to session.user.id = 'anonymous') and writes Redis keys prefixed with demo:anonymous:. The rate limiter is the only protection. This is a live unauthenticated Redis write endpoint reachable at /api/example/redis-demo in production.
Fix: Move file to .claude/archived/2026-03-18/ and remove the route. It is already marked for removal and has zero active callers.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-010] LOW
Status: CONFIRMED-RESOLVED
Phase-119 ref: N/A (sentry-test not specifically called out in 119)
File: app/api/sentry-test/route.ts
Issue: File exists but has been replaced with a 404 stub. The original Sentry import that caused cold-start performance issues was archived to .claude/archived/2026-03-12/sentry-test-route.ts. Current stub returns 404 for GET and POST. Route is effectively dead but the stub file remains in the build.
Fix: For cleanliness, move the stub to archived as well. Not a security risk in current state.
Linear: N/A
```

---

```
[A1-FINDING-011] MEDIUM
Status: NEW
Phase-119 ref: N/A
File: app/api/listening/route.ts, app/api/listening/keywords/route.ts, app/api/listening/mentions/route.ts
Issue: All three social listening routes use getUserIdFromRequestOrCookies (auth present — PASS) and scope all queries to userId only. The TrackedKeyword and SocialMention models do not have an organizationId field (same pattern as Task/GEOResearchReport). Social listening data is user-scoped only. In multi-org context, switching orgs does not isolate listening data.
Fix: Evaluate whether listening data should be org-scoped. If yes, add organizationId to TrackedKeyword and SocialMention models and update query filters.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-012] LOW
Status: NEW
Phase-119 ref: N/A
File: app/api/audience/insights/route.ts
Issue: Auth present (getUserIdFromRequestOrCookies — PASS). Route correctly calls getEffectiveOrganizationId(userId) and scopes PlatformConnection queries to organizationId. However if getEffectiveOrganizationId returns null, the query uses organizationId: null which may still return connections that have no org set. The null case is not guarded with a denial path.
Fix: Add a null-org guard: if organizationId is null and the user belongs to an organisation, return 403 rather than querying with null.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-013] LOW
Status: NEW
Phase-119 ref: N/A
File: app/api/predict/trends/route.ts:87-90
Issue: The GET handler returns 403 (not 401) when auth fails for unauthenticated requests, using a hardcoded status 403 rather than differentiating 401 (no auth) from 403 (insufficient permissions). APISecurityChecker distinguishes these cases via security.error === 'Authentication required'. The POST handler at line 173 has the same issue. Contrast with sentinel/alerts/route.ts which correctly returns 401 when error is 'Authentication required'.
Fix: Change status 403 to `security.error === 'Authentication required' ? 401 : 403` in both handlers, matching the pattern in sentinel/alerts/route.ts.
Linear: CREATE-NEW
```

---

```
[A1-FINDING-014] LOW
Status: CONFIRMED-RESOLVED
Phase-119 ref: N/A
File: app/api/sentinel/alerts/route.ts, app/api/sentinel/check/route.ts, app/api/sentinel/status/route.ts, app/api/sentinel/updates/route.ts
Issue: All four sentinel routes use APISecurityChecker with AUTHENTICATED_READ or AUTHENTICATED_WRITE policies. Auth is confirmed present and correctly returns 401 vs 403. Sentinel data is scoped to userId. PASS.
Fix: N/A
Linear: N/A
```

---

```
[A1-FINDING-015] LOW
Status: CONFIRMED-RESOLVED
Phase-119 ref: N/A
File: app/api/bio/route.ts, app/api/listening/route.ts, app/api/listening/keywords/route.ts, app/api/listening/mentions/route.ts, app/api/predict/train/route.ts, app/api/predict/predict/route.ts, app/api/predict/models/route.ts, app/api/audience/insights/route.ts
Issue: All 8 routes confirmed using getUserIdFromRequestOrCookies or APISecurityChecker. Auth migration to the cookie-and-header pattern is complete for these directories. PASS.
Fix: N/A
Linear: N/A
```

---

## Auth Migration Status

| Pattern                                   | Count                             | Notes                                                                                                      |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `getUserIdFromRequestOrCookies`           | primary pattern                   | All spot-checked routes (analytics, bio, listening, predict, audience, tasks, research) confirmed migrated |
| `getUserIdFromCookies` (cookie-only)      | 30 unique files                   | Not migrated — see A1-FINDING-008                                                                          |
| `APISecurityChecker`                      | secondary pattern                 | sentinel/, notifications/, predict/trends — correctly used                                                 |
| `getAuthUser` (Supabase server)           | system/models GET, health/scaling | Acceptable for server-to-server admin tooling                                                              |
| `verifyAdmin`                             | system/models POST                | Correct — admin-level gate                                                                                 |
| `getUserIdFromRequest` (old, header-only) | 0                                 | Fully removed — migration complete                                                                         |

---

## Summary

| Severity | Count | Statuses                                                                                                                    |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 0     | —                                                                                                                           |
| HIGH     | 5     | A1-003 (CONFIRMED-OPEN), A1-004 (CONFIRMED-OPEN), A1-005 (CONFIRMED-OPEN), A1-006 (CONFIRMED-OPEN), A1-007 (CONFIRMED-OPEN) |
| MEDIUM   | 3     | A1-008 (CONFIRMED-OPEN), A1-009 (NEW), A1-011 (NEW)                                                                         |
| LOW      | 5     | A1-010 (CONFIRMED-RESOLVED), A1-012 (NEW), A1-013 (NEW), A1-014 (CONFIRMED-RESOLVED), A1-015 (CONFIRMED-RESOLVED)           |

| Status             | Count                                              |
| ------------------ | -------------------------------------------------- |
| CONFIRMED-RESOLVED | 5 (A1-001, A1-002, A1-010, A1-014, A1-015)         |
| CONFIRMED-OPEN     | 6 (A1-003, A1-004, A1-005, A1-006, A1-007, A1-008) |
| NEW                | 4 (A1-009, A1-011, A1-012, A1-013)                 |
| REGRESSION         | 0                                                  |

**Key outcomes:**

- UNI-475 (admin role on POST /api/system/models) — CONFIRMED RESOLVED via verifyAdmin()
- Auth migration (getUserIdFromRequest → OrCookies) — CONFIRMED COMPLETE (0 remaining instances)
- ROUTE-10, ROUTE-11, CONNECT-01, CONNECT-03 — all CONFIRMED OPEN, no remediation in Phase 120
- 30 routes remain on cookie-only auth (getUserIdFromCookies) — CONFIRMED OPEN
- NEW: Redis demo route is a live unauthenticated write endpoint — requires archival
- NEW: Notification polling has a second mismatch (data.hasNew vs unreadCount) not captured in Phase 119
