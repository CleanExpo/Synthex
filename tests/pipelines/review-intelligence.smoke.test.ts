/**
 * Review Intelligence pipeline — CI smoke test (SYN-590)
 *
 * Board Session 13 failure mode this guards against:
 *   A review-draft run that returns HTTP 200 but produces an EMPTY or
 *   whitespace-only `draft_response`. Error monitoring never fires — the run
 *   looks healthy while the client's GBP reviews go unanswered (or get a blank
 *   suggestion). This smoke test asserts a real, non-trivial draft is written.
 *
 * SMOKE test, not integration. All external calls (Supabase runner log, the
 * Anthropic reply model, Prisma) are mocked — fast and deterministic.
 *
 * Pipeline endpoint: POST /api/internal/generate-review-responses
 *   (per-org runner; drafts `gbp_reviews.ai_suggestion`).
 *
 * Test client: industry `trades`, state `NSW`, with one seeded `gbp_reviews`
 * row — see tests/README.md.
 */

import { createMockNextRequest } from '../helpers/mock-request';

const CRON_SECRET = 'smoke-test-cron-secret';
const TEST_CLIENT_ORG_ID = 'smoke-test-org-trades-nsw';
const REVIEW_ENDPOINT_HINT =
  'check /api/internal/generate-review-responses and the seeded trades/NSW gbp_reviews row';

// ── next/server mock (NextResponse.json → plain awaitable) ────────────────────

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

const mockReviewFindMany = jest.fn();
const mockReviewUpdate = jest.fn();
const mockOrgFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    gBPReview: {
      findMany: (...a: unknown[]) => mockReviewFindMany(...a),
      update: (...a: unknown[]) => mockReviewUpdate(...a),
    },
    organization: {
      findMany: (...a: unknown[]) => mockOrgFindMany(...a),
    },
  },
}));

// ── Anthropic SDK mock (reply model) ──────────────────────────────────────────

const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

// ── Supabase mock (runner writes edge_function_logs — non-fatal in tests) ─────

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

describe('Review Intelligence pipeline smoke test (SYN-590)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
    delete process.env.PIPELINE_SLACK_WEBHOOK;

    // One active org (the trades/NSW test client).
    mockOrgFindMany.mockResolvedValue([
      { id: TEST_CLIENT_ORG_ID, name: 'Test Trades Co' },
    ]);

    // One pending review needing a draft.
    mockReviewFindMany.mockResolvedValue([
      {
        id: 'gbp-review-smoke-1',
        reviewerName: 'Jane',
        rating: 5,
        comment: 'Fantastic service — fixed my burst pipe within the hour.',
      },
    ]);
    mockReviewUpdate.mockResolvedValue({});

    // Reply model returns a valid, non-trivial draft (>20 chars).
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            suggestion:
              'Thanks so much for the kind words, Jane! Rapt we could sort ' +
              'that burst pipe quickly for you. We are always here if you ' +
              'need us — cheers, the team.',
            confidence: 0.93,
          }),
        },
      ],
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('returns HTTP 200 and reports at least one drafted response', async () => {
    const { POST } =
      await import('@/app/api/internal/generate-review-responses/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as never);

    if (res.status !== 200) {
      throw new Error(
        `Review Intelligence smoke test FAILED: expected HTTP 200, got ${res.status} — ${REVIEW_ENDPOINT_HINT}`
      );
    }
    const body = await res.json();
    if (!(body.responses_drafted > 0)) {
      throw new Error(
        `Review Intelligence smoke test FAILED: expected responses_drafted > 0, ` +
          `got ${JSON.stringify(body.responses_drafted)} — the pipeline returned 200 ` +
          `but drafted nothing. ${REVIEW_ENDPOINT_HINT}`
      );
    }
    expect(body.ok).toBe(true);
  });

  it('writes a draft_response string with length > 20 (not empty / whitespace-only)', async () => {
    const { POST } =
      await import('@/app/api/internal/generate-review-responses/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    await POST(req as never);

    if (mockReviewUpdate.mock.calls.length === 0) {
      throw new Error(
        `Review Intelligence smoke test FAILED: pipeline persisted no draft ` +
          `(gbp_reviews.update never called) — ${REVIEW_ENDPOINT_HINT}`
      );
    }

    const draftResponse: unknown =
      mockReviewUpdate.mock.calls[0][0]?.data?.aiSuggestion;

    if (
      typeof draftResponse !== 'string' ||
      draftResponse.trim().length <= 20
    ) {
      throw new Error(
        `Review Intelligence smoke test FAILED: expected draft_response to be a ` +
          `string with length > 20, got ${JSON.stringify(draftResponse)} — a blank ` +
          `or trivial reply is a semantically-empty 200. ${REVIEW_ENDPOINT_HINT}`
      );
    }

    expect(draftResponse.trim().length).toBeGreaterThan(20);
  });
});
