# Stripe Dashboard — Dunning / Revenue Recovery Configuration

**Date:** 2026-05-16
**Phase:** Synthex Phase 3 — Customer Self-Service
**Mandate:** `493b042a-521c-44af-9cb2-43505593b65c`
**PR:** 4 of 4 (no-code, documentation-only)

## Why this exists

PR 3 (`feat/synthex-phase3-pr3-dunning-state`) ships the in-app `DunningState`
model + global `BillingStatusBanner`. The banner reads `past_due` / `unpaid`
state created by Stripe's automatic retries — but **those retries only happen
if Revenue Recovery is configured in the Stripe Dashboard**.

Stripe does not enable Smart Retries by default for new subscriptions. Without
this config, a failed first charge will:

1. Fire `invoice.payment_failed` once.
2. **Not retry.**
3. Cancel the subscription per the default `unpaid` collection setting.
4. Trigger `customer.subscription.deleted` — the user is on free tier within
   minutes of a transient card decline.

This is the Phase 1 churn pattern surfaced in
`~/Synthex-phase1/docs/billing/churn-mix-2026-05-16.md` (analysis BLOCKED on
the sensitive `STRIPE_SECRET_KEY` Vercel env, but the failure mode is
documented in Stripe's own knowledge base).

The fix is dashboard-only — it cannot be executed via the API for the
account-wide subscription settings. This doc is the runbook for Phill to
action.

## Required dashboard changes

### 1. Smart Retries — recovery cadence

**Path:** `Settings → Subscriptions and emails → Manage failed payments → Smart Retries`

**Action:**

- Toggle **Smart Retries: ON**
- Retry duration: **14 days** (Stripe default 1 month is too long for monthly
  SaaS — pushes the dunning row's `nextRetryAt` past the next billing cycle)
- Maximum retries: **3**
- After final retry, choose: **Cancel the subscription**

**Why 3 retries / 14 days:**

- Stripe's published Smart Retries data shows ~28% recovery on attempts 1-3,
  diminishing returns after that
- Aligns with the `DunningState.state` transition: `past_due` (attempts < 4)
  → `unpaid` (>= 4) → `cancelled`
- Matches the banner copy: "We will automatically retry over the next 14 days"

### 2. Failed payment emails

**Path:** `Settings → Subscriptions and emails → Manage failed payments → Customer emails`

**Action:**

- Toggle **Send emails to customers about failed payments: OFF**

**Why OFF:** Synthex sends its own `sendPaymentFailedEmail()` from
`lib/email/billing-emails.ts` via the `invoice.payment_failed` webhook. Two
emails per failed payment looks like a double-charge to the customer and
inflates support tickets.

### 3. Subscription status on dunning exhaustion

**Path:** `Settings → Subscriptions and emails → Manage failed payments → Final action`

**Action:**

- After the final retry fails, set subscription to: **Cancel**
- (Alternative: `Mark uncollectible` — DO NOT use; leaves the subscription
  active with non-paying status, polluting the active-MRR metric.)

### 4. Payment method auto-update

**Path:** `Settings → Payment methods → Card automatic updates`

**Action:**

- Toggle **Card account updater: ON** (Visa, Mastercard, Amex all supported)

**Why:** Recovers ~12% of card-on-file failures caused by expired or replaced
cards without any user action. Free with Stripe.

## Verification after configuration

After Phill enables the settings above, verify with a test card:

```bash
# Stripe test mode — card that fails on first charge then succeeds on retry
stripe customers create --email "test+dunning@unite-group.in"
# Use card token "tok_chargeCustomerFail" to force initial failure
# Wait for next retry attempt
# Confirm DunningState row goes past_due → recovered after retry succeeds
```

Expected DunningState lifecycle:

| Time | Stripe event                | DunningState.state | Banner shown        |
|------|-----------------------------|-------------------|---------------------|
| T+0  | `invoice.payment_failed` #1 | `past_due`        | "Payment failed"    |
| T+3d | `invoice.payment_failed` #2 | `past_due`        | "Payment failed"    |
| T+7d | `invoice.payment_failed` #3 | `past_due`        | "Payment failed"    |
| T+14d | Stripe gives up            | `unpaid`          | "Subscription unpaid" |
| T+14d | `subscription.deleted`     | `cancelled`       | (cancelled banner)  |

If the card recovers at any retry:

| Time | Stripe event                 | DunningState.state | Banner shown |
|------|------------------------------|-------------------|--------------|
| T+3d | `invoice.payment_succeeded`  | `recovered`       | (hidden)     |

## Screenshots needed

Phill — please capture the four dashboard screens above after enabling and
drop into `docs/billing/screenshots/stripe-dunning-2026-05-16/`:

- `01-smart-retries.png`
- `02-failed-payment-emails.png`
- `03-final-action.png`
- `04-card-account-updater.png`

Once captured, file the PR to update this doc with embedded image refs.

## Why this can't be automated (yet)

Stripe does not expose subscription-level Smart Retries config via the API
([Stripe docs](https://stripe.com/docs/billing/revenue-recovery/smart-retries)).
The retry policy lives at the account level in dashboard settings. The
relevant SDK paths return read-only values:

- `stripe.subscriptionSchedules.list()` — schedule of phases, not retry policy
- `stripe.invoices.update({ collection_method })` — invoice-level only, not
  subscription-level policy

A future automation path could use Stripe's CLI-based config export +
re-import (`stripe config push`), but that operates on Connect platform
settings, not direct account settings. Out of scope.

## Owner

**Phill McGurk** — owns the Stripe account, has dashboard access via
`contact@unite-group.in` (per `feedback_authorization_scope.md`).

After enabling, ping #margot-ops on Telegram so the swarm logs the activation
date for the dunning recovery KPI.

## Linked work

- **PR 3** — `feat/synthex-phase3-pr3-dunning-state` — the `DunningState`
  model + `BillingStatusBanner` that this config feeds
- **Phase 1 churn analysis** — `~/Synthex-phase1/docs/billing/churn-mix-2026-05-16.md`
  (BLOCKED on Vercel env)
- **Webhook handlers** — `lib/stripe/webhook-handlers.ts` (lines 358-450)
  — already handles `payment_failed` + `payment_succeeded` correctly

## Status

**Not yet actioned.** This PR ships the runbook; activation is on Phill.
