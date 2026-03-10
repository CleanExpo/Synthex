/**
 * Scheduler Post by ID API
 * GET /api/scheduler/posts/[postId] - Get single post
 * PATCH /api/scheduler/posts/[postId] - Update post
 * DELETE /api/scheduler/posts/[postId] - Delete post
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

// Validation schemas
const paramsSchema = z.object({
  postId: z.string().cuid()
});

const updatePostSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  platform: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed', 'cancelled']).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional()
});

interface RouteParams {
  params: Promise<{ postId: string }>;
}

/**
 * GET /api/scheduler/posts/[postId]
 * Get a single scheduled post
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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
    const resolvedParams = await params;
    const { postId } = paramsSchema.parse(resolvedParams);

    // Find post and verify ownership through campaign
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      }
    });

    if (!post) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Post not found' },
        404,
        security.context
      );
    }

    // Verify user owns the campaign this post belongs to
    if (post.campaign.userId !== security.context.userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Not authorized to view this post' },
        403,
        security.context
      );
    }

    // Remove userId from campaign in response
    const { userId: _userId, ...campaignData } = post.campaign;

    return APISecurityChecker.createSecureResponse(
      {
        data: {
          ...post,
          campaign: campaignData
        }
      },
      200,
      security.context
    );

  } catch (error) {
    logger.error('Get post error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid post ID' },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch post' },
      500,
      security.context
    );
  }
}

/**
 * PATCH /api/scheduler/posts/[postId]
 * Update a scheduled post
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
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
    const resolvedParams = await params;
    const { postId } = paramsSchema.parse(resolvedParams);

    // Parse and validate body
    const body = await request.json();
    const data = updatePostSchema.parse(body);

    // Find post and verify ownership
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        campaign: {
          select: { userId: true }
        }
      }
    });

    if (!existingPost) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Post not found' },
        404,
        security.context
      );
    }

    if (existingPost.campaign.userId !== security.context.userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Not authorized to update this post' },
        403,
        security.context
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};

    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.platform !== undefined) updatePayload.platform = data.platform;
    if (data.status !== undefined) {
      updatePayload.status = data.status;
      // Set publishedAt when status changes to published
      if (data.status === 'published') {
        updatePayload.publishedAt = new Date();
      }
    }
    if (data.scheduledAt !== undefined) {
      updatePayload.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata;

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: updatePayload,
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        data: updatedPost
      },
      200,
      security.context
    );

  } catch (error) {
    logger.error('Update post error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid update data', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update post' },
      500,
      security.context
    );
  }
}

/**
 * DELETE /api/scheduler/posts/[postId]
 * Delete a scheduled post
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
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
    const resolvedParams = await params;
    const { postId } = paramsSchema.parse(resolvedParams);

    // Find post and verify ownership
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        campaign: {
          select: { userId: true }
        }
      }
    });

    if (!existingPost) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Post not found' },
        404,
        security.context
      );
    }

    if (existingPost.campaign.userId !== security.context.userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Not authorized to delete this post' },
        403,
        security.context
      );
    }

    // Delete the post
    await prisma.post.delete({
      where: { id: postId }
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        message: 'Post deleted successfully'
      },
      200,
      security.context
    );

  } catch (error) {
    logger.error('Delete post error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid post ID' },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to delete post' },
      500,
      security.context
    );
  }
}

export const runtime = 'nodejs';
