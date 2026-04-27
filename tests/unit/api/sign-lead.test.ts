/**
 * Unit tests — SYN-801 sign-lead shim
 *
 * Covers POST /api/internal/sign-lead — Origin allowlist, body validation,
 * rate-limit pass-through, and the happy-path forward to /api/leads.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');

  class MockNextResponse {
    status: number;
    headers: { get: (name: string) => string | null };
    private _body: string;
    private _headers: Record<string, string>;

    constructor(
      body: string,
      init: { status?: number; headers?: Record<string, string> } = {}
    ) {
      this._body = body;
      this.status = init.status ?? 200;
      this._headers = Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      this.headers = {
        get: (name: string) => this._headers[name.toLowerCase()] ?? null,
      };
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(
      data: unknown,
      init: { status?: number; headers?: Record<string, string> } = {}
    ) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return { ...actual, NextResponse: MockNextResponse };
});

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Rate-limit mock ───────────────────────────────────────────────────────────

jest.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  extractClientIp: jest.fn(() => '1.2.3.4'),
}));

import { checkRateLimit } from '@/lib/auth/rate-limit';
const mockCheckRateLimit = checkRateLimit as jest.Mock;

// ── Signing helper mock ──────────────────────────────────────────────────────

jest.mock('@/lib/auth/sign-lead-payload', () => ({
  signLeadPayload: jest.fn(),
}));

import { signLeadPayload } from '@/lib/auth/sign-lead-payload';
const mockSignLeadPayload = signLeadPayload as jest.Mock;

// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = 'https://synthex.social';

const validBody = {
  contactMethod: 'form_submission' as const,
  source: 'benchmark_page',
  medium: 'web',
  campaign: 'benchmark_launch',
  occurredAt: '2026-04-26T10:00:00.000Z',
  capturedFrom: '/benchmark',
  rawPayload: {
    email: 'visitor@example.com.au',
    businessName: 'Acme Pty Ltd',
  },
};

function makeReq(
  overrides: {
    body?: unknown;
    origin?: string | null;
  } = {}
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (overrides.origin !== null) {
    headers['origin'] = overrides.origin ?? ALLOWED_ORIGIN;
  }
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/internal/sign-lead',
    body: overrides.body ?? validBody,
    headers,
  });
}

describe('POST /api/internal/sign-lead', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    process.env.MARKETING_LEADS_ORG_ID = 'org-marketing';
    process.env.LEAD_CAPTURE_HMAC_SECRET = 'test-secret';

    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockSignLeadPayload.mockReturnValue({
      body: JSON.stringify({ signed: true }),
      signature: 'sha256=abc123',
    });

    // Stub global fetch — used by the shim to forward to /api/leads.
    // Use a plain object rather than a real `Response` because some jsdom
    // builds construct `Response` with `ok = false` for any non-empty body.
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (_name: string) => null,
      },
      json: async () => ({ ok: true, lead: { id: 'lead-1' } }),
      text: async () => JSON.stringify({ ok: true, lead: { id: 'lead-1' } }),
    } as unknown as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.MARKETING_LEADS_ORG_ID;
    delete process.env.LEAD_CAPTURE_HMAC_SECRET;
  });

  it('returns 403 when Origin header is missing', async () => {
    const { POST } = await import('@/app/api/internal/sign-lead/route');
    const req = makeReq({ origin: null });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
    expect(mockSignLeadPayload).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 403 when Origin is not in the allowlist', async () => {
    const { POST } = await import('@/app/api/internal/sign-lead/route');
    const req = makeReq({ origin: 'https://evil.example.com' });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
    expect(mockSignLeadPayload).not.toHaveBeenCalled();
  });

  it('returns 400 when body fails schema validation', async () => {
    const { POST } = await import('@/app/api/internal/sign-lead/route');
    const req = makeReq({ body: { contactMethod: 'form_submission' } });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(mockSignLeadPayload).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After when rate limit is breached', async () => {
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      retryAfterSeconds: 17,
      breachedBucket: 'ip',
    });
    const { POST } = await import('@/app/api/internal/sign-lead/route');
    const req = makeReq();
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('17');
    expect(mockSignLeadPayload).not.toHaveBeenCalled();
  });

  it('signs the payload and forwards to /api/leads on the happy path', async () => {
    const { POST } = await import('@/app/api/internal/sign-lead/route');
    const req = makeReq();
    const res = await POST(req as never);
    expect(res.status).toBe(200);

    expect(mockSignLeadPayload).toHaveBeenCalledTimes(1);
    const signedArg = mockSignLeadPayload.mock.calls[0][0];
    expect(signedArg.organizationId).toBe('org-marketing');
    expect(signedArg.contactMethod).toBe('form_submission');
    expect(signedArg.rawPayload.email).toBe('visitor@example.com.au');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/leads');
    expect(init?.method).toBe('POST');
    expect(init?.headers['x-synthex-signature']).toBe('sha256=abc123');
  });

  it('returns 503 when MARKETING_LEADS_ORG_ID is not configured', async () => {
    delete process.env.MARKETING_LEADS_ORG_ID;
    const { POST } = await import('@/app/api/internal/sign-lead/route');
    const req = makeReq();
    const res = await POST(req as never);
    expect(res.status).toBe(503);
    expect(mockSignLeadPayload).not.toHaveBeenCalled();
  });
});
