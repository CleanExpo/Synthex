/**
 * Unit tests — POST /api/predict/train brand-scope (wrong-brand WRITE)
 *
 * Verifies the route resolves the org via getEffectiveOrganizationId (the
 * ACTIVE brand for a brand-switched multi-business owner), NOT the home org
 * (user.organizationId). Without the fix a brand-switched owner collects
 * training data (PlatformConnection/PlatformPost/PlatformMetrics) AND upserts
 * the SpatiotemporalModel under the WRONG brand.
 *
 * Validates:
 *   - 401 on missing auth
 *   - 403 no-org fallback preserved (effective org null)
 *   - training-data collection + model upsert target the ACTIVE brand
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
const mockModelCount = jest.fn();
const mockModelUpsert = jest.fn();
const mockConnectionFindMany = jest.fn();
const mockPostFindMany = jest.fn();
const mockMetricsFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrganizationFindUnique },
    spatiotemporalModel: { count: mockModelCount, upsert: mockModelUpsert },
    platformConnection: { findMany: mockConnectionFindMany },
    platformPost: { findMany: mockPostFindMany },
    platformMetrics: { findMany: mockMetricsFindMany },
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

// ── Forecasting client mock — null forces the pending-upsert (202) path ───────

const mockGetForecastingClient = jest.fn();
jest.mock('@/lib/forecasting/client', () => ({
  getForecastingClient: (...args: unknown[]) =>
    mockGetForecastingClient(...args),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

const USER_ID = 'user-001';
const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-active-brand';

function makePostRequest() {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/predict/train',
    body: { name: 'cross_platform_engagement', targetMetric: 'engagement_rate' },
  });
}

// Build >=14 daily metric records so the route passes the minimum-data gate.
function buildMetrics() {
  return Array.from({ length: 20 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, i + 1));
    return {
      engagementRate: 0.1 + i / 100,
      impressions: 100,
      reach: 80,
      clicks: 5,
      saves: 2,
      recordedAt: d,
    };
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  mockGetUserId.mockResolvedValue(USER_ID);
  mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
  mockOrganizationFindUnique.mockResolvedValue({ plan: 'scale' });
  // Non-owner user → owner/admin bypass is inactive, raw org plan is used.
  mockUserFindUnique.mockResolvedValue({ email: 'member@example.com', preferences: null });
  mockModelCount.mockResolvedValue(0);
  mockConnectionFindMany.mockResolvedValue([
    { id: 'conn-1', platform: 'instagram' },
  ]);
  mockPostFindMany.mockResolvedValue([{ id: 'post-1' }]);
  mockMetricsFindMany.mockResolvedValue(buildMetrics());
  // Null client → route upserts a pending model and returns 202.
  mockGetForecastingClient.mockReturnValue(null);
  mockModelUpsert.mockImplementation(async (args: { create: { orgId: string } }) => ({
    id: 'model-1',
    orgId: args.create.orgId,
  }));
});

describe('POST /api/predict/train', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/predict/train/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when there is no effective organisation (no-org fallback)', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/predict/train/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(mockModelUpsert).not.toHaveBeenCalled();
  });

  it('collects training data + upserts the model under the ACTIVE brand', async () => {
    const { POST } = await import('@/app/api/predict/train/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(202);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);

    // Training-data collection is scoped to the active brand.
    expect(mockConnectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ACTIVE_BRAND, isActive: true },
      })
    );

    // The model upsert (the WRITE) targets the active brand.
    const upsertArgs = mockModelUpsert.mock.calls[0][0];
    expect(upsertArgs.where.orgId_name.orgId).toBe(ACTIVE_BRAND);
    expect(upsertArgs.create.orgId).toBe(ACTIVE_BRAND);
    expect(upsertArgs.create.orgId).not.toBe(HOME_ORG);

    // Model-count limit check scoped to the active brand.
    expect(mockModelCount).toHaveBeenCalledWith({
      where: { orgId: ACTIVE_BRAND },
    });

    // Plan lookup is for the active brand's organisation.
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
