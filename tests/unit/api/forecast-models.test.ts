/**
 * Unit tests — Forecast Models (GET + POST /api/forecast/models)
 *
 * Brand-scope guard (mirrors PR #434): a brand-switched multi-business owner
 * must list/create/train models under the ACTIVE brand, resolved via
 * getEffectiveOrganizationId(userId), NOT the home organizationId.
 *
 * Covers:
 *   - 401 on missing auth (GET + POST)
 *   - GET no-org fallback preserved ({ data: [] })
 *   - GET lists models scoped to the ACTIVE brand
 *   - POST 403 no-org fallback preserved
 *   - POST creates the model under the ACTIVE brand
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
const mockForecastModelFindMany = jest.fn();
const mockForecastModelFindFirst = jest.fn();
const mockForecastModelCount = jest.fn();
const mockForecastModelCreate = jest.fn();
const mockForecastModelUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrganizationFindUnique },
    forecastModel: {
      findMany: mockForecastModelFindMany,
      findFirst: mockForecastModelFindFirst,
      count: mockForecastModelCount,
      create: mockForecastModelCreate,
      update: mockForecastModelUpdate,
    },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// ── Multi-business scope mock ────────────────────────────────────────────────

const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ── Forecasting libs mock — keep gates permissive ────────────────────────────

jest.mock('@/lib/forecasting/client', () => ({
  // Null client → route takes the create/upsert-with-pending path (202).
  getForecastingClient: () => null,
}));

jest.mock('@/lib/forecasting/feature-limits', () => ({
  getForecastFeatureLimits: () => ({ forecastModels: 15 }),
  isWithinForecastLimit: () => true,
}));

jest.mock('@/lib/forecasting/metrics', () => ({
  FORECAST_METRICS: {
    engagement_rate: { minDataPoints: 1 },
  },
}));

const mockCollectTrainingData = jest.fn();

jest.mock('@/lib/forecasting/collect-training-data', () => ({
  collectTrainingData: (...args: unknown[]) => mockCollectTrainingData(...args),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const ACTIVE_BRAND = 'org-active-brand';

function makeGetRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/forecast/models',
  });
}

function makePostRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/forecast/models',
    body,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  mockGetUserId.mockResolvedValue(USER_ID);
  mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
  mockOrganizationFindUnique.mockResolvedValue({ plan: 'growth' });
  // Non-owner user → owner/admin bypass is inactive, raw org plan is used.
  mockUserFindUnique.mockResolvedValue({ email: 'member@example.com', preferences: null });
  mockForecastModelFindMany.mockResolvedValue([]);
  mockForecastModelFindFirst.mockResolvedValue(null);
  mockForecastModelCount.mockResolvedValue(0);
  mockForecastModelCreate.mockResolvedValue({ id: 'model-new', orgId: ACTIVE_BRAND });
  mockCollectTrainingData.mockResolvedValue([{ ds: '2026-01-01', y: 1 }]);
});

describe('GET /api/forecast/models — brand scope', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/forecast/models/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns { data: [] } no-org fallback when there is no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/forecast/models/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: [] });
    expect(mockForecastModelFindMany).not.toHaveBeenCalled();
  });

  it('lists models scoped to the ACTIVE brand, not the home org', async () => {
    const { GET } = await import('@/app/api/forecast/models/route');
    await GET(makeGetRequest() as never);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    expect(mockForecastModelFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: ACTIVE_BRAND } })
    );
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/forecast/models — brand scope', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/forecast/models/route');
    const res = await POST(makePostRequest({ metric: 'engagement_rate' }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 (no-org fallback) when there is no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/forecast/models/route');
    const res = await POST(makePostRequest({ metric: 'engagement_rate' }) as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(mockForecastModelCreate).not.toHaveBeenCalled();
  });

  it('creates/trains the model under the ACTIVE brand', async () => {
    const { POST } = await import('@/app/api/forecast/models/route');
    const res = await POST(makePostRequest({ metric: 'engagement_rate' }) as never);
    expect(res.status).toBe(202);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    // Count + training collection + create all carry the active brand.
    expect(mockForecastModelCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: ACTIVE_BRAND } })
    );
    expect(mockCollectTrainingData).toHaveBeenCalledWith(
      ACTIVE_BRAND,
      'engagement_rate',
      undefined
    );
    expect(mockForecastModelCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: ACTIVE_BRAND, userId: USER_ID }),
      })
    );
    // Plan resolved from the active brand's organisation.
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
