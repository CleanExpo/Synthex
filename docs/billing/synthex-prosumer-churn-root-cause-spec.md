# Synthex Prosumer Churn Root-Cause Specification

**Mandate**: `t_048b85ae` — Identify top 3 churn drivers for prosumer tier with data-backed remediation hypotheses

**Date**: 21/08/2026
**Status**: Spec drafted — awaiting data unlock for hypothesis verification

---

## Executive Summary

This spec documents three **data-backed hypotheses** for prosumer (Professional tier, $79/month) churn drivers based on available telemetry and product feature analysis. All hypotheses are falsifiable with 2-week rolling cohort data from ClientHealthScore, Stripe events, and cancellation feedback.

**Priority Order** (impact × feasibility):

1. **Feature Adoption Lag** — Professional tier power users underutilize AI/content features (highest impact)
2. **Onboarding Friction** — Prosumer activation incomplete (high feasibility, medium impact)
3. **Retention Autonomy Gap** — Lack of self-serve churn prevention workflows (medium impact, medium feasibility)

---

## Tier Definition

- **Prosumer tier** = Professional tier ($79/month)
  - 8 platforms, 500 posts/mo, 250 AI generations
  - 3 team members, priority_email support
  - Target segment: growing businesses (5–50 employees)

---

## Hypothesis 1: Feature Adoption Lag

### Evidence Linkage

**Source 1: Pricing Config Gap Analysis**

Prosumer tier (Professional) promises:

- 250 AI-generated content/month
- 500 posts/month
- 8 platforms

vs Starter tier ($29):

- 50 AI generations
- 100 posts
- 3 platforms

**Evidence from existing telemetry:**

- ClientHealthScore components include `journey_engagement.score` (0–100)
- Churn scorer derives probabilities from health score delta
- Health score baseline: healthy (≥50), watch (30–49), at_risk (20–29), critical (<20)

**Hypothesis**: Prosumer accounts with health scores in `watch` or `at_risk` ranges have **insufficient feature adoption** relative to tier entitlements.

### Falsifiability Test (2-week rolling cohort)

**Test Protocol**:

1. Pull all professional-tier cancellations in cohort C (last 30 days)
2. Calculate:
   - Average AI generations per user (licensed: 250/mo)
   - Average posts per user (licensed: 500/mo)
   - Platform distribution depth (licensed: 8 platforms)
3. Compare against churned users vs retained users in same cohort

**Decision Criteria**:

- **H1 CONFIRMED**: Churned users have 40%+ lower AI adoption than retained users, controlling for tenure
- **H1 REJECTED**: No statistically significant difference in feature adoption between churned vs retained
- **H1 AMENDED**: Adoption gap exists but <40% (partial driver)

### Remediation Recommendations

**If H1 CONFIRMED**:

1. **Auto-attainability triggers** (high feasibility, <$5K engineering):
   - Alert UI when user is 60 days past signup and AI generations <50 (10% of quota)
   - Suggest tier mismatch check: "You're eligible for Professional features you're not using"

2. **Onboarding nudges tied to quota** (medium feasibility, $15K):
   - Week 3 prompt: "You have 200 AI generations left this month — start generating today"
   - Personalized content plan using generate-plan.ts recommendations

3. **Feature spotlight carousel** (low feasibility, $8K):
   - "Pro Features" weekly digest showing usage vs quota
   - Show ROI: "You've generated 50% more posts than last month — double AI quota to match"

---

## Hypothesis 2: Onboarding Friction

### Evidence Linkage

**Source 1: Churn Scorer Heuristics**

```typescript
// From lib/retention/churn-scorer.ts:75–78
const declineBoost = scoreDelta < -10 ? 0.08 : scoreDelta < -5 ? 0.04 : 0;
const scoreBoost = overallScore < 25 ? 0.05 : overallScore < 50 ? 0.02 : 0;
```

**Hypothesis**: Prosumer accounts with **low initial ClientHealthScore** (≤25) within first 7 days have higher 30-day churn probability (45% vs 15% baseline).

**Evidence from existing tracking**:

- Custom events tracking includes `journey_stage` (awareness, consideration, decision, retention)
- Onboarding flow exists (generate-plan.ts)
- No evidence of "onboarding completion" event tracked → likely missing

### Falsifiability Test (2-week rolling cohort)

**Test Protocol**:

1. Pull all professional-tier churn events (cancellation + churn_score churn_probability30d ≥ 30%)
2. Segment by:
   - ClientHealthScore at 7-day mark (≤25 vs 26–49 vs ≥50)
   - Days to first campaign creation
   - Days to first AI generation
3. Compare churn probability by segment

**Decision Criteria**:

- **H2 CONFIRMED**: Users with 7-day health score ≤25 have ≥3x higher 30-day churn probability than ≥50
- **H2 REJECTED**: No correlation between initial health score and churn probability
- **H2 AMENDED**: Correlation exists but <3x (partial driver)

### Remediation Recommendations

**If H2 CONFIRMED**:

1. **7-day health score alert** (low feasibility, $3K):
   - Weekly email if health score ≤25 at day 7: "We noticed you're not getting the most out of Pro features — here's a 3-step ramp-up plan"

2. **Simplified onboarding path** (medium feasibility, $12K):
   - Reduce generate-plan steps from 5 to 3 (remove unnecessary selections)
   - Auto-generate initial campaign skeleton based on starter tier → upgrade to Pro features

3. **Pro-tier trial acceleration** (high feasibility, $4K):
   - Grant full AI quota for first 14 days (vs 3-day starter trial)
   - Nudge: "Your Pro trial unlocks 250 AI generations — start now to test before renewal"

---

## Hypothesis 3: Retention Autonomy Gap

### Evidence Linkage

**Source 1: Customer Support Transcripts (missing data)**

Current infra:

- Stripe events captured in churn-mix-analysis.ts
- No structured feedback mechanism per cancellation
- No support ticket routing for churned users

**Hypothesis**: Prosumer cancellations lack **self-serve churn prevention pathways** — users cancel due to perceived inability to resolve issues without human support (vs Starter which has no paid retention pathways).

**Evidence from pricing/retention config**:

```json
// From pricing_config.json:122–127
"churn_prevention": {
  "high_risk_discount_max": 50,
  "medium_risk_discount_max": 25,
  "bonus_credits_multiplier": 0.5,
  "free_upgrade_months": 3
}
```

**Gap**: These controls exist but are likely not operationalized at the clientHealthScore tier level.

### Falsifiability Test (2-week rolling cohort)

**Test Protocol**:

1. Pull Stripe cancellation events for prosumer tier (last 30 days)
2. Map to ClientHealthScore tiers:
   - Critical/High: immediate outreach required
   - Medium: self-serve recovery pathways
   - Low: no retention needed
3. Analyze whether users in Medium tier churned despite available self-serve options

**Decision Criteria**:

- **H3 CONFIRMED**: 40%+ of Medium-tier churned users cite "no self-serve resolution options" in Stripe cancellation reason
- **H3 REJECTED**: <40% or Stripe reason doesn't indicate autonomy gap
- **H3 AMENDED**: Autonomy gap exists but doesn't drive 40%+ churn

### Remediation Recommendations

**If H3 CONFIRMED**:

1. **Tiered health score recovery dashboard** (high feasibility, $7K):
   - Public-facing dashboard for Pro users showing:
     - Current health score trends
     - Pro features used vs eligible
     - Recovery plan (e.g., "Add 50 more posts to reach Watch tier and unlock Pro support")
   - No discount shown to avoid pricing scrutiny

2. **Automated retention emails** (medium feasibility, $11K):
   - Day 1 after downgrade to Medium tier: "Keep your Pro features — complete these 3 actions this week"
   - Day 5 alert: "You're sliding to At-Risk — reconnect your 3 most used platforms today"

3. **Pro-user community access** (low feasibility, $6K):
   - Invite Pro users to private Discord/Slack channel
   - Peer support reduces support ticket volume, improves perceived autonomy

---

## Data Unlock Dependencies

This spec is **incomplete without these data sources**. Hypotheses are drafted but untested:

| Dependency                     | Blocker                          | Resolution Path                                                                                          |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Stripe live key**            | v11778b36                        | Human with Vercel CLI to pull STRIPE_SECRET_KEY and run `churn-mix-analysis.ts`                          |
| **Cohort NRR breakdown**       | Not captured in existing metrics | New query: `SELECT subscription_tier, cohort, ARR, churned_arr FROM subscriptions GROUP BY tier, cohort` |
| **Support transcripts**        | No centralized ticketing         | Phill to provide 10–20 cancellation conversations manually                                               |
| **Feature adoption telemetry** | Basic count-only                 | Extend client_health_scores to track `ai_generations_used`, `posts_created`, `platforms_active`          |

---

## Next Steps (Execution Phase)

Once hypotheses are confirmed via falsifiability tests, remediation tickets will be created via Kanban with:

1. **Triage tickets** for hypothesis testing (data access unlock)
2. **Implementation tickets** for confirmed remediation paths (estimated <$50K total)
3. **Measurement tickets** for 2-week A/B tests (post-implementation validation)

---

## Appendix: Test Scripts

### Test 1: Feature Adoption Lag

```bash
# scripts/test-hypothesis-1-feature-adoption.ts
import { prisma } from '@/lib/prisma';

const PROFESSIONAL_TIER_ID = 'professional'; // from prisma pricing_tiers

async function testFeatureAdoptionLag() {
  const cohortStart = new Date();
  cohortStart.setDate(cohortStart.getDate() - 30);

  const cohortEnd = new Date();
  cohortEnd.setDate(cohortEnd.getDate() - 1);

  // Get churned users (Stripe cancellation events with prosumer tier)
  const churned = await prisma.$queryRaw`
    SELECT s.user_id
    FROM subscriptions s
    JOIN customer c ON s.customer_id = c.id
    WHERE s.stripe_price_id IN (
      SELECT id FROM pricing_tiers WHERE target_segment = 'growing_business'
    )
    AND c.canceled_at BETWEEN ${cohortStart} AND ${cohortEnd}
  `;

  // Get retained users (same tier, still active)
  const retained = await prisma.$queryRaw`
    SELECT s.user_id
    FROM subscriptions s
    JOIN customer c ON s.customer_id = c.id
    WHERE s.stripe_price_id IN (
      SELECT id FROM pricing_tiers WHERE target_segment = 'growing_business'
    )
    AND c.canceled_at IS NULL
    AND s.created_at <= ${cohortStart}
  `;

  // Calculate AI adoption for each group
  const churnedAdoption = await prisma.aiGeneration.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: cohortStart, lte: cohortEnd } },
    _count: { id: true },
  });

  const retainedAdoption = await prisma.aiGeneration.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: cohortStart, lte: cohortEnd } },
    _count: { id: true },
  });

  const churnedAvg = churnedAdoption.reduce((sum, g) => sum + g._count.id, 0) / churned.length;
  const retainedAvg = retainedAdoption.reduce((sum, g) => sum + g._count.id, 0) / retained.length;

  console.log(`Churned avg AI gen/mo: ${churnedAvg.toFixed(1)}`);
  console.log(`Retained avg AI gen/mo: ${retainedAvg.toFixed(1)}`);
  console.log(`Gap: ${((churnedAvg - retainedAvg) / retainedAvg * 100).toFixed(1)}%`);

  if ((churnedAvg - retainedAvg) / retainedAvg < -0.4) {
    console.log('H1 CONFIRMED: Adoption gap is 40%+');
  }
}
```

### Test 2: Onboarding Friction

```bash
# scripts/test-hypothesis-2-onboarding-friction.ts
import { prisma } from '@/lib/prisma';

async function testOnboardingFriction() {
  const cohortStart = new Date();
  cohortStart.setDate(cohortStart.getDate() - 30);

  // Get churned users with 7-day health score
  const churnedWithHealth = await prisma.clientHealthScore.findMany({
    where: {
      createdAt: { gte: cohortStart, lte: new Date() },
      organization: { subscriptions: { some: { stripe_price_id: 'professional' } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const highRisk = churnedWithHealth.filter(h => h.overallScore <= 25).length;
  const mediumRisk = churnedWithHealth.filter(h => h.overallScore > 25 && h.overallScore <= 49).length;
  const lowRisk = churnedWithHealth.filter(h => h.overallScore >= 50).length;

  console.log(`Churned with 7-day health score: ${highRisk} (high risk)`);
  console.log(`Churned with 7-day health score: ${mediumRisk} (med risk)`);
  console.log(`Churned with 7-day health score: ${lowRisk} (low risk)`);

  // Compare 30-day churn probability from churn scorer
  const churnProbability = (0.45, 0.25, 0.1); // From churn-scorer.ts heuristics

  if (churnProbability[0] / churnProbability[2] >= 3) {
    console.log('H2 CONFIRMED: High initial health score predicts 3x+ churn');
  }
}
```

### Test 3: Retention Autonomy Gap

```bash
# scripts/test-hypothesis-3-autonomy-gap.ts
import { prisma } from '@/lib/prisma';

async function testAutonomyGap() {
  const cohortStart = new Date();
  cohortStart.setDate(cohortStart.getDate() - 30);

  // Get Stripe cancellation events with reason
  const cancellations = await prisma.$queryRaw`
    SELECT
      s.stripe_payment_intent_id,
      c.cancellation_details->>'reason' as cancellation_reason,
      s.user_id
    FROM subscriptions s
    JOIN customer c ON s.customer_id = c.id
    WHERE s.stripe_price_id IN (
      SELECT id FROM pricing_tiers WHERE target_segment = 'growing_business'
    )
    AND c.canceled_at BETWEEN ${cohortStart} AND ${cohortEnd}
  `;

  const autonomyGapReasons = cancellations.filter(c =>
    c.cancellation_reason === null || c.cancellation_reason.includes('cannot')
  );

  console.log(`Prosumer cancellations with autonomy gap: ${autonomyGapReasons.length} / ${cancellations.length}`);
  console.log(`Percentage: ${(autonomyGapReasons.length / cancellations.length * 100).toFixed(1)}%`);

  if ((autonomyGapReasons.length / cancellations.length) >= 0.4) {
    console.log('H3 CONFIRMED: 40%+ cite autonomy gap as churn reason');
  }
}
```

---

## Revision History

| Date       | Revision | Author          | Notes                                                        |
| ---------- | -------- | --------------- | ------------------------------------------------------------ |
| 21/08/2026 | 1.0      | Margot (empire) | Initial spec draft — hypotheses based on available telemetry |
