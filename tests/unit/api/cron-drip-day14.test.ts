/**
 * Unit tests for GET /api/cron/drip-day14 — the D+14 onboarding drip.
 *
 * Covers:
 *   - an allowed recipient is mailed
 *   - unsubscribe honoured (Spam Act): a suppressed or unknown-status recipient
 *     is skipped, never mailed (fail closed). Resend is the mocked boundary.
 *   - preferences must be selected so the audience-unset path can decide
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
  user: { findMany: jest.fn() },
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

const mockSendDay14 = jest.fn();
jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay14: (...args: unknown[]) => mockSendDay14(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/drip-day14/route';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/drip-day14' });
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
    data: { id: 'c1', email: 'a@example.com', unsubscribed: false },
    error: null,
  });
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockSendDay14.mockResolvedValue(undefined);
});

describe('GET /api/cron/drip-day14', () => {
  it('mails an allowed recipient', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@example.com', name: 'A', preferences: {} },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockSendDay14).toHaveBeenCalledWith('a@example.com', 'A');
    expect(body.sent).toBe(1);
    expect(body.suppressed).toBe(0);
  });

  it('selects preferences so the unsubscribe flag is visible', async () => {
    await GET(req());
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ preferences: true }),
      })
    );
  });

  it('skips a user who unsubscribed (preferences emailStatus) and never mails them', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u2',
        email: 'b@example.com',
        name: 'B',
        preferences: { emailStatus: { status: 'unsubscribed' } },
      },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockSendDay14).not.toHaveBeenCalled();
    expect(body.sent).toBe(0);
    expect(body.suppressed).toBe(1);
  });

  it('skips an unsubscribed user when RESEND_AUDIENCE_ID is unset (live production path)', async () => {
    delete process.env.RESEND_AUDIENCE_ID;
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
    expect(mockSendDay14).not.toHaveBeenCalled();
    expect(body.suppressed).toBe(1);
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
    expect(mockSendDay14).not.toHaveBeenCalled();
    expect(body.suppressed).toBe(1);
  });

  it('fails closed: skips the send when suppression status cannot be read', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u5', email: 'e@example.com', name: 'E', preferences: {} },
    ]);
    mockContactsGet.mockRejectedValue(new Error('network down'));
    const res = await GET(req());
    const body = await res.json();
    expect(mockSendDay14).not.toHaveBeenCalled();
    expect(body.sent).toBe(0);
    expect(body.suppressionUnknown).toBe(1);
  });
});
