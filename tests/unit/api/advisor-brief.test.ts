/**
 * Unit tests — SYN-595 AI Advisor Brief (GET + PATCH)
 *
 * Covers:
 *  - GET  /api/advisor/brief — fetch latest delivered brief
 *  - PATCH /api/advisor/brief — mark an action as done
 *
 * Validates:
 *   - 401 on missing auth (GET + PATCH)
 *   - GET returns latest delivered brief
 *   - GET returns null when no brief exists
 *   - PATCH marks action as done (JSON mutation + Prisma.InputJsonValue cast)
 *   - PATCH returns 400 for invalid actionIndex
 *   - PATCH returns 404 when no brief exists
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

  return { NextResponse: MockNextResponse, NextRequest: class extends Request {} };
});

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockUserFindUnique = jest.fn();
const mockRecommendedActionFindFirst = jest.fn();
const mockRecommendedActionUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    recommendedAction: {
      findFirst: mockRecommendedActionFindFirst,
      update: mockRecommendedActionUpdate,
    },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const ORG_ID = 'org-001';
const BRIEF_ID = 'brief-001';

const MOCK_ACTIONS = [
  { rank: 1, title: 'Reply to 3 unanswered reviews', rationale: 'You have 3 reviews.', effort: 'low', expectedImpact: '+12%' },
  { rank: 2, title: 'Schedule 2 posts', rationale: 'Peak on Thursday.', effort: 'low', expectedImpact: '+53% reach' },
  { rank: 3, title: 'Add schema markup', rationale: 'Authority 45/100.', effort: 'medium', expectedImpact: 'GEO eligibility' },
];

const MOCK_BRIEF = {
  id: BRIEF_ID,
  organizationId: ORG_ID,
  status: 'delivered',
  weekStart: new Date('2026-03-31'),
  actions: MOCK_ACTIONS,
  dollarAttribution: '$2,800 worth of jobs',
  geoTeaserText: null,
  competitorMicroInsight: null,
};

function makeGetRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/advisor/brief',
  });
}

function makePatchRequest(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost/api/advisor/brief',
    body,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Default: authenticated user with org
  mockGetUserId.mockResolvedValue(USER_ID);
  mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
  mockRecommendedActionFindFirst.mockResolvedValue(MOCK_BRIEF);
  mockRecommendedActionUpdate.mockResolvedValue({ ...MOCK_BRIEF, actions: MOCK_ACTIONS });
});

// ── GET /api/advisor/brief ──────────────────────────────────────────────────

describe('GET /api/advisor/brief', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/advisor/brief/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when user has no organisation', async () => {
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { GET } = await import('@/app/api/advisor/brief/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('No organisation found');
  });

  it('returns the latest delivered brief', async () => {
    const { GET } = await import('@/app/api/advisor/brief/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.brief).toBeDefined();
    expect(json.brief.id).toBe(BRIEF_ID);
    expect(mockRecommendedActionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, status: 'delivered' },
        orderBy: { weekStart: 'desc' },
      })
    );
  });

  it('returns null when no brief exists', async () => {
    mockRecommendedActionFindFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/advisor/brief/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.brief).toBeNull();
  });
});

// ── PATCH /api/advisor/brief ────────────────────────────────────────────────

describe('PATCH /api/advisor/brief', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { PATCH } = await import('@/app/api/advisor/brief/route');
    const res = await PATCH(makePatchRequest({ actionIndex: 0 }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid actionIndex (negative)', async () => {
    const { PATCH } = await import('@/app/api/advisor/brief/route');
    const res = await PATCH(makePatchRequest({ actionIndex: -1 }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
  });

  it('returns 400 for invalid actionIndex (exceeds max)', async () => {
    const { PATCH } = await import('@/app/api/advisor/brief/route');
    const res = await PATCH(makePatchRequest({ actionIndex: 5 }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer actionIndex', async () => {
    const { PATCH } = await import('@/app/api/advisor/brief/route');
    const res = await PATCH(makePatchRequest({ actionIndex: 1.5 }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing actionIndex', async () => {
    const { PATCH } = await import('@/app/api/advisor/brief/route');
    const res = await PATCH(makePatchRequest({}) as never);
    expect(res.status).toBe(400);
  });

  it('returns 404 when no brief exists for PATCH', async () => {
    mockRecommendedActionFindFirst.mockResolvedValue(null);
    const { PATCH } = await import('@/app/api/advisor/brief/route');
    const res = await PATCH(makePatchRequest({ actionIndex: 0 }) as never);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('No brief found');
  });

  it('marks an action as done and persists via Prisma update', async () => {
    const updatedBrief = {
      ...MOCK_BRIEF,
      actions: MOCK_ACTIONS.map((a, i) =>
        i === 1 ? { ...a, completed_at: expect.any(String) } : a
      ),
    };
    mockRecommendedActionUpdate.mockResolvedValue(updatedBrief);

    const { PATCH } = await import('@/app/api/advisor/brief/route');
    const res = await PATCH(makePatchRequest({ actionIndex: 1 }) as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.brief).toBeDefined();

    // Verify Prisma update was called with correct structure
    expect(mockRecommendedActionUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockRecommendedActionUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: BRIEF_ID });
    expect(updateCall.data.actions).toBeInstanceOf(Array);
    // The mutated action at index 1 should have completed_at
    expect(updateCall.data.actions[1]).toHaveProperty('completed_at');
    // Action at index 0 should NOT have completed_at
    expect(updateCall.data.actions[0]).not.toHaveProperty('completed_at');
  });
});
