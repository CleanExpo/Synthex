/**
 * Instagram metrics honesty.
 *
 * Meta removed the `impressions` metric (account level from Graph API v22.0;
 * media created after 2 July 2024) and `engagement` is not a media insight.
 * Asking for them errors the whole insights request. The service used to
 * swallow that error and report `impressions: 0` / `reach: 0` with
 * `success: true`, and its failure paths returned zeros too, so a failed read
 * looked like a real zero. Synthex rule: a failed read never looks like success.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { InstagramService } from '@/lib/social/instagram-service';
import type { PlatformCredentials } from '@/lib/social/base-platform-service';

const originalFetch = global.fetch;
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(),
  } as unknown as Response;
}

function credentials(): PlatformCredentials {
  return {
    accessToken: 'test-access-token',
    platformUserId: 'test-user-123',
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };
}

const metaError = (message: string) =>
  mockResponse({ error: { message, type: 'OAuthException', code: 100 } }, 400);

/** Route each Graph call by path so tests do not depend on call order. */
function routeGraph(routes: {
  accountInsights?: () => Response;
  profile?: () => Response;
  mediaList?: () => Response;
  mediaItem?: () => Response;
}) {
  mockFetch.mockImplementation(async input => {
    const url = String(input);
    if (url.includes('/me/accounts')) {
      return mockResponse({
        data: [{ id: 'page-1', instagram_business_account: { id: 'ig-1' } }],
      });
    }
    if (url.includes('/ig-1/insights')) {
      return (routes.accountInsights ?? (() => metaError('no route')))();
    }
    if (url.includes('/ig-1/media')) {
      return (routes.mediaList ?? (() => metaError('no route')))();
    }
    if (url.includes('/ig-1?')) {
      return (routes.profile ?? (() => metaError('no route')))();
    }
    if (url.includes('/media-1?')) {
      return (routes.mediaItem ?? (() => metaError('no route')))();
    }
    return metaError(`unexpected url ${url}`);
  });
}

function requestedUrls(): string[] {
  return mockFetch.mock.calls.map(call => String(call[0]));
}

/** The `metric=` list or `insights.metric(...)` list of every insights call. */
function requestedMetricLists(): string[] {
  return requestedUrls().flatMap(url => {
    const decoded = decodeURIComponent(url);
    const lists: string[] = [];
    const query = decoded.match(/[?&]metric=([^&]+)/);
    if (query) lists.push(query[1]);
    const expansion = decoded.match(/insights\.metric\(([^)]+)\)/);
    if (expansion) lists.push(expansion[1]);
    return lists;
  });
}

describe('InstagramService metrics honesty', () => {
  let service: InstagramService;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
    service = new InstagramService();
    service.initialize(credentials());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('syncAnalytics failure paths do not report zeros', () => {
    it('unconfigured service returns null metrics, not zeros', async () => {
      const unconfigured = new InstagramService();
      const result = await unconfigured.syncAnalytics(30);

      expect(result.success).toBe(false);
      expect(result.metrics.impressions).toBeNull();
      expect(result.metrics.engagements).toBeNull();
      expect(result.metrics.followers).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('a thrown read (no IG business account) returns null metrics, not zeros', async () => {
      mockFetch.mockResolvedValue(mockResponse({ data: [] }));
      const result = await service.syncAnalytics(30);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.metrics.impressions).toBeNull();
      expect(result.metrics.engagements).toBeNull();
      expect(result.metrics.followers).toBeNull();
    });

    it('when every Meta read fails, nothing is reported as a real zero', async () => {
      routeGraph({
        accountInsights: () => metaError('(#100) metric[0] must be one of ...'),
        profile: () => metaError('profile read failed'),
        mediaList: () => metaError('media read failed'),
      });
      const result = await service.syncAnalytics(30);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.metrics.impressions).toBeNull();
      expect(result.metrics.reach ?? null).toBeNull();
      expect(result.metrics.views ?? null).toBeNull();
      expect(result.metrics.followers).toBeNull();
      expect(result.metrics.engagements).toBeNull();
    });
  });

  describe('syncAnalytics requests current account metrics', () => {
    it('reads reach/views as total_value, never asks for impressions, and maps the documented response shape', async () => {
      routeGraph({
        accountInsights: () =>
          mockResponse({
            data: [
              { name: 'reach', period: 'day', total_value: { value: 1200 } },
              { name: 'views', period: 'day', total_value: { value: 3400 } },
            ],
          }),
        profile: () => mockResponse({ id: 'ig-1', followers_count: 560 }),
        mediaList: () =>
          mockResponse({
            data: [{ id: 'm1', like_count: 7, comments_count: 3 }],
          }),
      });

      const result = await service.syncAnalytics(30);

      const lists = requestedMetricLists();
      expect(lists.length).toBeGreaterThan(0);
      for (const list of lists) {
        expect(list).not.toMatch(/\bimpressions\b/);
        expect(list).not.toMatch(/\bengagement\b/);
      }
      const accountCall = requestedUrls().find(u =>
        u.includes('/ig-1/insights')
      );
      expect(accountCall).toMatch(/metric_type=total_value/);
      expect(accountCall).toMatch(/period=day/);

      expect(result.success).toBe(true);
      expect(result.metrics.reach).toBe(1200);
      expect(result.metrics.views).toBe(3400);
      expect(result.metrics.followers).toBe(560);
      expect(result.metrics.engagements).toBe(10);
      // Instagram no longer reports impressions: unknown, not zero.
      expect(result.metrics.impressions).toBeNull();
    });
  });

  describe('media / Reels insights use current metric names', () => {
    it('syncPosts asks for views/reach/shares/saved/total_interactions, not impressions or engagement', async () => {
      routeGraph({
        mediaList: () =>
          mockResponse({
            data: [
              {
                id: 'r1',
                media_type: 'VIDEO',
                like_count: 4,
                comments_count: 2,
                insights: {
                  data: [
                    { name: 'views', values: [{ value: 900 }] },
                    { name: 'reach', values: [{ value: 700 }] },
                    { name: 'shares', values: [{ value: 5 }] },
                  ],
                },
              },
            ],
          }),
      });

      const result = await service.syncPosts(10);

      const expansion = requestedMetricLists().join(',');
      expect(expansion).not.toMatch(/\bimpressions\b/);
      expect(expansion).not.toMatch(/\bengagement\b/);
      for (const metric of [
        'views',
        'reach',
        'shares',
        'saved',
        'total_interactions',
      ]) {
        expect(expansion.split(',')).toContain(metric);
      }

      expect(result.success).toBe(true);
      expect(result.posts[0].metrics.reach).toBe(700);
      expect(result.posts[0].metrics.shares).toBe(5);
      // Not returned by Meta for this media: unknown, not zero.
      expect(result.posts[0].metrics.impressions).toBeUndefined();
    });

    it('getPostMetrics asks for current names and reports absent metrics as unknown, not zero', async () => {
      routeGraph({
        mediaItem: () =>
          mockResponse({
            like_count: 11,
            comments_count: 1,
            insights: {
              data: [
                { name: 'views', values: [{ value: 2500 }] },
                { name: 'reach', values: [{ value: 1800 }] },
                { name: 'saved', values: [{ value: 9 }] },
              ],
            },
          }),
      });

      const metrics = await service.getPostMetrics('media-1');

      const expansion = requestedMetricLists().join(',');
      expect(expansion).not.toMatch(/\bimpressions\b/);
      expect(expansion).not.toMatch(/\bengagement\b/);
      expect(expansion.split(',')).toEqual(
        expect.arrayContaining([
          'views',
          'reach',
          'saved',
          'shares',
          'total_interactions',
        ])
      );

      expect(metrics).not.toBeNull();
      expect(metrics!.views).toBe(2500);
      expect(metrics!.reach).toBe(1800);
      expect(metrics!.saved).toBe(9);
      expect(metrics!.likes).toBe(11);
      expect(metrics!.impressions).toBeUndefined();
      expect(metrics!.shares).toBeUndefined();
    });
  });
});
