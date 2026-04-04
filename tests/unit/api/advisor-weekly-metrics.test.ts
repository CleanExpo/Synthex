/**
 * Unit tests — SYN-594 Advisor Weekly Metrics
 *
 * Covers:
 *  - POST /api/internal/advisor-weekly-metrics (CRON_SECRET auth, metrics computation)
 *
 * Validates:
 *   - 401 on missing/invalid CRON_SECRET
 *   - Marks skipped briefs and computes metrics
 *   - Handles empty data gracefully (no briefs, no feedback)
 *   - Posts metrics to Slack when webhook configured
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
const mockAdvisorFeedbackFindUnique = jest.fn();
const mockAdvisorFeedbackCreate = jest.fn();
const mockAdvisorFeedbackFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    recommendedAction: { findMany: mockRecommendedActionFindMany },
    advisorFeedback: {
      findUnique: mockAdvisorFeedbackFindUnique,
      create: mockAdvisorFeedbackCreate,
      findMany: mockAdvisorFeedbackFindMany,
    },
  },
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-metrics';
const ORG_A = 'org-metrics-001';
const ORG_B = 'org-metrics-002';

// Target a specific Monday so tests are deterministic
const TARGET_MONDAY = '2026-03-23';

function makeRequest(body: object = {}, secret = CRON_SECRET) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/internal/advisor-weekly-metrics',
    headers: { authorization: `Bearer ${secret}` },
    body,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const originalFetch = global.fetch;

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  // Mock fetch so Slack webhook calls don't hit the network
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  // Re-set the fetch mock after clearAllMocks wipes implementation
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  mockAdvisorFeedbackCreate.mockResolvedValue({ id: 'fb-001' });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when authorization header is missing', async () => {
    const { POST } = await import('@/app/api/internal/advisor-weekly-metrics/route');
    const req = createMockNextRequest({ method: 'POST', body: {} });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const { POST } = await import('@/app/api/internal/advisor-weekly-metrics/route');
    const req = makeRequest({}, 'wrong-secret');
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});

// ── Mark skipped + compute metrics ───────────────────────────────────────────

describe('Marks skipped briefs and computes metrics', () => {
  beforeEach(() => {
    // Two delivered briefs for the target week
    mockRecommendedActionFindMany
      // First call: delivered briefs for skipped check
      .mockResolvedValueOnce([
        { id: 'ra-001', organizationId: ORG_A, weekStart: new Date(TARGET_MONDAY) },
        { id: 'ra-002', organizationId: ORG_B, weekStart: new Date(TARGET_MONDAY) },
      ])
      // Second call: delivered briefs for action completion counting
      .mockResolvedValueOnce([
        {
          actions: [
            { rank: 1, title: 'Reply to reviews', completed_at: '2026-03-25T10:00:00Z' },
            { rank: 2, title: 'Schedule posts', completed_at: null },
            { rank: 3, title: 'Add schema', completed_at: null },
          ],
        },
        {
          actions: [
            { rank: 1, title: 'Post content', completed_at: '2026-03-24T09:00:00Z' },
            { rank: 2, title: 'Respond to comments', completed_at: '2026-03-26T11:00:00Z' },
          ],
        },
      ]);

    // ORG_A has existing feedback (useful), ORG_B has none → will be marked skipped
    mockAdvisorFeedbackFindUnique
      .mockResolvedValueOnce({ id: 'fb-existing', response: 'useful' }) // ORG_A
      .mockResolvedValueOnce(null); // ORG_B → no feedback → skipped

    // All feedback for the week (after skipping)
    mockAdvisorFeedbackFindMany.mockResolvedValue([
      { response: 'useful', organizationId: ORG_A, weekStart: new Date(TARGET_MONDAY) },
      { response: 'skipped', organizationId: ORG_B, weekStart: new Date(TARGET_MONDAY) },
    ]);
  });

  it('marks 1 skipped brief and returns correct metrics', async () => {
    const { POST } = await import('@/app/api/internal/advisor-weekly-metrics/route');
    const res = await POST(makeRequest({ weekStart: TARGET_MONDAY }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.autoMarkedSkipped).toBe(1);
    expect(json.delivered).toBe(2);
    expect(json.usefulCount).toBe(1);
    expect(json.notUsefulCount).toBe(0);
    // skippedCount = totalFeedback - useful - notUseful = 2 - 1 - 0 = 1
    expect(json.skippedCount).toBe(1);
    expect(json.actionsCompleted).toBe(3); // 1 from brief1 + 2 from brief2
    expect(json.actionsTotal).toBe(5);     // 3 from brief1 + 2 from brief2
    expect(json.usefulness).toBe('100%');  // 1 useful / (1 useful + 0 not_useful)

    // Verify the skipped feedback was created for ORG_B only
    expect(mockAdvisorFeedbackCreate).toHaveBeenCalledTimes(1);
    const createCall = mockAdvisorFeedbackCreate.mock.calls[0][0];
    expect(createCall.data.organizationId).toBe(ORG_B);
    expect(createCall.data.response).toBe('skipped');
  });
});

// ── Empty data ───────────────────────────────────────────────────────────────

describe('Handles empty data gracefully', () => {
  beforeEach(() => {
    // No delivered briefs
    mockRecommendedActionFindMany.mockResolvedValue([]);
    // No feedback
    mockAdvisorFeedbackFindMany.mockResolvedValue([]);
  });

  it('returns zero metrics without errors', async () => {
    const { POST } = await import('@/app/api/internal/advisor-weekly-metrics/route');
    const res = await POST(makeRequest({ weekStart: TARGET_MONDAY }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.delivered).toBe(0);
    expect(json.usefulCount).toBe(0);
    expect(json.notUsefulCount).toBe(0);
    expect(json.skippedCount).toBe(0);
    expect(json.actionsCompleted).toBe(0);
    expect(json.actionsTotal).toBe(0);
    expect(json.usefulness).toBe('n/a');
    expect(json.autoMarkedSkipped).toBe(0);
  });

  it('does not create any skipped feedback rows', async () => {
    const { POST } = await import('@/app/api/internal/advisor-weekly-metrics/route');
    await POST(makeRequest({ weekStart: TARGET_MONDAY }) as never);
    expect(mockAdvisorFeedbackCreate).not.toHaveBeenCalled();
  });
});

// ── Slack webhook ────────────────────────────────────────────────────────────

describe('Slack webhook posting', () => {
  beforeEach(() => {
    process.env.ALERT_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    mockRecommendedActionFindMany.mockResolvedValue([]);
    mockAdvisorFeedbackFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.ALERT_SLACK_WEBHOOK_URL;
  });

  it('posts metrics to Slack when webhook URL is configured', async () => {
    const { POST } = await import('@/app/api/internal/advisor-weekly-metrics/route');
    await POST(makeRequest({ weekStart: TARGET_MONDAY }) as never);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});
