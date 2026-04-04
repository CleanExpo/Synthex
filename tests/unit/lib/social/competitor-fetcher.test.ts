/**
 * Unit Tests for lib/social/competitor-fetcher.ts
 *
 * Tests fetchCompetitorMetrics() across all 9 platform paths:
 * - Supported: Twitter, Instagram, YouTube, Facebook, Reddit
 * - Unsupported: LinkedIn, TikTok, Pinterest, Threads
 * - Unknown platform handling
 * - Result shape validation
 */

// ============================================================================
// Mock setup
// ============================================================================

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Save original fetch
const originalFetch = global.fetch;

import { fetchCompetitorMetrics, type CompetitorMetrics } from '@/lib/social/competitor-fetcher';

// ============================================================================
// Helpers
// ============================================================================

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

/**
 * Create a mock Response object
 */
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

describe('Competitor Fetcher', () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
    // Clear env vars that might affect YouTube
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // ==========================================
  // Result Shape
  // ==========================================

  describe('Result Shape', () => {
    it('should always return CompetitorMetrics with required fields', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        data: {
          public_metrics: {
            followers_count: 1000,
            following_count: 500,
            tweet_count: 200,
          },
        },
      }));

      const result = await fetchCompetitorMetrics('twitter', 'testuser', 'token123');

      expect(result).toHaveProperty('platform', 'twitter');
      expect(result).toHaveProperty('handle', 'testuser');
      expect(result).toHaveProperty('followersCount');
      expect(result).toHaveProperty('followingCount');
      expect(result).toHaveProperty('postsCount');
      expect(result).toHaveProperty('engagementRate');
      expect(result).toHaveProperty('fetchedAt');
      expect(result).toHaveProperty('success');
    });

    it('should have fetchedAt as a Date instance', async () => {
      const result = await fetchCompetitorMetrics('linkedin', 'testuser', null);

      expect(result.fetchedAt).toBeInstanceOf(Date);
    });

    it('should have error string on failure results', async () => {
      const result = await fetchCompetitorMetrics('linkedin', 'testuser', null);

      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    });
  });

  // ==========================================
  // Twitter
  // ==========================================

  describe('Twitter', () => {
    it('should return followers, following, and postsCount on valid response', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        data: {
          public_metrics: {
            followers_count: 15000,
            following_count: 800,
            tweet_count: 5200,
          },
        },
      }));

      const result = await fetchCompetitorMetrics('twitter', 'elonmusk', 'bearer-token');

      expect(result.success).toBe(true);
      expect(result.followersCount).toBe(15000);
      expect(result.followingCount).toBe(800);
      expect(result.postsCount).toBe(5200);
      expect(result.engagementRate).toBeNull(); // Twitter doesn't expose this
    });

    it('should call Twitter API with correct URL and Authorization header', async () => {
      mockFetch.mockResolvedValue(mockResponse({ data: { public_metrics: {} } }));

      await fetchCompetitorMetrics('twitter', 'testhandle', 'my-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.twitter.com/2/users/by/username/testhandle'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-token' },
        })
      );
    });

    it('should return failure when no access token is provided', async () => {
      const result = await fetchCompetitorMetrics('twitter', 'testuser', null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No access token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 401));

      const result = await fetchCompetitorMetrics('twitter', 'testuser', 'expired-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired or invalid');
    });

    it('should handle 429 rate limit', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 429));

      const result = await fetchCompetitorMetrics('twitter', 'testuser', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limited');
    });

    it('should handle user not found (no data in response)', async () => {
      mockFetch.mockResolvedValue(mockResponse({ data: null }));

      const result = await fetchCompetitorMetrics('twitter', 'nonexistent', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle network error without throwing', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchCompetitorMetrics('twitter', 'testuser', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Twitter fetch failed');
    });
  });

  // ==========================================
  // Instagram (Business Discovery API)
  // ==========================================

  describe('Instagram', () => {
    it('should return followers and media count on valid response', async () => {
      // First call: /me endpoint
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'ig-user-123' }))
        // Second call: business_discovery endpoint
        .mockResolvedValueOnce(mockResponse({
          business_discovery: {
            followers_count: 50000,
            follows_count: 300,
            media_count: 420,
          },
        }));

      const result = await fetchCompetitorMetrics('instagram', 'competitor_ig', 'ig-token');

      expect(result.success).toBe(true);
      expect(result.followersCount).toBe(50000);
      expect(result.followingCount).toBe(300);
      expect(result.postsCount).toBe(420);
    });

    it('should return failure when no access token is provided', async () => {
      const result = await fetchCompetitorMetrics('instagram', 'testuser', null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No access token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle /me endpoint failure', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 401));

      const result = await fetchCompetitorMetrics('instagram', 'competitor', 'bad-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired or invalid');
    });

    it('should handle business discovery returning no data', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'ig-user-123' }))
        .mockResolvedValueOnce(mockResponse({ business_discovery: null }));

      const result = await fetchCompetitorMetrics('instagram', 'personal_account', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or not a Business');
    });

    it('should handle rate limiting on discovery endpoint', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'ig-user-123' }))
        .mockResolvedValueOnce(mockResponse({}, 429));

      const result = await fetchCompetitorMetrics('instagram', 'competitor', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limited');
    });
  });

  // ==========================================
  // YouTube
  // ==========================================

  describe('YouTube', () => {
    it('should return subscriber and video count on valid response', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        items: [{
          statistics: {
            subscriberCount: '1200000',
            videoCount: '540',
            viewCount: '500000000',
          },
        }],
      }));

      const result = await fetchCompetitorMetrics('youtube', '@techchannel', 'yt-token');

      expect(result.success).toBe(true);
      expect(result.followersCount).toBe(1200000); // Parsed from string
      expect(result.postsCount).toBe(540);
      expect(result.followingCount).toBeNull(); // YouTube has no following
    });

    it('should strip @ prefix from handle', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        items: [{ statistics: { subscriberCount: '100', videoCount: '10' } }],
      }));

      await fetchCompetitorMetrics('youtube', '@mychannel', 'token');

      // URL should use the handle without @
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('forHandle=mychannel');
      expect(calledUrl).not.toContain('@');
    });

    it('should support API key fallback when no access token', async () => {
      process.env.YOUTUBE_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValue(mockResponse({
        items: [{ statistics: { subscriberCount: '5000', videoCount: '25' } }],
      }));

      const result = await fetchCompetitorMetrics('youtube', 'channel', null);

      expect(result.success).toBe(true);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('key=test-api-key');
    });

    it('should support GOOGLE_API_KEY as fallback', async () => {
      process.env.GOOGLE_API_KEY = 'google-api-key';

      mockFetch.mockResolvedValue(mockResponse({
        items: [{ statistics: { subscriberCount: '5000', videoCount: '25' } }],
      }));

      const result = await fetchCompetitorMetrics('youtube', 'channel', null);

      expect(result.success).toBe(true);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('key=google-api-key');
    });

    it('should return failure when no token and no API key', async () => {
      const result = await fetchCompetitorMetrics('youtube', 'channel', null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No access token or API key');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fallback to forUsername when forHandle returns empty items', async () => {
      // First call (forHandle): no items
      mockFetch
        .mockResolvedValueOnce(mockResponse({ items: [] }))
        // Second call (forUsername): has items
        .mockResolvedValueOnce(mockResponse({
          items: [{ statistics: { subscriberCount: '1000', videoCount: '50' } }],
        }));

      const result = await fetchCompetitorMetrics('youtube', 'legacychannel', 'token');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain('forUsername=legacychannel');
    });

    it('should handle channel not found (both lookups empty)', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ items: [] }))
        .mockResolvedValueOnce(mockResponse({ items: [] }));

      const result = await fetchCompetitorMetrics('youtube', 'nonexistent', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('channel not found');
    });

    it('should handle 429 rate limit', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 429));

      const result = await fetchCompetitorMetrics('youtube', 'channel', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limited');
    });

    it('should handle 403 quota exceeded', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 403));

      const result = await fetchCompetitorMetrics('youtube', 'channel', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('quota exceeded');
    });
  });

  // ==========================================
  // Facebook
  // ==========================================

  describe('Facebook', () => {
    it('should return followers count on valid page response', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        followers_count: 25000,
        fan_count: 23000,
        name: 'Test Brand',
      }));

      const result = await fetchCompetitorMetrics('facebook', 'testbrand', 'fb-token');

      expect(result.success).toBe(true);
      expect(result.followersCount).toBe(25000);
      expect(result.followingCount).toBeNull(); // Pages don't follow
      expect(result.postsCount).toBeNull(); // Not available in basic info
    });

    it('should return failure when no access token', async () => {
      const result = await fetchCompetitorMetrics('facebook', 'testpage', null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No access token');
    });

    it('should handle 404 page not found', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 404));

      const result = await fetchCompetitorMetrics('facebook', 'nonexistent', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('page not found');
    });

    it('should handle Facebook API error in response body', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        error: { message: 'Invalid OAuth token' },
      }));

      const result = await fetchCompetitorMetrics('facebook', 'testpage', 'bad-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid OAuth token');
    });

    it('should fallback to fan_count when followers_count is missing', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        fan_count: 18000,
        name: 'Legacy Page',
      }));

      const result = await fetchCompetitorMetrics('facebook', 'legacypage', 'token');

      expect(result.success).toBe(true);
      expect(result.followersCount).toBe(18000);
    });
  });

  // ==========================================
  // Reddit (public endpoint, no auth)
  // ==========================================

  describe('Reddit', () => {
    it('should return karma and subscriber data on valid response', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        data: {
          link_karma: 15000,
          comment_karma: 8000,
          subreddit: {
            subscribers: 500,
          },
        },
      }));

      const result = await fetchCompetitorMetrics('reddit', 'testuser', null);

      expect(result.success).toBe(true);
      expect(result.followersCount).toBe(500); // subreddit subscribers
      expect(result.engagementRate).toBe(23000); // total karma as engagement proxy
      expect(result.followingCount).toBeNull();
      expect(result.postsCount).toBeNull();
    });

    it('should NOT require access token (public endpoint)', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        data: { link_karma: 100, comment_karma: 50 },
      }));

      const result = await fetchCompetitorMetrics('reddit', 'testuser', null);

      // Should succeed without a token
      expect(result.success).toBe(true);
      // Fetch should not have Authorization header
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('reddit.com/user/testuser/about.json'),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });

    it('should send Synthex User-Agent header', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        data: { link_karma: 0, comment_karma: 0 },
      }));

      await fetchCompetitorMetrics('reddit', 'testuser', null);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Synthex/1.0 (competitor-tracking)',
          }),
        })
      );
    });

    it('should handle 404 user not found', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 404));

      const result = await fetchCompetitorMetrics('reddit', 'nonexistent', null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('user not found');
    });

    it('should handle missing user data in response', async () => {
      mockFetch.mockResolvedValue(mockResponse({ data: null }));

      const result = await fetchCompetitorMetrics('reddit', 'testuser', null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('user data unavailable');
    });

    it('should handle zero karma gracefully', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        data: {
          link_karma: 0,
          comment_karma: 0,
          subreddit: { subscribers: 0 },
        },
      }));

      const result = await fetchCompetitorMetrics('reddit', 'newuser', null);

      expect(result.success).toBe(true);
      expect(result.engagementRate).toBeNull(); // totalKarma is 0, returns null
    });
  });

  // ==========================================
  // Unsupported Platforms
  // ==========================================

  describe('Unsupported Platforms', () => {
    it('should return failure for LinkedIn', async () => {
      const result = await fetchCompetitorMetrics('linkedin', 'testuser', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support public profile lookup');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return failure for TikTok', async () => {
      const result = await fetchCompetitorMetrics('tiktok', 'testuser', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support public profile lookup');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return failure for Pinterest', async () => {
      const result = await fetchCompetitorMetrics('pinterest', 'testuser', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support public profile lookup');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return failure for Threads', async () => {
      const result = await fetchCompetitorMetrics('threads', 'testuser', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support public profile lookup');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT call fetch for any unsupported platform', async () => {
      const unsupported = ['linkedin', 'tiktok', 'pinterest', 'threads'];

      for (const platform of unsupported) {
        mockFetch.mockClear();
        await fetchCompetitorMetrics(platform, 'user', 'token');
        expect(mockFetch).not.toHaveBeenCalled();
      }
    });
  });

  // ==========================================
  // Unknown Platform
  // ==========================================

  describe('Unknown Platform', () => {
    it('should return failure for unknown platforms', async () => {
      const result = await fetchCompetitorMetrics('mastodon', 'testuser', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown platform: mastodon');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Never Throws
  // ==========================================

  describe('Never Throws', () => {
    it('should catch unexpected errors and return failure', async () => {
      // Force an unexpected error by making fetch throw a non-Error
      mockFetch.mockRejectedValue('weird error');

      const result = await fetchCompetitorMetrics('twitter', 'user', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
