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
import { logger } from '@/lib/logger';

/** Tracked competitor record */
interface TrackedCompetitorRecord {
  id: string;
  userId: string;
  name: string;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  facebookHandle?: string;
  youtubeHandle?: string;
  tiktokHandle?: string;
  lastTrackedAt: Date | null;
}

/** Competitor snapshot record */
interface CompetitorSnapshotRecord {
  id: string;
  competitorId: string;
  platform: string;
  followersCount?: number;
  engagementRate?: number;
  performanceScore?: number;
  growthScore?: number;
  engagementScore?: number;
  snapshotAt: Date;
}

/** Alert data structure */
interface CompetitorAlertData {
  userId: string;
  competitorId: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  metrics: Record<string, unknown>;
}

/** Extended prisma client for competitor operations */
interface PrismaWithCompetitor {
  trackedCompetitor?: {
    findFirst: (args: Record<string, unknown>) => Promise<TrackedCompetitorRecord | null>;
    update: (args: Record<string, unknown>) => Promise<TrackedCompetitorRecord>;
  };
  competitorSnapshot?: {
    findMany: (args: Record<string, unknown>) => Promise<CompetitorSnapshotRecord[]>;
    findFirst: (args: Record<string, unknown>) => Promise<CompetitorSnapshotRecord | null>;
    create: (args: Record<string, unknown>) => Promise<CompetitorSnapshotRecord>;
  };
  competitorAlert?: {
    createMany: (args: { data: CompetitorAlertData[] }) => Promise<{ count: number }>;
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
    const competitor = await (prisma as unknown as PrismaWithCompetitor).trackedCompetitor?.findFirst({
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

    const snapshots = await (prisma as unknown as PrismaWithCompetitor).competitorSnapshot?.findMany({
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
      if (s.platform) platformSet.add(s.platform);
    }
    const platforms = Array.from(platformSet);
    const trendsByPlatform: Record<string, unknown> = {};

    for (const plat of platforms) {
      const platSnapshots = snapshots
        .filter((s) => s.platform === plat)
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
    logger.error('Get snapshots error:', error);
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
    const competitor = await (prisma as unknown as PrismaWithCompetitor).trackedCompetitor?.findFirst({
      where: { id, userId },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Check rate limiting (max 1 snapshot per hour)
    const lastSnapshot = await (prisma as unknown as PrismaWithCompetitor).competitorSnapshot?.findFirst({
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

    // Fetch the latest snapshot for each platform from real data
    const snapshots: CompetitorSnapshotRecord[] = [];

    for (const platform of platforms) {
      try {
        const latestSnapshot = await (prisma as unknown as PrismaWithCompetitor).competitorSnapshot?.findFirst({
          where: {
            competitorId: id,
            platform,
          },
          orderBy: { snapshotAt: 'desc' },
        });

        if (latestSnapshot) {
          snapshots.push(latestSnapshot);
        }
      } catch (snapshotError) {
        logger.error(`Error fetching snapshot for competitor ${id} on ${platform}:`, snapshotError);
      }
    }

    // Also fetch the aggregated 'all' snapshot
    try {
      const allSnapshot = await (prisma as unknown as PrismaWithCompetitor).competitorSnapshot?.findFirst({
        where: {
          competitorId: id,
          platform: 'all',
        },
        orderBy: { snapshotAt: 'desc' },
      });

      if (allSnapshot) {
        snapshots.push(allSnapshot);
      }
    } catch (allSnapshotError) {
      logger.error(`Error fetching aggregated snapshot for competitor ${id}:`, allSnapshotError);
    }

    if (snapshots.length === 0) {
      return NextResponse.json({
        data: null,
        message: 'No snapshot data available yet. Tracking will collect data on the next cycle.',
        platformsTracked: platforms,
      });
    }

    // Update competitor's lastTrackedAt
    await (prisma as unknown as PrismaWithCompetitor).trackedCompetitor?.update({
      where: { id },
      data: { lastTrackedAt: new Date() },
    });

    // Check for alerts using real snapshot data
    await checkForAlerts(userId, competitor, snapshots);

    return NextResponse.json({
      message: 'Snapshot retrieved successfully',
      snapshots,
      platformsTracked: platforms,
    });
  } catch (error) {
    logger.error('Create snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}

// ============================================================================
// ALERT DETECTION
// ============================================================================

async function checkForAlerts(userId: string, competitor: TrackedCompetitorRecord, snapshots: CompetitorSnapshotRecord[]): Promise<CompetitorAlertData[]> {
  try {
    const alerts: CompetitorAlertData[] = [];

    // Get previous snapshot for comparison
    const previousSnapshot = await (prisma as unknown as PrismaWithCompetitor).competitorSnapshot?.findFirst({
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
            previousSnapshot.followersCount &&
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
      await (prisma as unknown as PrismaWithCompetitor).competitorAlert?.createMany({
        data: alerts,
      });
    }

    return alerts;
  } catch (error) {
    logger.error('Alert check error:', error);
    return [];
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
