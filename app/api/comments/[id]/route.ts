/**
 * Comment by ID API
 *
 * Single comment operations: GET, PATCH, DELETE.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/comments/[id]/route
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

const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content required').optional(),
  isResolved: z.boolean().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform comment for API response
 */
function transformCommentForResponse(comment: {
  id: string;
  contentType: string;
  contentId: string;
  content: string;
  parentId: string | null;
  authorId: string;
  sentiment: string | null;
  sentimentScore: number | null;
  emotions: unknown;
  isResolved: boolean;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: comment.id,
    contentType: comment.contentType,
    contentId: comment.contentId,
    content: comment.content,
    parentId: comment.parentId,
    authorId: comment.authorId,
    sentiment: comment.sentiment,
    sentimentScore: comment.sentimentScore,
    emotions: comment.emotions,
    isResolved: comment.isResolved,
    resolvedAt: comment.resolvedAt?.toISOString() || null,
    resolvedBy: comment.resolvedBy,
    mentions: comment.mentions,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/comments/[id] - Get a single comment
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

    const comment = await prisma.contentComment.findUnique({
      where: { id },
    });

    // Ownership check: treat missing comment and wrong author identically (404)
    // to avoid leaking that a comment exists for a given ID.
    if (!comment || comment.authorId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Comment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformCommentForResponse(comment),
    });
  } catch (error: unknown) {
    logger.error('Get comment error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to get comment') },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/comments/[id] - Update a comment
 *
 * Body:
 * - content (optional): Edit comment text
 * - isResolved (optional): Mark as resolved/unresolved
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
    const validation = updateCommentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { content, isResolved } = validation.data;

    // Verify comment exists
    const existing = await prisma.contentComment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Comment not found' },
        { status: 404 }
      );
    }

    // Only author can edit content
    if (content !== undefined && existing.authorId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the author can edit comment content' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: {
      content?: string;
      isResolved?: boolean;
      resolvedAt?: Date | null;
      resolvedBy?: string | null;
    } = {};

    if (content !== undefined) {
      updateData.content = content;
    }

    if (isResolved !== undefined) {
      updateData.isResolved = isResolved;
      if (isResolved) {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = userId;
      } else {
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
      }
    }

    const updated = await prisma.contentComment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Comment updated',
      data: transformCommentForResponse(updated),
    });
  } catch (error: unknown) {
    logger.error('Update comment error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to update comment') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comments/[id] - Delete a comment
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

    // Verify comment exists and user is author
    const existing = await prisma.contentComment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Comment not found' },
        { status: 404 }
      );
    }

    if (existing.authorId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the author can delete a comment' },
        { status: 403 }
      );
    }

    // Delete comment (cascades to replies due to Prisma relation)
    await prisma.contentComment.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Comment deleted',
    });
  } catch (error: unknown) {
    logger.error('Delete comment error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to delete comment') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
