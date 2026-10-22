/**
 * SEAM: app/api/newsletter/unsubscribe/route.ts — GET and POST handlers,
 * called through createMockNextRequest.
 * Catches: an RFC 8058 one-click POST (form body List-Unsubscribe=One-Click)
 * being refused; a redirect answer; a 200 "Unsubscribed" when nothing was
 * recorded; a GET that unsubscribes (mail-scanner prefetch).
 * Misses: real Resend and Postgres (mocked boundaries), DKIM coverage of the
 * headers, Next's real request parsing.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockContactsGet = jest.fn();
const mockContactsUpdate = jest.fn();
const mockContactsCreate = jest.fn();
jest.mock('resend', () => ({
  // plain function: survives the config's resetMocks between tests
  Resend: function MockResend() {
    return {
      contacts: {
        get: (...a: unknown[]) => mockContactsGet(...a),
        update: (...a: unknown[]) => mockContactsUpdate(...a),
        create: (...a: unknown[]) => mockContactsCreate(...a),
      },
    };
  },
}));

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/rate-limit', () => ({
  readDefault: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET, POST } from '@/app/api/newsletter/unsubscribe/route';

const URL_WITH_EMAIL =
  'https://synthex.social/api/newsletter/unsubscribe?email=x%40example.com';
const ENV = { ...process.env };

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ENV,
    RESEND_API_KEY: 're_test_placeholder',
    RESEND_AUDIENCE_ID: 'aud_test',
  };
  mockContactsUpdate.mockResolvedValue({ data: { id: 'c1' }, error: null });
  mockContactsCreate.mockResolvedValue({ data: { id: 'c2' }, error: null });
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', preferences: {} });
  mockPrisma.user.update.mockResolvedValue({});
});

afterAll(() => {
  process.env = ENV;
});

describe('POST /api/newsletter/unsubscribe', () => {
  it('accepts an RFC 8058 one-click form POST and records the unsubscribe (200, no redirect)', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: URL_WITH_EMAIL,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockContactsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'x@example.com', unsubscribed: true })
    );
    expect(
      mockPrisma.user.update.mock.calls[0][0].data.preferences.emailStatus
        .status
    ).toBe('unsubscribed');
  });

  it('accepts a JSON POST and records the unsubscribe', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'https://synthex.social/api/newsletter/unsubscribe',
        body: { email: 'x@example.com' },
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockContactsUpdate).toHaveBeenCalledTimes(1);
  });

  it('returns 503 (not 200) when no store can record the unsubscribe', async () => {
    delete process.env.RESEND_AUDIENCE_ID;
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: URL_WITH_EMAIL,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }) as never
    );
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('could not record');
  });

  it('returns 503 FEATURE_NOT_PROVISIONED (JSON) when no store can record it', async () => {
    delete process.env.RESEND_AUDIENCE_ID;
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'https://synthex.social/api/newsletter/unsubscribe',
        body: { email: 'x@example.com' },
      }) as never
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
  });

  it('returns a 5xx (never 200) when a store write fails', async () => {
    mockContactsUpdate.mockResolvedValue({
      data: null,
      error: { name: 'internal_server_error', message: 'boom' },
    });
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'https://synthex.social/api/newsletter/unsubscribe',
        body: { email: 'x@example.com' },
      }) as never
    );
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('rejects a form POST without an email (400)', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'https://synthex.social/api/newsletter/unsubscribe',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }) as never
    );
    expect(res.status).toBe(400);
    expect(mockContactsUpdate).not.toHaveBeenCalled();
  });
});

describe('GET /api/newsletter/unsubscribe', () => {
  it('renders a confirm form and does not unsubscribe (prefetch-safe, no redirect)', async () => {
    const res = await GET(
      createMockNextRequest({ method: 'GET', url: URL_WITH_EMAIL }) as never
    );
    expect(isRedirect(res.status)).toBe(false);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form');
    expect(html).toContain('method="post"');
    expect(html).toContain('List-Unsubscribe');
    expect(mockContactsUpdate).not.toHaveBeenCalled();
    expect(mockContactsCreate).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('answers a GET with a bad address with 400, not a redirect', async () => {
    const res = await GET(
      createMockNextRequest({
        method: 'GET',
        url: 'https://synthex.social/api/newsletter/unsubscribe?email=nope',
      }) as never
    );
    expect(res.status).toBe(400);
  });
});
