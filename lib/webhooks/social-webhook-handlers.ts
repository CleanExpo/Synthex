/**
 * Social Platform Webhook Event Handlers
 *
 * @description Processes incoming webhook events from social media platforms:
 * - Post published/failed confirmations -> update PlatformPost status
 * - Engagement events (likes, comments, shares) -> upsert PlatformMetrics
 * - Follower events -> update PlatformConnection metadata
 * - Account status changes -> update PlatformConnection
 *
 * ARCHITECTURE NOTE:
 * Follows the same pattern as `lib/stripe/webhook-handlers.ts`:
 * - Define handler functions for each event type
 * - Register them on the shared `webhookHandler` singleton
 * - Auto-register on import so the route file only needs `import '@/lib/webhooks/social-webhook-handlers'`
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - Platform-specific webhook secrets (loaded by SignatureVerifier)
 */

import { WebhookEvent } from '@/lib/webhooks/types';
import { webhookHandler } from '@/lib/webhooks/webhook-handler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

/** Shape of engagement data that may arrive from different platforms */
interface EngagementPayload {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  reach?: number;
  impressions?: number;
  clicks?: number;
  saves?: number;
  engagementRate?: number;
  [key: string]: unknown;
}

/** Shape of a post-related webhook payload */
interface PostPayload {
  postId?: string;         // Our internal PlatformPost ID (if we embedded it)
  platformId?: string;     // The platform's native post ID
  connectionId?: string;   // Our internal PlatformConnection ID
  url?: string;            // Published URL on the platform
  error?: string;          // Error message if failed
  message?: string;        // Human-readable message
  [key: string]: unknown;
}

/** Shape of a follower event payload */
interface FollowerPayload {
  connectionId?: string;
  profileId?: string;      // Platform profile/page ID
  platform?: string;
  followerCount?: number;
  change?: number;         // +1 for gain, -1 for loss
  milestone?: number;      // e.g. 1000, 5000, 10000
  [key: string]: unknown;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find a PlatformPost by internal ID or platform-native ID + connection.
 * Returns the post ID for metrics recording, or null if not found.
 */
async function findPlatformPost(
  data: PostPayload
): Promise<{ id: string; connectionId: string } | null> {
  // Try by our internal post ID first
  if (data.postId) {
    const post = await prisma.platformPost.findUnique({
      where: { id: data.postId },
      select: { id: true, connectionId: true },
    });
    if (post) return post;
  }

  // Try by platform-native ID within a specific connection
  if (data.platformId && data.connectionId) {
    const post = await prisma.platformPost.findUnique({
      where: {
        connectionId_platformId: {
          connectionId: data.connectionId,
          platformId: data.platformId,
        },
      },
      select: { id: true, connectionId: true },
    });
    if (post) return post;
  }

  return null;
}

/**
 * Find a PlatformConnection by profile ID + platform name.
 */
async function findConnection(
  profileId?: string,
  platform?: string
): Promise<{ id: string; userId: string; metadata: unknown } | null> {
  if (!profileId || !platform) return null;

  const connection = await prisma.platformConnection.findFirst({
    where: {
      profileId,
      platform,
      isActive: true,
    },
    select: { id: true, userId: true, metadata: true },
  });

  return connection;
}

// ============================================================================
// POST HANDLERS
// ============================================================================

/**
 * Handle post.created — a new post has been created on the platform
 */
async function handlePostCreated(event: WebhookEvent): Promise<void> {
  const data = event.data as PostPayload;

  logger.info('Social webhook: post.created', {
    platform: event.platform,
    platformId: data.platformId,
    connectionId: data.connectionId,
  });

  // If we have enough info to create/update a PlatformPost record, do so
  if (data.platformId && data.connectionId) {
    await prisma.platformPost.upsert({
      where: {
        connectionId_platformId: {
          connectionId: data.connectionId,
          platformId: data.platformId,
        },
      },
      create: {
        connectionId: data.connectionId,
        platformId: data.platformId,
        content: (data.message as string) || '',
        status: 'published',
        publishedAt: new Date(),
        mediaUrls: [],
        hashtags: [],
        mentions: [],
        metadata: { source: 'webhook', platform: event.platform },
      },
      update: {
        status: 'published',
        publishedAt: new Date(),
      },
    });
  }
}

/**
 * Handle post.published — a scheduled/pending post has been published
 */
async function handlePostPublished(event: WebhookEvent): Promise<void> {
  const data = event.data as PostPayload;

  logger.info('Social webhook: post.published', {
    platform: event.platform,
    postId: data.postId,
    platformId: data.platformId,
  });

  const post = await findPlatformPost(data);

  if (!post) {
    logger.warn('Post not found for published event', {
      platform: event.platform,
      postId: data.postId,
      platformId: data.platformId,
    });
    return;
  }

  await prisma.platformPost.update({
    where: { id: post.id },
    data: {
      status: 'published',
      publishedAt: new Date(),
      metadata: data.url
        ? { publishedUrl: data.url, confirmedAt: new Date().toISOString() }
        : { confirmedAt: new Date().toISOString() },
    },
  });

  // Log to audit trail
  await prisma.auditLog.create({
    data: {
      action: 'post_published_via_webhook',
      resource: 'platform_post',
      resourceId: post.id,
      details: {
        platform: event.platform,
        platformId: data.platformId,
        url: data.url,
      },
      severity: 'low',
      category: 'content',
      outcome: 'success',
    },
  });
}

/**
 * Handle post.failed — a post failed to publish
 */
async function handlePostFailed(event: WebhookEvent): Promise<void> {
  const data = event.data as PostPayload;

  logger.warn('Social webhook: post.failed', {
    platform: event.platform,
    postId: data.postId,
    error: data.error,
  });

  const post = await findPlatformPost(data);

  if (!post) {
    logger.warn('Post not found for failed event', {
      platform: event.platform,
      postId: data.postId,
      platformId: data.platformId,
    });
    return;
  }

  await prisma.platformPost.update({
    where: { id: post.id },
    data: {
      status: 'failed',
      errorMessage: data.error || data.message || 'Publishing failed',
      metadata: {
        failedAt: new Date().toISOString(),
        error: data.error,
      },
    },
  });

  // Log failure to audit trail
  await prisma.auditLog.create({
    data: {
      action: 'post_failed_via_webhook',
      resource: 'platform_post',
      resourceId: post.id,
      details: {
        platform: event.platform,
        platformId: data.platformId,
        error: data.error || data.message,
      },
      severity: 'high',
      category: 'content',
      outcome: 'failure',
    },
  });
}

// ============================================================================
// ENGAGEMENT HANDLERS
// ============================================================================

/**
 * Handle engagement.like — a like/favourite event
 */
async function handleEngagementLike(event: WebhookEvent): Promise<void> {
  await upsertEngagementMetrics(event, 'like');
}

/**
 * Handle engagement.comment — a new comment
 */
async function handleEngagementComment(event: WebhookEvent): Promise<void> {
  await upsertEngagementMetrics(event, 'comment');
}

/**
 * Handle engagement.share — a share/repost/retweet
 */
async function handleEngagementShare(event: WebhookEvent): Promise<void> {
  await upsertEngagementMetrics(event, 'share');
}

/**
 * Handle engagement.reaction — a reaction (Facebook, LinkedIn)
 */
async function handleEngagementReaction(event: WebhookEvent): Promise<void> {
  await upsertEngagementMetrics(event, 'reaction');
}

/**
 * Handle engagement.save — a save/bookmark
 */
async function handleEngagementSave(event: WebhookEvent): Promise<void> {
  await upsertEngagementMetrics(event, 'save');
}

/**
 * Shared logic: create a new PlatformMetrics snapshot with the latest counts.
 *
 * PlatformMetrics is an append-only time-series table (each row is a snapshot
 * at `recordedAt`), so we always CREATE a new row rather than updating in place.
 */
async function upsertEngagementMetrics(
  event: WebhookEvent,
  engagementType: string
): Promise<void> {
  const data = event.data as PostPayload & EngagementPayload;

  logger.info('Social webhook: engagement event', {
    platform: event.platform,
    type: engagementType,
    postId: data.postId,
    platformId: data.platformId,
  });

  const post = await findPlatformPost(data);

  if (!post) {
    logger.warn('Post not found for engagement event', {
      platform: event.platform,
      engagementType,
      postId: data.postId,
      platformId: data.platformId,
    });
    return;
  }

  // Create a new metrics snapshot
  await prisma.platformMetrics.create({
    data: {
      postId: post.id,
      likes: data.likes ?? 0,
      comments: data.comments ?? 0,
      shares: data.shares ?? 0,
      views: data.views ?? 0,
      reach: data.reach ?? 0,
      impressions: data.impressions ?? 0,
      clicks: data.clicks ?? 0,
      saves: data.saves ?? 0,
      engagementRate: data.engagementRate ?? null,
      metadata: {
        source: 'webhook',
        platform: event.platform,
        triggerType: engagementType,
      },
      recordedAt: new Date(),
    },
  });
}

// ============================================================================
// FOLLOWER HANDLERS
// ============================================================================

/**
 * Handle follower.gained — a new follower
 */
async function handleFollowerGained(event: WebhookEvent): Promise<void> {
  await updateFollowerCount(event, 'gained');
}

/**
 * Handle follower.lost — a follower unfollowed
 */
async function handleFollowerLost(event: WebhookEvent): Promise<void> {
  await updateFollowerCount(event, 'lost');
}

/**
 * Handle follower.milestone — reached a follower milestone
 */
async function handleFollowerMilestone(event: WebhookEvent): Promise<void> {
  const data = event.data as FollowerPayload;

  logger.info('Social webhook: follower.milestone', {
    platform: event.platform,
    milestone: data.milestone,
    profileId: data.profileId,
  });

  const connection = data.connectionId
    ? await prisma.platformConnection.findUnique({
        where: { id: data.connectionId },
        select: { id: true, userId: true, metadata: true },
      })
    : await findConnection(data.profileId, data.platform || event.platform);

  if (!connection) {
    logger.warn('Connection not found for follower milestone', {
      platform: event.platform,
      profileId: data.profileId,
    });
    return;
  }

  // Update metadata with milestone info
  const currentMetadata = (connection.metadata as Record<string, unknown>) ?? {};

  await prisma.platformConnection.update({
    where: { id: connection.id },
    data: {
      lastSync: new Date(),
      metadata: {
        ...currentMetadata,
        lastMilestone: data.milestone,
        lastMilestoneAt: new Date().toISOString(),
        followerCount: data.followerCount ?? currentMetadata.followerCount ?? 0,
      } as Prisma.InputJsonValue,
    },
  });

  // Log milestone to audit trail
  await prisma.auditLog.create({
    data: {
      action: 'follower_milestone_reached',
      resource: 'platform_connection',
      resourceId: connection.id,
      userId: connection.userId,
      details: {
        platform: event.platform,
        milestone: data.milestone,
        followerCount: data.followerCount,
      },
      severity: 'low',
      category: 'content',
      outcome: 'success',
    },
  });
}

/**
 * Shared logic for follower gained/lost events.
 * Updates the PlatformConnection metadata with follower count info.
 */
async function updateFollowerCount(
  event: WebhookEvent,
  direction: 'gained' | 'lost'
): Promise<void> {
  const data = event.data as FollowerPayload;

  logger.info(`Social webhook: follower.${direction}`, {
    platform: event.platform,
    profileId: data.profileId,
    followerCount: data.followerCount,
  });

  const connection = data.connectionId
    ? await prisma.platformConnection.findUnique({
        where: { id: data.connectionId },
        select: { id: true, userId: true, metadata: true },
      })
    : await findConnection(data.profileId, data.platform || event.platform);

  if (!connection) {
    logger.warn('Connection not found for follower event', {
      platform: event.platform,
      profileId: data.profileId,
      direction,
    });
    return;
  }

  const currentMetadata = (connection.metadata as Record<string, unknown>) ?? {};
  const currentCount = (currentMetadata.followerCount as number) ?? 0;
  const change = data.change ?? (direction === 'gained' ? 1 : -1);

  await prisma.platformConnection.update({
    where: { id: connection.id },
    data: {
      lastSync: new Date(),
      metadata: {
        ...currentMetadata,
        followerCount: data.followerCount ?? Math.max(0, currentCount + change),
        lastFollowerEvent: direction,
        lastFollowerEventAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
}

// ============================================================================
// ACCOUNT HANDLERS
// ============================================================================

/**
 * Handle account.connected — a platform account has been connected
 */
async function handleAccountConnected(event: WebhookEvent): Promise<void> {
  const data = event.data as FollowerPayload & { userId?: string };

  logger.info('Social webhook: account.connected', {
    platform: event.platform,
    profileId: data.profileId,
  });

  const connection = data.connectionId
    ? await prisma.platformConnection.findUnique({
        where: { id: data.connectionId },
        select: { id: true },
      })
    : await findConnection(data.profileId, data.platform || event.platform);

  if (!connection) return;

  await prisma.platformConnection.update({
    where: { id: connection.id },
    data: {
      isActive: true,
      lastSync: new Date(),
    },
  });
}

/**
 * Handle account.disconnected — a platform account has been disconnected
 */
async function handleAccountDisconnected(event: WebhookEvent): Promise<void> {
  const data = event.data as FollowerPayload & { userId?: string };

  logger.warn('Social webhook: account.disconnected', {
    platform: event.platform,
    profileId: data.profileId,
  });

  const connection = data.connectionId
    ? await prisma.platformConnection.findUnique({
        where: { id: data.connectionId },
        select: { id: true, userId: true },
      })
    : await findConnection(data.profileId, data.platform || event.platform);

  if (!connection) return;

  await prisma.platformConnection.update({
    where: { id: connection.id },
    data: {
      isActive: false,
      lastSync: new Date(),
    },
  });

  // Log disconnection
  await prisma.auditLog.create({
    data: {
      action: 'platform_disconnected_via_webhook',
      resource: 'platform_connection',
      resourceId: connection.id,
      userId: connection.userId,
      details: { platform: event.platform },
      severity: 'medium',
      category: 'system',
      outcome: 'success',
    },
  });
}

/**
 * Handle account.token_expired — OAuth token has expired
 */
async function handleTokenExpired(event: WebhookEvent): Promise<void> {
  const data = event.data as FollowerPayload & { userId?: string };

  logger.warn('Social webhook: account.token_expired', {
    platform: event.platform,
    profileId: data.profileId,
  });

  const connection = data.connectionId
    ? await prisma.platformConnection.findUnique({
        where: { id: data.connectionId },
        select: { id: true, userId: true, metadata: true },
      })
    : await findConnection(data.profileId, data.platform || event.platform);

  if (!connection) return;

  const currentMetadata = (connection.metadata as Record<string, unknown>) ?? {};

  await prisma.platformConnection.update({
    where: { id: connection.id },
    data: {
      isActive: false,
      metadata: {
        ...currentMetadata,
        tokenExpiredAt: new Date().toISOString(),
        needsReauthorisation: true,
      } as Prisma.InputJsonValue,
    },
  });

  // Log token expiry for monitoring
  await prisma.auditLog.create({
    data: {
      action: 'platform_token_expired',
      resource: 'platform_connection',
      resourceId: connection.id,
      userId: connection.userId,
      details: { platform: event.platform },
      severity: 'high',
      category: 'security',
      outcome: 'warning',
    },
  });
}

// ============================================================================
// REGISTER HANDLERS
// ============================================================================

export function registerSocialWebhookHandlers(): void {
  // Post events
  webhookHandler.on('post.created', handlePostCreated);
  webhookHandler.on('post.published', handlePostPublished);
  webhookHandler.on('post.failed', handlePostFailed);

  // Engagement events
  webhookHandler.on('engagement.like', handleEngagementLike);
  webhookHandler.on('engagement.comment', handleEngagementComment);
  webhookHandler.on('engagement.share', handleEngagementShare);
  webhookHandler.on('engagement.reaction', handleEngagementReaction);
  webhookHandler.on('engagement.save', handleEngagementSave);

  // Follower events
  webhookHandler.on('follower.gained', handleFollowerGained);
  webhookHandler.on('follower.lost', handleFollowerLost);
  webhookHandler.on('follower.milestone', handleFollowerMilestone);

  // Account events
  webhookHandler.on('account.connected', handleAccountConnected);
  webhookHandler.on('account.disconnected', handleAccountDisconnected);
  webhookHandler.on('account.token_expired', handleTokenExpired);

  logger.info('Social platform webhook handlers registered');
}

// Auto-register handlers on import (same pattern as Stripe webhook handlers)
registerSocialWebhookHandlers();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  handlePostCreated,
  handlePostPublished,
  handlePostFailed,
  handleEngagementLike,
  handleEngagementComment,
  handleEngagementShare,
  handleEngagementReaction,
  handleEngagementSave,
  handleFollowerGained,
  handleFollowerLost,
  handleFollowerMilestone,
  handleAccountConnected,
  handleAccountDisconnected,
  handleTokenExpired,
};
