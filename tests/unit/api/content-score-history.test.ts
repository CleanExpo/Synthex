/**
 * Unit tests — SYN-665 Content Score History (brand-scope)
 *
 * Covers GET /api/dashboard/content-score-history:
 *  - 401 unauthenticated
 *  - 403 no active brand (no-org fallback preserved)
 *  - 503 when Supabase admin client unavailable
 *  - the Supabase `content_score_history` query is `.eq('organization_id', …)`
 *    scoped to the ACTIVE brand (not the home org) for a brand-switched owner
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

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Capture the organization_id passed to `.eq()` so we can assert active-brand
// scoping. The query chain is select → eq → order → limit (awaited).

const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';

beforeEach(() => {
  // jest config sets resetMocks: true — re-apply implementations each test.
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const result = { data: [], error: null };
  const limit = jest.fn().mockResolvedValue(result);
  const order = jest.fn(() => ({ limit }));
  mockEq.mockImplementation(() => ({ order }));
  mockSelect.mockImplementation(() => ({ eq: mockEq }));
  mockFrom.mockImplementation(() => ({ select: mockSelect }));
  (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
});

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

  it('returns 503 when the Supabase admin client is unavailable', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(503);
  });

  it('scopes the content_score_history query to the ACTIVE brand', async () => {
    // Brand-switched multi-business owner: active brand differs from home org.
    const ACTIVE_BRAND = 'org-active-brand';
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);

    const { GET } = await import(ROUTE);
    const res = await GET(createMockNextRequest({ url: URL }) as any);
    expect(res.status).toBe(200);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith('user-1');
    expect(mockFrom).toHaveBeenCalledWith('content_score_history');
    // The `.eq('organization_id', …)` filter carries the active brand id.
    expect(mockEq).toHaveBeenCalledWith('organization_id', ACTIVE_BRAND);
    // Must NOT have fallen back to the raw home-org lookup.
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});
