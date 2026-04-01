---
name: browser-debug
description: >-
  Autonomous browser-based debugging of production and development issues.
  Captures console errors, network failures, JS stack traces, auth problems,
  and React hydration mismatches — and maps them to root causes and fixes.
  Use when a feature is broken in the browser but the server logs look clean,
  when a user reports a blank page or error, when auth is behaving unexpectedly,
  or when "it works in tests but not in the browser". Also use for
  "why is X broken?", "debug the dashboard", "check console errors".
metadata:
  author: synthex
  version: '1.0'
  type: action-skill
  triggers:
    - debug browser
    - console errors
    - network failure
    - blank page
    - hydration error
    - auth broken
    - it works in tests but not browser
    - why is X broken
    - something is wrong on the page
    - check the logs
context: fork
---

# Browser Debug Skill

## Purpose

Diagnose browser-side issues autonomously. Map raw console/network signals
to root causes, then propose a targeted fix — without Phill needing to open
DevTools manually.

---

## Diagnostic Protocol

Execute all 6 steps in sequence. Collect evidence at each step before
forming conclusions.

### Step 1 — Navigate & Screenshot

```
mcp__chrome-devtools__navigate_page(url)
mcp__chrome-devtools__take_screenshot()
```

Observe:
- Is the page blank? (white screen, empty `<body>`)
- Is there a full-page error boundary?
- Is there a loading spinner stuck indefinitely?
- Does it look like a 404 or 500 error page?

### Step 2 — Console Analysis

```
mcp__chrome-devtools__list_console_messages()
  OR
mcp__Claude_in_Chrome__read_console_messages()
```

Categorise all messages:

| Severity  | Pattern                          | Root Cause Category              |
| --------- | -------------------------------- | -------------------------------- |
| Error     | `Hydration failed`               | SSR/CSR mismatch                 |
| Error     | `Cannot read properties of null` | Data not loaded, undefined guard |
| Error     | `Failed to fetch`                | Network error / CORS             |
| Error     | `401 Unauthorised`               | Auth not established             |
| Error     | `403 Forbidden`                  | Wrong org / insufficient role    |
| Error     | `Minified React error #`         | Production React error (decode)  |
| Warning   | `Each child in a list needs key` | React key prop missing           |
| Warning   | `Warning: prop`                  | Prop type mismatch               |

**For React minified errors:** decode at https://reactjs.org/docs/error-decoder.html
**Record:** full error message, file reference, and line number if shown.

### Step 3 — Network Analysis

```
mcp__chrome-devtools__list_network_requests()
  OR
mcp__Claude_in_Chrome__read_network_requests()
```

Flag these patterns:

| Pattern                              | Diagnosis                                    |
| ------------------------------------ | -------------------------------------------- |
| API returning 500                    | Server-side error — check Vercel logs        |
| API returning 401                    | Auth cookie missing or expired               |
| API returning 403                    | Org scope mismatch or insufficient role      |
| API returning 404                    | Route doesn't exist or wrong method          |
| Request stuck pending (never resolves)| Network timeout or cold-start serverless    |
| CORS preflight blocked               | Missing `Access-Control-Allow-Origin` header |
| Redirect loop (`/login` → `/dashboard` → `/login`) | Auth state not persisting |

Record: URL, method, status code, response body (for 4xx/5xx).

### Step 4 — Auth State Check

```javascript
// Run via mcp__chrome-devtools__evaluate_script
document.cookie.split(';').filter(c => c.includes('supabase') || c.includes('auth') || c.includes('token'))
```

```javascript
// Check localStorage for auth state
Object.entries(localStorage).filter(([k]) => k.includes('supabase') || k.includes('auth'))
```

**Diagnosis:**
- No auth cookies present → user is not logged in (expected if testing unauthenticated)
- Auth cookie present but 401 responses → token expired or invalid
- Auth cookie present and 403 responses → correct auth but wrong permissions/org

### Step 5 — React/DOM Inspection

```
mcp__chrome-devtools__take_snapshot()
  OR
mcp__chrome-devtools__evaluate_script("document.querySelector('[data-error]')?.textContent")
```

Look for:
- Error boundaries rendered (usually shows "Something went wrong")
- `data-testid` or `data-error` attributes indicating error state
- Empty containers that should have content (data loading failure)
- Duplicate or missing DOM nodes (hydration mismatch symptoms)

### Step 6 — Performance Quick Check (if page is slow)

```
mcp__chrome-devtools__lighthouse_audit(url, categories: ['performance'])
```

Flag if:
- LCP > 4s (poor)
- TBT > 600ms (poor)
- Large JS bundles blocking render

---

## Root Cause Mapping

After collecting evidence, map to the most likely root cause:

### Category A: Server-Side Errors

**Signals:** 500 responses, Vercel function errors
**Action:** Check Vercel logs via `vercel logs` or Supabase MCP logs. The browser
can only confirm the symptom; the fix is server-side.

### Category B: Auth/Session Issues

**Signals:** 401 responses, redirect to `/login`, missing cookies
**Action:**
1. Check Supabase session: is `NEXT_PUBLIC_SUPABASE_URL` correct in env?
2. Is the `auth-token` or `sb-*` cookie being set? (`browser-auth` skill can establish a session)
3. Is middleware redirecting incorrectly? Check `middleware.ts` config.

### Category C: Data Loading Failures

**Signals:** Component renders empty, 200 response but empty data, no console errors
**Action:**
1. Check the API response body — is it returning `{ data: [] }` or `{ data: null }`?
2. Is the component checking for empty state or assuming data always exists?
3. Is the SWR fetcher using `credentials: 'include'`?

### Category D: React Hydration Mismatch

**Signals:** `Hydration failed`, `Text content does not match server-rendered HTML`
**Action:**
1. The server-rendered HTML doesn't match the client render
2. Common causes: `typeof window !== 'undefined'` checks, `Date.now()`, `Math.random()`
3. Fix: wrap browser-only content in `useEffect` or use `suppressHydrationWarning` sparingly

### Category E: Missing Environment Variables

**Signals:** `undefined` in URLs, `Cannot read properties of undefined`, `NEXT_PUBLIC_*` is undefined
**Action:** Check `.env.local` — is the required variable present? Check `.env.example` for the correct name.

### Category F: Build Artefact Issue

**Signals:** Works in dev but not production, stale JS chunks, 404 on `/_next/static/`
**Action:** Hard refresh (Ctrl+Shift+R). If still broken, the Vercel deploy may have failed — check dashboard.

---

## Output Format

```markdown
## Browser Debug Report — [Feature/Page]

**URL debugged:** [url]
**Timestamp:** [HH:MM DD/MM/YYYY]
**Environment:** production | development

### Observations

**Screenshot:** [Description of what the page shows]

**Console errors:**
- [ERROR] [full message] — [file:line if available]
- [WARNING] [message] (non-blocking)

**Network failures:**
- [METHOD] [URL] → [status] — [response body excerpt]

**Auth state:** Cookies present | Missing | Expired

### Root Cause

**Category:** [A/B/C/D/E/F — description]
**Primary cause:** [specific root cause in one sentence]
**Evidence:** [which signals led to this conclusion]

### Proposed Fix

1. [Specific code change or config change]
2. [File path and what to modify]
3. [How to verify the fix worked]

### Confidence

[HIGH / MEDIUM / LOW — and why]
```

---

## When to Escalate

Escalate to Phill if:
- The root cause requires accessing live Supabase data or secrets
- The issue requires a Vercel environment variable change (production)
- The fix requires testing a user-specific auth flow (MFA, OAuth)
- The issue is intermittent and can't be reproduced consistently in the browser
