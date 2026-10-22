/**
 * /api/cron/refresh-tokens — connections that can never refresh.
 *
 * A connection whose access token has already expired and which holds no
 * refresh token is dead: nothing this cron can do will bring it back, and the
 * owner must reconnect. It used to be skipped and left `isActive: true`, so the
 * dashboard and the publish path both treated a dead LinkedIn page connection as
 * live for months. It must now be marked `requires_reauth` exactly like a
 * permanent refresh failure. A token that has not yet expired still works and
 * is left alone.
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

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: jest.fn(),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (value: string | null) => value,
}));

const mockRefresh = jest.fn();
jest.mock('@/lib/social', () => ({
  isPlatformSupported: () => true,
  createPlatformService: () => ({ refreshToken: mockRefresh }),
}));

jest.mock('@/lib/platform-connections/refresh-lock', () => ({
  runLockedRefresh: ({ doRefresh }: { doRefresh: () => Promise<unknown> }) =>
    doRefresh(),
}));

import { GET } from '@/app/api/cron/refresh-tokens/route';

const HOUR = 60 * 60 * 1000;

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/refresh-tokens',
  });
}

function conn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    userId: 'user-1',
    platform: 'linkedin',
    accessToken: 'access',
    refreshToken: null,
    expiresAt: new Date(Date.now() - 24 * HOUR),
    profileName: 'CARSI',
    metadata: { tokenType: 'Bearer' },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true });
  mockPrisma.platformConnection.findMany.mockResolvedValue([]);
  mockPrisma.platformConnection.update.mockResolvedValue({});
  mockPrisma.notification.create.mockResolvedValue({});
});

describe('GET /api/cron/refresh-tokens — no refresh token', () => {
  it('marks an expired connection with no refresh token as requires_reauth and tells the owner', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([conn()]);

    const res = await GET(req());
    const body = await res.json();

    expect(mockPrisma.platformConnection.update).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.platformConnection.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'conn-1' });
    expect(arg.data.isActive).toBe(false);
    expect(arg.data.metadata).toMatchObject({
      tokenType: 'Bearer',
      authStatus: 'requires_reauth',
    });
    expect(typeof arg.data.metadata.authFailureReason).toBe('string');

    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      type: 'platform_reauth_required',
    });

    expect(body.permanentFailed).toBe(1);
    expect(body.skipped).toBe(0);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('leaves a connection that has not yet expired active, even without a refresh token', async () => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      conn({ expiresAt: new Date(Date.now() + 2 * HOUR) }),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    expect(body.skipped).toBe(1);
    expect(body.permanentFailed).toBe(0);
  });

  it('still refreshes an expired connection that does hold a refresh token', async () => {
    mockRefresh.mockResolvedValue({
      accessToken: 'new',
      expiresAt: new Date(Date.now() + 60 * 24 * HOUR),
    });
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      conn({ refreshToken: 'refresh' }),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
    expect(body.refreshed).toBe(1);
  });
});
