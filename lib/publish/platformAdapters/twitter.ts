/**
 * Twitter/X platform adapter — lib/publish/platformAdapters/twitter.ts
 *
 * Publishes a tweet via the Twitter API v2.
 *
 * Unlike the IG/FB/LinkedIn adapters, Twitter uses OAuth 1.0a user-context
 * auth (app key/secret + per-user access token/secret). Rather than duplicate
 * that signing logic, this adapter delegates to the already-tested
 * TwitterSyncService.createPost() path used by the ad-hoc "post now" route, so
 * the scheduled queue and post-now share one implementation.
 *
 * The user's OAuth1 access-token SECRET is stored (encrypted) in the
 * PlatformConnection.refreshToken column; the caller is responsible for
 * decrypting it and passing it as `accessTokenSecret`.
 *
 * @task SYN-P1 (multi-platform auto-publish)
 */

import { logger } from '@/lib/logger';
import type { PublishResult } from './instagram';
import { TwitterSyncService } from '@/lib/social/twitter-sync-service';

export interface TwitterPublishInput {
  /** OAuth 1.0a user access token (PlatformConnection.accessToken, decrypted). */
  accessToken: string;
  /**
   * OAuth 1.0a user access-token secret (PlatformConnection.refreshToken,
   * decrypted). Required for OAuth 1.0a user-context posting.
   */
  accessTokenSecret?: string;
  text: string;
  /** Optional public media URLs to attach (max 4). */
  mediaUrls?: string[];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToTwitter(
  input: TwitterPublishInput
): Promise<PublishResult> {
  const { accessToken, accessTokenSecret, text, mediaUrls } = input;

  try {
    const service = new TwitterSyncService();
    service.initialize({
      accessToken,
      // TwitterSyncService maps refreshToken → OAuth1 access-token secret.
      refreshToken: accessTokenSecret,
    });

    if (!service.isConfigured()) {
      return {
        success: false,
        error:
          'Twitter service not configured — missing app credentials or access-token secret',
      };
    }

    const result = await service.createPost({ text, mediaUrls });

    if (!result.success) {
      logger.warn('twitter: post failed', {
        error: result.error,
        statusCode: result.statusCode,
      });
      return {
        success: false,
        error: result.error ?? 'Twitter post failed',
        statusCode: result.statusCode,
      };
    }

    logger.info('twitter: post published', { platformPostId: result.postId });
    return { success: true, platformPostId: result.postId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('twitter: unexpected error', { error: err });
    return { success: false, error: message };
  }
}
