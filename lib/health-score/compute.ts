/**
 * Client Health Score computation engine — SYN-611 + SYN-679
 *
 * Computes a 0-100 composite marketing health score for each active client org,
 * synthesising six core dimensions from existing platform data.
 *
 * SYN-679 adds journey_engagement as a shadow 7th dimension (initially inactive).
 *
 * Run weekly by the compute-health-scores Supabase Edge Function (Monday 05:00 AEDT).
 */

import { prisma } from '@/lib/prisma';

// ── Constants ──────────────────────────────────────────────────────

/**
 * SYN-679: Journey engagement shadow dimension activation toggle.
 *
 * ACTIVATION PROTOCOL:
 * - Step 1: Set JOURNEY_DIMENSION_ACTIVE = true (this file)
 * - Step 2: Redeploy
 * - Step 3: Monitor deployment logs for 'shadow_dimension_activated' events
 * - Step 4: Check analytics dashboard (journey engagement composite should rise ~5-10pts)
 * - Step 5: Verify no test org has journey_engagement > 100 (invariant check)
 * - Step 6: Confirm Health Score stability (delta distribution should be normal)
 *
 * Rollback: Set JOURNEY_DIMENSION_ACTIVE = false, redeploy, no data loss.
 */
export const JOURNEY_DIMENSION_ACTIVE = false;

// ── Types ─────────────────────────────────────────────────────────────

export interface DimensionScore {
  score: number; // 0-100
  raw_value: number; // the underlying metric used to compute score
  description: string; // plain English, shown in dashboard tooltips
}

export interface HealthScoreDimensions {
  content_consistency: DimensionScore | null;
  engagement_trajectory: DimensionScore | null;
  review_responsiveness: DimensionScore | null;
  authority_momentum: DimensionScore | null;
  advisor_engagement: DimensionScore | null;
  platform_usage: DimensionScore | null;
}

export interface ShadowDimensions {
  journey_engagement: DimensionScore | null;
}

export type RiskLevel = 'healthy' | 'watch' | 'at_risk' | 'critical';

export interface ComputedHealthScore {
  organizationId: string;
  weekStart: Date;
  overallScore: number | null; // null = insufficient_data (< 2 non-null dimensions)
  dimensions: HealthScoreDimensions;
  shadowDimensions: ShadowDimensions; // Always computed, only affects composite if JOURNEY_DIMENSION_ACTIVE = true
  scoreDelta: number; // change from previous week (0 if no prior score)
  riskLevel: RiskLevel | null; // null = insufficient_data
}

export type DimensionWeights = {
  content_consistency: number;
  engagement_trajectory: number;
  review_responsiveness: number;
  authority_momentum: number;
  advisor_engagement: number;
  platform_usage: number;
  journey_engagement?: number; // Optional, only used if JOURNEY_DIMENSION_ACTIVE = true
};

const DEFAULT_WEIGHTS: DimensionWeights = {
  content_consistency: 0.25,
  engagement_trajectory: 0.2,
  review_responsiveness: 0.15,
  authority_momentum: 0.15,
  advisor_engagement: 0.15,
  platform_usage: 0.1,
};

const DEFAULT_WEIGHTS_WITH_JOURNEY: DimensionWeights = {
  content_consistency: 0.225, // 25% -> 22.5%
  engagement_trajectory: 0.18, // 20% -> 18%
  review_responsiveness: 0.135, // 15% -> 13.5%
  authority_momentum: 0.135, // 15% -> 13.5%
  advisor_engagement: 0.135, // 15% -> 13.5%
  platform_usage: 0.09, // 10% -> 9%
  journey_engagement: 0.1, // New: 10%
};

// ── Helpers ─────────────────────────────────────────────────────

function toRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'watch';
  if (score >= 25) return 'at_risk';
  return 'critical';
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of the current week (00:00 UTC) */
function thisMonday(): Date {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Weighted average that redistributes null-dimension weights proportionally */
function weightedAverage(
  scores: Record<string, number | null>,
  weights: Record<string, number>
): number | null {
  const nonNull = Object.entries(scores).filter(([, v]) => v !== null) as [
    string,
    number,
  ][];
  if (nonNull.length < 2) return null; // insufficient_data

  const totalWeight = nonNull.reduce((sum, [k]) => sum + (weights[k] ?? 0), 0);
  if (totalWeight === 0) return null;

  const weighted = nonNull.reduce(
    (sum, [k, v]) => sum + v * ((weights[k] ?? 0) / totalWeight),
    0
  );
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

// ── Config ─────────────────────────────────────────────────────────

async function getWeights(): Promise<DimensionWeights> {
  const config = await prisma.healthScoreConfig.findFirst();
  if (!config) {
    return JOURNEY_DIMENSION_ACTIVE
      ? DEFAULT_WEIGHTS_WITH_JOURNEY
      : DEFAULT_WEIGHTS;
  }
  return config.weights as DimensionWeights;
}

// ── Dimension Computers ─────────────────────────────────────────────

/**
 * content_consistency: ratio of published posts to scheduled posts in last 28 days.
 * Applies an improvement-rate bonus (up to +10 pts) from ContentImprovementTracking (SYN-633).
 * Null if no posts were scheduled.
 */
async function computeContentConsistency(
  organizationId: string
): Promise<DimensionScore | null> {
  const since = daysAgo(28);

  const [scheduled, published, latestTracking] = await Promise.all([
    prisma.calendarPost.count({
      where: {
        organizationId,
        scheduledFor: { gte: since },
        status: { in: ['published', 'scheduled', 'failed', 'cancelled'] },
      },
    }),
    prisma.calendarPost.count({
      where: {
        organizationId,
        scheduledFor: { gte: since },
        status: 'published',
      },
    }),
    // SYN-633: fetch latest improvement rate for bonus scoring
    prisma.contentImprovementTracking.findFirst({
      where: { organizationId },
      orderBy: { weekStart: 'desc' },
      select: { improvementRate: true },
    }),
  ]);

  if (scheduled === 0) return null;

  const rate = published / scheduled;
  const baseScore = rate * 100;

  // SYN-633: improvement-rate bonus — positive trend adds up to 10 pts
  // Capped to keep the dimension score within [0, 100]
  const improvementRate = latestTracking?.improvementRate ?? 0;
  const bonus = improvementRate > 0 ? Math.min(10, improvementRate * 100) : 0;

  const score = Math.round(Math.min(100, baseScore + bonus));

  return {
    score,
    raw_value: rate,
    description: `Published ${published} of ${scheduled} suggested posts this month`,
  };
}

/**
 * engagement_trajectory: weekly digest open rate across all org users in last 4 weeks.
 * Null if no digests have been sent.
 */
async function computeEngagementTrajectory(
  organizationId: string
): Promise<DimensionScore | null> {
  const since = daysAgo(28);

  // Get all user IDs in this org
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return null;

  const [sent, opened] = await Promise.all([
    prisma.aIWeeklyDigest.count({
      where: {
        userId: { in: userIds },
        emailSent: true,
        weekStart: { gte: since },
      },
    }),
    prisma.aIWeeklyDigest.count({
      where: {
        userId: { in: userIds },
        emailSent: true,
        opened: true,
        weekStart: { gte: since },
      },
    }),
  ]);

  if (sent === 0) return null;

  const rate = opened / sent;
  const score = Math.round(Math.min(100, rate * 100));

  return {
    score,
    raw_value: rate,
    description: `Opened ${opened} of ${sent} weekly digest${sent !== 1 ? 's' : ''} this month`,
  };
}

/**
 * review_responsiveness: reply rate + speed for GBP reviews in last 30 days.
 * Null if no reviews received.
 */
async function computeReviewResponsiveness(
  organizationId: string
): Promise<DimensionScore | null> {
  const since = daysAgo(30);

  const reviews = await prisma.gBPReview.findMany({
    where: { organizationId, reviewTime: { gte: since } },
    select: { replyText: true, replyTime: true, reviewTime: true },
  });

  if (reviews.length === 0) return null;

  const replied = reviews.filter(r => r.replyText);
  const replyRate = replied.length / reviews.length;

  // Average response time in hours (for replied reviews only)
  let avgHours = 0;
  if (replied.length > 0) {
    const totalHours = replied.reduce((sum, r) => {
      if (!r.replyTime) return sum;
      return sum + (r.replyTime.getTime() - r.reviewTime.getTime()) / 3_600_000;
    }, 0);
    avgHours = totalHours / replied.length;
  }

  // Score: 70% reply rate + 30% speed (72h = full speed score)
  const speedScore = replied.length > 0 ? Math.max(0, 1 - avgHours / 72) : 0;
  const score = Math.round(replyRate * 70 + speedScore * 30);

  return {
    score,
    raw_value: replyRate,
    description:
      replied.length === reviews.length
        ? `Responded to all ${reviews.length} review${reviews.length !== 1 ? 's' : ''} this month`
        : `Responded to ${replied.length} of ${reviews.length} reviews (avg ${Math.round(avgHours)}h)`,
  };
}

/**
 * authority_momentum: change in Authority Score over the last 30 days.
 * Null if fewer than 2 snapshots exist.
 */
async function computeAuthorityMomentum(
  organizationId: string
): Promise<DimensionScore | null> {
  const scores = await prisma.authorityScore.findMany({
    where: { organizationId },
    orderBy: { computedAt: 'desc' },
    take: 10,
    select: { score: true, computedAt: true },
  });

  if (scores.length < 2) return null;

  const latest = scores[0];
  const cutoff = daysAgo(35);

  // Find the oldest score that's at least 28 days old
  const baseline =
    scores.find(s => s.computedAt <= cutoff) ?? scores[scores.length - 1];
  if (baseline === latest) return null;

  const delta = latest.score - baseline.score;

  // Map delta to 0-100: neutral at 50 (delta=0), every 2 points delta = 5 score points
  const score = Math.round(Math.max(0, Math.min(100, 50 + delta * 2.5)));

  return {
    score,
    raw_value: delta,
    description:
      delta === 0
        ? `Authority Score stable at ${latest.score}`
        : delta > 0
          ? `Authority Score up ${delta} points to ${latest.score}`
          : `Authority Score down ${Math.abs(delta)} points to ${latest.score}`,
  };
}

/**
 * advisor_engagement: rate of non-skipped Advisor feedback in last 4 weeks.
 * Null if no feedback has been submitted.
 */
async function computeAdvisorEngagement(
  organizationId: string
): Promise<DimensionScore | null> {
  const since = daysAgo(28);

  const feedback = await prisma.advisorFeedback.findMany({
    where: {
      organizationId,
      createdAt: { gte: since },
    },
    select: { response: true },
  });

  if (feedback.length === 0) return null;

  const engaged = feedback.filter(f => f.response !== 'skipped').length;
  const rate = engaged / feedback.length;
  const score = Math.round(rate * 100);

  return {
    score,
    raw_value: rate,
    description: `Engaged with ${engaged} of ${feedback.length} Advisor brief${feedback.length !== 1 ? 's' : ''} this month`,
  };
}

/**
 * platform_usage: breadth of feature usage + visit frequency in last 7 days.
 * Returns 0 (not null) when no events — always computable.
 */
async function computePlatformUsage(
  organizationId: string
): Promise<DimensionScore> {
  const since = daysAgo(7);

  const events = await prisma.clientEngagementEvent.findMany({
    where: {
      clientId: organizationId,
      createdAt: { gte: since },
    },
    select: { eventType: true },
  });

  const TOTAL_EVENT_TYPES = 10; // as per SYN-612 spec

  const uniqueTypes = new Set(events.map(e => e.eventType)).size;
  const dashboardVisits = events.filter(
    e => e.eventType === 'dashboard_visit'
  ).length;

  // Breadth: unique event types / total possible (60%)
  const breadthScore = (uniqueTypes / TOTAL_EVENT_TYPES) * 100;
  // Volume: 5 dashboard visits in a week = full score (40%)
  const volumeScore = Math.min(100, (dashboardVisits / 5) * 100);

  const score = Math.round(breadthScore * 0.6 + volumeScore * 0.4);

  return {
    score,
    raw_value: uniqueTypes,
    description:
      events.length === 0
        ? 'No activity logged this week'
        : `Used ${uniqueTypes} feature${uniqueTypes !== 1 ? 's' : ''}, visited dashboard ${dashboardVisits} time${dashboardVisits !== 1 ? 's' : ''} this week`,
  };
}

/**
 * SYN-679: journey_engagement — percentage of journey moments engaged with.
 * Queries the journey_analytics materialized view.
 * Null if no journey moments received.
 */
async function computeJourneyEngagement(
  organizationId: string
): Promise<DimensionScore | null> {
  try {
    // Query the journey_analytics materialized view
    const result = await prisma.$queryRaw<
      Array<{
        engagement_rate: number | null;
        total_moments_received: number;
      }>
    >`
      SELECT
        engagement_rate,
        total_moments_received
      FROM journey_analytics
      WHERE client_id = ${organizationId}
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return null; // No journey data
    }

    const row = result[0];
    if (!row.total_moments_received || row.total_moments_received === 0) {
      return null;
    }

    // engagement_rate is already 0-1 from the materialized view
    const engagementRate = row.engagement_rate ?? 0;
    const score = Math.round(Math.min(100, engagementRate * 100));

    return {
      score,
      raw_value: engagementRate,
      description: `Engaged with journey moments at ${Math.round(engagementRate * 100)}% rate`,
    };
  } catch (err) {
    // Journey analytics table may not exist yet or query fails
    // Safe to return null — shadow dimension is observational
    console.warn(
      `computeJourneyEngagement failed for org ${organizationId}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

// ── Main Export ─────────────────────────────────────────────────────

/**
 * Compute the health score for a single organisation.
 * Safe to call in parallel across all active orgs.
 */
export async function computeHealthScore(
  organizationId: string
): Promise<ComputedHealthScore> {
  const weekStart = thisMonday();
  const weights = await getWeights();

  // Run all dimensions in parallel (6 core + 1 shadow)
  const [
    content_consistency,
    engagement_trajectory,
    review_responsiveness,
    authority_momentum,
    advisor_engagement,
    platform_usage,
    journey_engagement,
  ] = await Promise.all([
    computeContentConsistency(organizationId),
    computeEngagementTrajectory(organizationId),
    computeReviewResponsiveness(organizationId),
    computeAuthorityMomentum(organizationId),
    computeAdvisorEngagement(organizationId),
    computePlatformUsage(organizationId),
    computeJourneyEngagement(organizationId),
  ]);

  const dimensions: HealthScoreDimensions = {
    content_consistency,
    engagement_trajectory,
    review_responsiveness,
    authority_momentum,
    advisor_engagement,
    platform_usage,
  };

  const shadowDimensions: ShadowDimensions = {
    journey_engagement,
  };

  // Build score map — include journey only if JOURNEY_DIMENSION_ACTIVE
  const scoreMap: Record<string, number | null> = {
    content_consistency: content_consistency?.score ?? null,
    engagement_trajectory: engagement_trajectory?.score ?? null,
    review_responsiveness: review_responsiveness?.score ?? null,
    authority_momentum: authority_momentum?.score ?? null,
    advisor_engagement: advisor_engagement?.score ?? null,
    platform_usage: platform_usage.score, // never null
  };

  if (JOURNEY_DIMENSION_ACTIVE) {
    scoreMap.journey_engagement = journey_engagement?.score ?? null;
  }

  // Weighted average with null redistribution
  const overallScore = weightedAverage(scoreMap, weights);

  // Fetch previous week score for delta
  const prevScore = await prisma.clientHealthScore.findFirst({
    where: {
      organizationId,
      weekStart: { lt: weekStart },
    },
    orderBy: { weekStart: 'desc' },
    select: { overallScore: true },
  });

  const scoreDelta =
    overallScore !== null && prevScore !== null
      ? overallScore - prevScore.overallScore
      : 0;

  return {
    organizationId,
    weekStart,
    overallScore,
    dimensions,
    shadowDimensions,
    scoreDelta,
    riskLevel: overallScore !== null ? toRiskLevel(overallScore) : null,
  };
}

/**
 * Persist a computed score. Upserts by (organizationId, weekStart).
 * Uses raw SQL to persist shadow_dimensions (not in Prisma schema).
 */
export async function saveHealthScore(
  result: ComputedHealthScore
): Promise<void> {
  // Upsert via Prisma (6 core dimensions)
  await prisma.clientHealthScore.upsert({
    where: {
      client_health_score_org_week: {
        organizationId: result.organizationId,
        weekStart: result.weekStart,
      },
    },
    update: {
      overallScore: result.overallScore ?? 0,
      dimensions: result.dimensions as object,
      scoreDelta: result.scoreDelta,
      riskLevel: result.riskLevel,
    },
    create: {
      organizationId: result.organizationId,
      weekStart: result.weekStart,
      overallScore: result.overallScore ?? 0,
      dimensions: result.dimensions as object,
      scoreDelta: result.scoreDelta,
      riskLevel: result.riskLevel,
    },
  });

  // Persist shadow_dimensions via raw SQL (column exists in DB but not in Prisma schema)
  await prisma.$executeRaw`
    UPDATE client_health_scores
    SET shadow_dimensions = ${JSON.stringify(result.shadowDimensions)}::jsonb
    WHERE organization_id = ${result.organizationId}
      AND week_start = ${result.weekStart}
  `;
}

/**
 * Compute + save scores for all active organisations.
 * Returns a summary for logging.
 */
export async function computeAllHealthScores(): Promise<{
  processed: number;
  errors: Array<{ organizationId: string; error: string }>;
  riskTransitions: Array<{
    organizationId: string;
    name: string;
    from: string | null;
    to: string | null;
  }>;
  shadowDimensionActivation?: {
    enabled: boolean;
    avgJourneyEngagement: number | null; // when enabled, avg journey_engagement score across all orgs
  };
}> {
  const orgs = await prisma.organization.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
  });

  const errors: Array<{ organizationId: string; error: string }> = [];
  const riskTransitions: Array<{
    organizationId: string;
    name: string;
    from: string | null;
    to: string | null;
  }> = [];
  const journeyEngagementScores: number[] = [];

  // Run in batches of 5 to avoid DB connection exhaustion
  const BATCH = 5;
  for (let i = 0; i < orgs.length; i += BATCH) {
    const batch = orgs.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async org => {
        try {
          // Get previous risk level before computing new score
          const prev = await prisma.clientHealthScore.findFirst({
            where: { organizationId: org.id },
            orderBy: { weekStart: 'desc' },
            select: { riskLevel: true },
          });

          const result = await computeHealthScore(org.id);
          await saveHealthScore(result);

          // Track journey engagement if active
          if (
            JOURNEY_DIMENSION_ACTIVE &&
            result.shadowDimensions.journey_engagement
          ) {
            journeyEngagementScores.push(
              result.shadowDimensions.journey_engagement.score
            );
          }

          // Detect risk level transitions that need Slack alerts
          const prevRisk = prev?.riskLevel ?? null;
          const newRisk = result.riskLevel;
          if (
            newRisk !== prevRisk &&
            (newRisk === 'at_risk' || newRisk === 'critical')
          ) {
            riskTransitions.push({
              organizationId: org.id,
              name: org.name,
              from: prevRisk,
              to: newRisk,
            });
          }
        } catch (err) {
          errors.push({
            organizationId: org.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );
  }

  // Calculate average journey engagement if active
  let avgJourneyEngagement: number | null = null;
  if (JOURNEY_DIMENSION_ACTIVE && journeyEngagementScores.length > 0) {
    const sum = journeyEngagementScores.reduce((a, b) => a + b, 0);
    avgJourneyEngagement = Math.round(sum / journeyEngagementScores.length);
  }

  return {
    processed: orgs.length - errors.length,
    errors,
    riskTransitions,
    shadowDimensionActivation: {
      enabled: JOURNEY_DIMENSION_ACTIVE,
      avgJourneyEngagement,
    },
  };
}
