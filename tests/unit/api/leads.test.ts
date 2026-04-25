/**
 * Unit tests — SYN-794 Lead ground-truth endpoints
 *
 * Covers:
 *  - POST /api/leads                (HMAC-signed public capture)
 *  - POST /api/leads/[id]/verify    (authenticated revenue verification)
 */

import { createHmac } from 'crypto';
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
      // Normalise header keys to lower-case for case-insensitive lookup.
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

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
}));

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
const mockGetUserId = getUserIdFromRequestOrCookies as jest.Mock;

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockLeadCreate = jest.fn();
const mockLeadFindUnique = jest.fn();
const mockLeadUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockOrgFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    lead: {
      create: (...args: unknown[]) => mockLeadCreate(...args),
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
      update: (...args: unknown[]) => mockLeadUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    organization: {
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
    },
  },
}));

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/leads
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/leads', () => {
  const SECRET = 'test-lead-hmac-secret';

  const validBody = {
    organizationId: 'org-1',
    contactMethod: 'form_submission',
    source: 'google',
    medium: 'cpc',
    campaign: 'spring',
    occurredAt: '2026-04-24T10:00:00.000Z',
    capturedFrom: 'form:/contact',
    rawPayload: { name: 'Alice', email: 'a@example.com' },
    revenueEstimateAud: 500,
  };

  function signBody(body: unknown): { raw: string; sig: string } {
    const raw = JSON.stringify(body);
    const sig =
      'sha256=' + createHmac('sha256', SECRET).update(raw).digest('hex');
    return { raw, sig };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LEAD_CAPTURE_HMAC_SECRET = SECRET;
    mockOrgFindUnique.mockResolvedValue({ id: 'org-1' });
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockLeadCreate.mockResolvedValue({
      id: 'lead-1',
      stage: 'enquiry',
      occurredAt: new Date(validBody.occurredAt),
    });
  });

  afterEach(() => {
    delete process.env.LEAD_CAPTURE_HMAC_SECRET;
  });

  it('returns 401 when signature header is missing', async () => {
    const { raw } = signBody(validBody);
    const { POST } = await import('@/app/api/leads/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/leads',
      body: raw,
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    expect(mockLeadCreate).not.toHaveBeenCalled();
  });

  it('returns 401 when signature is invalid', async () => {
    const { raw } = signBody(validBody);
    const { POST } = await import('@/app/api/leads/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/leads',
      body: raw,
      headers: {
        'content-type': 'application/json',
        'x-synthex-signature': 'sha256=deadbeef',
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    expect(mockLeadCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when body fails schema validation', async () => {
    const badBody = { organizationId: 'org-1' }; // missing required fields
    const { raw, sig } = signBody(badBody);
    const { POST } = await import('@/app/api/leads/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/leads',
      body: raw,
      headers: {
        'content-type': 'application/json',
        'x-synthex-signature': sig,
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mockLeadCreate).not.toHaveBeenCalled();
  });

  it('creates the lead with a valid signature and body', async () => {
    const { raw, sig } = signBody(validBody);
    const { POST } = await import('@/app/api/leads/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/leads',
      body: raw,
      headers: {
        'content-type': 'application/json',
        'x-synthex-signature': sig,
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockLeadCreate).toHaveBeenCalledTimes(1);
    const call = mockLeadCreate.mock.calls[0][0];
    expect(call.data.organizationId).toBe('org-1');
    expect(call.data.contactMethod).toBe('form_submission');
    expect(call.data.capturedFrom).toBe('form:/contact');
  });

  it('returns 429 with Retry-After header when rate limit is breached', async () => {
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      retryAfterSeconds: 42,
      breachedBucket: 'org',
    });
    const { raw, sig } = signBody(validBody);
    const { POST } = await import('@/app/api/leads/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/leads',
      body: raw,
      headers: {
        'content-type': 'application/json',
        'x-synthex-signature': sig,
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(429);
    expect(mockLeadCreate).not.toHaveBeenCalled();
    // Retry-After header is set on 429 responses.
    const retryAfter =
      res.headers?.get?.('Retry-After') ??
      (res as any).headers?.['retry-after'];
    expect(retryAfter).toBe('42');
  });

  it('returns 404 when organisation does not exist', async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    const { raw, sig } = signBody(validBody);
    const { POST } = await import('@/app/api/leads/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/leads',
      body: raw,
      headers: {
        'content-type': 'application/json',
        'x-synthex-signature': sig,
      },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
    expect(mockLeadCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/leads/[id]/verify
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/leads/[id]/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeReq(body: unknown) {
    return createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/leads/lead-1/verify',
      body,
      headers: { 'content-type': 'application/json' },
    });
  }

  const params = Promise.resolve({ id: 'lead-1' });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/leads/[id]/verify/route');
    const res = await POST(makeReq({ verifiedRevenueAud: 1000 }) as any, {
      params,
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has no organisation', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { POST } = await import('@/app/api/leads/[id]/verify/route');
    const res = await POST(makeReq({ verifiedRevenueAud: 1000 }) as any, {
      params,
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when the lead does not exist', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockLeadFindUnique.mockResolvedValue(null);
    const { POST } = await import('@/app/api/leads/[id]/verify/route');
    const res = await POST(makeReq({ verifiedRevenueAud: 1000 }) as any, {
      params,
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when the lead belongs to a different organisation', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      organizationId: 'org-2',
      stage: 'enquiry',
    });
    const { POST } = await import('@/app/api/leads/[id]/verify/route');
    const res = await POST(makeReq({ verifiedRevenueAud: 1000 }) as any, {
      params,
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when body is invalid', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      organizationId: 'org-1',
      stage: 'enquiry',
    });
    const { POST } = await import('@/app/api/leads/[id]/verify/route');
    const res = await POST(makeReq({ verifiedRevenueAud: -5 }) as any, {
      params,
    });
    expect(res.status).toBe(400);
  });

  it('flips stage to converted when verifiedRevenueAud > 0 and no stage passed', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      organizationId: 'org-1',
      stage: 'enquiry',
    });
    mockLeadUpdate.mockResolvedValue({
      id: 'lead-1',
      stage: 'converted',
      verifiedAt: new Date(),
      verifiedByUserId: 'user-1',
      verifiedRevenueAud: 1500,
    });
    const { POST } = await import('@/app/api/leads/[id]/verify/route');
    const res = await POST(makeReq({ verifiedRevenueAud: 1500 }) as any, {
      params,
    });
    expect(res.status).toBe(200);
    expect(mockLeadUpdate).toHaveBeenCalledTimes(1);
    const call = mockLeadUpdate.mock.calls[0][0];
    expect(call.data.stage).toBe('converted');
    expect(call.data.verifiedByUserId).toBe('user-1');
    expect(call.data.verifiedRevenueAud).toBe(1500);
  });
});
