/**
 * Improvement tracker — lib/content-intelligence/improvement-tracker.ts
 *
 * Computes and persists ContentImprovementTracking for the previous week.
 * Compares engagement rates between:
 *   - "Informed" slots: CalendarSlot.generationContext.intelligenceApplied = true
 *   - "Baseline" slots: generationContext is absent or intelligenceApplied = false
 *
 * Called by compute-content-profiles cron after profile computation completes.
 *
 * Matching strategy: PublishQueueItem.slotId → CalendarSlot JSONB → PlatformPost
 * via organizationId + platform + publishedAt within a ±30-min window of scheduledAt.
 *
 * SYN-632
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { SlotGenerationContext } from '@/lib/calendar/types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Published posts must be within this many minutes of the scheduled time */
const MATCH_WINDOW_MINUTES = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

interface EngagementBucket {
  total: number;
  count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lastWeekWindow(): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  // Set to last Monday
  const dayOfWeek = end.getUTCDay(); // 0=Sun … 6=Sat
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  end.setUTCDate(end.getUTCDate() - daysToLastMonday);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

function withinWindow(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= MATCH_WINDOW_MINUTES * 60 * 1000;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface ImprovementTrackResult {
  organizationId: string;
  weekStart: string;
  informedCount: number;
  baselineCount: number;
  improvementRate: number | null;
  skipped: boolean;
  reason?: string;
}

/**
 * Computes and upserts ContentImprovementTracking for the previous week.
 * Non-fatal — any DB error is logged and skipped.
 */
export async function trackImprovementForOrg(
  organizationId: string
): Promise<ImprovementTrackResult> {
  const { start, end } = lastWeekWindow();
  const weekStartIso = start.toISOString().split('T')[0]!;

  try {
    // 1. Find last week's ContentCalendar for this org
    const calendar = await prisma.contentCalendar.findFirst({
      where: {
        organizationId,
        weekStart: { gte: start, lt: end },
      },
      select: { id: true, slots: true },
    });

    if (!calendar) {
      return { organizationId, weekStart: weekStartIso, informedCount: 0, baselineCount: 0, improvementRate: null, skipped: true, reason: 'no_calendar' };
    }

    // 2. Parse slots JSONB and build slotId → generationContext map
    const calendarData = calendar.slots as unknown as {
      slots?: Array<{ id: string; generationContext?: SlotGenerationContext }>;
    };
    const rawSlots = calendarData.slots ?? [];
    const slotContextMap = new Map<string, SlotGenerationContext | null>();
    for (const slot of rawSlots) {
      slotContextMap.set(slot.id, slot.generationContext ?? null);
    }

    if (slotContextMap.size === 0) {
      return { organizationId, weekStart: weekStartIso, informedCount: 0, baselineCount: 0, improvementRate: null, skipped: true, reason: 'no_slots' };
    }

    // 3. Fetch published queue items for this calendar
    const queueItems = await prisma.publishQueueItem.findMany({
      where: {
        calendarId: calendar.id,
        status: 'published',
        publishedAt: { not: null },
      },
      select: { slotId: true, platform: true, scheduledAt: true, publishedAt: true },
    });

    if (queueItems.length === 0) {
      return { organizationId, weekStart: weekStartIso, informedCount: 0, baselineCount: 0, improvementRate: null, skipped: true, reason: 'no_published_items' };
    }

    // 4. For each published queue item, find matching PlatformPost and get metrics
    const informed: EngagementBucket = { total: 0, count: 0 };
    const baseline: EngagementBucket = { total: 0, count: 0 };
    const signalsUsed: string[] = [];

    for (const item of queueItems) {
      const ctx = slotContextMap.get(item.slotId);
      const isInformed = ctx?.intelligenceApplied === true;

      if (isInformed && ctx) {
        // Collect the topics used as signal descriptions
        for (const topic of ctx.topicsUsed) {
          if (!signalsUsed.includes(topic)) signalsUsed.push(topic);
        }
      }

      // Match published post via platform + time window
      const publishedAt = item.publishedAt!;
      const post = await prisma.platformPost.findFirst({
        where: {
          connection: { organizationId, platform: item.platform },
          publishedAt: {
            gte: new Date(publishedAt.getTime() - MATCH_WINDOW_MINUTES * 60 * 1000),
            lte: new Date(publishedAt.getTime() + MATCH_WINDOW_MINUTES * 60 * 1000),
          },
          deletedAt: null,
        },
        include: {
          metrics: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!post || !withinWindow(post.publishedAt!, publishedAt)) continue;

      const engagementRate = post.metrics[0]?.engagementRate ?? null;
      if (engagementRate === null) continue;

      if (isInformed) {
        informed.total += engagementRate;
        informed.count++;
      } else {
        baseline.total += engagementRate;
        baseline.count++;
      }
    }

    const informedAvg = informed.count > 0 ? informed.total / informed.count : null;
    const baselineAvg = baseline.count > 0 ? baseline.total / baseline.count : null;

    let improvementRate: number | null = null;
    if (informedAvg !== null && baselineAvg !== null && baselineAvg > 0) {
      improvementRate = (informedAvg - baselineAvg) / baselineAvg;
    }

    // 5. Upsert ContentImprovementTracking
    await prisma.contentImprovementTracking.upsert({
      where: {
        content_improvement_dedup: {
          organizationId,
          weekStart: start,
        },
      },
      create: {
        organizationId,
        weekStart: start,
        informedAvgEngagement: informedAvg,
        baselineAvgEngagement: baselineAvg,
        improvementRate,
        intelligenceSignalsUsed: signalsUsed,
      },
      update: {
        informedAvgEngagement: informedAvg,
        baselineAvgEngagement: baselineAvg,
        improvementRate,
        intelligenceSignalsUsed: signalsUsed,
      },
    });

    logger.info('improvement-tracker: computed', {
      organizationId,
      weekStart: weekStartIso,
      informedCount: informed.count,
      baselineCount: baseline.count,
      improvementRate,
    });

    return {
      organizationId,
      weekStart: weekStartIso,
      informedCount: informed.count,
      baselineCount: baseline.count,
      improvementRate,
      skipped: false,
    };
  } catch (err) {
    logger.warn('improvement-tracker: failed', {
      organizationId,
      weekStart: weekStartIso,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      organizationId,
      weekStart: weekStartIso,
      informedCount: 0,
      baselineCount: 0,
      improvementRate: null,
      skipped: true,
      reason: 'error',
    };
  }
}
