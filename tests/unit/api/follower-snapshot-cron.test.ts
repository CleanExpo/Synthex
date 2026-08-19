/**
 * /api/cron/follower-snapshot — live-fetch fallback (SYN-1097).
 *
 * The cron read PlatformConnection.metadata.followers, which nothing upstream
 * populated, so it recorded zero snapshots ever. The fix fetches the count live
 * when metadata is absent. These tests pin the wiring:
 *   - metadata.followers present  → recorded, no live fetch
 *   - metadata absent, live count → recorded from the live fetch
 *   - metadata absent, live null  → skipped (never a phantom 0)
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { NextResponse } from 'next/server';

const mockPrisma = {
  platformConnection: { findMany: jest.fn() },
  followerSnapshot: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...a: unknown[]) => mockVerifyCron(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFetchLive = jest.fn();
jest.mock('@/lib/analytics/fetch-follower-count', () => ({
  fetchLiveFollowerCount: (...a: unknown[]) => mockFetchLive(...a),
}));

import { GET } from '@/app/api/cron/follower-snapshot/route';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/follower-snapshot',
  });
}

function conn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    userId: 'u1',
    organizationId: 'o1',
    platform: 'twitter',
    metadata: null,
    accessToken: 'enc',
    refreshToken: null,
    expiresAt: null,
    profileId: 'p1',
    profileName: 'acme',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.followerSnapshot.create.mockResolvedValue({});
});

describe('GET /api/cron/follower-snapshot', () => {
  it('401s and touches nothing for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.platformConnection.findMany).not.toHaveBeenCalled();
    expect(mockFetchLive).not.toHaveBeenCalled();
  });

  it('uses metadata.followers when present and does NOT live-fetch', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      conn({ metadata: { followers: 4200 } }),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(mockFetchLive).not.toHaveBeenCalled();
    expect(mockPrisma.followerSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ connectionId: 'c1', followers: 4200 }),
      })
    );
    expect(body.recorded).toBe(1);
  });

  it('live-fetches and records when metadata.followers is absent', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([conn()]);
    mockFetchLive.mockResolvedValue(1337);

    const res = await GET(req());
    const body = await res.json();

    expect(mockFetchLive).toHaveBeenCalledTimes(1);
    expect(mockPrisma.followerSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ connectionId: 'c1', followers: 1337 }),
      })
    );
    expect(body.recorded).toBe(1);
    expect(body.liveFetches).toBe(1);
  });

  it('skips (never phantom 0) when both metadata and live fetch yield nothing', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([conn()]);
    mockFetchLive.mockResolvedValue(null);

    const res = await GET(req());
    const body = await res.json();

    expect(mockFetchLive).toHaveBeenCalledTimes(1);
    expect(mockPrisma.followerSnapshot.create).not.toHaveBeenCalled();
    expect(body.recorded).toBe(0);
    expect(body.skipped).toBe(1);
  });
});
