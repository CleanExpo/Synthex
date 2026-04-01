---
name: browser-auth
description: >-
  Establishes an authenticated browser session on synthex.social or localhost
  so that protected dashboard routes can be verified without human login.
  Handles the Supabase email/password login flow using the SYNTHEX_TEST_EMAIL
  and SYNTHEX_TEST_PASSWORD environment variables. Use before running
  browser-verify or site-smoke-test on authenticated routes (/dashboard/*),
  when asked to "log in", "authenticate", "sign in to test the dashboard",
  or when browser-verify reports "Authentication required".
metadata:
  author: synthex
  version: '1.0'
  type: action-skill
  triggers:
    - log in to browser
    - authenticate
    - sign in
    - browser session
    - auth session
    - test account
    - login for dashboard
    - authentication required
context: fork
---

# Browser Auth Skill

## Purpose

Establish a valid authenticated browser session so that dashboard and
protected routes can be tested autonomously, without Phill manually
entering credentials.

---

## Prerequisites

The following environment variables must be set for autonomous login.
Check `.env.local` or ask Phill:

| Variable              | Purpose                       | Where to get it              |
| --------------------- | ----------------------------- | ---------------------------- |
| `SYNTHEX_TEST_EMAIL`  | Test account email            | Phill creates test account   |
| `SYNTHEX_TEST_PASSWORD` | Test account password       | Phill stores in .env.local   |

If these are not set: **stop and ask Phill to provide the test credentials**.
Never use Phill's personal account credentials.

---

## Login Protocol

### Step 1 — Navigate to Login

```
mcp__Claude_in_Chrome__navigate(url: 'https://synthex.social/login')
  OR
mcp__plugin_playwright_playwright__browser_navigate(url: 'https://synthex.social/login')
```

Wait for page to load fully before proceeding.

### Step 2 — Fill Credentials

```
mcp__Claude_in_Chrome__form_input(selector: 'input[type="email"]', value: SYNTHEX_TEST_EMAIL)
mcp__Claude_in_Chrome__form_input(selector: 'input#password', value: SYNTHEX_TEST_PASSWORD)
  OR
mcp__plugin_playwright_playwright__browser_fill_form({
  'input[type="email"]': SYNTHEX_TEST_EMAIL,
  'input#password': SYNTHEX_TEST_PASSWORD
})
```

**Note:** Target `input#password` specifically — both fields have `type="password"` with no name attribute.

### Step 3 — Submit

```
mcp__Claude_in_Chrome__find(selector: 'button[type="submit"]')
  then click it
  OR
mcp__plugin_playwright_playwright__browser_click(selector: 'button[type="submit"]')
```

### Step 4 — Wait for Redirect

Wait for navigation away from `/login` to `/dashboard` or `/onboarding`.

```
mcp__plugin_playwright_playwright__browser_wait_for(selector: '[data-testid="dashboard"]', timeout: 10000)
  OR check URL has changed away from /login
```

**Expected redirect:** `/dashboard` (existing user) or `/onboarding` (new user)

### Step 5 — Verify Session

```javascript
// Via mcp__chrome-devtools__evaluate_script
document.cookie.split(';').filter(c => c.trim().startsWith('sb-') || c.includes('supabase'))
```

**Success:** At least one `sb-*` Supabase session cookie is present.

---

## Error Handling

| Error                         | Diagnosis                                   | Action                          |
| ----------------------------- | ------------------------------------------- | ------------------------------- |
| Still on `/login` after submit | Wrong credentials or rate limited          | Check toast error message, retry after 60s |
| Redirected to `/onboarding`   | Test account is new — needs onboarding      | Complete onboarding or use a pre-onboarded account |
| `[sonner-toast]` shows error  | Auth failure — read the toast text          | Check credentials, check Supabase status |
| Page blank after submit       | JS error during auth flow                   | Run `browser-debug` skill       |
| Rate limited (429)            | Too many auth attempts                      | Wait 60 seconds and retry once  |

**Note:** Auth errors in Synthex are shown via Sonner toasts (`[data-sonner-toast]`),
not DOM `[role="alert"]` elements.

---

## After Login — Confirm Dashboard Access

After a successful login, immediately confirm the dashboard is accessible:

```
mcp__claude_in_chrome__navigate(url: 'https://synthex.social/dashboard')
```

Check:
- [ ] URL is `/dashboard` or a dashboard sub-route (not `/login`)
- [ ] Sidebar navigation is visible
- [ ] No error boundary

---

## Session Persistence

Once established, the Supabase session cookie persists for the browser
session duration. You can navigate to any `/dashboard/*` route without
re-authenticating.

If a subsequent request returns 401, the session has expired:
- Re-run this skill from Step 1

---

## Output Format

```markdown
## Auth Session Report

**Environment:** production (synthex.social) | development (localhost:3000)
**Test account:** [email — redact the domain portion for security]
**Timestamp:** [HH:MM DD/MM/YYYY]

### Result: ✅ AUTHENTICATED | ❌ FAILED

**Session cookies set:** [list sb-* cookie names, not values]
**Redirect landed:** [final URL]
**Dashboard accessible:** ✅ Yes | ❌ No (reason: [])

### Next step
[Ready to run browser-verify or site-smoke-test on authenticated routes]
  OR
[Error: [description] — action required: [specific fix]]
```

---

## Security Rules

- **Never** log or display password values in any output
- **Never** use Phill's personal credentials — test account only
- **Never** create a new Supabase account (prohibited action)
- Cookie values are sensitive — list cookie names only, never values
- If the test account is a real customer account, stop and ask Phill to create a dedicated test account
