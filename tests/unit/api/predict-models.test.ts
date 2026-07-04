/**
 * Unit tests — GET /api/predict/models brand-scope (wrong-brand READ)
 *
 * Verifies the route resolves the query org via getEffectiveOrganizationId
 * (the ACTIVE brand for a brand-switched multi-business owner), NOT the home
 * org (user.organizationId). Without the fix a brand-switched owner lists the
 * WRONG brand's SpatiotemporalModel records.
 *
 * Validates:
 *   - 401 on missing auth
 *   - 403 no-org fallback preserved (effective org null)
 *   - lists models scoped to the ACTIVE brand, not the home org
 */

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
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
  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
});

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockUserFindUnique = jest.fn();
const mockOrganizationFindUnique = jest.fn();
const mockModelFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrganizationFindUnique },
    spatiotemporalModel: { findMany: mockModelFindMany },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// ── Multi-business scope mock ─────────────────────────────────────────────────
// The route resolves the ACTIVE brand via getEffectiveOrganizationId so a
// brand-switched multi-business owner lists the brand they switched to.

const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

const USER_ID = 'user-001';
const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-active-brand';

function makeGetRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost:3000/api/predict/models',
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Default: authenticated brand-switched owner whose ACTIVE brand differs
  // from the home org.
  mockGetUserId.mockResolvedValue(USER_ID);
  mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
  mockOrganizationFindUnique.mockResolvedValue({ plan: 'scale' });
  // Non-owner user → owner/admin bypass is inactive, raw org plan is used.
  mockUserFindUnique.mockResolvedValue({ email: 'member@example.com', preferences: null });
  mockModelFindMany.mockResolvedValue([]);
});

describe('GET /api/predict/models', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/predict/models/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when there is no effective organisation (no-org fallback)', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/predict/models/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(mockModelFindMany).not.toHaveBeenCalled();
  });

  it('lists models scoped to the ACTIVE brand, not the home org', async () => {
    const { GET } = await import('@/app/api/predict/models/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    // The model list query targets the active brand.
    expect(mockModelFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: ACTIVE_BRAND } })
    );
    // The plan lookup is for the active brand, not the home org.
    expect(mockOrganizationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACTIVE_BRAND } })
    );
    // Owner/admin bypass: the user lookup is scoped to the authenticated user
    // (to check owner/admin), NOT used to derive the org — org scope verified above.
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { email: true, preferences: true },
    });
    // Sanity: home org was never used as the scope.
    const call = mockModelFindMany.mock.calls[0][0];
    expect(call.where.orgId).not.toBe(HOME_ORG);
  });
});
