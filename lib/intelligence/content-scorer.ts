/**
 * Content Scorer — lib/intelligence/content-scorer.ts
 *
 * Computes a weekly Content Score (0–100) for each organisation from:
 *   - ContentPerformanceProfile.confidenceLevel → data availability (0–40 pts)
 *   - ContentImprovementTracking.improvementRate → engagement lift (0–40 pts)
 *   - ContentPerformanceProfile.postCount → volume bonus (0–20 pts)
 *
 * Would persist to `content_score_history`, which has no Prisma model (not
 * provisioned): the week-over-week delta is reported as null (unavailable) and
 * saveContentScore throws ContentScoreHistoryNotProvisionedError instead of
 * dropping the write.
 *
 * @task SYN-664
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Thrown by {@link saveContentScore}: `content_score_history` has no Prisma
 * model, so the computed score cannot be stored.
 */
export class ContentScoreHistoryNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  readonly table = 'content_score_history';

  constructor() {
    super(
      'content_score_history is not provisioned: no table in prisma/schema.prisma, content score not saved'
    );
    this.name = 'ContentScoreHistoryNotProvisionedError';
  }
}

// ── Score computation ─────────────────────────────────────────────────────────

export interface ContentScoreComponents {
  data_availability: number; // 0–40
  engagement_lift: number; // 0–40 (20 = baseline, no change)
  volume_bonus: number; // 0–20
}

export interface ComputedContentScore {
  organizationId: string;
  weekStart: string; // ISO date string YYYY-MM-DD
  score: number;
  /** Change vs previous week; null when the history is unavailable. */
  delta: number | null;
  components: ContentScoreComponents;
  dataPoints: number;
}

/**
 * Compute Content Score for a single organisation.
 * Returns null if the org has no ContentPerformanceProfile (skip).
 */
export async function computeContentScore(
  organizationId: string,
  weekStart: Date
): Promise<ComputedContentScore | null> {
  // 1. Fetch content performance profile
  const profile = await prisma.contentPerformanceProfile.findUnique({
    where: { organizationId },
    select: { confidenceLevel: true, postCount: true },
  });

  if (!profile) return null;

  // 2. Fetch latest improvement tracking row (within last 14 days)
  const cutoff = new Date(weekStart.getTime() - 14 * 24 * 60 * 60 * 1000);
  const improvement = await prisma.contentImprovementTracking.findFirst({
    where: {
      organizationId,
      weekStart: { gte: cutoff },
    },
    orderBy: { weekStart: 'desc' },
    select: { improvementRate: true },
  });

  // 3. Component scoring
  const dataAvailability = Math.round(
    Math.min(40, profile.confidenceLevel * 40)
  );

  // Improvement rate: null/0 → 20 (baseline); positive → up to 40; negative → down to 0
  const improvementRate = improvement?.improvementRate ?? null;
  const engagementLift =
    improvementRate === null
      ? 20
      : Math.round(Math.max(0, Math.min(40, improvementRate * 100 + 20)));

  const volumeBonus = Math.min(20, Math.round(profile.postCount / 5));

  const score = dataAvailability + engagementLift + volumeBonus;
  const components: ContentScoreComponents = {
    data_availability: dataAvailability,
    engagement_lift: engagementLift,
    volume_bonus: volumeBonus,
  };

  // 4. Delta vs previous week needs content_score_history, which is not
  // provisioned — report it as unavailable (null), never as "no change".
  const delta: number | null = null;

  return {
    organizationId,
    weekStart: weekStart.toISOString().substring(0, 10),
    score,
    delta,
    components,
    dataPoints: profile.postCount,
  };
}

/**
 * Persist a computed content score to `content_score_history` and the
 * `score_accuracy_events` ledger. The history table is not provisioned, so this
 * throws {@link ContentScoreHistoryNotProvisionedError}; the ledger is not
 * written for a score that was not saved.
 */
export async function saveContentScore(
  computed: ComputedContentScore
): Promise<void> {
  logger.warn(
    'content-scorer: content_score_history not provisioned — score not saved',
    {
      organizationId: computed.organizationId,
    }
  );
  throw new ContentScoreHistoryNotProvisionedError();
}
