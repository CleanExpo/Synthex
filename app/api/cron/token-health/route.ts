/**
 * Connection Token-Health Monitor Cron
 *
 * GET /api/cron/token-health
 * Runs daily via Vercel Cron.
 *
 * The "stay on top of it" safety net behind the refresh crons. It reports every
 * connection that is still active but whose access token has already expired —
 * the connections a client sees as "not connected / no data". The proactive
 * refreshers (`refresh-tokens` for socials, `google-token-refresh` for Google
 * data platforms) should keep this near zero; anything that lingers here is a
 * gap that needs a manual reconnect (e.g. LinkedIn / Facebook page tokens with
 * no working refresh).
 *
 * It LOGS a structured report (observability) and, when there are expired-active
 * connections, sends the platform owner(s) a digest notification so the problem
 * is visible without anyone logging in to check.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL   PostgreSQL connection (CRITICAL)
 * - CRON_SECRET    Vercel cron authorisation (SECRET)
 * - OWNER_EMAILS   Comma-separated owner emails to alert (lowercase)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronRequest(request, 'TOKEN_HEALTH');
  if (!auth.ok) return auth.response;

  const now = new Date();
  // Warn this far ahead for connections that can't self-heal (no refresh token),
  // so a periodic-reconnect platform (LinkedIn / Facebook page tokens) never
  // dies as a surprise — you get a heads-up before it breaks.
  const SOON_MS = 7 * 24 * 60 * 60 * 1000;
  const soon = new Date(now.getTime() + SOON_MS);
  const noRefresh = { OR: [{ refreshToken: null }, { refreshToken: '' }] };

  // Active, non-deleted connections whose token has already expired.
  const expired = await prisma.platformConnection.findMany({
    where: { isActive: true, deletedAt: null, expiresAt: { lt: now } },
    select: {
      platform: true,
      profileName: true,
      userId: true,
      expiresAt: true,
    },
  });

  // Active connections expiring within the window that CANNOT auto-refresh.
  // (Ones with a refresh token will be kept alive by the refresh crons, so they
  // are not a surprise risk and are intentionally excluded here.)
  const expiringSoon = await prisma.platformConnection.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...noRefresh,
      expiresAt: { gte: now, lt: soon },
    },
    select: {
      platform: true,
      profileName: true,
      userId: true,
      expiresAt: true,
    },
  });

  const byPlatform: Record<string, number> = {};
  for (const c of expired) {
    byPlatform[c.platform] = (byPlatform[c.platform] ?? 0) + 1;
  }

  logger.info('cron:token-health', {
    expiredActive: expired.length,
    expiringSoonNoRefresh: expiringSoon.length,
    byPlatform,
  });

  // Alert the owner(s) when anything is broken OR about to break with no self-heal.
  let alerted = 0;
  if (expired.length > 0 || expiringSoon.length > 0) {
    const owners = ownerEmails();
    if (owners.length > 0) {
      const ownerUsers = await prisma.user.findMany({
        where: { email: { in: owners } },
        select: { id: true },
      });

      if (ownerUsers.length > 0) {
        const summary = Object.entries(byPlatform)
          .sort((a, b) => b[1] - a[1])
          .map(([p, n]) => `${p} (${n})`)
          .join(', ');
        const expiredLine = expired.length ? `Expired now: ${summary}. ` : '';
        const soonNames = [
          ...new Set(expiringSoon.map(c => c.profileName ?? c.platform)),
        ].join(', ');
        const soonLine = expiringSoon.length
          ? `Expiring within 7 days (can't auto-refresh — reconnect ahead of time): ${soonNames}.`
          : '';

        await prisma.notification.createMany({
          data: ownerUsers.map(u => ({
            userId: u.id,
            type: 'warning',
            title: `${expired.length + expiringSoon.length} integration${expired.length + expiringSoon.length === 1 ? '' : 's'} need attention`,
            message: `${expiredLine}${soonLine}`.trim(),
            data: {
              expiredActive: expired.length,
              expiringSoonNoRefresh: expiringSoon.length,
              byPlatform,
            } as never,
            read: false,
          })),
        });
        alerted = ownerUsers.length;
      }
    }
  }

  return NextResponse.json({
    success: true,
    expiredActive: expired.length,
    expiringSoonNoRefresh: expiringSoon.length,
    byPlatform,
    alerted,
  });
}
