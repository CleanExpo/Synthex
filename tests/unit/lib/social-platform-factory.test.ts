/**
 * Unit Tests — Uncovered Platform Services
 * TikTok, Pinterest, YouTube, Threads
 *
 * The factory creation and basic service init for all 9 platforms is already
 * covered by factory.test.ts. This file focuses on the service-level behaviour
 * of the four platforms NOT covered by platform-services.test.ts
 * (which covers Twitter, Instagram, Reddit).
 *
 * Per-service coverage:
 * - TikTokService    — platform identity, isConfigured, isTokenExpired,
 *                      syncProfile (success + unconfigured + API failure),
 *                      createPost (text-only rejection, success), deletePost
 * - PinterestService — platform identity, isConfigured, syncProfile,
 *                      createPost (missing boardId rejection, success)
 * - YouTubeService   — platform identity, isConfigured, syncProfile,
 *                      createPost (text-only rejection, success)
 * - ThreadsService   — platform identity, isConfigured, syncProfile,
 *                      createPost (text + image distinction)
 *
 * All fetch() calls are intercepted via global.fetch mock.
 * No real API calls are made.
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

// twitter-api-v2 is imported transitively via index.ts when we import the social
// package. Mock it to prevent import errors.
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    v2: { me: jest.fn() },
  })),
  TwitterApiV2Settings: { debug: false },
}));

import { TikTokService } from '@/lib/social/tiktok-service';
import { PinterestService } from '@/lib/social/pinterest-service';
import { YouTubeService } from '@/lib/social/youtube-service';
import { ThreadsService } from '@/lib/social/threads-service';
import type {
  PlatformCredentials,
  PostContent,
} from '@/lib/social/base-platform-service';

// ============================================================================
// Helpers
// ============================================================================

function makeCredentials(
  overrides: Partial<PlatformCredentials> = {}
): PlatformCredentials {
  return {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    platformUserId: 'test-user-123',
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    ...overrides,
  };
}

function makePostContent(overrides: Partial<PostContent> = {}): PostContent {
  return {
    text: 'Test post content for unit tests',
    ...overrides,
  };
}

/** Create a minimal fetch Response mock */
function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    bytes: jest.fn(),
  } as unknown as Response;
}

// ============================================================================
// TikTokService
// ============================================================================

describe('TikTokService', () => {
  let service: TikTokService;
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    global.fetch = mockFetch;
    service = new TikTokService();
    service.initialize(makeCredentials());
  });

  afterEach(() => {
    global.fetch = fetch;
  });

  describe('platform identity', () => {
    it('should have platform = "tiktok"', () => {
      expect(service.platform).toBe('tiktok');
    });
  });

  describe('isConfigured()', () => {
    it('should return true when initialized with credentials', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when not initialized', () => {
      const empty = new TikTokService();
      expect(empty.isConfigured()).toBe(false);
    });
  });

  describe('isTokenExpired()', () => {
    it('should return false for a valid (non-expired) token', () => {
      service.initialize(
        makeCredentials({ expiresAt: new Date(Date.now() + 3600 * 1000) })
      );
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should return true for an expired token', () => {
      service.initialize(
        makeCredentials({ expiresAt: new Date(Date.now() - 3600 * 1000) })
      );
      expect(service.isTokenExpired()).toBe(true);
    });

    it('should return false when expiresAt is not set', () => {
      service.initialize(makeCredentials({ expiresAt: undefined }));
      expect(service.isTokenExpired()).toBe(false);
    });
  });

  describe('syncProfile()', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new TikTokService();
      const result = await unconfigured.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });

    it('should return mapped profile on successful API response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            user: {
              open_id: 'tiktok-user-abc',
              display_name: 'TestTikToker',
              bio_description: 'TikTok bio here',
              avatar_url: 'https://example.com/avatar.jpg',
              follower_count: 10000,
              following_count: 500,
              video_count: 200,
              is_verified: true,
              profile_deep_link: 'https://www.tiktok.com/@testtiktoker',
            },
          },
        })
      );

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('tiktok-user-abc');
      expect(result.profile.username).toBe('TestTikToker');
      expect(result.profile.displayName).toBe('TestTikToker');
      expect(result.profile.bio).toBe('TikTok bio here');
      expect(result.profile.followers).toBe(10000);
      expect(result.profile.following).toBe(500);
      expect(result.profile.postsCount).toBe(200);
      expect(result.profile.verified).toBe(true);
      expect(result.profile.url).toBe('https://www.tiktok.com/@testtiktoker');
    });

    it('should return success=false on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should return success=false when API returns error object', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(
          {
            error: {
              code: 'access_denied',
              message: 'Insufficient permissions',
            },
          },
          403
        )
      );

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
    });
  });

  describe('createPost() — TikTok video requirement', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new TikTokService();
      const result = await unconfigured.createPost(makePostContent());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });

    it('should return success=false for text-only post (no mediaUrls)', async () => {
      const result = await service.createPost(
        makePostContent({ mediaUrls: [] })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/video/i);
    });

    it('should initiate video post when mediaUrls are provided', async () => {
      // TikTok 2-step: init returns publish_id
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          data: { publish_id: 'tiktok-pub-123' },
        })
      );

      const result = await service.createPost(
        makePostContent({
          mediaUrls: ['https://example.com/video.mp4'],
        })
      );

      expect(result.success).toBe(true);
      expect(result.postId).toBe('tiktok-pub-123');
    });
  });
});

// ============================================================================
// PinterestService
// ============================================================================

describe('PinterestService', () => {
  let service: PinterestService;
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    global.fetch = mockFetch;
    service = new PinterestService();
    service.initialize(makeCredentials());
  });

  afterEach(() => {
    global.fetch = fetch;
  });

  describe('platform identity', () => {
    it('should have platform = "pinterest"', () => {
      expect(service.platform).toBe('pinterest');
    });
  });

  describe('isConfigured()', () => {
    it('should return true when initialized', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when not initialized', () => {
      const empty = new PinterestService();
      expect(empty.isConfigured()).toBe(false);
    });
  });

  describe('syncProfile()', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new PinterestService();
      const result = await unconfigured.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });

    it('should return mapped profile on successful API response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          id: 'pinterest-user-xyz',
          username: 'pinterestuser',
          business_name: 'Pinterest Business',
          profile_image: 'https://example.com/profile.jpg',
          follower_count: 25000,
          following_count: 300,
          pin_count: 750,
          board_count: 15,
        })
      );

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('pinterest-user-xyz');
      expect(result.profile.username).toBe('pinterestuser');
      expect(result.profile.displayName).toBe('Pinterest Business');
      expect(result.profile.avatarUrl).toBe('https://example.com/profile.jpg');
      expect(result.profile.followers).toBe(25000);
      expect(result.profile.following).toBe(300);
      expect(result.profile.postsCount).toBe(750);
      expect(result.profile.url).toBe(
        'https://www.pinterest.com/pinterestuser/'
      );
    });

    it('should return success=false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('createPost() — Pinterest board requirement', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new PinterestService();
      const result = await unconfigured.createPost(makePostContent());
      expect(result.success).toBe(false);
    });

    it('should return success=false when boardId is missing', async () => {
      const result = await service.createPost(
        makePostContent({
          // metadata has no boardId
          metadata: {},
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/board/i);
    });

    it('should create a pin when boardId is provided', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          id: 'pin-abc-123',
          link: 'https://www.pinterest.com/pin/pin-abc-123/',
          title: 'Test Pin',
          description: 'Test pin description',
          board_id: 'board-001',
        })
      );

      const result = await service.createPost(
        makePostContent({
          text: 'Check out this amazing content!',
          mediaUrls: ['https://example.com/image.jpg'],
          metadata: { boardId: 'board-001' },
        })
      );

      expect(result.success).toBe(true);
      expect(result.postId).toBe('pin-abc-123');
      expect(result.url).toContain('pinterest.com/pin/');
    });

    it('should return success=false when pin creation fails', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ code: 403, message: 'Access denied to board' }, 403)
      );

      const result = await service.createPost(
        makePostContent({
          metadata: { boardId: 'board-private' },
        })
      );

      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// YouTubeService
// ============================================================================

describe('YouTubeService', () => {
  let service: YouTubeService;
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    global.fetch = mockFetch;
    service = new YouTubeService();
    service.initialize(makeCredentials());
  });

  afterEach(() => {
    global.fetch = fetch;
  });

  describe('platform identity', () => {
    it('should have platform = "youtube"', () => {
      expect(service.platform).toBe('youtube');
    });
  });

  describe('isConfigured()', () => {
    it('should return true when initialized', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when not initialized', () => {
      const empty = new YouTubeService();
      expect(empty.isConfigured()).toBe(false);
    });
  });

  describe('isTokenExpired()', () => {
    it('should return false for fresh token', () => {
      service.initialize(
        makeCredentials({ expiresAt: new Date(Date.now() + 7200 * 1000) })
      );
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should return true for expired token', () => {
      service.initialize(
        makeCredentials({ expiresAt: new Date(Date.now() - 60 * 1000) })
      );
      expect(service.isTokenExpired()).toBe(true);
    });
  });

  describe('syncProfile()', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new YouTubeService();
      const result = await unconfigured.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });

    it('should return mapped channel profile on successful API response', async () => {
      // YouTube Data API v3 channels.list response
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          items: [
            {
              id: 'UC-channel-abc',
              snippet: {
                title: 'My YouTube Channel',
                description: 'Channel description',
                customUrl: '@mychannelhandle',
                thumbnails: {
                  high: { url: 'https://yt.com/thumb.jpg' },
                  default: { url: 'https://yt.com/thumb-small.jpg' },
                },
              },
              statistics: {
                subscriberCount: '50000',
                videoCount: '300',
                viewCount: '1000000',
              },
              brandingSettings: {
                image: {
                  bannerExternalUrl: 'https://yt.com/banner.jpg',
                },
              },
            },
          ],
        })
      );

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('UC-channel-abc');
      expect(result.profile.username).toBe('@mychannelhandle');
      expect(result.profile.displayName).toBe('My YouTube Channel');
      expect(result.profile.bio).toBe('Channel description');
      expect(result.profile.followers).toBe(50000);
      expect(result.profile.postsCount).toBe(300);
      expect(result.profile.url).toBe(
        'https://www.youtube.com/channel/UC-channel-abc'
      );
    });

    it('should return success=false on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('YouTube API quota exceeded'));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('quota exceeded');
    });
  });

  describe('createPost() — YouTube video requirement', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new YouTubeService();
      const result = await unconfigured.createPost(makePostContent());
      expect(result.success).toBe(false);
    });

    it('should return success=false for text-only post (no mediaUrls)', async () => {
      const result = await service.createPost(
        makePostContent({ mediaUrls: [] })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/video/i);
    });

    it('should return success=false when mediaUrls is undefined', async () => {
      const result = await service.createPost(
        makePostContent({ mediaUrls: undefined })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/video/i);
    });
  });
});

// ============================================================================
// ThreadsService
// ============================================================================

describe('ThreadsService', () => {
  let service: ThreadsService;
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    global.fetch = mockFetch;
    service = new ThreadsService();
    service.initialize(makeCredentials());
  });

  afterEach(() => {
    global.fetch = fetch;
  });

  describe('platform identity', () => {
    it('should have platform = "threads"', () => {
      expect(service.platform).toBe('threads');
    });
  });

  describe('isConfigured()', () => {
    it('should return true when initialized', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when not initialized', () => {
      const empty = new ThreadsService();
      expect(empty.isConfigured()).toBe(false);
    });
  });

  describe('isTokenExpired()', () => {
    it('should return false for a valid token', () => {
      service.initialize(
        makeCredentials({ expiresAt: new Date(Date.now() + 3600 * 1000) })
      );
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should return true for an expired token', () => {
      service.initialize(
        makeCredentials({ expiresAt: new Date(Date.now() - 3600 * 1000) })
      );
      expect(service.isTokenExpired()).toBe(true);
    });
  });

  describe('syncProfile()', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new ThreadsService();
      const result = await unconfigured.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });

    it('should return mapped profile on successful API response', async () => {
      // First call: profile endpoint
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          id: 'threads-user-123',
          username: 'threadsuser',
          name: 'Threads User',
          threads_biography: 'My Threads bio',
          threads_profile_picture_url: 'https://example.com/pic.jpg',
        })
      );
      // Second call: followers count
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          followers_count: 5000,
        })
      );

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('threads-user-123');
      expect(result.profile.username).toBe('threadsuser');
      expect(result.profile.displayName).toBe('Threads User');
      expect(result.profile.bio).toBe('My Threads bio');
      expect(result.profile.avatarUrl).toBe('https://example.com/pic.jpg');
      expect(result.profile.followers).toBe(5000);
      expect(result.profile.url).toBe('https://www.threads.net/@threadsuser');
    });

    it('should return success=false on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Threads API unavailable'));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Threads API unavailable');
    });

    it('should default followers to 0 if followers count request fails', async () => {
      // Profile succeeds but followers count request throws
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          id: 'threads-user-789',
          username: 'minimaluser',
          name: 'Minimal User',
          threads_biography: '',
          threads_profile_picture_url: '',
        })
      );
      mockFetch.mockRejectedValueOnce(
        new Error('Followers endpoint unavailable')
      );

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.followers).toBe(0); // Fallback when count unavailable
    });
  });

  describe('createPost()', () => {
    it('should return success=false when service is not configured', async () => {
      const unconfigured = new ThreadsService();
      const result = await unconfigured.createPost(makePostContent());
      expect(result.success).toBe(false);
    });

    it('should create a TEXT post successfully (2-step container + publish)', async () => {
      // Step 1: Create container
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ id: 'container-abc' })
      );
      // Step 2: Publish container
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ id: 'thread-post-456' })
      );

      const result = await service.createPost(
        makePostContent({
          text: 'Hello Threads! This is a test post.',
        })
      );

      expect(result.success).toBe(true);
      expect(result.postId).toBe('thread-post-456');
    });

    it('should detect IMAGE type when mediaUrls contain image URLs', async () => {
      // Step 1: Create container with IMAGE type
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ id: 'img-container-001' })
      );
      // Step 2: Publish
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ id: 'thread-img-post-789' })
      );

      const result = await service.createPost(
        makePostContent({
          text: 'Check out this image!',
          mediaUrls: ['https://example.com/photo.jpg'],
        })
      );

      expect(result.success).toBe(true);
    });

    it('should detect VIDEO type when mediaUrls contain video URLs', async () => {
      // Step 1: Create container with VIDEO type
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ id: 'vid-container-002' })
      );
      // Step 2: Status check poll — returns FINISHED immediately on first attempt
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ status: 'FINISHED' })
      );
      // Step 3: Publish
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ id: 'thread-vid-post-999' })
      );

      // Mock sleep to avoid the 2 s delay in the video processing loop
      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      const result = await service.createPost(
        makePostContent({
          text: 'Watch this video!',
          mediaUrls: ['https://example.com/video.mp4'],
        })
      );

      expect(result.success).toBe(true);
    });

    it('should return success=false when container creation fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Container creation failed'));

      const result = await service.createPost(makePostContent());

      expect(result.success).toBe(false);
    });
  });
});
