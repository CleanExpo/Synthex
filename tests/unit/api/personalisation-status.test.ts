/**
 * Unit tests — SYN-637 Personalisation Status (brand-scope)
 *
 * Covers GET /api/dashboard/personalisation-status:
 *  - 401 unauthenticated
 *  - empty payload when there is no active brand (no-org fallback preserved)
 *  - the ContentPerformanceProfile lookup is scoped to the ACTIVE brand
 *    (not the home org) for a brand-switched owner
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

// ── Multi-business scope mock ────────────────────────────────────────────────

const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockUserFindUnique = jest.fn();
const mockProfileFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    contentPerformanceProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
    },
  },
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const ROUTE = '@/app/api/dashboard/personalisation-status/route';
const URL = 'http://localhost/api/dashboard/personalisation-status';

describe('GET /api/dashboard/personalisation-status (brand-scope)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(401);
  });

  it('returns the empty payload when there is no active brand (no-org fallback)', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ postCount: 0, isPersonalised: false });
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it('scopes the ContentPerformanceProfile lookup to the ACTIVE brand', async () => {
    // Brand-switched multi-business owner: active brand differs from home org.
    const ACTIVE_BRAND = 'org-active-brand';
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
    mockProfileFindUnique.mockResolvedValue({ postCount: 60 });

    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual({ postCount: 60, isPersonalised: true });

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith('user-1');
    expect(mockProfileFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ACTIVE_BRAND } })
    );
    // Must NOT have fallen back to the raw home-org lookup.
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('returns the empty payload when no profile exists for the active brand', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-active-brand');
    mockProfileFindUnique.mockResolvedValue(null);

    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    const body = await res.json();
    expect(body.data).toEqual({ postCount: 0, isPersonalised: false });
  });
});
