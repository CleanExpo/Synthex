# Summary 79-02: MRR from Stripe API

## Status: COMPLETE

## What was done

Replaced the hardcoded `mrr = 0` in the admin platform-stats API with a live MRR calculation sourced from the Stripe Subscriptions API, with a plan-based database estimate as fallback.

### Task 1: Created MRR calculation service
- **File**: `lib/admin/mrr-calculator.ts` (NEW)
- Fetches active subscriptions from Stripe API and sums `unit_amount` values
- Yearly subscriptions divided by 12 for monthly equivalent
- Pagination support for > 100 subscriptions
- Plan-based estimate from DB `Subscription.groupBy` as fallback/comparison
- In-memory cache with 5-minute TTL to avoid Stripe rate limit pressure
- Graceful degradation: if `stripe === null`, falls through to DB estimate only

### Task 2: Updated platform-stats API route
- **File**: `app/api/admin/platform-stats/route.ts` (UPDATED)
- Replaced hardcoded `mrr = 0` with `calculateMRR()` call
- Returns `mrr` (primary value -- Stripe if available, else estimate) plus `mrrDetails` object with breakdown
- `mrrDetails` includes: `stripeMrr`, `estimatedMrr`, `currency`, `stripeActiveCount`, `calculatedAt`

### Task 3: Updated Platform Health UI
- **File**: `components/admin/platform-health.tsx` (UPDATED)
- Added `mrrDetails` to `PlatformStatsApiResponse` type
- Added Monthly Revenue stat card with `DollarSign` icon (emerald)
- Source indicator: "From Stripe (N subs)" or "Estimated from plan prices"
- Grid updated from 4-column to 5-column layout

## Verification
- `npm run type-check` -- PASS (zero errors)
- `npm run lint` -- PASS (zero errors on changed files)

## Files changed
| File | Action |
|------|--------|
| `lib/admin/mrr-calculator.ts` | NEW |
| `app/api/admin/platform-stats/route.ts` | UPDATED |
| `components/admin/platform-health.tsx` | UPDATED |
