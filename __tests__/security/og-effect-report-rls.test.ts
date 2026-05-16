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
 *   4. Builds the card for the session-owner's tenant — never a foreign tenant
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
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserId(...args),
}));

const mockSupabaseLimit = jest.fn();
const mockSupabaseOrder = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseFrom = jest.fn();

const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  __esModule: true,
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// ImageResponse is a heavy import that pulls in WASM at edge runtime. Stub
// with a constructible class so the route's `new ImageResponse(...)` call
// produces a recognisable sentinel object.
const mockImageResponse = jest.fn();

class MockImageResponse {
  __imageResponse = true;
  width: number;
  height: number;
  constructor(_node: unknown, init: { width: number; height: number }) {
    this.width = init.width;
    this.height = init.height;
    mockImageResponse(_node, init);
  }
}

jest.mock('next/og', () => ({
  __esModule: true,
  ImageResponse: MockImageResponse,
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

beforeEach(() => {
  // jest.config has resetMocks: true — re-wire the chain on each test.
  mockCreateClient.mockImplementation(() => ({ from: mockSupabaseFrom }));
  mockSupabaseFrom.mockImplementation(() => ({ select: mockSupabaseSelect }));
  mockSupabaseSelect.mockImplementation(() => ({ eq: mockSupabaseEq }));
  mockSupabaseEq.mockImplementation(() => ({ order: mockSupabaseOrder }));
  mockSupabaseOrder.mockImplementation(() => ({ limit: mockSupabaseLimit }));
  // Default Supabase response — tenant A's row
  mockSupabaseLimit.mockResolvedValue({
    data: [
      {
        report_data: {
          businessName: 'Tenant A Business',
          quarterLabel: 'Q1 2026',
          proprietaryMetrics: { geoScore: 80 },
          achievementSummary: {
            postsPublished: 12,
            estimatedTotalReach: 50_000,
          },
        },
      },
    ],
    error: null,
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
});

describe('GET /api/og/effect-report — cross-tenant access protection', () => {
  test('returns 401 when no auth session is present', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await GET(makeReq({ period: 'Q1 2026' }));

    expect((res as { status?: number }).status).toBe(401);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  test('returns 403 when authenticated user has no organisation', async () => {
    mockGetUserId.mockResolvedValue(USER_A_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: null });

    const res = await GET(makeReq({ period: 'Q1 2026' }));

    expect((res as { status?: number }).status).toBe(403);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  test('uses session organizationId — ignores `?client_id=` param entirely', async () => {
    mockGetUserId.mockResolvedValue(USER_A_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: TENANT_A_ID });

    // Attacker (user A) passes tenant B's id in the URL — must be ignored.
    await GET(
      makeReq({ period: 'Q1 2026', client_id: TENANT_B_ID })
    );

    // The Supabase .eq filter MUST have used tenant A — never tenant B.
    expect(mockSupabaseEq).toHaveBeenCalledTimes(1);
    expect(mockSupabaseEq).toHaveBeenCalledWith('client_id', TENANT_A_ID);
    expect(mockSupabaseEq).not.toHaveBeenCalledWith(
      'client_id',
      TENANT_B_ID
    );
  });

  test('happy path: authenticated user with org sees an ImageResponse', async () => {
    mockGetUserId.mockResolvedValue(USER_A_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: TENANT_A_ID });

    const res = (await GET(makeReq({ period: 'Q1 2026' }))) as unknown as {
      __imageResponse: boolean;
      width: number;
      height: number;
    };

    expect(res.__imageResponse).toBe(true);
    expect(res.width).toBe(1200);
    expect(res.height).toBe(1200);
    expect(mockSupabaseEq).toHaveBeenCalledWith('client_id', TENANT_A_ID);
  });

  test('does NOT call Supabase before the auth check completes', async () => {
    mockGetUserId.mockResolvedValue(null);

    await GET(makeReq({ period: 'Q1 2026', client_id: TENANT_B_ID }));

    // Anonymous probe with attacker-supplied client_id must not even hit DB
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
    expect(mockSupabaseSelect).not.toHaveBeenCalled();
    expect(mockSupabaseEq).not.toHaveBeenCalled();
  });
});
