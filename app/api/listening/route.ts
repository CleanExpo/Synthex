/**
 * Social Listening Dashboard API
 *
 * @description Overview stats and recent mentions for the dashboard.
 * - GET: Stats (24h/7d/30d totals, sentiment breakdown, top keywords)
 *
 * SECURITY: All endpoints require authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';


// =============================================================================
// GET - Dashboard overview stats
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get mention counts by time period
    const [total24h, total7d, total30d] = await Promise.all([
      prisma.socialMention.count({
        where: { userId: userId, postedAt: { gte: oneDayAgo } },
      }),
      prisma.socialMention.count({
        where: { userId: userId, postedAt: { gte: sevenDaysAgo } },
      }),
      prisma.socialMention.count({
        where: { userId: userId, postedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    // Sentiment breakdown (last 7 days)
    const sentimentCounts = await prisma.socialMention.groupBy({
      by: ['sentiment'],
      where: {
        userId: userId,
        postedAt: { gte: sevenDaysAgo },
        sentiment: { not: null },
      },
      _count: true,
    });

    const sentimentBreakdown = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    sentimentCounts.forEach(s => {
      if (s.sentiment && s.sentiment in sentimentBreakdown) {
        sentimentBreakdown[s.sentiment as keyof typeof sentimentBreakdown] = s._count;
      }
    });

    // Top keywords by mention volume (last 7 days)
    const topKeywordMentions = await prisma.socialMention.groupBy({
      by: ['keywordId'],
      where: {
        userId: userId,
        postedAt: { gte: sevenDaysAgo },
      },
      _count: true,
      orderBy: { _count: { keywordId: 'desc' } },
      take: 5,
    });

    const keywordIds = topKeywordMentions.map(k => k.keywordId);
    const keywords = await prisma.trackedKeyword.findMany({
      where: { id: { in: keywordIds } },
      select: { id: true, keyword: true, type: true },
    });

    const keywordMap = new Map(keywords.map(k => [k.id, k]));
    const topKeywords = topKeywordMentions.map(k => ({
      ...keywordMap.get(k.keywordId),
      mentionCount: k._count,
    }));

    // Top platforms (last 7 days)
    const platformCounts = await prisma.socialMention.groupBy({
      by: ['platform'],
      where: {
        userId: userId,
        postedAt: { gte: sevenDaysAgo },
      },
      _count: true,
      orderBy: { _count: { platform: 'desc' } },
      take: 5,
    });

    const topPlatforms = platformCounts.map(p => ({
      platform: p.platform,
      count: p._count,
    }));

    // Unread count
    const unreadCount = await prisma.socialMention.count({
      where: { userId: userId, isRead: false, isArchived: false },
    });

    // Recent mentions (last 10)
    const recentMentions = await prisma.socialMention.findMany({
      where: { userId: userId, isArchived: false },
      include: {
        keyword: {
          select: { id: true, keyword: true, type: true },
        },
      },
      orderBy: { postedAt: 'desc' },
      take: 10,
    });

    // Active keywords count
    const activeKeywordsCount = await prisma.trackedKeyword.count({
      where: { userId: userId, isActive: true },
    });

    return NextResponse.json({
      success: true,
      stats: {
        total24h,
        total7d,
        total30d,
        sentimentBreakdown,
        topKeywords,
        topPlatforms,
        unreadCount,
        activeKeywordsCount,
      },
      recentMentions,
    });
  } catch (error) {
    logger.error('Failed to fetch listening stats', { error });
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
