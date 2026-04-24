/**
 * POST /api/internal/update-seasonal-signals
 *
 * Internal endpoint called by the Supabase Edge Function weekly (Sunday 2 AM AEST).
 * Fetches public holidays from nager.date API, merges static school term windows,
 * and upserts all records into seasonal_signals.
 *
 * Wrapped in createEdgeFunctionRunner for structured logging to edge_function_logs
 * and validateOutput metadata (SeasonalEngineMetadata).
 *
 * Auth: Bearer CRON_SECRET
 * SYN-547 | Observability: SYN-628
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';
import type { SeasonalEngineMetadata } from '@/lib/pipelines/metadata-schemas';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

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

interface SeasonalRunResult {
  upserted: number;
  errors: number;
  avgRelevance: number;
  nextWindow: string; // ISO date YYYY-MM-DD
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
    const windowEnd = addDays(dateObj, 3);

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

  // Suppress lint — nagerCode used for future per-holiday county filtering
  void nagerCode;

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

// ── Runner ────────────────────────────────────────────────────────────────────

const seasonalEngineRunner = createEdgeFunctionRunner<
  { year: number },
  SeasonalRunResult
>(
  'seasonal-engine',
  async (input: { year: number }): Promise<SeasonalRunResult> => {
    const errors: string[] = [];
    let upserted = 0;

    logger.info('update-seasonal-signals: starting', { year: input.year });

    let holidaySignals: SignalRow[] = [];
    try {
      const holidays = await fetchPublicHolidays(input.year);
      holidaySignals = buildHolidaySignals(holidays, input.year);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        'update-seasonal-signals: holiday fetch failed, using school terms only',
        { error: msg }
      );
      errors.push(`holiday_fetch: ${msg}`);
    }

    const schoolTermSignals = buildSchoolTermSignals(input.year);
    const allSignals = [...holidaySignals, ...schoolTermSignals];

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

    // Compute avg relevance from the in-memory signals array
    const avgRelevance =
      allSignals.length > 0
        ? allSignals.reduce((sum, s) => sum + s.confidenceScore, 0) /
          allSignals.length
        : 0;

    // Query DB for the next upcoming window (earliest windowStart after now)
    const nextSignal = await prisma.seasonalSignal.findFirst({
      where: { windowStart: { gt: new Date() } },
      orderBy: { windowStart: 'asc' },
      select: { windowStart: true },
    });
    const nextWindow =
      nextSignal?.windowStart.toISOString().split('T')[0] ?? '';

    logger.info('update-seasonal-signals: done', {
      upserted,
      errors: errors.length,
      avgRelevance,
      nextWindow,
    });

    return { upserted, errors: errors.length, avgRelevance, nextWindow };
  },
  (
    output: SeasonalRunResult
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    const valid = output.upserted > 0;

    const metadata: SeasonalEngineMetadata = {
      signals_generated: output.upserted,
      avg_relevance: Math.round(output.avgRelevance * 10) / 10,
      next_season_window: output.nextWindow,
    };

    return { valid, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'UPDATE_SEASONAL_SIGNALS');
  if (!auth.ok) return auth.response;

  const runResult = await seasonalEngineRunner.run([
    { clientId: 'all-orgs', input: { year: YEAR } },
  ]);

  const output = runResult.outputs[0]?.output;

  logger.info('[update-seasonal-signals] Run complete', {
    runId: runResult.runId,
    status: runResult.status,
    upserted: output?.upserted ?? 0,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    upserted: output?.upserted ?? 0,
    errors: output?.errors ?? 0,
    durationMs: runResult.durationMs,
  });
}
