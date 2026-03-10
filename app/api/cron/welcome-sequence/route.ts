/**
 * Welcome Email Sequence Cron Job
 *
 * GET /api/cron/welcome-sequence
 * Runs daily at 9 AM UTC via Vercel Cron.
 * Sends D+3 and D+7 nurture emails to new users who completed onboarding.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - RESEND_API_KEY: Email delivery key (SECRET)
 * - CRON_SECRET: Vercel cron secret for authorisation (SECRET)
 *
 * Gating logic (stored in user.preferences JSON):
 *   emailSequenceStartedAt  — ISO timestamp written at onboarding complete
 *   emailSequenceDay3Sent   — boolean, set true after D+3 is dispatched
 *   emailSequenceDay7Sent   — boolean, set true after D+7 is dispatched
 *
 * D+7 is only sent to users without an active paid subscription (free/starter tier).
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  sendWelcomeSequenceDay3,
  sendWelcomeSequenceDay7,
} from '@/lib/email/billing-emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes max — lightweight email dispatch

// ============================================================================
// TYPES
// ============================================================================

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  preferences: Record<string, unknown> | null;
}

// Raw query returns these columns from the users table
interface RawUserRow {
  id: string;
  email: string;
  name: string | null;
  preferences: unknown;
}

// ============================================================================
// HELPERS
// ============================================================================

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function parsePreferences(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed JSON — treat as empty
    }
  }
  return {};
}

// ============================================================================
// GET — Cron handler
// ============================================================================

export async function GET(request: NextRequest) {
  // Authorise: Bearer <CRON_SECRET> (keep OUTSIDE monitor)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  return Sentry.withMonitor('cron-welcome-sequence', async () => {
  try {
    const startTime = Date.now();

    // Fetch all users whose preferences contain emailSequenceStartedAt.
    // Prisma does not support dot-path JSON filtering in `where`, so we use
    // a raw query to filter at the database level for efficiency.
    const rawUsers = await prisma.$queryRaw<RawUserRow[]>`
      SELECT id, email, name, preferences
      FROM "users"
      WHERE preferences IS NOT NULL
        AND preferences->>'emailSequenceStartedAt' IS NOT NULL
    `;

    const now = Date.now();
    let day3Sent = 0;
    let day7Sent = 0;
    let errors = 0;

    for (const rawUser of rawUsers) {
      const user: UserRow = {
        id: rawUser.id,
        email: rawUser.email,
        name: rawUser.name,
        preferences: parsePreferences(rawUser.preferences),
      };

      const prefs = user.preferences ?? {};
      const startedAt = prefs.emailSequenceStartedAt;

      if (typeof startedAt !== 'string') continue;

      const startedAtMs = new Date(startedAt).getTime();
      if (isNaN(startedAtMs)) continue;

      const elapsedMs = now - startedAtMs;

      // ---- D+3 ----
      if (elapsedMs >= THREE_DAYS_MS && !prefs.emailSequenceDay3Sent) {
        try {
          sendWelcomeSequenceDay3(user.email, user.name ?? undefined);

          // Mark as sent immediately — fire-and-forget means we can't confirm
          // delivery, but we must prevent duplicate sends on the next cron run.
          await prisma.user.update({
            where: { id: user.id },
            data: {
              preferences: {
                ...prefs,
                emailSequenceDay3Sent: true,
              },
            },
          });

          day3Sent++;
        } catch (err) {
          logger.error(`[welcome-sequence] D+3 failed for user ${user.id}:`, err);
          errors++;
        }
      }

      // ---- D+7 ----
      // Only send to users without an active paid subscription (free/starter).
      if (elapsedMs >= SEVEN_DAYS_MS && !prefs.emailSequenceDay7Sent) {
        try {
          // Check subscription status — skip paid users
          const subscription = await prisma.subscription.findUnique({
            where: { userId: user.id },
            select: { plan: true, status: true },
          });

          const isPaidAndActive =
            subscription !== null &&
            ['active', 'trialing'].includes(subscription.status) &&
            !['free', 'starter'].includes(subscription.plan);

          if (!isPaidAndActive) {
            sendWelcomeSequenceDay7(user.email, user.name ?? undefined);

            await prisma.user.update({
              where: { id: user.id },
              data: {
                preferences: {
                  ...prefs,
                  emailSequenceDay7Sent: true,
                },
              },
            });

            day7Sent++;
          }
        } catch (err) {
          logger.error(`[welcome-sequence] D+7 failed for user ${user.id}:`, err);
          errors++;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      day3Sent,
      day7Sent,
      errors,
      totalUsersChecked: rawUsers.length,
      durationMs,
    });
  } catch (error) {
    logger.error('[welcome-sequence cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Welcome sequence cron failed' },
      { status: 500 }
    );
  }
  }); // end Sentry.withMonitor
}
