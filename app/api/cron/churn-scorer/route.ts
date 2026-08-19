/**
 * Churn Scorer Cron Job
 *
 * GET /api/cron/churn-scorer
 * Runs daily at 02:30 UTC via Vercel Cron (after health-score at 02:00).
 * Computes predictive churn risk for all active client organisations.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 *
 * SYN-618 | AT-023
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { runChurnScoring } from '@/lib/retention/churn-scorer';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'CHURN_SCORER');
  if (!auth.ok) return auth.response;

  try {
    const startTime = Date.now();
    logger.info('cron:churn-scorer:start', {
      timestamp: new Date().toISOString(),
    });

    const result = await runChurnScoring('all_organizations');
    const durationMs = Date.now() - startTime;

    logger.info('cron:churn-scorer:end', {
      timestamp: new Date().toISOString(),
      processed: result.processed,
      scored: result.scored,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      ...result,
      durationMs,
    });
  } catch (error) {
    logger.error('[Churn Scorer Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Churn scoring failed' },
      { status: 500 }
    );
  }
}
