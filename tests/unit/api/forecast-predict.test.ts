/**
 * Unit tests — Forecast Predict (POST /api/forecast/predict)
 *
 * Brand-scope guard (mirrors PR #434): a brand-switched multi-business owner
 * must read/write the ACTIVE brand's forecasts, resolved via
 * getEffectiveOrganizationId(userId), NOT the home organizationId.
 *
 * Covers:
 *   - 401 on missing auth
 *   - 403 no-org fallback preserved (null effective org)
 *   - count + model read + forecast create are scoped to the ACTIVE brand
 *   - plan is read from the ACTIVE brand's organisation
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

const mockOrganizationFindUnique = jest.fn();
const mockForecastCount = jest.fn();
const mockForecastCreate = jest.fn();
const mockForecastModelFindFirst = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrganizationFindUnique },
    forecast: { count: mockForecastCount, create: mockForecastCreate },
    forecastModel: { findFirst: mockForecastModelFindFirst },
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

// ── Forecasting client mock ──────────────────────────────────────────────────

const mockPredictForecast = jest.fn();
const mockGetForecastingClient = jest.fn();

jest.mock('@/lib/forecasting/client', () => ({
  getForecastingClient: () => mockGetForecastingClient(),
}));

// ── Feature limits mock — keep gates permissive ──────────────────────────────

jest.mock('@/lib/forecasting/feature-limits', () => ({
  isHorizonAllowed: () => true,
  isWithinForecastLimit: () => true,
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-active-brand';
const MODEL_ID = 'model-001';

function makePostRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/forecast/predict',
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
  mockForecastCount.mockResolvedValue(0);
  mockForecastModelFindFirst.mockResolvedValue({
    id: MODEL_ID,
    orgId: ACTIVE_BRAND,
    status: 'ready',
  });
  mockPredictForecast.mockResolvedValue({ predictions: [{ ds: '2026-01-01', yhat: 10 }] });
  mockGetForecastingClient.mockReturnValue({ predictForecast: mockPredictForecast });
  mockForecastCreate.mockResolvedValue({ id: 'forecast-001' });
});

describe('POST /api/forecast/predict — brand scope', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/forecast/predict/route');
    const res = await POST(makePostRequest({ modelId: MODEL_ID, horizonDays: 7 }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 (no-org fallback) when there is no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/forecast/predict/route');
    const res = await POST(makePostRequest({ modelId: MODEL_ID, horizonDays: 7 }) as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(mockForecastCreate).not.toHaveBeenCalled();
  });

  it('scopes count, model read and forecast create to the ACTIVE brand', async () => {
    const { POST } = await import('@/app/api/forecast/predict/route');
    const res = await POST(makePostRequest({ modelId: MODEL_ID, horizonDays: 7 }) as never);
    expect(res.status).toBe(200);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);

    // Monthly count scoped to the active brand.
    expect(mockForecastCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ACTIVE_BRAND }),
      })
    );
    // Model lookup scoped to the active brand.
    expect(mockForecastModelFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MODEL_ID, orgId: ACTIVE_BRAND } })
    );
    // Persisted forecast carries the active brand.
    expect(mockForecastCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: ACTIVE_BRAND, modelId: MODEL_ID }),
      })
    );
    // Plan resolved from the active brand's organisation, not the home org.
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

  it('uses HOME org when that is the effective org (regular user, no brand switch)', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(HOME_ORG);
    mockForecastModelFindFirst.mockResolvedValue({ id: MODEL_ID, orgId: HOME_ORG, status: 'ready' });
    const { POST } = await import('@/app/api/forecast/predict/route');
    const res = await POST(makePostRequest({ modelId: MODEL_ID, horizonDays: 7 }) as never);
    expect(res.status).toBe(200);
    expect(mockForecastModelFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MODEL_ID, orgId: HOME_ORG } })
    );
  });
});
