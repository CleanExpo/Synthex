/**
 * lib/analytics/public-benchmarks.ts — SYN-779
 *
 * Computes aggregate, anonymised benchmark claims for the public
 * `/benchmark` landing page. All claims are cohort-level (never
 * per-user, per-org, or per-post) and include a sample-size disclosure
 * so every figure on the page is grounded in real data.
 *
 * This module is intentionally separate from `lib/analytics/benchmark-service.ts`
 * which computes a *personalised* benchmark report behind auth. The
 * public page MUST NOT expose anything that could identify a single
 * client or account.
 *
 * Fallback: when the database is unreachable or sample size is below
 * threshold, returns a `FALLBACK_CLAIMS` object with disclosed sample
 * size of 0 — the page surfaces an honest "insufficient data" state
 * rather than fabricated numbers.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** Minimum sample size for a claim to be shown on the public page. */
const MIN_SAMPLE_SIZE = 25;

/** Claim rendered on the benchmark page. */
export interface PublicBenchmarkClaim {
  /** Short label, e.g. "Posts published". */
  label: string;
  /** Human-readable value, e.g. "14,238" or "4.2x". */
  value: string;
  /** One-line disclosure of sample + period. */
  disclosure: string;
  /** Which underlying metric produced the claim. */
  source:
    | 'posts_published'
    | 'active_accounts'
    | 'platforms_covered'
    | 'engagement_lift';
}

export interface PublicBenchmarkPayload {
  claims: PublicBenchmarkClaim[];
  /** ISO date range used across claims. */
  periodStart: string;
  periodEnd: string;
  /** Sample-size cohort description for the methodology section. */
  cohortDescription: string;
  /** When this payload was computed. */
  generatedAt: string;
  /** True when no real data met the threshold — page shows fallback UI. */
  usingFallback: boolean;
}

const FALLBACK_CLAIMS: PublicBenchmarkPayload = {
  claims: [
    {
      label: 'Insufficient data',
      value: '—',
      disclosure:
        'Based on 0 anonymised Synthex client accounts. Public figures publish once the cohort exceeds 25 accounts.',
      source: 'active_accounts',
    },
  ],
  periodStart: '',
  periodEnd: '',
  cohortDescription: 'Cohort threshold not yet reached.',
  generatedAt: new Date(0).toISOString(),
  usingFallback: true,
};

function formatInt(n: number): string {
  return n.toLocaleString('en-AU');
}

function formatDate(d: Date): string {
  // DD/MM/YYYY per CEO standing orders.
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Compute public benchmark claims from live Prisma aggregates.
 * Must never throw — any failure returns FALLBACK_CLAIMS and logs.
 */
export async function getPublicBenchmarks(): Promise<PublicBenchmarkPayload> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  try {
    const [activeAccounts, postsPublished, platformsCovered] =
      await Promise.all([
        prisma.platformConnection.count({
          where: { isActive: true, deletedAt: null },
        }),
        prisma.platformPost.count({
          where: {
            status: 'published',
            publishedAt: { gte: ninetyDaysAgo, lte: now },
          },
        }),
        prisma.platformConnection
          .findMany({
            where: { isActive: true, deletedAt: null },
            select: { platform: true },
            distinct: ['platform'],
          })
          .then((rows: { platform: string }[]) => rows.length),
      ]);

    if (activeAccounts < MIN_SAMPLE_SIZE) {
      return FALLBACK_CLAIMS;
    }

    const disclosure = `Based on ${formatInt(activeAccounts)} anonymised Synthex client accounts, ${formatDate(ninetyDaysAgo)}–${formatDate(now)}.`;

    const claims: PublicBenchmarkClaim[] = [
      {
        label: 'Posts published in the last 90 days',
        value: formatInt(postsPublished),
        disclosure,
        source: 'posts_published',
      },
      {
        label: 'Active client accounts',
        value: formatInt(activeAccounts),
        disclosure,
        source: 'active_accounts',
      },
      {
        label: 'Platforms covered',
        value: formatInt(platformsCovered),
        disclosure: `Based on ${formatInt(activeAccounts)} anonymised Synthex client accounts, distinct active platforms as of ${formatDate(now)}.`,
        source: 'platforms_covered',
      },
    ];

    return {
      claims,
      periodStart: ninetyDaysAgo.toISOString(),
      periodEnd: now.toISOString(),
      cohortDescription: `Anonymised aggregate across ${formatInt(activeAccounts)} active Synthex client accounts over the prior 90 days.`,
      generatedAt: now.toISOString(),
      usingFallback: false,
    };
  } catch (error) {
    logger.warn('public-benchmarks: query failed, returning fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return FALLBACK_CLAIMS;
  }
}
