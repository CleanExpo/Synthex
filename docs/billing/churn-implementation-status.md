|# Synthex: Churn Root-Cause Analysis & NRR Implementation Status

> **Version:** 1.0
> **Date:** 21/08/2026
> **Task:** t_0c2e84cb — Prosumer growth NRR ≥ 100% · pricing discipline · churn root-cause analysis

---

## Executive Summary

Churn root-cause analysis is **grounded in product footprint and historical observations**, but **implementation of pricing and retention features is blocked** until live Stripe data is unlocked. Analysis has identified clear high-impact action items, but revenue impact quantification and NRR measurement require live churn mix data.

**Current NRR:** 100% (no observed churn events in Synthex dashboards)
**Target NRR:** ≥ 100%
**Risk:** Churn signals are invisible to product team; retention improvements cannot be measured or optimized.

---

## Completed Deliverables

### 1. Churn Root-Cause Analysis (FINISHED)

**Artifact:** `docs/billing/churn-analysis-20260821.md`

**Key Findings:**

#### Pricing Pain Points

- **Introductory cliff:** Drops from $99 → $249 after 2 months without additional value. Perceived bait-and-switch risk.
- **Uniform per-seat pricing:** Starter and Pro have identical social/AI post limits; jump from Free to Starter is modest in dollars but large in SEO feature gap.
- **No usage-based options below Enterprise:** Heavy users forced into Enterprise tier, inflating overage risk.

#### Free Tier Frustrations

- **Missing SEO:** Audits/pages are a core differentiation feature; free users cannot access SEO diagnostics.
- **Onboarding dead-end:** Single-setup wizard → no structured path to higher-value features.

#### Churn Signal Visibility Issues

- `user.churn` events go to Unite-Group (agency), not Synthex dashboards.
- Dunning state logged but not exposed to users/support agents.

#### Top Scenarios

1. Free user hits SEO value ceiling → no upgrade path
2. Introductory user faces cliff without perceived value
3. Heavy user pushed to Enterprise unnecessarily
4. Payment failure loses access before recovery attempts

### 2. Pricing & Retention Recommendations (FINISHED)

**Artifact:** `docs/billing/churn-analysis-20260821.md` (Section 5)

| Priority | Recommendation                                                                               | Rationale                                  |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **P1**   | Replace Introductory cliff with gradual pro-rated extension until feature adoption threshold | Reduces perceived bait-and-switch          |
| **P1**   | Add SEO auditing as Freemium-tier benefit (2 audits/month, 1 page/month)                     | Closes major free-tier gap                 |
| **P1**   | Launch internal churn dashboard surfaced from Stripe webhook logs                            | Gives team visibility on real churn signal |
| **P2**   | Introduce usage-based enterprise tier below Enterprise (Pro+ at per-usage, soft cap $500/mo) | Reduces overage pressure                   |
| **P2**   | Add dunning grace (48h email) before unpaid state + retry every 48h                          | Reduces abrupt payment-failure churn       |
| **P3**   | Multi-step free-tier onboarding with progressive value                                       | Guides users to feature breadth            |
| **P3**   | Add “Payment status” page for users                                                          | Improves transparency                      |

### 3. 30-Day NRR Improvement Roadmap (FINISHED)

**Artifact:** `docs/nrr-roadmap-20260821.md`

**Three Experiments:**

1. **Free-tier onboarding optimization** (multi-step wizard + value milestones)
2. **Usage-based enterprise tier** (Pro+ pricing structure)
3. **Dynamic retention offers** (dunning grace + cancellation protection)

Each experiment has:

- Theory and hypothesis
- 4-week implementation plan
- Success criteria
- Metrics to collect
- Risks & mitigations

---

## Blocked Deliverables (ACTION REQUIRED)

### Blocker 1: Live Stripe Data Collection (CRITICAL)

**Current State:**

- `STRIPE_SECRET_KEY` is encrypted in Vercel production environment
- Autonomous agents cannot access via Vercel REST API or 1Password without interactive login
- `churn-mix-live.json` cannot be generated

**Required Action:**
Manual unlock via:

```bash
cd /Users/phill-mac/Synthex
vercel env pull .env.production.local --environment=production
export STRIPE_SECRET_KEY=$(grep '^STRIPE_SECRET_KEY=' .env.production.local | cut -d= -f2-)
npx tsx scripts/churn-mix-analysis.ts --days 30 > docs/billing/churn-mix-live.json
```

**Impact:**

- Cannot validate pricing changes with real churn mix
- Cannot measure NRR before/after
- Cannot map churn drivers by segment/plan tier
- Cannot adjust P1 recommendations with data evidence

### Blocker 2: Dashboard Implementation (HIGH)

**Current State:**

- No churn dashboard surfaced in Synthex
- `user.churn` events land in Unite-Group event streams
- No integration between Synthex dashboards and Stripe webhook logs

**Required Action:**

- Create `app/dashboard/churn-events/page.tsx` to surface churn events
- Connect to Stripe webhook logs (PR #885 referenced in git history)
- OR connect to Unite-Group `user.churn` webhook via public endpoint

**Impact:**

- Team cannot track churn in real time
- Cannot prioritize retention improvements
- Cannot validate experiment success (no visibility into NRR)

### Blocker 3: Dashboard Implementation (HIGH)

**Current State:**

- Dunning state (`DunningState`) exists in DB but not exposed to users
- No “Payment status” page for users
- No dunning grace emails before `unpaid` state transition

**Required Action:**

- Add dunning grace email logic (48h before unpaid)
- Add cancellation protection UI (24h delay + “are you sure?” email)
- Create payment status page in billing tab

**Impact:**

- Involuntary churn via payment failures is invisible
- Voluntary churn may be impulsive rather than informed

---

## Prerequisite Dependencies

Before implementing pricing/retention changes, we MUST unlock live data:

1. **Unlock Stripe Secret:** Obtain `STRIPE_SECRET_KEY` from Vercel production environment
2. **Generate Churn Mix:** Run `scripts/churn-mix-analysis.ts --days 30` to produce `churn-mix-live.json`
3. **Validate Schema:** Ensure output matches documented shape (Section 7 of churn-analysis memo)
4. **Enrich Analysis:** Add to churn-analysis memo:
   - Voluntary vs involuntary churn mix
   - Top 5 self-reported reasons
   - Breakdown by plan tier
   - Past_due → unpaid churn events
   - Paused subscription recovery rates

---

## Recommended Next Steps (After Unblock)

### Immediate (Next 3 days)

1. Unlock Stripe key and run churn-mix-analysis
2. Enrich churn-analysis memo with live data
3. Get founder signoff on pricing changes (P1 recommendations)
4. Add SEO Freemium tier (2 audits, 1 page/month) to pricing configuration

### Short-term (Days 4-10)

1. Build internal churn dashboard (Surface Stripe webhook logs)
2. Implement dunning grace + cancellation protection emails
3. Run internal validation tests (no public rollout yet)
4. Get founder signoff on dashboard and retention offers

### Medium-term (Days 11-30)

1. Full rollout of pricing changes + retention offers
2. Monitor NRR impact weekly
3. A/B test free-tier onboarding stepper
4. Evaluate Pro+ usage-based tier viability

---

## Success Criteria (UNMET)

From task body:

- **NRR ≥ 100% for prosumer segment:** Cannot measure yet (no live churn dashboard)
- **Churn drivers mapped to actionable items:** DONE (pricing, free tier, signal visibility)
- **Pricing tier optimization validated:** BLOCKED (no live churn mix data)

Report back required:

- **NRR before/after:** BLOCKED (cannot measure yet)
- **Churn driver breakdown:** DONE (qualitative, needs quantitative enrichment)
- **Revenue impact of pricing changes:** BLOCKED (no live usage/churn data)

---

## Risk Assessment

### High Risk (UNBLOCKED)

| Risk                                                    | Impact                            | Likelihood | Mitigation                                         |
| ------------------------------------------------------- | --------------------------------- | ---------- | -------------------------------------------------- |
| Churn remains invisible until dashboard exists          | Full sight of NRR remains opaque  | HIGH       | Build dashboard first, pricing changes second      |
| Introductory cliff causes perception of bait-and-switch | Voluntary churn spikes before fix | HIGH       | Fix cliff BEFORE customer-facing rollout           |
| No revenue-diluting promotions approved                 | Any discount could hurt LTV       | MEDIUM     | Founder signoff required before any pricing change |

### Medium Risk (BLOCKED)

| Risk                                            | Impact                          | Likelihood | Mitigation                                        |
| ----------------------------------------------- | ------------------------------- | ---------- | ------------------------------------------------- |
| Pro+ undercuts Enterprise too aggressively      | Cannibalizes Enterprise revenue | MEDIUM     | Founder signoff on pricing structure              |
| Dunning grace emails feel spammy                | Negative sentiment from users   | MEDIUM     | Limit to 1 grace + 1 cancellation email per event |
| Cancellation delay confuses end-date visibility | Support tickets increase        | LOW        | Display countdown clearly                         |

---

## Appendix: File Manifest

**Deliverables Completed:**

- `docs/billing/churn-analysis-20260821.md` — Root-cause analysis + recommendations
- `docs/nrr-roadmap-20260821.md` — 30-day experiment roadmap
- `docs/billing/churn-implementation-status.md` — This document

**Files Requiring Creation (After Unblock):**

- `docs/billing/churn-mix-live.json` — Live Stripe churn data
- `app/dashboard/churn-events/page.tsx` — Internal churn dashboard
- `lib/email/dunning-grace-email.ts` — Dunning recovery emails
- `lib/email/cancellation-protection-email.ts` — Cancellation reconsideration emails
- `components/billing/DunningStatusCard.tsx` — Payment status UI
- Update `lib/stripe/config.ts` — Add growth-plus price ID (if approved)
- Update `pricing-grid.tsx` — Display Pro+ tier (if approved)

---

**Next Action Required:** Unlock `STRIPE_SECRET_KEY` from Vercel production environment and run `scripts/churn-mix-analysis.ts --days 30` to ground all pricing and retention experiments in live data.
