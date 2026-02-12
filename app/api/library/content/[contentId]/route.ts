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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';

// Validation schema for content updates
const updateContentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  type: z.enum(['post', 'template', 'draft', 'asset']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Type for route params
interface RouteParams {
  params: Promise<{ contentId: string }>;
}

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

  try {
    const { contentId } = await context.params;
    const userId = security.context.userId;

    if (!contentId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Content ID is required' },
        400,
        security.context
      );
    }

    // Note: This is a placeholder implementation
    // In production, fetch from database with ownership verification:
    // const content = await prisma.contentLibrary.findFirst({
    //   where: { id: contentId, userId: userId }  // IDOR protection
    // });

    // Placeholder: Return not found for stub implementation
    // When database table exists, implement actual lookup
    return APISecurityChecker.createSecureResponse(
      { error: 'Content not found' },
      404,
      security.context
    );
  } catch (error) {
    console.error('Error fetching content item:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch content item' },
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

  try {
    const { contentId } = await context.params;
    const userId = security.context.userId;

    if (!contentId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Content ID is required' },
        400,
        security.context
      );
    }

    // Validate input
    const body = await request.json();
    const validation = updateContentSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation failed', details: validation.error.errors },
        400,
        security.context
      );
    }

    // IDOR Protection: First verify ownership before update
    // const content = await prisma.contentLibrary.findFirst({
    //   where: { id: contentId, userId: userId }
    // });
    //
    // if (!content) {
    //   return APISecurityChecker.createSecureResponse(
    //     { error: 'Content not found' },
    //     404,
    //     security.context
    //   );
    // }
    //
    // Then update:
    // const updated = await prisma.contentLibrary.update({
    //   where: { id: contentId },
    //   data: validation.data,
    // });

    // Placeholder: Return not found for stub implementation
    return APISecurityChecker.createSecureResponse(
      { error: 'Content not found' },
      404,
      security.context
    );
  } catch (error) {
    console.error('Error updating content item:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update content item' },
      500,
      security.context
    );
  }
}

/**
 * DELETE /api/library/content/[contentId]
 * Delete a content library item
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

  try {
    const { contentId } = await context.params;
    const userId = security.context.userId;

    if (!contentId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Content ID is required' },
        400,
        security.context
      );
    }

    // IDOR Protection: Verify ownership before deletion
    // const content = await prisma.contentLibrary.findFirst({
    //   where: { id: contentId, userId: userId }
    // });
    //
    // if (!content) {
    //   return APISecurityChecker.createSecureResponse(
    //     { error: 'Content not found' },
    //     404,
    //     security.context
    //   );
    // }
    //
    // await prisma.contentLibrary.delete({
    //   where: { id: contentId },
    // });

    // Placeholder: Return not found for stub implementation
    return APISecurityChecker.createSecureResponse(
      { error: 'Content not found' },
      404,
      security.context
    );
  } catch (error) {
    console.error('Error deleting content item:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to delete content item' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
