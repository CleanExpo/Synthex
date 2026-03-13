/**
 * Health Score Cron Job
 *
 * GET /api/cron/health-score
 * Runs daily at 2 AM UTC via Vercel Cron.
 * Calculates health scores for all active paid users.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateAllHealthScores } from '@/lib/retention/health-score-calculator';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel passes this header for scheduled functions)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    logger.info('cron:health-score:start', { timestamp: new Date().toISOString() });

    const result = await calculateAllHealthScores();

    const duration = Date.now() - startTime;
    logger.info('cron:health-score:end', { timestamp: new Date().toISOString(), durationMs: duration });

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Health Score Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Health score calculation failed' },
      { status: 500 }
    );
  }
}
