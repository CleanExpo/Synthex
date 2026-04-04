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
  SlotGenerationContext,
} from './types';
import { InsufficientDigestsError } from './types';
import { getMarketOpportunitySlots } from './seasonalSignalsMatcher';
import { getContentIntelligence } from '@/lib/content-intelligence';
import type { BlendedContentIntelligence } from '@/lib/content-intelligence/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SIGNALS_VERSION_BASE = '1.0';
const SIGNALS_VERSION_WITH_MARKET = '1.1';
/** Calendar generated with content intelligence integration — SYN-632 */
const SIGNALS_VERSION_WITH_INTELLIGENCE = '1.2';

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

// ── Intelligence helpers ──────────────────────────────────────────────────────

/**
 * Builds the SlotGenerationContext for a slot given the intelligence profile.
 * Used to record which signals informed caption generation — SYN-632.
 */
function buildGenerationContext(
  intel: BlendedContentIntelligence,
  profileHashtags: string[]
): SlotGenerationContext {
  const topicsUsed = intel.topTopics.slice(0, 3).map((t) => t.topic);

  let dataSource: SlotGenerationContext['dataSource'];
  if (intel.confidenceLevel <= 0.1) {
    dataSource = 'industry_baseline';
  } else if (intel.confidenceLevel >= 0.9) {
    dataSource = 'client_data';
  } else {
    dataSource = 'blended';
  }

  return {
    intelligenceApplied: true,
    topicsUsed,
    timeOptimised: Object.keys(intel.optimalTimes).length > 0,
    hashtagsFromProfile: profileHashtags,
    confidenceLevel: intel.confidenceLevel,
    dataSource,
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

    // ── 4b. Fetch content intelligence (SYN-632) — non-fatal ────────────────
    let contentIntelligence: BlendedContentIntelligence | null = null;
    try {
      const intel = await getContentIntelligence(organizationId);
      // Only apply intelligence if it has any useful signal (has topics or hashtags)
      if (intel.topTopics.length > 0 || intel.winningHashtags.length > 0) {
        contentIntelligence = intel;
        logger.info('generateWeeklyCalendar: content intelligence applied', {
          organizationId,
          confidenceLevel: intel.confidenceLevel,
          postCount: intel.postCount,
          topTopics: intel.topTopics.slice(0, 3).map((t) => t.topic),
        });
      }
    } catch (err) {
      // Non-fatal — calendar generation continues with existing behaviour
      logger.warn('generateWeeklyCalendar: content intelligence unavailable', {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Intelligence hashtags for profile-sourced slots (top 5 winning hashtags)
    const profileHashtags = contentIntelligence?.winningHashtags.slice(0, 5) ?? [];

    // ── 5. Generate captions for each slot (sequential to respect rate limits)
    const slots: CalendarSlot[] = [];
    for (const stub of slotStubs) {
      // Merge profile hashtags into stub hashtags (profile-sourced first)
      const mergedHashtags = contentIntelligence
        ? [...new Set([...profileHashtags, ...stub.hashtags])].slice(0, 8)
        : stub.hashtags;

      const captions = await generateCaptions(
        {
          platform: stub.platform,
          contentType: stub.contentType,
          businessName: brandCtx.businessName,
          industry: brandCtx.industry,
          tone: brandCtx.tone,
          hashtags: mergedHashtags,
          intelligenceContext: contentIntelligence ?? undefined,
        },
        organizationId
      );

      const generationContext = contentIntelligence
        ? buildGenerationContext(contentIntelligence, profileHashtags)
        : undefined;

      slots.push({ ...stub, captions, hashtags: mergedHashtags, generationContext });
    }

    // ── 5b. Inject market opportunity slots (SYN-549) ────────────────────────
    const marketStubs = await getMarketOpportunitySlots(
      organizationId,
      weekStart
    );
    for (const stub of marketStubs) {
      const captions = await generateCaptions(
        {
          platform: stub.platform,
          contentType: stub.contentType,
          businessName: brandCtx.businessName,
          industry: brandCtx.industry,
          tone: brandCtx.tone,
          hashtags: stub.hashtags,
          opportunityHint: stub.opportunityLabel,
          intelligenceContext: contentIntelligence ?? undefined,
        },
        organizationId
      );

      const generationContext = contentIntelligence
        ? buildGenerationContext(contentIntelligence, profileHashtags)
        : undefined;

      slots.push({ ...stub, captions, generationContext });
    }

    const hasIntelligence = contentIntelligence !== null;
    const hasMarket = marketStubs.length > 0;
    const signalsVersion = hasIntelligence
      ? SIGNALS_VERSION_WITH_INTELLIGENCE
      : hasMarket
        ? SIGNALS_VERSION_WITH_MARKET
        : SIGNALS_VERSION_BASE;


    // ── 6. Build calendar data ───────────────────────────────────────────────
    const calendarData: ContentCalendarData = {
      weekStart: toDateString(weekStart),
      weekEnd: toDateString(weekEnd),
      slots,
      signalsVersion,
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
        signalsVersion,
      },
      update: {
        slots: calendarData as unknown as Parameters<
          typeof prisma.contentCalendar.create
        >[0]['data']['slots'],
        weekEnd,
        status: 'draft',
        signalsVersion,
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
