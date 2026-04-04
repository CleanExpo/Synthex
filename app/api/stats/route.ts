/**
 * Statistics API Endpoint
 * Returns real metrics from the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/config';
import { logger } from '@/lib/logger';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

// Cache stats for 5 minutes to reduce database load
let statsCache: Record<string, unknown> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  // Require authentication — this endpoint exposes live business metrics including Stripe subscriber counts
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    // Check cache
    const now = Date.now();
    if (statsCache && now - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json(statsCache);
    }

    // Get real stats from database
    const [userCount, campaignCount, postCount, publishedPostCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.campaign.count(),
        prisma.post.count(),
        prisma.post.count({
          where: { status: 'published' },
        }),
      ]);

    // Determine paid user count from Stripe or fall back to database
    let paidUserCount = 0;
    if (stripe) {
      try {
        // Get active subscription count from Stripe
        const subscriptions = await stripe.subscriptions.list({
          status: 'active',
          limit: 100,
        });
        paidUserCount = subscriptions.data.length;
      } catch {
        // Stripe query failed, fall back to database user count
        paidUserCount = userCount;
      }
    } else {
      paidUserCount = userCount;
    }

    // Calculate real average engagement rate from PlatformMetrics
    const engagementAgg = await prisma.platformMetrics.aggregate({
      _avg: { engagementRate: true },
      where: { engagementRate: { not: null } },
    });
    // engagementRate is stored as a decimal (e.g. 0.035 = 3.5%)
    // Multiply by 100 to get a percentage; default to null when no data
    const avgEngagementRate = engagementAgg._avg.engagementRate;
    const engagementMultiplier =
      avgEngagementRate != null ? avgEngagementRate * 100 : null;

    // Calculate growth rate (new users in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const growthRate =
      userCount > 0 ? Math.round((recentUsers / userCount) * 100) : 0;

    // Get platform distribution
    const platformStats = await prisma.post.groupBy({
      by: ['platform'],
      _count: {
        platform: true,
      },
    });

    const stats = {
      users: {
        total: paidUserCount,
        formatted: formatNumber(paidUserCount),
        label: paidUserCount === 1 ? 'User' : 'Users',
        growth: growthRate,
      },
      engagement: {
        multiplier:
          engagementMultiplier != null
            ? parseFloat(engagementMultiplier.toFixed(1))
            : null,
        formatted:
          engagementMultiplier != null
            ? `${engagementMultiplier.toFixed(1)}%`
            : null,
        label: 'Engagement',
        description: 'Average engagement rate across published posts',
      },
      campaigns: {
        total: campaignCount,
        formatted: formatNumber(campaignCount),
        label: campaignCount === 1 ? 'Campaign' : 'Campaigns',
      },
      posts: {
        total: postCount,
        published: publishedPostCount,
        formatted: formatNumber(postCount),
        label: postCount === 1 ? 'Post' : 'Posts Created',
      },
      platforms: platformStats.map(p => ({
        name: p.platform,
        count: p._count.platform,
      })),
      aiPowered: {
        enabled: true,
        features: [
          'Content Generation',
          'Persona Learning',
          'Viral Pattern Analysis',
          'Smart Scheduling',
        ],
      },
      lastUpdated: new Date().toISOString(),
      dataSource: {
        users: stripe ? 'stripe' : 'database',
        campaigns: 'database',
        posts: 'database',
      },
    };

    // Update cache
    statsCache = stats;
    cacheTimestamp = now;

    return NextResponse.json(stats);
  } catch (error) {
    logger.error('Stats API error:', error);

    // Return fallback stats if database is not available
    return NextResponse.json({
      users: {
        total: 0,
        formatted: '0',
        label: 'Users',
        growth: 0,
      },
      engagement: {
        multiplier: 1.0,
        formatted: '1.0x',
        label: 'Engagement',
        description: 'Setting up AI boost',
      },
      campaigns: {
        total: 0,
        formatted: '0',
        label: 'Campaigns',
      },
      posts: {
        total: 0,
        published: 0,
        formatted: '0',
        label: 'Posts',
      },
      platforms: [],
      aiPowered: {
        enabled: false,
        features: [],
      },
      lastUpdated: new Date().toISOString(),
    });
  }
}

// Helper function to format numbers
function formatNumber(num: number): string {
  if (num === 0) return '0';
  if (num < 1000) return num.toString();
  if (num < 10000) return `${(num / 1000).toFixed(1)}k+`;
  if (num < 1000000) return `${Math.floor(num / 1000)}k+`;
  return `${(num / 1000000).toFixed(1)}M+`;
}

export const runtime = 'nodejs';
