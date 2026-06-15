/**
 * Unit tests for the dashboard "stats truth" fix:
 *   - GET /api/analytics/dashboard-stats
 *   - GET /api/dashboard/stats
 *
 * Proves the four verified root-cause fixes:
 *   1. Contract: /api/analytics/dashboard-stats returns `{ success: true, data }`
 *      so ContentStats no longer zeros-out real data.
 *   2. avgEngagement is computed from real post.analytics (engagement/impressions),
 *      not hardcoded to 0.
 *   3. Trending topics come from org-scoped prisma.trendInsight, not a phantom
 *      hardcoded hashtag array; empty when no insights exist.
 *   4. Server cache key + tags are org-scoped (`:${effectiveOrgId ?? 'self'}`
 *      / `org:${effectiveOrgId ?? 'self'}`), computed before the cache read.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Mocks (declared before route imports) ───────────────────────────────────

const mockGetUserId = jest.fn();
const mockGetEffectiveOrgId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrgId(...args),
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrgId(...args),
}));

// Prisma mock
const mockCampaignFindMany = jest.fn();
const mockCampaignCount = jest.fn();
const mockPostCount = jest.fn();
const mockPostFindMany = jest.fn();
const mockPlatformConnectionFindMany = jest.fn();
const mockPlatformMetricsAggregate = jest.fn();
const mockTrendInsightFindMany = jest.fn();

jest.mock('@/lib/prisma', () => {
  const prisma = {
    campaign: {
      findMany: (...a: unknown[]) => mockCampaignFindMany(...a),
      count: (...a: unknown[]) => mockCampaignCount(...a),
    },
    post: {
      count: (...a: unknown[]) => mockPostCount(...a),
      findMany: (...a: unknown[]) => mockPostFindMany(...a),
    },
    platformConnection: {
      findMany: (...a: unknown[]) => mockPlatformConnectionFindMany(...a),
    },
    platformMetrics: {
      aggregate: (...a: unknown[]) => mockPlatformMetricsAggregate(...a),
    },
    trendInsight: {
      findMany: (...a: unknown[]) => mockTrendInsightFindMany(...a),
    },
  };
  return { __esModule: true, prisma, default: prisma };
});

// Cache mock — default: miss; capture set() args for key/tag assertions
const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/cache/cache-manager', () => ({
  getCache: () => ({
    get: (...a: unknown[]) => mockCacheGet(...a),
    set: (...a: unknown[]) => mockCacheSet(...a),
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET as analyticsStatsGET } from '@/app/api/analytics/dashboard-stats/route';
import { GET as dashboardStatsGET } from '@/app/api/dashboard/stats/route';

const USER_ID = 'user-abc';
const ORG_ID = 'org-123';

function makeRequest(url: string) {
  return createMockNextRequest({ url });
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/analytics/dashboard-stats
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/analytics/dashboard-stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(USER_ID);
    mockGetEffectiveOrgId.mockResolvedValue(ORG_ID);
    mockCacheGet.mockResolvedValue(null);
    mockCampaignFindMany.mockResolvedValue([{ id: 'camp-1' }]);
    // total, published, scheduled, draft, today
    mockPostCount
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(8) // published
      .mockResolvedValueOnce(1) // scheduled
      .mockResolvedValueOnce(1) // draft
      .mockResolvedValueOnce(2); // today
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await analyticsStatsGET(
      makeRequest('http://localhost/api/analytics/dashboard-stats')
    );
    expect(res.status).toBe(401);
  });

  it('FIX 1 — wraps the payload as { success: true, data } so the client renders real data', async () => {
    mockPostFindMany.mockResolvedValue([]); // no analytics
    const res = await analyticsStatsGET(
      makeRequest('http://localhost/api/analytics/dashboard-stats')
    );
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Real data flows through the envelope (not zeroed-out by a contract break)
    expect(body.data.totalPosts).toBe(10);
    expect(body.data.publishedPosts).toBe(8);
    expect(body.data.successRate).toBe(80);
  });

  it('FIX 2 — avgEngagement is computed from real post.analytics, not 0', async () => {
    // engagement/impressions: (50+150) / (1000+1000) = 200/2000 = 10%
    mockPostFindMany.mockResolvedValue([
      { analytics: { engagement: 50, impressions: 1000 } },
      { analytics: { engagement: 150, impressions: 1000 } },
    ]);
    const res = await analyticsStatsGET(
      makeRequest('http://localhost/api/analytics/dashboard-stats')
    );
    const body = await res.json();

    expect(body.data.avgEngagement).toBeGreaterThan(0);
    expect(body.data.avgEngagement).toBeCloseTo(10, 5);
  });

  it('FIX 2 — avgEngagement is 0 when there is no impressions data (no fabrication)', async () => {
    mockPostFindMany.mockResolvedValue([
      { analytics: { engagement: 5, impressions: 0 } },
    ]);
    const res = await analyticsStatsGET(
      makeRequest('http://localhost/api/analytics/dashboard-stats')
    );
    const body = await res.json();
    expect(body.data.avgEngagement).toBe(0);
  });

  it('FIX 4 — cache key and tags are org-scoped and computed before the read', async () => {
    mockPostFindMany.mockResolvedValue([]);
    await analyticsStatsGET(
      makeRequest('http://localhost/api/analytics/dashboard-stats')
    );

    // org resolved before the cache GET
    const getKey = mockCacheGet.mock.calls[0][0];
    expect(getKey).toBe(`analytics:dashboard-stats:${USER_ID}:${ORG_ID}`);

    // set() uses the same org-scoped key + both tags
    const [setKey, , setOpts] = mockCacheSet.mock.calls[0];
    expect(setKey).toBe(`analytics:dashboard-stats:${USER_ID}:${ORG_ID}`);
    expect(setOpts.tags).toEqual([`user:${USER_ID}`, `org:${ORG_ID}`]);
  });

  it("FIX 4 — falls back to ':self' scope when no org is resolved", async () => {
    mockGetEffectiveOrgId.mockResolvedValue(null);
    mockPostFindMany.mockResolvedValue([]);
    await analyticsStatsGET(
      makeRequest('http://localhost/api/analytics/dashboard-stats')
    );

    const getKey = mockCacheGet.mock.calls[0][0];
    expect(getKey).toBe(`analytics:dashboard-stats:${USER_ID}:self`);
    const [, , setOpts] = mockCacheSet.mock.calls[0];
    expect(setOpts.tags).toEqual([`user:${USER_ID}`, `org:self`]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/dashboard/stats
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/dashboard/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(USER_ID);
    mockGetEffectiveOrgId.mockResolvedValue(ORG_ID);
    mockCacheGet.mockResolvedValue(null);
    // total, scheduled counts
    mockPostCount.mockResolvedValue(0);
    mockPostFindMany.mockResolvedValue([]); // publishedPosts + recentPosts
    mockPlatformConnectionFindMany.mockResolvedValue([]);
    mockPlatformMetricsAggregate.mockResolvedValue({ _sum: { reach: 0 } });
    mockCampaignCount.mockResolvedValue(0);
    mockTrendInsightFindMany.mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await dashboardStatsGET(
      makeRequest('http://localhost/api/dashboard/stats')
    );
    expect(res.status).toBe(401);
  });

  it('FIX 3 — trending topics come from org-scoped prisma.trendInsight', async () => {
    mockTrendInsightFindMany.mockResolvedValue([
      { category: 'hashtag', insight: 'use #x' },
      { category: 'topic', insight: 'talk about y' },
    ]);
    const res = await dashboardStatsGET(
      makeRequest('http://localhost/api/dashboard/stats')
    );
    const body = await res.json();

    // queried with org scope, highest confidence first
    expect(mockTrendInsightFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID },
        orderBy: { confidence: 'desc' },
      })
    );
    // topics derived from the real insight categories — NOT the old phantom list
    expect(body.trendingTopics).toEqual(['#hashtag', '#topic']);
    expect(body.trendingTopics).not.toContain('#SocialMedia');
    expect(body.trendingTopics).not.toContain('#Automation');
  });

  it('FIX 3 — trending topics fall back to empty (not phantom) when no insights exist', async () => {
    mockTrendInsightFindMany.mockResolvedValue([]);
    const res = await dashboardStatsGET(
      makeRequest('http://localhost/api/dashboard/stats')
    );
    const body = await res.json();
    expect(body.trendingTopics).toEqual([]);
  });

  it('FIX 4 — cache key and tags are org-scoped and computed before the read', async () => {
    await dashboardStatsGET(
      makeRequest('http://localhost/api/dashboard/stats')
    );

    const getKey = mockCacheGet.mock.calls[0][0];
    expect(getKey).toBe(`dashboard:stats:${USER_ID}:${ORG_ID}`);

    const [setKey, , setOpts] = mockCacheSet.mock.calls[0];
    expect(setKey).toBe(`dashboard:stats:${USER_ID}:${ORG_ID}`);
    expect(setOpts.tags).toEqual([`user:${USER_ID}`, `org:${ORG_ID}`]);
  });

  it("FIX 4 — falls back to ':self' scope when no org is resolved", async () => {
    mockGetEffectiveOrgId.mockResolvedValue(null);
    await dashboardStatsGET(
      makeRequest('http://localhost/api/dashboard/stats')
    );

    const getKey = mockCacheGet.mock.calls[0][0];
    expect(getKey).toBe(`dashboard:stats:${USER_ID}:self`);
    const [, , setOpts] = mockCacheSet.mock.calls[0];
    expect(setOpts.tags).toEqual([`user:${USER_ID}`, `org:self`]);
  });

  it('engagement reflects real post.analytics in the summary stats', async () => {
    mockPostFindMany
      // publishedPosts (with analytics)
      .mockResolvedValueOnce([
        {
          platform: 'Twitter',
          analytics: { engagement: 30, impressions: 300 },
          createdAt: new Date(),
        },
      ])
      // recentPostsData
      .mockResolvedValueOnce([]);
    const res = await dashboardStatsGET(
      makeRequest('http://localhost/api/dashboard/stats')
    );
    const body = await res.json();
    expect(body.stats.totalEngagement).toBe(30);
    expect(body.stats.totalImpressions).toBe(300);
  });
});
