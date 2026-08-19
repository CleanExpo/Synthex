/**
 * TikTok platform adapter — lib/publish/platformAdapters/tiktok.ts
 *
 * Publishes a rendered short to TikTok via the existing `TikTokService`
 * (lib/social/tiktok-service.ts) — a Content Posting API `PULL_FROM_URL`
 * init that hands TikTok the public storage URL of the cut. TikTok processes
 * the upload asynchronously and returns a `publish_id`.
 *
 * SAFETY (SYN-1075 WS4a / §15.9 invariant):
 *   TikTok is NOT in `AUTO_PUBLISH_PLATFORMS`, so `seedPublishQueue` never
 *   queues a tiktok slot. This adapter is reached ONLY by `dispatchToPlatform`
 *   while draining a `publish_queue` row that a human released
 *   (`queued_human_gated → pending`) via `POST /api/publish-queue/release`.
 *
 * A TikTok publish REQUIRES a rendered video URL — there is no caption-only
 * fallback: a missing video URL returns an error result.
 *
 * @task SYN-1075
 */

import { logger } from '@/lib/logger';
import { createPlatformService } from '@/lib/social';
import type { PublishResult } from './instagram';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TikTokPublishInput {
  /** Decrypted OAuth access token (from PlatformConnection.accessToken). */
  accessToken: string;
  /** Decrypted OAuth refresh token — enables mid-publish token refresh. */
  refreshToken?: string;
  /**
   * PlatformConnection id — wires the advisory refresh-lock so a rotated
   * TikTok refresh token is persisted under concurrency.
   */
  connectionId?: string;
  /** Public URL of the rendered short to upload. Required. */
  videoUrl: string;
  /** Caption / title for the TikTok post_info. */
  caption: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToTikTok(
  input: TikTokPublishInput
): Promise<PublishResult> {
  const { accessToken, refreshToken, connectionId, videoUrl, caption } = input;

  if (!videoUrl || videoUrl.trim().length === 0) {
    return {
      success: false,
      error:
        'TikTok publish requires a rendered video URL. Refusing to publish without media.',
    };
  }

  try {
    const service = createPlatformService(
      'tiktok',
      { accessToken, refreshToken },
      connectionId ? { connectionId } : undefined
    );
    if (!service) {
      return { success: false, error: 'TikTok service is unavailable' };
    }

    const result = await service.createPost({
      text: caption,
      mediaUrls: [videoUrl],
      visibility: 'public',
    });

    if (!result.success) {
      logger.warn('tiktok: publish failed', { error: result.error });
      return { success: false, error: result.error };
    }

    logger.info('tiktok: video publish initiated', {
      platformPostId: result.postId,
    });
    return { success: true, platformPostId: result.postId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('tiktok: unexpected error', { error: err });
    return { success: false, error: message };
  }
}
