/**
 * Share by ID API
 *
 * Single share operations: GET, PATCH, DELETE (revoke).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/shares/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// =============================================================================
// Schemas
// =============================================================================

const permissionEnum = z.enum(['view', 'comment', 'edit', 'admin']);

const updateShareSchema = z.object({
  permission: permissionEnum.optional(),
  canDownload: z.boolean().optional(),
  canReshare: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform share for API response
 */
function transformShareForResponse(share: {
  id: string;
  contentType: string;
  contentId: string;
  sharedWithUserId: string | null;
  sharedWithTeamId: string | null;
  sharedWithEmail: string | null;
  permission: string;
  canDownload: boolean;
  canReshare: boolean;
  accessLink: string | null;
  expiresAt: Date | null;
  maxViews: number | null;
  viewCount: number;
  sharedById: string;
  organizationId: string | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date | null;
}) {
  return {
    id: share.id,
    contentType: share.contentType,
    contentId: share.contentId,
    sharedWithUserId: share.sharedWithUserId,
    sharedWithTeamId: share.sharedWithTeamId,
    sharedWithEmail: share.sharedWithEmail,
    permission: share.permission,
    canDownload: share.canDownload,
    canReshare: share.canReshare,
    accessLink: share.accessLink,
    expiresAt: share.expiresAt?.toISOString() || null,
    maxViews: share.maxViews,
    viewCount: share.viewCount,
    sharedById: share.sharedById,
    organizationId: share.organizationId,
    message: share.message,
    createdAt: share.createdAt.toISOString(),
    updatedAt: share.updatedAt.toISOString(),
    lastAccessedAt: share.lastAccessedAt?.toISOString() || null,
  };
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/shares/[id] - Get a single share
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const share = await prisma.contentShare.findUnique({
      where: { id },
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Share not found' },
        { status: 404 }
      );
    }

    // Only share owner or recipient can view
    if (share.sharedById !== userId && share.sharedWithUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformShareForResponse(share),
    });
  } catch (error: unknown) {
    logger.error('Get share error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to get share') },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/shares/[id] - Update a share
 *
 * Body:
 * - permission (optional): view, comment, edit, admin
 * - canDownload (optional): boolean
 * - canReshare (optional): boolean
 * - expiresAt (optional): ISO date string or null
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const body = await request.json();
    const validation = updateShareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { permission, canDownload, canReshare, expiresAt } = validation.data;

    // Verify share exists and user is owner
    const existing = await prisma.contentShare.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Share not found' },
        { status: 404 }
      );
    }

    if (existing.sharedById !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the share owner can modify share settings' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: {
      permission?: string;
      canDownload?: boolean;
      canReshare?: boolean;
      expiresAt?: Date | null;
    } = {};

    if (permission !== undefined) updateData.permission = permission;
    if (canDownload !== undefined) updateData.canDownload = canDownload;
    if (canReshare !== undefined) updateData.canReshare = canReshare;
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const updated = await prisma.contentShare.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Share updated',
      data: transformShareForResponse(updated),
    });
  } catch (error: unknown) {
    logger.error('Update share error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to update share') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shares/[id] - Revoke a share
 *
 * Query params:
 * - reason (optional): Reason for revoking
 *
 * Note: This deletes the share record rather than soft-deleting,
 * as the ContentShare model doesn't have revokedAt/revokedReason fields
 * that are optional. For actual revocation tracking, we delete the share.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason');

    // Verify share exists and user is owner
    const existing = await prisma.contentShare.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Share not found' },
        { status: 404 }
      );
    }

    if (existing.sharedById !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the share owner can revoke a share' },
        { status: 403 }
      );
    }

    // Delete the share
    await prisma.contentShare.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: reason ? `Share revoked: ${reason}` : 'Share revoked',
    });
  } catch (error: unknown) {
    logger.error('Revoke share error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to revoke share') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
