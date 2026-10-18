/**
 * Mark All Notifications as Read API
 * PATCH /api/notifications/read-all - Mark every unread prisma.notification for
 * the authenticated user as read. The Supabase `client_notifications` first-win
 * table has no model in prisma/schema.prisma, so that half of the write is not
 * performed and the response reports `firstWin: { available: false, reason }`.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * PATCH /api/notifications/read-all
 * Marks all of the authenticated user's unread notifications as read.
 */
export async function PATCH(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  const userId = security.context.userId;

  try {
    // 1. Prisma notifications (the bulk of the stream), user-scoped.
    const { count } = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    // Invalidate the notifications GET cache so the unread badge reflects the
    // change immediately rather than waiting for the TTL to expire.
    try {
      const { getRedisClient } = await import('@/lib/redis-client');
      const redis = getRedisClient();
      const cacheKeys = await redis.keys(
        `synthex:cache:notifications:${userId}:*`
      );
      if (cacheKeys.length > 0) await redis.del(cacheKeys);
    } catch {
      /* non-fatal */
    }

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        markedRead: count,
        firstWin: {
          available: false,
          reason:
            'FEATURE_NOT_PROVISIONED: table `client_notifications` is not provisioned',
        },
      },
      200,
      security.context
    );
  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to mark notifications as read' },
      500,
      security.context
    );
  }
}
