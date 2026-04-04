/**
 * Tracked Keywords API
 *
 * @description CRUD operations for tracked keywords/hashtags.
 * - GET: List user's tracked keywords with mention counts
 * - POST: Add new keyword to track
 * - DELETE: Remove keyword (via query param)
 *
 * SECURITY: All endpoints require authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';


// =============================================================================
// GET - List tracked keywords
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const keywords = await prisma.trackedKeyword.findMany({
      where: { userId: userId },
      include: {
        _count: {
          select: { mentions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get unread counts per keyword
    const unreadCounts = await prisma.socialMention.groupBy({
      by: ['keywordId'],
      where: {
        userId: userId,
        isRead: false,
      },
      _count: true,
    });

    const unreadMap = new Map(unreadCounts.map(u => [u.keywordId, u._count]));

    const keywordsWithStats = keywords.map(k => ({
      id: k.id,
      keyword: k.keyword,
      type: k.type,
      platforms: k.platforms,
      isActive: k.isActive,
      totalMentions: k._count.mentions,
      unreadCount: unreadMap.get(k.id) || 0,
      lastCheckedAt: k.lastCheckedAt,
      createdAt: k.createdAt,
    }));

    return NextResponse.json({
      success: true,
      keywords: keywordsWithStats,
    });
  } catch (error) {
    logger.error('Failed to fetch tracked keywords', { error });
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 });
  }
}

// =============================================================================
// POST - Add tracked keyword
// =============================================================================

const addKeywordSchema = z.object({
  keyword: z.string().min(1).max(100),
  type: z.enum(['keyword', 'hashtag', 'mention', 'brand']),
  platforms: z.array(z.string()).min(1),
  organizationId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = addKeywordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid request: ${validation.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 }
      );
    }

    const { keyword, type, platforms, organizationId } = validation.data;

    // Check for duplicate
    const existing = await prisma.trackedKeyword.findFirst({
      where: {
        userId: userId,
        keyword: keyword.toLowerCase(),
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Keyword already tracked' }, { status: 409 });
    }

    const tracked = await prisma.trackedKeyword.create({
      data: {
        userId: userId,
        organizationId,
        keyword: keyword.toLowerCase(),
        type,
        platforms,
      },
    });

    logger.info('Tracked keyword added', { keywordId: tracked.id, keyword, userId: userId });

    return NextResponse.json({
      success: true,
      keyword: tracked,
    }, { status: 201 });
  } catch (error) {
    logger.error('Failed to add tracked keyword', { error });
    return NextResponse.json({ error: 'Failed to add keyword' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Remove tracked keyword
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get('id');

    if (!keywordId) {
      return NextResponse.json({ error: 'Keyword ID required' }, { status: 400 });
    }

    // Verify ownership
    const keyword = await prisma.trackedKeyword.findFirst({
      where: {
        id: keywordId,
        userId: userId,
      },
    });

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    // Delete keyword (cascades to mentions)
    await prisma.trackedKeyword.delete({
      where: { id: keywordId },
    });

    logger.info('Tracked keyword removed', { keywordId, userId: userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete tracked keyword', { error });
    return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
