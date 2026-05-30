/**
 * Behavioral coverage for /api/cron/google-token-refresh.
 * Proves the cron that keeps Google data-platform tokens alive: it blocks
 * unauthorised callers, refreshes connections that have a refresh token, and
 * disables + notifies connections that can't self-heal (no refresh token).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformConnection: { findMany: jest.fn(), update: jest.fn() },
  notification: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetOAuthAccessToken = jest.fn();
jest.mock('@/lib/google/google-auth', () => ({
  getOAuthAccessToken: (...args: unknown[]) => mockGetOAuthAccessToken(...args),
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/google-token-refresh/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/google-token-refresh' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.platformConnection.findMany.mockResolvedValue([]);
  mockPrisma.platformConnection.update.mockResolvedValue({});
  mockPrisma.notification.create.mockResolvedValue({});
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
});

describe('GET /api/cron/google-token-refresh', () => {
  it('returns 401 and never touches the DB for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.platformConnection.findMany).not.toHaveBeenCalled();
  });

  it('refreshes each connection that has a refresh token', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      { id: 'c1', userId: 'u1', platform: 'googleanalytics', profileName: 'GA', refreshToken: 'enc' },
      { id: 'c2', userId: 'u1', platform: 'searchconsole', profileName: 'GSC', refreshToken: 'enc' },
    ]);
    mockGetOAuthAccessToken.mockResolvedValue('fresh-token');

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetOAuthAccessToken).toHaveBeenCalledTimes(2);
    expect(body.refreshed).toBe(2);
    expect(body.reauthRequired).toBe(0);
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });

  it('disables and notifies a connection with no refresh token (cannot self-heal)', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      { id: 'c3', userId: 'u9', platform: 'googledrive', profileName: null, refreshToken: null },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetOAuthAccessToken).not.toHaveBeenCalled();
    expect(body.reauthRequired).toBe(1);
    const updateArg = mockPrisma.platformConnection.update.mock.calls[0][0];
    expect(updateArg.where.id).toBe('c3');
    expect(updateArg.data.isActive).toBe(false);
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('leaves a connection active on a transient refresh failure', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      { id: 'c4', userId: 'u1', platform: 'googlebusiness', profileName: 'GBP', refreshToken: 'enc' },
    ]);
    mockGetOAuthAccessToken.mockRejectedValue(new Error('Token refresh failed: 503'));

    const res = await GET(req());
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.reauthRequired).toBe(0);
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });
});
