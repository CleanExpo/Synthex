/**
 * Behavioural coverage for /api/auth/connections/status (SYN-994).
 *
 * Root cause this fixes: connections were scoped by `userId`, so a connection a
 * co-owner made (e.g. the second CEO account) showed as "not connected" to
 * everyone else on the same brand. Now it scopes by the access-checked
 * ORGANISATION — but must still fall back to userId for personal/no-org rows,
 * or querying organizationId:null alone would leak other users' rows.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = { platformConnection: { findMany: jest.fn() } };
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) => mockGetEffectiveOrg(...a),
}));

jest.mock('@/lib/oauth', () => ({
  getSupportedPlatforms: () => ['linkedin', 'googleanalytics', 'facebook'],
}));

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), info: jest.fn() } }));

import { GET } from '@/app/api/auth/connections/status/route';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/auth/connections/status' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-A');
  mockGetEffectiveOrg.mockResolvedValue('org-1');
  mockPrisma.platformConnection.findMany.mockResolvedValue([]);
});

describe('GET /api/auth/connections/status', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.platformConnection.findMany).not.toHaveBeenCalled();
  });

  it('scopes by ORGANISATION (not userId) so a co-owner connection counts', async () => {
    // GA4 connected by a DIFFERENT user, but same org → must still count.
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      { platform: 'googleanalytics' },
    ]);
    const res = await GET(req());
    const body = await res.json();

    const where = mockPrisma.platformConnection.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: 'org-1', isActive: true });
    expect(where.userId).toBeUndefined(); // NOT scoped to the logged-in user
    expect(body.platforms).toContain('googleanalytics');
    expect(body.connected).toBe(1);
  });

  it('de-dupes a platform connected by two owners in the same org', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      { platform: 'googleanalytics' },
      { platform: 'googleanalytics' },
    ]);
    const body = await (await GET(req())).json();
    expect(body.connected).toBe(1); // counted once, not twice
  });

  it('falls back to userId for personal/no-org connections (no cross-tenant leak)', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);
    await GET(req());
    const where = mockPrisma.platformConnection.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: 'user-A', organizationId: null, isActive: true });
  });
});
