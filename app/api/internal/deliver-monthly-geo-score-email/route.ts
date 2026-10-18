/**
 * POST /api/internal/deliver-monthly-geo-score-email
 *
 * Monthly GEO Score email delivery — called by the Edge Function cron on the 1st
 * of each month (08:00 AEDT / 21:00 UTC previous day).
 *
 * Algorithm:
 *   1. For each client with ≥2 client_geo_scores rows (current + prior month):
 *      a. current  = latest row
 *      b. prior    = most recent row older than 28 days
 *      c. delta    = current.score - prior.score
 *   2. delta ≥ +5  → send "improved" variant
 *      delta ≤ -5  → send "needs_attention" variant
 *      |delta| < 5 → skip (noise prevention)
 *   3. Fire GA4 Measurement Protocol event per email sent
 *
 * Requires env:
 *   CRON_SECRET                        — shared Bearer secret
 *   MONTHLY_GEO_SCORE_EMAIL_ENABLED    — must be "true"
 *   RESEND_API_KEY                     — Resend
 *   GA4_MEASUREMENT_ID                 — G-XXXXXXXX
 *   GA4_API_SECRET                     — GA4 Measurement Protocol secret
 *
 * @task SYN-658
 *
 * NOT PROVISIONED: this job depends on the client_geo_scores table, none of
 * which exist in prisma/schema.prisma.
 * After the flag and auth checks it returns 501 FEATURE_NOT_PROVISIONED rather
 * than reporting a successful run that sent or recorded nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Feature flag guard (defaults off)
  if (process.env.MONTHLY_GEO_SCORE_EMAIL_ENABLED !== 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'feature flag disabled',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_MONTHLY_GEO_SCORE_EMAIL');
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      error: 'FEATURE_NOT_PROVISIONED',
      message:
        'This job cannot run: the client_geo_scores table is not provisioned.',
    },
    { status: 501 }
  );
}
