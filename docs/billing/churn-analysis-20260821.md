# Synthex: Churn Root Cause Analysis

**Version:** 1.0
**Date:** 21/08/2026
**Analyst:** empire-mac
**Task:** t_6d04fa79 – Synthex churn root-cause analysis & NRR roadmap

---

## TL;DR

Synthex currently reports 100% NRR (no churn events observed). This does NOT mean churn doesn’t exist — it may be invisible because churn events fire to Unite-Group events (`user.churn` webhook) rather than landing in a public dashboard. The churn-logs query for Stripe/Synthex found only 1 historical cancellation in Unite-Group’s Stripe account (not the Synthex SaaS customer base), blocked from live Synthex data because the production Stripe key is encrypted in Vercel and inaccessible autonomously (see “Live data unlock path” below).

**Bottom line:** We do not yet have a statistically significant view of churn by segment, reason, or plan tier. However, the current product footprint (plans, free tier, onboarding, and churn-handling flows) contains several high-signal pain points that we can act on in parallel with live-data collection.

---

## 1. Product Footprint (Current State)

### Plans & Pricing

| Plan             | Base Price                     | Key Limits                                                      | Value                         | Pain Points                                                                                           |
| ---------------- | ------------------------------ | --------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Free**         | $0                             | 2 social, 10 AI posts, 1 persona, 0 SEO audits/pages            | 0                             | Missing core features (SEO audits, deeper analytics) → escalates too quickly to paid.                 |
| **Starter**      | $49/mo                         | 3 social, 50 AI posts, 1 persona, 0 SEO                         | Starter + 50% AI posts        | Low differentiation from Free; minimal perceived value jump.                                          |
| **Introductory** | $99/mo (2 mo) → $249/mo        | 5 social, 100 AI posts, 3 personas, basic SEO                   | Pro features at ~40% discount | “Launch Offer” creates expectations; cliff after 2 months can feel expensive → churn risk in month 3. |
| **Pro**          | $249/mo                        | 5 social, 100 AI posts, 3 personas, 10 SEO audits, 50 SEO pages | Pro features at full price    | Highest conversion tier; pricing lacks flexibility for heavy-users.                                   |
| **Enterprise**   | $249 + $99/additional location | Unlimited social/accounts/posts, API, SLA                       | Max flex + seatless usage     | No usage-based tier below this; high TLV users may feel “forced” to Enterprise.                       |

### Free Tier Gaps

- SEO audit/page feature is entirely absent (0/0 limits).
- Analytics are “Basic analytics dashboard”; deeper insight (conversion, lift, benchmarks) missing.
- No content-library or persona-preview value before commitment.
- Onboarding remains a single-setup wizard (no multi-step progressive value).

### Churn-Tracking & Restoration Flows

| Signal                           | Source                                                                | Current Handling                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Voluntary cancellation**       | `customer.subscription.deleted` → `reason = 'cancellation_requested'` | Downgrade to free, send `user.churn` event to Unite-Group, fire `sendSubscriptionCancelledEmail`.                                                                |
| **Involuntary (payment failed)** | `invoice.payment_failed`                                              | Track dunning (`DunningState` state: `past_due` → `unpaid` after 4 attempts), send payment-failed alert, send dunning-recovery receipt after successful payment. |
| **Paused subscriptions**         | `pause_collection` on subscription                                    | Count as “paused” (proxy for stalled churn); no automated active-retry or win-back email today.                                                                  |
| **Downgrade from paid to free**  | Stripe price change + webhook                                         | Handled implicitly; no retention nudge after downgrade.                                                                                                          |

Observation: `user.churn` events go to Unite-Group (agency) rather than Synthex dashboards. Synthex’s own analytics are not explicitly connected to churn signal for dashboards.

---

## 2. Root Causes

### 2.1 Pricing Inertia & Value Perception

- **Cliff pricing:** Introductory plan drops from $99 → $249 after 2 months without additional value. Customers may not feel the cliff justified, especially if they haven’t fully leveraged advanced features yet.
- **Uniform per-seat pricing:** Starter and Pro have identical social count (5) and AI post limits, but Starter lacks SEO audits. The jump from Free to Starter is modest in dollars but huge in feature gap (no SEO).
- **No usage-based options below Enterprise:** Heavy users who don’t need multi-business locations are pushed to the full Enterprise tier (API access, white-label, custom workflows), inflating overage risk.

### 2.2 Free Tier Frustration

- **Missing SEO:** SEO audits/pages are a strong differentiation feature (Pro/Enterprise). Free users hitting value thresholds on social posts can’t access SEO diagnostics.
- **Onboarding dead-end:** After completing the first social account connection and AI post generation, there’s no next step that highlights remaining value paths (persona learning, advanced analytics, SEO) in a structured way.

### 2.3 Churn Signals Are Invisible

- **No churn dashboard in Synthex:** `user.churn` events leave the system and are not surfaced on internal dashboards.
- **Limited dunning visibility:** Dunning state (`DunningState`) is logged but not exposed to users or support agents in-app (no “Check payment status” page).

### 2.4 Payment Failures & Dunning Uncertainty

- **Past_due → unpaid cliff:** After 4 Stripe retries, the system marks state `unpaid` and notifies users. Users may not understand why they lost access or how to recover.
- **No proactive win-back:** No automatic email sending 24–48 hours before dunning would expire, inviting users to update payment and lock in their benefits.

---

## 3. Root Causes in Action (Customer Scenarios)

### Scenario A: Free user hits SEO value ceiling

1. User signs up free, connects social, generates 10 AI posts.
2. They want to audit their own site or set up SEO pages → bump into Free limits (0 SEO audits/pages).
3. No clear “Next upgrade” path: upgrade banner exists, but context of what SEO audit offers isn’t shown.
4. Without concrete value signal, they may downgrade or churn before committing to Starter/Pro.

### Scenario B: Introductory user faces cliff

1. User upgrades to Introductory at $99, expects ongoing discount.
2. After 2 months, they’re charged $249. If they haven’t yet derived 100% value from Pro features, the sudden jump can feel opaque or unfair.
3. If they simultaneously face a payment failure or feature plateaus, they may cancel before perceiving the upgrade value.

### Scenario C: Heavy user pushed to Enterprise

1. Social media manager for 3+ brands generates >100 posts/month across multiple accounts.
2. Pro limits feel restrictive (5 social, 100 posts); multi-business logic is confusing.
3. No “Usage-based” tier below Enterprise, so they’re forced into a high TLV engagement. If price is perceived as disproportionate to volume, they may consider alternatives.

### Scenario D: Payment failure loses access

1. User’s credit card expires or declines.
2. Stripe retries 4 times → system moves state to `unpaid` and sends payment-failed email.
3. User doesn’t respond, loses access during critical period, and eventually churns rather than re-engaging.

---

## 4. Live Data Unlock Path

**Current blockers:** The live Synthex Stripe key is encrypted in Vercel (`STRIPE_SECRET_KEY` in production environment) and cannot be accessed by an autonomous agent via Vercel REST API or 1Password without interactive login.

**Recommended human action:**

```bash
cd /Users/phill-mac/Synthex
vercel link  # if not already linked
vercel env pull .env.production.local --environment=production
export STRIPE_SECRET_KEY=$(grep '^STRIPE_SECRET_KEY=' .env.production.local | cut -d= -f2-)
cd /Users/phill-mac/Synthex
npx tsx scripts/churn-mix-analysis.ts --days 30 > docs/billing/churn-mix-live.json
```

Once `churn-mix-live.json` is available, enrich this memo with:

- Churn mix: voluntary vs involuntary, paused, total cancellations.
- Top churn reasons via `feedback_top5`.
- Reason breakdown by `cancellation_requested`, `payment_failed`, `payment_disputed`, `null`.
- Ratio and segment-level breakdown by plan (Starter, Introductory, Pro, Enterprise).

**Temporal guidance:** Historically, Stripe’s subscription events API horizon is ~30 days. To go beyond 30 days, query Subscription objects and infer churn from `canceled_at`.

---

## 5. Priority Recommendations (Grounded on Product + Historical Observations)

| Priority | Recommendation                                                                                                                                        | Rationale                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| P1       | Replace “Launch Offer” cliff with gradual pro-rated extension or discount until feature adoption threshold (e.g., 5 audits, 50 SEO pages) is reached. | Reduces perceived bait-and-switch; aligns price with realized value.     |
| P1       | Add SEO auditing as a Freemium-tier benefit (2 audits/month, 1 page/month).                                                                           | Closes major free-tier gap; increases perceived value at low churn risk. |
| P1       | Launch internal churn dashboard surfaced from Unite-Group `user.churn` events and Stripe webhook logs.                                                | Gives team visibility; grounds policy changes on real signal.            |
| P2       | Introduce usage-based enterprise tier below full Enterprise: “Pro+” with usage caps ($1 per 1000 posts, etc.) capped at $500/mo.                      | Reduces overage pressure for heavy but non-C-suite users.                |
| P2       | Add dunning grace (48h email) before state transitions to `unpaid` + retry every 48h.                                                                 | Reduces abrupt payment failure churn.                                    |
| P3       | Implement multi-step free-tier onboarding wizard with progressive value (social → personas → analytics → SEO).                                        | Guides users to feature breadth before upgrade prompt.                   |
| P3       | Add “Payment status” page for users: check card status, retry dunning, download invoices.                                                             | Improves transparency; reduces support tickets.                          |

---

## 6. Open Questions (To Be Closed with Live Data or Human Input)

1. **What is the churn mix (voluntary vs involuntary) over the last 90 days?** Does involuntary churn (payment failures) exceed voluntary? By segment?
2. **What are the top 5 self-reported churn reasons** in Stripe subscription `cancellation_details.reason` or support tickets? Does “pricing” dominate, or are other factors more salient?
3. **At what feature threshold do most free users upgrade?** What features are consistently used just before upgrade?
4. **Are past_due → unpaid churn events rare or frequent?** If frequent, where in the funnel are users losing grip (onboarding, content planning, first analytic insight)?
5. **Do paused subscriptions convert back to active within 30 days, or are they churn proxy?** Understanding “paused as churn” can reframe recovery strategies.

---

## 7. Appendix: Churn-Logs Methodology (Pending Live Data)

When `churn-mix-live.json` is available, it should follow this shape:

```json
{
  "voluntary": N,
  "involuntary": N,
  "paused": N,
  "total_cancellations": N,
  "feedback_top5": [["too_expensive", 42], ["not_enough_features", 38], ...],
  "reason_breakdown": {
    "cancellation_requested": 42,
    "payment_failed": 18,
    "payment_disputed": 5,
    "unpaid": 3
  },
  "ratio": 0.43,
  "recommendation": "upgrade_flow_first | dunning_first | parallel",
  "mode": "live",
  "window_days": 30
}
```

**Classification rules:**

- Voluntary: `reason in ('cancellation_requested', 'customer_requested')` OR `feedback != null`.
- Involuntary: `reason in ('payment_failed', 'payment_disputed', 'unpaid')` OR (`reason IS NULL` AND `feedback IS NULL`).
- Paused: `pause_collection != null` on subscription updated events.

These rules will inform targeted experiments (upgrade flow vs dunning improvements).

---

**Next action:** Use this memo to define three NRR experiments (30-day roadmap) and founder review.
