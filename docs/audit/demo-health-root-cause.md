# Root Cause Analysis — LiveDemoWidget + UrlHealthCheck

**Date:** 2026-03-26 | **Analyst:** feature-dev:code-explorer

## Summary

Both components call the same API route (`/api/demo/analyze`). The failure has never been inside the component or the route handler. It is caused by the **middleware CSRF origin check** (`middleware.ts:199–210`), which blocks all POST requests where the `Origin` header does not exactly match `CORS_ORIGIN`. The route has no whitelist exemption. A misleading comment in `middleware.ts` causes every developer to believe the middleware does not run on API routes at all — so the true cause is never found during debugging. This is why 22 fixes have not stuck.

---

## API routes involved

- `POST /api/demo/analyze` — `app/api/demo/analyze/route.ts`

---

## Current behaviour (what the user sees when it breaks)

- **Local dev:** clicking "Check my site" or the analyse button spins briefly, then shows "Couldn't reach that URL." Identical to a genuine external network failure.
- **Vercel preview deployments:** same broken state.
- **Production (synthex.social):** works — because `CORS_ORIGIN` is `https://synthex.social` and the browser `Origin` matches.
- **When AI keys absent:** returns 200 with `model: 'sample'` — amber badge "Sample preview · sign up for live AI generation." Looks like a partial failure but is a silent config gap.

---

## Root cause #1 — Middleware CSRF check blocks public demo route in all non-production environments

**File:** `middleware.ts`, lines 199–210

**Symptom:** Any POST to `/api/demo/analyze` from `localhost:3000` or a Vercel preview URL returns HTTP 403 with plain-text body `Forbidden`. Components treat any non-`ok` response as a network error → user sees "Couldn't reach that URL."

**Cause:**

```typescript
// middleware.ts:199–210
const allowedOrigins: string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['https://synthex.social'];
if (!origin || !allowedOrigins.includes(origin)) {
  return new NextResponse('Forbidden', { status: 403 });
}
```

- Local dev sends `Origin: http://localhost:3000` — not in `allowedOrigins` → 403
- Vercel preview URL never matches `https://synthex.social` → 403
- `/api/demo/analyze` is not in `WEBHOOK_PATHS` (the only exemption list at line 197)

**The misleading comment:** `middleware.ts:248–251` states:

> "api routes (rate limited per-route via withRateLimit)"

This implies API routes are excluded from the middleware. They are **not**. The regex at line 253 matches everything except `_next/static`, `_next/image`, `favicon.ico`, and `public/`. The comment is factually wrong and has redirected every debugging session away from the real cause.

**Why it keeps coming back:** Every previous fix addressed symptoms in the component or route handler. The middleware was never examined because the comment says API routes are excluded. The CSRF check was added correctly for authenticated routes and silently broke all public API routes. The symptom perfectly mimics the external-site-unreachable scenario the widget was designed for.

**Breakage conditions:**

- **Local dev — always broken** — `Origin: http://localhost:3000` never matches production
- **Preview deployments — always broken** — preview URL never matches `CORS_ORIGIN`
- **Production — works** — only environment where `Origin` matches `CORS_ORIGIN`

---

## Root cause #2 — Both components discard the HTTP status code

**Files:** `LiveDemoWidget.tsx:260–267`, `UrlHealthCheck.tsx:344–350`

**Symptom:** A 403 (CSRF block), 429 (rate limit), 400 (bad URL), and a genuine network error all display the same message: "Couldn't reach that URL."

**Cause:**

```typescript
// LiveDemoWidget.tsx:260–267
if (!res.ok) throw new Error('failed');
...
} catch {
  setState('error');
}
```

The `catch` block receives no HTTP status. The 403 body is plain text `Forbidden` (not JSON), so the response cannot be parsed. The state transitions to `'error'` with no diagnostic info. Developers and QA testers assume the error is about the target URL, not the API route itself — so they try a different URL, it still fails, and it gets filed as "intermittent network issue."

---

## Root cause #3 — GEMINI_API_KEY absence is a silent fallback, not a logged error

**Files:** `app/api/demo/analyze/route.ts:332–333`, `.env.example:745`

**Symptom:** On environments where both AI keys are absent, the route returns 200 with `model: 'sample'` and a hardcoded caption. The amber badge looks like a UX feature, not a misconfiguration.

**Cause:** `generateCaption()` tries Gemini → OpenAI → hardcoded fallback with no server-side warning. `.env.example:745` sets `GEMINI_API_KEY=` (empty). Local dev is almost always running in sample mode. Developers never see live AI output locally and cannot verify the production AI path.

---

## Root cause #4 — Rate limiter in-memory store is lost on cold starts

**File:** `lib/rate-limit/rate-limiter.ts:86`

`const memoryStore = new Map()` at module level is recreated on every Vercel cold start / scale-out. Without Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`), rate limits do not persist across function instances. Not a breaking bug, but explains why reducing `maxRequests` in code has no effect on Vercel.

---

## Common thread

> **The middleware CSRF check at `middleware.ts:199–210` has no mechanism to exempt public API routes, and the comment at lines 248–251 actively misleads developers into believing the middleware does not run on `/api/` routes at all.**

Every previous fix addressed symptoms visible in the component or route handler. No fix has ever added `/api/demo` to an exemption list or corrected the matcher comment.

---

## What a permanent fix requires

**1. Introduce a typed public-route registry that the CSRF check consults.**
A `PUBLIC_API_PATHS` constant (array of prefixes/exact paths) that the CSRF block skips — a first-class concept maintained in one place.

**2. Correct the false matcher comment.**
The comment at `middleware.ts:248–251` must accurately describe what the regex matches. As long as it says "api routes excluded" while the code includes them, every future debugger is sent in the wrong direction.

**3. Fix error handling in both components to surface the actual HTTP status.**
Inspect `res.status` and parse the response body before throwing. Show "Access blocked (403)" vs "Rate limited (429)" vs "Bad URL (400)" vs "Network error." This alone would have revealed root cause #1 on the first regression.

**4. Log a server-side warning when AI keys are absent.**
One `console.warn` at route startup when both keys are empty makes the degraded state visible in Vercel function logs.

**5. Add an integration test that POSTs to `/api/demo/analyze` with `Origin: http://localhost:3000`.**
A single test asserting a 200 response would catch every future regression on the first re-break.

---

## Key file locations

| File                                    | Relevant lines                                                   |
| --------------------------------------- | ---------------------------------------------------------------- |
| `components/landing/LiveDemoWidget.tsx` | fetch:254, error handling:260–267                                |
| `components/landing/UrlHealthCheck.tsx` | fetch:337, error handling:344–350                                |
| `app/api/demo/analyze/route.ts`         | AI key reads:332–333, caption fallback chain:177–255             |
| `middleware.ts`                         | CSRF check:199–210, **false comment:248–251**, matcher regex:253 |
| `lib/rate-limit/presets.ts`             | `aiGeneration` preset (20 req/min):114                           |
| `lib/rate-limit/rate-limiter.ts`        | in-memory store:86                                               |
| `.env.example`                          | `GEMINI_API_KEY` blank default:745, `CORS_ORIGIN` default:333    |
