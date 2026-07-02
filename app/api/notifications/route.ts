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
//
// The previous SYN-525 refactor read ONLY `client_notifications`, so everything
// written via prisma.notification was written-but-never-shown, and it returned
// `{ notifications }` with no `data`/`unreadCount` — which the Notification
// Centre and useNotifications hook read, leaving them permanently empty. This
// route merges both sources into one normalised shape that satisfies every
// consumer (bell, banners, Notification Centre, useNotifications hook).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

interface FirstWinRow {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  payload: unknown;
  read: boolean | null;
  created_at: string;
}

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

    // 2. Supabase first-win notifications (best-effort — never break the bell
    //    if the table/env is unavailable).
    let fromFirstWin: UnifiedNotification[] = [];
    let firstWinUnread = 0;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        let query = supabase
          .from('client_notifications')
          .select('id, type, title, body, payload, read, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (unreadOnly) query = query.eq('read', false);

        const { data, error } = await query;
        if (error) {
          logger.error('[notifications] first-win query error:', error.message);
        } else {
          const rows = (data ?? []) as FirstWinRow[];
          fromFirstWin = rows.map(r => ({
            id: r.id,
            type: r.type ?? 'info',
            title: r.title ?? '',
            message: r.body ?? '',
            read: r.read ?? false,
            data: r.payload ?? null,
            createdAt: r.created_at,
            timestamp: r.created_at,
          }));
          firstWinUnread = rows.filter(r => !r.read).length;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('[notifications] first-win fetch failed:', msg);
      }
    }

    // 3. Merge, newest first, capped at the requested limit.
    const merged = [...fromPrisma, ...fromFirstWin]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);

    const unreadCount = prismaUnread + firstWinUnread;

    return NextResponse.json(
      {
        notifications: merged,
        data: merged,
        unreadCount,
        pagination: {
          total: merged.length,
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
    // Keep the empty-shape contract so the UI degrades gracefully.
    return NextResponse.json({
      notifications: [],
      data: [],
      unreadCount: 0,
      pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
    });
  }
}
