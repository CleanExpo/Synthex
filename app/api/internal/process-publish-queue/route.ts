/**
 * POST /api/internal/process-publish-queue
 *
 * Internal endpoint called by the Supabase Edge Function every 15 minutes.
 * Runs the publish queue orchestrator (processPublishQueue) in the Node.js
 * runtime with full Prisma + encryption access.
 *
 * Auth: Bearer CRON_SECRET (same pattern as /api/cron/generate-calendars)
 *
 * @task SYN-523
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPublishQueue } from '@/lib/publish/publishQueue';
import { logger } from '@/lib/logger';

// Allow up to 5 minutes (Edge Function max for this type of work)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // ── Auth: CRON_SECRET ────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    logger.info('POST /api/internal/process-publish-queue: starting');

    const result = await processPublishQueue();

    logger.info('POST /api/internal/process-publish-queue: done', {
      ...result,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error('POST /api/internal/process-publish-queue: failed', {
      error: err,
    });
    return NextResponse.json({ success: false, reason }, { status: 500 });
  }
}
