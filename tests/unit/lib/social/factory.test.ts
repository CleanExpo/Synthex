/**
 * Unit Tests for lib/social/index.ts — Platform Service Factory
 *
 * Tests:
 * - createPlatformService() for all 9 platforms
 * - Factory with invalid input
 * - PLATFORM_INFO configuration completeness
 * - isPlatformSupported() for valid and invalid platforms
 * - Service initialization (credentials, isConfigured, isTokenExpired)
 * - Facebook reuses InstagramService
 * - Options: tokenRefreshCallback and tokenRefreshThresholdMs
 */

// ============================================================================
// Mock setup — must be before imports
// ============================================================================

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock twitter-api-v2 since TwitterSyncService and TwitterService import it
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    v2: { me: jest.fn() },
  })),
  TwitterApiV2Settings: {
    debug: false,
  },
}));

import {
  createPlatformService,
  isPlatformSupported,
  PLATFORM_INFO,
  SUPPORTED_PLATFORMS,
  TwitterSyncService,
  LinkedInService,
  InstagramService,
  TikTokService,
  YouTubeService,
  PinterestService,
  RedditService,
  ThreadsService,
} from '@/lib/social/index';
import type { PlatformCredentials, PlatformService } from '@/lib/social/base-platform-service';

// ============================================================================
// Helpers
// ============================================================================

function makeCredentials(overrides: Partial<PlatformCredentials> = {}): PlatformCredentials {
  return {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    platformUserId: 'test-user-123',
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Platform Service Factory', () => {
  // ==========================================
  // Factory creation for all 9 platforms
  // ==========================================

  describe('createPlatformService() — all 9 platforms', () => {
    const creds = makeCredentials();

    it('should create TwitterSyncService for "twitter"', () => {
      const service = createPlatformService('twitter', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(TwitterSyncService);
      expect(service!.platform).toBe('twitter');
    });

    it('should create LinkedInService for "linkedin"', () => {
      const service = createPlatformService('linkedin', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(LinkedInService);
      expect(service!.platform).toBe('linkedin');
    });

    it('should create InstagramService for "instagram"', () => {
      const service = createPlatformService('instagram', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(InstagramService);
      expect(service!.platform).toBe('instagram');
    });

    it('should create InstagramService for "facebook" (reuses same service)', () => {
      const service = createPlatformService('facebook', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(InstagramService);
    });

    it('should create TikTokService for "tiktok"', () => {
      const service = createPlatformService('tiktok', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(TikTokService);
      expect(service!.platform).toBe('tiktok');
    });

    it('should create YouTubeService for "youtube"', () => {
      const service = createPlatformService('youtube', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(YouTubeService);
      expect(service!.platform).toBe('youtube');
    });

    it('should create PinterestService for "pinterest"', () => {
      const service = createPlatformService('pinterest', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(PinterestService);
      expect(service!.platform).toBe('pinterest');
    });

    it('should create RedditService for "reddit"', () => {
      const service = createPlatformService('reddit', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(RedditService);
      expect(service!.platform).toBe('reddit');
    });

    it('should create ThreadsService for "threads"', () => {
      const service = createPlatformService('threads', creds);
      expect(service).not.toBeNull();
      expect(service).toBeInstanceOf(ThreadsService);
      expect(service!.platform).toBe('threads');
    });

    it('should return non-null for every supported platform', () => {
      for (const platform of SUPPORTED_PLATFORMS) {
        const service = createPlatformService(platform, creds);
        expect(service).not.toBeNull();
      }
    });
  });

  // ==========================================
  // Factory with invalid input
  // ==========================================

  describe('createPlatformService() — invalid input', () => {
    const creds = makeCredentials();

    it('should return null for unknown platform', () => {
      const service = createPlatformService('mastodon' as any, creds);
      expect(service).toBeNull();
    });

    it('should return null for empty string platform', () => {
      const service = createPlatformService('' as any, creds);
      expect(service).toBeNull();
    });
  });

  // ==========================================
  // PLATFORM_INFO configuration
  // ==========================================

  describe('PLATFORM_INFO', () => {
    it('should have entries for all 9 platforms', () => {
      const platforms = Object.keys(PLATFORM_INFO);
      expect(platforms).toHaveLength(9);
      expect(platforms).toEqual(
        expect.arrayContaining([
          'twitter', 'linkedin', 'instagram', 'facebook',
          'tiktok', 'youtube', 'pinterest', 'reddit', 'threads',
        ])
      );
    });

    it('should have syncSupported: true for every platform', () => {
      for (const [platform, info] of Object.entries(PLATFORM_INFO)) {
        expect(info.syncSupported).toBe(true);
      }
    });

    it('should have name, icon, and color for every platform', () => {
      for (const [platform, info] of Object.entries(PLATFORM_INFO)) {
        expect(typeof info.name).toBe('string');
        expect(info.name.length).toBeGreaterThan(0);
        expect(typeof info.icon).toBe('string');
        expect(info.icon.length).toBeGreaterThan(0);
        expect(typeof info.color).toBe('string');
        expect(info.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('should have no undefined or null entries', () => {
      for (const [platform, info] of Object.entries(PLATFORM_INFO)) {
        expect(info).toBeDefined();
        expect(info.name).not.toBeNull();
        expect(info.icon).not.toBeNull();
        expect(info.color).not.toBeNull();
        expect(info.syncSupported).not.toBeNull();
      }
    });
  });

  // ==========================================
  // isPlatformSupported()
  // ==========================================

  describe('isPlatformSupported()', () => {
    it('should return true for all 9 supported platforms', () => {
      for (const platform of SUPPORTED_PLATFORMS) {
        expect(isPlatformSupported(platform)).toBe(true);
      }
    });

    it('should return false for unknown platforms', () => {
      expect(isPlatformSupported('mastodon')).toBe(false);
      expect(isPlatformSupported('snapchat')).toBe(false);
      expect(isPlatformSupported('whatsapp')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isPlatformSupported('')).toBe(false);
    });

    it('should be case-sensitive (uppercase should fail)', () => {
      expect(isPlatformSupported('Twitter')).toBe(false);
      expect(isPlatformSupported('INSTAGRAM')).toBe(false);
    });
  });

  // ==========================================
  // Service initialization
  // ==========================================

  describe('Service initialization', () => {
    it('should initialize credentials — isConfigured() returns true', () => {
      const creds = makeCredentials();
      const service = createPlatformService('reddit', creds);
      expect(service).not.toBeNull();
      expect(service!.isConfigured()).toBe(true);
    });

    it('should detect non-expired token — isTokenExpired() returns false', () => {
      const creds = makeCredentials({
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      });
      const service = createPlatformService('reddit', creds);
      expect(service!.isTokenExpired()).toBe(false);
    });

    it('should detect expired token — isTokenExpired() returns true', () => {
      const creds = makeCredentials({
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      });
      const service = createPlatformService('reddit', creds);
      expect(service!.isTokenExpired()).toBe(true);
    });

    it('should treat missing expiresAt as non-expired', () => {
      const creds = makeCredentials({ expiresAt: undefined });
      const service = createPlatformService('reddit', creds);
      expect(service!.isTokenExpired()).toBe(false);
    });

    it('should configure token refresh callback when provided', () => {
      const mockCallback = jest.fn();
      const creds = makeCredentials();
      const service = createPlatformService('instagram', creds, {
        tokenRefreshCallback: mockCallback,
      });
      expect(service).not.toBeNull();
      // The callback is set internally — we verify by checking no error was thrown
      // and the service was created successfully
    });

    it('should configure token refresh threshold when provided', () => {
      const creds = makeCredentials({
        // Token expires in 8 minutes
        expiresAt: new Date(Date.now() + 8 * 60 * 1000),
      });

      // With default 5-minute threshold, token is NOT expired
      const serviceDefault = createPlatformService('reddit', creds);
      expect(serviceDefault!.isTokenExpired()).toBe(false);

      // With 10-minute threshold, token IS expired (8 min < 10 min threshold)
      const serviceCustom = createPlatformService('reddit', creds, {
        tokenRefreshThresholdMs: 10 * 60 * 1000,
      });
      expect(serviceCustom!.isTokenExpired()).toBe(true);
    });
  });

  // ==========================================
  // SUPPORTED_PLATFORMS constant
  // ==========================================

  describe('SUPPORTED_PLATFORMS', () => {
    it('should contain exactly 9 platforms', () => {
      expect(SUPPORTED_PLATFORMS).toHaveLength(9);
    });

    it('should be a readonly array', () => {
      // TypeScript enforces this at compile time, but we can verify the values
      expect(SUPPORTED_PLATFORMS).toEqual([
        'twitter', 'linkedin', 'instagram', 'facebook',
        'tiktok', 'youtube', 'pinterest', 'reddit', 'threads',
      ]);
    });
  });
});
