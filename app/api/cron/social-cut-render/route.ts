/**
 * Social Cut Render Cron — /api/cron/social-cut-render
 *
 * Every 30 minutes: claims pending deriveSocialCut rows in video_assets and
 * renders them into real cut files (centred crop + tail trim + burned
 * captions), uploading to Supabase storage. Rendering never publishes — the
 * publish_queue rows stay human-gated.
 *
 * vercel.json schedule: "*\/30 * * * *"
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - CRON_SECRET: Vercel cron authorization secret (SECRET)
 * - NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: storage upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'SOCIAL_CUT_RENDER');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:social-cut-render:start', {
    timestamp: new Date().toISOString(),
  });

  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get('limit'));
    const limit =
      Number.isInteger(limitParam) && limitParam >= 1 && limitParam <= 5
        ? limitParam
        : 3;

    // Dynamically import so the heavy media toolchain never loads into the
    // shared serverless bundle — only this route needs it.
    const { processPendingSocialCuts } =
      await import('@/lib/video/social-cut-renderer');

    const results = await processPendingSocialCuts({
      limit,
      timeBudgetMs: 240_000,
    });

    const durationMs = Date.now() - startTime;
    const ready = results.filter(r => r.status === 'ready').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    logger.info('cron:social-cut-render:end', {
      durationMs,
      total: results.length,
      ready,
      failed,
      skipped,
    });

    return NextResponse.json({
      success: true,
      durationMs,
      ready,
      failed,
      skipped,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('cron:social-cut-render:fatal', { error: msg });
    return NextResponse.json(
      { error: 'Social cut render cron failed', details: msg },
      { status: 500 }
    );
  }
}
