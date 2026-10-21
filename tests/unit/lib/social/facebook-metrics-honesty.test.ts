/**
 * Facebook metrics honesty.
 *
 * Meta retired `page_impressions` and `post_impressions` on 15 November 2025,
 * `post_impressions_unique` on 15 June 2025 and `post_engaged_users` on
 * 14 March 2024. Asking for any retired name fails the whole insights request
 * with an invalid-metric error. The service still asked for them, and its
 * failure paths returned zeros, so a failed read looked like a real zero.
 * Synthex rule: a failed read never looks like success.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { FacebookService } from '@/lib/social/facebook-service';
import type { PlatformCredentials } from '@/lib/social/base-platform-service';

/** Retired Page/post insight names (Meta deprecated-metrics page, 21/10/2026). */
const RETIRED_METRIC =
  /^(page_impressions|post_impressions|page_posts_impressions|post_engaged_users|page_engaged_users|page_fans)/;

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

/** Every requested metric name; a retired one makes Meta fail the call. */
function requestedMetrics(): string[] {
  return mockFetch.mock.calls.flatMap(call => {
    const decoded = decodeURIComponent(String(call[0]));
    const lists: string[] = [];
    const query = decoded.match(/[?&]metric=([^&]+)/);
    if (query) lists.push(query[1]);
    const expansion = decoded.match(/insights\.metric\(([^)]+)\)/);
    if (expansion) lists.push(expansion[1]);
    return lists.flatMap(list => list.split(','));
  });
}

/** Behave like Graph: any retired metric name fails the insights call. */
function rejectsRetired(url: string, ok: () => Response): Response {
  const decoded = decodeURIComponent(url);
  const names = [
    ...(decoded.match(/[?&]metric=([^&]+)/)?.[1].split(',') ?? []),
    ...(decoded.match(/insights\.metric\(([^)]+)\)/)?.[1].split(',') ?? []),
  ];
  const retired = names.find(n => RETIRED_METRIC.test(n));
  return retired
    ? metaError(`(#100) The value must be a valid insights metric: ${retired}`)
    : ok();
}

function routeGraph(routes: {
  profile?: () => Response;
  pageInsights?: () => Response;
  post?: () => Response;
}) {
  mockFetch.mockImplementation(async input => {
    const url = String(input);
    if (url.includes('/me/accounts')) {
      return mockResponse({
        data: [{ id: 'page-1', name: 'Page', access_token: 'page-token' }],
      });
    }
    if (url.includes('/page-1/insights')) {
      return rejectsRetired(
        url,
        routes.pageInsights ?? (() => metaError('no route'))
      );
    }
    if (url.includes('/page-1?')) {
      return (routes.profile ?? (() => metaError('no route')))();
    }
    if (url.includes('/post-1?')) {
      return rejectsRetired(url, routes.post ?? (() => metaError('no route')));
    }
    return metaError(`unexpected url ${url}`);
  });
}

describe('FacebookService metrics honesty', () => {
  let service: FacebookService;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
    service = new FacebookService();
    service.initialize(credentials());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('never requests a retired insight metric', async () => {
    routeGraph({
      profile: () => mockResponse({ fan_count: 10 }),
      pageInsights: () => mockResponse({ data: [] }),
      post: () => mockResponse({ id: 'post-1' }),
    });

    await service.syncAnalytics(30);
    await service.getPostMetrics('post-1');

    const metrics = requestedMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.filter(m => RETIRED_METRIC.test(m))).toEqual([]);
  });

  describe('syncAnalytics', () => {
    it('reads page views and engagements from current metrics', async () => {
      routeGraph({
        profile: () => mockResponse({ fan_count: 1200 }),
        pageInsights: () =>
          mockResponse({
            data: [
              {
                name: 'page_media_view',
                values: [{ value: 10 }, { value: 4500 }],
              },
              { name: 'page_post_engagements', values: [{ value: 320 }] },
            ],
          }),
      });

      const result = await service.syncAnalytics(30);

      expect(result.success).toBe(true);
      expect(result.metrics.views).toBe(4500);
      expect(result.metrics.engagements).toBe(320);
      expect(result.metrics.followers).toBe(1200);
      expect(result.metrics.impressions).toBeNull();
    });

    it('unconfigured service returns null metrics, not zeros', async () => {
      const unconfigured = new FacebookService();
      const result = await unconfigured.syncAnalytics(30);

      expect(result.success).toBe(false);
      expect(result.metrics.impressions).toBeNull();
      expect(result.metrics.engagements).toBeNull();
      expect(result.metrics.followers).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('a failed insights read leaves views and engagements null, keeps followers', async () => {
      routeGraph({
        profile: () => mockResponse({ fan_count: 1200 }),
        pageInsights: () => metaError('insights unavailable'),
      });

      const result = await service.syncAnalytics(30);

      expect(result.success).toBe(true);
      expect(result.metrics.views).toBeNull();
      expect(result.metrics.engagements).toBeNull();
      expect(result.metrics.followers).toBe(1200);
    });

    it('fails, with null metrics, when nothing could be read', async () => {
      routeGraph({
        profile: () => metaError('profile unavailable'),
        pageInsights: () => metaError('insights unavailable'),
      });

      const result = await service.syncAnalytics(30);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/could not be read/);
      expect(result.metrics.views).toBeNull();
      expect(result.metrics.engagements).toBeNull();
      expect(result.metrics.followers).toBeNull();
    });

    it('a missing Page returns null metrics, not zeros', async () => {
      mockFetch.mockResolvedValue(mockResponse({ data: [] }));

      const result = await service.syncAnalytics(30);

      expect(result.success).toBe(false);
      expect(result.metrics.impressions).toBeNull();
      expect(result.metrics.engagements).toBeNull();
      expect(result.metrics.followers).toBeNull();
    });
  });

  describe('getPostMetrics', () => {
    it('maps current post insights to views and reach', async () => {
      routeGraph({
        post: () =>
          mockResponse({
            id: 'post-1',
            likes: { summary: { total_count: 7 } },
            comments: { summary: { total_count: 2 } },
            shares: { count: 1 },
            insights: {
              data: [
                { name: 'post_media_view', values: [{ value: 900 }] },
                {
                  name: 'post_total_media_view_unique',
                  values: [{ value: 640 }],
                },
              ],
            },
          }),
      });

      const metrics = await service.getPostMetrics('post-1');

      expect(metrics).toEqual({
        likes: 7,
        comments: 2,
        shares: 1,
        views: 900,
        reach: 640,
      });
    });

    it('leaves views and reach undefined when Meta returns no insight', async () => {
      routeGraph({
        post: () =>
          mockResponse({
            id: 'post-1',
            likes: { summary: { total_count: 3 } },
          }),
      });

      const metrics = await service.getPostMetrics('post-1');

      expect(metrics?.likes).toBe(3);
      expect(metrics?.views).toBeUndefined();
      expect(metrics?.reach).toBeUndefined();
    });
  });
});
