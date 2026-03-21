/**
 * Autopilot Daily Planner
 *
 * @description Determines what content needs generating each day.
 * Analyses existing scheduled/draft posts, identifies gaps in the
 * planning horizon, and produces a list of content slots to fill.
 *
 * Used by the daily cron job to maintain continuous autopilot output.
 *
 * @module lib/autopilot/daily-planner
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { allocateSlots } from './content-strategy';
import type { ContentMix, ContentTheme, PlannerOutput } from './types';
import { DEFAULT_CONTENT_MIX } from './types';

// ============================================================================
// DAILY PLANNING
// ============================================================================

/**
 * Analyse existing content coverage and determine gaps for an organisation.
 *
 * @param organizationId - The org to plan for
 * @param platforms - Active autopilot platforms
 * @param horizonDays - How many days ahead to plan (default 7)
 * @param postsPerDayPerPlatform - Target posts per platform per day (default 1)
 * @param contentMix - Target content mix weights
 */
export async function planDailyContent(
  organizationId: string,
  platforms: string[],
  horizonDays = 7,
  postsPerDayPerPlatform = 1,
  contentMix?: ContentMix
): Promise<PlannerOutput> {
  const now = new Date();
  const horizonEnd = new Date(now);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  // Query existing posts (scheduled or draft) within the planning horizon
  const existingPosts = await prisma.post.findMany({
    where: {
      campaign: { organizationId },
      status: { in: ['scheduled', 'draft'] },
      scheduledAt: { gte: now, lte: horizonEnd },
      platform: { in: platforms },
      deletedAt: null,
    },
    select: {
      platform: true,
      scheduledAt: true,
      metadata: true,
    },
  });

  logger.info('[autopilot:planner] Existing posts in horizon', {
    orgId: organizationId,
    count: existingPosts.length,
    horizonDays,
  });

  // Build a coverage map: platform → date → count
  const coverage = new Map<string, Map<string, number>>();
  const recentThemes: ContentTheme[] = [];

  for (const post of existingPosts) {
    if (!post.scheduledAt) continue;
    const dateKey = post.scheduledAt.toISOString().split('T')[0]!;
    const platformMap =
      coverage.get(post.platform) ?? new Map<string, number>();
    platformMap.set(dateKey, (platformMap.get(dateKey) ?? 0) + 1);
    coverage.set(post.platform, platformMap);

    // Extract theme from metadata for mix continuity
    const meta = post.metadata as Record<string, unknown> | null;
    if (meta?.theme && typeof meta.theme === 'string') {
      recentThemes.push(meta.theme as ContentTheme);
    }
  }

  // Identify gaps: days × platforms where we're below target
  const gapPlatforms: string[] = [];
  let totalNeeded = 0;

  for (let day = 0; day < horizonDays; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day + 1);
    const dateKey = date.toISOString().split('T')[0]!;

    for (const platform of platforms) {
      const existing = coverage.get(platform)?.get(dateKey) ?? 0;
      const needed = postsPerDayPerPlatform - existing;

      if (needed > 0) {
        // Add platform to gap list (may appear multiple times for multiple days)
        for (let i = 0; i < needed; i++) {
          gapPlatforms.push(platform);
          totalNeeded++;
        }
      }
    }
  }

  if (totalNeeded === 0) {
    logger.info('[autopilot:planner] No gaps detected — fully covered', {
      orgId: organizationId,
    });
    return {
      slots: [],
      totalExisting: existingPosts.length,
      totalNeeded: 0,
    };
  }

  // Allocate themes for the gaps using the content strategy
  const mix = contentMix ?? DEFAULT_CONTENT_MIX;

  // Deduplicate platforms for allocation (we need unique platforms)
  const uniqueGapPlatforms = [...new Set(gapPlatforms)];

  // Re-plan only the gap days, not the full horizon
  const slots = allocateSlots(
    uniqueGapPlatforms,
    horizonDays,
    postsPerDayPerPlatform,
    mix,
    recentThemes
  );

  // Filter to only slots that actually have gaps
  const filteredSlots = slots.filter(slot => {
    const dateKey = slot.date.toISOString().split('T')[0]!;
    const existing = coverage.get(slot.platform)?.get(dateKey) ?? 0;
    return existing < postsPerDayPerPlatform;
  });

  logger.info('[autopilot:planner] Gaps identified', {
    orgId: organizationId,
    totalExisting: existingPosts.length,
    totalNeeded: filteredSlots.length,
  });

  return {
    slots: filteredSlots,
    totalExisting: existingPosts.length,
    totalNeeded: filteredSlots.length,
  };
}
