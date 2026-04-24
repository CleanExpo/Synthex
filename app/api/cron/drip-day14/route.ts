/**
 * Onboarding Drip — Day 14
 *
 * GET /api/cron/drip-day14
 * Runs daily at 9 AM UTC via Vercel Cron.
 * Sends the D+14 power-user feature showcase email to every user whose account
 * was created exactly 14 calendar days ago. Date-window deduplication: each
 * user naturally falls in the window once and only once.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - RESEND_API_KEY: Email delivery key (SECRET)
 * - CRON_SECRET: Vercel cron secret for authorisation (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWelcomeSequenceDay14 } from '@/lib/email/billing-emails';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Authorise: Bearer <CRON_SECRET>
  const auth = verifyCronRequest(request, 'DRIP_DAY14');
  if (!auth.ok) return auth.response;

  try {
    const startTime = Date.now();
    logger.info('cron:drip-day14:start', {
      timestamp: new Date().toISOString(),
    });

    // Target: users whose createdAt is anywhere within the calendar day
    // that is exactly 14 days before today (UTC).
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() - 14);

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        email: { not: undefined },
      },
      select: { id: true, email: true, name: true },
    });

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await sendWelcomeSequenceDay14(user.email, user.name ?? undefined);
        logger.info('[drip-day14] email sent', { userId: user.id });
        sent++;
      } catch (err) {
        logger.error('[drip-day14] email failed', {
          userId: user.id,
          error: err,
        });
        failed++;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('cron:drip-day14:end', {
      timestamp: new Date().toISOString(),
      durationMs,
      sent,
      failed,
    });

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: users.length,
      durationMs,
    });
  } catch (error) {
    logger.error('[drip-day14 cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Drip day-14 cron failed' },
      { status: 500 }
    );
  }
}
