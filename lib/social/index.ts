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
export { tiktokService, TikTokService } from './tiktok-service';

// Import for factory
import { TwitterSyncService } from './twitter-sync-service';
import { LinkedInService } from './linkedin-service';
import { InstagramService } from './instagram-service';
import { TikTokService } from './tiktok-service';
import { PlatformService, PlatformCredentials, TokenRefreshCallback } from './base-platform-service';

/**
 * Supported platforms
 */
export const SUPPORTED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube'] as const;
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

/**
 * Options for creating a platform service
 */
export interface CreatePlatformServiceOptions {
  /** Callback to persist refreshed tokens to database */
  tokenRefreshCallback?: TokenRefreshCallback;
  /** Token refresh threshold in milliseconds (default: 5 minutes) */
  tokenRefreshThresholdMs?: number;
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
      // Facebook uses same API as Instagram for business accounts
      service = new InstagramService();
      break;
    case 'tiktok':
      service = new TikTokService();
      break;
    case 'youtube':
      // Not yet implemented
      return null;
    default:
      return null;
  }

  if (service) {
    service.initialize(credentials);

    // Configure token refresh if callback provided
    if (options?.tokenRefreshCallback) {
      service.setTokenRefreshCallback(options.tokenRefreshCallback);
    }

    // Configure custom refresh threshold if provided
    if (options?.tokenRefreshThresholdMs !== undefined) {
      service.setTokenRefreshThreshold(options.tokenRefreshThresholdMs);
    }
  }

  return service;
}

/**
 * Check if a platform is supported for sync operations
 */
export function isPlatformSupported(platform: string): platform is SupportedPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform);
}

/**
 * Get platform display info
 */
export const PLATFORM_INFO: Record<SupportedPlatform, {
  name: string;
  icon: string;
  color: string;
  syncSupported: boolean;
}> = {
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
    syncSupported: false,
  },
};
