/**
 * Analytics Collection Worker
 *
 * @description Collects analytics data from social platforms on a schedule
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection URL (CRITICAL)
 * - All platform-specific API credentials
 */

import { Worker, Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tableUnavailable } from '@/lib/api/not-provisioned';
import { decryptFieldSafe } from '@/lib/security/field-encryption';
import { QUEUE_NAMES, AnalyticsJobData } from '../bull-queue';
import { META_GRAPH_BASE } from '@/lib/social/meta-graph-version';
import { InstagramService } from '@/lib/social/instagram-service';
import { LinkedInService } from '@/lib/social/linkedin-service';
import { twitterService } from '@/lib/social/twitter-service';
import { logger } from '@/lib/logger';

/**
 * Thrown after collection because the platform_analytics_snapshots table is
 * not provisioned: the snapshot cannot be stored, so the job fails honestly
 * instead of reporting success for data that was dropped.
 */
export class AnalyticsSnapshotsNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED';
  readonly table = 'platform_analytics_snapshots';
  constructor() {
    super(tableUnavailable('platform_analytics_snapshots').reason);
    this.name = 'AnalyticsSnapshotsNotProvisionedError';
  }
}

/**
 * Record sync state on the caller's connection. There are no last_metrics /
 * last_sync_error columns, so they live in the connection's metadata JSON.
 */
async function recordConnectionSync(
  connectionId: string,
  userId: string,
  state: { lastMetrics?: Record<string, number>; lastSyncError?: string }
): Promise<void> {
  const existing = await prisma.platformConnection.findFirst({
    where: { id: connectionId, userId, deletedAt: null },
    select: { metadata: true },
  });
  if (!existing) return;
  const metadata = {
    ...((existing.metadata as Record<string, unknown> | null) ?? {}),
    ...state,
  };
  await prisma.platformConnection.updateMany({
    where: { id: connectionId, userId, deletedAt: null },
    data: { lastSync: new Date(), metadata: metadata as Prisma.InputJsonValue },
  });
}

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { host: 'localhost', port: 6379 };
  }

  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

/**
 * Process an analytics collection job
 */
async function processAnalyticsCollection(
  job: Job<AnalyticsJobData>
): Promise<void> {
  const { userId, platform, connectionId, dateRange } = job.data;

  logger.info(`Collecting analytics for ${platform}`, {
    jobId: job.id,
    userId,
  });

  try {
    // Get user's platform connection
    const connection = await prisma.platformConnection.findFirst({
      where: { id: connectionId, userId, deletedAt: null },
    });

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (!connection.isActive) {
      logger.warn(`Connection ${connectionId} is inactive, skipping analytics`);
      return;
    }

    const accessToken = decryptFieldSafe(connection.accessToken) ?? '';
    const refreshToken = decryptFieldSafe(connection.refreshToken) ?? undefined;

    let analyticsResult: {
      success: boolean;
      metrics?: Record<string, number>;
      error?: string;
    };

    // Collect analytics from the appropriate platform
    switch (platform) {
      case 'twitter': {
        // Twitter analytics via Twitter API v2
        // Note: Requires elevated access for detailed analytics
        analyticsResult = {
          success: true,
          metrics: {
            impressions: 0,
            engagements: 0,
            followers: 0,
          },
        };
        break;
      }

      case 'instagram': {
        const instagramService = new InstagramService();
        instagramService.initialize({
          accessToken,
          refreshToken,
        });

        const result = await instagramService.syncAnalytics(30);
        analyticsResult = {
          success: result.success,
          metrics: result.metrics,
          error: result.error,
        };
        break;
      }

      case 'linkedin': {
        const linkedInService = new LinkedInService();
        linkedInService.initialize({
          accessToken,
          refreshToken,
        });

        const result = await linkedInService.syncAnalytics(30);
        analyticsResult = {
          success: result.success,
          metrics: result.metrics,
          error: result.error,
        };
        break;
      }

      case 'facebook': {
        // Collect Facebook Page insights
        const pageId = connection.profileId;
        const pageAccessToken = accessToken;

        try {
          const response = await fetch(
            `${META_GRAPH_BASE}/${pageId}/insights?` +
              `metric=page_impressions,page_engaged_users,page_fans&` +
              `period=day&access_token=${pageAccessToken}`
          );

          const data = await response.json();

          if (data.error) {
            throw new Error(data.error.message || 'Facebook API error');
          }

          const metrics: Record<string, number> = {
            impressions: 0,
            engagements: 0,
            followers: 0,
          };

          for (const insight of data.data || []) {
            const value =
              insight.values?.[insight.values.length - 1]?.value || 0;
            switch (insight.name) {
              case 'page_impressions':
                metrics.impressions = value;
                break;
              case 'page_engaged_users':
                metrics.engagements = value;
                break;
              case 'page_fans':
                metrics.followers = value;
                break;
            }
          }

          analyticsResult = { success: true, metrics };
        } catch (error: unknown) {
          analyticsResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
        break;
      }

      case 'tiktok': {
        // TikTok analytics via Business API
        try {
          const response = await fetch(
            'https://business-api.tiktok.com/open_api/v1.3/business/get/',
            {
              method: 'GET',
              headers: {
                'Access-Token': accessToken,
              },
            }
          );

          const data = await response.json();

          if (data.code !== 0) {
            throw new Error(data.message || 'TikTok API error');
          }

          analyticsResult = {
            success: true,
            metrics: {
              followers: data.data?.follower_count || 0,
              likes: data.data?.likes_count || 0,
              views: data.data?.video_views || 0,
            },
          };
        } catch (error: unknown) {
          analyticsResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
        break;
      }

      case 'youtube': {
        // YouTube analytics via YouTube Analytics API
        try {
          const response = await fetch(
            `https://youtubeanalytics.googleapis.com/v2/reports?` +
              `ids=channel==MINE&` +
              `metrics=views,likes,subscribersGained&` +
              `dimensions=day&` +
              `startDate=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&` +
              `endDate=${new Date().toISOString().split('T')[0]}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          const data = await response.json();

          if (data.error) {
            throw new Error(data.error.message || 'YouTube API error');
          }

          // Aggregate metrics from rows
          let views = 0,
            likes = 0,
            subscribers = 0;
          for (const row of data.rows || []) {
            views += row[1] || 0;
            likes += row[2] || 0;
            subscribers += row[3] || 0;
          }

          analyticsResult = {
            success: true,
            metrics: {
              views,
              likes,
              followers: subscribers,
            },
          };
        } catch (error: unknown) {
          analyticsResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
        break;
      }

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    if (!analyticsResult.success) {
      throw new Error(analyticsResult.error || 'Failed to collect analytics');
    }

    // Update connection with latest metrics
    await recordConnectionSync(connectionId, userId, {
      lastMetrics: analyticsResult.metrics,
    });

    // The snapshot history table is not provisioned: fail the job honestly.
    throw new AnalyticsSnapshotsNotProvisionedError();
  } catch (error: unknown) {
    logger.error(`Failed to collect analytics for ${platform}:`, { error });

    // Update connection with error (the not-provisioned case already saved
    // its metrics above and is not a sync error).
    if (!(error instanceof AnalyticsSnapshotsNotProvisionedError)) {
      await recordConnectionSync(connectionId, userId, {
        lastSyncError: error instanceof Error ? error.message : String(error),
      });
    }

    throw error;
  }
}

/**
 * Create and start the analytics collection worker
 */
export function createAnalyticsWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.ANALYTICS_COLLECTION,
    async (job: Job<AnalyticsJobData>) => {
      await processAnalyticsCollection(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 10, // Process up to 10 analytics jobs concurrently
      limiter: {
        max: 20,
        duration: 1000, // Max 20 jobs per second
      },
    }
  );

  worker.on('completed', job => {
    logger.debug(`Analytics job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Analytics job ${job?.id} failed:`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  worker.on('error', error => {
    logger.error('Analytics worker error:', { error });
  });

  logger.info('Analytics collection worker started');

  return worker;
}

export { processAnalyticsCollection };
