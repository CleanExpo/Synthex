# Synthex Testing Reference

Last updated: 2026-04-01

---

## Pre-PR Gate (mandatory — run all three)

```bash
npm run type-check && npm run lint && npm test
```

All three must pass with **zero errors** before any PR is created or code is considered done.
Warnings in lint are acceptable; errors are not.

---

## Test Suite Location & Structure

```
tests/
├── unit/
│   ├── api/          # Route handler unit tests (Jest)
│   └── lib/          # Service/utility unit tests (Jest)
├── e2e/              # Playwright end-to-end tests
└── helpers/
    ├── mock-request.ts   # createMockNextRequest() helper
    └── mock-prisma.ts    # Prisma mock factory
```

---

## Unit Test Pattern (API Routes)

Follow the established pattern from `tests/unit/api/generate-advisor-brief.test.ts`:

```typescript
import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { POST } from '@/app/api/your-route/route';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { yourModel: { findFirst: jest.fn(), create: jest.fn() } },
  prisma: { yourModel: { findFirst: jest.fn(), create: jest.fn() } },
}));

describe('POST /api/your-route', () => {
  // Test order: 401 → 403 → 400 → 200 happy path (ALWAYS this order)

  it('returns 401 when unauthenticated', async () => {
    // Mock auth to return null
    const req = createMockNextRequest({ method: 'POST', body: {} });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when wrong org', async () => {
    // Mock auth to return user from different org
    const req = createMockNextRequest({ method: 'POST', body: { orgId: 'other-org' } });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 on invalid body', async () => {
    const req = createMockNextRequest({ method: 'POST', body: { invalid: true } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200/201 on valid request', async () => {
    (prisma.yourModel.create as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const req = createMockNextRequest({ method: 'POST', body: { /* valid data */ } });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
```

**Never mock the database in integration tests.**
**Never skip the 401 (unauthenticated) or 403 (wrong org) test cases.**

---

## Prisma Mock Factory

```typescript
// The factory exports BOTH default and named export to satisfy all import styles
jest.mock('@/lib/prisma', () => {
  const instance = {
    someModel: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { __esModule: true, default: instance, prisma: instance };
});
```

---

## Verification Non-Negotiables (CEO Directive — 2026-03-26)

These rules were added after repeated incidents where agents declared work "done" when nothing had changed.

### Demo Endpoint — Production

```bash
curl -s -X POST https://synthex.social/api/demo/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://google.com.au"}'
```

Response **MUST** contain `"businessName"` and `"caption"` keys.
If response contains `"error"`, the fix is **NOT complete**.

### Demo Endpoint — Localhost

```bash
curl -s -X POST http://localhost:3000/api/demo/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://google.com.au"}'
```

### Non-Negotiable Rules

- No curl output in response = no "done" claim. Paste the actual output.
- If curl returns `{"error":...}` or HTTP 500/503, the work is NOT complete.
- Do not declare a deployment complete until Vercel dashboard shows "Ready".
- Do not declare tests passing without pasting the actual Jest output line:
  `Tests: X passed, Y total`
- NEVER use: "should work" · "probably passes" · "seems correct" · "likely fixed"

---

## E2E Testing (Playwright)

```bash
npm run e2e                                          # Run all E2E tests
PW_SKIP_WEBSERVER=1 BASE_URL=http://localhost:3002 npm run e2e  # Against existing server
```

**Config notes:**
- Playwright runs on port 3002 (3001 occupied by Grafana)
- `retries: 1` for non-CI mode (auth rate limiter causes cross-file flakiness)
- `workers: 2` (server can't handle high parallelism)
- `timeout: 60s` (cold dev server is slow)

**Known patterns:**
- Auth errors: target `[data-sonner-toast]` (not `[role="alert"]`)
- Login: target `input#password` specifically (both fields have `type="password"`)
- Soft nav: use `waitForURL()` not `waitForLoadState()` after `router.push()`
- Sidebar: use `'aside'` not `'nav, aside'` (mobile nav also matches)
- `/api/health` returns 503 when external services not connected — tests accept 503

---

## Verification Checklist Format

Before declaring any task done, produce:

```
VERIFICATION CHECKLIST — [Feature/Task Name]

[ ] Go to: [URL or location]
[ ] [Navigation step]
[ ] You should see: [observable result]
[ ] You should NOT see: [what should be absent]

Reply "looks good" to close, or describe what's different.
```

**Exceptions** (no checklist needed): documentation-only changes, config-only changes,
test-only changes (no production code modified), git operations.

---

## Test Coverage Targets

- All new API routes: unit tests for 401, 403, 400, 200 cases
- New lib/ services: unit tests for happy path + error cases
- New UI components: Playwright smoke test if user-visible
- Cron routes: verify `CRON_SECRET` header check is tested
