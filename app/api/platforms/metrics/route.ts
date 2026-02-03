/**
 * Platform Metrics API Route
 *
 * @description Returns aggregated metrics across all connected platforms
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

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

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.PUBLIC_READ);
    const userId = security.context.userId;

    // Get time range
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch platform connections for the user
    const connections = userId
      ? await prisma.platformConnection.findMany({
          where: { userId, isActive: true },
          select: {
            platform: true,
            metadata: true,
            lastSync: true,
          },
        })
      : [];

    // Fetch posts and their analytics
    const campaignFilter = userId ? { campaign: { userId } } : {};
    const posts = await prisma.post.findMany({
      where: {
        ...campaignFilter,
        createdAt: { gte: startDate },
        status: { in: ['published', 'scheduled'] },
      },
      select: {
        platform: true,
        analytics: true,
        status: true,
      },
    });

    // Supported platforms
    const platforms = ['Twitter', 'LinkedIn', 'Instagram', 'Facebook', 'TikTok'];

    // Aggregate metrics per platform
    const metrics = platforms.map((platform) => {
      const platformLower = platform.toLowerCase();

      // Get connection info
      const connection = connections.find(
        (c) => c.platform.toLowerCase() === platformLower
      );
      const connectionMeta = connection?.metadata as Record<string, number> | null;

      // Filter posts for this platform
      const platformPosts = posts.filter(
        (p) => p.platform.toLowerCase() === platformLower
      );

      // Calculate engagement and impressions
      let totalEngagement = 0;
      let totalImpressions = 0;

      platformPosts.forEach((post) => {
        const analytics = post.analytics as Record<string, number> | null;
        if (analytics) {
          totalEngagement += analytics.engagement || analytics.likes || 0;
          totalImpressions += analytics.impressions || 0;
        }
      });

      return {
        platform,
        engagement: totalEngagement,
        followers: connectionMeta?.followers || 0,
        posts: platformPosts.length,
        impressions: totalImpressions,
        reach: 0,
        color: PLATFORM_COLORS[platformLower] || '#6B7280',
        connected: !!connection,
        lastSync: connection?.lastSync?.toISOString(),
      };
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Platform metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform metrics' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
