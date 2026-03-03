---
phase: 68-stripe-activation
plan: 01
subsystem: payments
tags: [stripe, resend, email, billing, react, progress-bar]

# Dependency graph
requires:
  - phase: 67-fetch-standardisation
    provides: SWR/fetch patterns used across dashboard components
provides:
  - Billing lifecycle emails (receipt, payment-failed, subscription-cancelled)
  - Free-plan billing dashboard display fix
  - Unlimited progress bar fix
affects: [69-feature-gates, subscription-service, webhook-handlers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget email via Resend SDK lazy singleton"
    - "Lazy module-level singleton to avoid throw on missing API key at import time"

key-files:
  created:
    - lib/email/billing-emails.ts
  modified:
    - lib/stripe/webhook-handlers.ts
    - app/dashboard/billing/page.tsx
    - tests/unit/services/webhook-handlers.test.ts
    - tests/unit/lib/stripe/webhook-handlers.test.ts

key-decisions:
  - "Static /dashboard/billing URL for billing portal link — avoids async Stripe API call in webhook path"
  - "Lazy Resend singleton — defers new Resend() until first send call so tests can import the module without a RESEND_API_KEY"
  - "limit <= 0 (not just === -1) for unlimited check — covers both explicit -1 and uninitialised 0 from DB"
  - "HTTP 404 from subscription API treated as free plan — not an error state"

patterns-established:
  - "Fire-and-forget email pattern: synchronous function, .catch() error handler, never await in webhook path"
  - "Lazy singleton for optional services: create on first use, not at module load"

issues-created: []

# Metrics
duration: 35min
completed: 2026-03-03
---

# Phase 68 Plan 01: Billing Emails + Dashboard Fixes Summary

**Resend billing lifecycle emails wired into Stripe webhook handlers with fire-and-forget pattern; billing dashboard fixed for free-plan display and unlimited progress bars**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-03T00:00:00Z
- **Completed:** 2026-03-03T00:35:00Z
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments

- Created `lib/email/billing-emails.ts` with three Resend-powered email functions (receipt, payment-failed, cancellation) using fire-and-forget pattern
- Wired all three email functions into `lib/stripe/webhook-handlers.ts` at the three TODO(UNI-475) sites; user email resolved via `prisma.user.findUnique`
- Fixed UNI-633: HTTP 404 from `/api/user/subscription` now correctly renders the free-plan UI rather than an error card
- Fixed UNI-634: `limit <= 0` (covers DB value 0 and explicit -1) now renders "Unlimited" text label instead of a NaN progress bar

## Task Commits

1. **Task 1: Wire Resend billing email notifications** — `52323e35` (feat)
2. **Task 2: Fix billing dashboard display bugs (UNI-633, UNI-634)** — `bcae3cf4` (feat)
3. **Task 3: Verify and commit** — `542c7c70` (feat — includes lazy Resend fix + test mocks)

**Plan metadata:** (to be committed next) `docs(68-01): complete billing-emails-dashboard-fixes plan`

## Files Created/Modified

- `lib/email/billing-emails.ts` — 3 fire-and-forget billing lifecycle email functions using Resend SDK lazy singleton
- `lib/stripe/webhook-handlers.ts` — prisma import added; email calls wired into handlePaymentSucceeded, handlePaymentFailed, handleSubscriptionCancelled
- `app/dashboard/billing/page.tsx` — UNI-633: 404 response treated as free plan; UNI-634: unlimited check changed to `!limit || limit <= 0`, progress bar replaced with "Unlimited" text
- `tests/unit/services/webhook-handlers.test.ts` — added prisma and billing-emails mocks
- `tests/unit/lib/stripe/webhook-handlers.test.ts` — added prisma and billing-emails mocks; fixed stale assertion (5 → 6 handlers)

## Decisions Made

- **Static billing portal URL:** `/dashboard/billing` used instead of calling `stripe.billingPortal.sessions.create()` — avoids an async Stripe API call in the webhook path which must respond in <3 seconds
- **Lazy Resend singleton:** `new Resend(key)` deferred to first call via `getResend()` so the module can be imported in test environments where `RESEND_API_KEY` is absent without throwing
- **`limit <= 0` for unlimited:** The billing page was checking `limit === -1` but DB records with `maxSocialAccounts = 0` also represent unlimited. Changed to `!limit || limit <= 0` to cover both cases
- **Australian English copy:** All email subject lines and body copy use Australian English (e.g. "authorisation", "recognised", "cancelled")
- **`current_period_end` location:** In Stripe API version `2025-07-30.basil`, `current_period_end` lives on `subscription.items.data[0]` not on the subscription root object

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] Resend constructor throws at import time without API key**
- **Found during:** Task 3 (npm test)
- **Issue:** `new Resend(undefined)` throws `Missing API key` — this causes the webhook-handlers module to fail to load in test environments
- **Fix:** Wrapped `new Resend()` in a `getResend()` lazy singleton function so instantiation is deferred to first `.emails.send()` call
- **Files modified:** `lib/email/billing-emails.ts`
- **Verification:** `npm test` passes with webhook handler tests importing the module without API key
- **Committed in:** `542c7c70`

**2. [Blocking] `current_period_end` type error in newer Stripe API**
- **Found during:** Task 1 (npm run type-check)
- **Issue:** `subscription.current_period_end` does not exist on `Stripe.Subscription` in API version `2025-07-30.basil` — it moved to `subscription.items.data[0].current_period_end`
- **Fix:** Changed to `subscription.items.data[0]?.current_period_end`
- **Files modified:** `lib/stripe/webhook-handlers.ts`
- **Verification:** `npm run type-check` passes with 0 errors
- **Committed in:** `52323e35`

**3. [Stale test] webhook-handlers.test.ts expected 5 handlers, 6 registered**
- **Found during:** Task 3 (npm test)
- **Issue:** Pre-existing stale assertion — `billing.checkout_completed` was registered but not counted
- **Fix:** Updated count from 5 to 6 and added the missing `billing.checkout_completed` assertion
- **Files modified:** `tests/unit/lib/stripe/webhook-handlers.test.ts`
- **Verification:** All 32 tests in that file now pass (up from 0)
- **Committed in:** `542c7c70`

### Deferred Enhancements

None identified.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 stale test), 0 deferred
**Impact on plan:** All fixes necessary for compilation and test correctness. No scope creep.

## Issues Encountered

- Two test files (`tests/unit/services/webhook-handlers.test.ts` and `tests/unit/lib/stripe/webhook-handlers.test.ts`) lacked mocks for `@/lib/prisma` and `@/lib/email/billing-emails`. The second file was already 0/32 passing before this plan. Both fixed by adding appropriate `jest.mock()` calls.
- Tests went from 1493 passing (pre-plan) to 1507 passing (post-plan). Remaining 21 failures are pre-existing (BullMQ transform, SubscriptionService prisma mock, Stripe mock).

## Next Phase Readiness

- Billing lifecycle emails are wired and fire-and-forget — ready for production use once `RESEND_API_KEY` and `EMAIL_FROM` env vars are set in Vercel dashboard
- Billing dashboard correctly handles free-plan state and unlimited limits
- Ready for 68-02-PLAN.md — Subscription Feature Gate Enforcement

---
*Phase: 68-stripe-activation*
*Completed: 2026-03-03*
