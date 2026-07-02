/**
 * Behavioural coverage for /api/analytics/follower-growth — the read API that
 * turns FollowerSnapshot history into a real follower time-series + growth delta
 * for the analytics growth chart / KPI.
 *
 * Locks: 401 for unauthenticated; org-scoped query + cache key (SYN-908);
 * a real earliest-vs-latest delta computed from snapshots; and an HONEST
 * empty/insufficient state (hasEnoughData=false) when <2 snapshot days exist.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  followerSnapshot: { findMany: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrg(...args),
}));

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
jest.mock('@/lib/cache/cache-manager', () => ({
  getCache: () => ({ get: mockCacheGet, set: mockCacheSet }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/analytics/follower-growth/route';

function req(query = '') {
  return createMockNextRequest({
    url: `http://localhost/api/analytics/follower-growth${query}`,
  });
}

/** A snapshot row as selected by the route. */
function row(connectionId: string, followers: number, isoDate: string) {
  return { connectionId, followers, capturedAt: new Date(isoDate) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('u1');
  mockGetEffectiveOrg.mockResolvedValue('org-1');
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(undefined);
  mockPrisma.followerSnapshot.findMany.mockResolvedValue([]);
});

describe('GET /api/analytics/follower-growth', () => {
  it('returns 401 when unauthenticated and never queries snapshots', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockPrisma.followerSnapshot.findMany).not.toHaveBeenCalled();
  });

  it('org-scopes the query by effective org and keys the cache by org', async () => {
    await GET(req('?period=30d'));

    const where = mockPrisma.followerSnapshot.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.userId).toBeUndefined();

    // cache key + tags are org-scoped (SYN-908)
    const cacheKey = mockCacheGet.mock.calls[0][0] as string;
    expect(cacheKey).toContain(':org-1:');
    const setOpts = mockCacheSet.mock.calls[0][2];
    expect(setOpts.tags).toEqual(
      expect.arrayContaining(['user:u1', 'org:org-1'])
    );
  });

  it('falls back to user-scoping when the user has no org context', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);

    await GET(req());

    const where = mockPrisma.followerSnapshot.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.organizationId).toBeUndefined();
    expect(mockCacheGet.mock.calls[0][0]).toContain(':self:');
  });

  it('computes a REAL earliest-vs-latest delta from snapshot history', async () => {
    // Two connections, two days. Day 1 total = 1000; Day 2 total = 1200.
    mockPrisma.followerSnapshot.findMany.mockResolvedValue([
      row('c1', 600, '2026-06-01T01:00:00.000Z'),
      row('c2', 400, '2026-06-01T01:00:00.000Z'),
      row('c1', 700, '2026-06-05T01:00:00.000Z'),
      row('c2', 500, '2026-06-05T01:00:00.000Z'),
    ]);

    const res = await GET(req('?period=30d'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasEnoughData).toBe(true);
    expect(body.series).toHaveLength(2);
    expect(body.series[0]).toEqual({ date: '2026-06-01', followers: 1000 });
    expect(body.series[1]).toEqual({ date: '2026-06-05', followers: 1200 });
    expect(body.growth).toEqual({
      previous: 1000,
      current: 1200,
      change: 200,
      changePercent: 20,
    });
  });

  it('is honest about insufficient history — one snapshot day => collecting state', async () => {
    mockPrisma.followerSnapshot.findMany.mockResolvedValue([
      row('c1', 800, '2026-06-05T01:00:00.000Z'),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasEnoughData).toBe(false);
    expect(body.series).toHaveLength(1);
    // no misleading delta when we cannot compute one
    expect(body.growth).toEqual({
      current: 0,
      previous: 0,
      change: 0,
      changePercent: 0,
    });
  });

  it('returns an empty series (not a proxy) when no snapshots exist yet', async () => {
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.series).toEqual([]);
    expect(body.hasEnoughData).toBe(false);
    expect(body.pointCount).toBe(0);
  });

  it('serves a cached payload without re-querying the DB', async () => {
    mockCacheGet.mockResolvedValue({
      series: [],
      growth: { current: 0, previous: 0, change: 0, changePercent: 0 },
      hasEnoughData: false,
      pointCount: 0,
    });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(mockPrisma.followerSnapshot.findMany).not.toHaveBeenCalled();
  });
});
