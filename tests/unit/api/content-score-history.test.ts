/**
 * Unit tests — SYN-665 Content Score History (brand-scope)
 *
 * Covers GET /api/dashboard/content-score-history:
 *  - 401 unauthenticated
 *  - 403 no active brand (no-org fallback preserved)
 *  - 501 FEATURE_NOT_PROVISIONED after auth + active-brand resolution: the
 *    `content_score_history` table has no Prisma model, so no history is faked
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
// The route resolves the ACTIVE brand via getEffectiveOrganizationId so a
// brand-switched multi-business owner reads the brand they switched to, not
// their home org.

const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ── Prisma mock (no longer used by the route, kept to detect home-org regress) ─

const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

const ROUTE = '@/app/api/dashboard/content-score-history/route';
const URL = 'http://localhost/api/dashboard/content-score-history';

describe('GET /api/dashboard/content-score-history (brand-scope)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when there is no active brand (no-org fallback)', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 501 FEATURE_NOT_PROVISIONED for an authenticated brand', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-active-brand');
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({
      error: 'FEATURE_NOT_PROVISIONED',
      available: false,
      reason: expect.stringContaining('content_score_history'),
    });
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith('user-1');
    // Must NOT have fallen back to the raw home-org lookup.
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});
