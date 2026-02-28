/**
 * Content Sharing API Route
 *
 * @description Manages content sharing with team members and external users:
 * - POST: Create a new share
 * - GET: List shares for content or user
 * - DELETE: Revoke a share
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
import { randomBytes } from 'crypto';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Content share data for creation */
interface ContentShareCreateData {
  contentType: string;
  contentId: string;
  sharedById: string;
  organizationId?: string | null;
  permission: string;
  canDownload: boolean;
  canReshare: boolean;
  message?: string;
  sharedWithUserId?: string;
  sharedWithTeamId?: string;
  sharedWithEmail?: string;
  accessLink?: string;
  expiresAt?: Date;
  maxViews?: number;
  password?: string;
}

/** Extended Prisma client with optional models */
interface ExtendedPrismaClient {
  contentShare?: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<ContentShareRecord | null>;
    findUnique: (args: { where: { id: string } }) => Promise<ContentShareRecord | null>;
    findMany: (args: { where: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number }) => Promise<ContentShareRecord[]>;
    create: (args: { data: ContentShareCreateData }) => Promise<ContentShareRecord>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<ContentShareRecord>;
    delete: (args: { where: { id: string } }) => Promise<void>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
  teamNotification?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

/** Content share database record */
interface ContentShareRecord {
  id: string;
  contentType: string;
  contentId: string;
  sharedById: string;
  sharedWithUserId?: string | null;
  sharedWithTeamId?: string | null;
  sharedWithEmail?: string | null;
  permission: string;
  accessLink?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Get prisma with extended models */
const extendedPrisma = prisma as unknown as typeof prisma & ExtendedPrismaClient;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createShareSchema = z.object({
  contentType: z.enum(['campaign', 'post', 'calendar_post', 'project']),
  contentId: z.string().min(1),
  sharedWithUserId: z.string().optional(),
  sharedWithTeamId: z.string().optional(),
  sharedWithEmail: z.string().email().optional(),
  permission: z.enum(['view', 'comment', 'edit', 'admin']).default('view'),
  canDownload: z.boolean().default(true),
  canReshare: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
  maxViews: z.number().positive().optional(),
  message: z.string().max(500).optional(),
  password: z.string().min(6).optional(),
  createLink: z.boolean().default(false),
});

// ============================================================================
// HELPERS
// ============================================================================

function generateAccessLink(): string {
  return randomBytes(32).toString('base64url');
}

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}

async function sendShareNotification(
  recipientId: string,
  sharerId: string,
  contentType: string,
  contentId: string,
  permission: string,
  organizationId?: string | null
) {
  try {
    // Get sharer info
    const sharer = await prisma.user.findUnique({
      where: { id: sharerId },
      select: { name: true, email: true },
    });

    await extendedPrisma.teamNotification?.create({
      data: {
        userId: recipientId,
        organizationId,
        type: 'content_shared',
        title: 'Content Shared With You',
        message: `${sharer?.name || 'Someone'} shared a ${contentType} with you (${permission} access)`,
        actionUrl: `/dashboard/${contentType}s/${contentId}`,
        relatedUserId: sharerId,
        relatedContentType: contentType,
        relatedContentId: contentId,
      },
    });
  } catch (error) {
    console.error('Failed to create share notification:', error);
    // Don't fail the share if notification fails
  }
}

// ============================================================================
// POST /api/content/share
// Create a new content share
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

    const userId = security.context.userId!;
    const body = await request.json();

    // Validate input
    const validation = createShareSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Ensure at least one target is specified
    if (!data.sharedWithUserId && !data.sharedWithTeamId && !data.sharedWithEmail && !data.createLink) {
      return NextResponse.json(
        { error: 'Must specify a share target (user, team, email, or create link)' },
        { status: 400 }
      );
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    // Check if share already exists
    const existingShare = await extendedPrisma.contentShare?.findFirst({
      where: {
        contentType: data.contentType,
        contentId: data.contentId,
        sharedById: userId,
        ...(data.sharedWithUserId && { sharedWithUserId: data.sharedWithUserId }),
        ...(data.sharedWithTeamId && { sharedWithTeamId: data.sharedWithTeamId }),
        ...(data.sharedWithEmail && { sharedWithEmail: data.sharedWithEmail }),
      },
    });

    if (existingShare) {
      // Update existing share
      const updated = await extendedPrisma.contentShare?.update({
        where: { id: existingShare.id },
        data: {
          permission: data.permission,
          canDownload: data.canDownload,
          canReshare: data.canReshare,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          maxViews: data.maxViews,
          message: data.message,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        share: updated,
        updated: true,
      });
    }

    // Prepare share data
    const shareData: ContentShareCreateData = {
      contentType: data.contentType,
      contentId: data.contentId,
      sharedById: userId,
      organizationId: user?.organizationId,
      permission: data.permission,
      canDownload: data.canDownload,
      canReshare: data.canReshare,
      message: data.message,
    };

    if (data.sharedWithUserId) {
      shareData.sharedWithUserId = data.sharedWithUserId;
    } else if (data.sharedWithTeamId) {
      shareData.sharedWithTeamId = data.sharedWithTeamId;
    } else if (data.sharedWithEmail) {
      shareData.sharedWithEmail = data.sharedWithEmail;
    }

    if (data.createLink || data.sharedWithEmail) {
      shareData.accessLink = generateAccessLink();
    }

    if (data.expiresAt) {
      shareData.expiresAt = new Date(data.expiresAt);
    }

    if (data.maxViews) {
      shareData.maxViews = data.maxViews;
    }

    if (data.password) {
      shareData.password = await hashPassword(data.password);
    }

    // Create the share and log the action atomically
    const share = await prisma.$transaction(async (tx) => {
      const extTx = tx as unknown as typeof tx & ExtendedPrismaClient;
      const created = await extTx.contentShare?.create({
        data: shareData,
      });

      // Log the share action within the same transaction
      await tx.auditLog.create({
        data: {
          userId,
          action: 'content.share',
          resource: data.contentType,
          resourceId: data.contentId,
          category: 'data',
          outcome: 'success',
          details: {
            shareId: created?.id,
            permission: data.permission,
            sharedWith: data.sharedWithUserId || data.sharedWithTeamId || data.sharedWithEmail || 'link',
          },
        },
      });

      return created;
    });

    // Send notification if shared with a user (outside transaction - non-critical)
    if (data.sharedWithUserId) {
      await sendShareNotification(
        data.sharedWithUserId,
        userId,
        data.contentType,
        data.contentId,
        data.permission,
        user?.organizationId
      );
    }

    return NextResponse.json({
      share,
      shareUrl: share?.accessLink
        ? `${process.env.NEXT_PUBLIC_APP_URL}/shared/${share.accessLink}`
        : null,
      created: true,
    });
  } catch (error) {
    console.error('Content share error:', error);
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/content/share
// List shares for content or user
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

    const contentType = searchParams.get('contentType');
    const contentId = searchParams.get('contentId');
    const sharedWithMe = searchParams.get('sharedWithMe') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const where: Record<string, unknown> = {};

    if (sharedWithMe) {
      // Get shares where I'm the recipient
      where.sharedWithUserId = userId;
    } else if (contentType && contentId) {
      // Get shares for specific content
      where.contentType = contentType;
      where.contentId = contentId;
      where.sharedById = userId; // Only show shares I created
    } else {
      // Get all shares I created
      where.sharedById = userId;
    }

    // Filter out expired shares
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ];

    const [shares, total] = await Promise.all([
      extendedPrisma.contentShare?.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }) || [],
      extendedPrisma.contentShare?.count({ where }) || 0,
    ]);

    return NextResponse.json({
      shares: shares || [],
      total: total || 0,
      hasMore: (shares?.length || 0) === limit,
    });
  } catch (error) {
    console.error('Get shares error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shares' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/content/share
// Revoke a share
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
    const shareId = searchParams.get('id');

    if (!shareId) {
      return NextResponse.json(
        { error: 'Share ID is required' },
        { status: 400 }
      );
    }

    // Find and verify ownership
    const share = await extendedPrisma.contentShare?.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      );
    }

    if (share.sharedById !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to revoke this share' },
        { status: 403 }
      );
    }

    // Delete the share and log the revocation atomically
    await prisma.$transaction(async (tx) => {
      const extTx = tx as unknown as typeof tx & ExtendedPrismaClient;
      await extTx.contentShare?.delete({
        where: { id: shareId },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'content.unshare',
          resource: share.contentType,
          resourceId: share.contentId,
          category: 'data',
          outcome: 'success',
          details: {
            shareId,
            revokedFrom: share.sharedWithUserId || share.sharedWithTeamId || share.sharedWithEmail || 'link',
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Share revoked successfully',
    });
  } catch (error) {
    console.error('Revoke share error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke share' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
