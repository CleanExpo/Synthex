/**
 * Competitor Tracking Execution API Route
 *
 * @description Automated competitor tracking execution:
 * - POST: Execute tracking for due competitors (Vercel Cron)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Cron authentication (SECRET)
 *
 * FAILURE MODE: Returns partial results on individual failures
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Tracked competitor record from database */
interface TrackedCompetitor {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  trackMetrics: boolean;
  trackPosts: boolean;
  trackingFrequency: 'hourly' | 'daily' | 'weekly';
  lastTrackedAt: Date | null;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  facebookHandle?: string;
  youtubeHandle?: string;
  tiktokHandle?: string;
  [key: string]: string | boolean | Date | null | undefined;
}

/** Competitor snapshot record */
interface CompetitorSnapshot {
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

/** Tracking result summary */
interface TrackingResult {
  competitorId: string;
  competitorName: string;
  platforms: string[];
  snapshotsFound: number;
  postsFound: number;
}

/** Tracking error */
interface TrackingError {
  competitorId: string;
  error: string;
}

/** Alert data */
interface AlertData {
  userId: string;
  competitorId: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  metrics: Record<string, unknown>;
}

/** Extended prisma client for competitor tracking */
interface PrismaWithCompetitors {
  trackedCompetitor?: {
    findMany: (args: Record<string, unknown>) => Promise<TrackedCompetitor[]>;
    update: (args: Record<string, unknown>) => Promise<TrackedCompetitor>;
  };
  competitorSnapshot?: {
    findMany: (args: Record<string, unknown>) => Promise<CompetitorSnapshot[]>;
    findFirst: (args: Record<string, unknown>) => Promise<CompetitorSnapshot | null>;
    create: (args: Record<string, unknown>) => Promise<CompetitorSnapshot | undefined>;
  };
  competitorPost?: {
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  };
  competitorAlert?: {
    createMany: (args: { data: AlertData[] }) => Promise<{ count: number }>;
  };
}

// ============================================================================
// POST /api/competitors/track/execute
// Execute competitor tracking (Cron)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret or internal call
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow if cron secret matches or if it's an internal Vercel cron call
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    const isAuthorized =
      isVercelCron ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      !cronSecret; // Allow if no secret configured (dev mode)

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Get tracking thresholds
    const hourlyThreshold = new Date(now.getTime() - 3600000);      // 1 hour ago
    const dailyThreshold = new Date(now.getTime() - 86400000);      // 24 hours ago
    const weeklyThreshold = new Date(now.getTime() - 604800000);    // 7 days ago

    // Find competitors due for tracking
    const dueCompetitors: TrackedCompetitor[] = await (prisma as unknown as PrismaWithCompetitors).trackedCompetitor?.findMany({
      where: {
        isActive: true,
        trackMetrics: true,
        OR: [
          // Hourly tracking due
          {
            trackingFrequency: 'hourly',
            OR: [
              { lastTrackedAt: null },
              { lastTrackedAt: { lt: hourlyThreshold } },
            ],
          },
          // Daily tracking due
          {
            trackingFrequency: 'daily',
            OR: [
              { lastTrackedAt: null },
              { lastTrackedAt: { lt: dailyThreshold } },
            ],
          },
          // Weekly tracking due
          {
            trackingFrequency: 'weekly',
            OR: [
              { lastTrackedAt: null },
              { lastTrackedAt: { lt: weeklyThreshold } },
            ],
          },
        ],
      },
      take: 50, // Process max 50 per execution to avoid timeouts
      orderBy: { lastTrackedAt: 'asc' }, // Oldest first
    }) || [];

    if (dueCompetitors.length === 0) {
      return NextResponse.json({
        message: 'No competitors due for tracking',
        processed: 0,
        timestamp: now.toISOString(),
      });
    }

    const results: TrackingResult[] = [];
    const errors: TrackingError[] = [];

    // Process each competitor
    for (const competitor of dueCompetitors) {
      try {
        // Determine platforms to track
        const platforms: string[] = [];
        if (competitor.twitterHandle) platforms.push('twitter');
        if (competitor.instagramHandle) platforms.push('instagram');
        if (competitor.linkedinHandle) platforms.push('linkedin');
        if (competitor.facebookHandle) platforms.push('facebook');
        if (competitor.youtubeHandle) platforms.push('youtube');
        if (competitor.tiktokHandle) platforms.push('tiktok');

        if (platforms.length === 0) {
          errors.push({ competitorId: competitor.id, error: 'No social handles configured' });
          continue;
        }

        let totalSnapshotsFound = 0;
        let totalPostsFound = 0;

        // Fetch the latest snapshot for each platform from real data
        for (const platform of platforms) {
          try {
            const latestSnapshot = await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.findFirst({
              where: {
                competitorId: competitor.id,
                platform,
              },
              orderBy: { snapshotAt: 'desc' },
            });

            if (latestSnapshot) {
              totalSnapshotsFound++;
            } else {
              // No snapshot exists yet -- create a pending placeholder with zero metrics
              await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.create({
                data: {
                  competitorId: competitor.id,
                  platform,
                  followersCount: 0,
                  followingCount: 0,
                  followerGrowth: 0,
                  totalPosts: 0,
                  avgLikes: 0,
                  avgComments: 0,
                  avgShares: 0,
                  engagementRate: 0,
                  postFrequency: 0,
                  topHashtags: [],
                  contentTypes: {},
                  postingTimes: {},
                  performanceScore: 0,
                  growthScore: 0,
                  engagementScore: 0,
                  dataSource: 'pending',
                },
              });
            }
          } catch (snapshotError) {
            console.error(`Error fetching/creating snapshot for competitor ${competitor.id} on ${platform}:`, snapshotError);
          }
        }

        // Fetch existing posts if post tracking is enabled
        if (competitor.trackPosts) {
          for (const platform of platforms.slice(0, 2)) { // Limit to 2 platforms
            try {
              const existingPosts = await (prisma as unknown as PrismaWithCompetitors).competitorPost?.findMany({
                where: {
                  competitorId: competitor.id,
                  platform,
                },
                orderBy: { postedAt: 'desc' },
                take: 10,
              }) || [];

              totalPostsFound += existingPosts.length;
            } catch (postError) {
              console.error(`Error fetching posts for competitor ${competitor.id} on ${platform}:`, postError);
            }
          }
        }

        // Update last tracked timestamp
        await (prisma as unknown as PrismaWithCompetitors).trackedCompetitor?.update({
          where: { id: competitor.id },
          data: { lastTrackedAt: now },
        });

        // Check for alerts based on real snapshot data
        await checkForAlerts(competitor.userId, competitor);

        results.push({
          competitorId: competitor.id,
          competitorName: competitor.name,
          platforms,
          snapshotsFound: totalSnapshotsFound,
          postsFound: totalPostsFound,
        });
      } catch (error) {
        console.error(`Error tracking competitor ${competitor.id}:`, error);
        errors.push({
          competitorId: competitor.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Competitor tracking execution completed',
      processed: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Tracking execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute competitor tracking' },
      { status: 500 }
    );
  }
}

// ============================================================================
// ALERT DETECTION (simplified version)
// ============================================================================

async function checkForAlerts(userId: string, competitor: TrackedCompetitor): Promise<void> {
  try {
    // Get last two snapshots for comparison
    const snapshots = await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.findMany({
      where: { competitorId: competitor.id, platform: 'all' },
      orderBy: { snapshotAt: 'desc' },
      take: 2,
    }) || [];

    if (snapshots.length < 2) return;

    const [current, previous] = snapshots;
    const alerts: AlertData[] = [];

    // Follower spike detection (>10% growth)
    if (current.followersCount && previous.followersCount) {
      const growthRate = (current.followersCount - previous.followersCount) / previous.followersCount;
      if (growthRate > 0.1) {
        alerts.push({
          userId,
          competitorId: competitor.id,
          alertType: 'follower_spike',
          severity: 'important',
          title: `${competitor.name} gained significant followers`,
          description: `${competitor.name} grew by ${Math.round(growthRate * 100)}% recently.`,
          metrics: { growthRate, change: current.followersCount - previous.followersCount },
        });
      }
    }

    // Create alerts
    if (alerts.length > 0) {
      await (prisma as unknown as PrismaWithCompetitors).competitorAlert?.createMany({
        data: alerts,
      });
    }
  } catch (error) {
    console.error('Alert check error:', error);
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
