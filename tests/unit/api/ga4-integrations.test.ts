/**
 * Unit tests — SYN-793 GA4 Property Management API
 *
 * Covers 401/403/400/200 paths for:
 *  - POST /api/integrations/ga4/connect
 *  - GET  /api/integrations/ga4/properties
 *  - POST /api/integrations/ga4/select-property
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');

  class MockNextResponse {
    status: number;
    private _body: string;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
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

// ── multi-business mock ───────────────────────────────────────────────────────

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: jest.fn(),
}));

import { getEffectiveOrganizationId } from '@/lib/multi-business';
const mockGetOrgId = getEffectiveOrganizationId as jest.Mock;

// ── field encryption mock ─────────────────────────────────────────────────────

jest.mock('@/lib/security/field-encryption', () => ({
  decryptField: jest.fn(),
}));

import { decryptField } from '@/lib/security/field-encryption';
const mockDecrypt = decryptField as jest.Mock;

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockFindFirst = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    platformConnection: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    gA4Property: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/integrations/ga4/connect
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/integrations/ga4/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/integrations/ga4/connect/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/integrations/ga4/connect',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with an authorizationUrl on happy path', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          authorizationUrl:
            'https://accounts.google.com/o/oauth2/v2/auth?client_id=abc',
          platform: 'googleanalytics',
        }),
    } as unknown as Response);

    const { POST } = await import('@/app/api/integrations/ga4/connect/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/integrations/ga4/connect',
      headers: { cookie: 'auth-token=xyz' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorizationUrl).toContain('oauth2');
    expect(body.platform).toBe('googleanalytics');
  });

  it('returns 400 when upstream starter returns 4xx', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Platform not configured'),
    } as unknown as Response);

    const { POST } = await import('@/app/api/integrations/ga4/connect/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/integrations/ga4/connect',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/integrations/ga4/properties
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/integrations/ga4/properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecrypt.mockImplementation((v: string | null | undefined) =>
      v ? `decrypted:${v}` : null
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/integrations/ga4/properties/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/integrations/ga4/properties',
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when no GA4 PlatformConnection exists for the org', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetOrgId.mockResolvedValue('org-1');
    mockFindFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/integrations/ga4/properties/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/integrations/ga4/properties',
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not connected/i);
  });

  it('returns 200 with properties array on happy path', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetOrgId.mockResolvedValue('org-1');
    mockFindFirst.mockResolvedValue({
      accessToken: 'enc:v1:iv:tag:cipher',
      expiresAt: null,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          accountSummaries: [
            {
              account: 'accounts/111',
              displayName: 'Acme',
              propertySummaries: [
                {
                  property: 'properties/123456789',
                  displayName: 'Acme Site',
                },
              ],
            },
          ],
        }),
    } as unknown as Response);

    const { GET } = await import('@/app/api/integrations/ga4/properties/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/integrations/ga4/properties',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.properties).toHaveLength(1);
    expect(body.properties[0]).toMatchObject({
      propertyId: '123456789',
      displayName: 'Acme Site',
      accountName: 'Acme',
    });
  });

  it('propagates 401 when Google rejects the stored token', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetOrgId.mockResolvedValue('org-1');
    mockFindFirst.mockResolvedValue({
      accessToken: 'enc:v1:iv:tag:cipher',
      expiresAt: null,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid credentials'),
    } as unknown as Response);

    const { GET } = await import('@/app/api/integrations/ga4/properties/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/integrations/ga4/properties',
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/integrations/ga4/select-property
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/integrations/ga4/select-property', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } =
      await import('@/app/api/integrations/ga4/select-property/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/integrations/ga4/select-property',
      body: { propertyId: '123' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    const { POST } =
      await import('@/app/api/integrations/ga4/select-property/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/integrations/ga4/select-property',
      body: { propertyId: 'not-numeric', measurementId: 'bad-format' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 403 when the caller has no active organization', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetOrgId.mockResolvedValue(null);
    const { POST } =
      await import('@/app/api/integrations/ga4/select-property/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/integrations/ga4/select-property',
      body: { propertyId: '123456789' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 and upserts GA4Property on happy path', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetOrgId.mockResolvedValue('org-1');
    mockUpsert.mockResolvedValue({
      id: 'ga4-1',
      organizationId: 'org-1',
      propertyId: '123456789',
      measurementId: 'G-ABC1234',
      displayName: 'Acme Site',
      syncStatus: 'active',
    });

    const { POST } =
      await import('@/app/api/integrations/ga4/select-property/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/integrations/ga4/select-property',
      body: {
        propertyId: '123456789',
        measurementId: 'G-ABC1234',
        displayName: 'Acme Site',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.property.propertyId).toBe('123456789');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.where.organizationId_propertyId).toEqual({
      organizationId: 'org-1',
      propertyId: '123456789',
    });
    expect(upsertArg.create.syncStatus).toBe('active');
  });
});
