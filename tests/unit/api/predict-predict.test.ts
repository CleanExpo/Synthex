/**
 * Unit tests — POST /api/predict/predict brand-scope (wrong-brand WRITE/READ)
 *
 * Verifies the route resolves the org via getEffectiveOrganizationId (the
 * ACTIVE brand for a brand-switched multi-business owner), NOT the home org
 * (user.organizationId). Without the fix a brand-switched owner resolves the
 * model + auto-builds prediction points under the WRONG brand.
 *
 * Validates:
 *   - 401 on missing auth
 *   - 403 no-org fallback preserved (effective org null)
 *   - model lookup + point auto-build target the ACTIVE brand
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
const mockModelFindFirst = jest.fn();
const mockConnectionFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrganizationFindUnique },
    spatiotemporalModel: { findFirst: mockModelFindFirst },
    platformConnection: { findMany: mockConnectionFindMany },
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

// ── Forecasting client mock ───────────────────────────────────────────────────

const mockPredictSpatiotemporal = jest.fn();
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
const MODEL_ID = 'model-1';

function makePostRequest(body: object = { modelId: MODEL_ID }) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/predict/predict',
    body,
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
  mockModelFindFirst.mockResolvedValue({
    id: MODEL_ID,
    orgId: ACTIVE_BRAND,
    status: 'ready',
  });
  mockConnectionFindMany.mockResolvedValue([{ platform: 'instagram' }]);
  mockPredictSpatiotemporal.mockResolvedValue({ predictions: [] });
  mockGetForecastingClient.mockReturnValue({
    predictSpatiotemporal: mockPredictSpatiotemporal,
  });
});

describe('POST /api/predict/predict', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/predict/predict/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when there is no effective organisation (no-org fallback)', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/predict/predict/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(mockModelFindFirst).not.toHaveBeenCalled();
  });

  it('resolves the model + auto-builds points under the ACTIVE brand', async () => {
    const { POST } = await import('@/app/api/predict/predict/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(200);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);

    // Model lookup constrained to the active brand (prevents predicting
    // against another brand's model).
    expect(mockModelFindFirst).toHaveBeenCalledWith({
      where: { id: MODEL_ID, orgId: ACTIVE_BRAND },
    });

    // Auto-build of prediction points pulls the active brand's connections.
    expect(mockConnectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ACTIVE_BRAND, isActive: true },
      })
    );

    // Sanity: home org was never the scope.
    const modelCall = mockModelFindFirst.mock.calls[0][0];
    expect(modelCall.where.orgId).not.toBe(HOME_ORG);
    // Owner/admin bypass: the user lookup is scoped to the authenticated user
    // (to check owner/admin), NOT used to derive the org — org scope verified above.
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { email: true, preferences: true },
    });
  });
});
