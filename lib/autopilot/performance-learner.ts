/**
 * Autopilot Performance Learner
 *
 * @description Weekly feedback loop that analyses published autopilot post
 * performance and adjusts the content mix weights accordingly.
 *
 * Flow:
 *   1. Query last week's published autopilot posts + their engagement metrics
 *   2. Group by theme → calculate avg engagement per theme
 *   3. Boost high-performing themes, reduce low-performing ones
 *   4. Update AutopilotConfig.contentMix
 *   5. Identify top posts for repurposing queue
 *
 * @module lib/autopilot/performance-learner
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normaliseMix } from './content-strategy';
import type {
  ContentMix,
  ContentTheme,
  WeeklyPerformanceSummary,
} from './types';
import { DEFAULT_CONTENT_MIX } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum percentage shift per theme per week (prevents wild swings) */
const MAX_SHIFT_PER_THEME = 5;

/** Minimum posts required per theme to count as statistically meaningful */
const MIN_POSTS_PER_THEME = 2;

// ============================================================================
// WEEKLY LEARNING
// ============================================================================

/**
 * Run the weekly performance learning loop for an organisation.
 *
 * @param organizationId - The org to analyse
 * @returns Summary of what was learned and any mix adjustments made
 */
export async function learnFromPerformance(
  organizationId: string
): Promise<WeeklyPerformanceSummary | null> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Load the current config
  const config = await prisma.autopilotConfig.findUnique({
    where: { organizationId },
  });

  if (!config || !config.enabled) {
    logger.info('[autopilot:learner] Skipping — autopilot not enabled', {
      orgId: organizationId,
    });
    return null;
  }

  // Query published autopilot posts from the last week
  const posts = await prisma.post.findMany({
    where: {
      campaign: { organizationId },
      status: 'published',
      publishedAt: { gte: weekAgo, lte: now },
      deletedAt: null,
    },
    select: {
      id: true,
      platform: true,
      metadata: true,
      analytics: true,
      publishedAt: true,
    },
  });

  // Filter to autopilot-generated posts only
  const autopilotPosts = posts.filter(p => {
    const meta = p.metadata as Record<string, unknown> | null;
    return meta?.source === 'autopilot';
  });

  if (autopilotPosts.length === 0) {
    logger.info('[autopilot:learner] No published autopilot posts last week', {
      orgId: organizationId,
    });
    return null;
  }

  // Group by theme and calculate engagement
  const themePerformance: Record<
    ContentTheme,
    { count: number; totalEngagement: number }
  > = {} as Record<ContentTheme, { count: number; totalEngagement: number }>;
  const topPosts: Array<{ id: string; engagement: number }> = [];

  for (const post of autopilotPosts) {
    const meta = post.metadata as Record<string, unknown> | null;
    const analytics = post.analytics as Record<string, unknown> | null;
    const theme = (meta?.theme as ContentTheme) ?? 'educational';

    // Calculate engagement from analytics (likes + comments + shares)
    const likes = Number(analytics?.likes ?? 0);
    const comments = Number(analytics?.comments ?? 0);
    const shares = Number(analytics?.shares ?? 0);
    const impressions = Number(analytics?.impressions ?? 1);
    const engagement =
      impressions > 0 ? ((likes + comments + shares) / impressions) * 100 : 0;

    if (!themePerformance[theme]) {
      themePerformance[theme] = { count: 0, totalEngagement: 0 };
    }
    themePerformance[theme].count++;
    themePerformance[theme].totalEngagement += engagement;

    topPosts.push({ id: post.id, engagement });
  }

  // Calculate average engagement per theme
  const themeAvgs: Record<
    ContentTheme,
    { count: number; avgEngagement: number }
  > = {} as Record<ContentTheme, { count: number; avgEngagement: number }>;
  for (const [theme, data] of Object.entries(themePerformance)) {
    themeAvgs[theme as ContentTheme] = {
      count: data.count,
      avgEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
    };
  }

  // Sort top posts by engagement
  topPosts.sort((a, b) => b.engagement - a.engagement);
  const topPostIds = topPosts.slice(0, 5).map(p => p.id);

  // Adjust content mix based on performance
  const currentMix = (config.contentMix as ContentMix) ?? DEFAULT_CONTENT_MIX;
  const adjustedMix = adjustMix(currentMix, themeAvgs);

  // Persist the adjusted mix
  await prisma.autopilotConfig.update({
    where: { organizationId },
    data: { contentMix: adjustedMix as object },
  });

  const avgEngagement =
    autopilotPosts.length > 0
      ? topPosts.reduce((s, p) => s + p.engagement, 0) / topPosts.length
      : 0;

  logger.info('[autopilot:learner] Weekly learning complete', {
    orgId: organizationId,
    postsAnalysed: autopilotPosts.length,
    themesTracked: Object.keys(themeAvgs).length,
    topPostIds,
    avgEngagement: avgEngagement.toFixed(2),
  });

  return {
    organizationId,
    period: { start: weekAgo, end: now },
    totalPosts: autopilotPosts.length,
    avgEngagement,
    themePerformance: themeAvgs,
    topPostIds,
    adjustedMix,
  };
}

// ============================================================================
// MIX ADJUSTMENT
// ============================================================================

/**
 * Adjust content mix weights based on theme performance.
 *
 * High-performing themes get a boost; low-performing themes get reduced.
 * Changes are capped at MAX_SHIFT_PER_THEME per cycle to prevent oscillation.
 */
function adjustMix(
  currentMix: ContentMix,
  themeAvgs: Record<ContentTheme, { count: number; avgEngagement: number }>
): ContentMix {
  const themes = Object.keys(currentMix) as ContentTheme[];

  // If not enough data points, return unchanged
  const totalMeasured = Object.values(themeAvgs).reduce(
    (s, t) => s + t.count,
    0
  );
  if (totalMeasured < 5) return currentMix;

  // Calculate overall average engagement
  const overallAvg =
    Object.values(themeAvgs)
      .filter(t => t.count >= MIN_POSTS_PER_THEME)
      .reduce((s, t) => s + t.avgEngagement, 0) /
    Math.max(
      1,
      Object.values(themeAvgs).filter(t => t.count >= MIN_POSTS_PER_THEME)
        .length
    );

  const adjusted: ContentMix = { ...currentMix };

  for (const theme of themes) {
    const perf = themeAvgs[theme];
    if (!perf || perf.count < MIN_POSTS_PER_THEME) continue;

    const current = adjusted[theme] ?? 0;
    const ratio = overallAvg > 0 ? perf.avgEngagement / overallAvg : 1;

    // Scale shift: above average → positive, below → negative
    let shift = 0;
    if (ratio > 1.1) {
      shift = Math.min(MAX_SHIFT_PER_THEME, Math.round((ratio - 1) * 10));
    } else if (ratio < 0.9) {
      shift = -Math.min(MAX_SHIFT_PER_THEME, Math.round((1 - ratio) * 10));
    }

    // Clamp: never go below 5% or above 50%
    adjusted[theme] = Math.max(5, Math.min(50, current + shift));
  }

  return normaliseMix(adjusted);
}
