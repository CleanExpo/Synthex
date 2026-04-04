/**
 * GET /api/activity/autonomous
 *
 * Returns the Autonomous Post Log — a chronological record of every auto-publish
 * action Synthex has taken on behalf of this organisation. Queries the
 * publish_queue table which is the authoritative source for auto-publish events.
 *
 * Query params:
 *   cursor  — ISO timestamp for cursor-based pagination (entries before this time)
 *   limit   — max results per page (default 50, max 100)
 *   status  — filter: 'pending' | 'published' | 'failed' | 'held' | 'all' (default: all)
 *
 * @task SYN-551
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const VALID_STATUSES = [
  'pending',
  'publishing',
  'published',
  'failed',
  'held',
  'all',
] as const;

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      );
    }

    const { organizationId } = user;
    const { searchParams } = new URL(request.url);

    const cursor = searchParams.get('cursor');
    const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Math.min(Math.max(1, limitParam), 100);
    const statusParam = searchParams.get('status') ?? 'all';
    const status = VALID_STATUSES.includes(
      statusParam as (typeof VALID_STATUSES)[number]
    )
      ? statusParam
      : 'all';

    const items = await prisma.publishQueueItem.findMany({
      where: {
        organizationId,
        ...(status !== 'all' ? { status } : {}),
        ...(cursor ? { scheduledAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { scheduledAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        platform: true,
        status: true,
        scheduledAt: true,
        publishedAt: true,
        lastError: true,
        attempts: true,
        slotId: true,
        calendar: {
          select: { weekStart: true },
        },
      },
    });

    const hasMore = items.length > limit;
    const entries = items.slice(0, limit);
    const nextCursor = hasMore
      ? entries[entries.length - 1].scheduledAt.toISOString()
      : null;

    // Also fetch the org's current pause state
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { autoPublishPaused: true, calendarMode: true },
    });

    const log = entries.map(item => ({
      id: item.id,
      action: actionFromStatus(item.status),
      platform: item.platform,
      timestamp: (item.publishedAt ?? item.scheduledAt).toISOString(),
      scheduledAt: item.scheduledAt.toISOString(),
      publishedAt: item.publishedAt?.toISOString() ?? null,
      error: item.lastError ?? null,
      attempts: item.attempts,
      slotId: item.slotId,
      weekStart: item.calendar?.weekStart?.toISOString() ?? null,
    }));

    logger.info('GET /api/activity/autonomous', {
      organizationId,
      count: log.length,
    });

    return NextResponse.json({
      log,
      nextCursor,
      hasMore,
      orgState: {
        autoPublishPaused: org?.autoPublishPaused ?? false,
        calendarMode: org?.calendarMode ?? 'shadow',
      },
    });
  } catch (err) {
    logger.error('GET /api/activity/autonomous failed', { error: err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function actionFromStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'scheduled',
    publishing: 'publishing',
    published: 'published',
    failed: 'failed',
    held: 'paused',
  };
  return map[status] ?? status;
}

export const runtime = 'nodejs';
