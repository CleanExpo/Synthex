/**
 * Behavioural coverage for /api/cron/welcome-sequence — the daily Vercel cron
 * that sends D+3 / D+7 nurture emails and records the sent-flag in
 * user.preferences (a JSON column).
 *
 * Reliability lock: the cron reads every user's preferences up-front in one
 * bulk query, then processes sequentially. Writing back the stale in-memory
 * snapshot would clobber any concurrent preferences change made between the
 * snapshot read and the write. These tests assert the flag write re-reads the
 * latest preferences and patches ONLY the target flag — unrelated keys survive.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockContactsGet = jest.fn();
jest.mock('resend', () => ({
  // plain function: survives the config's resetMocks between tests
  Resend: function MockResend() {
    return {
      contacts: { get: (...a: unknown[]) => mockContactsGet(...a) },
    };
  },
}));
const ENV = { ...process.env };

const mockPrisma = {
  $queryRaw: jest.fn(),
  user: { findUnique: jest.fn(), update: jest.fn() },
  subscription: { findUnique: jest.fn() },
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

const mockSendDay3 = jest.fn();
const mockSendDay7 = jest.fn();
jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay3: (...args: unknown[]) => mockSendDay3(...args),
  sendWelcomeSequenceDay7: (...args: unknown[]) => mockSendDay7(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/welcome-sequence/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/welcome-sequence',
  });
}

// 4 days ago — past the D+3 threshold, before D+7.
const FOUR_DAYS_AGO = new Date(
  Date.now() - 4 * 24 * 60 * 60 * 1000
).toISOString();

afterAll(() => {
  process.env = ENV;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ENV,
    RESEND_API_KEY: 're_test_placeholder',
    RESEND_AUDIENCE_ID: 'aud_test',
  };
  mockContactsGet.mockResolvedValue({
    data: { id: 'c1', email: 'a@b.com', unsubscribed: false },
    error: null,
  });
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockSendDay3.mockResolvedValue(undefined);
  mockSendDay7.mockResolvedValue(undefined);
  mockPrisma.user.update.mockResolvedValue({});
});

describe('GET /api/cron/welcome-sequence', () => {
  it('returns 401 and never queries users for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('runs clean with no eligible users', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.day3Sent).toBe(0);
  });

  it('patches only the D+3 flag and preserves a concurrent preferences change', async () => {
    // Bulk snapshot read up-front: stale view of preferences.
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@b.com',
        name: 'Ann',
        preferences: {
          emailSequenceStartedAt: FOUR_DAYS_AGO,
          theme: 'light',
        },
      },
    ]);

    // Concurrent change landed between the snapshot read and the flag write:
    // theme switched to 'dark' and a brand-new key appeared.
    mockPrisma.user.findUnique.mockResolvedValue({
      preferences: {
        emailSequenceStartedAt: FOUR_DAYS_AGO,
        theme: 'dark',
        newlySetKey: 'value',
      },
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.day3Sent).toBe(1);
    expect(mockSendDay3).toHaveBeenCalledTimes(1);

    // Re-read the latest prefs before writing.
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { preferences: true },
    });

    // The write merges onto the LATEST prefs: only the flag is added, the
    // concurrent theme change + new key survive (not clobbered by the snapshot).
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        preferences: {
          emailSequenceStartedAt: FOUR_DAYS_AGO,
          theme: 'dark',
          newlySetKey: 'value',
          emailSequenceDay3Sent: true,
        },
      },
    });
  });

  it('never mails an unsubscribed user (D+3 or D+7) and sets no sent-flag', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'u9',
        email: 'gone@b.com',
        name: 'Gone',
        preferences: {
          emailSequenceStartedAt: new Date(
            Date.now() - 8 * 24 * 60 * 60 * 1000
          ).toISOString(),
          emailStatus: { status: 'unsubscribed' },
        },
      },
    ]);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockSendDay3).not.toHaveBeenCalled();
    expect(mockSendDay7).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(body.suppressed).toBe(1);
  });

  it('fails closed: skips the send when the Resend audience is not configured', async () => {
    delete process.env.RESEND_AUDIENCE_ID;
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'u8',
        email: 'a@b.com',
        name: 'Ann',
        preferences: { emailSequenceStartedAt: FOUR_DAYS_AGO },
      },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(mockSendDay3).not.toHaveBeenCalled();
    expect(body.suppressionUnknown).toBe(1);
  });
});
