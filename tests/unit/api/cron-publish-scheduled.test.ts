/**
 * Behavioural coverage for /api/cron/publish-scheduled — the live Vercel cron
 * (registered in vercel.json) that publishes scheduled Posts. It had no
 * handler-level test, so a regression could break autonomous publishing with a
 * green suite. Locks: cron auth gate, the clean no-work run, and the
 * no-connection failure path (mark failed + notify, no crash).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  post: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  platformConnection: { findFirst: jest.fn() },
  notification: { create: jest.fn() },
  platformPost: { create: jest.fn() },
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

const mockIsPlatformSupported = jest.fn();
const mockCreatePlatformService = jest.fn();
jest.mock('@/lib/social', () => ({
  isPlatformSupported: (...args: unknown[]) => mockIsPlatformSupported(...args),
  createPlatformService: (...args: unknown[]) => mockCreatePlatformService(...args),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => v,
  encryptField: (v: string) => v,
}));

jest.mock('@/lib/unite-hub-connector', () => ({ pushUniteHubEvent: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/publish-scheduled/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/publish-scheduled' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.post.findMany.mockResolvedValue([]);
  mockPrisma.post.findUnique.mockResolvedValue({ status: 'scheduled', publishedAt: null, metadata: {} });
  mockPrisma.post.update.mockResolvedValue({});
  mockPrisma.notification.create.mockResolvedValue({});
  mockIsPlatformSupported.mockReturnValue(true);
});

describe('GET /api/cron/publish-scheduled', () => {
  it('returns 401 and never queries posts for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it('runs clean with nothing due (processed 0)', async () => {
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.processed).toBe(0);
    expect(body.published).toBe(0);
  });

  it('marks a post failed and notifies when no platform connection exists', async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'hello world',
        platform: 'facebook',
        metadata: {},
        campaign: { userId: 'u1', platform: 'facebook', organizationId: 'org-1' },
      },
    ]);
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null); // no connection

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(body.published).toBe(0);
    // marked failed + the user was notified — never silently dropped, never crashed
    expect(mockPrisma.post.update).toHaveBeenCalled();
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    // never reached the actual platform publish
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
  });
});
