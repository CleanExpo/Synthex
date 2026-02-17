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
import { fetchCompetitorMetrics } from '@/lib/social/competitor-fetcher';

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
  snapshotsCreated: number;
  snapshotsFailed: number;
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

/** Platform connection record */
interface PlatformConnectionRecord {
  id: string;
  userId: string;
  platform: string;
  accessToken: string;
  isActive: boolean;
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
  platformConnection?: {
    findFirst: (args: Record<string, unknown>) => Promise<PlatformConnectionRecord | null>;
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

    // Map platform names to competitor handle fields
    const platformHandleMap: Record<string, keyof TrackedCompetitor> = {
      twitter: 'twitterHandle',
      instagram: 'instagramHandle',
      linkedin: 'linkedinHandle',
      facebook: 'facebookHandle',
      youtube: 'youtubeHandle',
      tiktok: 'tiktokHandle',
    };

    // Process each competitor
    for (const competitor of dueCompetitors) {
      try {
        // Determine platforms to track based on configured handles
        const platformsWithHandles: { platform: string; handle: string }[] = [];
        for (const [platform, handleField] of Object.entries(platformHandleMap)) {
          const handle = competitor[handleField];
          if (typeof handle === 'string' && handle.length > 0) {
            platformsWithHandles.push({ platform, handle });
          }
        }

        if (platformsWithHandles.length === 0) {
          errors.push({ competitorId: competitor.id, error: 'No social handles configured' });
          continue;
        }

        const platforms = platformsWithHandles.map(p => p.platform);
        let snapshotsCreated = 0;
        let snapshotsFailed = 0;
        let totalPostsFound = 0;

        // Fetch real metrics for each platform via API
        for (const { platform, handle } of platformsWithHandles) {
          try {
            // Look up the Synthex user's access token for this platform
            const connection = await (prisma as unknown as PrismaWithCompetitors).platformConnection?.findFirst({
              where: {
                userId: competitor.userId,
                platform,
                isActive: true,
              },
            });

            const accessToken = connection?.accessToken ?? null;

            // Fetch real metrics from platform API
            const metrics = await fetchCompetitorMetrics(platform, handle, accessToken);

            // Get previous snapshot for followerGrowth calculation
            const previousSnapshot = await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.findFirst({
              where: {
                competitorId: competitor.id,
                platform,
              },
              orderBy: { snapshotAt: 'desc' },
              select: { followersCount: true },
            });

            if (metrics.success) {
              // Calculate follower growth delta
              const followerGrowth = (metrics.followersCount !== null && previousSnapshot?.followersCount)
                ? metrics.followersCount - previousSnapshot.followersCount
                : 0;

              // Create snapshot with real API data
              await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.create({
                data: {
                  competitorId: competitor.id,
                  platform,
                  followersCount: metrics.followersCount,
                  followingCount: metrics.followingCount,
                  followerGrowth,
                  totalPosts: metrics.postsCount,
                  engagementRate: metrics.engagementRate,
                  // Leave calculated fields null — real scores require historical analysis
                  avgLikes: null,
                  avgComments: null,
                  avgShares: null,
                  postFrequency: null,
                  topHashtags: [],
                  contentTypes: {},
                  postingTimes: {},
                  performanceScore: null,
                  growthScore: null,
                  engagementScore: null,
                  dataSource: 'api',
                },
              });
              snapshotsCreated++;
            } else {
              // API call failed — log warning and create snapshot noting the failure
              console.warn(
                `[competitor-cron] Fetch failed for ${competitor.name} on ${platform}: ${metrics.error}`
              );
              await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.create({
                data: {
                  competitorId: competitor.id,
                  platform,
                  followersCount: null,
                  followingCount: null,
                  followerGrowth: null,
                  totalPosts: null,
                  engagementRate: null,
                  avgLikes: null,
                  avgComments: null,
                  avgShares: null,
                  postFrequency: null,
                  topHashtags: [],
                  contentTypes: {},
                  postingTimes: {},
                  performanceScore: null,
                  growthScore: null,
                  engagementScore: null,
                  dataSource: metrics.error?.includes('does not support') ? 'unsupported' : 'error',
                },
              });
              snapshotsFailed++;
            }
          } catch (snapshotError) {
            console.error(`Error processing competitor ${competitor.id} on ${platform}:`, snapshotError);
            snapshotsFailed++;
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
                select: { id: true },
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

        // Check for alerts based on real snapshot data (per-platform)
        await checkForAlerts(competitor.userId, competitor, platforms);

        results.push({
          competitorId: competitor.id,
          competitorName: competitor.name,
          platforms,
          snapshotsCreated,
          snapshotsFailed,
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
// ALERT DETECTION — uses real per-platform metric deltas
// ============================================================================

async function checkForAlerts(
  userId: string,
  competitor: TrackedCompetitor,
  platforms: string[]
): Promise<void> {
  try {
    const alerts: AlertData[] = [];

    // Check each platform's snapshots for significant changes
    for (const platform of platforms) {
      const snapshots = await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.findMany({
        where: { competitorId: competitor.id, platform },
        orderBy: { snapshotAt: 'desc' },
        take: 2,
        select: { id: true, followersCount: true, engagementRate: true },
      }) || [];

      if (snapshots.length < 2) continue;

      const [current, previous] = snapshots;

      // Skip if either snapshot lacks real data
      if (!current.followersCount || !previous.followersCount) continue;

      // Follower spike detection (>10% growth)
      const followerGrowthRate =
        (current.followersCount - previous.followersCount) / previous.followersCount;

      if (followerGrowthRate > 0.1) {
        alerts.push({
          userId,
          competitorId: competitor.id,
          alertType: 'follower_spike',
          severity: 'warning',
          title: `${competitor.name} gained ${Math.round(followerGrowthRate * 100)}% followers on ${platform}`,
          description: `${competitor.name} grew from ${previous.followersCount.toLocaleString()} to ${current.followersCount.toLocaleString()} followers on ${platform} (${Math.round(followerGrowthRate * 100)}% increase).`,
          metrics: {
            platform,
            growthRate: followerGrowthRate,
            previousFollowers: previous.followersCount,
            currentFollowers: current.followersCount,
            change: current.followersCount - previous.followersCount,
          },
        });
      }

      // Engagement rate change detection (>50% relative change, if available)
      if (current.engagementRate && previous.engagementRate && previous.engagementRate > 0) {
        const engagementDelta =
          (current.engagementRate - previous.engagementRate) / previous.engagementRate;

        if (Math.abs(engagementDelta) > 0.5) {
          const direction = engagementDelta > 0 ? 'increased' : 'decreased';
          alerts.push({
            userId,
            competitorId: competitor.id,
            alertType: 'strategy_change',
            severity: 'info',
            title: `${competitor.name}'s engagement ${direction} on ${platform}`,
            description: `${competitor.name}'s engagement rate ${direction} by ${Math.round(Math.abs(engagementDelta) * 100)}% on ${platform}.`,
            metrics: {
              platform,
              engagementDelta,
              previousRate: previous.engagementRate,
              currentRate: current.engagementRate,
            },
          });
        }
      }
    }

    // Create all alerts in batch
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
