/**
 * Content Comments API Route
 *
 * @description Manages comments on shared content:
 * - POST: Create a new comment
 * - GET: List comments for content
 * - PATCH: Update/resolve a comment
 * - DELETE: Delete a comment
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
import { z } from 'zod';

/** Comment record from database */
interface CommentRecord {
  id: string;
  contentType: string;
  contentId: string;
  content: string;
  parentId: string | null;
  authorId: string;
  mentions: string[];
  isResolved: boolean;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  replies?: CommentRecord[];
}

/** Comment update data */
interface CommentUpdateData {
  updatedAt: Date;
  content?: string;
  isResolved?: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
}

/** Where clause for comment queries */
interface CommentWhereClause {
  contentType: string;
  contentId: string;
  parentId?: string | null;
}

/** Extended prisma client for comments */
interface PrismaWithComments {
  contentComment?: {
    create: (args: Record<string, unknown>) => Promise<CommentRecord>;
    findMany: (args: Record<string, unknown>) => Promise<CommentRecord[]>;
    findUnique: (args: Record<string, unknown>) => Promise<CommentRecord | null>;
    update: (args: Record<string, unknown>) => Promise<CommentRecord>;
    delete: (args: Record<string, unknown>) => Promise<CommentRecord>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  teamNotification?: {
    create: (args: Record<string, unknown>) => Promise<unknown>;
    createMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createCommentSchema = z.object({
  contentType: z.enum(['campaign', 'post', 'calendar_post', 'project']),
  contentId: z.string().min(1),
  content: z.string().min(1).max(5000),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  isResolved: z.boolean().optional(),
});

// ============================================================================
// HELPERS
// ============================================================================

async function sendMentionNotifications(
  mentions: string[],
  authorId: string,
  contentType: string,
  contentId: string,
  commentId: string,
  organizationId?: string | null
) {
  if (!mentions.length) return;

  try {
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { name: true },
    });

    const notifications = mentions.map((userId) => ({
      userId,
      organizationId,
      type: 'mention',
      title: 'You were mentioned',
      message: `${author?.name || 'Someone'} mentioned you in a comment`,
      actionUrl: `/dashboard/${contentType}s/${contentId}?comment=${commentId}`,
      relatedUserId: authorId,
      relatedContentType: contentType,
      relatedContentId: contentId,
    }));

    await (prisma as unknown as PrismaWithComments).teamNotification?.createMany({
      data: notifications,
    });
  } catch (error) {
    console.error('Failed to send mention notifications:', error);
  }
}

async function notifyContentOwner(
  authorId: string,
  contentType: string,
  contentId: string,
  commentId: string,
  commenterName: string,
  organizationId?: string | null
) {
  try {
    // Get content owner based on content type
    let ownerId: string | null = null;

    if (contentType === 'campaign') {
      const campaign = await prisma.campaign.findUnique({
        where: { id: contentId },
        select: { userId: true },
      });
      ownerId = campaign?.userId || null;
    } else if (contentType === 'post') {
      const post = await prisma.post.findUnique({
        where: { id: contentId },
        select: { campaign: { select: { userId: true } } },
      });
      ownerId = post?.campaign?.userId || null;
    }

    // Don't notify if commenter is the owner
    if (!ownerId || ownerId === authorId) return;

    await (prisma as unknown as PrismaWithComments).teamNotification?.create({
      data: {
        userId: ownerId,
        organizationId,
        type: 'comment',
        title: 'New Comment',
        message: `${commenterName} commented on your ${contentType}`,
        actionUrl: `/dashboard/${contentType}s/${contentId}?comment=${commentId}`,
        relatedUserId: authorId,
        relatedContentType: contentType,
        relatedContentId: contentId,
      },
    });
  } catch (error) {
    console.error('Failed to notify content owner:', error);
  }
}

// ============================================================================
// POST /api/content/comments
// Create a new comment
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
    const validation = createCommentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, organizationId: true },
    });

    // Extract @mentions from content if not provided
    const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const extractedMentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(data.content)) !== null) {
      extractedMentions.push(match[2]); // User ID from mention
    }

    const mentions = data.mentions || extractedMentions;

    // Create the comment
    const comment = await (prisma as unknown as PrismaWithComments).contentComment?.create({
      data: {
        contentType: data.contentType,
        contentId: data.contentId,
        content: data.content,
        parentId: data.parentId,
        authorId: userId,
        mentions,
      },
    });

    // Send notifications
    if (comment) {
      await sendMentionNotifications(
        mentions,
        userId,
        data.contentType,
        data.contentId,
        comment.id,
        user?.organizationId
      );

      // Notify content owner (unless replying to thread)
      if (!data.parentId) {
        await notifyContentOwner(
          userId,
          data.contentType,
          data.contentId,
          comment.id,
          user?.name || 'Someone',
          user?.organizationId
        );
      }
    }

    // Log the comment
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'content.comment',
        resource: data.contentType,
        resourceId: data.contentId,
        category: 'data',
        outcome: 'success',
        details: {
          commentId: comment?.id,
          parentId: data.parentId,
          mentionCount: mentions.length,
        },
      },
    });

    return NextResponse.json({
      comment: comment
        ? {
            ...comment,
            author: {
              id: userId,
              name: user?.name,
            },
          }
        : null,
      created: true,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/content/comments
// List comments for content
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

    const { searchParams } = new URL(request.url);

    const contentType = searchParams.get('contentType');
    const contentId = searchParams.get('contentId');
    const parentId = searchParams.get('parentId');
    const includeReplies = searchParams.get('includeReplies') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType and contentId are required' },
        { status: 400 }
      );
    }

    // Build query
    const where: CommentWhereClause = {
      contentType,
      contentId,
    };

    if (parentId !== null) {
      where.parentId = parentId || null; // null = top-level comments only
    }

    // Get comments
    const comments = await (prisma as unknown as PrismaWithComments).contentComment?.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
      include: includeReplies
        ? {
            replies: {
              orderBy: { createdAt: 'asc' },
              take: 10,
            },
          }
        : undefined,
    });

    // Get authors
    const authorIds = new Set<string>();
    (comments || []).forEach((c) => {
      authorIds.add(c.authorId);
      (c.replies || []).forEach((r) => authorIds.add(r.authorId));
    });

    const authors = await prisma.user.findMany({
      where: { id: { in: Array.from(authorIds) } },
      select: { id: true, name: true, avatar: true },
    });

    const authorMap = new Map(authors.map((a) => [a.id, a]));

    // Enrich comments with author info
    const enrichedComments = (comments || []).map((c) => ({
      ...c,
      author: authorMap.get(c.authorId) || { id: c.authorId },
      replies: (c.replies || []).map((r) => ({
        ...r,
        author: authorMap.get(r.authorId) || { id: r.authorId },
      })),
    }));

    const total = await (prisma as unknown as PrismaWithComments).contentComment?.count({ where }) || 0;

    return NextResponse.json({
      comments: enrichedComments,
      total,
      hasMore: (comments?.length || 0) === limit,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/content/comments
// Update or resolve a comment
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
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateCommentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Find the comment
    const comment = await (prisma as unknown as PrismaWithComments).contentComment?.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check authorization (author can edit, anyone can resolve)
    if (data.content && comment.authorId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to edit this comment' },
        { status: 403 }
      );
    }

    // Update
    const updateData: CommentUpdateData = {
      updatedAt: new Date(),
    };

    if (data.content) {
      updateData.content = data.content;
    }

    if (typeof data.isResolved === 'boolean') {
      updateData.isResolved = data.isResolved;
      if (data.isResolved) {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = userId;
      } else {
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
      }
    }

    const updated = await (prisma as unknown as PrismaWithComments).contentComment?.update({
      where: { id: commentId },
      data: updateData,
    });

    return NextResponse.json({
      comment: updated,
      updated: true,
    });
  } catch (error) {
    console.error('Update comment error:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/content/comments
// Delete a comment
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
    const commentId = searchParams.get('id');

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    // Find and verify ownership
    const comment = await (prisma as unknown as PrismaWithComments).contentComment?.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment.authorId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this comment' },
        { status: 403 }
      );
    }

    // Delete (cascades to replies)
    await (prisma as unknown as PrismaWithComments).contentComment?.delete({
      where: { id: commentId },
    });

    // Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'content.comment.delete',
        resource: comment.contentType,
        resourceId: comment.contentId,
        category: 'data',
        outcome: 'success',
        details: { commentId },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
