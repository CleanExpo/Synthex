/**
 * Individual Platform Metrics API Route
 *
 * @description Returns detailed metrics for a specific platform
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
  youtube: '#FF0000',
  threads: '#000000',
  bluesky: '#0085FF',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const platformLower = platform.toLowerCase();

    // Security check
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.PUBLIC_READ);
    const userId = security.context.userId;

    // Get time range
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get platform connection
    const connection = userId
      ? await prisma.platformConnection.findFirst({
          where: {
            userId,
            platform: { equals: platform, mode: 'insensitive' },
            isActive: true,
          },
        })
      : null;

    // Get posts for this platform
    const campaignFilter = userId ? { campaign: { userId } } : {};
    const posts = await prisma.post.findMany({
      where: {
        ...campaignFilter,
        platform: { equals: platform, mode: 'insensitive' },
        createdAt: { gte: startDate },
      },
      select: {
        analytics: true,
        status: true,
        createdAt: true,
      },
    });

    // Calculate aggregates
    let totalEngagement = 0;
    let totalImpressions = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    posts.forEach((post) => {
      const analytics = post.analytics as Record<string, number> | null;
      if (analytics) {
        totalEngagement += analytics.engagement || 0;
        totalImpressions += analytics.impressions || 0;
        totalLikes += analytics.likes || 0;
        totalComments += analytics.comments || 0;
        totalShares += analytics.shares || 0;
      }
    });

    const connectionMeta = connection?.metadata as Record<string, number> | null;

    return NextResponse.json({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase(),
      engagement: totalEngagement,
      followers: connectionMeta?.followers || 0,
      posts: posts.length,
      impressions: totalImpressions,
      reach: 0,
      color: PLATFORM_COLORS[platformLower] || '#6B7280',
      connected: !!connection,
      lastSync: connection?.lastSync?.toISOString(),
      breakdown: {
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
      },
      history: [], // Simplified - history would need a dedicated metrics table per platform
    });
  } catch (error) {
    logger.error('Platform metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform metrics' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
