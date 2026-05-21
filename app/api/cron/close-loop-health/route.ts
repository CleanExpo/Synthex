import { NextRequest, NextResponse } from 'next/server';
import { alertManager } from '@/lib/alerts';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { fetchCloseLoopHealth } from '@/lib/close-loop/health';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function handle(request: NextRequest) {
  const auth = verifyCronRequest(request, 'CLOSE_LOOP_HEALTH');
  if (!auth.ok) return auth.response;

  try {
    const report = await fetchCloseLoopHealth();

    if (report.overall !== 'green') {
      const failed = report.pipelines
        .filter((p) => p.status !== 'success' || p.stale || p.clientsFailed > 0)
        .map((p) => `${p.name}:${p.status}${p.stale ? ':stale' : ''}`)
        .join(', ');

      await alertManager
        .warning(
          'Close the Loop Health Degraded',
          `Close the Loop health is ${report.overall}. Attention: ${failed}`,
          'cron/close-loop-health'
        )
        .catch(() => {});
    }

    logger.info('[close-loop-health] complete', {
      overall: report.overall,
      pipelines: report.pipelines.length,
    });

    return NextResponse.json(report, {
      status: report.overall === 'red' ? 207 : 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[close-loop-health] failed', { message });
    return NextResponse.json(
      { error: 'close_loop_health_failed', message },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
