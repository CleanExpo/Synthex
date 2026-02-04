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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Validation schemas
const createNotificationSchema = z.object({
  type: z.enum(['info', 'warning', 'error', 'success']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  data: z.record(z.unknown()).optional(),
  userId: z.string().cuid().optional() // If not provided, uses authenticated user
});

const querySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional()
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
      offset: url.searchParams.get('offset') || undefined
    };

    const query = querySchema.parse(queryParams);
    const limit = query.limit ? parseInt(query.limit) : 50;
    const offset = query.offset ? parseInt(query.offset) : 0;

    // Build where clause
    const whereClause: any = {
      userId: security.context.userId
    };

    if (query.unreadOnly === 'true') {
      whereClause.read = false;
    }

    // Fetch notifications from database
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100), // Cap at 100
        skip: offset,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          data: true,
          createdAt: true
        }
      }),
      prisma.notification.count({ where: whereClause })
    ]);

    // Count unread
    const unreadCount = await prisma.notification.count({
      where: {
        userId: security.context.userId,
        read: false
      }
    });

    return APISecurityChecker.createSecureResponse(
      {
        data: notifications,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + notifications.length < total
        },
        unreadCount
      },
      200,
      security.context
    );

  } catch (error) {
    console.error('Notifications fetch error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid query parameters', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch notifications' },
      500,
      security.context
    );
  } finally {
    await prisma.$disconnect();
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
        data: data.data ? (data.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        userId: targetUserId!
      },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        data: true,
        createdAt: true
      }
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        data: notification
      },
      201,
      security.context
    );

  } catch (error) {
    console.error('Notification creation error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid notification data', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create notification' },
      500,
      security.context
    );
  } finally {
    await prisma.$disconnect();
  }
}
