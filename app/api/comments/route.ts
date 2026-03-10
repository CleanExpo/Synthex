/**
 * Comments API
 *
 * Manages content comments for campaigns, posts, calendar posts, and projects.
 * CRUD operations with Prisma persistence and threaded comment support.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/comments/route
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

const contentTypeEnum = z.enum(['campaign', 'post', 'calendar_post', 'project']);

const createCommentSchema = z.object({
  contentType: contentTypeEnum,
  contentId: z.string().min(1, 'Content ID required'),
  content: z.string().min(1, 'Comment content required'),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).optional(),
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
 * GET /api/comments - List comments for content
 *
 * Query params:
 * - contentType (required): campaign, post, calendar_post, project
 * - contentId (required): ID of the content
 * - parentId (optional): For fetching thread replies
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
    const parentId = searchParams.get('parentId');

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'contentType and contentId are required' },
        { status: 400 }
      );
    }

    // Validate contentType
    const contentTypeResult = contentTypeEnum.safeParse(contentType);
    if (!contentTypeResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid contentType. Must be one of: campaign, post, calendar_post, project' },
        { status: 400 }
      );
    }

    // Build query
    const whereClause: {
      contentType: string;
      contentId: string;
      parentId?: string | null;
    } = {
      contentType,
      contentId,
    };

    // If parentId is provided, fetch replies for that comment
    // If not provided, fetch root-level comments (parentId is null)
    if (parentId) {
      whereClause.parentId = parentId;
    } else {
      whereClause.parentId = null;
    }

    const comments = await prisma.contentComment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: comments.map(transformCommentForResponse),
    });
  } catch (error: unknown) {
    logger.error('List comments error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to list comments') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comments - Create a new comment
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
    const validation = createCommentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { contentType, contentId, content, parentId, mentions } = validation.data;

    // If parentId is provided, verify it exists
    if (parentId) {
      const parentComment = await prisma.contentComment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Not Found', message: 'Parent comment not found' },
          { status: 404 }
        );
      }

      // Verify parent is for the same content
      if (parentComment.contentType !== contentType || parentComment.contentId !== contentId) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Parent comment must be on the same content' },
          { status: 400 }
        );
      }
    }

    const comment = await prisma.contentComment.create({
      data: {
        contentType,
        contentId,
        content,
        parentId: parentId || null,
        authorId: userId,
        mentions: mentions || [],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Comment created',
      data: transformCommentForResponse(comment),
    });
  } catch (error: unknown) {
    logger.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to create comment') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
