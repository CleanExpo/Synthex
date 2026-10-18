/**
 * __tests__/security/testimonial-card-rls.test.ts
 *
 * Cross-tenant access protection for GET /api/results/testimonial-card.
 *
 * Before this PR the route accepted `?client_id=<uuid>` UNAUTHENTICATED
 * and passed it into `.eq('id', x)` / `.eq('organization_id', x)` over
 * a service-role Supabase client. Any caller could fetch any tenant's
 * organisation name, GEO trend, and brand accent colour by guessing UUIDs.
 *
 * After the refactor the route:
 *   1. Returns 401 to unauthenticated requests
 *   2. Returns 403 to authenticated users with no organisation
 *   3. Ignores `?client_id=` and uses the session's organizationId only
 *   4. Builds the card for the session-owner's tenant — never a foreign tenant
 *
 * Service-role leak fix 4/N (the final REFACTOR-CRITICAL).
 *
 * P2: the organisation read now goes through Prisma; GEO scores and brand
 * profiles are NOT_PROVISIONED and the card says so in a response header.
 */

import type { NextRequest } from 'next/server';

// ── Mocks (declared before importing the route) ──────────────────────────────

const mockUserFindUnique = jest.fn();
const mockOrgFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    organization: {
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
    },
  },
}));

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  __esModule: true,
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// next/og is heavy + edge-runtime-ish — stub with a sentinel class.
const mockImageResponse = jest.fn();

class MockImageResponse {
  __imageResponse = true;
  width: number;
  height: number;
  headers: Record<string, string>;
  constructor(
    _node: unknown,
    init: { width: number; height: number; headers: Record<string, string> }
  ) {
    this.width = init.width;
    this.height = init.height;
    this.headers = init.headers;
    mockImageResponse(_node, init);
  }
}

jest.mock('next/og', () => ({
  __esModule: true,
  ImageResponse: MockImageResponse,
}));

// ── System under test ────────────────────────────────────────────────────────

import { GET } from '@/app/api/results/testimonial-card/route';

const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeReq(query: Record<string, string> = {}): NextRequest {
  const url = new URL('https://synthex.social/api/results/testimonial-card');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { url: url.toString() } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgFindUnique.mockResolvedValue({ name: 'Tenant A Co' });
});

describe('GET /api/results/testimonial-card — auth gate', () => {
  it('returns 401 when no session', async () => {
    mockGetUserId.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated user has no organisation', async () => {
    mockGetUserId.mockResolvedValueOnce(USER_A_ID);
    mockUserFindUnique.mockResolvedValueOnce({ organizationId: null });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });
});

describe('GET /api/results/testimonial-card — cross-tenant denial', () => {
  it('IGNORES ?client_id= and queries the session-owner tenant', async () => {
    mockGetUserId.mockResolvedValueOnce(USER_A_ID);
    mockUserFindUnique.mockResolvedValueOnce({ organizationId: TENANT_A_ID });

    // Attacker passes TENANT_B in the query string
    await GET(makeReq({ client_id: TENANT_B_ID }));

    expect(mockOrgFindUnique).toHaveBeenCalledTimes(1);
    expect(mockOrgFindUnique).toHaveBeenCalledWith({
      where: { id: TENANT_A_ID },
      select: { name: true },
    });
  });

  it('builds the card for the session-owner tenant when no query param is passed', async () => {
    mockGetUserId.mockResolvedValueOnce(USER_A_ID);
    mockUserFindUnique.mockResolvedValueOnce({ organizationId: TENANT_A_ID });

    const res = await GET(makeReq({ quarter: 'Q1 2026' }));
    expect(
      (res as unknown as { __imageResponse: boolean }).__imageResponse
    ).toBe(true);
    const node = JSON.stringify(mockImageResponse.mock.calls[0][0]);
    expect(node).toContain('Tenant A Co');
    expect(node).toContain('Q1 2026 Milestone');
  });

  it('does not query the organisation before auth resolves', async () => {
    mockGetUserId.mockResolvedValueOnce(null);
    await GET(makeReq({ client_id: TENANT_B_ID }));
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });
});

describe('GET /api/results/testimonial-card — NOT_PROVISIONED inputs', () => {
  it('names the unprovisioned GEO and brand tables in X-Synthex-Unavailable', async () => {
    mockGetUserId.mockResolvedValueOnce(USER_A_ID);
    mockUserFindUnique.mockResolvedValueOnce({ organizationId: TENANT_A_ID });

    const res = (await GET(makeReq())) as unknown as {
      headers: Record<string, string>;
    };
    expect(res.headers['X-Synthex-Unavailable']).toBe(
      'client_geo_scores,brand_profiles'
    );
  });
});
