/**
 * Video Production Cron — /api/cron/video-production
 *
 * Twice-weekly production trigger: Tuesday + Thursday at 6:00 AM AEST.
 * AEST = UTC+10, so 6 AM AEST = 8 PM Monday + Wednesday UTC.
 * vercel.json schedule: "0 20 * * 1,3"
 *
 * For each active VideoSeries, pulls the next pending topic and runs
 * the full production pipeline: script → capture → quality gate → upload.
 *
 * Long-running episodes (>5 min) should use the Supabase Edge Function
 * at /supabase/functions/video-produce instead. This route handles the
 * scheduling handoff and short-circuit if the pipeline exceeds 4 minutes.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - CRON_SECRET: Vercel cron authorization secret (SECRET)
 * - DEMO_USER_EMAIL: Dashboard login for capture (SECRET)
 * - DEMO_USER_PASSWORD: Dashboard password (SECRET)
 * - YOUTUBE_CLIENT_ID: YouTube OAuth client ID (SECRET, optional)
 * - YOUTUBE_CLIENT_SECRET: YouTube OAuth secret (SECRET, optional)
 * - YOUTUBE_REFRESH_TOKEN: YouTube refresh token (SECRET, optional)
 *
 * @task SYN-581
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllSeriesPipelines } from '@/lib/video/production-pipeline';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel hobby/pro max — 5 minutes

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = verifyCronRequest(request, 'VIDEO_PRODUCTION');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:video-production:start', {
    timestamp: new Date().toISOString(),
  });

  try {
    // Allow override via query param for manual testing
    const url = new URL(request.url);
    const seriesSlug = url.searchParams.get('series') ?? undefined;
    const skipUpload = url.searchParams.get('skipUpload') === 'true';

    const results = await runAllSeriesPipelines({
      seriesSlug,
      skipUpload,
      login: {
        email: process.env.DEMO_USER_EMAIL ?? '',
        password: process.env.DEMO_USER_PASSWORD ?? '',
      },
    });

    const durationMs = Date.now() - startTime;
    const published = results.filter(r => r.status === 'published').length;
    const held = results.filter(r => r.status === 'held').length;

    logger.info('cron:video-production:end', {
      durationMs,
      total: results.length,
      published,
      held,
    });

    return NextResponse.json({
      success: true,
      durationMs,
      results: results.map(r => ({
        seriesSlug: r.seriesSlug,
        episodeNumber: r.episodeNumber,
        status: r.status,
        youtubeUrl: r.youtubeUrl ?? null,
        error: r.error ?? null,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('cron:video-production:fatal', { error: msg });
    return NextResponse.json(
      { error: 'Video production cron failed', details: msg },
      { status: 500 }
    );
  }
}
