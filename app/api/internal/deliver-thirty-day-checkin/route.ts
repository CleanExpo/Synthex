/**
 * POST /api/internal/deliver-thirty-day-checkin
 *
 * Daily batch job that:
 * 1. Finds active organisations with created_at in the 28–45 day window
 * 2. Checks the 14-day journey event throttle (should_deliver_journey_event RPC)
 * 3. Fetches GEO Score from client_geo_scores (conditional section)
 * 4. Counts win_notification events (conditional section)
 * 5. Sends the 30-Day Check-In email via Resend (adaptive subject line)
 * 6. Records the journey event in client_journey_events
 *
 * Hard cutoff: orgs at day 46+ receive a skipped record (no email).
 * Feature flag: THIRTY_DAY_CHECKIN_ENABLED=false disables sending (defaults off).
 *
 * Called by: platform/functions/deliver-thirty-day-checkin (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-661
 *
 * NOT PROVISIONED: this job depends on the client_geo_scores and
 * client_journey_events tables and should_deliver_journey_event function, none
 * of which exist in prisma/schema.prisma.
 * After the flag and auth checks it returns 503 FEATURE_NOT_PROVISIONED rather
 * than reporting a successful run that sent or recorded nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Feature flag guard (defaults off)
  if (process.env.THIRTY_DAY_CHECKIN_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'THIRTY_DAY_CHECKIN_ENABLED is not set — no emails sent',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_THIRTY_DAY_CHECKIN');
  if (!auth.ok) return auth.response;

  return notProvisionedResponse(
    'This job cannot run: the client_geo_scores and client_journey_events tables and should_deliver_journey_event function are not provisioned.'
  );
}
