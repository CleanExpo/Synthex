/**
 * Onboarding Drip — Day 7
 *
 * GET /api/cron/drip-day7
 * Runs daily at 9 AM UTC via Vercel Cron.
 * Sends the D+7 check-in email to every user whose account was created exactly
 * 7 calendar days ago.
 *
 * Idempotency: shares the SAME per-user watermark flag as the welcome-sequence
 * cron (`emailSequenceDay7Sent` in user.preferences). Both crons can target the
 * same user on the same morning; the first to send sets the flag, the second
 * skips — so the D+7 email is sent exactly once, even across crons or on retry.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - RESEND_API_KEY: Email delivery key (SECRET)
 * - CRON_SECRET: Vercel cron secret for authorisation (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWelcomeSequenceDay7 } from '@/lib/email/billing-emails';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Batch cap — bound the per-run workload (matches the all-users daily-post cron).
const MAX_USERS_PER_RUN = 500;

/**
 * Normalise the user.preferences JSON column into a plain object.
 * Mirrors the welcome-sequence cron so both crons read the watermark identically.
 */
function parsePreferences(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed JSON — treat as empty
    }
  }
  return {};
}

export async function GET(request: NextRequest) {
  // Authorise: Bearer <CRON_SECRET>
  const auth = verifyCronRequest(request, 'DRIP_DAY7');
  if (!auth.ok) return auth.response;

  try {
    const startTime = Date.now();
    logger.info('cron:drip-day7:start', {
      timestamp: new Date().toISOString(),
    });

    // Target: users whose createdAt is anywhere within the calendar day
    // that is exactly 7 days before today (UTC).
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() - 7);

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        email: { not: undefined },
      },
      select: { id: true, email: true, name: true, preferences: true },
      take: MAX_USERS_PER_RUN,
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {
      const prefs = parsePreferences(user.preferences);

      // Shared idempotency watermark with the welcome-sequence cron.
      // If D+7 was already sent (by either cron, or a prior retry), skip.
      if (prefs.emailSequenceDay7Sent) {
        skipped++;
        continue;
      }

      try {
        await sendWelcomeSequenceDay7(user.email, user.name ?? undefined);
        logger.info('[drip-day7] email sent', { userId: user.id });

        // Set the watermark — patch the flag, preserve all other preference keys.
        await prisma.user.update({
          where: { id: user.id },
          data: {
            preferences: {
              ...prefs,
              emailSequenceDay7Sent: true,
            },
          },
        });

        sent++;
      } catch (err) {
        logger.error('[drip-day7] email failed', {
          userId: user.id,
          error: err,
        });
        failed++;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('cron:drip-day7:end', {
      timestamp: new Date().toISOString(),
      durationMs,
      sent,
      skipped,
      failed,
    });

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      total: users.length,
      durationMs,
    });
  } catch (error) {
    logger.error('[drip-day7 cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Drip day-7 cron failed' },
      { status: 500 }
    );
  }
}
