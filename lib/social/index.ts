/**
 * Social Media Platform Services
 *
 * @description Unified exports for all social media platform integrations
 */

// Base types and interfaces
export * from './base-platform-service';

// Platform services
export { twitterService, TwitterService } from './twitter-service';
export { twitterSyncService, TwitterSyncService } from './twitter-sync-service';
export { linkedInService, LinkedInService } from './linkedin-service';
export { instagramService, InstagramService } from './instagram-service';
export { FacebookService } from './facebook-service';
export { tiktokService, TikTokService } from './tiktok-service';
export { youtubeService, YouTubeService } from './youtube-service';
export { pinterestService, PinterestService } from './pinterest-service';
export { redditService, RedditService } from './reddit-service';
export { threadsService, ThreadsService } from './threads-service';

// Import for factory
import { TwitterSyncService } from './twitter-sync-service';
import { LinkedInService } from './linkedin-service';
import { InstagramService } from './instagram-service';
import { FacebookService } from './facebook-service';
import { TikTokService } from './tiktok-service';
import { YouTubeService } from './youtube-service';
import { PinterestService } from './pinterest-service';
import { RedditService } from './reddit-service';
import { ThreadsService } from './threads-service';
import {
  PlatformService,
  PlatformCredentials,
  TokenRefreshCallback,
} from './base-platform-service';
import { runLockedRefresh } from '@/lib/platform-connections/refresh-lock';

/**
 * Supported platforms
 */
export const SUPPORTED_PLATFORMS = [
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

/**
 * Options for creating a platform service
 */
export interface CreatePlatformServiceOptions {
  /** Callback to persist refreshed tokens to database */
  tokenRefreshCallback?: TokenRefreshCallback;
  /** Token refresh threshold in milliseconds (default: 5 minutes) */
  tokenRefreshThresholdMs?: number;
  /**
   * PlatformConnection id. When provided, token refresh is routed through a
   * cross-invocation advisory lock (keyed by this id) that owns rotation AND
   * persistence — so a single-use rotating refresh token is rotated by exactly
   * one actor across serverless invocations, and no per-call-site persistence
   * callback is required. This is the ONLY correct path for OAuth2 rotating
   * providers (X/Twitter); prefer it over tokenRefreshCallback.
   */
  connectionId?: string;
}

/**
 * Platform service factory
 * Creates and initializes a platform service for the given platform and credentials
 *
 * @param platform - The social media platform
 * @param credentials - User credentials for the platform
 * @param options - Optional configuration for token refresh handling
 *
 * @example
 * ```typescript
 * const service = createPlatformService('instagram', credentials, {
 *   tokenRefreshCallback: async (platform, newCreds) => {
 *     await db.platformConnections.update({
 *       where: { platform_userId: { platform, userId } },
 *       data: {
 *         accessToken: newCreds.accessToken,
 *         refreshToken: newCreds.refreshToken,
 *         expiresAt: newCreds.expiresAt,
 *       }
 *     });
 *   },
 *   tokenRefreshThresholdMs: 10 * 60 * 1000, // 10 minutes
 * });
 * ```
 */
export function createPlatformService(
  platform: SupportedPlatform,
  credentials: PlatformCredentials,
  options?: CreatePlatformServiceOptions
): PlatformService | null {
  let service: PlatformService | null = null;

  switch (platform) {
    case 'twitter':
      service = new TwitterSyncService();
      break;
    case 'linkedin':
      service = new LinkedInService();
      break;
    case 'instagram':
      service = new InstagramService();
      break;
    case 'facebook':
      service = new FacebookService();
      break;
    case 'tiktok':
      service = new TikTokService();
      break;
    case 'youtube':
      service = new YouTubeService();
      break;
    case 'pinterest':
      service = new PinterestService();
      break;
    case 'reddit':
      service = new RedditService();
      break;
    case 'threads':
      service = new ThreadsService();
      break;
    default:
      return null;
  }

  if (service) {
    service.initialize(credentials);

    // Configure custom refresh threshold if provided
    if (options?.tokenRefreshThresholdMs !== undefined) {
      service.setTokenRefreshThreshold(options.tokenRefreshThresholdMs);
    }

    if (options?.connectionId) {
      // Cross-invocation locked refresh. The coordinator re-reads the persisted
      // token under an advisory lock and only calls the service's own
      // refreshToken() when the token is still stale, then persists atomically.
      // sibling-detection uses the same threshold that gates entry, so a token a
      // sibling already rotated is re-used instead of replayed.
      const connectionId = options.connectionId;
      const thresholdMs = options.tokenRefreshThresholdMs;
      service.setRefreshCoordinator(() =>
        runLockedRefresh({
          connectionId,
          platform,
          thresholdMs,
          doRefresh: () => {
            if (!service.refreshToken) {
              throw new Error(`No refreshToken method for ${platform}`);
            }
            return service.refreshToken();
          },
        })
      );
    } else if (options?.tokenRefreshCallback) {
      // Legacy single-invocation persistence (non-rotating / non-connection
      // paths). Ignored when a connectionId coordinator is set.
      service.setTokenRefreshCallback(options.tokenRefreshCallback);
    }
  }

  return service;
}

/**
 * Check if a platform is supported for sync operations
 */
export function isPlatformSupported(
  platform: string
): platform is SupportedPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform);
}

/**
 * Get platform display info
 */
export const PLATFORM_INFO: Record<
  SupportedPlatform,
  {
    name: string;
    icon: string;
    color: string;
    syncSupported: boolean;
  }
> = {
  twitter: {
    name: 'Twitter/X',
    icon: 'twitter',
    color: '#1DA1F2',
    syncSupported: true,
  },
  linkedin: {
    name: 'LinkedIn',
    icon: 'linkedin',
    color: '#0A66C2',
    syncSupported: true,
  },
  instagram: {
    name: 'Instagram',
    icon: 'instagram',
    color: '#E4405F',
    syncSupported: true,
  },
  facebook: {
    name: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    syncSupported: true,
  },
  tiktok: {
    name: 'TikTok',
    icon: 'tiktok',
    color: '#000000',
    syncSupported: true,
  },
  youtube: {
    name: 'YouTube',
    icon: 'youtube',
    color: '#FF0000',
    syncSupported: true,
  },
  pinterest: {
    name: 'Pinterest',
    icon: 'pinterest',
    color: '#E60023',
    syncSupported: true,
  },
  reddit: {
    name: 'Reddit',
    icon: 'reddit',
    color: '#FF4500',
    syncSupported: true,
  },
  threads: {
    name: 'Threads',
    icon: 'threads',
    color: '#000000',
    syncSupported: true,
  },
};
