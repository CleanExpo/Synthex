/**
 * Social Mentions API
 *
 * @description Paginated mentions feed with filters.
 * - GET: Fetch mentions with filtering and pagination
 * - PATCH: Update mention status (read, flag, archive)
 *
 * SECURITY: All endpoints require authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      // Fall through to cookie check
    }
  }

  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken) {
    try {
      const decoded = verifyToken(authToken);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      return null;
    }
  }

  return null;
}

// =============================================================================
// GET - Fetch mentions with filters
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get('keywordId');
    const platform = searchParams.get('platform');
    const sentiment = searchParams.get('sentiment');
    const isRead = searchParams.get('isRead');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Build where clause
    const where: Record<string, unknown> = {
      userId: user.id,
      isArchived: false,
    };

    if (keywordId) where.keywordId = keywordId;
    if (platform) where.platform = platform;
    if (sentiment) where.sentiment = sentiment;
    if (isRead !== null && isRead !== '') {
      where.isRead = isRead === 'true';
    }

    // Get total count
    const total = await prisma.socialMention.count({ where });

    // Get paginated mentions
    const mentions = await prisma.socialMention.findMany({
      where,
      include: {
        keyword: {
          select: {
            id: true,
            keyword: true,
            type: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      mentions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch mentions', { error });
    return NextResponse.json({ error: 'Failed to fetch mentions' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update mention status
// =============================================================================

const updateMentionSchema = z.object({
  mentionId: z.string().min(1),
  isRead: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateMentionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid request: ${validation.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 }
      );
    }

    const { mentionId, isRead, isFlagged, isArchived } = validation.data;

    // Verify ownership
    const mention = await prisma.socialMention.findFirst({
      where: {
        id: mentionId,
        userId: user.id,
      },
    });

    if (!mention) {
      return NextResponse.json({ error: 'Mention not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, boolean> = {};
    if (isRead !== undefined) updateData.isRead = isRead;
    if (isFlagged !== undefined) updateData.isFlagged = isFlagged;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    const updated = await prisma.socialMention.update({
      where: { id: mentionId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      mention: updated,
    });
  } catch (error) {
    logger.error('Failed to update mention', { error });
    return NextResponse.json({ error: 'Failed to update mention' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
