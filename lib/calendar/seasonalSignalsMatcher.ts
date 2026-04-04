/**
 * seasonalSignalsMatcher — lib/calendar/seasonalSignalsMatcher.ts
 *
 * Fetches upcoming seasonal market opportunity signals for an organisation
 * and converts them into CalendarSlot stubs for injection into the weekly
 * auto-calendar (SYN-549).
 *
 * Rules:
 *  - Only signals with confidence_score >= 70 and window_start within 14 days
 *  - Max 2 market opportunity slots per weekly calendar
 *  - Dismissed signals (per-org) are excluded
 *  - Timing: T-10 days before window_start (awareness); if that falls before
 *    weekStart, fall back to weekStart itself
 *
 * @task SYN-549
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { CalendarPlatform, CalendarSlot } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_MARKET_OPPORTUNITY_SLOTS = 2;
const MIN_CONFIDENCE = 70;
const LOOKAHEAD_DAYS = 14;
/** Days before window_start to schedule the awareness post */
const AWARENESS_DAYS_BEFORE = 10;
/** Default platform for market opportunity slots */
const DEFAULT_PLATFORM: CalendarPlatform = 'instagram';
/** Default posting hour UTC (10:00 UTC = 20:00 AEDT) */
const DEFAULT_HOUR_UTC = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeasonalSignalRow {
  id: string;
  opportunity_label: string;
  window_start: Date;
  window_end: Date;
  signal_type: string;
  confidence_score: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map signal_type to a suggested post format */
function suggestFormat(signalType: string): 'image' | 'text' {
  // Trend spikes → text (timely, conversational); everything else → image
  return signalType === 'trend_spike' ? 'text' : 'image';
}

/**
 * Compute the scheduled post time:
 * T-10 days before window_start, clamped to weekStart if that would be in the past.
 */
function computeSlotTime(windowStart: Date, weekStart: Date): Date {
  const target = new Date(windowStart);
  target.setUTCDate(target.getUTCDate() - AWARENESS_DAYS_BEFORE);
  target.setUTCHours(DEFAULT_HOUR_UTC, 0, 0, 0);

  // If T-10 is before weekStart, post at the start of the week instead
  if (target < weekStart) {
    const fallback = new Date(weekStart);
    fallback.setUTCHours(DEFAULT_HOUR_UTC, 0, 0, 0);
    return fallback;
  }
  return target;
}

/** Convert a UTC Date to dayOfWeek (0=Monday … 6=Sunday) */
function toDayOfWeek(date: Date): number {
  const utcDay = date.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  return utcDay === 0 ? 6 : utcDay - 1; // Mon=0 … Sun=6
}

/** Best-effort parse locationState from the org's aiGeneratedData JSON blob */
function parseLocationState(aiGeneratedData: unknown): string {
  if (!aiGeneratedData || typeof aiGeneratedData !== 'object') return 'AU';
  const data = aiGeneratedData as Record<string, unknown>;
  const state =
    (data.locationState as string | undefined) ??
    (data.state as string | undefined) ??
    (data.location_state as string | undefined);
  return state && state.length >= 2 ? state.toUpperCase() : 'AU';
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Return up to MAX_MARKET_OPPORTUNITY_SLOTS CalendarSlot stubs for upcoming
 * seasonal market opportunities relevant to this org.
 *
 * Returns an empty array (not an error) when:
 *  - No signals match the org's industry+state
 *  - All matching signals have been dismissed
 *  - Any DB query fails (graceful degradation)
 */
export async function getMarketOpportunitySlots(
  organizationId: string,
  weekStart: Date
): Promise<Omit<CalendarSlot, 'captions'>[]> {
  try {
    // 1. Org context — industry + location state
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { industry: true, aiGeneratedData: true },
    });

    const industrySlug = (org?.industry ?? 'general')
      .toLowerCase()
      .replace(/\s+/g, '-');
    const locationState = parseLocationState(org?.aiGeneratedData);

    // 2. Dismissed signal IDs for this org
    const dismissals = await prisma.seasonalSignalDismissal.findMany({
      where: { organizationId },
      select: { signalId: true },
    });
    const dismissedIds = new Set(dismissals.map(d => d.signalId));

    // 3. Lookahead window: weekStart … weekStart + 14 days
    const lookaheadEnd = new Date(weekStart);
    lookaheadEnd.setUTCDate(lookaheadEnd.getUTCDate() + LOOKAHEAD_DAYS);

    // 4. Query signals via raw SQL (the get_seasonal_signals function
    //    handles AU-national fallback internally, but we also pass
    //    locationState here for the direct table query)
    const rows = await prisma.$queryRaw<SeasonalSignalRow[]>`
      SELECT id, opportunity_label, window_start, window_end,
             signal_type, confidence_score
      FROM   seasonal_signals
      WHERE  industry_slug = ${industrySlug}
        AND  location_state IN (${locationState}, 'AU')
        AND  confidence_score >= ${MIN_CONFIDENCE}
        AND  window_start BETWEEN ${weekStart} AND ${lookaheadEnd}
      ORDER  BY confidence_score DESC, window_start ASC
      LIMIT  10
    `;

    // 5. Build slots — skip dismissed, cap at MAX_MARKET_OPPORTUNITY_SLOTS
    const slots: Omit<CalendarSlot, 'captions'>[] = [];

    for (const row of rows) {
      if (dismissedIds.has(row.id)) continue;
      if (slots.length >= MAX_MARKET_OPPORTUNITY_SLOTS) break;

      const scheduledAt = computeSlotTime(row.window_start, weekStart);

      slots.push({
        id: crypto.randomUUID(),
        dayOfWeek: toDayOfWeek(scheduledAt),
        scheduledAt: scheduledAt.toISOString(),
        platform: DEFAULT_PLATFORM,
        hashtags: [],
        contentType: 'promotional',
        slotType: 'market_opportunity',
        signalId: row.id,
        opportunityLabel: row.opportunity_label,
        suggestedFormat: suggestFormat(row.signal_type),
      });
    }

    logger.info('seasonalSignalsMatcher: slots resolved', {
      organizationId,
      industrySlug,
      locationState,
      signalsFound: rows.length,
      slotsInserted: slots.length,
    });

    return slots;
  } catch (err) {
    // Non-fatal — calendar generation must not fail due to missing signals
    logger.warn('seasonalSignalsMatcher: failed (graceful skip)', {
      organizationId,
      error: err,
    });
    return [];
  }
}
