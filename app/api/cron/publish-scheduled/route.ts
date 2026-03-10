/**
 * Publish Scheduled Posts Cron Job
 *
 * GET /api/cron/publish-scheduled
 * Runs every 5 minutes via Vercel Cron.
 * Queries posts with scheduledAt <= now and status='scheduled', then
 * publishes each one to its target social media platform via the
 * unified platform service factory.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL:          PostgreSQL connection (CRITICAL)
 * - CRON_SECRET:           Vercel cron secret for authorization (SECRET)
 * - FIELD_ENCRYPTION_KEY:  AES-256 key for decrypting stored OAuth tokens (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
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
  status: 'published' | 'failed';
  error?: string;
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

  return Sentry.withMonitor('cron-publish-scheduled', async () => {
  // -- Setup -----------------------------------------------------------------
  const startTime = Date.now();
  const now = new Date();

  let processed = 0;
  let published = 0;
  let failed = 0;
  const results: PostResult[] = [];

  // -- Query due posts -------------------------------------------------------
  const duePosts = await prisma.post.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
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
      const platform = (post.platform || post.campaign.platform).toLowerCase();
      const userId = post.campaign.userId;

      // -- Guard: unsupported platform ---------------------------------------
      if (!isPlatformSupported(platform)) {
        const errorMessage = `Platform '${platform}' is not supported`;
        console.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage);

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Guard: empty content ---------------------------------------------
      if (!post.content?.trim()) {
        const errorMessage = 'Post content is empty';
        console.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage);

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Fetch active platform connection ----------------------------------
      // Use organization-scoped connection for multi-business support.
      // When the post's campaign belongs to a specific organization, we MUST
      // use that org's connection to avoid publishing with the wrong account.
      // When no organizationId exists (personal/legacy posts), prefer personal
      // connections first, then fall back to any active connection.
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
        console.error(`[publish-scheduled] Post ${post.id}: ${errorMessage} (userId=${userId}, orgId=${organizationId ?? 'none'})`);

        await markPostFailed(post.id, errorMessage);

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
        console.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage);

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
          console.error(
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
        console.error(`[publish-scheduled] Post ${post.id}: ${errorMessage}`);

        await markPostFailed(post.id, errorMessage);

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
        continue;
      }

      // -- Publish -----------------------------------------------------------
      // Extract media URLs from post metadata (populated by the content page)
      const postMetadata = (post.metadata as Record<string, unknown>) || {};
      const postMediaUrls = Array.isArray(postMetadata.images)
        ? (postMetadata.images as string[])
        : [];

      const postResult = await service.createPost({
        text: post.content,
        ...(postMediaUrls.length > 0 ? { mediaUrls: postMediaUrls } : {}),
      });

      if (postResult.success) {
        // Mark post as published and store platform identifiers
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            analytics: {
              platformPostId: postResult.postId ?? null,
              platformPostUrl: postResult.url ?? null,
            },
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
            console.error(
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

        published++;
        results.push({ id: post.id, platform, status: 'published' });
      } else {
        const errorMessage = postResult.error ?? 'Platform returned failure without error detail';
        console.error(
          `[publish-scheduled] Post ${post.id} publish failed: ${errorMessage}`
        );

        await markPostFailed(post.id, errorMessage);

        failed++;
        results.push({ id: post.id, platform, status: 'failed', error: errorMessage });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      console.error(`[publish-scheduled] Unexpected error for post ${post.id}:`, err);

      try {
        await markPostFailed(post.id, errorMessage);
      } catch (updateError) {
        console.error(
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

  return NextResponse.json({
    success: true,
    processed,
    published,
    failed,
    durationMs,
    results,
  });
  }); // end Sentry.withMonitor
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mark a post as failed and merge the error detail into its metadata.
 *
 * Merges rather than overwrites so any existing metadata keys (e.g. images,
 * hashtags) are preserved alongside the failure information.
 */
async function markPostFailed(postId: string, errorMessage: string): Promise<void> {
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
      metadata: {
        ...existingMetadata,
        publishError: errorMessage,
        failedAt: new Date().toISOString(),
      },
    },
  });
}
