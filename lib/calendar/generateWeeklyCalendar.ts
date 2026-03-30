/**
 * generateWeeklyCalendar — lib/calendar/generateWeeklyCalendar.ts
 *
 * Main orchestrator for the weekly content calendar auto-generation engine.
 *
 * Flow:
 *  1. Cold-start gate — requires MIN_DIGESTS_REQUIRED completed weekly digests
 *  2. Read digest signals (topContentTypes, peakHours, winningHashtags, platforms)
 *  3. Schedule 7 posting slots across the coming week
 *  4. Generate 3 caption variations per slot via Claude haiku-4-5
 *  5. Upsert ContentCalendar record with status 'draft'
 *  6. Return CalendarGenerationResult
 *
 * The generator is designed to be called from the Sunday-evening cron job
 * (app/api/cron/generate-calendars/route.ts) and completes in < 60s per client.
 *
 * @task SYN-521
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { readDigestSignals, MIN_DIGESTS_REQUIRED } from './digestReader';
import {
  scheduleSlotsForWeek,
  nextMondayFrom,
  weekEndFromStart,
} from './slotScheduler';
import { generateCaptions } from './captionGenerator';
import type {
  CalendarGenerationResult,
  CalendarSlot,
  ContentCalendarData,
} from './types';
import { InsufficientDigestsError } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SIGNALS_VERSION = '1.0';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a Date as 'YYYY-MM-DD' (UTC) */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Fetch BrandDNA voice tone + businessName for caption context */
async function getBrandContext(organizationId: string) {
  const [org, brandDna] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, industry: true },
    }),
    prisma.brandDNA.findUnique({
      where: { organizationId },
      select: { businessName: true, brandVoice: true },
    }),
  ]);

  const brandVoice = brandDna?.brandVoice as
    | { tone?: string }
    | null
    | undefined;

  return {
    businessName: brandDna?.businessName ?? org?.name ?? 'Our Business',
    industry: org?.industry ?? 'General',
    tone: brandVoice?.tone ?? 'professional and approachable',
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a weekly content calendar for the given organisation.
 *
 * Throws `InsufficientDigestsError` if the cold-start gate is not met.
 * All other errors are caught and returned as `{ success: false, reason }`.
 */
export async function generateWeeklyCalendar(
  organizationId: string,
  /** Override the target week start (defaults to next Monday) */
  weekStartOverride?: Date
): Promise<CalendarGenerationResult> {
  try {
    // ── 1. Cold-start gate ──────────────────────────────────────────────────
    const signals = await readDigestSignals(organizationId);

    if (signals.digestCount < MIN_DIGESTS_REQUIRED) {
      throw new InsufficientDigestsError(
        organizationId,
        signals.digestCount,
        MIN_DIGESTS_REQUIRED
      );
    }

    // ── 2. Determine target week ────────────────────────────────────────────
    const weekStart = weekStartOverride ?? nextMondayFrom(new Date());
    const weekEnd = weekEndFromStart(weekStart);

    logger.info('generateWeeklyCalendar: generating', {
      organizationId,
      weekStart: toDateString(weekStart),
      digestCount: signals.digestCount,
      platforms: signals.activePlatforms,
    });

    // ── 3. Schedule 7 slot stubs ────────────────────────────────────────────
    const slotStubs = scheduleSlotsForWeek(weekStart, signals);

    // ── 4. Fetch brand context for captions ─────────────────────────────────
    const brandCtx = await getBrandContext(organizationId);

    // ── 5. Generate captions for each slot (sequential to respect rate limits)
    const slots: CalendarSlot[] = [];
    for (const stub of slotStubs) {
      const captions = await generateCaptions(
        {
          platform: stub.platform,
          contentType: stub.contentType,
          businessName: brandCtx.businessName,
          industry: brandCtx.industry,
          tone: brandCtx.tone,
          hashtags: stub.hashtags,
        },
        organizationId
      );
      slots.push({ ...stub, captions });
    }

    // ── 6. Build calendar data ───────────────────────────────────────────────
    const calendarData: ContentCalendarData = {
      weekStart: toDateString(weekStart),
      weekEnd: toDateString(weekEnd),
      slots,
      signalsVersion: SIGNALS_VERSION,
      digestCount: signals.digestCount,
    };

    // ── 7. Upsert ContentCalendar record ────────────────────────────────────
    const record = await prisma.contentCalendar.upsert({
      where: {
        organizationId_weekStart: {
          organizationId,
          weekStart,
        },
      },
      create: {
        organizationId,
        weekStart,
        weekEnd,
        slots: calendarData as unknown as Parameters<
          typeof prisma.contentCalendar.create
        >[0]['data']['slots'],
        status: 'draft',
        signalsVersion: SIGNALS_VERSION,
      },
      update: {
        slots: calendarData as unknown as Parameters<
          typeof prisma.contentCalendar.create
        >[0]['data']['slots'],
        weekEnd,
        status: 'draft',
        signalsVersion: SIGNALS_VERSION,
        updatedAt: new Date(),
      },
    });

    logger.info('generateWeeklyCalendar: done', {
      organizationId,
      calendarId: record.id,
      slotsGenerated: slots.length,
    });

    return { success: true, organizationId, calendarId: record.id };
  } catch (err) {
    if (err instanceof InsufficientDigestsError) {
      // Re-throw for callers that want to distinguish this case
      throw err;
    }
    const reason = err instanceof Error ? err.message : String(err);
    logger.error('generateWeeklyCalendar: failed', {
      organizationId,
      error: err,
    });
    return { success: false, organizationId, reason };
  }
}
