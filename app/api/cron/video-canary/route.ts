/**
 * Weekly video-model drift canary — /api/cron/video-canary
 *
 * Registry-driven, spend-capped, end-to-end proof that the cheapest live
 * draft-tier video model still resolves and renders. Runs against a
 * dedicated internal canary org (never a client org) so a fal model
 * retirement (spec: WS2 / SYN-1075 — Wan 2.5 + Hailuo 2.3 both retired
 * silently in the same week) is caught on a schedule instead of by the next
 * real customer generation.
 *
 * vercel.json schedule: "0 6 * * 1" (Monday 06:00 UTC, weekly)
 *
 * ENVIRONMENT VARIABLES:
 * - CRON_SECRET / CRON_SECRET_VIDEO_CANARY: cron authorization (see cron-auth.ts)
 * - VIDEO_CANARY_MAX_SPEND_USD: hard spend cap in USD (default 0.15)
 * - FAL_API_KEY / FAL_WEBHOOK_SECRET / NEXT_PUBLIC_APP_URL: fal submit deps
 *
 * The canary never runs unattended in this repo's test suite — jest mocks
 * prisma + the fal provider entirely (see tests/unit/api/video-canary-cron.test.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 270;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'VIDEO_CANARY');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:video-canary:start', {
    timestamp: new Date().toISOString(),
  });

  try {
    // Dynamic import so the canary's provider/quota dependency graph never
    // loads into the shared serverless bundle unless this route actually runs
    // (matches the social-cut-render cron's pattern).
    const { runVideoCanary } = await import('@/lib/video/drift-canary');

    const result = await runVideoCanary();
    const durationMs = Date.now() - startTime;

    logger.info('cron:video-canary:end', { durationMs, ...result });

    // 200 for pass/skipped (both are clean, non-alerting runs from the
    // route's perspective — 'skipped' already fired its own Sentry warning);
    // 500 for fail so Vercel's cron failure surfacing + any uptime monitor
    // on this endpoint reflects the real drift signal, in addition to the
    // Sentry event already captured inside runVideoCanary.
    const status = result.status === 'fail' ? 500 : 200;

    return NextResponse.json(
      { success: result.status !== 'fail', durationMs, ...result },
      { status }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('cron:video-canary:fatal', { error: msg });
    return NextResponse.json(
      { error: 'Video canary cron failed', details: msg },
      { status: 500 }
    );
  }
}
