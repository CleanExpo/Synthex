/**
 * Instagram platform adapter — lib/publish/platformAdapters/instagram.ts
 *
 * Publishes a caption (text post / Reels) via the Meta Graph API.
 *
 * Flow for a text + optional media post:
 *  1. If mediaUrl provided → POST /media (container creation)
 *  2. POST /media_publish (container → live post)
 *  For text-only → single call to /{ig-user-id}/media then /media_publish
 *
 * Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *
 * @task SYN-523
 */

import { logger } from '@/lib/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InstagramPublishInput {
  accessToken: string;
  /** Instagram Business Account ID (from PlatformConnection.profileId) */
  igUserId: string;
  caption: string;
  /** Optional: public URL of image/video to attach */
  mediaUrl?: string;
  /** 'IMAGE' | 'VIDEO' | 'REELS' — defaults to 'IMAGE' if mediaUrl provided */
  mediaType?: 'IMAGE' | 'VIDEO' | 'REELS';
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

const GRAPH_API = 'https://graph.facebook.com/v19.0';

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToInstagram(
  input: InstagramPublishInput
): Promise<PublishResult> {
  const {
    accessToken,
    igUserId,
    caption,
    mediaUrl,
    mediaType = 'IMAGE',
  } = input;

  try {
    let containerId: string;

    if (mediaUrl) {
      // Step 1: Create media container
      const containerParams = new URLSearchParams({
        access_token: accessToken,
        caption,
        [mediaType === 'VIDEO' || mediaType === 'REELS'
          ? 'video_url'
          : 'image_url']: mediaUrl,
        media_type: mediaType,
      });

      const containerRes = await fetch(
        `${GRAPH_API}/${igUserId}/media?${containerParams}`,
        { method: 'POST' }
      );

      if (!containerRes.ok) {
        const err = await containerRes.text().catch(() => '');
        logger.warn('instagram: media container creation failed', {
          status: containerRes.status,
          body: err.slice(0, 300),
        });
        return {
          success: false,
          error: `Container creation failed (${containerRes.status}): ${err.slice(0, 200)}`,
        };
      }

      const containerJson = (await containerRes.json()) as { id?: string };
      if (!containerJson.id) {
        return { success: false, error: 'Container creation returned no ID' };
      }
      containerId = containerJson.id;
    } else {
      // Text-only: create container with no media attachment
      const containerParams = new URLSearchParams({
        access_token: accessToken,
        caption,
      });

      const containerRes = await fetch(
        `${GRAPH_API}/${igUserId}/media?${containerParams}`,
        { method: 'POST' }
      );

      if (!containerRes.ok) {
        const err = await containerRes.text().catch(() => '');
        return {
          success: false,
          error: `Container creation failed (${containerRes.status}): ${err.slice(0, 200)}`,
        };
      }

      const containerJson = (await containerRes.json()) as { id?: string };
      if (!containerJson.id) {
        return { success: false, error: 'Container creation returned no ID' };
      }
      containerId = containerJson.id;
    }

    // Step 2: Publish the container
    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: containerId,
    });

    const publishRes = await fetch(
      `${GRAPH_API}/${igUserId}/media_publish?${publishParams}`,
      { method: 'POST' }
    );

    if (!publishRes.ok) {
      const err = await publishRes.text().catch(() => '');
      return {
        success: false,
        error: `Publish failed (${publishRes.status}): ${err.slice(0, 200)}`,
      };
    }

    const publishJson = (await publishRes.json()) as { id?: string };

    logger.info('instagram: post published', {
      igUserId,
      platformPostId: publishJson.id,
    });

    return { success: true, platformPostId: publishJson.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('instagram: unexpected error', { error: err });
    return { success: false, error: message };
  }
}
