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

// Supabase admin chain — captures which `id` / `organization_id` the
// route filters on so we can assert tenant isolation.
const mockSupabaseSingleOrg = jest.fn();
const mockSupabaseEqOrg = jest.fn();
const mockSupabaseSelectOrg = jest.fn();

const mockSupabaseLimitGeo = jest.fn();
const mockSupabaseOrderGeo = jest.fn();
const mockSupabaseEqGeo = jest.fn();
const mockSupabaseSelectGeo = jest.fn();

const mockSupabaseSingleBrand = jest.fn();
const mockSupabaseEqBrand = jest.fn();
const mockSupabaseSelectBrand = jest.fn();

const mockSupabaseFrom = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  __esModule: true,
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// next/og is heavy + edge-runtime-ish — stub with a sentinel class.
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

import { GET } from '@/app/api/results/testimonial-card/route';

const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_A_ID   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeReq(query: Record<string, string> = {}): NextRequest {
  const url = new URL('https://synthex.social/api/results/testimonial-card');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { url: url.toString() } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

  // Build the Supabase chain so .from() returns a builder that resolves to
  // benign data — the test asserts WHICH organizationId was filtered on,
  // not the response shape.
  mockSupabaseSingleOrg.mockResolvedValue({ data: { name: 'Tenant A Co' } });
  mockSupabaseEqOrg.mockReturnValue({ single: mockSupabaseSingleOrg });
  mockSupabaseSelectOrg.mockReturnValue({ eq: mockSupabaseEqOrg });

  mockSupabaseLimitGeo.mockResolvedValue({ data: [] });
  mockSupabaseOrderGeo.mockReturnValue({ limit: mockSupabaseLimitGeo });
  mockSupabaseEqGeo.mockReturnValue({ order: mockSupabaseOrderGeo });
  mockSupabaseSelectGeo.mockReturnValue({ eq: mockSupabaseEqGeo });

  mockSupabaseSingleBrand.mockResolvedValue({
    data: { accent_color: '#cafe00' },
  });
  mockSupabaseEqBrand.mockReturnValue({ single: mockSupabaseSingleBrand });
  mockSupabaseSelectBrand.mockReturnValue({ eq: mockSupabaseEqBrand });

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'organizations') return { select: mockSupabaseSelectOrg };
    if (table === 'client_geo_scores')
      return { select: mockSupabaseSelectGeo };
    if (table === 'brand_profiles') return { select: mockSupabaseSelectBrand };
    return { select: jest.fn() };
  });

  mockCreateClient.mockReturnValue({ from: mockSupabaseFrom });
});

describe('GET /api/results/testimonial-card — auth gate', () => {
  it('returns 401 when no session', async () => {
    mockGetUserId.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated user has no organisation', async () => {
    mockGetUserId.mockResolvedValueOnce(USER_A_ID);
    mockUserFindUnique.mockResolvedValueOnce({ organizationId: null });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });
});

describe('GET /api/results/testimonial-card — cross-tenant denial', () => {
  it('IGNORES ?client_id= and queries the session-owner tenant', async () => {
    mockGetUserId.mockResolvedValueOnce(USER_A_ID);
    mockUserFindUnique.mockResolvedValueOnce({ organizationId: TENANT_A_ID });

    // Attacker passes TENANT_B in the query string
    await GET(makeReq({ client_id: TENANT_B_ID }));

    // Every Supabase filter must be bound to TENANT_A_ID — never TENANT_B_ID
    expect(mockSupabaseEqOrg).toHaveBeenCalledWith('id', TENANT_A_ID);
    expect(mockSupabaseEqOrg).not.toHaveBeenCalledWith('id', TENANT_B_ID);

    expect(mockSupabaseEqGeo).toHaveBeenCalledWith(
      'organization_id',
      TENANT_A_ID
    );
    expect(mockSupabaseEqGeo).not.toHaveBeenCalledWith(
      'organization_id',
      TENANT_B_ID
    );

    expect(mockSupabaseEqBrand).toHaveBeenCalledWith(
      'organization_id',
      TENANT_A_ID
    );
    expect(mockSupabaseEqBrand).not.toHaveBeenCalledWith(
      'organization_id',
      TENANT_B_ID
    );
  });

  it('builds the card for the session-owner tenant when no query param is passed', async () => {
    mockGetUserId.mockResolvedValueOnce(USER_A_ID);
    mockUserFindUnique.mockResolvedValueOnce({ organizationId: TENANT_A_ID });

    const res = await GET(makeReq());
    expect((res as unknown as { __imageResponse: boolean }).__imageResponse).toBe(
      true
    );
    expect(mockSupabaseEqOrg).toHaveBeenCalledWith('id', TENANT_A_ID);
  });

  it('does not call any Supabase query before auth resolves', async () => {
    mockGetUserId.mockResolvedValueOnce(null);
    await GET(makeReq({ client_id: TENANT_B_ID }));
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });
});
