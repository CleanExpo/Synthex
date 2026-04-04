/**
 * Unit tests — SYN-594 Advisor Feedback
 *
 * Covers:
 *  - POST /api/advisor/feedback — record weekly brief feedback
 *
 * Validates:
 *   - 401 on missing auth
 *   - 403 when user has no organisation
 *   - 400 for missing/invalid fields
 *   - 201 on successful upsert
 *   - Prisma upsert called with correct composite key
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
const mockAdvisorFeedbackUpsert = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    advisorFeedback: { upsert: mockAdvisorFeedbackUpsert },
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

const USER_ID = 'user-feedback-001';
const ORG_ID = 'org-feedback-001';
const WEEK_START = '2026-03-31';

function makeRequest(body: object = {}) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/advisor/feedback',
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
  mockAdvisorFeedbackUpsert.mockResolvedValue({
    id: 'fb-001',
    organizationId: ORG_ID,
    weekStart: new Date(WEEK_START),
    response: 'useful',
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ weekStart: WEEK_START, response: 'useful' }) as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when user has no organisation', async () => {
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ weekStart: WEEK_START, response: 'useful' }) as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('No organisation found');
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('Validation', () => {
  it('returns 400 when weekStart is missing', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ response: 'useful' }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
  });

  it('returns 400 when response is missing', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ weekStart: WEEK_START }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when weekStart has invalid format', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ weekStart: '31/03/2026', response: 'useful' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when response is not an allowed value', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ weekStart: WEEK_START, response: 'great' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
  });
});

// ── Successful upsert ────────────────────────────────────────────────────────

describe('Successful feedback', () => {
  it('upserts feedback and returns 201', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ weekStart: WEEK_START, response: 'useful' }) as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.feedback).toBeDefined();
    expect(json.feedback.id).toBe('fb-001');
  });

  it('calls prisma.advisorFeedback.upsert with correct composite key', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    await POST(makeRequest({ weekStart: WEEK_START, response: 'not_useful' }) as never);

    expect(mockAdvisorFeedbackUpsert).toHaveBeenCalledTimes(1);
    const call = mockAdvisorFeedbackUpsert.mock.calls[0][0];

    // Composite unique key
    expect(call.where).toEqual({
      advisor_feedback_org_week: {
        organizationId: ORG_ID,
        weekStart: new Date(WEEK_START),
      },
    });

    // Create payload
    expect(call.create).toEqual({
      organizationId: ORG_ID,
      weekStart: new Date(WEEK_START),
      response: 'not_useful',
    });

    // Update payload
    expect(call.update).toEqual({ response: 'not_useful' });
  });

  it('accepts "skipped" as a valid response value', async () => {
    const { POST } = await import('@/app/api/advisor/feedback/route');
    const res = await POST(makeRequest({ weekStart: WEEK_START, response: 'skipped' }) as never);
    expect(res.status).toBe(201);
  });
});
