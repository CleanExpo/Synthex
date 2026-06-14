/**
 * Behavioural coverage for /api/cron/drip-day3.
 *
 * This cron and the welcome-sequence cron both target a ~3-day-old user on the
 * same morning. Before the fix, drip-day3 ignored the watermark and re-sent the
 * D+3 email that welcome-sequence had already sent (user double-emailed). These
 * tests lock the shared-watermark contract:
 *   - cron auth gate (401, no DB work)
 *   - already-flagged user is skipped (no double-send, no flag re-write)
 *   - unflagged user is sent + the flag is set (preserving other prefs)
 *   - the batch cap (take) is passed to the query
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

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

const mockSendDay3 = jest.fn();
jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay3: (...args: unknown[]) => mockSendDay3(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/drip-day3/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/drip-day3' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.user.update.mockResolvedValue({});
  mockSendDay3.mockResolvedValue(undefined);
});

describe('GET /api/cron/drip-day3', () => {
  it('returns 401 and never queries users for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('skips a user already flagged emailSequenceDay3Sent (no double-send)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@example.com',
        name: 'A',
        preferences: { emailSequenceDay3Sent: true, theme: 'dark' },
      },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockSendDay3).not.toHaveBeenCalled();
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
    expect(mockSendDay3).toHaveBeenCalledWith('b@example.com', 'B');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: {
        preferences: {
          theme: 'light',
          emailSequenceStartedAt: '2026-01-01',
          emailSequenceDay3Sent: true,
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
});
