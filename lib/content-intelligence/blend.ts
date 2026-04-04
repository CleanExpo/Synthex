/**
 * Content intelligence blending — SYN-631
 *
 * Merges an org's own ContentPerformanceProfile with the matching IndustryBaseline
 * using a confidence-weighted formula.
 *
 * Formula:
 *   blended = (confidenceLevel × orgProfile) + ((1 - confidenceLevel) × baseline)
 *
 * confidenceLevel = min(1.0, postCount / 60)
 *   0 posts  → 0.0  — rely 100% on industry baseline
 *   30 posts → 0.5  — equal weight
 *   60 posts → 1.0  — rely 100% on org profile
 */

import type {
  BlendedContentIntelligence,
  ContentFormat,
  ContentFormatScores,
  ContentProfile,
  OptimalTimes,
  TopicScore,
} from './types';

export const CONFIDENCE_POST_THRESHOLD = 60;

// ── Confidence formula ────────────────────────────────────────────────────────

export function computeConfidenceLevel(postCount: number): number {
  return Math.min(1.0, postCount / CONFIDENCE_POST_THRESHOLD);
}

// ── Per-field merging ─────────────────────────────────────────────────────────

/**
 * Merges two TopicScore arrays by topic name, weighted by alpha.
 * alpha = confidenceLevel (org weight); (1 - alpha) = baseline weight.
 */
export function blendTopics(
  orgTopics: TopicScore[],
  baselineTopics: TopicScore[],
  alpha: number
): TopicScore[] {
  const map = new Map<string, TopicScore>();

  for (const t of baselineTopics) {
    map.set(t.topic, {
      topic: t.topic,
      avgEngagementRate: t.avgEngagementRate * (1 - alpha),
      postCount: t.postCount,
    });
  }

  for (const t of orgTopics) {
    const existing = map.get(t.topic);
    if (existing) {
      map.set(t.topic, {
        topic: t.topic,
        avgEngagementRate:
          existing.avgEngagementRate + t.avgEngagementRate * alpha,
        postCount: t.postCount,
      });
    } else {
      map.set(t.topic, {
        topic: t.topic,
        avgEngagementRate: t.avgEngagementRate * alpha,
        postCount: t.postCount,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.avgEngagementRate - a.avgEngagementRate
  );
}

/**
 * Merges two OptimalTimes maps by taking the union of keys and deduping times.
 * Org times are favoured when alpha >= 0.5; baseline times fill gaps when alpha < 0.5.
 */
export function blendOptimalTimes(
  orgTimes: OptimalTimes,
  baselineTimes: OptimalTimes,
  alpha: number
): OptimalTimes {
  const days = new Set([
    ...Object.keys(orgTimes),
    ...Object.keys(baselineTimes),
  ]);

  const result: OptimalTimes = {};
  for (const day of days) {
    const orgDay = orgTimes[day] ?? [];
    const baselineDay = baselineTimes[day] ?? [];
    // Prefer org times when confident; fill with baseline when not
    result[day] = alpha >= 0.5
      ? orgDay.length > 0 ? orgDay : baselineDay
      : baselineDay.length > 0 ? baselineDay : orgDay;
  }
  return result;
}

/**
 * Merges two hashtag arrays. Org-specific hashtags are weighted by alpha;
 * returns deduplicated list preserving order (org first, then baseline fill).
 */
export function blendHashtags(
  orgHashtags: string[],
  baselineHashtags: string[],
  alpha: number
): string[] {
  // At full confidence, use only org hashtags; at zero, only baseline.
  // Otherwise merge, keeping org-sourced items first.
  if (alpha >= 1.0) return orgHashtags;
  if (alpha <= 0.0) return baselineHashtags;

  const seen = new Set<string>();
  const result: string[] = [];

  for (const h of orgHashtags) {
    if (!seen.has(h)) { seen.add(h); result.push(h); }
  }
  for (const h of baselineHashtags) {
    if (!seen.has(h)) { seen.add(h); result.push(h); }
  }
  return result;
}

/**
 * Blends per-format engagement scores using a weighted average.
 */
export function blendFormatScores(
  orgScores: ContentFormatScores,
  baselineScores: ContentFormatScores,
  alpha: number
): ContentFormatScores {
  const formats: ContentFormat[] = ['video', 'image', 'carousel', 'text'];
  const result = {} as ContentFormatScores;

  for (const fmt of formats) {
    const orgVal = orgScores[fmt] ?? 0;
    const baselineVal = baselineScores[fmt] ?? 0;
    result[fmt] = orgVal * alpha + baselineVal * (1 - alpha);
  }
  return result;
}

// ── Main blend function ───────────────────────────────────────────────────────

/**
 * Returns a BlendedContentIntelligence for the given org.
 * Pass an empty profile and/or baseline to fall back gracefully.
 */
export function blendProfiles(opts: {
  orgProfile: ContentProfile;
  baseline: ContentProfile;
  postCount: number;
  industry: string;
}): BlendedContentIntelligence {
  const { orgProfile, baseline, postCount, industry } = opts;
  const alpha = computeConfidenceLevel(postCount);

  return {
    confidenceLevel: alpha,
    postCount,
    industry,
    topTopics: blendTopics(orgProfile.topTopics, baseline.topTopics, alpha),
    optimalTimes: blendOptimalTimes(
      orgProfile.optimalTimes,
      baseline.optimalTimes,
      alpha
    ),
    winningHashtags: blendHashtags(
      orgProfile.winningHashtags,
      baseline.winningHashtags,
      alpha
    ),
    contentFormatScores: blendFormatScores(
      orgProfile.contentFormatScores,
      baseline.contentFormatScores,
      alpha
    ),
  };
}
