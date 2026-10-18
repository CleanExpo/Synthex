/**
 * POST /api/internal/score-accuracy-matcher
 *
 * Nightly batch job that backfills outcome_value and accuracy_delta on
 * score_accuracy_events rows older than 48 hours that haven't been matched yet.
 *
 * NOT PROVISIONED: `score_accuracy_events` has no Prisma model, so there is
 * nothing to read or backfill. After auth the route returns 503
 * FEATURE_NOT_PROVISIONED rather than "Nothing to match".
 *
 * Called by: platform/functions/score-accuracy-matcher (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-670
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const auth = verifyCronRequest(req, 'SCORE_ACCURACY_MATCHER');
  if (!auth.ok) return auth.response;

  return notProvisionedResponse(
    'Score accuracy matching is not provisioned: the score_accuracy_events table has no data model. No events were matched.'
  );
}
