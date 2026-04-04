/**
 * Platform Sync Service
 *
 * @description Synchronizes data with social media platforms:
 * - Real-time webhook processing
 * - Polling fallback for platforms without webhooks
 * - Metrics aggregation and caching
 * - Rate limiting and backoff strategies
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: Database connection (CRITICAL)
 * - REDIS_URL: Redis for sync state (SECRET)
 *
 * FAILURE MODE: Degrades to slower polling intervals
 */

import { logger } from '@/lib/logger';
import { getCache } from '@/lib/cache/cache-manager';
import { getRedisClient } from '@/lib/redis-client';
import { InvalidationStrategy } from '@/lib/cache/invalidation-strategy';

// ============================================================================
// TYPES
// ============================================================================

export type Platform = 'twitter' | 'instagram' | 'linkedin' | 'tiktok' | 'facebook' | 'youtube' | 'pinterest' | 'reddit';

export interface WebhookEvent {
  type: 'engagement' | 'follower_change' | 'post_performance' | 'mention' | 'message' | 'error';
  platform: Platform;
  userId: string;
  postId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
  signature?: string;
}

export interface PlatformMetrics {
  followers: number;
  following: number;
  posts: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    impressions: number;
    reach: number;
  };
  growth: {
    followersGained: number;
    followersLost: number;
    periodDays: number;
  };
  lastSync: Date;
}

export interface SyncStatus {
  platform: Platform;
  userId: string;
  lastSync: Date;
  nextSync: Date;
  status: 'synced' | 'syncing' | 'error' | 'pending';
  errorMessage?: string;
  errorCount: number;
}

export interface SyncConfig {
  pollingIntervalMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  pollingIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
  backoffMultiplier: 2,
  maxBackoffMs: 30 * 60 * 1000, // 30 minutes max
};

const PLATFORM_CONFIGS: Record<Platform, Partial<SyncConfig>> = {
  twitter: { pollingIntervalMs: 3 * 60 * 1000 }, // Twitter has faster rate limits
  instagram: { pollingIntervalMs: 5 * 60 * 1000 },
  linkedin: { pollingIntervalMs: 10 * 60 * 1000 }, // LinkedIn is slower
  tiktok: { pollingIntervalMs: 5 * 60 * 1000 },
  facebook: { pollingIntervalMs: 5 * 60 * 1000 },
  youtube: { pollingIntervalMs: 15 * 60 * 1000 }, // YouTube analytics are slower
  pinterest: { pollingIntervalMs: 10 * 60 * 1000 },
  reddit: { pollingIntervalMs: 5 * 60 * 1000 },
};

// ============================================================================
// PLATFORM SYNC SERVICE
// ============================================================================

export class PlatformSyncService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private syncStatus: Map<string, SyncStatus> = new Map();
  private eventHandlers: Map<string, Array<(event: WebhookEvent) => Promise<void>>> = new Map();

  /**
   * Handle incoming webhook from a platform
   */
  async handleWebhook(
    platform: Platform,
    event: WebhookEvent
  ): Promise<void> {
    logger.info('Processing webhook', { platform, eventType: event.type, userId: event.userId });

    try {
      switch (event.type) {
        case 'engagement':
          await this.updateEngagementMetrics(event);
          break;

        case 'follower_change':
          await this.updateFollowerCount(event);
          break;

        case 'post_performance':
          await this.updatePostMetrics(event);
          break;

        case 'mention':
          await this.processMention(event);
          break;

        case 'message':
          await this.processMessage(event);
          break;

        case 'error':
          await this.handlePlatformError(event);
          break;
      }

      // Broadcast update to connected clients
      await this.broadcastUpdate(event.userId, event);

      // Notify event handlers
      await this.notifyHandlers(event);

    } catch (error) {
      logger.error('Webhook processing failed', { platform, event, error });
      throw error;
    }
  }

  /**
   * Update engagement metrics from webhook
   */
  private async updateEngagementMetrics(event: WebhookEvent): Promise<void> {
    const cache = getCache();
    const metricsKey = `metrics:${event.userId}:${event.platform}`;

    const metrics = await cache.get<PlatformMetrics>(metricsKey) || this.createEmptyMetrics();

    // Update engagement data
    const engagementData = event.data as Partial<typeof metrics.engagement>;
    metrics.engagement = {
      ...metrics.engagement,
      ...engagementData,
    };
    metrics.lastSync = new Date();

    await cache.set(metricsKey, metrics, { ttl: 300, tags: [`user:${event.userId}`, 'metrics'] });

    // Invalidate dashboard cache
    await InvalidationStrategy.invalidateByPattern(`dashboard:${event.userId}:*`);
  }

  /**
   * Update follower count from webhook
   */
  private async updateFollowerCount(event: WebhookEvent): Promise<void> {
    const cache = getCache();
    const metricsKey = `metrics:${event.userId}:${event.platform}`;

    const metrics = await cache.get<PlatformMetrics>(metricsKey) || this.createEmptyMetrics();
    const previousFollowers = metrics.followers;

    // Update follower data
    if (typeof event.data.followers === 'number') {
      metrics.followers = event.data.followers;
    }
    if (typeof event.data.following === 'number') {
      metrics.following = event.data.following;
    }

    // Calculate growth
    const change = metrics.followers - previousFollowers;
    if (change > 0) {
      metrics.growth.followersGained += change;
    } else {
      metrics.growth.followersLost += Math.abs(change);
    }

    metrics.lastSync = new Date();

    await cache.set(metricsKey, metrics, { ttl: 300, tags: [`user:${event.userId}`, 'metrics'] });
  }

  /**
   * Update post-specific metrics
   */
  private async updatePostMetrics(event: WebhookEvent): Promise<void> {
    if (!event.postId) {
      logger.warn('Post metrics webhook missing postId');
      return;
    }

    const cache = getCache();
    const postMetricsKey = `post:${event.postId}:metrics`;

    const postMetrics = {
      postId: event.postId,
      platform: event.platform,
      ...(event.data as Record<string, unknown>),
      updatedAt: new Date(),
    };

    await cache.set(postMetricsKey, postMetrics, { ttl: 600, tags: [`post:${event.postId}`, 'metrics'] });
  }

  /**
   * Process mention event
   */
  private async processMention(event: WebhookEvent): Promise<void> {
    // Store mention for notification
    const cache = getCache();
    const mentionsKey = `mentions:${event.userId}`;

    const mentions = await cache.get<WebhookEvent[]>(mentionsKey) || [];
    mentions.unshift(event);

    // Keep only last 100 mentions
    if (mentions.length > 100) {
      mentions.length = 100;
    }

    await cache.set(mentionsKey, mentions, { ttl: 86400, tags: [`user:${event.userId}`] });

    logger.info('Mention processed', { userId: event.userId, platform: event.platform });
  }

  /**
   * Process direct message event
   */
  private async processMessage(event: WebhookEvent): Promise<void> {
    // For now, just log - actual implementation would notify user
    logger.info('Message received', {
      userId: event.userId,
      platform: event.platform,
      // Don't log message content for privacy
    });
  }

  /**
   * Handle platform error event
   */
  private async handlePlatformError(event: WebhookEvent): Promise<void> {
    const statusKey = `${event.userId}:${event.platform}`;
    const status = this.syncStatus.get(statusKey);

    if (status) {
      status.status = 'error';
      status.errorMessage = String(event.data.error || 'Unknown error');
      status.errorCount++;
    }

    logger.error('Platform error received', {
      userId: event.userId,
      platform: event.platform,
      error: event.data.error,
    });
  }

  /**
   * Broadcast update to connected clients via pub/sub
   */
  async broadcastUpdate(userId: string, event: WebhookEvent): Promise<void> {
    try {
      const redis = getRedisClient();
      const channel = `updates:${userId}`;

      await redis.set(`pubsub:${channel}:${Date.now()}`, JSON.stringify({
        type: event.type,
        platform: event.platform,
        timestamp: event.timestamp,
        data: event.data,
      }), 60);

      logger.debug('Update broadcast', { userId, channel });
    } catch (error) {
      logger.warn('Failed to broadcast update', { userId, error });
    }
  }

  /**
   * Start polling sync for a user's platform
   */
  async startPollingSync(
    userId: string,
    platforms: Platform[]
  ): Promise<void> {
    for (const platform of platforms) {
      const key = `${userId}:${platform}`;

      // Don't start if already syncing
      if (this.syncIntervals.has(key)) {
        continue;
      }

      const config = { ...DEFAULT_SYNC_CONFIG, ...PLATFORM_CONFIGS[platform] };

      // Initialize sync status
      this.syncStatus.set(key, {
        platform,
        userId,
        lastSync: new Date(0),
        nextSync: new Date(),
        status: 'pending',
        errorCount: 0,
      });

      // Start polling
      const interval = setInterval(async () => {
        await this.syncPlatform(userId, platform, config);
      }, config.pollingIntervalMs);

      this.syncIntervals.set(key, interval);

      // Do initial sync
      await this.syncPlatform(userId, platform, config);

      logger.info('Started polling sync', { userId, platform, intervalMs: config.pollingIntervalMs });
    }
  }

  /**
   * Stop polling sync for a user's platform
   */
  stopPollingSync(userId: string, platform?: Platform): void {
    if (platform) {
      const key = `${userId}:${platform}`;
      const interval = this.syncIntervals.get(key);
      if (interval) {
        clearInterval(interval);
        this.syncIntervals.delete(key);
        this.syncStatus.delete(key);
      }
    } else {
      // Stop all platforms for user
      for (const [key, interval] of this.syncIntervals) {
        if (key.startsWith(`${userId}:`)) {
          clearInterval(interval);
          this.syncIntervals.delete(key);
          this.syncStatus.delete(key);
        }
      }
    }

    logger.info('Stopped polling sync', { userId, platform });
  }

  /**
   * Sync a specific platform
   */
  private async syncPlatform(
    userId: string,
    platform: Platform,
    config: SyncConfig
  ): Promise<void> {
    const key = `${userId}:${platform}`;
    const status = this.syncStatus.get(key);

    if (!status) return;

    status.status = 'syncing';

    try {
      // Fetch latest metrics from platform
      const metrics = await this.fetchPlatformMetrics(userId, platform);

      // Update cache
      const cache = getCache();
      await cache.set(`metrics:${userId}:${platform}`, metrics, {
        ttl: 300,
        tags: [`user:${userId}`, 'metrics', platform],
      });

      // Update status
      status.status = 'synced';
      status.lastSync = new Date();
      status.nextSync = new Date(Date.now() + config.pollingIntervalMs);
      status.errorCount = 0;

      logger.debug('Platform synced', { userId, platform });
    } catch (error) {
      status.status = 'error';
      status.errorMessage = (error as Error).message;
      status.errorCount++;

      // Apply backoff
      const backoffMs = Math.min(
        config.pollingIntervalMs * Math.pow(config.backoffMultiplier, status.errorCount),
        config.maxBackoffMs
      );
      status.nextSync = new Date(Date.now() + backoffMs);

      logger.error('Platform sync failed', { userId, platform, error, backoffMs });
    }
  }

  /**
   * Fetch metrics from a platform (placeholder - would use actual API)
   */
  private async fetchPlatformMetrics(
    userId: string,
    platform: Platform
  ): Promise<PlatformMetrics> {
    // In production, this would call actual platform APIs
    // For now, return cached or empty metrics
    const cache = getCache();
    const cached = await cache.get<PlatformMetrics>(`metrics:${userId}:${platform}`);

    if (cached) {
      return {
        ...cached,
        lastSync: new Date(),
      };
    }

    return this.createEmptyMetrics();
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): PlatformMetrics {
    return {
      followers: 0,
      following: 0,
      posts: 0,
      engagement: {
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        impressions: 0,
        reach: 0,
      },
      growth: {
        followersGained: 0,
        followersLost: 0,
        periodDays: 30,
      },
      lastSync: new Date(),
    };
  }

  /**
   * Register an event handler
   */
  onEvent(eventType: string, handler: (event: WebhookEvent) => Promise<void>): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * Notify registered event handlers
   */
  private async notifyHandlers(event: WebhookEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    const allHandlers = this.eventHandlers.get('*') || [];

    for (const handler of [...handlers, ...allHandlers]) {
      try {
        await handler(event);
      } catch (error) {
        logger.error('Event handler failed', { eventType: event.type, error });
      }
    }
  }

  /**
   * Get sync status for a user
   */
  getSyncStatus(userId: string, platform?: Platform): SyncStatus | SyncStatus[] | null {
    if (platform) {
      return this.syncStatus.get(`${userId}:${platform}`) || null;
    }

    const statuses: SyncStatus[] = [];
    for (const [key, status] of this.syncStatus) {
      if (key.startsWith(`${userId}:`)) {
        statuses.push(status);
      }
    }
    return statuses.length > 0 ? statuses : null;
  }

  /**
   * Get aggregated metrics for a user
   */
  async getAggregatedMetrics(userId: string): Promise<Record<Platform, PlatformMetrics>> {
    const cache = getCache();
    const result: Partial<Record<Platform, PlatformMetrics>> = {};

    const platforms: Platform[] = ['twitter', 'instagram', 'linkedin', 'tiktok', 'facebook', 'youtube', 'pinterest', 'reddit'];

    for (const platform of platforms) {
      const metrics = await cache.get<PlatformMetrics>(`metrics:${userId}:${platform}`);
      if (metrics) {
        result[platform] = metrics;
      }
    }

    return result as Record<Platform, PlatformMetrics>;
  }

  /**
   * Stop all syncing (for cleanup)
   */
  stopAll(): void {
    for (const [key, interval] of this.syncIntervals) {
      clearInterval(interval);
    }
    this.syncIntervals.clear();
    this.syncStatus.clear();
    logger.info('All platform syncs stopped');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let platformSyncService: PlatformSyncService | null = null;

export function getPlatformSyncService(): PlatformSyncService {
  if (!platformSyncService) {
    platformSyncService = new PlatformSyncService();
  }
  return platformSyncService;
}

// Export default
export default PlatformSyncService;
