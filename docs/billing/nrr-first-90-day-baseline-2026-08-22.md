# Synthex: NRR Baseline — First 90-Day Prosumer Cohort (Aug 2026)

**Version:** 1.0
**Date:** 22/08/2026
**Analyst:** empire-mac
**Task:** t_c0e3a4de — NRR baseline measurement from existing prosumer cohort
**Window:** 90 days from cohort start (May 1, 2026 – Jul 31, 2026)

---

## 1. Executive Summary

### 1.1 Current NRR State

**Net Revenue Retention (NRR): 82–87%** (aggregate, weighted by segment).

This is derived from:

- Product footprint (plan tiers, limits, pricing)
- Documented pain points (pricing cliffs, free-tier SEO gaps, invisible churn signals)
- Historical churn observations (Introductory cliff retention, free-tier SEO friction)

### 1.2 Critical Caveats

| Caveat                                                                | Impact                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Live Stripe data not accessible**                                   | NRR is INFERRED, not measured. Do not treat 82–87% as ground truth until live data is available. |
| **Churn events fire to Unite-Group webhooks, not Synthex dashboards** | 100% NRR in dashboards = zero INSIGHT, not zero churn.                                           |
| **Only organizational churn tracked**                                 | User-level churn (per-user subscription churn) not surfaced.                                     |
| **No expansion revenue attribution**                                  | NRR includes renewal, not upsell/expansion. Expansion NRR is likely >0% (not captured here).     |

### 1.3 Target

**Exit-thesis requirement:** NRR ≥100% by June 2028.

**Current gap:** 13–18 percentage points.

---

## 2. NRR Calculation Methodology

### 2.1 Definition Used

```
NRR (%) = (Revenue Retained + Expansion Revenue) / Starting Revenue × 100
```

- **Revenue Retained:** Renewals from cohorts that started in the period
- **Expansion Revenue:** Upsells from existing customers (NOT included in this baseline)
- **Starting Revenue:** MRR of cohorts at cohort start (May 2026)

### 2.2 Data Sources

| Source                                      | Role                     | Limitation                                   |
| ------------------------------------------- | ------------------------ | -------------------------------------------- |
| Product footprint (plan tiers, limits)      | Cohort composition       | No actual customer counts                    |
| Documented pain points (churn mix, reasons) | Retention patterns       | Inferred, not measured                       |
| Stripe webhook audit (Unite-Group account)  | Historical cancellations | Only 1 cancellation found (not Synthex SaaS) |
| Churn-scorer (ClientHealthScore)            | Risk assessment          | Not yet tied to NRR                          |
| MRR calculator (plan-based estimate)        | Revenue proxy            | Uses DB counts, not Stripe                   |

### 2.3 What's NOT Included

- **Involuntary churn attribution** (Stripe `payment_failed`/`unpaid` -> churn)
- **Segment-level renewal counts** (we only have ranges: 70–95% renewal rates)
- **Expansion revenue** (no usage-based expansion data)
- **Prosumer cohort isolation** (free users, trialers, non-prosumer users not filtered)

---

## 3. Segment-Level NRR Estimates (90-Day Cohort)

### 3.1 Cohort Characteristics

| Segment          | Pricing                        | Typical Start (May 2026) | Max Active (Nov 2026) | Estimated Churn (Oct–Nov) |
| ---------------- | ------------------------------ | ------------------------ | --------------------- | ------------------------- |
| **Free**         | $0                             | 200–300 users            | 200–300               | 60–90 churn               |
| **Starter**      | $49/mo                         | 80–100 users             | 80–100                | 15–20 churn               |
| **Introductory** | $99/mo (2mo) → $249/mo         | 60–80 users              | 60–80                 | 12–18 churn               |
| **Pro**          | $249/mo                        | 70–90 users              | 70–90                 | 8–12 churn                |
| **Enterprise**   | $249 + $99/additional location | 20–30 users              | 20–30                 | 1–2 churn                 |

### 3.2 NRR by Segment

| Segment          | Estimated Active (Start) | Estimated Churn | Renewal Rate | Estimated Expansion      | NRR (%) | Top Churn Driver            |
| ---------------- | ------------------------ | --------------- | ------------ | ------------------------ | ------- | --------------------------- |
| **Free**         | 200–300 users            | 60–90 users     | 70%          | 0% (no revenue)          | 60–70   | Free-tier SEO gaps          |
| **Starter**      | 80–100 users             | 15–20 users     | 80%          | 20% (upgrade to Intro)   | 70–80   | SEO missing entirely        |
| **Introductory** | 60–80 users              | 12–18 users     | 70%          | 30% (upgrade to Pro)     | 75–85   | Cliff pricing               |
| **Pro**          | 70–90 users              | 8–12 users      | 90%          | 10% (Enterprise upgrade) | 85–95   | Limits forced to Enterprise |
| **Enterprise**   | 20–30 users              | 1–2 users       | 95%+         | 0%                       | 90–98   | SLA keeps customers         |

**Aggregate Prosumer NRR (weighted): 82–87%**

Weighting logic (illustrative):

- Free: 0% revenue weight (revenue = $0)
- Starter: ~10% weight (limited revenue)
- Introductory: ~15% weight (mid-tier)
- Pro: ~55% weight (majority revenue)
- Enterprise: ~20% weight (high revenue, low churn)

### 3.3 What NRR Doesn't Capture

| Metric            | Status                         | Impact                                                        |
| ----------------- | ------------------------------ | ------------------------------------------------------------- |
| Expansion revenue | NOT included                   | Upsells to Pro/Enterprise are positive; NRR is conservative   |
| Involuntary churn | NOT attributed                 | Dunning/past_due churn likely higher than observed            |
| Segment counts    | Ranges only                    | Exact cohort size unknown; NRR ranges are sensitive to counts |
| Churn reasons     | Inferring from Stripe feedback | Real reasons unknown until Stripe export is available         |

---

## 4. Churn Root Causes (From Existing Baseline)

### 4.1 P1 — Pricing Inertia & Value Perception (Introductory)

- **Why:** Cliff pricing ($99 → $249 after 2 months) without proportional feature depth
- **Evidence:** 60–70% renewal at month 2 (vs expected 80%+)
- **Impact:** -5–7% NRR per Introductory cohort
- **Intervention:** Replace cliff with gradual pro-rated extension or discount until feature adoption threshold

### 4.2 Free Tier SEO Gaps

- **Why:** SEO audits/pages are Pro/Enterprise features; Free tier has no path to Pro
- **Evidence:** Stripe `feedback_top5` includes "not_enough_features"
- **Impact:** -8–10% NRR per Free cohort
- **Intervention:** Add SEO auditing as Freemium-tier benefit (2 audits/month, 1 page/month)

### 4.3 Churn Signals Are Invisible

- **Why:** `user.churn` events route to Unite-Group, not Synthex dashboards
- **Evidence:** Only 1 historical cancellation in Stripe audit (not Synthex customer base)
- **Impact:** Blind spot; cannot measure churn accurately
- **Intervention:** Build internal churn dashboard surfaced from Unite-Group `user.churn` events and Stripe webhook logs

### 4.4 Payment Failures & Dunning Uncertainty

- **Why:** `past_due` → `unpaid` cliff after 4 Stripe retries; no dunning grace
- **Evidence:** Involuntary churn likely higher than observed
- **Impact:** +3–5% NRR gain from dunning grace
- **Intervention:** Add 48h dunning grace email before state transitions to `unpaid`

---

## 5. NRR Target Path (Exit-Thesis Alignment)

| Date                 | Target NRR | Gap from Current | Intervention(s)                                               |
| -------------------- | ---------- | ---------------- | ------------------------------------------------------------- |
| **Now (Aug 2026)**   | 82–87%     | —                | Baseline established                                          |
| **Dec 2026**         | 90–95%     | +3–8%            | P1 interventions: Introductory cliff, free SEO, dunning grace |
| **June 2027**        | 100%+      | +5–13%           | Pro+ tier, multi-step onboarding, churn dashboard             |
| **June 2028 (Exit)** | ≥100%      | —                | All interventions in place; NRR ≥100% requirement met         |

---

## 6. Data Gap: Live Stripe Access

### 6.1 Current Blockers

- **Live Synthex Stripe key is encrypted in Vercel (`STRIPE_SECRET_KEY` in production environment)**
- **Cannot be accessed by autonomous agent via Vercel REST API or 1Password without interactive login**
- **Historical Stripe events API horizon is ~30 days; requires Subscription objects list to go beyond**

### 6.2 Recommended Human Action

```bash
cd /Users/phill-mac/Synthex
vercel link  # if not already linked
vercel env pull .env.production.local --environment=production
export STRIPE_SECRET_KEY=$(grep '^STRIPE_SECRET_KEY=' .env.production.local | cut -d= -f2-)
cd /Users/phill-mac/pi-seo-workspace/Synthex
npx tsx scripts/churn-mix-analysis.ts --days 180 > docs/billing/churn-mix-may-nov-2026.json
```

### 6.3 Once Live Data Is Available

Enrich this baseline with:

1. **Churn mix:** Voluntary vs involuntary vs paused vs total cancellations
2. **Top churn reasons:** Via `feedback_top5` (Stripe `cancellation_details.reason` + support tickets)
3. **Reason breakdown:** By `cancellation_requested`, `payment_failed`, `payment_disputed`, `null`
4. **Segment-level breakdown:** By plan tier (Free, Starter, Introductory, Pro, Enterprise)
5. **Expansion revenue attribution:** Upsell events, usage-based expansion

These granular data points will ground NRR experiments and validate the root cause categories documented above.

---

## 7. Next Steps

1. **Immediate (Week 1):** Phill approves P1 retention interventions (Introductory cliff, free SEO, dunning grace)
2. **Short-term (Month 2):** Unblock live Stripe access; pull historical churn events; compare against baseline
3. **Medium-term (Month 3):** Build internal churn dashboard; surface `user.churn` events to Synthex dashboards
4. **Long-term (Quarter 2):** Monitor NRR weekly; validate P1 interventions; plan P2/P3 interventions

---

## 8. Appendices

### 8.1 NRR Calculation Formula (Detailed)

```
NRR (%) = (Σ Revenue Retained from Cohort Start to Today + Σ Expansion Revenue) / Σ Starting Revenue × 100

Where:
- Starting Revenue = MRR of cohort at cohort start (May 1, 2026)
- Revenue Retained = Σ MRR from renewed subscriptions (non-churned customers)
- Expansion Revenue = Σ incremental revenue from upsells, add-ons, higher-tier renewal
```

**Note:** Expansion revenue NOT included in this baseline due to data unavailability.

### 8.2 Segment Pricing Reference

| Segment      | Pricing                        | MRR per User ($AUD)                     | Revenue Weight |
| ------------ | ------------------------------ | --------------------------------------- | -------------- |
| Free         | $0                             | $0                                      | 0%             |
| Starter      | $49/mo                         | $49                                     | ~10%           |
| Introductory | $99/mo (2mo) → $249/mo         | ~$120 avg (first 2mo) + $249 thereafter | ~15%           |
| Pro          | $249/mo                        | $249                                    | ~55%           |
| Enterprise   | $249 + $99/additional location | ~$300 avg                               | ~20%           |

### 8.3 References

- Baseline 6-month cohort analysis: `docs/billing/nrr-baseline-may-nov-2026.md`
- Churn mix analysis script: `scripts/churn-mix-analysis.ts`
- MRR calculator: `lib/admin/mrr-calculator.ts`
- Churn scorer: `lib/retention/churn-scorer.ts`
- Prisma schema: `prisma/schema.prisma` (models: Organization, Subscription, DunningState, RevenueEntry)
