/**
 * POST /api/internal/deliver-milestone-notifications
 *
 * Daily batch job (SYN-675) that:
 * 1. Finds undelivered milestone_events (email_sent_at IS NULL)
 * 2. For anniversary_1yr: inserts the milestone record if today is the org's
 *    1-year anniversary (via get_anniversary_orgs RPC) — then processes
 * 3. Resolves the primary contact email for each org
 * 4. Sends the milestone notification email via Resend
 * 5. Sets email_sent_at on the milestone_events row
 *
 * Feature flag: MILESTONE_NOTIFICATIONS_ENABLED=true required (defaults disabled).
 * Called by: platform/functions/deliver-milestone-notifications (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-675
 *
 * NOT PROVISIONED: this job depends on the milestone_events table and
 * get_anniversary_orgs function, none of which exist in prisma/schema.prisma.
 * After the flag and auth checks it returns 501 FEATURE_NOT_PROVISIONED rather
 * than reporting a successful run that sent or recorded nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Feature flag guard (defaults off)
  if (process.env.MILESTONE_NOTIFICATIONS_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'MILESTONE_NOTIFICATIONS_ENABLED is not set — no emails sent',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_MILESTONE_NOTIFICATIONS');
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      error: 'FEATURE_NOT_PROVISIONED',
      message:
        'This job cannot run: the milestone_events table and get_anniversary_orgs function are not provisioned.',
    },
    { status: 501 }
  );
}
