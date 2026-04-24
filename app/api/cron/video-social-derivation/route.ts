/**
 * Video Social Derivation Cron — /api/cron/video-social-derivation
 *
 * Runs every 2 hours. Finds published episodes that haven't had their
 * social cascade triggered yet and dispatches the waterfall:
 *
 *   YouTube → LinkedIn (+30m) → Instagram (+60m) → Facebook (+90m)
 *   → Twitter (+120m) → TikTok (+150m) → Pinterest (+180m)
 *
 * vercel.json schedule: "0 *\/2 * * *"
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - CRON_SECRET: Vercel cron authorization secret (SECRET)
 *
 * @task SYN-586
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  findEpisodesNeedingSocialDerivation,
  deriveAndScheduleSocialPosts,
} from '@/lib/video/social-derivation';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = verifyCronRequest(request, 'VIDEO_SOCIAL_DERIVATION');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:video-social-derivation:start', {
    timestamp: new Date().toISOString(),
  });

  try {
    const episodeIds = await findEpisodesNeedingSocialDerivation(5);

    if (episodeIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No episodes pending social derivation',
        processed: 0,
        durationMs: Date.now() - startTime,
      });
    }

    const results = await Promise.allSettled(
      episodeIds.map(id => deriveAndScheduleSocialPosts(id))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('cron:video-social-derivation:end', {
      durationMs: Date.now() - startTime,
      processed: episodeIds.length,
      successful,
      failed,
    });

    return NextResponse.json({
      success: true,
      processed: episodeIds.length,
      successful,
      failed,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('cron:video-social-derivation:fatal', { error: msg });
    return NextResponse.json(
      { error: 'Social derivation cron failed', details: msg },
      { status: 500 }
    );
  }
}
