---
name: site-smoke-test
description: >-
  Runs a structured autonomous smoke test of synthex.social (or localhost:3000)
  covering all critical paths: landing page, auth, dashboard, API health, and
  key features. Produces a pass/fail matrix across 8 critical paths.
  Use before merging a PR, after a production deploy, when checking if the site
  is healthy, or when asked "is the site working?", "run a health check",
  "smoke test the app", "check synthex.social". Also use as part of Phase 6
  E2E verification in the autonomous deployment pipeline.
metadata:
  author: synthex
  version: '1.0'
  type: action-skill
  triggers:
    - smoke test
    - health check
    - site working
    - is synthex.social up
    - run a health check
    - check the app
    - e2e check
    - post-deploy verification
    - phase 6
context: fork
---

# Site Smoke Test Skill

## Purpose

Run a structured 8-path smoke test of the Synthex application to confirm
the site is healthy and all critical user journeys are accessible.

Used as the autonomous substitute for manual E2E verification.

---

## Environment Selection

| Trigger                   | Base URL                      |
| ------------------------- | ----------------------------- |
| "production" or no context| `https://synthex.social`      |
| "dev" or "localhost"       | `http://localhost:3000`       |
| PR verification            | Vercel preview URL (from `gh pr view`) |

---

## 8 Critical Paths

Execute each path in order. For each: navigate, screenshot, check console, record result.

### Path 1 — Landing Page

```
Navigate: {BASE_URL}/
```

**Check:**
- [ ] Page loads (not blank, not 500)
- [ ] Primary headline visible
- [ ] Call-to-action button(s) present
- [ ] No console errors

**Expected status:** 200

---

### Path 2 — API Health Endpoint

```
Navigate: {BASE_URL}/api/health
  OR: fetch('https://synthex.social/api/health')
```

**Check:**
- [ ] Returns JSON (not HTML error page)
- [ ] `status` field present in response
- [ ] HTTP 200 (or 503 if external services unavailable — acceptable)
- [ ] Response time < 5s

**Note:** 503 with `{ status: 'unhealthy' }` is acceptable — means external services
not connected but the function itself is running.

---

### Path 3 — Login Page

```
Navigate: {BASE_URL}/login
```

**Check:**
- [ ] Login form visible (email + password fields)
- [ ] Supabase auth form rendered
- [ ] No console errors
- [ ] Not redirected to unexpected page

---

### Path 4 — Demo API Endpoint (CEO directive)

```javascript
// Run via mcp__chrome-devtools__evaluate_script
fetch('https://synthex.social/api/demo/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://google.com.au' })
}).then(r => r.json()).then(d => console.log('DEMO_RESULT:', JSON.stringify(d)))
```

**Check:**
- [ ] Response contains `businessName` key
- [ ] Response contains `caption` key
- [ ] No `error` key in response
- [ ] Response time < 15s (AI generation is slow)

**CEO Directive:** This is the mandatory curl check. If `error` key present → FAIL.

---

### Path 5 — Dashboard (Authenticated)

Requires auth session. Use `browser-auth` skill first if not authenticated.

```
Navigate: {BASE_URL}/dashboard
```

**Check:**
- [ ] Dashboard loads (not redirected to /login — if so, auth not established)
- [ ] Sidebar visible with navigation items
- [ ] No full-page error boundary
- [ ] No console errors

**If redirected to /login:** Record as conditional PASS (unauthenticated state expected).
Run `browser-auth` skill then re-test to confirm authenticated state works.

---

### Path 6 — Advisor Page (New Feature — SYN-595)

```
Navigate: {BASE_URL}/dashboard/advisor
```

**Check:**
- [ ] Page loads (not 404, not blank)
- [ ] "Advisor" or advisor-related heading visible
- [ ] Cold-start state renders correctly (if no brief exists yet)
- [ ] No console errors

---

### Path 7 — Authority Hub / Client Page (New Feature — SYN-593)

```
Navigate: {BASE_URL}/clients
  OR: {BASE_URL}/clients/{any-test-slug}
```

**Check:**
- [ ] Route exists (not 404)
- [ ] If client exists: organisation name visible, JSON-LD schema in page source
- [ ] If client doesn't exist: 404 page renders gracefully
- [ ] No console errors

**Check JSON-LD:**
```javascript
// Via DevTools evaluate_script
document.querySelectorAll('script[type="application/ld+json"]').length
```
Expected: ≥ 1 script tag on a real client page.

---

### Path 8 — Sidebar Navigation (SYN-595 Integration Gap Fix)

Requires auth. Navigate to dashboard and confirm:

```javascript
// Via DevTools evaluate_script
document.querySelector('[href="/dashboard/advisor"]')?.textContent
```

**Check:**
- [ ] "Advisor" link present in sidebar
- [ ] Link href is `/dashboard/advisor`
- [ ] TeamInviteBanner element exists in layout (may be hidden by eligibility)

```javascript
// Check TeamInviteBanner is in DOM (may be display:none if not eligible)
!!document.querySelector('[data-testid="team-invite-banner"], [class*="TeamInviteBanner"], [class*="team-invite"]')
```

---

## Output Format

```markdown
## Smoke Test Report — synthex.social

**Run timestamp:** [HH:MM DD/MM/YYYY AEST]
**Environment:** production (synthex.social) | development | preview
**Auth state:** Authenticated | Unauthenticated

| Path | Check | Result | Notes |
|------|-------|--------|-------|
| 1. Landing page | Page loads, CTA visible | ✅ PASS / ❌ FAIL | |
| 2. API health | /api/health returns JSON | ✅ PASS / ❌ FAIL | |
| 3. Login page | Form renders | ✅ PASS / ❌ FAIL | |
| 4. Demo API | businessName + caption in response | ✅ PASS / ❌ FAIL | |
| 5. Dashboard | Loads, sidebar visible | ✅ PASS / ❌ FAIL | |
| 6. Advisor page | Loads, cold-start state OK | ✅ PASS / ❌ FAIL | |
| 7. Authority Hub | Route exists, no 500 | ✅ PASS / ❌ FAIL | |
| 8. Sidebar nav | Advisor link present | ✅ PASS / ❌ FAIL | |

### Overall: [X/8 PASS]

### Failures (if any)
- Path [N]: [exact error, element missing, or unexpected response]
- Suggested fix: [specific action]

### Console errors observed
- [list or "None"]

### Recommendation
- SHIP: All 8 paths pass (or 7/8 with known pre-existing issue)
- HOLD: 1+ critical path failing (paths 2, 4, 5 are critical)
- INVESTIGATE: Unexpected failures requiring further `browser-debug` skill run
```

---

## Criticality Tiers

| Tier     | Paths            | On failure           |
| -------- | ---------------- | -------------------- |
| CRITICAL | 1, 2, 4, 5       | Block deploy/merge   |
| HIGH     | 3, 6, 7          | Investigate before merge |
| MEDIUM   | 8                | Note but don't block |

A smoke test with all CRITICAL paths passing is considered sufficient for
production deploy. HIGH and MEDIUM failures should be tracked as Linear issues.
