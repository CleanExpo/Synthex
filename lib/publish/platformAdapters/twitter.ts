/**
 * Twitter/X platform adapter — lib/publish/platformAdapters/twitter.ts
 *
 * Publishes a tweet via the Twitter API v2.
 *
 * Delegates to TwitterSyncService.createPost() so the scheduled queue and
 * ad-hoc post-now share one implementation. Credential shape is resolved via
 * buildTwitterPlatformCredentials() so OAuth 2.0 refresh tokens are never
 * passed as OAuth 1.0a access-token secrets.
 *
 * @task SYN-P1 (multi-platform auto-publish)
 */

import { logger } from '@/lib/logger';
import type { PublishResult } from './instagram';
import { TwitterSyncService } from '@/lib/social/twitter-sync-service';
import { buildTwitterPlatformCredentials } from '@/lib/social/twitter-oauth-credentials';

export interface TwitterPublishInput {
  /** Decrypted user access token (PlatformConnection.accessToken). */
  accessToken: string;
  /**
   * OAuth 1.0a user access-token secret. Omit for OAuth 2.0 connections —
   * pass `refreshToken` instead.
   */
  accessTokenSecret?: string;
  /** OAuth 2.0 refresh token (PlatformConnection.refreshToken, decrypted). */
  refreshToken?: string;
  expiresAt?: Date | null;
  metadata?: unknown;
  text: string;
  /** Optional public media URLs to attach (max 4). */
  mediaUrls?: string[];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToTwitter(
  input: TwitterPublishInput
): Promise<PublishResult> {
  const {
    accessToken,
    accessTokenSecret,
    refreshToken,
    expiresAt,
    metadata,
    text,
    mediaUrls,
  } = input;

  try {
    const service = new TwitterSyncService();
    service.initialize(
      buildTwitterPlatformCredentials({
        accessToken,
        refreshTokenDecrypted: refreshToken,
        accessSecretDecrypted: accessTokenSecret,
        expiresAt,
        metadata,
      })
    );

    if (!service.isConfigured()) {
      return {
        success: false,
        error:
          'Twitter service not configured — missing app credentials or user tokens',
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
