---
phase: 55-ui-audit-states
plan: 01
type: issues
created: 2026-03-02
source: UAT sweep — production (synthex.social)
---

# Phase 55-01 UAT Issues

## Summary

13 pages swept on production. Error boundaries functioning correctly on all pages.
3 pre-existing API-level bugs identified (not regressions from 55-01 work).

---

## BUG-01: Competitors page — `r.filter is not a function`

**Page:** `/dashboard/competitors`
**Severity:** High (page content completely unavailable)
**Type:** JS runtime error

**Symptom:**
Page renders error state: "r.filter is not a function"

**Root cause (likely):**
Component calls `.filter()` on the API response directly. When the API returns an error object `{ error: "..." }` instead of an array, `.filter()` throws a TypeError. No array guard before the `.filter()` call.

**Fix approach:**
1. Read `app/dashboard/competitors/page.tsx`
2. Find where `.filter()` is called on API data
3. Add guard: `Array.isArray(data) ? data.filter(...) : []`
4. Or fix the API to always return an array (even empty) instead of error object shape

---

## BUG-02: Personas page — Unauthorized (401)

**Page:** `/dashboard/personas`
**Severity:** High (page content completely unavailable)
**Type:** API auth error

**Symptom:**
Page renders "Unauthorized" error state via DashboardError component.

**Root cause (likely):**
`/api/personas` route is returning 401. Possible causes:
- Route requires a specific role/permission not granted to this user
- JWT extraction failing for this route
- org scoping mismatch (user has no org and route requires one)

**Fix approach:**
1. Read `app/api/personas/route.ts`
2. Check auth guard — what roles/permissions are required?
3. Compare against other working routes (e.g., `/api/campaigns`)
4. Fix auth guard to allow standard authenticated users

---

## BUG-03: Team page — "Failed to load team members"

**Page:** `/dashboard/team`
**Severity:** Medium (team features unavailable)
**Type:** API error

**Symptom:**
Page renders "Failed to load team members" error state.

**Root cause (likely):**
`/api/teams/members` returning an error. Possible causes:
- User has no team/org and the route doesn't handle that gracefully
- Route throws instead of returning empty array when no team exists

**Fix approach:**
1. Read `app/api/teams/members/route.ts`
2. Check if empty org/team case returns 200 `{ members: [] }` or throws
3. Fix to return empty array when user has no team (not an error)

---

## Non-issues (working correctly)

- Error boundaries rendering correctly on all 3 bug pages ✓
- DashboardError component displaying appropriate messages ✓
- All 4 Phase 55-01 state files (loading/error) deployed and active ✓
