/**
 * GEO Citation Baseline Monitor Cron — SYN-584 (silent dark run).
 *
 * GET /api/cron/geo-citation-monitor
 * Runs weekly (Sunday 03:00 AEST = 17:00 UTC Saturday) via Vercel Cron.
 * Accumulates Google AI Overview brand-mention data into `geo_citation_events`
 * for every active user with a connected GBP location. NO client-facing output.
 *
 * The AI Overview fetch is a founder-gated dependency — until a SERP provider is
 * configured (see lib/geo-citation/ai-overview-adapter.ts) every row is written
 * with `error_reason` recording that the provider is not configured. No
 * fabricated citation data.
 *
 * ENVIRONMENT VARIABLES:
 * - CRON_SECRET (or CRON_SECRET_GEO_CITATION_MONITOR): cron authorisation (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { runWeeklyGeoCitationMonitor } from '@/lib/geo-citation/run-weekly-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'GEO_CITATION_MONITOR');
  if (!auth.ok) return auth.response;

  try {
    logger.info('cron:geo-citation-monitor:start', {
      timestamp: new Date().toISOString(),
    });

    const summary = await runWeeklyGeoCitationMonitor();

    logger.info('cron:geo-citation-monitor:done', { ...summary });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    logger.error('cron:geo-citation-monitor:failed', error);
    return NextResponse.json(
      {
        error: 'GEO citation monitor run failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
