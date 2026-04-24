/**
 * Unit tests — SYN-795 POST /api/internal/validate-attribution
 *
 * Covers:
 *   - 401 on unauthenticated / wrong bearer
 *   - 400 on invalid body (unknown model)
 *   - 200 happy path: produces accuracy_score from engine output
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
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
  return { ...actual, NextResponse: MockNextResponse };
});

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockLeadFindMany = jest.fn();
const mockEventFindMany = jest.fn();
const mockRecommendedActionCount = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    lead: {
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
    },
    clientEngagementEvent: {
      findMany: (...args: unknown[]) => mockEventFindMany(...args),
    },
    recommendedAction: {
      count: (...args: unknown[]) => mockRecommendedActionCount(...args),
    },
  },
}));

// ── Supabase mock (runner writes logs; must not fail) ─────────────────────────

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Fixture helpers ───────────────────────────────────────────────────────────

function dec(n: number) {
  return { toNumber: () => n };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/internal/validate-attribution', () => {
  const CRON_SECRET = 'test-validate-attr-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.CRON_SECRET = CRON_SECRET;
    delete process.env.CRON_SECRET_VALIDATE_ATTRIBUTION;

    // default: no leads, no events, no recommended actions
    mockLeadFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);
    mockRecommendedActionCount.mockResolvedValue(0);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns 401 when Bearer token does not match', async () => {
    const { POST } =
      await import('@/app/api/internal/validate-attribution/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
      body: {},
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body has an unknown model', async () => {
    const { POST } =
      await import('@/app/api/internal/validate-attribution/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
      body: { model: 'unknown-model' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid body');
  });

  it('returns 200 with accuracy_score=1 when every lead has a matching touchpoint', async () => {
    // One org with one verified lead, one matching UTM event.
    const leadOccurred = new Date();
    const eventAt = new Date(leadOccurred.getTime() - 1000 * 60 * 60);

    // First findMany call = distinct org scan; second call = per-org leads.
    mockLeadFindMany
      .mockResolvedValueOnce([{ organizationId: 'org-1' }])
      .mockResolvedValueOnce([
        {
          id: 'lead-1',
          organizationId: 'org-1',
          source: 'google',
          medium: null,
          campaign: null,
          occurredAt: leadOccurred,
          attributionWindowDays: 30,
          verifiedRevenueAud: dec(500),
          revenueEstimateAud: null,
          rawPayload: {},
        },
      ]);

    mockEventFindMany.mockResolvedValueOnce([
      {
        id: 'e-1',
        clientId: 'org-1',
        eventType: 'dashboard_visit',
        eventData: { utm_source: 'google' },
        sessionId: 'sess-1',
        createdAt: eventAt,
      },
    ]);

    mockRecommendedActionCount
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(8); // matched

    const { POST } =
      await import('@/app/api/internal/validate-attribution/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
      body: { days: 7, model: 'linear' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.model).toBe('linear');
    expect(body.accuracy_score).toBeCloseTo(1, 6);
    expect(body.completeness_score).toBeCloseTo(0.8, 6);
    expect(body.leads_considered).toBe(1);
    expect(body.leads_matched).toBe(1);
    expect(body.total_revenue_aud).toBeCloseTo(500, 6);
    expect(body.matched_revenue_aud).toBeCloseTo(500, 6);
  });

  it('returns accuracy_score=null when there is no verified revenue in window', async () => {
    mockLeadFindMany.mockResolvedValueOnce([]); // no orgs with verified leads
    const { POST } =
      await import('@/app/api/internal/validate-attribution/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
      body: {},
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accuracy_score).toBeNull();
    expect(body.model).toBe('time-decay');
  });
});
