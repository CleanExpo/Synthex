/**
 * __tests__/security/og-effect-report-rls.test.ts
 *
 * Cross-tenant access protection for GET /api/og/effect-report.
 *
 * Before 2026-05-16 this route accepted `?client_id=<uuid>` UNAUTHENTICATED
 * and passed it into `.eq('client_id', x)` over a service-role Supabase
 * client. Any requester could fetch any tenant's Effect Report data
 * (business name, GEO score, attribution figures, reach).
 *
 * After the refactor the route:
 *   1. Returns 401 to unauthenticated requests
 *   2. Returns 403 to authenticated users with no organisation
 *   3. Ignores `?client_id=` and uses the session's organizationId only
 *   4. Never reads or renders a foreign tenant's data: the effect_reports
 *      table has no Prisma model, so after auth + tenant resolution it answers
 *      503 FEATURE_NOT_PROVISIONED and renders no card for anyone
 *
 * This test asserts all four properties without hitting the network.
 */

import type { NextRequest } from 'next/server';

// ── Mocks (declared before importing the route) ──────────────────────────────

const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
  },
}));

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  __esModule: true,
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// ImageResponse must never be constructed: no card is rendered while the
// effect_reports table is not provisioned.
const mockImageResponse = jest.fn();

jest.mock('next/og', () => ({
  __esModule: true,
  ImageResponse: jest.fn((...args: unknown[]) => mockImageResponse(...args)),
}));

// ── System under test ────────────────────────────────────────────────────────

import { GET } from '@/app/api/og/effect-report/route';

const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeReq(query: Record<string, string> = {}): NextRequest {
  const url = new URL('https://synthex.social/api/og/effect-report');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { url: url.toString() } as unknown as NextRequest;
}

describe('GET /api/og/effect-report — cross-tenant access protection', () => {
  test('returns 401 when no auth session is present', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await GET(makeReq({ period: 'Q1 2026' }));

    expect((res as { status?: number }).status).toBe(401);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  test('returns 403 when authenticated user has no organisation', async () => {
    mockGetUserId.mockResolvedValue(USER_A_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: null });

    const res = await GET(makeReq({ period: 'Q1 2026' }));

    expect((res as { status?: number }).status).toBe(403);
    expect(mockImageResponse).not.toHaveBeenCalled();
  });

  test('resolves the tenant from the session — ignores `?client_id=` param entirely', async () => {
    mockGetUserId.mockResolvedValue(USER_A_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: TENANT_A_ID });

    // Attacker (user A) passes tenant B's id in the URL — must be ignored.
    const res = await GET(
      makeReq({ period: 'Q1 2026', client_id: TENANT_B_ID })
    );

    // Tenant lookup MUST be keyed on the session user — never the query param.
    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: USER_A_ID },
      select: { organizationId: true },
    });
    expect(JSON.stringify(mockUserFindUnique.mock.calls)).not.toContain(
      TENANT_B_ID
    );
    const body = await (res as Response).json();
    expect(JSON.stringify(body)).not.toContain(TENANT_B_ID);
    expect(mockImageResponse).not.toHaveBeenCalled();
  });

  test('authenticated user with org gets an honest 503, not a placeholder card', async () => {
    mockGetUserId.mockResolvedValue(USER_A_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: TENANT_A_ID });

    const res = (await GET(makeReq({ period: 'Q1 2026' }))) as Response;

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(mockImageResponse).not.toHaveBeenCalled();
  });

  test('does NOT query the database before the auth check completes', async () => {
    mockGetUserId.mockResolvedValue(null);

    await GET(makeReq({ period: 'Q1 2026', client_id: TENANT_B_ID }));

    // Anonymous probe with attacker-supplied client_id must not even hit DB
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockImageResponse).not.toHaveBeenCalled();
  });
});
