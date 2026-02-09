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

// Import for factory
import { TwitterSyncService } from './twitter-sync-service';
import { LinkedInService } from './linkedin-service';
import { InstagramService } from './instagram-service';
import { PlatformService, PlatformCredentials } from './base-platform-service';

/**
 * Supported platforms
 */
export const SUPPORTED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube'] as const;
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

/**
 * Platform service factory
 * Creates and initializes a platform service for the given platform and credentials
 */
export function createPlatformService(
  platform: SupportedPlatform,
  credentials: PlatformCredentials
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
    case 'youtube':
      // Not yet implemented
      return null;
    default:
      return null;
  }

  if (service) {
    service.initialize(credentials);
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
    syncSupported: false,
  },
  youtube: {
    name: 'YouTube',
    icon: 'youtube',
    color: '#FF0000',
    syncSupported: false,
  },
};
