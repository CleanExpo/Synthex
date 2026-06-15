/**
 * Unit tests — UNI-1610 Composite Health Score (brand-scope)
 *
 * Covers GET /api/health/composite:
 *  - 401 unauthenticated
 *  - 404 no active brand (no-org fallback preserved)
 *  - the composite score is computed for the ACTIVE brand (not the home org)
 *    for a brand-switched owner
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

// ── Prisma mock (route no longer uses it; kept to detect home-org regress) ─────

const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

// ── Composite score service mock ──────────────────────────────────────────────

const mockComputeCompositeHealthScore = jest.fn();

jest.mock('@/lib/health/composite-score', () => ({
  __esModule: true,
  computeCompositeHealthScore: (...a: unknown[]) =>
    mockComputeCompositeHealthScore(...a),
}));

const ROUTE = '@/app/api/health/composite/route';
const URL = 'http://localhost/api/health/composite';

describe('GET /api/health/composite (brand-scope)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 404 when there is no active brand (no-org fallback)', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(404);
    expect(mockComputeCompositeHealthScore).not.toHaveBeenCalled();
  });

  it('computes the score for the ACTIVE brand, not the home org', async () => {
    // Brand-switched multi-business owner: active brand differs from home org.
    const ACTIVE_BRAND = 'org-active-brand';
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
    mockComputeCompositeHealthScore.mockResolvedValue({ total: 100 });

    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.score).toEqual({ total: 100 });

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith('user-1');
    expect(mockComputeCompositeHealthScore).toHaveBeenCalledWith(
      'user-1',
      ACTIVE_BRAND
    );
    // Must NOT have fallen back to the raw home-org lookup.
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('returns 500 when score computation throws', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-active-brand');
    mockComputeCompositeHealthScore.mockRejectedValue(new Error('boom'));

    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(500);
  });
});
