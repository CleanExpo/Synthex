/**
 * Notifications API
 * GET /api/notifications - List user notifications
 * POST /api/notifications - Create a notification (admin/system only)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { NotificationChannel } from '@/lib/websocket/notification-channel';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';

const NOTIFICATIONS_CACHE_TTL = 60; // seconds

// Validation schemas
const createNotificationSchema = z.object({
  type: z.enum(['info', 'warning', 'error', 'success']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  data: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().cuid().optional(), // If not provided, uses authenticated user
});

const querySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

/**
 * GET /api/notifications
 * Returns notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      unreadOnly: url.searchParams.get('unreadOnly') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
    };

    const query = querySchema.parse(queryParams);
    const limit = query.limit ? parseInt(query.limit) : 50;
    const offset = query.offset ? parseInt(query.offset) : 0;

    // ── Cache read ──────────────────────────────────────────────────────────
    const userId = security.context.userId!;
    const paramsHash = `${query.unreadOnly ?? 'all'}:${limit}:${offset}`;
    const cacheKey = `synthex:cache:notifications:${userId}:${paramsHash}`;
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return APISecurityChecker.createSecureResponse(
          JSON.parse(cached),
          200,
          security.context
        );
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    // Build where clause
    const whereClause: {
      userId: string;
      read?: boolean;
    } = {
      userId: security.context.userId!, // Validated by security check above
    };

    if (query.unreadOnly === 'true') {
      whereClause.read = false;
    }

    // Fetch notifications, total count, and unread count in parallel
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 50), // Cap at 50 (LIFO — recent notifications only)
        skip: offset,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          data: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({
        where: {
          userId: security.context.userId!,
          read: false,
        },
      }),
    ]);

    const responseData = {
      data: notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notifications.length < total,
      },
      unreadCount,
    };

    // ── Cache write ─────────────────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      await redis.set(
        cacheKey,
        JSON.stringify(responseData),
        NOTIFICATIONS_CACHE_TTL
      );
    } catch {
      // Non-fatal — response already built
    }

    return APISecurityChecker.createSecureResponse(
      responseData,
      200,
      security.context
    );
  } catch (error) {
    logger.error('Notifications fetch error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid query parameters', details: error.issues },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch notifications' },
      500,
      security.context
    );
  }
}

/**
 * POST /api/notifications
 * Creates a new notification (typically called by system/admin)
 */
export async function POST(request: NextRequest) {
  // Security check - requires authentication with write permissions
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

  try {
    // Parse and validate request body
    const body = await request.json();
    const data = createNotificationSchema.parse(body);

    // Determine target user
    const targetUserId = data.userId || security.context.userId;

    // Only admins can create notifications for other users
    if (data.userId && data.userId !== security.context.userId) {
      if (security.context.userRole !== 'admin') {
        return APISecurityChecker.createSecureResponse(
          { error: 'Cannot create notifications for other users' },
          403,
          security.context
        );
      }
    }

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data
          ? (data.data as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        userId: targetUserId!,
      },
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

    // Broadcast via WebSocket/SSE for real-time delivery
    try {
      await NotificationChannel.notify(targetUserId!, {
        type: data.type as 'info' | 'success' | 'warning' | 'error',
        title: data.title,
        message: data.message,
        data: data.data,
        priority: 'normal',
      });
    } catch {
      // Real-time delivery is best-effort, don't fail the request
    }

    // ── Cache invalidation ──────────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      const cacheKeys = await redis.keys(
        `synthex:cache:notifications:${targetUserId}:*`
      );
      if (cacheKeys.length > 0) await redis.del(cacheKeys);
    } catch {
      // Non-fatal
    }

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        data: notification,
      },
      201,
      security.context
    );
  } catch (error) {
    logger.error('Notification creation error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid notification data', details: error.issues },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create notification' },
      500,
      security.context
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark one or all notifications as read.
 * Body: { notificationId: string | 'all', action: 'markRead' }
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

  try {
    const body = await request.json();
    const { notificationId } = z
      .object({
        notificationId: z.union([z.string().cuid(), z.literal('all')]),
      })
      .parse(body);

    const userId = security.context.userId!;

    if (notificationId === 'all') {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    } else {
      // Verify ownership before marking read
      const existing = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { userId: true },
      });

      if (!existing) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Notification not found' },
          404,
          security.context
        );
      }

      if (existing.userId !== userId) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Not authorised' },
          403,
          security.context
        );
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });
    }

    // Invalidate notifications cache
    try {
      const redis = getRedisClient();
      const cacheKeys = await redis.keys(
        `synthex:cache:notifications:${userId}:*`
      );
      if (cacheKeys.length > 0) await redis.del(cacheKeys);
    } catch {
      // Non-fatal
    }

    return APISecurityChecker.createSecureResponse(
      { success: true },
      200,
      security.context
    );
  } catch (error) {
    logger.error('Notification mark-read error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request body', details: error.issues },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update notification' },
      500,
      security.context
    );
  }
}

export const runtime = 'nodejs';
