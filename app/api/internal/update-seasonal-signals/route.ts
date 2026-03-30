/**
 * POST /api/internal/update-seasonal-signals
 *
 * Internal endpoint called by the Supabase Edge Function weekly (Sunday 2 AM AEST).
 * Fetches public holidays from nager.date API, merges static school term windows,
 * and upserts all records into seasonal_signals. Logs the run to seasonal_signal_runs.
 *
 * Auth: Bearer CRON_SECRET
 *
 * @task SYN-547
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const maxDuration = 300;

// ── Types ────────────────────────────────────────────────────────────────────

interface NagerHoliday {
  date: string; // "YYYY-MM-DD"
  name: string;
  counties: string[] | null; // null = national
}

interface SignalRow {
  industrySlug: string;
  locationState: string;
  signalType: string;
  opportunityLabel: string;
  windowStart: Date;
  windowEnd: Date;
  confidenceScore: number;
  source: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AU_STATES = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const YEAR = new Date().getFullYear();

// Static school term back-to-school windows (AU-wide approximation)
const SCHOOL_TERM_WINDOWS = [
  {
    opportunityLabel: 'Back to School — Term 1',
    windowStartMonth: 1,
    windowStartDay: 26,
    windowEndMonth: 2,
    windowEndDay: 7,
    confidenceScore: 85,
  },
  {
    opportunityLabel: 'Back to School — Term 3',
    windowStartMonth: 7,
    windowStartDay: 13,
    windowEndMonth: 7,
    windowEndDay: 25,
    confidenceScore: 80,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Map AU state abbreviation to nager.date county code
function nagerCode(state: string): string {
  const map: Record<string, string> = {
    ACT: 'AU-ACT',
    NSW: 'AU-NSW',
    NT: 'AU-NT',
    QLD: 'AU-QLD',
    SA: 'AU-SA',
    TAS: 'AU-TAS',
    VIC: 'AU-VIC',
    WA: 'AU-WA',
  };
  return map[state] ?? `AU-${state}`;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchPublicHolidays(year: number): Promise<NagerHoliday[]> {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/AU`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`nager.date ${res.status}: ${await res.text()}`);
  return res.json() as Promise<NagerHoliday[]>;
}

// ── Signal builders ───────────────────────────────────────────────────────────

function buildHolidaySignals(
  holidays: NagerHoliday[],
  year: number
): SignalRow[] {
  const signals: SignalRow[] = [];

  for (const holiday of holidays) {
    const dateObj = new Date(holiday.date + 'T00:00:00Z');
    const windowStart = dateObj;
    const windowEnd = addDays(dateObj, 3); // 4-day window around each holiday

    // National holidays go to all states + AU; state-specific go to their state
    const targetStates =
      holiday.counties === null || holiday.counties.length === 0
        ? [...AU_STATES, 'AU']
        : holiday.counties
            .map(c => c.replace('AU-', ''))
            .filter(s => AU_STATES.includes(s));

    for (const state of targetStates) {
      signals.push({
        industrySlug: 'general',
        locationState: state,
        signalType: 'holiday',
        opportunityLabel: holiday.name,
        windowStart,
        windowEnd,
        confidenceScore: 90,
        source: 'public_holiday',
      });
    }
  }

  return signals;
}

function buildSchoolTermSignals(year: number): SignalRow[] {
  const signals: SignalRow[] = [];

  for (const term of SCHOOL_TERM_WINDOWS) {
    const windowStart = d(year, term.windowStartMonth, term.windowStartDay);
    const windowEnd = d(year, term.windowEndMonth, term.windowEndDay);

    for (const state of [...AU_STATES, 'AU']) {
      signals.push({
        industrySlug: 'general',
        locationState: state,
        signalType: 'school_term',
        opportunityLabel: term.opportunityLabel,
        windowStart,
        windowEnd,
        confidenceScore: term.confidenceScore,
        source: 'school_calendar',
      });
    }
  }

  return signals;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth: CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const startMs = Date.now();
  const errors: string[] = [];
  let upserted = 0;

  try {
    logger.info('update-seasonal-signals: starting', { year: YEAR });

    // Fetch live public holidays
    let holidaySignals: SignalRow[] = [];
    try {
      const holidays = await fetchPublicHolidays(YEAR);
      holidaySignals = buildHolidaySignals(holidays, YEAR);
      logger.info(
        `update-seasonal-signals: fetched ${holidays.length} holidays`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        'update-seasonal-signals: holiday fetch failed, using static fallback',
        { error: msg }
      );
      errors.push(`holiday_fetch: ${msg}`);
      // Fall through — school term signals still run
    }

    const schoolTermSignals = buildSchoolTermSignals(YEAR);
    const allSignals = [...holidaySignals, ...schoolTermSignals];

    // Upsert all signals
    for (const signal of allSignals) {
      try {
        await prisma.seasonalSignal.upsert({
          where: {
            seasonal_signal_dedup: {
              industrySlug: signal.industrySlug,
              locationState: signal.locationState,
              windowStart: signal.windowStart,
              source: signal.source,
            },
          },
          create: signal,
          update: {
            opportunityLabel: signal.opportunityLabel,
            windowEnd: signal.windowEnd,
            confidenceScore: signal.confidenceScore,
            signalType: signal.signalType,
          },
        });
        upserted++;
      } catch (err) {
        errors.push(String(err));
      }
    }

    const durationMs = Date.now() - startMs;

    // Log the run
    await prisma.seasonalSignalRun.create({
      data: {
        recordsUpserted: upserted,
        errors: errors.length > 0 ? errors : undefined,
        durationMs,
      },
    });

    logger.info('update-seasonal-signals: done', {
      upserted,
      errors: errors.length,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      upserted,
      errors: errors.length,
      durationMs,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error('update-seasonal-signals: fatal error', { error: err });
    return NextResponse.json({ success: false, reason }, { status: 500 });
  }
}
