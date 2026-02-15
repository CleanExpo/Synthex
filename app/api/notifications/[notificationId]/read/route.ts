/**
 * Mark Notification as Read API
 * PATCH /api/notifications/[notificationId]/read - Mark single notification as read
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Validate notification ID
const paramsSchema = z.object({
  notificationId: z.string().cuid()
});

interface RouteParams {
  params: Promise<{ notificationId: string }>;
}

/**
 * PATCH /api/notifications/[notificationId]/read
 * Marks a specific notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  // Security check - requires authentication
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
    // Validate params
    const resolvedParams = await params;
    const { notificationId } = paramsSchema.parse(resolvedParams);

    // Find notification and verify ownership
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true, read: true }
    });

    if (!notification) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Notification not found' },
        404,
        security.context
      );
    }

    // Ensure user owns this notification
    if (notification.userId !== security.context.userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Not authorized to modify this notification' },
        403,
        security.context
      );
    }

    // Already read? Return success anyway
    if (notification.read) {
      return APISecurityChecker.createSecureResponse(
        { success: true, message: 'Notification already marked as read' },
        200,
        security.context
      );
    }

    // Mark as read
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
      select: {
        id: true,
        type: true,
        title: true,
        read: true,
        createdAt: true
      }
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        data: updated
      },
      200,
      security.context
    );

  } catch (error) {
    console.error('Mark notification read error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid notification ID' },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update notification' },
      500,
      security.context
    );
  } finally {
    await prisma.$disconnect();
  }
}

export const runtime = 'nodejs';
