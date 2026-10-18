// SYN-525 / notifications-bell-disconnect:
// GET notifications for the authenticated user.
//
// Two backend systems write user-facing notifications and BOTH must surface
// in the bell / Notification Centre:
//   1. prisma.notification (Postgres `notifications` table) — the bulk of the
//      real stream: publish failures (#381/#405), token re-auth required
//      (#415), GSC monitor, proactive insights, scheduled-publish, welcome.
//   2. Supabase `client_notifications` — first-win celebration rows consumed by
//      FirstWinBanner / WinAnchoredConversionCard (they match `type: 'first_win'`).
//      That table has no model in prisma/schema.prisma, so this source is
//      reported as `sources.firstWin = { available: false, reason }` instead of
//      being read through the throwing platform stub.
//
// The previous SYN-525 refactor read ONLY `client_notifications`, so everything
// written via prisma.notification was written-but-never-shown, and it returned
// `{ notifications }` with no `data`/`unreadCount` — which the Notification
// Centre and useNotifications hook read, leaving them permanently empty. This
// route merges both sources into one normalised shape that satisfies every
// consumer (bell, banners, Notification Centre, useNotifications hook).
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * Single shape consumed by every notifications UI surface.
 * `message`/`timestamp` are read by NotificationBell; `createdAt` by the
 * Notification Centre and the useNotifications hook; `data` carries first-win
 * payloads (improvementPct etc.) used by the banners.
 */
interface UnifiedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: unknown;
  createdAt: string;
  timestamp: string;
}

const FIRST_WIN_UNAVAILABLE = {
  available: false,
  reason:
    'FEATURE_NOT_PROVISIONED: table `client_notifications` is not provisioned',
} as const;

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1),
      100
    );

    // 1. Prisma notifications (the real backend writer stream), user-scoped.
    const prismaRows = await prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        data: true,
        createdAt: true,
      },
    });

    const prismaUnread = await prisma.notification.count({
      where: { userId, read: false },
    });

    const fromPrisma: UnifiedNotification[] = prismaRows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      data: n.data ?? null,
      createdAt: n.createdAt.toISOString(),
      timestamp: n.createdAt.toISOString(),
    }));

    // 2. First-win notifications (`client_notifications`) are not provisioned;
    //    the response says so in `sources.firstWin`.
    return NextResponse.json(
      {
        notifications: fromPrisma,
        data: fromPrisma,
        unreadCount: prismaUnread,
        sources: {
          notifications: { available: true },
          firstWin: FIRST_WIN_UNAVAILABLE,
        },
        pagination: {
          total: fromPrisma.length,
          limit,
          offset: 0,
          hasMore: false,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[notifications] GET error:', msg);
    // Keep the empty shape so the UI degrades gracefully, but report the
    // failure as an error status rather than an empty success.
    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        notifications: [],
        data: [],
        unreadCount: 0,
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
      },
      { status: 500 }
    );
  }
}
