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
// NOTE: Static Sentry import removed (2026-03-12, Phase 114-02) — see next.config.mjs.
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  sendWelcomeSequenceDay3,
  sendWelcomeSequenceDay7,
} from '@/lib/email/billing-emails';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { captureServerException } from '@/lib/observability/sentry-server';
import { Prisma } from '@prisma/client';

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

/**
 * Set a single boolean flag inside a user's `preferences` JSON without
 * clobbering other keys.
 *
 * The cron reads every user's preferences up-front in one bulk query, then
 * processes them sequentially. A concurrent update to `user.preferences`
 * (e.g. the user changing a setting) between that snapshot read and the write
 * here would be lost if we wrote back the stale in-memory snapshot. To avoid
 * that, we re-read the latest preferences immediately before writing and merge
 * only the target flag in.
 */
async function setPreferenceFlag(
  userId: string,
  flag: 'emailSequenceDay3Sent' | 'emailSequenceDay7Sent'
): Promise<void> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const latestPrefs = parsePreferences(current?.preferences);

  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...latestPrefs,
        [flag]: true,
      } as Prisma.InputJsonValue,
    },
  });
}

// ============================================================================
// GET — Cron handler
// ============================================================================

export async function GET(request: NextRequest) {
  // Authorise: Bearer <CRON_SECRET> (keep OUTSIDE monitor)
  const auth = verifyCronRequest(request, 'WELCOME_SEQUENCE');
  if (!auth.ok) return auth.response;

  // NOTE: Sentry.withMonitor() removed — no-op without server-side Sentry.init().
  try {
    const startTime = Date.now();
    logger.info('cron:welcome-sequence:start', {
      timestamp: new Date().toISOString(),
    });

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
          await sendWelcomeSequenceDay3(user.email, user.name ?? undefined);
          logger.info('[welcome-sequence] D+3 email sent', { userId: user.id });

          // Patch only this flag (re-reads latest prefs) so a concurrent
          // preferences change isn't clobbered by the stale bulk-read snapshot.
          await setPreferenceFlag(user.id, 'emailSequenceDay3Sent');

          day3Sent++;
        } catch (err) {
          logger.error('[welcome-sequence] D+3 email failed', {
            userId: user.id,
            error: err,
          });
          // Don't throw — mark failure and continue processing other users
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
            try {
              await sendWelcomeSequenceDay7(user.email, user.name ?? undefined);
              logger.info('[welcome-sequence] D+7 email sent', {
                userId: user.id,
              });
            } catch (emailError) {
              logger.error('[welcome-sequence] D+7 email failed', {
                userId: user.id,
                error: emailError,
              });
              // Don't throw — mark failure and continue processing other users
              errors++;
              continue;
            }

            // Patch only this flag (re-reads latest prefs) so a concurrent
            // preferences change isn't clobbered by the stale bulk-read snapshot.
            await setPreferenceFlag(user.id, 'emailSequenceDay7Sent');

            day7Sent++;
          }
        } catch (err) {
          logger.error(
            '[welcome-sequence] D+7 failed for user ' + user.id,
            err
          );
          errors++;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('cron:welcome-sequence:end', {
      timestamp: new Date().toISOString(),
      durationMs,
      day3Sent,
      day7Sent,
      errors,
    });

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
    // Alert on fatal failure — a silent death here breaks onboarding nurture for
    // every new user. Replaces the static Sentry import removed in Phase 114-02
    // (see top of file) with the SDK-free transport. DSN-gated no-op;
    // secret-scrubbed (no email addresses / Resend key in tags/extra).
    captureServerException(error, {
      level: 'error',
      operation: 'cron/welcome-sequence',
      tags: { cron: 'welcome-sequence' },
    });
    return NextResponse.json(
      { error: 'Welcome sequence cron failed' },
      { status: 500 }
    );
  }
}
