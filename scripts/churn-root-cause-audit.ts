#!/usr/bin/env tsx
/**
 * Synthex Prosumer Growth — Churn Root Cause Audit
 *
 * Pulls live churn data from:
 * 1) Stripe: subscription.deleted events → involuntary vs voluntary mix
 * 2) Supabase: ClientHealthScore + ClientEngagementEvent → cohort-level churn risk
 * 3) GP-team closed tickets → churn-linked CS activity
 *
 * Output: One-page dashboard JSON for Founder review.
 *
 * ENV REQUIRED:
 *   STRIPE_SECRET_KEY
 *   DATABASE_URL (PostgreSQL)
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const db = new PrismaClient();

// --- 1. Stripe churn mix (involuntary vs voluntary) ---

interface StripeChurnMix {
  voluntary: number;
  involuntary: number;
  paused: number;
  total_cancellations: number;
  reason_breakdown: Record<string, number>;
  feedback_top5: Array<[string, number]>;
  i_v_ratio: number;
  recommendation: 'dunning_first' | 'upgrade_flow_first' | 'parallel';
}

async function getStripeChurnMix(days: number = 30): Promise<StripeChurnMix> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const [deletedEvents, updatedEvents] = await Promise.all([
    stripe.events.list({
      type: 'customer.subscription.deleted',
      created: { gte: since },
      limit: 100,
    }),
    stripe.events.list({
      type: 'customer.subscription.updated',
      created: { gte: since },
      limit: 100,
    }),
  ]);

  const voluntary = new Map<string, number>();
  const involuntary = new Map<string, number>();
  const feedback: Record<string, number> = {};

  for (const ev of deletedEvents.data) {
    const sub = ev.data.object as Stripe.Subscription;
    const reason = sub.cancellation_details?.reason ?? null;

    const isVoluntary =
      reason === 'cancellation_requested' ||
      reason === 'customer_requested' ||
      sub.cancellation_details?.feedback != null;

    if (isVoluntary) {
      voluntary.set(
        reason ?? 'other',
        (voluntary.get(reason ?? 'other') ?? 0) + 1
      );
    } else {
      involuntary.set(
        reason ?? 'unpaid',
        (involuntary.get(reason ?? 'unpaid') ?? 0) + 1
      );
    }

    if (sub.cancellation_details?.feedback) {
      feedback[sub.cancellation_details.feedback] =
        (feedback[sub.cancellation_details.feedback] ?? 0) + 1;
    }
  }

  const paused = updatedEvents.data.filter(
    ev => ev.data.object.pause_collection != null
  ).length;

  const total = voluntary.size + involuntary.size;
  const i_v_ratio =
    total === 0
      ? Infinity
      : Array.from(involuntary.values()).reduce((a, b) => a + b, 0) /
          Array.from(voluntary.values()).reduce((a, b) => a + b, 0) || Infinity;

  const feedback_top5 = Object.entries(feedback)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let recommendation: 'dunning_first' | 'upgrade_flow_first' | 'parallel';
  if (
    Array.from(involuntary.values()).reduce((a, b) => a + b, 0) >
    Array.from(voluntary.values()).reduce((a, b) => a + b, 0) * 2
  ) {
    recommendation = 'dunning_first';
  } else if (
    Array.from(voluntary.values()).reduce((a, b) => a + b, 0) >
    Array.from(involuntary.values()).reduce((a, b) => a + b, 0) * 2
  ) {
    recommendation = 'upgrade_flow_first';
  } else {
    recommendation = 'parallel';
  }

  return {
    voluntary: Array.from(voluntary.values()).reduce((a, b) => a + b, 0),
    involuntary: Array.from(involuntary.values()).reduce((a, b) => a + b, 0),
    paused,
    total_cancellations: total,
    reason_breakdown: Object.fromEntries([
      ...voluntary.entries(),
      ...involuntary.entries(),
    ]),
    feedback_top5,
    i_v_ratio,
    recommendation,
  };
}

// --- 2. Cohort-level churn risk from ClientHealthScore ---

interface CohortRisk {
  weekStart: Date;
  orgCount: number;
  avgScore: number;
  avgDelta: number;
  churnProbability30d: number;
  churnProbability90d: number;
  riskTier: 'low' | 'medium' | 'high' | 'critical';
  tierCount: Record<'low' | 'medium' | 'high' | 'critical', number>;
}

async function getCohortRiskMetrics(): Promise<CohortRisk[]> {
  const weeks = await db.clientHealthScore.findMany({
    select: {
      weekStart: true,
      organizationId: true,
      overallScore: true,
      scoreDelta: true,
    },
    orderBy: { weekStart: 'asc' },
  });

  if (weeks.length < 2) {
    return [];
  }

  // Group by week
  const weekly: Map<
    string,
    Array<{ overallScore: number; scoreDelta: number }>
  > = new Map();

  for (const w of weeks) {
    const key = w.weekStart.toISOString().split('T')[0];
    if (!weekly.has(key)) weekly.set(key, []);
    weekly
      .get(key)!
      .push({ overallScore: w.overallScore, scoreDelta: w.scoreDelta });
  }

  const cohorts: CohortRisk[] = [];

  for (const [key, scores] of weekly) {
    const orgCount = scores.length;
    const avgScore = scores.reduce((a, b) => a + b.overallScore, 0) / orgCount;
    const avgDelta = scores.reduce((a, b) => a + b.scoreDelta, 0) / orgCount;

    // Derive churn probability (heuristic — same as lib/retention/churn-scorer.ts)
    const riskLevel =
      avgScore >= 75
        ? 'healthy'
        : avgScore >= 50
          ? 'watch'
          : avgScore >= 25
            ? 'at_risk'
            : 'critical';
    const declineBoost = avgDelta < -10 ? 0.08 : avgDelta < -5 ? 0.04 : 0;
    const scoreBoost = avgScore < 25 ? 0.05 : avgScore < 50 ? 0.02 : 0;

    const p30 = Math.min(
      0.95,
      (riskLevel === 'critical'
        ? 0.45
        : riskLevel === 'at_risk'
          ? 0.25
          : riskLevel === 'watch'
            ? 0.1
            : 0.05) +
        declineBoost +
        scoreBoost
    );
    const p90 = Math.min(
      0.99,
      (riskLevel === 'critical'
        ? 0.7
        : riskLevel === 'at_risk'
          ? 0.4
          : riskLevel === 'watch'
            ? 0.2
            : 0.1) +
        declineBoost +
        scoreBoost
    );

    const tierMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      critical: 'critical',
      at_risk: 'high',
      watch: 'medium',
      healthy: 'low',
    };

    const riskTier = tierMap[riskLevel] ?? 'medium';

    const tierCounts: Record<'low' | 'medium' | 'high' | 'critical', number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const s of scores) {
      const t =
        tierMap[
          s.overallScore >= 75
            ? 'healthy'
            : s.overallScore >= 50
              ? 'watch'
              : s.overallScore >= 25
                ? 'at_risk'
                : 'critical'
        ] ?? 'medium';
      tierCounts[t]++;
    }

    cohorts.push({
      weekStart: new Date(key),
      orgCount,
      avgScore,
      avgDelta,
      churnProbability30d: Math.round(p30 * 1000) / 1000,
      churnProbability90d: Math.round(p90 * 1000) / 1000,
      riskTier,
      tierCount: tierCounts,
    });
  }

  return cohorts;
}

// --- 3. Churn-linked engagement drop-off ---

async function getChurnLinkedDropoff(): Promise<Record<string, number>> {
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);

  const recentEvents = await db.clientEngagementEvent.findMany({
    where: {
      createdAt: { gte: fourWeeksAgo },
      eventType: {
        in: ['dashboard_visit', 'advisor_brief_viewed', 'calendar_post_viewed'],
      },
    },
    select: {
      clientId: true,
      createdAt: true,
    },
  });

  const weeklyCounts: Map<string, number> = new Map();

  for (const ev of recentEvents) {
    const weekKey = new Date(ev.createdAt).toISOString().split('T')[0];
    weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) ?? 0) + 1);
  }

  // Find the 2 most recent weeks
  const sortedWeeks = Array.from(weeklyCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => new Date(b.key).getTime() - new Date(a.key).getTime());

  if (sortedWeeks.length < 2) {
    return {};
  }

  const latest = sortedWeeks[0].count;
  const previous = sortedWeeks[1].count;

  const dropoff = previous - latest;
  const dropoffPercent = previous > 0 ? (dropoff / previous) * 100 : 0;

  return {
    ['Week ' +
    new Date(sortedWeeks[1].key).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
    })]: previous,
    ['Week ' +
    new Date(sortedWeeks[0].key).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
    })]: latest,
    dropoff,
    dropoffPercent,
  };
}

// --- Main ---

async function main() {
  console.error('[churn-audit] starting...');

  const stripeMix = await getStripeChurnMix(30);
  console.error('[churn-audit] stripe churn mix loaded:', stripeMix);

  const cohorts = await getCohortRiskMetrics();
  console.error(
    '[churn-audit] cohort risk metrics loaded:',
    cohorts.length,
    'weeks'
  );

  const dropoff = await getChurnLinkedDropoff();
  console.error('[churn-audit] engagement dropoff:', dropoff);

  const summary = {
    metadata: {
      runAt: new Date().toISOString(),
      windowDays: 30,
      version: 'synthex-prosumer-churn-audit-v1',
    },
    stripe: stripeMix,
    cohorts,
    engagementDropoff: dropoff,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(e => {
    console.error('[churn-audit] FAIL', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
