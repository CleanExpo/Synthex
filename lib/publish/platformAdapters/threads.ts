/**
 * Threads platform adapter — lib/publish/platformAdapters/threads.ts
 *
 * Publishes a text post via the Meta Threads Graph API.
 *
 * Threads publishing is a two-step flow:
 *  1. POST /me/threads  → creates a media container (TEXT here)
 *  2. POST /me/threads_publish → promotes the container to a live thread
 *
 * Requires a user access token with the `threads_basic` +
 * `threads_content_publish` scopes (verified by the caller's
 * checkPublishingScopes gate).
 *
 * Docs: https://developers.facebook.com/docs/threads/posts
 *
 * @task SYN-P1 (multi-platform auto-publish)
 */

import { logger } from '@/lib/logger';
import type { PublishResult } from './instagram';

const THREADS_API = 'https://graph.threads.net/v1.0';

export interface ThreadsPublishInput {
  accessToken: string;
  text: string;
  /** Optional public image/video URL to attach. */
  mediaUrl?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToThreads(
  input: ThreadsPublishInput
): Promise<PublishResult> {
  const { accessToken, text, mediaUrl } = input;

  try {
    // Determine media type for the container.
    let mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT';
    if (mediaUrl) {
      mediaType = /\.(mp4|mov|avi|webm)$/i.test(mediaUrl) ? 'VIDEO' : 'IMAGE';
    }

    // Step 1: create the container.
    const containerBody: Record<string, string> = {
      access_token: accessToken,
      media_type: mediaType,
      text,
    };
    if (mediaType === 'IMAGE' && mediaUrl) containerBody.image_url = mediaUrl;
    if (mediaType === 'VIDEO' && mediaUrl) containerBody.video_url = mediaUrl;

    const containerRes = await fetch(`${THREADS_API}/me/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    });

    if (!containerRes.ok) {
      const err = await containerRes.text().catch(() => '');
      logger.warn('threads: container creation failed', {
        status: containerRes.status,
        body: err.slice(0, 300),
      });
      return {
        success: false,
        error: `Threads container creation failed (${containerRes.status}): ${err.slice(0, 200)}`,
      };
    }

    const containerJson = (await containerRes.json()) as { id?: string };
    if (!containerJson.id) {
      return { success: false, error: 'Threads container returned no ID' };
    }

    // Step 2: publish the container.
    const publishRes = await fetch(`${THREADS_API}/me/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        creation_id: containerJson.id,
      }),
    });

    if (!publishRes.ok) {
      const err = await publishRes.text().catch(() => '');
      logger.warn('threads: publish failed', {
        status: publishRes.status,
        body: err.slice(0, 300),
      });
      return {
        success: false,
        error: `Threads publish failed (${publishRes.status}): ${err.slice(0, 200)}`,
      };
    }

    const publishJson = (await publishRes.json()) as { id?: string };

    logger.info('threads: post published', {
      platformPostId: publishJson.id,
    });

    return { success: true, platformPostId: publishJson.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('threads: unexpected error', { error: err });
    return { success: false, error: message };
  }
}
