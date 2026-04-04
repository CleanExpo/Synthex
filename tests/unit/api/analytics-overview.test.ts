/**
 * Unit tests for app/api/analytics/route.ts
 * GET /api/analytics
 *
 * Tests: auth guard, org-scope guard, query param validation,
 * cache hit/miss, happy-path data aggregation.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Mocks (must be declared before imports) ──────────────────────────────────

const mockGetUserId = jest.fn();
const mockGetEffectiveQueryFilter = jest.fn();
const mockGetEffectiveOrgId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveQueryFilter: (...args: unknown[]) =>
    mockGetEffectiveQueryFilter(...args),
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrgId(...args),
}));

// Prisma mock
const mockCampaignFindMany = jest.fn();
const mockPostFindMany = jest.fn();
const mockApiUsageFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    campaign: {
      findMany: (...args: unknown[]) => mockCampaignFindMany(...args),
    },
    post: { findMany: (...args: unknown[]) => mockPostFindMany(...args) },
    apiUsage: {
      findMany: (...args: unknown[]) => mockApiUsageFindMany(...args),
    },
  },
}));

// Redis mock — default: cache miss
const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');

jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// Import route handler after mocks are wired
import { GET } from '@/app/api/analytics/route';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const ORG_FILTER = { organizationId: 'org-123' };

function makeRequest(
  params: Record<string, string> = {}
): ReturnType<typeof createMockNextRequest> {
  const qs = new URLSearchParams(params).toString();
  const url = `http://localhost/api/analytics${qs ? '?' + qs : ''}`;
  return createMockNextRequest({ url });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated, has org context
    mockGetUserId.mockResolvedValue(USER_ID);
    mockGetEffectiveQueryFilter.mockResolvedValue(ORG_FILTER);
    mockGetEffectiveOrgId.mockResolvedValue('org-123');

    // Default: no campaigns, no posts, no API usage
    mockCampaignFindMany.mockResolvedValue([]);
    mockPostFindMany.mockResolvedValue([]);
    mockApiUsageFindMany.mockResolvedValue([]);
  });

  // ── Auth guard ──────────────────────────────────────────────────────────
  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetUserId.mockResolvedValue(null);

      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toMatch(/Unauthorized/i);
    });
  });

  // ── Org-scope guard ─────────────────────────────────────────────────────
  describe('organisation scoping', () => {
    it('returns 403 when no org context is found', async () => {
      mockGetEffectiveQueryFilter.mockResolvedValue({});

      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toMatch(/organisation/i);
    });
  });

  // ── Query validation ─────────────────────────────────────────────────────
  describe('query validation', () => {
    it('returns 400 for an invalid timeRange value', async () => {
      const res = await GET(makeRequest({ timeRange: 'invalid' }) as never);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/Validation/i);
    });

    it('accepts valid timeRange values', async () => {
      for (const tr of ['7d', '30d', '90d', '12m', 'all']) {
        jest.clearAllMocks();
        mockGetUserId.mockResolvedValue(USER_ID);
        mockGetEffectiveQueryFilter.mockResolvedValue(ORG_FILTER);
        mockGetEffectiveOrgId.mockResolvedValue('org-123');
        mockCampaignFindMany.mockResolvedValue([]);
        mockPostFindMany.mockResolvedValue([]);
        mockApiUsageFindMany.mockResolvedValue([]);

        const res = await GET(makeRequest({ timeRange: tr }) as never);
        expect(res.status).toBe(200);
      }
    });
  });

  // ── Cache hit ────────────────────────────────────────────────────────────
  describe('Redis cache', () => {
    it('returns cached data when cache hit occurs', async () => {
      const cachedPayload = {
        data: {
          totals: {
            posts: 5,
            published: 3,
            scheduled: 1,
            draft: 1,
            reach: 100,
            engagement: 10,
            impressions: 50,
            clicks: 5,
            engagementRate: 20,
          },
          platformBreakdown: {},
          chartData: [],
          recentActivity: [],
          timeRange: '30d',
        },
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedPayload));

      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(200);
      // Prisma should NOT be called on cache hit
      expect(mockCampaignFindMany).not.toHaveBeenCalled();
      // generatedAt is re-injected at serve-time
      expect(body.data.generatedAt).toBeDefined();
    });

    it('falls through to DB when Redis throws', async () => {
      mockRedisGet.mockRejectedValueOnce(new Error('Redis down'));

      const res = await GET(makeRequest() as never);

      expect(res.status).toBe(200);
      expect(mockCampaignFindMany).toHaveBeenCalled();
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────────
  describe('happy path', () => {
    it('returns 200 with totals for empty campaign list', async () => {
      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toBeDefined();
      expect(body.data.totals.posts).toBe(0);
      expect(body.data.timeRange).toBe('30d');
    });

    it('aggregates post counts from campaigns', async () => {
      mockCampaignFindMany.mockResolvedValue([
        { id: 'camp-1' },
        { id: 'camp-2' },
      ]);

      const now = new Date();
      mockPostFindMany.mockResolvedValue([
        {
          id: 'p1',
          platform: 'twitter',
          status: 'published',
          analytics: {
            reach: 100,
            engagement: 10,
            impressions: 500,
            clicks: 20,
          },
          publishedAt: now,
          createdAt: now,
        },
        {
          id: 'p2',
          platform: 'instagram',
          status: 'scheduled',
          analytics: null,
          publishedAt: null,
          createdAt: now,
        },
        {
          id: 'p3',
          platform: 'twitter',
          status: 'draft',
          analytics: {},
          publishedAt: null,
          createdAt: now,
        },
      ]);

      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.totals.posts).toBe(3);
      expect(body.data.totals.published).toBe(1);
      expect(body.data.totals.scheduled).toBe(1);
      expect(body.data.totals.draft).toBe(1);
      expect(body.data.totals.reach).toBe(100);
      expect(body.data.totals.engagement).toBe(10);
    });

    it('builds platform breakdown correctly', async () => {
      mockCampaignFindMany.mockResolvedValue([{ id: 'c1' }]);

      const now = new Date();
      mockPostFindMany.mockResolvedValue([
        {
          id: 'p1',
          platform: 'twitter',
          status: 'published',
          analytics: null,
          publishedAt: now,
          createdAt: now,
        },
        {
          id: 'p2',
          platform: 'twitter',
          status: 'draft',
          analytics: null,
          publishedAt: null,
          createdAt: now,
        },
        {
          id: 'p3',
          platform: 'instagram',
          status: 'published',
          analytics: null,
          publishedAt: now,
          createdAt: now,
        },
      ]);

      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(body.data.platformBreakdown.twitter.posts).toBe(2);
      expect(body.data.platformBreakdown.twitter.published).toBe(1);
      expect(body.data.platformBreakdown.instagram.posts).toBe(1);
    });

    it('filters by platform query param when provided', async () => {
      mockCampaignFindMany.mockResolvedValue([{ id: 'c1' }]);
      mockPostFindMany.mockResolvedValue([]);

      await GET(makeRequest({ platform: 'twitter' }) as never);

      const postWhere = mockPostFindMany.mock.calls[0][0].where;
      expect(postWhere.platform).toBe('twitter');
    });

    it('includes generatedAt in response', async () => {
      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(body.data.generatedAt).toBeDefined();
      expect(new Date(body.data.generatedAt).getTime()).toBeGreaterThan(0);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────
  describe('error handling', () => {
    it('returns 500 when Prisma throws', async () => {
      mockCampaignFindMany.mockRejectedValue(new Error('DB error'));

      const res = await GET(makeRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toMatch(/Internal Server Error/i);
    });
  });
});
