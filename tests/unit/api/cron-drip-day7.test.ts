/**
 * Behavioural coverage for /api/cron/drip-day7.
 *
 * This cron and the welcome-sequence cron both target a ~7-day-old user on the
 * same morning. Before the fix, drip-day7 ignored the watermark and re-sent the
 * D+7 email that welcome-sequence had already sent (user double-emailed). These
 * tests lock the shared-watermark contract:
 *   - cron auth gate (401, no DB work)
 *   - already-flagged user is skipped (no double-send, no flag re-write)
 *   - unflagged user is sent + the flag is set (preserving other prefs)
 *   - the batch cap (take) is passed to the query
 *   - unsubscribe honoured (Spam Act): a suppressed or unknown-status recipient
 *     is skipped, never mailed (fail closed). Resend is the mocked boundary.
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
  user: { findMany: jest.fn(), update: jest.fn() },
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

const mockSendDay7 = jest.fn();
jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay7: (...args: unknown[]) => mockSendDay7(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/drip-day7/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/drip-day7' });
}

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
    data: { id: 'c1', email: 'b@example.com', unsubscribed: false },
    error: null,
  });
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.user.update.mockResolvedValue({});
  mockSendDay7.mockResolvedValue(undefined);
});

describe('GET /api/cron/drip-day7', () => {
  it('returns 401 and never queries users for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('skips a user already flagged emailSequenceDay7Sent (no double-send)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@example.com',
        name: 'A',
        preferences: { emailSequenceDay7Sent: true, theme: 'dark' },
      },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockSendDay7).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('sends to an unflagged user and sets the watermark, preserving other prefs', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u2',
        email: 'b@example.com',
        name: 'B',
        preferences: { theme: 'light', emailSequenceStartedAt: '2026-01-01' },
      },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(0);
    expect(mockSendDay7).toHaveBeenCalledWith('b@example.com', 'B');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: {
        preferences: {
          theme: 'light',
          emailSequenceStartedAt: '2026-01-01',
          emailSequenceDay7Sent: true,
        },
      },
    });
  });

  it('passes a batch cap (take) to the user query', async () => {
    await GET(req());
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    );
  });

  it('skips a user who unsubscribed (preferences emailStatus) and never mails them', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u3',
        email: 'c@example.com',
        name: 'C',
        preferences: { emailStatus: { status: 'unsubscribed' } },
      },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockSendDay7).not.toHaveBeenCalled();
    expect(body.sent).toBe(0);
    expect(body.suppressed).toBe(1);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('skips a contact marked unsubscribed in the Resend audience', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u4', email: 'd@example.com', name: 'D', preferences: {} },
    ]);
    mockContactsGet.mockResolvedValue({
      data: { id: 'c4', email: 'd@example.com', unsubscribed: true },
      error: null,
    });
    const res = await GET(req());
    const body = await res.json();
    expect(mockSendDay7).not.toHaveBeenCalled();
    expect(body.suppressed).toBe(1);
  });

  it('fails closed: skips the send when suppression status cannot be read', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u5', email: 'e@example.com', name: 'E', preferences: {} },
    ]);
    mockContactsGet.mockRejectedValue(new Error('network down'));
    const res = await GET(req());
    const body = await res.json();
    expect(mockSendDay7).not.toHaveBeenCalled();
    expect(body.sent).toBe(0);
    expect(body.suppressionUnknown).toBe(1);
  });
});
