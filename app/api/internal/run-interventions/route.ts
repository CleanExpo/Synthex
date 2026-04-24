/**
 * POST /api/internal/run-interventions
 *
 * Nightly cron entry-point for the Client Retention Engine.
 * Runs after compute-health-scores (both fire from the same Edge Function chain).
 *
 * Auth: CRON_SECRET bearer token.
 * SYN-615
 */

import { NextRequest, NextResponse } from 'next/server';
import { runInterventions } from '@/lib/interventions/compute';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'RUN_INTERVENTIONS');
  if (!auth.ok) return auth.response;

  const start = Date.now();
  logger.info('[run-interventions] Starting nightly intervention run');

  try {
    const result = await runInterventions();
    const duration = Date.now() - start;

    logger.info(
      `[run-interventions] Done in ${duration}ms — processed: ${result.processed}, candidates: ${result.candidatesFound}, dispatched: ${result.dispatched}, observed: ${result.observed}, errors: ${result.errors.length}`
    );

    return NextResponse.json({ ok: true, ...result, durationMs: duration });
  } catch (err) {
    logger.error('[run-interventions] Fatal error', err);
    return NextResponse.json(
      { error: 'Intervention run failed' },
      { status: 500 }
    );
  }
}
