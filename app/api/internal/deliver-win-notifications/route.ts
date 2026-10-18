/**
 * POST /api/internal/deliver-win-notifications
 *
 * Daily batch job that:
 * 1. Finds posts published in the last 24h for each active organisation
 * 2. Checks if any post ranks in the top-10% of that org's 30-day engagement history
 * 3. Applies 14-day journey event throttle (should_deliver_journey_event RPC)
 * 4. Sends Win Notification email via Resend
 * 5. Inserts 'win_notification' record into client_journey_events
 *
 * Called by: platform/functions/deliver-win-notifications (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-671
 *
 * NOT PROVISIONED: this job depends on the client_journey_events table and
 * should_deliver_journey_event function, none of which exist in
 * prisma/schema.prisma.
 * After the auth check it returns 501 FEATURE_NOT_PROVISIONED rather
 * than reporting a successful run that sent or recorded nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_WIN_NOTIFICATIONS');
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      error: 'FEATURE_NOT_PROVISIONED',
      message:
        'This job cannot run: the client_journey_events table and should_deliver_journey_event function are not provisioned.',
    },
    { status: 501 }
  );
}
