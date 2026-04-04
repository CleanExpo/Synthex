/**
 * Unit Tests for Representative Platform Services
 *
 * Tests 3 representative services covering different API patterns:
 * - TwitterSyncService — twitter-api-v2 SDK
 * - InstagramService — Meta Graph API via fetch
 * - RedditService — Form-encoded POST via fetch, User-Agent required
 *
 * Cross-service tests verify the shared BasePlatformService contract.
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

// --- Twitter SDK mock ---
// These must survive resetMocks. We use a persistent object and re-assign fns in beforeEach.
const twitterMockClient = {
  v2: {
    me: jest.fn(),
    tweet: jest.fn(),
    deleteTweet: jest.fn(),
    singleTweet: jest.fn(),
    userTimeline: jest.fn(),
  },
  v1: {
    uploadMedia: jest.fn(),
  },
};

jest.mock('twitter-api-v2', () => {
  // Return a factory that always returns our persistent mock client
  return {
    TwitterApi: function () {
      return twitterMockClient;
    },
    TwitterApiV2Settings: {
      debug: false,
    },
  };
});

// Save original fetch
const originalFetch = global.fetch;

import { TwitterSyncService } from '@/lib/social/twitter-sync-service';
import { InstagramService } from '@/lib/social/instagram-service';
import { RedditService } from '@/lib/social/reddit-service';
import type { PlatformCredentials } from '@/lib/social/base-platform-service';

// ============================================================================
// Helpers
// ============================================================================

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

function mockResponse(body: unknown, status = 200): Response {
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

function makeCredentials(overrides: Partial<PlatformCredentials> = {}): PlatformCredentials {
  return {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    platformUserId: 'test-user-123',
    expiresAt: new Date(Date.now() + 3600 * 1000),
    ...overrides,
  };
}

// ============================================================================
// Twitter Tests
// ============================================================================

describe('TwitterSyncService', () => {
  let service: TwitterSyncService;

  beforeEach(() => {
    // Reset all methods on our persistent mock client
    twitterMockClient.v2.me = jest.fn();
    twitterMockClient.v2.tweet = jest.fn();
    twitterMockClient.v2.deleteTweet = jest.fn();
    twitterMockClient.v2.singleTweet = jest.fn();
    twitterMockClient.v2.userTimeline = jest.fn();
    twitterMockClient.v1.uploadMedia = jest.fn();

    // Initialize with env vars for OAuth 1.0a path
    process.env.TWITTER_API_KEY = 'test-key';
    process.env.TWITTER_API_SECRET = 'test-secret';
    service = new TwitterSyncService();
    service.initialize(makeCredentials());
  });

  afterEach(() => {
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_API_SECRET;
  });

  describe('syncProfile()', () => {
    it('should return mapped profile on success', async () => {
      twitterMockClient.v2.me.mockResolvedValue({
        data: {
          id: '12345',
          username: 'testuser',
          name: 'Test User',
          description: 'A test bio',
          profile_image_url: 'https://pbs.twimg.com/pic_normal.jpg',
          public_metrics: {
            followers_count: 5000,
            following_count: 200,
            tweet_count: 1500,
          },
          verified: true,
        },
      });

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('12345');
      expect(result.profile.username).toBe('testuser');
      expect(result.profile.displayName).toBe('Test User');
      expect(result.profile.bio).toBe('A test bio');
      expect(result.profile.followers).toBe(5000);
      expect(result.profile.following).toBe(200);
      expect(result.profile.postsCount).toBe(1500);
      expect(result.profile.verified).toBe(true);
      expect(result.profile.url).toBe('https://twitter.com/testuser');
    });

    it('should return failure when not configured', async () => {
      const unconfigured = new TwitterSyncService();
      // Don't initialize — no credentials

      const result = await unconfigured.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });

    it('should return failure on SDK error', async () => {
      twitterMockClient.v2.me.mockRejectedValue(new Error('API rate limit'));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit');
    });
  });

  describe('createPost()', () => {
    it('should create a text-only tweet', async () => {
      twitterMockClient.v2.me.mockResolvedValue({
        data: { id: '12345', username: 'testuser' },
      });
      twitterMockClient.v2.tweet.mockResolvedValue({
        data: { id: 'tweet-789' },
      });

      const result = await service.createPost({ text: 'Hello world!' });

      expect(result.success).toBe(true);
      expect(result.postId).toBe('tweet-789');
      expect(result.url).toContain('testuser/status/tweet-789');
    });

    it('should return failure when not configured', async () => {
      const unconfigured = new TwitterSyncService();

      const result = await unconfigured.createPost({ text: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });
  });

  describe('deletePost()', () => {
    it('should delete a tweet successfully', async () => {
      twitterMockClient.v2.deleteTweet.mockResolvedValue({ data: { deleted: true } });

      const result = await service.deletePost('tweet-123');

      expect(result).toBe(true);
      expect(twitterMockClient.v2.deleteTweet).toHaveBeenCalledWith('tweet-123');
    });

    it('should return false on error', async () => {
      twitterMockClient.v2.deleteTweet.mockRejectedValue(new Error('Not found'));

      const result = await service.deletePost('tweet-999');

      expect(result).toBe(false);
    });
  });

  describe('getPostMetrics()', () => {
    it('should return metrics for a tweet', async () => {
      twitterMockClient.v2.singleTweet.mockResolvedValue({
        data: {
          public_metrics: {
            like_count: 100,
            retweet_count: 50,
            reply_count: 25,
            quote_count: 10,
          },
        },
      });

      const result = await service.getPostMetrics('tweet-123');

      expect(result).not.toBeNull();
      expect(result!.likes).toBe(100);
      expect(result!.retweets).toBe(50);
      expect(result!.replies).toBe(25);
      expect(result!.quotes).toBe(10);
    });

    it('should return null when not configured', async () => {
      const unconfigured = new TwitterSyncService();
      const result = await unconfigured.getPostMetrics('tweet-123');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Instagram Tests
// ============================================================================

describe('InstagramService', () => {
  let service: InstagramService;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
    service = new InstagramService();
    service.initialize(makeCredentials());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('syncProfile()', () => {
    it('should map Graph API response to SyncProfileResult', async () => {
      // First call: get IG account ID via /me/accounts
      mockFetch.mockResolvedValueOnce(mockResponse({
        data: [{
          id: 'page-123',
          name: 'My Page',
          instagram_business_account: { id: 'ig-456' },
        }],
      }));
      // Second call: get profile
      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'ig-456',
        username: 'mybrand',
        name: 'My Brand',
        biography: 'Official brand account',
        profile_picture_url: 'https://example.com/pic.jpg',
        followers_count: 10000,
        follows_count: 500,
        media_count: 300,
      }));

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('ig-456');
      expect(result.profile.username).toBe('mybrand');
      expect(result.profile.displayName).toBe('My Brand');
      expect(result.profile.bio).toBe('Official brand account');
      expect(result.profile.followers).toBe(10000);
      expect(result.profile.following).toBe(500);
      expect(result.profile.postsCount).toBe(300);
      expect(result.profile.url).toBe('https://www.instagram.com/mybrand');
    });

    it('should return failure when not configured', async () => {
      const unconfigured = new InstagramService();

      const result = await unconfigured.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });
  });

  describe('createPost()', () => {
    it('should use two-step flow: create container then publish', async () => {
      // Step 1: get IG account ID
      mockFetch.mockResolvedValueOnce(mockResponse({
        data: [{
          id: 'page-123',
          instagram_business_account: { id: 'ig-456' },
        }],
      }));
      // Step 2: create media container
      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'container-789',
      }));
      // Step 3: publish container
      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'post-999',
      }));

      const result = await service.createPost({
        text: 'New post caption',
        mediaUrls: ['https://example.com/image.jpg'],
      });

      expect(result.success).toBe(true);
      expect(result.postId).toBe('post-999');
      // Verify the container creation call
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Second call should be POST to create container
      const containerCallUrl = (mockFetch.mock.calls[1][0] as string);
      expect(containerCallUrl).toContain('/ig-456/media');
      // Third call should be POST to publish
      const publishCallUrl = (mockFetch.mock.calls[2][0] as string);
      expect(publishCallUrl).toContain('/ig-456/media_publish');
    });

    it('should require media for Instagram posts', async () => {
      // Must mock getInstagramAccountId() call first
      mockFetch.mockResolvedValueOnce(mockResponse({
        data: [{
          id: 'page-123',
          instagram_business_account: { id: 'ig-456' },
        }],
      }));

      const result = await service.createPost({
        text: 'No image post',
        // No mediaUrls
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('require at least one image');
    });
  });

  describe('deletePost()', () => {
    it('should return false — Instagram API does not support deletion', async () => {
      const result = await service.deletePost('post-123');
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle Graph API error response', async () => {
      // Return error for /me/accounts
      mockFetch.mockResolvedValueOnce(mockResponse({
        error: {
          message: 'Invalid OAuth access token',
          code: 190,
          error_subcode: 463,
        },
      }, 400));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });
});

// ============================================================================
// Reddit Tests
// ============================================================================

describe('RedditService', () => {
  let service: RedditService;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
    service = new RedditService();
    service.initialize(makeCredentials());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('syncProfile()', () => {
    it('should map /api/v1/me response to SyncProfileResult', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'reddit-user-1',
        name: 'test_redditor',
        icon_img: 'https://reddit.com/avatar.png?v=1',
        link_karma: 5000,
        comment_karma: 3000,
        subreddit: {
          title: 'Test Redditor',
          public_description: 'A test account',
          subscribers: 150,
          banner_img: 'https://reddit.com/banner.png',
        },
        num_friends: 10,
        has_verified_email: true,
      }));

      const result = await service.syncProfile();

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('reddit-user-1');
      expect(result.profile.username).toBe('test_redditor');
      expect(result.profile.displayName).toBe('Test Redditor');
      expect(result.profile.bio).toBe('A test account');
      expect(result.profile.avatarUrl).toBe('https://reddit.com/avatar.png');
      expect(result.profile.followers).toBe(150);
      expect(result.profile.following).toBe(10);
      expect(result.profile.verified).toBe(true);
      expect(result.profile.url).toBe('https://www.reddit.com/user/test_redditor');
    });

    it('should return failure when not configured', async () => {
      const unconfigured = new RedditService();

      const result = await unconfigured.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not configured');
    });
  });

  describe('createPost()', () => {
    it('should use form-encoded POST body (URLSearchParams)', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        json: {
          errors: [],
          data: {
            id: 'abc123',
            name: 't3_abc123',
            url: 'https://www.reddit.com/r/test/comments/abc123/test_post/',
          },
        },
      }));

      const result = await service.createPost({
        text: 'This is a self post',
        metadata: {
          subreddit: 'test',
          title: 'Test Post Title',
          kind: 'self',
        },
      });

      expect(result.success).toBe(true);
      expect(result.postId).toBe('abc123');

      // Verify fetch was called with form-encoded body
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('oauth.reddit.com/api/submit');
      expect(options?.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        })
      );
      // Body should be URLSearchParams
      expect(options?.body).toBeInstanceOf(URLSearchParams);
      const body = options?.body as URLSearchParams;
      expect(body.get('sr')).toBe('test');
      expect(body.get('title')).toBe('Test Post Title');
      expect(body.get('kind')).toBe('self');
      expect(body.get('text')).toBe('This is a self post');
    });

    it('should require subreddit for posts', async () => {
      const result = await service.createPost({
        text: 'No subreddit specified',
        metadata: { title: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('require a subreddit');
    });

    it('should require title for posts', async () => {
      const result = await service.createPost({
        text: 'No title specified',
        metadata: { subreddit: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('require a title');
    });
  });

  describe('User-Agent header', () => {
    it('should include User-Agent: Synthex/1.0 on GET requests', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'user-1',
        name: 'testuser',
        link_karma: 0,
        comment_karma: 0,
      }));

      await service.syncProfile();

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.headers).toEqual(
        expect.objectContaining({
          'User-Agent': 'Synthex/1.0',
        })
      );
    });

    it('should include User-Agent: Synthex/1.0 on POST requests', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        json: {
          errors: [],
          data: { id: 'post1', name: 't3_post1', url: 'https://reddit.com/r/test/post1' },
        },
      }));

      await service.createPost({
        text: 'test',
        metadata: { subreddit: 'test', title: 'Test', kind: 'self' },
      });

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.headers).toEqual(
        expect.objectContaining({
          'User-Agent': 'Synthex/1.0',
        })
      );
    });
  });

  describe('deletePost()', () => {
    it('should add t3_ prefix to post ID', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      await service.deletePost('abc123');

      const [, options] = mockFetch.mock.calls[0];
      const body = options?.body as URLSearchParams;
      expect(body.get('id')).toBe('t3_abc123');
    });

    it('should not double-prefix if t3_ already present', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      await service.deletePost('t3_abc123');

      const [, options] = mockFetch.mock.calls[0];
      const body = options?.body as URLSearchParams;
      expect(body.get('id')).toBe('t3_abc123');
    });

    it('should return true on successful deletion', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const result = await service.deletePost('abc123');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await service.deletePost('abc123');
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.syncProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});

// ============================================================================
// Cross-Service Contract Tests
// ============================================================================

describe('Cross-Service Contract', () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('All services implement same interface', () => {
    const services = [
      { name: 'Twitter', factory: () => new TwitterSyncService() },
      { name: 'Instagram', factory: () => new InstagramService() },
      { name: 'Reddit', factory: () => new RedditService() },
    ];

    for (const { name, factory } of services) {
      it(`${name} has all required PlatformService methods`, () => {
        const svc = factory();
        expect(typeof svc.initialize).toBe('function');
        expect(typeof svc.isConfigured).toBe('function');
        expect(typeof svc.isTokenExpired).toBe('function');
        expect(typeof svc.needsTokenRefresh).toBe('function');
        expect(typeof svc.getTokenExpiryMs).toBe('function');
        expect(typeof svc.setTokenRefreshCallback).toBe('function');
        expect(typeof svc.setTokenRefreshThreshold).toBe('function');
        expect(typeof svc.validateCredentials).toBe('function');
        expect(typeof svc.syncAnalytics).toBe('function');
        expect(typeof svc.syncPosts).toBe('function');
        expect(typeof svc.syncProfile).toBe('function');
        expect(typeof svc.createPost).toBe('function');
        expect(typeof svc.deletePost).toBe('function');
        expect(typeof svc.getPostMetrics).toBe('function');
      });
    }
  });

  describe('Token expiry detection', () => {
    it('isTokenExpired() returns true when past expiresAt', () => {
      const svc = new RedditService();
      svc.initialize(makeCredentials({
        expiresAt: new Date(Date.now() - 60_000), // 1 min ago
      }));
      expect(svc.isTokenExpired()).toBe(true);
    });

    it('isTokenExpired() returns false when far from expiresAt', () => {
      const svc = new InstagramService();
      svc.initialize(makeCredentials({
        expiresAt: new Date(Date.now() + 3600_000), // 1 hour from now
      }));
      expect(svc.isTokenExpired()).toBe(false);
    });

    it('getTokenExpiryMs() returns -1 when no expiresAt set', () => {
      const svc = new RedditService();
      svc.initialize(makeCredentials({ expiresAt: undefined }));
      expect(svc.getTokenExpiryMs()).toBe(-1);
    });

    it('getTokenExpiryMs() returns 0 when already expired', () => {
      const svc = new RedditService();
      svc.initialize(makeCredentials({
        expiresAt: new Date(Date.now() - 60_000),
      }));
      expect(svc.getTokenExpiryMs()).toBe(0);
    });
  });

  describe('Credentials management', () => {
    it('isConfigured() returns true with valid access token', () => {
      const svc = new RedditService();
      svc.initialize(makeCredentials());
      expect(svc.isConfigured()).toBe(true);
    });

    it('isConfigured() returns false without initialization', () => {
      const svc = new InstagramService();
      expect(svc.isConfigured()).toBe(false);
    });

    it('isConfigured() returns false with empty access token', () => {
      const svc = new RedditService();
      svc.initialize(makeCredentials({ accessToken: '' }));
      expect(svc.isConfigured()).toBe(false);
    });
  });
});
