/**
 * Team Notifications API Route
 *
 * @description Manages team-specific notifications:
 * - GET: List notifications for user
 * - PATCH: Mark notifications as read
 * - DELETE: Delete notifications
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 on database errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAllRead: z.boolean().optional(),
});

const createNotificationSchema = z.object({
  recipientId: z.string().optional(),
  recipientIds: z.array(z.string()).optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  actionUrl: z.string().optional(),
  relatedContentType: z.string().optional(),
  relatedContentId: z.string().optional(),
  organizationId: z.string().optional(),
});

// ============================================================================
// TYPES
// ============================================================================

type NotificationType =
  | 'invitation'
  | 'role_change'
  | 'content_shared'
  | 'mention'
  | 'comment'
  | 'access_request'
  | 'team_update';

/** Team notification record */
interface TeamNotificationRecord {
  id: string;
  userId: string;
  organizationId?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: Date;
  actionUrl?: string;
  relatedUserId?: string;
  relatedContentType?: string;
  relatedContentId?: string;
  expiresAt?: Date;
  createdAt: Date;
}

/** Extended prisma client for team notifications */
interface PrismaWithTeamNotification {
  teamNotification?: {
    findMany: (args: Record<string, unknown>) => Promise<TeamNotificationRecord[]>;
    findUnique: (args: Record<string, unknown>) => Promise<TeamNotificationRecord | null>;
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
    deleteMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
    delete: (args: Record<string, unknown>) => Promise<void>;
    createMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
}

/** Notification where clause */
interface NotificationWhereClause {
  userId: string;
  type?: NotificationType;
  read?: boolean;
  OR?: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }>;
}

// ============================================================================
// GET /api/teams/notifications
// List notifications for user
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') as NotificationType | null;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const where: NotificationWhereClause = {
      userId,
    };

    if (type) {
      where.type = type;
    }

    if (unreadOnly) {
      where.read = false;
    }

    // Filter out expired notifications
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ];

    // Get notifications
    const extendedPrisma = prisma as unknown as PrismaWithTeamNotification;
    const [notifications, total, unreadCount] = await Promise.all([
      extendedPrisma.teamNotification?.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }) || [],
      extendedPrisma.teamNotification?.count({ where }) || 0,
      extendedPrisma.teamNotification?.count({
        where: { userId, read: false },
      }) || 0,
    ]);

    // Get related user info for notifications
    const relatedUserIds = new Set<string>();
    (notifications || []).forEach((n: TeamNotificationRecord) => {
      if (n.relatedUserId) relatedUserIds.add(n.relatedUserId);
    });

    const relatedUsers = relatedUserIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(relatedUserIds) } },
          select: { id: true, name: true, avatar: true },
        })
      : [];

    const userMap = new Map(relatedUsers.map((u) => [u.id, u]));

    // Enrich notifications
    const enrichedNotifications = (notifications || []).map((n: TeamNotificationRecord) => ({
      ...n,
      relatedUser: n.relatedUserId ? userMap.get(n.relatedUserId) : null,
    }));

    return NextResponse.json({
      notifications: enrichedNotifications,
      total: total || 0,
      unreadCount: unreadCount || 0,
      hasMore: (notifications?.length || 0) === limit,
    });
  } catch (error) {
    console.error('Get team notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/teams/notifications
// Mark notifications as read
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const rawBody = await request.json();
    const validation = markNotificationsReadSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { notificationIds, markAllRead } = validation.data;

    if (!markAllRead && (!notificationIds || notificationIds.length === 0)) {
      return NextResponse.json(
        { error: 'notificationIds array or markAllRead flag required' },
        { status: 400 }
      );
    }

    const updateData = {
      read: true,
      readAt: new Date(),
    };

    const extendedPrisma = prisma as unknown as PrismaWithTeamNotification;

    if (markAllRead) {
      // Mark all as read
      const result = await extendedPrisma.teamNotification?.updateMany({
        where: {
          userId,
          read: false,
        },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        updatedCount: result?.count || 0,
      });
    } else {
      // Mark specific notifications
      const result = await extendedPrisma.teamNotification?.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // Security: only update own notifications
        },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        updatedCount: result?.count || 0,
      });
    }
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/teams/notifications
// Delete notifications
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const notificationId = searchParams.get('id');
    const deleteAll = searchParams.get('deleteAll') === 'true';
    const deleteRead = searchParams.get('deleteRead') === 'true';

    const extendedPrisma = prisma as unknown as PrismaWithTeamNotification;

    if (deleteAll) {
      // Delete all notifications for user
      const result = await extendedPrisma.teamNotification?.deleteMany({
        where: { userId },
      });

      return NextResponse.json({
        success: true,
        deletedCount: result?.count || 0,
      });
    }

    if (deleteRead) {
      // Delete read notifications
      const result = await extendedPrisma.teamNotification?.deleteMany({
        where: {
          userId,
          read: true,
        },
      });

      return NextResponse.json({
        success: true,
        deletedCount: result?.count || 0,
      });
    }

    if (notificationId) {
      // Delete specific notification
      const notification = await extendedPrisma.teamNotification?.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }

      if (notification.userId !== userId) {
        return NextResponse.json(
          { error: 'Not authorized to delete this notification' },
          { status: 403 }
        );
      }

      await extendedPrisma.teamNotification?.delete({
        where: { id: notificationId },
      });

      return NextResponse.json({
        success: true,
        deletedCount: 1,
      });
    }

    return NextResponse.json(
      { error: 'Specify id, deleteAll=true, or deleteRead=true' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Delete notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/teams/notifications
// Create a notification (internal/admin use)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const senderId = security.context.userId!;
    const rawBody = await request.json();
    const validation = createNotificationSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const {
      recipientId,
      recipientIds,
      type,
      title,
      message,
      actionUrl,
      relatedContentType,
      relatedContentId,
      organizationId,
    } = validation.data;

    if (!recipientId && (!recipientIds || !recipientIds.length)) {
      return NextResponse.json(
        { error: 'recipientId or recipientIds required' },
        { status: 400 }
      );
    }

    const recipients: string[] = recipientIds || [recipientId!];

    // Create notifications for all recipients
    const notifications = recipients.map((userId: string) => ({
      userId,
      organizationId,
      type,
      title,
      message,
      actionUrl,
      relatedUserId: senderId,
      relatedContentType,
      relatedContentId,
    }));

    const extendedPrisma = prisma as unknown as PrismaWithTeamNotification;
    const result = await extendedPrisma.teamNotification?.createMany({
      data: notifications,
    });

    return NextResponse.json({
      success: true,
      createdCount: result?.count || 0,
    });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
