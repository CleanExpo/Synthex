/**
 * YouTube platform adapter — lib/publish/platformAdapters/youtube.ts
 *
 * Publishes a rendered short as a YouTube video via the existing
 * `YouTubeService` (lib/social/youtube-service.ts) — a resumable upload of the
 * video fetched from its public storage URL, tagged with the grilled search
 * package (title / description / tags).
 *
 * SAFETY (SYN-1075 WS4a / §15.9 invariant):
 *   YouTube is NOT in `AUTO_PUBLISH_PLATFORMS`, so `seedPublishQueue` never
 *   queues a youtube slot. This adapter is reached ONLY by
 *   `dispatchToPlatform` while draining a `publish_queue` row that a human
 *   released (`queued_human_gated → pending`) via
 *   `POST /api/publish-queue/release`. It never runs on an automated path.
 *
 * A YouTube publish REQUIRES a rendered video URL — there is no caption-only
 * fallback (posting placeholder content is never acceptable, no-mock-data
 * rule): a missing video URL returns an error result and the queue holds/retries.
 *
 * @task SYN-1075
 */

import { logger } from '@/lib/logger';
import { createPlatformService } from '@/lib/social';
import type { PublishResult } from './instagram';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface YouTubePublishInput {
  /** Decrypted OAuth access token (from PlatformConnection.accessToken). */
  accessToken: string;
  /** Decrypted OAuth refresh token — enables mid-publish token refresh. */
  refreshToken?: string;
  /**
   * PlatformConnection id — wires the advisory refresh-lock so a rotated
   * YouTube refresh token is persisted under concurrency.
   */
  connectionId?: string;
  /** Public URL of the rendered short to upload. Required. */
  videoUrl: string;
  /** Grilled video title (YouTube snippet.title). */
  title: string;
  /** Grilled video description (YouTube snippet.description). */
  description?: string;
  /** Ranked tag set (YouTube snippet.tags). */
  tags?: string[];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToYouTube(
  input: YouTubePublishInput
): Promise<PublishResult> {
  const {
    accessToken,
    refreshToken,
    connectionId,
    videoUrl,
    title,
    description,
    tags,
  } = input;

  if (!videoUrl || videoUrl.trim().length === 0) {
    return {
      success: false,
      error:
        'YouTube publish requires a rendered video URL. Refusing to publish without media.',
    };
  }

  try {
    const service = createPlatformService(
      'youtube',
      { accessToken, refreshToken },
      connectionId ? { connectionId } : undefined
    );
    if (!service) {
      return { success: false, error: 'YouTube service is unavailable' };
    }

    const result = await service.createPost({
      // `text` is the caption-driven fallback the service uses when no metadata
      // title is present; we always pass the explicit search package below.
      text: title,
      mediaUrls: [videoUrl],
      visibility: 'public',
      metadata: {
        title,
        ...(description !== undefined ? { description } : {}),
        ...(tags && tags.length > 0 ? { tags } : {}),
      },
    });

    if (!result.success) {
      logger.warn('youtube: publish failed', { error: result.error });
      return { success: false, error: result.error };
    }

    logger.info('youtube: video published', { platformPostId: result.postId });
    return { success: true, platformPostId: result.postId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('youtube: unexpected error', { error: err });
    return { success: false, error: message };
  }
}
