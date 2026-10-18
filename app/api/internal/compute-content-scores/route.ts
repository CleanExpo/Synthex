/**
 * POST /api/internal/compute-content-scores
 *
 * CRON_SECRET-guarded internal route called weekly by the `score-content-draft`
 * Supabase Edge Function (Sunday 14:00 UTC, after compute-content-profiles).
 *
 * NOT PROVISIONED: `content_score_history` has no Prisma model, so
 * saveContentScore() always throws and no score can be stored. After auth the
 * route returns 503 FEATURE_NOT_PROVISIONED rather than a success that saved
 * nothing.
 *
 * @task SYN-664
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // SYN-702: route-scoped auth. Accepts CRON_SECRET_COMPUTE_CONTENT_SCORES
  // if configured, else falls back to the shared CRON_SECRET (logged as a
  // warning). Per-route isolation limits blast radius if the shared secret
  // ever leaks.
  const auth = verifyCronRequest(request, 'COMPUTE_CONTENT_SCORES');
  if (!auth.ok) return auth.response;

  return notProvisionedResponse(
    'Content scoring is not provisioned: the content_score_history table has no data model. No scores were saved.'
  );
}
