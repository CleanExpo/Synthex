---
phase: 68-stripe-activation
plan: 03
subsystem: payments
tags: [stripe, pricing, vercel, billing, checkout]

requires:
  - phase: 68-01
    provides: Stripe webhook handler, billing emails, checkout route
  - phase: 68-02
    provides: Feature gates, UpgradePrompt, subscriptionService

provides:
  - Public /pricing page (MarketingLayout, 3 plan cards, FAQ, checkout CTA)
  - Stripe products + prices created in test account (Professional AUD $249/mo, Business AUD $399/mo)
  - Webhook endpoint registered at synthex.vercel.app/api/webhooks/stripe
  - All 5 Stripe env vars configured in Vercel (Production + Preview + Development)
  - Production redeployed to synthex.social

affects: [Phase 69 landing page, any Stripe checkout flows]

tech-stack:
  added: []
  patterns: [Stripe CLI for product/price creation, Vercel CLI for env var management]

key-files:
  created:
    - app/pricing/loading.tsx
  modified: []

key-decisions:
  - "Test mode keys used (sk_test_, pk_test_) — upgrade to live keys when ready for real payments"
  - "Stripe CLI re-authenticated via browser OAuth flow (acct_1SzE5KGib5mMf28d = Synthex)"
  - "Vercel CLI used for env var management (no dashboard required)"
  - "Webhook registered in test mode (livemode: false) — matches test keys"
  - "Pricing page already existed with richer implementation than planned (MarketingLayout, CheckoutButton, FAQ schema)"

patterns-established:
  - "Vercel env vars: remove production first, then add per-environment with temp file pipe"

issues-created: []

duration: ~35min
completed: 2026-03-03
---

# Phase 68 Plan 03: Pricing Page + Stripe Activation Summary

**Public pricing page live + Stripe test account fully configured: products, prices, webhook, and all 5 env vars deployed to synthex.social**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-03T10:20:00Z
- **Completed:** 2026-03-03T11:00:00Z
- **Tasks:** 3 (1 auto + 2 checkpoints)
- **Files modified:** 1 created

## Accomplishments

- Verified `app/pricing/page.tsx` already exists with a rich implementation (MarketingLayout, CheckoutButton, FAQ schema, 3 plan cards, CTA section) — better than plan spec
- Created `app/pricing/loading.tsx` loading skeleton
- Re-authenticated Stripe CLI via browser OAuth (acct_1SzE5KGib5mMf28d — Synthex account)
- Created Stripe products: Professional (`prod_U50OoAyEnr7OT7`) and Business (`prod_U50O0ZrTq6hmPH`)
- Created recurring monthly prices: Professional AUD $249 (`price_1T6qNuGib5mMf28dqhxMIsP7`), Business AUD $399 (`price_1T6qO3Gib5mMf28d44AXcz6c`)
- Registered webhook endpoint at `https://synthex.vercel.app/api/webhooks/stripe` with all 6 required events (`whsec_ULes6feFHFXjMqLhT0wfsauKqhJbYZVc`)
- Configured all 5 Stripe env vars in Vercel across Production + Preview + Development
- Triggered production redeployment → `https://synthex.social` live with new env vars

## Task Commits

1. **Task 1: Add pricing loading skeleton** - `c43a2085` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/pricing/loading.tsx` — animate-pulse loading skeleton for /pricing route
- `app/pricing/page.tsx` — pre-existing, verified: public, no auth, 3 plan cards, FAQ, checkout CTA

## Stripe Resources Created

| Resource | ID |
|----------|-----|
| Professional product | `prod_U50OoAyEnr7OT7` |
| Professional price (AUD $249/mo) | `price_1T6qNuGib5mMf28dqhxMIsP7` |
| Business product | `prod_U50O0ZrTq6hmPH` |
| Business price (AUD $399/mo) | `price_1T6qO3Gib5mMf28d44AXcz6c` |
| Webhook endpoint | `we_1T6qO8Gib5mMf28dOiQP3fTX` |

## Vercel Env Vars Set

| Variable | Environments |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Production, Preview, Development |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Production, Preview, Development |
| `STRIPE_WEBHOOK_SECRET` | Production, Preview, Development |
| `STRIPE_PROFESSIONAL_PRICE_ID` | Production, Preview, Development |
| `STRIPE_BUSINESS_PRICE_ID` | Production, Preview, Development |

## Decisions Made

- **Test mode keys chosen**: Using `sk_test_`/`pk_test_` keys for now. Switch to `sk_live_`/`pk_live_` when ready for real payments — requires creating a new webhook endpoint in live mode.
- **Pricing page not rewritten**: The existing `app/pricing/page.tsx` was already a superior implementation (includes MarketingLayout header/footer, CheckoutButton component, FAQ schema markup, CTA section). Only the missing `loading.tsx` was added.
- **Vercel CLI over dashboard**: All env vars managed via `vercel env add/rm` — faster and auditable.

## Deviations from Plan

### Auto-fixed Issues

None.

### Decisions

**1. Pricing page already existed with richer implementation**
- **Found during:** Task 1 (Create public pricing page)
- **Discovery:** `app/pricing/page.tsx` already existed with MarketingLayout, CheckoutButton (which calls `/api/stripe/checkout` directly), FAQ schema JSON-LD, 3 plan cards, and CTA section — significantly beyond the plan's simple spec
- **Action:** Only created the missing `loading.tsx`; left the richer implementation intact
- **Impact:** Better user experience, no scope regression

## Issues Encountered

- Stripe CLI API key had expired → re-authenticated via browser OAuth pairing code
- Browser automation (both Chrome extension and Playwright) not logged into Stripe → used CLI + Vercel CLI entirely
- Vercel env vars required `rm` before `add` (no overwrite flag); `printf` pipe broken on Windows Git Bash → solved with temp files

## Next Phase Readiness

- Phase 68 complete ✅
- Stripe is in **test mode** — verify checkout flow with test card `4242424242424242`
- To go live: replace `sk_test_`/`pk_test_` with `sk_live_`/`pk_live_` keys, register a new live-mode webhook
- Ready for Phase 69: Public Landing Page

---
*Phase: 68-stripe-activation*
*Completed: 2026-03-03*
