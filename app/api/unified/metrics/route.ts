/**
 * Unified Metrics API
 *
 * @description Aggregates metrics across all connected platforms.
 * Returns totals, per-platform breakdown, timeline data, and insights.
 *
 * GET /api/unified/metrics
 * Query: period (7d|30d|90d), startDate, endDate
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// Platform colors and display names
const PLATFORM_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  twitter: { name: 'Twitter', color: '#1DA1F2', icon: 'twitter' },
  instagram: { name: 'Instagram', color: '#E4405F', icon: 'instagram' },
  youtube: { name: 'YouTube', color: '#FF0000', icon: 'youtube' },
  linkedin: { name: 'LinkedIn', color: '#0A66C2', icon: 'linkedin' },
  facebook: { name: 'Facebook', color: '#1877F2', icon: 'facebook' },
  tiktok: { name: 'TikTok', color: '#000000', icon: 'tiktok' },
  pinterest: { name: 'Pinterest', color: '#E60023', icon: 'pinterest' },
  reddit: { name: 'Reddit', color: '#FF4500', icon: 'reddit' },
  threads: { name: 'Threads', color: '#000000', icon: 'threads' },
};

// All supported platforms
const ALL_PLATFORMS = Object.keys(PLATFORM_CONFIG);

// =============================================================================
// GET - Unified Metrics
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Calculate date range
    let startDate: Date;
    let endDate = new Date();

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // Fetch platform connections
    const connections = await prisma.platformConnection.findMany({
      where: { userId: userId, isActive: true },
      select: {
        platform: true,
        profileName: true,
        lastSync: true,
        metadata: true,
      },
    });

    const connectedPlatforms = new Set(connections.map((c) => c.platform.toLowerCase()));

    // Fetch posts with metrics
    const posts = await prisma.post.findMany({
      where: {
        campaign: { userId: userId },
        createdAt: { gte: startDate, lte: endDate },
        status: { in: ['published', 'scheduled'] },
      },
      select: {
        id: true,
        platform: true,
        createdAt: true,
        analytics: true,
      },
    });

    // Fetch previous period for growth calculation
    const prevStartDate = new Date(startDate);
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);

    const prevPosts = await prisma.post.findMany({
      where: {
        campaign: { userId: userId },
        createdAt: { gte: prevStartDate, lt: startDate },
        status: { in: ['published', 'scheduled'] },
      },
      select: {
        platform: true,
        analytics: true,
      },
    });

    // Aggregate per-platform metrics
    const platformMetrics: Record<string, {
      posts: number;
      engagement: number;
      followers: number;
      reach: number;
      prevEngagement: number;
    }> = {};

    // Initialize all platforms
    ALL_PLATFORMS.forEach((p) => {
      platformMetrics[p] = { posts: 0, engagement: 0, followers: 0, reach: 0, prevEngagement: 0 };
    });

    // Current period
    posts.forEach((post) => {
      const platform = post.platform?.toLowerCase();
      if (!platform || !platformMetrics[platform]) return;

      const analytics = post.analytics as Record<string, number> | null;
      platformMetrics[platform].posts += 1;
      platformMetrics[platform].engagement += (analytics?.likes ?? 0) + (analytics?.comments ?? 0) + (analytics?.shares ?? 0);
      platformMetrics[platform].reach += analytics?.impressions ?? analytics?.views ?? 0;
    });

    // Previous period for growth
    prevPosts.forEach((post) => {
      const platform = post.platform?.toLowerCase();
      if (!platform || !platformMetrics[platform]) return;

      const analytics = post.analytics as Record<string, number> | null;
      platformMetrics[platform].prevEngagement += (analytics?.likes ?? 0) + (analytics?.comments ?? 0) + (analytics?.shares ?? 0);
    });

    // Add follower counts from connections metadata
    connections.forEach((conn) => {
      const platform = conn.platform.toLowerCase();
      if (platformMetrics[platform]) {
        const meta = conn.metadata as Record<string, number> | null;
        platformMetrics[platform].followers = meta?.followers ?? meta?.subscriberCount ?? 0;
      }
    });

    // Build platforms array
    const platforms = ALL_PLATFORMS.map((platformId) => {
      const config = PLATFORM_CONFIG[platformId];
      const metrics = platformMetrics[platformId];
      const connection = connections.find((c) => c.platform.toLowerCase() === platformId);

      const engagementRate = metrics.followers > 0
        ? (metrics.engagement / metrics.followers) * 100
        : 0;

      const growth = metrics.prevEngagement > 0
        ? ((metrics.engagement - metrics.prevEngagement) / metrics.prevEngagement) * 100
        : metrics.engagement > 0 ? 100 : 0;

      return {
        id: platformId,
        name: config.name,
        connected: connectedPlatforms.has(platformId),
        followers: metrics.followers,
        engagement: metrics.engagement,
        posts: metrics.posts,
        engagementRate: Math.round(engagementRate * 100) / 100,
        growth: Math.round(growth * 10) / 10,
        lastSync: connection?.lastSync?.toISOString() ?? null,
        color: config.color,
        icon: config.icon,
      };
    });

    // Calculate totals
    const totals = {
      followers: platforms.reduce((sum, p) => sum + p.followers, 0),
      engagement: platforms.reduce((sum, p) => sum + p.engagement, 0),
      reach: Object.values(platformMetrics).reduce((sum, p) => sum + p.reach, 0),
      posts: platforms.reduce((sum, p) => sum + p.posts, 0),
      averageEngagementRate: 0,
    };

    if (totals.followers > 0) {
      totals.averageEngagementRate = Math.round((totals.engagement / totals.followers) * 100 * 100) / 100;
    }

    // Build timeline (last N days)
    const timeline: Array<{ date: string; [key: string]: number | string }> = [];
    const days = Math.min(periodDays, 30);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData: { date: string; [key: string]: number | string } = { date: dateStr };

      // Get engagement for each platform on this day
      posts
        .filter((p) => p.createdAt.toISOString().split('T')[0] === dateStr)
        .forEach((post) => {
          const platform = post.platform?.toLowerCase();
          if (!platform) return;

          const analytics = post.analytics as Record<string, number> | null;
          const engagement = (analytics?.likes ?? 0) + (analytics?.comments ?? 0) + (analytics?.shares ?? 0);

          dayData[platform] = ((dayData[platform] as number) || 0) + engagement;
        });

      // Ensure all connected platforms have a value
      connectedPlatforms.forEach((p) => {
        if (dayData[p] === undefined) {
          dayData[p] = 0;
        }
      });

      timeline.push(dayData);
    }

    // Calculate insights
    const connectedPlatformsList = platforms.filter((p) => p.connected);

    const topPlatform = connectedPlatformsList.length > 0
      ? connectedPlatformsList.reduce((best, p) => p.engagement > best.engagement ? p : best).id
      : null;

    const fastestGrowing = connectedPlatformsList.length > 0
      ? connectedPlatformsList.reduce((best, p) => p.growth > best.growth ? p : best).id
      : null;

    const bestEngagementRate = connectedPlatformsList.length > 0
      ? connectedPlatformsList.reduce((best, p) => p.engagementRate > best.engagementRate ? p : best).id
      : null;

    return NextResponse.json({
      success: true,
      data: {
        totals,
        platforms,
        timeline,
        insights: {
          topPlatform,
          fastestGrowing,
          bestEngagementRate,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch unified metrics', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
