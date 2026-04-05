/**
 * Client Health Score computation engine — SYN-611
 *
 * Computes a 0-100 composite marketing health score for each active client org,
 * synthesising six dimensions from existing platform data.
 *
 * Run weekly by the compute-health-scores Supabase Edge Function (Monday 05:00 AEDT).
 */

import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// ── Journey Shadow Dimension Config ──────────────────────────────────────────

/**
 * SYN-679: 4-week validation protocol toggle.
 *
 * When false (default): journey_engagement is computed and logged to
 *   shadow_dimensions, but NOT included in the 0-100 composite score.
 *
 * When true: journey_engagement is included at 10% weight; existing 6
 *   dimensions are proportionally reweighted to sum to 90%.
 *
 * Promotion criteria (after 4 weekly cycles):
 *   - If ≤20% of clients cross an intervention threshold solely due to this
 *     dimension → set to true and reweight existing dimensions to 90%
 *   - If >20% cross threshold → keep false, investigate signal quality
 */
export const JOURNEY_DIMENSION_ACTIVE = false;

/** Weight allocated to journey_engagement when active */
const JOURNEY_DIMENSION_WEIGHT = 0.10;

// ── Supabase admin client (for journey_analytics view, not in Prisma schema) ─

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabaseAdmin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }
  return _supabaseAdmin;
}

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

export interface ShadowDimensions {
  journey_engagement: DimensionScore | null;
}

export interface ComputedHealthScore {
  organizationId: string;
  weekStart: Date;
  overallScore: number | null; // null = insufficient_data (< 2 non-null dimensions)
  dimensions: HealthScoreDimensions;
  shadowDimensions: ShadowDimensions; // logged always, included in composite only when JOURNEY_DIMENSION_ACTIVE
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

// ── Shadow Dimension: Journey Engagement ──────────────────────────────────────

/**
 * Fetches journey_engagement_rate from the journey_analytics materialized view.
 * Returns null when the org has no journey moments (excluded from dimension).
 * Rate is 0.0-1.0 (total_moments_engaged / total_moments_received).
 *
 * SYN-679 — shadow dimension, not included in composite until JOURNEY_DIMENSION_ACTIVE = true
 */
async function computeJourneyEngagement(
  organizationId: string
): Promise<DimensionScore | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data } = await (supabase as any)
      .from('journey_analytics')
      .select('engagement_rate, total_moments_received, total_moments_engaged')
      .eq('client_id', organizationId)
      .maybeSingle();

    if (!data) return null;

    const row = data as {
      engagement_rate: number;
      total_moments_received: number;
      total_moments_engaged: number;
    };

    // Clients with 0 moments received → null (excluded from dimension)
    if (row.total_moments_received === 0) return null;

    const rate = row.engagement_rate; // already 0.0–1.0 from the view
    const score = Math.round(Math.min(100, rate * 100));

    return {
      score,
      raw_value: rate,
      description: `Engaged with ${row.total_moments_engaged} of ${row.total_moments_received} journey moment${row.total_moments_received !== 1 ? 's' : ''}`,
    };
  } catch {
    return null; // Safe default — shadow dimension must not break Health Score
  }
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

  // Run all six core dimensions + shadow dimension in parallel
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
    computeJourneyEngagement(organizationId), // SYN-679 shadow dimension
  ]);

  const dimensions: HealthScoreDimensions = {
    content_consistency,
    engagement_trajectory,
    review_responsiveness,
    authority_momentum,
    advisor_engagement,
    platform_usage,
  };

  const shadowDimensions: ShadowDimensions = { journey_engagement };

  // Build score map and effective weights
  // When JOURNEY_DIMENSION_ACTIVE: include journey at 10%, scale existing 6 to 90%
  const scoreMap: Record<string, number | null> = {
    content_consistency: content_consistency?.score ?? null,
    engagement_trajectory: engagement_trajectory?.score ?? null,
    review_responsiveness: review_responsiveness?.score ?? null,
    authority_momentum: authority_momentum?.score ?? null,
    advisor_engagement: advisor_engagement?.score ?? null,
    platform_usage: platform_usage.score, // never null
  };

  const effectiveWeights: Record<string, number> = JOURNEY_DIMENSION_ACTIVE
    ? {
        ...Object.fromEntries(
          Object.entries(weights).map(([k, v]) => [k, v * (1 - JOURNEY_DIMENSION_WEIGHT)])
        ),
        journey_engagement: JOURNEY_DIMENSION_WEIGHT,
      }
    : { ...weights };

  if (JOURNEY_DIMENSION_ACTIVE) {
    scoreMap.journey_engagement = journey_engagement?.score ?? null;
  }

  const overallScore = weightedAverage(scoreMap, effectiveWeights);

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
      shadowDimensions: result.shadowDimensions as object,
      scoreDelta: result.scoreDelta,
      riskLevel: result.riskLevel,
    },
    create: {
      organizationId: result.organizationId,
      weekStart: result.weekStart,
      overallScore: result.overallScore ?? 0,
      dimensions: result.dimensions as object,
      shadowDimensions: result.shadowDimensions as object,
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
