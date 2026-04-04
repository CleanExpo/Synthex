/**
 * seed-seasonal-signals.ts
 *
 * Seeds the seasonal_signals table with static 2026 market opportunity data
 * for 5 industry slugs × 8 AU states. Run once after the SYN-547 migration.
 *
 * Usage: npx tsx scripts/seed-seasonal-signals.ts
 *
 * @task SYN-547
 */

import prisma from '../lib/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

interface SeedSignal {
  industrySlug: string;
  locationState: string;
  signalType: string;
  opportunityLabel: string;
  windowStart: Date;
  windowEnd: Date;
  confidenceScore: number;
  source: string;
}

// ── AU states ────────────────────────────────────────────────────────────────

const AU_STATES = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

// ── Helper ───────────────────────────────────────────────────────────────────

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// ── Public holidays (national AU — same for all states) ───────────────────────

const PUBLIC_HOLIDAYS_2026: Omit<
  SeedSignal,
  'industrySlug' | 'locationState'
>[] = [
  {
    signalType: 'holiday',
    opportunityLabel: 'Australia Day Long Weekend',
    windowStart: d(2026, 1, 23),
    windowEnd: d(2026, 1, 27),
    confidenceScore: 95,
    source: 'public_holiday',
  },
  {
    signalType: 'holiday',
    opportunityLabel: 'Easter Long Weekend',
    windowStart: d(2026, 4, 2),
    windowEnd: d(2026, 4, 7),
    confidenceScore: 95,
    source: 'public_holiday',
  },
  {
    signalType: 'holiday',
    opportunityLabel: 'ANZAC Day',
    windowStart: d(2026, 4, 24),
    windowEnd: d(2026, 4, 27),
    confidenceScore: 90,
    source: 'public_holiday',
  },
  {
    signalType: 'holiday',
    opportunityLabel: 'End of Financial Year Sales Period',
    windowStart: d(2026, 6, 15),
    windowEnd: d(2026, 6, 30),
    confidenceScore: 88,
    source: 'public_holiday',
  },
  {
    signalType: 'holiday',
    opportunityLabel: 'Christmas Pre-Season',
    windowStart: d(2026, 11, 20),
    windowEnd: d(2026, 12, 24),
    confidenceScore: 95,
    source: 'public_holiday',
  },
  {
    signalType: 'holiday',
    opportunityLabel: 'Boxing Day Sales Period',
    windowStart: d(2026, 12, 26),
    windowEnd: d(2027, 1, 5),
    confidenceScore: 92,
    source: 'public_holiday',
  },
];

// ── School terms 2026 (standardised AU — minor state variation ignored) ──────

const SCHOOL_TERMS_2026: Omit<SeedSignal, 'industrySlug' | 'locationState'>[] =
  [
    {
      signalType: 'school_term',
      opportunityLabel: 'Back to School — Term 1',
      windowStart: d(2026, 1, 26),
      windowEnd: d(2026, 2, 7),
      confidenceScore: 85,
      source: 'school_calendar',
    },
    {
      signalType: 'school_term',
      opportunityLabel: 'Back to School — Term 3',
      windowStart: d(2026, 7, 13),
      windowEnd: d(2026, 7, 25),
      confidenceScore: 80,
      source: 'school_calendar',
    },
  ];

// ── Industry-specific seasonal peaks ─────────────────────────────────────────

const INDUSTRY_SIGNALS: SeedSignal[] = [];

// plumbing-hvac: winter burst pipes + hot water service demand
for (const state of AU_STATES) {
  INDUSTRY_SIGNALS.push(
    {
      industrySlug: 'plumbing-hvac',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'Winter Pipe & Hot Water Season',
      windowStart: d(2026, 6, 1),
      windowEnd: d(2026, 8, 31),
      confidenceScore: 90,
      source: 'abs_data',
    },
    {
      industrySlug: 'plumbing-hvac',
      locationState: state,
      signalType: 'trend_spike',
      opportunityLabel: 'Pre-Summer AC Service Spike',
      windowStart: d(2026, 10, 1),
      windowEnd: d(2026, 11, 15),
      confidenceScore: 82,
      source: 'google_trends',
    }
  );
}

// cafe-coffee: winter warmth demand + summer cold brew
for (const state of AU_STATES) {
  INDUSTRY_SIGNALS.push(
    {
      industrySlug: 'cafe-coffee',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'Winter Warmth — Hot Beverage Peak',
      windowStart: d(2026, 5, 15),
      windowEnd: d(2026, 8, 15),
      confidenceScore: 88,
      source: 'google_trends',
    },
    {
      industrySlug: 'cafe-coffee',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'Summer Cold Brew & Iced Coffee Season',
      windowStart: d(2026, 11, 1),
      windowEnd: d(2027, 1, 31),
      confidenceScore: 85,
      source: 'google_trends',
    }
  );
}

// retail-general: EOFY + Christmas + Back to School
for (const state of AU_STATES) {
  INDUSTRY_SIGNALS.push(
    {
      industrySlug: 'retail-general',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'EOFY Clearance Sales Peak',
      windowStart: d(2026, 6, 1),
      windowEnd: d(2026, 6, 30),
      confidenceScore: 92,
      source: 'abs_data',
    },
    {
      industrySlug: 'retail-general',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'Pre-Christmas Gift Buying Peak',
      windowStart: d(2026, 11, 1),
      windowEnd: d(2026, 12, 23),
      confidenceScore: 95,
      source: 'google_trends',
    }
  );
}

// allied-health: cold & flu + new year wellness
for (const state of AU_STATES) {
  INDUSTRY_SIGNALS.push(
    {
      industrySlug: 'allied-health',
      locationState: state,
      signalType: 'trend_spike',
      opportunityLabel: 'Cold & Flu Season — Allied Health Demand',
      windowStart: d(2026, 5, 1),
      windowEnd: d(2026, 8, 31),
      confidenceScore: 87,
      source: 'google_trends',
    },
    {
      industrySlug: 'allied-health',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'New Year Wellness & Health Resolutions',
      windowStart: d(2026, 1, 2),
      windowEnd: d(2026, 2, 15),
      confidenceScore: 80,
      source: 'google_trends',
    }
  );
}

// personal-fitness: new year + winter hibernation break
for (const state of AU_STATES) {
  INDUSTRY_SIGNALS.push(
    {
      industrySlug: 'personal-fitness',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'New Year Fitness Resolutions Peak',
      windowStart: d(2026, 1, 2),
      windowEnd: d(2026, 2, 28),
      confidenceScore: 93,
      source: 'google_trends',
    },
    {
      industrySlug: 'personal-fitness',
      locationState: state,
      signalType: 'seasonal_peak',
      opportunityLabel: 'Spring Fitness Reboot — Post-Winter',
      windowStart: d(2026, 9, 1),
      windowEnd: d(2026, 10, 31),
      confidenceScore: 84,
      source: 'google_trends',
    }
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding seasonal_signals…');
  const start = Date.now();
  let upserted = 0;
  const errors: string[] = [];

  // Build full signal list
  const allSignals: SeedSignal[] = [...INDUSTRY_SIGNALS];

  // Expand national signals across all states + national 'AU'
  for (const holiday of PUBLIC_HOLIDAYS_2026) {
    for (const state of [...AU_STATES, 'AU']) {
      allSignals.push({
        ...holiday,
        industrySlug: 'general',
        locationState: state,
      });
    }
  }

  for (const term of SCHOOL_TERMS_2026) {
    for (const state of [...AU_STATES, 'AU']) {
      allSignals.push({
        ...term,
        industrySlug: 'general',
        locationState: state,
      });
    }
  }

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

  const durationMs = Date.now() - start;
  console.log(
    `Done: ${upserted} upserted, ${errors.length} errors in ${durationMs}ms`
  );
  if (errors.length > 0) {
    console.error('Errors:', errors);
  }

  await prisma.seasonalSignalRun.create({
    data: {
      recordsUpserted: upserted,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
