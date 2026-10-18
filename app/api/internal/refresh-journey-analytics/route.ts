/**
 * POST /api/internal/refresh-journey-analytics
 *
 * CRON_SECRET-guarded internal route called by the refresh-journey-analytics
 * Supabase Edge Function every Sunday at 18:00 UTC (Monday 04:00 AEDT).
 *
 * Intended to run REFRESH MATERIALIZED VIEW CONCURRENTLY journey_analytics.
 *
 * NOT PROVISIONED: the `journey_analytics` view (and its source table
 * `client_journey_events`) has no Prisma model, so there is nothing to
 * refresh. After auth the route records a failed run in edge_function_logs
 * (EdgeFunctionLog model) and returns 501 FEATURE_NOT_PROVISIONED.
 *
 * @task SYN-678
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

const FUNCTION_NAME = 'refresh-journey-analytics';
const MESSAGE =
  'Journey analytics refresh is not provisioned: the journey_analytics view and client_journey_events table have no data model. Nothing was refreshed.';

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'REFRESH_JOURNEY_ANALYTICS');
  if (!auth.ok) return auth.response;

  try {
    await prisma.edgeFunctionLog.create({
      data: {
        functionName: FUNCTION_NAME,
        runId: randomUUID(),
        status: 'failed',
        durationMs: 0,
        errorJson: { error: 'FEATURE_NOT_PROVISIONED', message: MESSAGE },
      },
    });
  } catch (err) {
    // Observability must not mask the 501 below; say so in the logs.
    logger.error('refresh-journey-analytics: edge_function_logs write failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  logger.warn('refresh-journey-analytics: FEATURE_NOT_PROVISIONED', {
    view: 'journey_analytics',
  });

  return NextResponse.json(
    { error: 'FEATURE_NOT_PROVISIONED', message: MESSAGE },
    { status: 501 }
  );
}
