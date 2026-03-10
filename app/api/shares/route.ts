/**
 * Shares API
 *
 * Manages content sharing for campaigns, posts, calendar posts, and projects.
 * CRUD operations with Prisma persistence.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/shares/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// =============================================================================
// Schemas
// =============================================================================

const contentTypeEnum = z.enum(['campaign', 'post', 'calendar_post', 'project']);
const permissionEnum = z.enum(['view', 'comment', 'edit', 'admin']);

const createShareSchema = z.object({
  contentType: contentTypeEnum,
  contentId: z.string().min(1, 'Content ID required'),
  // One of these must be provided
  sharedWithUserId: z.string().optional(),
  sharedWithTeamId: z.string().optional(),
  sharedWithEmail: z.string().email().optional(),
  // Optional fields
  permission: permissionEnum.optional().default('view'),
  canDownload: z.boolean().optional().default(true),
  canReshare: z.boolean().optional().default(false),
  expiresAt: z.string().datetime().optional(),
  message: z.string().max(1000).optional(),
}).refine(
  (data) => data.sharedWithUserId || data.sharedWithTeamId || data.sharedWithEmail,
  { message: 'One of sharedWithUserId, sharedWithTeamId, or sharedWithEmail is required' }
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a secure access link token
 */
function generateAccessLink(): string {
  return crypto.randomBytes(32).toString('hex');
}

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
 * GET /api/shares - List shares
 *
 * Query params (3 modes):
 * 1. contentType + contentId: List shares for specific content
 * 2. sharedWithMe=true: List content shared with current user
 * 3. sharedByMe=true: List content current user shared
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType');
    const contentId = searchParams.get('contentId');
    const sharedWithMe = searchParams.get('sharedWithMe') === 'true';
    const sharedByMe = searchParams.get('sharedByMe') === 'true';

    let shares;

    if (contentType && contentId) {
      // Mode 1: List shares for specific content
      const contentTypeResult = contentTypeEnum.safeParse(contentType);
      if (!contentTypeResult.success) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid contentType. Must be one of: campaign, post, calendar_post, project' },
          { status: 400 }
        );
      }

      shares = await prisma.contentShare.findMany({
        where: {
          contentType,
          contentId,
          sharedById: userId, // Only show shares the user created
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (sharedWithMe) {
      // Mode 2: Content shared with current user
      shares = await prisma.contentShare.findMany({
        where: {
          sharedWithUserId: userId,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (sharedByMe) {
      // Mode 3: Content current user shared
      shares = await prisma.contentShare.findMany({
        where: {
          sharedById: userId,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Provide contentType+contentId, sharedWithMe=true, or sharedByMe=true' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: shares.map(transformShareForResponse),
    });
  } catch (error: unknown) {
    logger.error('List shares error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to list shares') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shares - Create a new share
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createShareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      contentType,
      contentId,
      sharedWithUserId,
      sharedWithTeamId,
      sharedWithEmail,
      permission,
      canDownload,
      canReshare,
      expiresAt,
      message,
    } = validation.data;

    // Generate access link for email shares (external users)
    const accessLink = sharedWithEmail ? generateAccessLink() : null;

    const share = await prisma.contentShare.create({
      data: {
        contentType,
        contentId,
        sharedWithUserId: sharedWithUserId || null,
        sharedWithTeamId: sharedWithTeamId || null,
        sharedWithEmail: sharedWithEmail || null,
        permission: permission || 'view',
        canDownload: canDownload ?? true,
        canReshare: canReshare ?? false,
        accessLink,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        message: message || null,
        sharedById: userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Share created',
      data: transformShareForResponse(share),
    });
  } catch (error: unknown) {
    logger.error('Create share error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to create share') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
