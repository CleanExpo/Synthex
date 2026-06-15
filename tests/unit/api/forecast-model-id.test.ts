/**
 * Unit tests — Forecast Model Status (GET /api/forecast/[modelId])
 *
 * Brand-scope guard (mirrors PR #434): a brand-switched multi-business owner
 * must resolve the ACTIVE brand's model via getEffectiveOrganizationId(userId),
 * NOT the home organizationId — otherwise the owner gets a 404 for the active
 * brand's model.
 *
 * Covers:
 *   - 401 on missing auth
 *   - 404 no-org fallback preserved (null effective org)
 *   - model lookup scoped to the ACTIVE brand
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
const mockForecastModelFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
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

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const ACTIVE_BRAND = 'org-active-brand';
const MODEL_ID = 'model-001';

function makeGetRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: `http://localhost/api/forecast/${MODEL_ID}`,
  });
}

const params = Promise.resolve({ modelId: MODEL_ID });

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  mockGetUserId.mockResolvedValue(USER_ID);
  mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
  mockForecastModelFindFirst.mockResolvedValue({
    id: MODEL_ID,
    orgId: ACTIVE_BRAND,
    forecasts: [],
  });
});

describe('GET /api/forecast/[modelId] — brand scope', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/forecast/[modelId]/route');
    const res = await GET(makeGetRequest() as never, { params } as never);
    expect(res.status).toBe(401);
  });

  it('returns 404 (no-org fallback) when there is no active brand', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/forecast/[modelId]/route');
    const res = await GET(makeGetRequest() as never, { params } as never);
    expect(res.status).toBe(404);
    expect(mockForecastModelFindFirst).not.toHaveBeenCalled();
  });

  it('resolves the model scoped to the ACTIVE brand, not the home org', async () => {
    const { GET } = await import('@/app/api/forecast/[modelId]/route');
    const res = await GET(makeGetRequest() as never, { params } as never);
    expect(res.status).toBe(200);

    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    expect(mockForecastModelFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MODEL_ID, orgId: ACTIVE_BRAND } })
    );
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});
