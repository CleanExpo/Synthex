/**
 * Unit tests — SYN-595 Deliver Advisor Brief
 *
 * Covers:
 *  - POST /api/internal/deliver-advisor-brief (CRON_SECRET auth, email delivery)
 *
 * Validates:
 *   - 401 on missing/invalid CRON_SECRET
 *   - Finds generated briefs and delivers via email (mock sendAdvisorBriefEmail)
 *   - Updates brief status to 'delivered' on email success
 *   - Counts emailFailed when email send fails
 *   - Skips briefs with no recipient email
 *   - Returns 0 delivered when no briefs are pending
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

const mockRecommendedActionFindMany = jest.fn();
const mockRecommendedActionUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    recommendedAction: {
      findMany: mockRecommendedActionFindMany,
      update: mockRecommendedActionUpdate,
    },
  },
}));

// ── Email mock ────────────────────────────────────────────────────────────────

const mockSendAdvisorBriefEmail = jest.fn();

jest.mock('@/lib/email/advisor-brief-email', () => ({
  sendAdvisorBriefEmail: (...args: unknown[]) => mockSendAdvisorBriefEmail(...args),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-deliver-secret-xyz';
const BRIEF_ID = 'brief-deliver-001';
const ORG_ID = 'org-deliver-001';

const MOCK_ACTIONS = [
  { rank: 1, title: 'Reply to reviews', rationale: '3 reviews pending.', effort: 'low', expectedImpact: '+12%' },
  { rank: 2, title: 'Schedule posts', rationale: 'Peak on Thursday.', effort: 'low', expectedImpact: '+53% reach' },
  { rank: 3, title: 'Add schema', rationale: 'Authority 45/100.', effort: 'medium', expectedImpact: 'GEO eligible' },
];

const MOCK_BRIEF_WITH_ORG = {
  id: BRIEF_ID,
  organizationId: ORG_ID,
  status: 'generated',
  weekStart: new Date('2026-03-31'),
  actions: MOCK_ACTIONS,
  dollarAttribution: '$2,800 worth of jobs',
  geoTeaserText: 'Authority score 45/100 — top 30% of local plumbers in AI search.',
  competitorMicroInsight: 'fastplumbers.com.au ranks for "emergency plumber melbourne" — you don\'t.',
  organization: {
    id: ORG_ID,
    name: 'Capital Plumbing Canberra',
    billingEmail: 'owner@capitalplumbing.com.au',
    users: [{ email: 'owner@capitalplumbing.com.au' }],
  },
};

function makeRequest(body: object = {}, secret = CRON_SECRET) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/internal/deliver-advisor-brief',
    headers: { authorization: `Bearer ${secret}` },
    body,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET;
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  mockRecommendedActionFindMany.mockResolvedValue([MOCK_BRIEF_WITH_ORG]);
  mockRecommendedActionUpdate.mockResolvedValue({ ...MOCK_BRIEF_WITH_ORG, status: 'delivered' });
  mockSendAdvisorBriefEmail.mockResolvedValue({ success: true });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when authorization header is missing', async () => {
    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    const req = createMockNextRequest({ method: 'POST', body: {} });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorised');
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    const req = makeRequest({}, 'wrong-secret');
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});

// ── Delivery ──────────────────────────────────────────────────────────────────

describe('Brief delivery', () => {
  it('delivers briefs via email and updates status', async () => {
    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.delivered).toBe(1);
    expect(json.emailFailed).toBe(0);
    expect(json.skipped).toBe(0);

    // Verify email was called with correct params
    expect(mockSendAdvisorBriefEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendAdvisorBriefEmail.mock.calls[0][0];
    expect(emailCall.to).toBe('owner@capitalplumbing.com.au');
    expect(emailCall.businessName).toBe('Capital Plumbing Canberra');
    expect(emailCall.dollarAttribution).toBe('$2,800 worth of jobs');
    expect(emailCall.actions).toEqual(MOCK_ACTIONS);
    expect(emailCall.briefId).toBe(BRIEF_ID);

    // Verify status updated to delivered
    expect(mockRecommendedActionUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockRecommendedActionUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: BRIEF_ID });
    expect(updateCall.data.status).toBe('delivered');
    expect(updateCall.data.deliveredAt).toBeInstanceOf(Date);
  });

  it('counts emailFailed when email send returns failure', async () => {
    mockSendAdvisorBriefEmail.mockResolvedValue({ success: false, error: 'SMTP timeout' });

    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(json.delivered).toBe(0);
    expect(json.emailFailed).toBe(1);
    // Should NOT update status on email failure
    expect(mockRecommendedActionUpdate).not.toHaveBeenCalled();
  });

  it('skips briefs when org has no email address', async () => {
    mockRecommendedActionFindMany.mockResolvedValue([
      {
        ...MOCK_BRIEF_WITH_ORG,
        organization: {
          id: ORG_ID,
          name: 'No Email Org',
          billingEmail: null,
          users: [],
        },
      },
    ]);

    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(json.skipped).toBe(1);
    expect(json.delivered).toBe(0);
    expect(mockSendAdvisorBriefEmail).not.toHaveBeenCalled();
  });

  it('uses first user email when billingEmail is null', async () => {
    mockRecommendedActionFindMany.mockResolvedValue([
      {
        ...MOCK_BRIEF_WITH_ORG,
        organization: {
          id: ORG_ID,
          name: 'Fallback Email Org',
          billingEmail: null,
          users: [{ email: 'fallback@example.com' }],
        },
      },
    ]);

    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    await POST(makeRequest() as never);

    expect(mockSendAdvisorBriefEmail).toHaveBeenCalledTimes(1);
    expect(mockSendAdvisorBriefEmail.mock.calls[0][0].to).toBe('fallback@example.com');
  });
});

// ── No pending briefs ────────────────────────────────────────────────────────

describe('No pending briefs', () => {
  it('returns 0 delivered when no briefs are pending delivery', async () => {
    mockRecommendedActionFindMany.mockResolvedValue([]);

    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.delivered).toBe(0);
    expect(json.emailFailed).toBe(0);
    expect(json.skipped).toBe(0);
    expect(mockSendAdvisorBriefEmail).not.toHaveBeenCalled();
  });
});

// ── Org-scoped delivery ──────────────────────────────────────────────────────

describe('Org-scoped delivery', () => {
  it('passes organizationId filter when provided in body', async () => {
    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    await POST(makeRequest({ organizationId: 'org-specific-001' }) as never);

    expect(mockRecommendedActionFindMany).toHaveBeenCalledTimes(1);
    const findCall = mockRecommendedActionFindMany.mock.calls[0][0];
    expect(findCall.where.organizationId).toBe('org-specific-001');
    expect(findCall.where.status).toBe('generated');
  });

  it('does not filter by org when body is empty', async () => {
    const { POST } = await import('@/app/api/internal/deliver-advisor-brief/route');
    await POST(makeRequest({}) as never);

    const findCall = mockRecommendedActionFindMany.mock.calls[0][0];
    expect(findCall.where).toEqual({ status: 'generated' });
  });
});
