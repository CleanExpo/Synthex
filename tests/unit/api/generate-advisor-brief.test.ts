/**
 * Unit tests — SYN-593 AI Marketing Advisor Brief
 *
 * Covers:
 *  - POST /api/internal/generate-advisor-brief (CRON_SECRET auth, per-org generation)
 *
 * Test profiles:
 *   A) New org — 0 digests, no authority score, no reviews, 0 posts this week
 *   B) Growing org — 2 digests, authority score 45, 3 reviews avg 4.3, 5 posts
 *   C) Established org — 6 digests, authority score 72, 12 reviews avg 4.8, competitor gap
 *
 * Validates:
 *   - 401 on missing/invalid CRON_SECRET
 *   - Skips org if brief already exists for this week
 *   - Rejects generic actions (no data citations)
 *   - Dollar attribution contains AUD figure
 *   - GEO teaser present when authority score available
 *   - Competitor insight present when gap data available
 *   - Null-safe: competitorKeywordGap rejection doesn't crash
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

const mockOrgFindMany = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockRecommendedActionFindUnique = jest.fn();
const mockRecommendedActionCreate = jest.fn();
const mockDigestFindMany = jest.fn();
const mockSeasonalSignalFindMany = jest.fn();
const mockAuthorityScoreFindFirst = jest.fn();
const mockGBPReviewFindMany = jest.fn();
const mockPublishQueueItemCount = jest.fn();
const mockCompetitorKeywordGapFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: { findMany: mockOrgFindMany, findUnique: mockOrgFindUnique },
    recommendedAction: {
      findUnique: mockRecommendedActionFindUnique,
      create: mockRecommendedActionCreate,
    },
    aIWeeklyDigest: { findMany: mockDigestFindMany },
    seasonalSignal: { findMany: mockSeasonalSignalFindMany },
    authorityScore: { findFirst: mockAuthorityScoreFindFirst },
    gBPReview: { findMany: mockGBPReviewFindMany },
    publishQueueItem: { count: mockPublishQueueItemCount },
    competitorKeywordGap: { findFirst: mockCompetitorKeywordGapFindFirst },
  },
}));

// ── Anthropic mock ────────────────────────────────────────────────────────────

const mockAnthropicCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-xyz';
const ORG_A = 'org-new-001';
const ORG_B = 'org-growing-002';
const ORG_C = 'org-established-003';

const DATA_SPECIFIC_ACTIONS = [
  {
    rank: 1,
    title: 'Reply to 3 unanswered reviews',
    rationale: 'You have 3 reviews averaging 4.2 stars with no reply. Responding within 48h increases rebooking by 15%.',
    effort: 'low',
    expectedImpact: '+12% profile engagement',
  },
  {
    rank: 2,
    title: 'Schedule 2 posts for Thursday peak',
    rationale: 'Your last 5 posts averaged 340 reach. Thursday posts averaged 520 — schedule 2 this week to hit that peak.',
    effort: 'low',
    expectedImpact: '+53% reach vs weekly average',
  },
  {
    rank: 3,
    title: 'Add schema markup to homepage',
    rationale: 'Authority score is 45/100. Schema coverage pillar scores 6/10 — adding LocalBusiness markup can improve AI citation rate.',
    effort: 'medium',
    expectedImpact: 'GEO citation eligibility',
  },
];

function makeCloudeResponse(actions: unknown[]) {
  return {
    content: [{ type: 'text', text: JSON.stringify(actions) }],
  };
}

function makeRequest(body: object = {}, secret = CRON_SECRET) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/internal/generate-advisor-brief',
    headers: { authorization: `Bearer ${secret}` },
    body,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.ANTHROPIC_API_KEY = 'sk-test';
});

beforeEach(() => {
  // resetModules forces a fresh route module each test, resetting the
  // _anthropic singleton so the Anthropic constructor mock is re-evaluated.
  // Without this, resetMocks:true clears the constructor's .mockImplementation()
  // but the singleton keeps the stale empty object, causing silent errors.
  jest.resetModules();
  jest.clearAllMocks();
  mockRecommendedActionFindUnique.mockResolvedValue(null);
  mockRecommendedActionCreate.mockResolvedValue({ id: 'rec-001' });
  mockSeasonalSignalFindMany.mockResolvedValue([]);
  mockCompetitorKeywordGapFindFirst.mockResolvedValue(null);
  mockAnthropicCreate.mockResolvedValue(makeCloudeResponse(DATA_SPECIFIC_ACTIONS));
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when authorization header is missing', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = createMockNextRequest({ method: 'POST', body: {} });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest({}, 'wrong-secret');
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});

// ── Profile A: New org ────────────────────────────────────────────────────────

describe('Profile A — new org (no data)', () => {
  beforeEach(() => {
    mockOrgFindMany.mockResolvedValue([{ id: ORG_A }]);
    mockOrgFindUnique.mockResolvedValue({ name: 'Fresh Start Plumbing', industry: 'plumbing', timezone: 'Australia/Sydney' });
    mockDigestFindMany.mockResolvedValue([]);
    mockAuthorityScoreFindFirst.mockResolvedValue(null);
    mockGBPReviewFindMany.mockResolvedValue([]);
    mockPublishQueueItemCount.mockResolvedValue(0);
  });

  it('generates a brief and calls prisma.create', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();
    expect(json.generated).toBe(1);
    expect(mockRecommendedActionCreate).toHaveBeenCalledTimes(1);
  });

  it('stores status=generated (quality gate hold)', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    await POST(makeRequest() as never);
    const call = mockRecommendedActionCreate.mock.calls[0][0];
    expect(call.data.status).toBe('generated');
  });

  it('geoTeaserText is null when authority score is unavailable', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    await POST(makeRequest() as never);
    const call = mockRecommendedActionCreate.mock.calls[0][0];
    expect(call.data.geoTeaserText).toBeNull();
  });
});

// ── Profile B: Growing org ────────────────────────────────────────────────────

describe('Profile B — growing org (2 digests, authority 45)', () => {
  beforeEach(() => {
    mockOrgFindMany.mockResolvedValue([{ id: ORG_B }]);
    mockOrgFindUnique.mockResolvedValue({ name: 'Capital Plumbing Canberra', industry: 'plumbing-hvac', timezone: 'Australia/Sydney' });
    mockDigestFindMany.mockResolvedValue([
      { weekStart: new Date('2026-03-18'), highlights: [{ metric: 'reach', value: 340 }], opportunities: [] },
      { weekStart: new Date('2026-03-25'), highlights: [{ metric: 'reach', value: 420 }], opportunities: [] },
    ]);
    mockAuthorityScoreFindFirst.mockResolvedValue({
      score: 45,
      eeAtBreakdown: { gbpCompleteness: 18, reviewVelocity: 10, contentFreshness: 8, backlinkSignals: 5, schemaCoverage: 2, socialProof: 2 },
    });
    mockGBPReviewFindMany.mockResolvedValue([{ rating: 4 }, { rating: 5 }, { rating: 4 }]);
    mockPublishQueueItemCount.mockResolvedValue(5);
  });

  it('geoTeaserText references the authority score number', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    await POST(makeRequest() as never);
    const call = mockRecommendedActionCreate.mock.calls[0][0];
    expect(call.data.geoTeaserText).toContain('45');
  });

  it('dollarAttribution contains an AUD dollar figure', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    await POST(makeRequest() as never);
    const call = mockRecommendedActionCreate.mock.calls[0][0];
    expect(call.data.dollarAttribution).toMatch(/\$[\d,]+/);
  });

  it('skips if brief already exists for this week', async () => {
    mockRecommendedActionFindUnique.mockResolvedValue({ id: 'existing' });
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();
    expect(json.skipped).toBe(1);
    expect(json.generated).toBe(0);
    expect(mockRecommendedActionCreate).not.toHaveBeenCalled();
  });
});

// ── Profile C: Established org ────────────────────────────────────────────────

describe('Profile C — established org (authority 72, competitor gap)', () => {
  beforeEach(() => {
    mockOrgFindMany.mockResolvedValue([{ id: ORG_C }]);
    mockOrgFindUnique.mockResolvedValue({ name: 'Melbourne Master Plumbers', industry: 'plumbing-hvac', timezone: 'Australia/Melbourne' });
    mockDigestFindMany.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({
        weekStart: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
        highlights: [{ metric: 'reach', value: 600 + i * 50 }],
        opportunities: [],
      }))
    );
    mockAuthorityScoreFindFirst.mockResolvedValue({
      score: 72,
      eeAtBreakdown: { gbpCompleteness: 24, reviewVelocity: 19, contentFreshness: 18, backlinkSignals: 5, schemaCoverage: 3, socialProof: 3 },
    });
    mockGBPReviewFindMany.mockResolvedValue(Array.from({ length: 12 }, () => ({ rating: 5 })));
    mockPublishQueueItemCount.mockResolvedValue(20);
    mockCompetitorKeywordGapFindFirst.mockResolvedValue({
      keyword: 'emergency plumber melbourne',
      competitor: { domain: 'fastplumbers.com.au', name: 'Fast Plumbers' },
    });
  });

  it('competitorMicroInsight includes the gap keyword', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    await POST(makeRequest() as never);
    const call = mockRecommendedActionCreate.mock.calls[0][0];
    expect(call.data.competitorMicroInsight).toContain('emergency plumber melbourne');
  });

  it('geoTeaserText mentions authority score for high-tier org', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    await POST(makeRequest() as never);
    const call = mockRecommendedActionCreate.mock.calls[0][0];
    expect(call.data.geoTeaserText).toContain('72');
  });
});

// ── Generic action rejection ──────────────────────────────────────────────────

describe('Validation — generic action rejection', () => {
  beforeEach(() => {
    mockOrgFindMany.mockResolvedValue([{ id: ORG_B }]);
    mockOrgFindUnique.mockResolvedValue({ name: 'Test Org', industry: null, timezone: 'Australia/Sydney' });
    mockDigestFindMany.mockResolvedValue([]);
    mockAuthorityScoreFindFirst.mockResolvedValue(null);
    mockGBPReviewFindMany.mockResolvedValue([]);
    mockPublishQueueItemCount.mockResolvedValue(0);
  });

  it('counts as error when all action rationales have no numbers', async () => {
    mockAnthropicCreate.mockResolvedValue(makeCloudeResponse([
      { rank: 1, title: 'Post more content', rationale: 'Engage with your audience more often.', effort: 'low', expectedImpact: 'Better reach' },
      { rank: 2, title: 'Be consistent', rationale: 'Stay active on social media.', effort: 'low', expectedImpact: 'Growth' },
      { rank: 3, title: 'Respond to reviews', rationale: 'Improve your social media presence.', effort: 'low', expectedImpact: 'Trust' },
    ]));
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();
    expect(json.errors).toBe(1);
    expect(json.generated).toBe(0);
    expect(mockRecommendedActionCreate).not.toHaveBeenCalled();
  });

  it('accepts actions when rationale contains real numbers', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();
    expect(json.generated).toBe(1);
    expect(json.errors).toBe(0);
  });
});

// ── Null-safe ML reads ────────────────────────────────────────────────────────

describe('Null-safe ML reads', () => {
  it('succeeds when competitorKeywordGap query rejects (table may not exist)', async () => {
    mockOrgFindMany.mockResolvedValue([{ id: ORG_A }]);
    mockOrgFindUnique.mockResolvedValue({ name: 'Null Org', industry: null, timezone: 'Australia/Sydney' });
    mockDigestFindMany.mockResolvedValue([]);
    mockAuthorityScoreFindFirst.mockResolvedValue(null);
    mockGBPReviewFindMany.mockResolvedValue([]);
    mockPublishQueueItemCount.mockResolvedValue(0);
    mockCompetitorKeywordGapFindFirst.mockRejectedValue(new Error('Table does not exist'));

    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.generated).toBe(1);
  });
});
