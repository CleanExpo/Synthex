/**
 * POST /api/internal/deliver-quarterly-milestone
 *
 * Weekly batch job that:
 * 1. Finds clients created ≥85 days ago, with next renewal 14-21 days out
 * 2. Checks quarterly_review_ready() RPC (gate: ≥3 of 5 conditions)
 * 3. Checks 14-day journey throttle and 85-day quarterly guard
 * 4. Computes Synthex IQ score (formula: posts×2 + reviews×3 + strategy×5 + attribution×1)
 * 5. Fetches GEO Score trajectory, top posts, attribution, authority score
 * 6. Sends the Quarterly Milestone Review email via Resend
 * 7. Records journey event in client_journey_events
 *
 * Feature flag: QUARTERLY_REVIEW_ENABLED=true required (defaults disabled).
 * Called by: platform/functions/deliver-quarterly-milestone (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-662
 *
 * NOT PROVISIONED: this job depends on the client_geo_scores and
 * client_journey_events tables, none of which exist in prisma/schema.prisma.
 * After the flag and auth checks it returns 503 FEATURE_NOT_PROVISIONED rather
 * than reporting a successful run that sent or recorded nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Feature flag guard (defaults off)
  if (process.env.QUARTERLY_REVIEW_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'QUARTERLY_REVIEW_ENABLED is not set — no emails sent',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_QUARTERLY_MILESTONE');
  if (!auth.ok) return auth.response;

  return notProvisionedResponse(
    'This job cannot run: the client_geo_scores and client_journey_events tables are not provisioned.'
  );
}
