/**
 * Algorithm Sentinel Cron Job
 *
 * POST /api/cron/sentinel
 * Runs scheduled sentinel checks for all users with a site URL configured.
 * Called by Vercel Cron on a daily schedule.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: GSC credentials (OPTIONAL)
 * - GOOGLE_PAGESPEED_API_KEY: PSI API key (OPTIONAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runSentinelCheckForAllUsers } from '@/lib/sentinel/sentinel-agent';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — runs across multiple users

export async function POST(request: NextRequest) {
  // Validate CRON_SECRET — Vercel passes this as an Authorization header
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  logger.info('[Sentinel Cron] Starting scheduled sentinel check');

  try {
    const result = await runSentinelCheckForAllUsers();

    const duration = Date.now() - startTime;

    logger.info(`[Sentinel Cron] Completed in ${duration}ms:`, result);

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Sentinel Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Sentinel cron failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron (which sends GET by default)
export async function GET(request: NextRequest) {
  return POST(request);
}
