/**
 * Client Health Score computation engine — SYN-611
 *
 * Computes a 0-100 composite marketing health score for each active client org,
 * synthesising six dimensions from existing platform data.
 *
 * Run weekly by the compute-health-scores Supabase Edge Function (Monday 05:00 AEDT).
 */

import { prisma } from '@/lib/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DimensionScore {
  score: number;       // 0-100
  raw_value: number;   // the underlying metric used to compute score
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

export type RiskLevel = 'healthy' | 'watch' | 'at_risk' | 'critical';

export interface ComputedHealthScore {
  organizationId: string;
  weekStart: Date;
  overallScore: number | null; // null = insufficient_data (< 2 non-null dimensions)
  dimensions: HealthScoreDimensions;
  scoreDelta: number;          // change from previous week (0 if no prior score)
  riskLevel: RiskLevel | null; // null = insufficient_data
}

export type DimensionWeights = {
  content_consistency: number;
  engagement_trajectory: number;
  review_responsiveness: number;
  authority_momentum: number;
  advisor_engagement: number;
  platform_usage: number;
};

const DEFAULT_WEIGHTS: DimensionWeights = {
  content_consistency: 0.25,
  engagement_trajectory: 0.20,
  review_responsiveness: 0.15,
  authority_momentum: 0.15,
  advisor_engagement: 0.15,
  platform_usage: 0.10,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const nonNull = Object.entries(scores).filter(([, v]) => v !== null) as [string, number][];
  if (nonNull.length < 2) return null; // insufficient_data

  const totalWeight = nonNull.reduce((sum, [k]) => sum + (weights[k] ?? 0), 0);
  if (totalWeight === 0) return null;

  const weighted = nonNull.reduce(
    (sum, [k, v]) => sum + v * ((weights[k] ?? 0) / totalWeight),
    0
  );
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

// ── Config ───────────────────────────────────────────────────────────────────

async function getWeights(): Promise<DimensionWeights> {
  const config = await prisma.healthScoreConfig.findFirst();
  if (!config) return DEFAULT_WEIGHTS;
  return config.weights as DimensionWeights;
}

// ── Dimension Computers ───────────────────────────────────────────────────────

/**
 * content_consistency: ratio of published posts to scheduled posts in last 28 days.
 * Null if no posts were scheduled.
 */
async function computeContentConsistency(
  organizationId: string
): Promise<DimensionScore | null> {
  const since = daysAgo(28);

  const [scheduled, published] = await Promise.all([
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
  ]);

  if (scheduled === 0) return null;

  const rate = published / scheduled;
  const score = Math.round(Math.min(100, rate * 100));

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
    description: replied.length === reviews.length
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
  const baseline = scores.find(s => s.computedAt <= cutoff) ?? scores[scores.length - 1];
  if (baseline === latest) return null;

  const delta = latest.score - baseline.score;

  // Map delta to 0-100: neutral at 50 (delta=0), every 2 points delta = 5 score points
  const score = Math.round(Math.max(0, Math.min(100, 50 + delta * 2.5)));

  return {
    score,
    raw_value: delta,
    description: delta === 0
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
  const dashboardVisits = events.filter(e => e.eventType === 'dashboard_visit').length;

  // Breadth: unique event types / total possible (60%)
  const breadthScore = (uniqueTypes / TOTAL_EVENT_TYPES) * 100;
  // Volume: 5 dashboard visits in a week = full score (40%)
  const volumeScore = Math.min(100, (dashboardVisits / 5) * 100);

  const score = Math.round(breadthScore * 0.6 + volumeScore * 0.4);

  return {
    score,
    raw_value: uniqueTypes,
    description: events.length === 0
      ? 'No activity logged this week'
      : `Used ${uniqueTypes} feature${uniqueTypes !== 1 ? 's' : ''}, visited dashboard ${dashboardVisits} time${dashboardVisits !== 1 ? 's' : ''} this week`,
  };
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Compute the health score for a single organisation.
 * Safe to call in parallel across all active orgs.
 */
export async function computeHealthScore(
  organizationId: string
): Promise<ComputedHealthScore> {
  const weekStart = thisMonday();
  const weights = await getWeights();

  // Run all six dimensions in parallel
  const [
    content_consistency,
    engagement_trajectory,
    review_responsiveness,
    authority_momentum,
    advisor_engagement,
    platform_usage,
  ] = await Promise.all([
    computeContentConsistency(organizationId),
    computeEngagementTrajectory(organizationId),
    computeReviewResponsiveness(organizationId),
    computeAuthorityMomentum(organizationId),
    computeAdvisorEngagement(organizationId),
    computePlatformUsage(organizationId),
  ]);

  const dimensions: HealthScoreDimensions = {
    content_consistency,
    engagement_trajectory,
    review_responsiveness,
    authority_momentum,
    advisor_engagement,
    platform_usage,
  };

  // Weighted average with null redistribution
  const scoreMap: Record<string, number | null> = {
    content_consistency: content_consistency?.score ?? null,
    engagement_trajectory: engagement_trajectory?.score ?? null,
    review_responsiveness: review_responsiveness?.score ?? null,
    authority_momentum: authority_momentum?.score ?? null,
    advisor_engagement: advisor_engagement?.score ?? null,
    platform_usage: platform_usage.score, // never null
  };

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
    scoreDelta,
    riskLevel: overallScore !== null ? toRiskLevel(overallScore) : null,
  };
}

/**
 * Persist a computed score. Upserts by (organizationId, weekStart).
 */
export async function saveHealthScore(result: ComputedHealthScore): Promise<void> {
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
}

/**
 * Compute + save scores for all active organisations.
 * Returns a summary for logging.
 */
export async function computeAllHealthScores(): Promise<{
  processed: number;
  errors: Array<{ organizationId: string; error: string }>;
  riskTransitions: Array<{ organizationId: string; name: string; from: string | null; to: string | null }>;
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

  return { processed: orgs.length - errors.length, errors, riskTransitions };
}
