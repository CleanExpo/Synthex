/**
 * Behavioural coverage for /api/cron/follower-snapshot — the daily cron that
 * records follower-count history into `follower_snapshots` so the analytics
 * growth chart + follower-growth KPI can show REAL growth over time instead of
 * today's proxy.
 *
 * Locks: a snapshot row is written from PlatformConnection.metadata.followers for
 * each active connection that has a usable count; connections with no/invalid
 * follower count are skipped (never a phantom 0); per-connection errors are
 * isolated; an unauthorised caller never touches the DB.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

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
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/follower-snapshot/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/follower-snapshot',
  });
}

function conn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    userId: 'u1',
    organizationId: 'org-1',
    platform: 'instagram',
    metadata: { followers: 1200 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.platformConnection.findMany.mockResolvedValue([]);
  mockPrisma.followerSnapshot.create.mockResolvedValue({});
});

describe('GET /api/cron/follower-snapshot', () => {
  it('returns 401 and never queries connections for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockPrisma.platformConnection.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.followerSnapshot.create).not.toHaveBeenCalled();
  });

  it('only queries active, non-deleted connections (bounded)', async () => {
    await GET(req());

    const arg = mockPrisma.platformConnection.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ isActive: true, deletedAt: null });
    expect(typeof arg.take).toBe('number');
    expect(arg.take).toBeGreaterThan(0);
  });

  it('records a snapshot from metadata.followers for an active connection', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([conn()]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recorded).toBe(1);
    expect(body.skipped).toBe(0);

    expect(mockPrisma.followerSnapshot.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.followerSnapshot.create).toHaveBeenCalledWith({
      data: {
        connectionId: 'conn-1',
        userId: 'u1',
        organizationId: 'org-1',
        platform: 'instagram',
        followers: 1200,
      },
    });
  });

  it('preserves a NULL organizationId for personal connections', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      conn({ id: 'conn-personal', organizationId: null }),
    ]);

    await GET(req());

    expect(mockPrisma.followerSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: null }),
      })
    );
  });

  it('skips connections with no/invalid follower count — never writes a phantom 0', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      conn({ id: 'no-meta', metadata: null }),
      conn({ id: 'no-field', metadata: { handle: 'acme' } }),
      conn({ id: 'not-number', metadata: { followers: 'lots' } }),
      conn({ id: 'negative', metadata: { followers: -5 } }),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recorded).toBe(0);
    expect(body.skipped).toBe(4);
    expect(mockPrisma.followerSnapshot.create).not.toHaveBeenCalled();
  });

  it('isolates a single failing insert — the rest of the batch still persists', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      conn({ id: 'conn-bad' }),
      conn({ id: 'conn-good', metadata: { followers: 50 } }),
    ]);
    mockPrisma.followerSnapshot.create
      .mockRejectedValueOnce(new Error('db timeout'))
      .mockResolvedValueOnce({});

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recorded).toBe(1);
    expect(body.errors).toBe(1);
    expect(mockPrisma.followerSnapshot.create).toHaveBeenCalledTimes(2);
  });
});
