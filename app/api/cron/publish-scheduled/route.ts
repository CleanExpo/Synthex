/**
 * Publish Scheduled Posts Cron Job
 *
 * GET /api/cron/publish-scheduled
 * Runs every 5 minutes via Vercel Cron.
 * Queries posts with scheduledAt <= now and status='scheduled', then
 * publishes each one to its target social media platform via the
 * unified platform service factory.
 *
 * Features:
 * - Automatic retry with exponential backoff (5/15/60 min) for transient errors
 * - Post lifecycle history tracking via metadata.history array
 * - In-app notifications on publish success and permanent failure
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL:          PostgreSQL connection (CRITICAL)
 * - CRON_SECRET:           Vercel cron secret for authorization (SECRET)
 * - FIELD_ENCRYPTION_KEY:  AES-256 key for decrypting stored OAuth tokens (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
// NOTE: Static Sentry import removed (2026-03-12, Phase 114-02) — see next.config.mjs.
import prisma from '@/lib/prisma';
import {
  createPlatformService,
  isPlatformSupported,
  type SupportedPlatform,
  type PlatformCredentials,
} from '@/lib/social';
import {
  decryptFieldSafe,
  encryptField,
} from '@/lib/security/field-encryption';
import { pushUniteHubEvent } from '@/lib/unite-hub-connector';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Vercel edge config
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — enough to drain a 50-post batch

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-post outcome returned in the summary response body.
 */
interface PostResult {
  id: string;
  platform: string;
  status: 'published' | 'failed' | 'retrying';
  error?: string;
}

/**
 * Sanitise a metadata object so it satisfies Prisma's InputJsonValue.
 * JSON.parse(JSON.stringify(...)) strips TypeScript-specific type info and
 * produces plain JSON-compatible objects/arrays.
 */
// Return type must be `any` so callers can pass it to Prisma's InputJsonValue without further casting
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonSafe(obj: Record<string, unknown>): any {
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Retry configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BACKOFF_MINUTES = [5, 15, 60]; // Exponential backoff schedule

/**
 * Determine whether an error is transient and worth retrying.
 * Non-retryable errors (e.g. unsupported platform, empty content) fail immediately.
 */
function isRetryableError(error: string): boolean {
  const retryablePatterns = [
    'rate limit', 'too many requests', '429',
    'timeout', 'etimedout', 'econnreset', 'econnrefused',
    'temporarily unavailable', '503', '502', '500',
    'token refresh', 'refresh token',
    'network error', 'fetch failed',
    'socket hang up', 'abort',
  ];
  const lowerError = error.toLowerCase();
  return retryablePatterns.some((p) => lowerError.includes(p));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -- Auth (keep OUTSIDE monitor) -------------------------------------------
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // NOTE: Sentry.withMonitor() removed — no-op without server-side Sentry.init().
  // -- Setup -----------------------------------------------------------------
  const startTime = Date.now();
  const now = new Date();
  logger.info('cron:publish-scheduled:start', { timestamp: now.toISOString() });

  let processed = 0;
  let published = 0;
  let failed = 0;
  let retried = 0;
  const results: PostResult[] = [];

  // -- Query due posts -------------------------------------------------------
  const duePosts = await prisma.post.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
      publishedAt: null, // Idempotency guard: skip already-published posts
    },
    select: {
      id: true,
      content: true,
      platform: true,
      metadata: true,
      campaign: {
        select: {
          userId: true,
          platform: true,
          organizationId: true,
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  });

  // -- Process each post independently ---------------------------------------
  for (const post of duePosts) {
    processed++;

    try {
      // Idempotency guard: re-check status in case another instance published it
      const freshPost = await prisma.post.findUnique({
        where: { id: post.id },
        select: { status: true, publishedAt: true },
      });
      if (freshPost?.publishedAt || freshPost?.status === 'published') {
        logger.warn('[publish-scheduled] Skipping already-published post', { postId: post.id });
        continue;
      }

      const platform = (post.platform || post.campaign.platform).toLowerCase();
      const userId = post.campaign.userId;
      const metadata = (post.metadata as Record<string, unknown>) || {};
      const existingHistory = (metadata.history as Record<string, unknown>[]) || [];
      const retryCount = (metadata.retryCount as number) || 0;

      // -- Guard: unsupported platform ---------------------------------------
      if (!isPlatformSupported(platform)) {
        const errorMessage = `Platform '${platform}' is not supported`;
        logger.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage, {
          history: [
            ...existingHistory,
            { event: 'failed_permanently', at: new Date().toISOString(), reason: errorMessage, attempts: retryCount },
          ],
        });
        await createNotification(userId, 'post_failed', `Post failed on ${platform}`, `Your scheduled post failed to publish to ${platform}: ${errorMessage}`, { postId: post.id, platform, error: errorMessage, retryCount });

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Guard: empty content ---------------------------------------------
      if (!post.content?.trim()) {
        const errorMessage = 'Post content is empty';
        logger.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage, {
          history: [
            ...existingHistory,
            { event: 'failed_permanently', at: new Date().toISOString(), reason: errorMessage, attempts: retryCount },
          ],
        });
        await createNotification(userId, 'post_failed', `Post failed on ${platform}`, `Your scheduled post failed to publish to ${platform}: ${errorMessage}`, { postId: post.id, platform, error: errorMessage, retryCount });

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Fetch active platform connection ----------------------------------
      const organizationId = post.campaign.organizationId;

      let connection = await prisma.platformConnection.findFirst({
        where: {
          userId,
          platform,
          isActive: true,
          organizationId: organizationId ?? null,
        },
        select: {
          id: true,
          accessToken: true,
          refreshToken: true,
          expiresAt: true,
          profileId: true,
          profileName: true,
        },
      });

      // Fallback: if no personal connection found for legacy posts (no org),
      // try any active connection for this user/platform
      if (!connection && !organizationId) {
        connection = await prisma.platformConnection.findFirst({
          where: {
            userId,
            platform,
            isActive: true,
          },
          select: {
            id: true,
            accessToken: true,
            refreshToken: true,
            expiresAt: true,
            profileId: true,
            profileName: true,
          },
        });
      }

      if (!connection) {
        const errorMessage = organizationId
          ? `No connected ${platform} account for organization ${organizationId}`
          : `No connected ${platform} account`;
        logger.error(`[publish-scheduled] Post ${post.id}: ${errorMessage} (userId=${userId}, orgId=${organizationId ?? 'none'})`);

        // No connection is not retryable — fail permanently
        await markPostFailed(post.id, errorMessage, {
          history: [
            ...existingHistory,
            { event: 'failed_permanently', at: new Date().toISOString(), reason: errorMessage, attempts: retryCount },
          ],
        });
        await createNotification(userId, 'post_failed', `Post failed on ${platform}`, `Your scheduled post failed to publish to ${platform}: ${errorMessage}`, { postId: post.id, platform, error: errorMessage, retryCount });

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Decrypt OAuth tokens ----------------------------------------------
      const accessToken = decryptFieldSafe(connection.accessToken);
      const refreshToken = connection.refreshToken
        ? decryptFieldSafe(connection.refreshToken)
        : undefined;

      if (!accessToken) {
        const errorMessage = 'Failed to decrypt access token for platform connection';
        logger.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage, {
          history: [
            ...existingHistory,
            { event: 'failed_permanently', at: new Date().toISOString(), reason: errorMessage, attempts: retryCount },
          ],
        });
        await createNotification(userId, 'post_failed', `Post failed on ${platform}`, `Your scheduled post failed to publish to ${platform}: ${errorMessage}`, { postId: post.id, platform, error: errorMessage, retryCount });

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Build credentials object ------------------------------------------
      const credentials: PlatformCredentials = {
        accessToken,
        refreshToken: refreshToken ?? undefined,
        expiresAt: connection.expiresAt ?? undefined,
        platformUserId: connection.profileId ?? undefined,
        platformUsername: connection.profileName ?? undefined,
      };

      // -- Token refresh persistence callback --------------------------------
      const connectionId = connection.id;
      const tokenRefreshCallback = async (
        _platform: string,
        newCreds: PlatformCredentials
      ): Promise<void> => {
        try {
          await prisma.platformConnection.update({
            where: { id: connectionId },
            data: {
              accessToken: encryptField(newCreds.accessToken) ?? newCreds.accessToken,
              refreshToken:
                newCreds.refreshToken !== undefined
                  ? encryptField(newCreds.refreshToken) ?? newCreds.refreshToken
                  : undefined,
              expiresAt: newCreds.expiresAt,
            },
          });
        } catch (persistError) {
          logger.error(
            `[publish-scheduled] Failed to persist refreshed tokens for connection ${connectionId}:`,
            persistError
          );
          // Non-fatal — we still hold valid in-memory credentials for this publish
        }
      };

      // -- Create platform service -------------------------------------------
      const service = createPlatformService(
        platform as SupportedPlatform,
        credentials,
        { tokenRefreshCallback }
      );

      if (!service) {
        const errorMessage = `Could not instantiate service for platform '${platform}'`;
        logger.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage, {
          history: [
            ...existingHistory,
            { event: 'failed_permanently', at: new Date().toISOString(), reason: errorMessage, attempts: retryCount },
          ],
        });
        await createNotification(userId, 'post_failed', `Post failed on ${platform}`, `Your scheduled post failed to publish to ${platform}: ${errorMessage}`, { postId: post.id, platform, error: errorMessage, retryCount });

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Publish -----------------------------------------------------------
      // Extract media URLs from post metadata (populated by the content page)
      const postMediaUrls = Array.isArray(metadata.images)
        ? (metadata.images as string[])
        : [];

      const postResult = await service.createPost({
        text: post.content,
        ...(postMediaUrls.length > 0 ? { mediaUrls: postMediaUrls } : {}),
      });

      if (postResult.success) {
        // Mark post as published and store platform identifiers + history
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            analytics: {
              platformPostId: postResult.postId ?? null,
              platformPostUrl: postResult.url ?? null,
            },
            metadata: jsonSafe({
              ...metadata,
              history: [
                ...existingHistory,
                { event: 'published', at: new Date().toISOString(), platformPostId: postResult.postId },
              ],
            }),
          },
        });

        // Optionally create a PlatformPost record for metrics tracking
        if (postResult.postId) {
          try {
            await prisma.platformPost.create({
              data: {
                connectionId,
                platformId: postResult.postId,
                content: post.content,
                mediaUrls: postMediaUrls,
                hashtags: [],
                mentions: [],
                status: 'published',
                publishedAt: new Date(),
              },
            });
          } catch (platformPostError) {
            // Non-fatal — the post was published successfully; this is supplementary data
            logger.error(
              `[publish-scheduled] Failed to create PlatformPost record for post ${post.id}:`,
              platformPostError
            );
          }
        }

        // Push content.published event to Unite-Hub (fire-and-forget)
        void pushUniteHubEvent({
          type: 'content.published',
          userId,
          platform,
          postId: post.id,
        });

        // Create success notification
        await createNotification(userId, 'post_published', `Post published on ${platform}`, `Your scheduled post was successfully published to ${platform}.`, { postId: post.id, platform, publishedAt: new Date().toISOString() });

        published++;
        results.push({ id: post.id, platform, status: 'published' });
      } else {
        const errorMessage = postResult.error ?? 'Platform returned failure without error detail';
        logger.error(
          `[publish-scheduled] Post ${post.id} publish failed: ${errorMessage}`
        );

        // -- Retry logic: check if error is transient and retries remain -----
        if (isRetryableError(errorMessage) && retryCount < MAX_RETRIES) {
          const backoffMinutes = BACKOFF_MINUTES[retryCount] ?? 60;
          const retryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await prisma.post.update({
            where: { id: post.id },
            data: {
              scheduledAt: retryAt,
              metadata: jsonSafe({
                ...metadata,
                retryCount: retryCount + 1,
                lastRetryError: errorMessage,
                lastRetryAt: new Date().toISOString(),
                history: [
                  ...existingHistory,
                  {
                    event: 'retry_scheduled',
                    at: new Date().toISOString(),
                    reason: errorMessage,
                    attempt: retryCount + 1,
                    retryAt: retryAt.toISOString(),
                  },
                ],
              }),
            },
          });

          logger.info(
            `[publish-scheduled] Post ${post.id}: retry ${retryCount + 1}/${MAX_RETRIES} scheduled for ${retryAt.toISOString()} (${errorMessage})`
          );

          retried++;
          results.push({
            id: post.id,
            platform,
            status: 'retrying',
            error: `Retry ${retryCount + 1}/${MAX_RETRIES} scheduled for ${retryAt.toISOString()}`,
          });
          continue; // Don't count as a final failure
        }

        // Non-retryable or max retries exceeded — permanent failure
        await markPostFailed(post.id, errorMessage, {
          retryCount,
          finalFailure: true,
          history: [
            ...existingHistory,
            { event: 'failed_permanently', at: new Date().toISOString(), reason: errorMessage, attempts: retryCount },
          ],
        });
        await createNotification(
          userId,
          'post_failed',
          `Post failed on ${platform}`,
          retryCount > 0
            ? `Your scheduled post failed to publish to ${platform} after ${retryCount} retries: ${errorMessage}`
            : `Your scheduled post failed to publish to ${platform}: ${errorMessage}`,
          { postId: post.id, platform, error: errorMessage, retryCount }
        );

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      logger.error(`[publish-scheduled] Unexpected error for post ${post.id}:`, err);

      const metadata = (post.metadata as Record<string, unknown>) || {};
      const existingHistory = (metadata.history as Record<string, unknown>[]) || [];
      const retryCount = (metadata.retryCount as number) || 0;
      const userId = post.campaign.userId;
      const platform = (post.platform || post.campaign.platform).toLowerCase();

      // Check if this unexpected error is retryable
      if (isRetryableError(errorMessage) && retryCount < MAX_RETRIES) {
        const backoffMinutes = BACKOFF_MINUTES[retryCount] ?? 60;
        const retryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

        try {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              scheduledAt: retryAt,
              metadata: jsonSafe({
                ...metadata,
                retryCount: retryCount + 1,
                lastRetryError: errorMessage,
                lastRetryAt: new Date().toISOString(),
                history: [
                  ...existingHistory,
                  {
                    event: 'retry_scheduled',
                    at: new Date().toISOString(),
                    reason: errorMessage,
                    attempt: retryCount + 1,
                    retryAt: retryAt.toISOString(),
                  },
                ],
              }),
            },
          });

          retried++;
          results.push({
            id: post.id,
            platform: post.platform,
            status: 'retrying',
            error: `Retry ${retryCount + 1}/${MAX_RETRIES} scheduled for ${retryAt.toISOString()}`,
          });
          continue;
        } catch (retryUpdateError) {
          logger.error(
            `[publish-scheduled] Failed to schedule retry for post ${post.id}:`,
            retryUpdateError
          );
        }
      }

      // Permanent failure
      try {
        await markPostFailed(post.id, errorMessage, {
          retryCount,
          finalFailure: true,
          history: [
            ...existingHistory,
            { event: 'failed_permanently', at: new Date().toISOString(), reason: errorMessage, attempts: retryCount },
          ],
        });
        await createNotification(
          userId,
          'post_failed',
          `Post failed on ${platform}`,
          retryCount > 0
            ? `Your scheduled post failed to publish to ${platform} after ${retryCount} retries: ${errorMessage}`
            : `Your scheduled post failed to publish to ${platform}: ${errorMessage}`,
          { postId: post.id, platform, error: errorMessage, retryCount }
        );
      } catch (updateError) {
        logger.error(
          `[publish-scheduled] Also failed to mark post ${post.id} as failed:`,
          updateError
        );
      }

      failed++;
      results.push({
        id: post.id,
        platform: post.platform,
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info('cron:publish-scheduled:end', { timestamp: new Date().toISOString(), durationMs, processed, published, failed, retried });

  return NextResponse.json({
    success: true,
    processed,
    published,
    failed,
    retried,
    durationMs,
    results,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mark a post as failed and merge the error detail into its metadata.
 *
 * Merges rather than overwrites so any existing metadata keys (e.g. images,
 * hashtags) are preserved alongside the failure information.
 *
 * Accepts optional extra metadata to merge (e.g. history, retryCount).
 */
async function markPostFailed(
  postId: string,
  errorMessage: string,
  extraMetadata?: Record<string, unknown>
): Promise<void> {
  // Fetch current metadata to merge rather than overwrite
  const current = await prisma.post.findUnique({
    where: { id: postId },
    select: { metadata: true },
  });

  const existingMetadata =
    current?.metadata !== null &&
    typeof current?.metadata === 'object' &&
    !Array.isArray(current?.metadata)
      ? (current.metadata as Record<string, unknown>)
      : {};

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: 'failed',
      metadata: jsonSafe({
        ...existingMetadata,
        publishError: errorMessage,
        failedAt: new Date().toISOString(),
        ...(extraMetadata ?? {}),
      }),
    },
  });
}

/**
 * Create an in-app notification for the user.
 * Wrapped in try/catch so notification failures never affect the publish flow.
 */
async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  notifData: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: notifData as Record<string, string | number | boolean | null>,
        read: false,
      },
    });
  } catch (notifError) {
    logger.error(
      `[publish-scheduled] Failed to create notification for user ${userId}:`,
      notifError
    );
    // Non-fatal — notification failure must not affect publishing
  }
}
