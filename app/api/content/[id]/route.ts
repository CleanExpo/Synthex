/**
 * Content CRUD Operations
 *
 * Handles GET, PATCH, DELETE operations for individual content items.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/content/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';


// =============================================================================
// GET - Fetch single content item
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Validate ID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid ID', message: 'Content ID must be a valid UUID' },
        { status: 400 }
      );
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            platform: true,
            userId: true,
          },
        },
      },
    });

    // Ownership check: treat missing post and wrong owner identically (404)
    // to avoid leaking that a resource exists for a given ID.
    if (!post || post.campaign?.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Content not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: post,
    });
  } catch (error: unknown) {
    logger.error('GET content error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process content request') },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update content item
// =============================================================================

const updateSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed', 'archived']).optional(),
  metadata: z.object({
    mediaUrls: z.array(z.string().url()).optional(),
    hashtags: z.array(z.string()).optional(),
  }).passthrough().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Validate ID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid ID', message: 'Content ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    // Check if post exists and user has access
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { userId: true },
        },
      },
    });

    // Ownership check: treat missing post and wrong owner identically (404)
    // to avoid leaking that a resource exists for a given ID.
    // The nullable guard `?.userId` is intentionally absent here — a post
    // without a campaign relation is treated as inaccessible (404) to be safe.
    if (!existingPost || existingPost.campaign?.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Content not found' },
        { status: 404 }
      );
    }

    // Prevent editing published content
    if (existingPost.status === 'published' && validation.data.content) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Cannot edit published content' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      content?: string;
      scheduledAt?: Date | null;
      status?: string;
      metadata?: Record<string, unknown>;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (validation.data.content !== undefined) {
      updateData.content = validation.data.content;
    }
    if (validation.data.scheduledAt !== undefined) {
      updateData.scheduledAt = validation.data.scheduledAt ? new Date(validation.data.scheduledAt) : null;
    }
    if (validation.data.status !== undefined) {
      updateData.status = validation.data.status;
    }
    if (validation.data.metadata !== undefined) {
      // Merge with existing metadata and convert to Prisma-compatible JSON
      const currentMetadata = (existingPost.metadata || {}) as Record<string, unknown>;
      updateData.metadata = JSON.parse(JSON.stringify({ ...currentMetadata, ...validation.data.metadata }));
    }

    // Convert dates and ensure Prisma compatibility
    const prismaData = {
      ...updateData,
      metadata: updateData.metadata ? JSON.parse(JSON.stringify(updateData.metadata)) : undefined,
    };

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id },
      data: prismaData,
    });

    return NextResponse.json({
      success: true,
      message: 'Content updated successfully',
      data: updatedPost,
    });
  } catch (error: unknown) {
    logger.error('PATCH content error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process content request') },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete content item
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Validate ID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid ID', message: 'Content ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Check if post exists and user has access
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { userId: true },
        },
      },
    });

    // Ownership check: treat missing post and wrong owner identically (404)
    // to avoid leaking that a resource exists for a given ID.
    if (!existingPost || existingPost.campaign?.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Content not found' },
        { status: 404 }
      );
    }

    // Soft delete by archiving (or hard delete based on preference)
    const softDelete = request.nextUrl.searchParams.get('soft') !== 'false';

    if (softDelete) {
      await prisma.post.update({
        where: { id },
        data: {
          status: 'archived',
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.post.delete({
        where: { id },
      });
    }

    return NextResponse.json({
      success: true,
      message: softDelete ? 'Content archived successfully' : 'Content deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('DELETE content error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process content request') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
