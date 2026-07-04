/**
 * Unit tests — /api/bayesian/spaces brand-scope (wrong-brand READ/WRITE)
 *
 * Verifies both handlers resolve the org via getEffectiveOrganizationId (the
 * ACTIVE brand for a brand-switched multi-business owner), NOT the home org
 * (user.organizationId). Without the fix a brand-switched owner lists AND
 * creates/upserts BOSpace records under the WRONG brand.
 *
 * Validates:
 *   GET  — 401 on missing auth; { data: [] } no-org fallback preserved;
 *          list scoped to the ACTIVE brand.
 *   POST — 401 on missing auth; 403 no-org fallback preserved;
 *          space upsert targets the ACTIVE brand.
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
const mockSpaceFindMany = jest.fn();
const mockSpaceCount = jest.fn();
const mockSpaceUpsert = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrganizationFindUnique },
    bOSpace: {
      findMany: mockSpaceFindMany,
      count: mockSpaceCount,
      upsert: mockSpaceUpsert,
    },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// ── Multi-business scope mock ─────────────────────────────────────────────────

const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ── Bayesian client mock — null forces the pending-upsert path ────────────────

const mockGetBayesianClient = jest.fn();
jest.mock('@/lib/bayesian/client', () => ({
  getBayesianClient: (...args: unknown[]) => mockGetBayesianClient(...args),
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
    url: 'http://localhost:3000/api/bayesian/spaces',
  });
}

function makePostRequest(body: object = { surface: 'geo_score_weights' }) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/bayesian/spaces',
    body,
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  mockGetUserId.mockResolvedValue(USER_ID);
  mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
  // 'scale' unlocks all surfaces with unlimited spaces.
  mockOrganizationFindUnique.mockResolvedValue({ plan: 'scale' });
  // Non-owner user → owner/admin bypass is inactive, raw org plan is used.
  mockUserFindUnique.mockResolvedValue({ email: 'member@example.com', preferences: null });
  mockSpaceFindMany.mockResolvedValue([]);
  mockSpaceCount.mockResolvedValue(0);
  mockGetBayesianClient.mockResolvedValue(null);
  mockSpaceUpsert.mockImplementation(async (args: { create: { orgId: string } }) => ({
    id: 'space-1',
    orgId: args.create.orgId,
  }));
});

describe('GET /api/bayesian/spaces', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/bayesian/spaces/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns { data: [] } when there is no effective org (no-org fallback)', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/bayesian/spaces/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: [] });
    expect(mockSpaceFindMany).not.toHaveBeenCalled();
  });

  it('lists spaces scoped to the ACTIVE brand, not the home org', async () => {
    const { GET } = await import('@/app/api/bayesian/spaces/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    expect(mockSpaceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: ACTIVE_BRAND } })
    );
    const call = mockSpaceFindMany.mock.calls[0][0];
    expect(call.where.orgId).not.toBe(HOME_ORG);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/bayesian/spaces', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/bayesian/spaces/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when there is no effective org (no-org fallback)', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/bayesian/spaces/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(mockSpaceUpsert).not.toHaveBeenCalled();
  });

  it('creates/upserts the space under the ACTIVE brand, not the home org', async () => {
    const { POST } = await import('@/app/api/bayesian/spaces/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(201);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);

    // Count (limit gate) and upsert (the WRITE) both target the active brand.
    expect(mockSpaceCount).toHaveBeenCalledWith({
      where: { orgId: ACTIVE_BRAND },
    });
    const upsertArgs = mockSpaceUpsert.mock.calls[0][0];
    expect(upsertArgs.where.orgId_surface.orgId).toBe(ACTIVE_BRAND);
    expect(upsertArgs.create.orgId).toBe(ACTIVE_BRAND);
    expect(upsertArgs.create.orgId).not.toBe(HOME_ORG);

    // Plan lookup for the active brand's organisation.
    expect(mockOrganizationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACTIVE_BRAND } })
    );
    // Owner/admin bypass: the user lookup is scoped to the authenticated user
    // (to check owner/admin), NOT used to derive the org — org scope verified above.
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { email: true, preferences: true },
    });
  });
});
