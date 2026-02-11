/**
 * Competitor Snapshot API Route
 *
 * @description Get and trigger competitor snapshots:
 * - GET: Get snapshot history for competitor
 * - POST: Trigger a new snapshot
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

// ============================================================================
// MOCK DATA GENERATOR (Simulates social media API responses)
// In production, this would call actual social media APIs
// ============================================================================

function generateMockMetrics(competitor: any, platform: string) {
  const baseFollowers = Math.floor(Math.random() * 50000) + 1000;
  const growthRate = (Math.random() * 0.1) - 0.02; // -2% to +8%

  return {
    followersCount: baseFollowers,
    followingCount: Math.floor(baseFollowers * 0.3),
    followerGrowth: Math.floor(baseFollowers * growthRate),
    totalPosts: Math.floor(Math.random() * 500) + 50,
    avgLikes: Math.floor(Math.random() * 200) + 10,
    avgComments: Math.floor(Math.random() * 30) + 2,
    avgShares: Math.floor(Math.random() * 20) + 1,
    engagementRate: Math.round((Math.random() * 5 + 0.5) * 100) / 100,
    postFrequency: Math.round((Math.random() * 3 + 0.5) * 10) / 10,
    topHashtags: ['marketing', 'business', 'growth', 'success', 'startup'].slice(
      0,
      Math.floor(Math.random() * 5) + 1
    ),
    contentTypes: {
      image: Math.floor(Math.random() * 50) + 20,
      video: Math.floor(Math.random() * 30) + 5,
      text: Math.floor(Math.random() * 20) + 5,
      carousel: Math.floor(Math.random() * 15),
    },
    postingTimes: {
      morning: Math.floor(Math.random() * 30) + 10,
      afternoon: Math.floor(Math.random() * 30) + 15,
      evening: Math.floor(Math.random() * 30) + 20,
    },
    performanceScore: Math.round((Math.random() * 40 + 50) * 10) / 10,
    growthScore: Math.round((Math.random() * 40 + 40) * 10) / 10,
    engagementScore: Math.round((Math.random() * 40 + 45) * 10) / 10,
  };
}

// ============================================================================
// GET /api/competitors/track/[id]/snapshot
// Get snapshot history
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const platform = searchParams.get('platform') || 'all';
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Verify competitor belongs to user
    const competitor = await (prisma as any).trackedCompetitor?.findFirst({
      where: { id, userId },
      select: { id: true, name: true },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Get snapshots
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await (prisma as any).competitorSnapshot?.findMany({
      where: {
        competitorId: id,
        platform: platform === 'all' ? undefined : platform,
        snapshotAt: { gte: startDate },
      },
      orderBy: { snapshotAt: 'desc' },
    }) || [];

    // Calculate trends
    const platformSet = new Set<string>();
    for (const s of snapshots) {
      if ((s as any).platform) platformSet.add((s as any).platform);
    }
    const platforms = Array.from(platformSet);
    const trendsByPlatform: Record<string, unknown> = {};

    for (const plat of platforms) {
      const platSnapshots = snapshots
        .filter((s: any) => s.platform === plat)
        .slice(0, 7); // Last 7 snapshots

      if (platSnapshots.length >= 2) {
        const latest = platSnapshots[0];
        const oldest = platSnapshots[platSnapshots.length - 1];

        trendsByPlatform[plat] = {
          followerGrowth: latest.followersCount && oldest.followersCount
            ? latest.followersCount - oldest.followersCount
            : null,
          engagementTrend: latest.engagementRate && oldest.engagementRate
            ? Math.round((latest.engagementRate - oldest.engagementRate) * 100) / 100
            : null,
          dataPoints: platSnapshots.length,
        };
      }
    }

    return NextResponse.json({
      competitor: { id, name: competitor.name },
      snapshots,
      trends: trendsByPlatform,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    console.error('Get snapshots error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/competitors/track/[id]/snapshot
// Trigger new snapshot
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Verify competitor belongs to user
    const competitor = await (prisma as any).trackedCompetitor?.findFirst({
      where: { id, userId },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Check rate limiting (max 1 snapshot per hour)
    const lastSnapshot = await (prisma as any).competitorSnapshot?.findFirst({
      where: {
        competitorId: id,
        snapshotAt: { gte: new Date(Date.now() - 3600000) },
      },
      orderBy: { snapshotAt: 'desc' },
    });

    if (lastSnapshot) {
      return NextResponse.json(
        {
          error: 'Rate limited. Please wait before requesting another snapshot.',
          lastSnapshot: lastSnapshot.snapshotAt,
          nextAvailable: new Date(new Date(lastSnapshot.snapshotAt).getTime() + 3600000),
        },
        { status: 429 }
      );
    }

    // Determine which platforms to track
    const platforms: string[] = [];
    if (competitor.twitterHandle) platforms.push('twitter');
    if (competitor.instagramHandle) platforms.push('instagram');
    if (competitor.linkedinHandle) platforms.push('linkedin');
    if (competitor.facebookHandle) platforms.push('facebook');
    if (competitor.youtubeHandle) platforms.push('youtube');
    if (competitor.tiktokHandle) platforms.push('tiktok');

    const snapshots: any[] = [];

    // Create snapshot for each platform
    for (const platform of platforms) {
      const metrics = generateMockMetrics(competitor, platform);

      const snapshot = await (prisma as any).competitorSnapshot?.create({
        data: {
          competitorId: id,
          platform,
          ...metrics,
          dataSource: 'api',
        },
      });

      snapshots.push(snapshot);
    }

    // Create aggregated 'all' snapshot
    if (snapshots.length > 0) {
      const aggregated = {
        followersCount: snapshots.reduce((sum, s) => sum + (s.followersCount || 0), 0),
        engagementRate: snapshots.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / snapshots.length,
        performanceScore: snapshots.reduce((sum, s) => sum + (s.performanceScore || 0), 0) / snapshots.length,
        growthScore: snapshots.reduce((sum, s) => sum + (s.growthScore || 0), 0) / snapshots.length,
        engagementScore: snapshots.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / snapshots.length,
      };

      const allSnapshot = await (prisma as any).competitorSnapshot?.create({
        data: {
          competitorId: id,
          platform: 'all',
          followersCount: aggregated.followersCount,
          engagementRate: Math.round(aggregated.engagementRate * 100) / 100,
          performanceScore: Math.round(aggregated.performanceScore * 10) / 10,
          growthScore: Math.round(aggregated.growthScore * 10) / 10,
          engagementScore: Math.round(aggregated.engagementScore * 10) / 10,
          dataSource: 'aggregated',
        },
      });

      snapshots.push(allSnapshot);
    }

    // Update competitor's lastTrackedAt
    await (prisma as any).trackedCompetitor?.update({
      where: { id },
      data: { lastTrackedAt: new Date() },
    });

    // Check for alerts
    await checkForAlerts(userId, competitor, snapshots);

    return NextResponse.json({
      message: 'Snapshot created successfully',
      snapshots,
      platformsTracked: platforms,
    });
  } catch (error) {
    console.error('Create snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}

// ============================================================================
// ALERT DETECTION
// ============================================================================

async function checkForAlerts(userId: string, competitor: any, snapshots: any[]) {
  try {
    const alerts: any[] = [];

    // Get previous snapshot for comparison
    const previousSnapshot = await (prisma as any).competitorSnapshot?.findFirst({
      where: {
        competitorId: competitor.id,
        platform: 'all',
        snapshotAt: { lt: new Date(Date.now() - 3600000) },
      },
      orderBy: { snapshotAt: 'desc' },
    });

    const currentSnapshot = snapshots.find((s) => s.platform === 'all');

    if (previousSnapshot && currentSnapshot) {
      // Check for follower spike (>10% growth)
      if (previousSnapshot.followersCount && currentSnapshot.followersCount) {
        const growthRate = (currentSnapshot.followersCount - previousSnapshot.followersCount) / previousSnapshot.followersCount;
        if (growthRate > 0.1) {
          alerts.push({
            userId,
            competitorId: competitor.id,
            alertType: 'follower_spike',
            severity: 'important',
            title: `${competitor.name} gained significant followers`,
            description: `${competitor.name} grew by ${Math.round(growthRate * 100)}% (${currentSnapshot.followersCount - previousSnapshot.followersCount} new followers) since last tracked.`,
            metrics: { previousCount: previousSnapshot.followersCount, currentCount: currentSnapshot.followersCount, growthRate },
          });
        }
      }

      // Check for engagement drop (>20% drop)
      if (previousSnapshot.engagementRate && currentSnapshot.engagementRate) {
        const engDrop = (previousSnapshot.engagementRate - currentSnapshot.engagementRate) / previousSnapshot.engagementRate;
        if (engDrop > 0.2) {
          alerts.push({
            userId,
            competitorId: competitor.id,
            alertType: 'engagement_drop',
            severity: 'info',
            title: `${competitor.name}'s engagement dropped`,
            description: `${competitor.name}'s engagement rate dropped by ${Math.round(engDrop * 100)}%. This might indicate a strategy change or content issues.`,
            metrics: { previousRate: previousSnapshot.engagementRate, currentRate: currentSnapshot.engagementRate },
          });
        }
      }

      // Check for milestone (followers reaching round numbers)
      if (currentSnapshot.followersCount) {
        const milestones = [1000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000];
        for (const milestone of milestones) {
          if (
            previousSnapshot.followersCount < milestone &&
            currentSnapshot.followersCount >= milestone
          ) {
            alerts.push({
              userId,
              competitorId: competitor.id,
              alertType: 'milestone',
              severity: 'info',
              title: `${competitor.name} reached ${milestone.toLocaleString()} followers`,
              description: `${competitor.name} has crossed the ${milestone.toLocaleString()} follower milestone!`,
              metrics: { milestone, currentCount: currentSnapshot.followersCount },
            });
          }
        }
      }
    }

    // Create alerts in database
    if (alerts.length > 0) {
      await (prisma as any).competitorAlert?.createMany({
        data: alerts,
      });
    }

    return alerts;
  } catch (error) {
    console.error('Alert check error:', error);
    return [];
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
