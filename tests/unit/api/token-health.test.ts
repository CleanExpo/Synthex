/**
 * Behavioral coverage for /api/cron/token-health.
 * The monitor reports active-but-expired connections and alerts the owner(s).
 * Proves: auth gate, clean state (no alert), and the broken-state owner digest.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformConnection: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { createMany: jest.fn() },
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

import { GET } from '@/app/api/cron/token-health/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/token-health' });
}

const ORIGINAL_OWNER_EMAILS = process.env.OWNER_EMAILS;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OWNER_EMAILS = 'owner@example.com';
  mockPrisma.platformConnection.findMany.mockResolvedValue([]);
  mockPrisma.user.findMany.mockResolvedValue([{ id: 'owner-1' }]);
  mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
});

afterAll(() => {
  process.env.OWNER_EMAILS = ORIGINAL_OWNER_EMAILS;
});

describe('GET /api/cron/token-health', () => {
  it('returns 401 and never touches the DB for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.platformConnection.findMany).not.toHaveBeenCalled();
  });

  it('reports zero and sends no alert when nothing is expired', async () => {
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.expiredActive).toBe(0);
    expect(body.alerted).toBe(0);
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('counts expired-active connections by platform and alerts the owner', async () => {
    // First findMany = expired; second = expiringSoon (defaults to [] from beforeEach).
    mockPrisma.platformConnection.findMany.mockResolvedValueOnce([
      { platform: 'linkedin', profileName: 'P', userId: 'u1', expiresAt: new Date(0) },
      { platform: 'linkedin', profileName: 'P', userId: 'u1', expiresAt: new Date(0) },
      { platform: 'googleanalytics', profileName: 'GA', userId: 'u1', expiresAt: new Date(0) },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.expiredActive).toBe(3);
    expect(body.expiringSoonNoRefresh).toBe(0);
    expect(body.byPlatform).toEqual({ linkedin: 2, googleanalytics: 1 });
    expect(body.alerted).toBe(1);
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
    const created = mockPrisma.notification.createMany.mock.calls[0][0].data;
    expect(created[0].userId).toBe('owner-1');
  });

  it('proactively alerts on a no-refresh connection expiring soon (before it breaks)', async () => {
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mockPrisma.platformConnection.findMany
      .mockResolvedValueOnce([]) // nothing expired yet
      .mockResolvedValueOnce([
        { platform: 'linkedin', profileName: 'Phillip McGurk', userId: 'u1', expiresAt: inThreeDays },
      ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.expiredActive).toBe(0);
    expect(body.expiringSoonNoRefresh).toBe(1);
    expect(body.alerted).toBe(1);
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
  });
});
