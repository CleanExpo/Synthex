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
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

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
    const where: any = {
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
    const [notifications, total, unreadCount] = await Promise.all([
      (prisma as any).teamNotification?.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }) || [],
      (prisma as any).teamNotification?.count({ where }) || 0,
      (prisma as any).teamNotification?.count({
        where: { userId, read: false },
      }) || 0,
    ]);

    // Get related user info for notifications
    const relatedUserIds = new Set<string>();
    (notifications || []).forEach((n: any) => {
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
    const enrichedNotifications = (notifications || []).map((n: any) => ({
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
    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    if (!markAllRead && (!notificationIds || !Array.isArray(notificationIds))) {
      return NextResponse.json(
        { error: 'notificationIds array or markAllRead flag required' },
        { status: 400 }
      );
    }

    const updateData = {
      read: true,
      readAt: new Date(),
    };

    if (markAllRead) {
      // Mark all as read
      const result = await (prisma as any).teamNotification?.updateMany({
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
      const result = await (prisma as any).teamNotification?.updateMany({
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

    if (deleteAll) {
      // Delete all notifications for user
      const result = await (prisma as any).teamNotification?.deleteMany({
        where: { userId },
      });

      return NextResponse.json({
        success: true,
        deletedCount: result?.count || 0,
      });
    }

    if (deleteRead) {
      // Delete read notifications
      const result = await (prisma as any).teamNotification?.deleteMany({
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
      const notification = await (prisma as any).teamNotification?.findUnique({
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

      await (prisma as any).teamNotification?.delete({
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
    const body = await request.json();
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
    } = body;

    if (!recipientId && (!recipientIds || !recipientIds.length)) {
      return NextResponse.json(
        { error: 'recipientId or recipientIds required' },
        { status: 400 }
      );
    }

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title, and message required' },
        { status: 400 }
      );
    }

    const recipients = recipientIds || [recipientId];

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

    const result = await (prisma as any).teamNotification?.createMany({
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
