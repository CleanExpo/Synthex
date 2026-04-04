/**
 * Facebook platform adapter — lib/publish/platformAdapters/facebook.ts
 *
 * Publishes a post to a Facebook Page via the Meta Graph API.
 * Requires a Page Access Token (not User token).
 *
 * Endpoint: POST /{page-id}/feed
 * Docs: https://developers.facebook.com/docs/pages/publishing
 *
 * @task SYN-523
 */

import { logger } from '@/lib/logger';
import type { PublishResult } from './instagram';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

export interface FacebookPublishInput {
  /** Page Access Token */
  accessToken: string;
  /** Facebook Page ID (from PlatformConnection.profileId) */
  pageId: string;
  message: string;
  /** Optional: public URL of link to attach */
  link?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToFacebook(
  input: FacebookPublishInput
): Promise<PublishResult> {
  const { accessToken, pageId, message, link } = input;

  try {
    const body: Record<string, string> = {
      access_token: accessToken,
      message,
    };
    if (link) body.link = link;

    const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn('facebook: page post failed', {
        status: res.status,
        body: err.slice(0, 300),
      });
      return {
        success: false,
        error: `Facebook post failed (${res.status}): ${err.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as { id?: string };

    logger.info('facebook: post published', {
      pageId,
      platformPostId: json.id,
    });

    return { success: true, platformPostId: json.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('facebook: unexpected error', { error: err });
    return { success: false, error: message };
  }
}
