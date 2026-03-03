/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: content library item CRUD; the active frontend caller uses /api/content-library/[id] instead.
 * This path (/api/library/content/[contentId]) is a duplicate route — prefer /api/content-library/[id].
 */

/**
 * Content Library Item API
 *
 * @description Manage individual content library items
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * SECURITY: All operations require authentication + ownership verification
 * IDOR Protection: User can only access their own content items
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Type for route params
interface RouteParams {
  params: Promise<{ contentId: string }>;
}

// Validation schema for updating content
const updateContentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  contentType: z.enum(['post', 'caption', 'story', 'thread', 'template', 'snippet']).optional(),
  platform: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived']).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  incrementUsage: z.boolean().optional(), // If true, increment usageCount and set lastUsedAt
});

/**
 * GET /api/library/content/[contentId]
 * Get a specific content library item
 * SECURITY: Requires authentication + ownership verification
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'User ID not found in auth context' },
      401,
      security.context
    );
  }

  try {
    const { contentId } = await context.params;

    // IDOR protection: Always filter by userId AND contentId
    const item = await prisma.contentLibrary.findFirst({
      where: {
        id: contentId,
        userId,
        status: { not: 'deleted' },
      },
    });

    if (!item) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Content item not found' },
        404,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(item, 200, security.context);
  } catch (error) {
    console.error('Error fetching content library item:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch content library item' },
      500,
      security.context
    );
  }
}

/**
 * PATCH /api/library/content/[contentId]
 * Update a content library item
 * SECURITY: Requires authentication + ownership verification
 */
export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'User ID not found in auth context' },
      401,
      security.context
    );
  }

  try {
    const { contentId } = await context.params;
    const body = await request.json();
    const validation = updateContentSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request body', details: validation.error.flatten() },
        400,
        security.context
      );
    }

    // IDOR protection: Verify ownership before update
    const existing = await prisma.contentLibrary.findFirst({
      where: {
        id: contentId,
        userId,
        status: { not: 'deleted' },
      },
    });

    if (!existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Content item not found' },
        404,
        security.context
      );
    }

    const { incrementUsage, ...updateData } = validation.data;

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = {};

    if (updateData.title !== undefined) updatePayload.title = updateData.title;
    if (updateData.content !== undefined) updatePayload.content = updateData.content;
    if (updateData.contentType !== undefined) updatePayload.contentType = updateData.contentType;
    if (updateData.platform !== undefined) updatePayload.platform = updateData.platform;
    if (updateData.category !== undefined) updatePayload.category = updateData.category;
    if (updateData.tags !== undefined) updatePayload.tags = updateData.tags;
    if (updateData.status !== undefined) updatePayload.status = updateData.status;
    if (updateData.metadata !== undefined) {
      // Prisma requires special handling for JSON null
      updatePayload.metadata = updateData.metadata === null
        ? { set: null }
        : updateData.metadata;
    }

    // Handle usage tracking
    if (incrementUsage) {
      updatePayload.usageCount = { increment: 1 };
      updatePayload.lastUsedAt = new Date();
    }

    const updated = await prisma.contentLibrary.update({
      where: { id: contentId },
      data: updatePayload,
    });

    return APISecurityChecker.createSecureResponse(updated, 200, security.context);
  } catch (error) {
    console.error('Error updating content library item:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update content library item' },
      500,
      security.context
    );
  }
}

/**
 * DELETE /api/library/content/[contentId]
 * Delete a content library item (soft delete)
 * SECURITY: Requires authentication + ownership verification
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'User ID not found in auth context' },
      401,
      security.context
    );
  }

  try {
    const { contentId } = await context.params;

    // IDOR protection: Verify ownership before delete
    const existing = await prisma.contentLibrary.findFirst({
      where: {
        id: contentId,
        userId,
        status: { not: 'deleted' },
      },
    });

    if (!existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Content item not found' },
        404,
        security.context
      );
    }

    // Soft delete - set status to 'deleted'
    await prisma.contentLibrary.update({
      where: { id: contentId },
      data: { status: 'deleted' },
    });

    // Return 204 No Content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting content library item:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to delete content library item' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
