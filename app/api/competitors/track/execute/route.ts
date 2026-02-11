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

/** Competitor metrics result */
interface CompetitorMetrics {
  followersCount: number;
  followingCount: number;
  followerGrowth: number;
  totalPosts: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  engagementRate: number;
  postFrequency: number;
  topHashtags: string[];
  contentTypes: Record<string, number>;
  postingTimes: Record<string, number>;
  performanceScore: number;
  growthScore: number;
  engagementScore: number;
}

/** Competitor post data */
interface CompetitorPostData {
  platform: string;
  externalId: string;
  postUrl: string;
  content: string;
  mediaUrls: string[];
  mediaType: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  sentiment: string;
  hashtags: string[];
  mentions: string[];
  topics: string[];
  postedAt: Date;
}

/** Tracking result summary */
interface TrackingResult {
  competitorId: string;
  competitorName: string;
  platforms: string[];
  snapshotsCreated: number;
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
    create: (args: Record<string, unknown>) => Promise<CompetitorSnapshot | undefined>;
  };
  competitorPost?: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  competitorAlert?: {
    createMany: (args: { data: AlertData[] }) => Promise<{ count: number }>;
  };
}

// ============================================================================
// MOCK DATA GENERATOR (Same as snapshot route)
// ============================================================================

function generateMockMetrics(_competitor: TrackedCompetitor, _platform: string): CompetitorMetrics {
  const baseFollowers = Math.floor(Math.random() * 50000) + 1000;
  const growthRate = (Math.random() * 0.1) - 0.02;

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

function generateMockPost(competitor: TrackedCompetitor, platform: string): CompetitorPostData {
  const contentTemplates = [
    'Excited to announce our new product launch! 🚀',
    'Behind the scenes of our latest campaign...',
    'Tips for growing your business in 2026',
    'Customer spotlight: How @user achieved 3x growth',
    'Join us for our upcoming webinar on digital marketing',
    'New blog post: 10 strategies that actually work',
    'Thank you to our amazing community! 💙',
    'Product update: New features coming soon',
  ];

  return {
    platform,
    externalId: `${platform}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    postUrl: `https://${platform}.com/${competitor[`${platform}Handle`]}/post/${Date.now()}`,
    content: contentTemplates[Math.floor(Math.random() * contentTemplates.length)],
    mediaUrls: Math.random() > 0.3 ? ['https://example.com/image.jpg'] : [],
    mediaType: Math.random() > 0.5 ? 'image' : 'text',
    likes: Math.floor(Math.random() * 500) + 10,
    comments: Math.floor(Math.random() * 50) + 1,
    shares: Math.floor(Math.random() * 30),
    views: Math.floor(Math.random() * 5000) + 100,
    sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
    hashtags: ['marketing', 'business', 'growth'].slice(0, Math.floor(Math.random() * 3) + 1),
    mentions: Math.random() > 0.7 ? ['@user1', '@user2'] : [],
    topics: ['marketing', 'product', 'announcement'].slice(0, Math.floor(Math.random() * 2) + 1),
    postedAt: new Date(Date.now() - Math.random() * 86400000 * 7), // Last 7 days
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

        const snapshots: CompetitorSnapshot[] = [];

        // Create snapshots for each platform
        for (const platform of platforms) {
          const metrics = generateMockMetrics(competitor, platform);

          const snapshot = await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.create({
            data: {
              competitorId: competitor.id,
              platform,
              ...metrics,
              dataSource: 'cron',
            },
          });

          if (snapshot) {
            snapshots.push(snapshot);
          }
        }

        // Create aggregated snapshot
        if (snapshots.length > 0) {
          const aggregated = {
            followersCount: snapshots.reduce((sum, s) => sum + (s.followersCount || 0), 0),
            engagementRate: snapshots.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / snapshots.length,
            performanceScore: snapshots.reduce((sum, s) => sum + (s.performanceScore || 0), 0) / snapshots.length,
            growthScore: snapshots.reduce((sum, s) => sum + (s.growthScore || 0), 0) / snapshots.length,
            engagementScore: snapshots.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / snapshots.length,
          };

          await (prisma as unknown as PrismaWithCompetitors).competitorSnapshot?.create({
            data: {
              competitorId: competitor.id,
              platform: 'all',
              followersCount: aggregated.followersCount,
              engagementRate: Math.round(aggregated.engagementRate * 100) / 100,
              performanceScore: Math.round(aggregated.performanceScore * 10) / 10,
              growthScore: Math.round(aggregated.growthScore * 10) / 10,
              engagementScore: Math.round(aggregated.engagementScore * 10) / 10,
              dataSource: 'cron_aggregated',
            },
          });
        }

        // Track posts if enabled
        if (competitor.trackPosts) {
          for (const platform of platforms.slice(0, 2)) { // Limit to 2 platforms
            // Generate 2-5 mock posts
            const numPosts = Math.floor(Math.random() * 4) + 2;
            for (let i = 0; i < numPosts; i++) {
              const postData = generateMockPost(competitor, platform);

              // Check if post already exists
              const existing = await (prisma as unknown as PrismaWithCompetitors).competitorPost?.findFirst({
                where: {
                  competitorId: competitor.id,
                  platform,
                  externalId: postData.externalId,
                },
              });

              if (!existing) {
                const engagementRate = postData.views
                  ? ((postData.likes + postData.comments + postData.shares) / postData.views) * 100
                  : 0;

                await (prisma as unknown as PrismaWithCompetitors).competitorPost?.create({
                  data: {
                    competitorId: competitor.id,
                    ...postData,
                    engagementRate: Math.round(engagementRate * 100) / 100,
                    isTopPerforming: engagementRate > 5,
                    performancePercentile: Math.random() * 100,
                  },
                });
              }
            }
          }
        }

        // Update last tracked timestamp
        await (prisma as unknown as PrismaWithCompetitors).trackedCompetitor?.update({
          where: { id: competitor.id },
          data: { lastTrackedAt: now },
        });

        // Check for alerts
        await checkForAlerts(competitor.userId, competitor);

        results.push({
          competitorId: competitor.id,
          competitorName: competitor.name,
          platforms,
          snapshotsCreated: snapshots.length + 1,
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
