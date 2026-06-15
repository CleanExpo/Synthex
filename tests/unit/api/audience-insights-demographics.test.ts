/**
 * Behavioural coverage for /api/audience/insights demographics aggregation.
 *
 * Locks: 401 for unauthenticated; org-scoped connection query; REAL demographics
 * read from PlatformConnection.metadata.demographics aggregated across the org's
 * connections; and an HONEST empty-state (dataAvailable:false) when no connection
 * exposes demographics.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformConnection: { findMany: jest.fn() },
  platformPost: { findMany: jest.fn() },
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

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/audience/insights/route';

function req(query = '') {
  return createMockNextRequest({
    url: `http://localhost/api/audience/insights${query}`,
  });
}

function igConnection(demographics?: unknown) {
  return {
    id: 'conn-ig',
    platform: 'instagram',
    profileName: 'acct',
    lastSync: new Date('2026-06-15T00:00:00Z'),
    metadata: { followers: 1000, ...(demographics ? { demographics } : {}) },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('u1');
  mockGetEffectiveOrg.mockResolvedValue('org-1');
  mockPrisma.platformPost.findMany.mockResolvedValue([]);
  mockPrisma.followerSnapshot.findMany.mockResolvedValue([]);
});

describe('GET /api/audience/insights — demographics', () => {
  it('returns 401 when unauthenticated and never queries connections', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.platformConnection.findMany).not.toHaveBeenCalled();
  });

  it('queries connections scoped to the effective organisation', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([igConnection()]);
    await GET(req());
    const where = mockPrisma.platformConnection.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.organizationId).toBe('org-1');
    expect(where.isActive).toBe(true);
  });

  it('aggregates REAL demographics from connection metadata', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      igConnection({
        ageRanges: [{ range: '25-34', percentage: 100, count: 1000 }],
        genderSplit: [{ gender: 'Female', percentage: 100, count: 1000 }],
        topLocations: [
          { location: 'Australia', country: 'AU', percentage: 100, count: 1000 },
        ],
        syncedAt: '2026-06-15T00:00:00Z',
      }),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.demographics.dataAvailable).toBe(true);
    expect(body.data.demographics.ageRanges[0].range).toBe('25-34');
    expect(body.data.demographics.genderSplit[0].gender).toBe('Female');
    expect(body.data.demographics.topLocations[0].country).toBe('AU');
  });

  it('returns honest empty-state when no connection exposes demographics', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([igConnection()]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.demographics.dataAvailable).toBe(false);
    expect(body.data.demographics.ageRanges).toEqual([]);
    expect(body.data.demographics.genderSplit).toEqual([]);
    expect(body.data.demographics.topLocations).toEqual([]);
  });

  it('returns empty demographics when no connections at all', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([]);
    const res = await GET(req());
    const body = await res.json();
    expect(body.data.demographics.dataAvailable).toBe(false);
  });
});

describe('GET /api/audience/insights — follower growth (page contract)', () => {
  it('builds a real {followers,gained,lost} trend from FollowerSnapshot history, org-scoped', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([igConnection()]);
    // Two snapshot days for one connection: 1000 -> 1100 (a real +100 gain).
    mockPrisma.followerSnapshot.findMany.mockResolvedValue([
      {
        connectionId: 'conn-ig',
        followers: 1000,
        capturedAt: new Date('2026-06-01T00:00:00Z'),
      },
      {
        connectionId: 'conn-ig',
        followers: 1100,
        capturedAt: new Date('2026-06-02T00:00:00Z'),
      },
    ]);

    const res = await GET(req('?platform=instagram'));
    const body = await res.json();

    expect(res.status).toBe(200);

    // Snapshot query is org-scoped (organizationId, not just userId) and
    // platform-filtered to the requested platform.
    const snapWhere =
      mockPrisma.followerSnapshot.findMany.mock.calls[0][0].where;
    expect(snapWhere.organizationId).toBe('org-1');
    expect(snapWhere.userId).toBeUndefined();
    expect(snapWhere.platform).toBe('instagram');

    // The trend matches the shape the audience page plots/tooltips:
    // each point has followers + gained + lost (the old route emitted none of these).
    const trend = body.data.growth.trend;
    expect(trend).toHaveLength(2);
    expect(trend[1]).toMatchObject({ followers: 1100, gained: 100, lost: 0 });

    // Real earliest-vs-latest delta drives the Growth KPI card.
    expect(body.data.growth.current).toBe(1100);
    expect(body.data.growth.previous).toBe(1000);
    expect(body.data.growth.change).toBe(100);
    expect(body.data.growth.changePercent).toBe(10);
  });

  it('shows honest "collecting data" (change 0) with fewer than two snapshot days', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([igConnection()]);
    mockPrisma.followerSnapshot.findMany.mockResolvedValue([]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.growth.trend).toEqual([]);
    expect(body.data.growth.change).toBe(0);
    expect(body.data.growth.changePercent).toBe(0);
    // Falls back to the live snapshot total (1000 followers) so the KPI isn't blank.
    expect(body.data.growth.current).toBe(1000);
  });
});
