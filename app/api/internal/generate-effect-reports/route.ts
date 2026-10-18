/**
 * POST /api/internal/generate-effect-reports
 *
 * Quarterly batch job that generates Effect Reports per active client,
 * persists them to effect_reports and records a client_journey_events row.
 *
 * NOT PROVISIONED: neither `effect_reports` nor `client_journey_events` has a
 * Prisma model, so the job cannot dedupe, persist or record anything. After
 * auth it returns 503 FEATURE_NOT_PROVISIONED instead of reporting a run.
 *
 * Feature flag: EFFECT_REPORT_ENABLED=true required (defaults disabled).
 * Called by: platform/functions/generate-effect-reports (Deno cron proxy)
 * Auth: CRON_SECRET bearer token
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Feature flag guard
  if (process.env.EFFECT_REPORT_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'EFFECT_REPORT_ENABLED is not set — no reports generated',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'GENERATE_EFFECT_REPORTS');
  if (!auth.ok) return auth.response;

  return notProvisionedResponse(
    'Effect report generation is not provisioned: the effect_reports and client_journey_events tables have no data model. No reports were generated.'
  );
}
