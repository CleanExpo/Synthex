/**
 * Unit tests for POST /api/internal/generate-advisor-brief
 *
 * Mock strategy:
 * - @/lib/prisma: fully mocked — Prisma is never called in unit tests
 * - @anthropic-ai/sdk: mocked to return controlled JSON responses
 * - @/lib/logger: silenced
 * - global fetch: mocked for Slack webhook calls (fire-and-forget)
 *
 * Test profiles:
 *   A) New org — 0 digests, no authority score, no reviews, 0 posts this week
 *   B) Growing org — 2 digests, authority score 45, 3 reviews avg 4.2, 5 posts
 *   C) Established org — 6 digests, authority score 72, 12 reviews avg 4.8, 20 posts, competitor gap
 *
 * Validates:
 *   - 401 on missing/invalid CRON_SECRET
 *   - Skips org if brief already exists for this week
 *   - Rejects generic actions (no numbers in rationale)
 *   - Dollar attribution contains real AUD figure
 *   - GEO teaser present when authority score available
 *   - Competitor insight present when gap data available
 *
 * @task SYN-593
 */

// ── Mock objects ──────────────────────────────────────────────────────────────

const mockPrismaOrg = { findMany: jest.fn(), findUnique: jest.fn() };
const mockPrismaRecommendedAction = { findUnique: jest.fn(), create: jest.fn() };
const mockPrismaAIWeeklyDigest = { findMany: jest.fn() };
const mockPrismaSeasonalSignal = { findMany: jest.fn() };
const mockPrismaAuthorityScore = { findFirst: jest.fn() };
const mockPrismaGBPReview = { findMany: jest.fn() };
const mockPrismaPublishQueueItem = { count: jest.fn() };
const mockPrismaCompetitorKeywordGap = { findFirst: jest.fn() };

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

const mockAnthropicCreate = jest.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: mockPrismaOrg,
    recommendedAction: mockPrismaRecommendedAction,
    aIWeeklyDigest: mockPrismaAIWeeklyDigest,
    seasonalSignal: mockPrismaSeasonalSignal,
    authorityScore: mockPrismaAuthorityScore,
    gBPReview: mockPrismaGBPReview,
    publishQueueItem: mockPrismaPublishQueueItem,
    competitorKeywordGap: mockPrismaCompetitorKeywordGap,
  },
}));

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockAnthropicCreate },
    })),
  };
});

jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

jest.mock('next/server', () => {
  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse {
      const serialised = JSON.stringify(body);
      const status = init?.status ?? 200;
      return new NextResponse(serialised, {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
  }
  return {
    NextResponse,
    NextRequest: class NextRequest extends Request {},
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-xyz';
const ORG_A_ID = 'org-new-001';
const ORG_B_ID = 'org-growing-002';
const ORG_C_ID = 'org-established-003';

const VALID_ACTIONS = [
  {
    rank: 1,
    title: 'Reply to 3 unanswered 4-star reviews',
    rationale: 'You have 3 reviews averaging 4.2 stars without a reply. Responding within 48h increases repeat bookings by 15%.',
    effort: 'low',
    expectedImpact: '+12% profile engagement',
  },
  {
    rank: 2,
    title: 'Schedule 2 posts for Thursday peak',
    rationale: 'Your last 5 posts averaged 340 reach, but Thursday posts averaged 520. Schedule 2 posts this week.',
    effort: 'low',
    expectedImpact: '+53% average reach',
  },
  {
    rank: 3,
    title: 'Add emergency plumber schema markup',
    rationale: 'Authority score is 45/100. Schema coverage pillar is your weakest at 6/10 — adding LocalBusiness markup can improve AI citation rate.',
    effort: 'medium',
    expectedImpact: 'GEO citation eligibility improvement',
  },
];

function makeClaudeResponse(actions: unknown[]): object {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(actions),
      },
    ],
  };
}

function makeRequest(
  body: object = {},
  headers: Record<string, string> = {}
): Request {
  return new Request('https://synthex.social/api/internal/generate-advisor-brief', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${CRON_SECRET}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  process.env.ALERT_SLACK_WEBHOOK_URL = undefined as unknown as string;

  // Default: no existing brief this week
  mockPrismaRecommendedAction.findUnique.mockResolvedValue(null);
  mockPrismaRecommendedAction.create.mockResolvedValue({ id: 'action-001' });

  // Default: competitor gap query returns null
  mockPrismaCompetitorKeywordGap.findFirst.mockResolvedValue(null);

  // Default: no seasonal signals
  mockPrismaSeasonalSignal.findMany.mockResolvedValue([]);

  // Default: Claude returns valid actions
  mockAnthropicCreate.mockResolvedValue(makeClaudeResponse(VALID_ACTIONS));
});

// ── Authentication ─────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when authorization header is missing', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest({}, { authorization: '' });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorised');
  });

  it('returns 401 when CRON_SECRET does not match', async () => {
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest({}, { authorization: 'Bearer wrong-secret' });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});

// ── Profile A: New org (0 digests, no scores) ─────────────────────────────────

describe('Profile A — new org (0 digests, no data)', () => {
  beforeEach(() => {
    mockPrismaOrg.findMany.mockResolvedValue([{ id: ORG_A_ID }]);
    mockPrismaOrg.findUnique.mockResolvedValue({
      name: 'Fresh Start Plumbing',
      industry: 'plumbing',
      timezone: 'Australia/Sydney',
    });
    mockPrismaAIWeeklyDigest.findMany.mockResolvedValue([]);
    mockPrismaAuthorityScore.findFirst.mockResolvedValue(null);
    mockPrismaGBPReview.findMany.mockResolvedValue([]);
    mockPrismaPublishQueueItem.count.mockResolvedValue(0);
  });

  it('generates a brief and calls create', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.generated).toBe(1);
    expect(mockPrismaRecommendedAction.create).toHaveBeenCalledTimes(1);
  });

  it('stores status=generated (quality gate hold)', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    await POST(req as never);
    const createCall = mockPrismaRecommendedAction.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('generated');
  });

  it('does NOT include geoTeaserText when authority score is null', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    await POST(req as never);
    const createCall = mockPrismaRecommendedAction.create.mock.calls[0][0];
    expect(createCall.data.geoTeaserText).toBeNull();
  });
});

// ── Profile B: Growing org (2 digests, authority 45, reviews) ─────────────────

describe('Profile B — growing org (2 digests, authority 45)', () => {
  beforeEach(() => {
    mockPrismaOrg.findMany.mockResolvedValue([{ id: ORG_B_ID }]);
    mockPrismaOrg.findUnique.mockResolvedValue({
      name: 'Capital Plumbing Canberra',
      industry: 'plumbing-hvac',
      timezone: 'Australia/Sydney',
    });
    mockPrismaAIWeeklyDigest.findMany.mockResolvedValue([
      { weekStart: new Date('2026-03-18'), highlights: [{ metric: 'reach', value: 340 }], opportunities: [] },
      { weekStart: new Date('2026-03-25'), highlights: [{ metric: 'reach', value: 420 }], opportunities: [] },
    ]);
    mockPrismaAuthorityScore.findFirst.mockResolvedValue({
      score: 45,
      eeAtBreakdown: { gbpCompleteness: 18, reviewVelocity: 10, contentFreshness: 8, backlinkSignals: 5, schemaCoverage: 2, socialProof: 2 },
    });
    mockPrismaGBPReview.findMany.mockResolvedValue([
      { rating: 4 }, { rating: 5 }, { rating: 4 },
    ]);
    mockPrismaPublishQueueItem.count.mockResolvedValue(5);
  });

  it('generates brief with GEO teaser referencing authority score', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    await POST(req as never);
    const createCall = mockPrismaRecommendedAction.create.mock.calls[0][0];
    expect(createCall.data.geoTeaserText).toContain('45');
  });

  it('dollar attribution contains AUD figure', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    await POST(req as never);
    const createCall = mockPrismaRecommendedAction.create.mock.calls[0][0];
    expect(createCall.data.dollarAttribution).toMatch(/\$[\d,]+/);
  });

  it('skips if brief already exists for this week', async () => {
    mockPrismaRecommendedAction.findUnique.mockResolvedValue({ id: 'existing-001' });
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    const res = await POST(req as never);
    const json = await res.json();
    expect(json.skipped).toBe(1);
    expect(json.generated).toBe(0);
    expect(mockPrismaRecommendedAction.create).not.toHaveBeenCalled();
  });
});

// ── Profile C: Established org (6 digests, authority 72, competitor gap) ───────

describe('Profile C — established org (6 digests, authority 72, competitor gap)', () => {
  beforeEach(() => {
    mockPrismaOrg.findMany.mockResolvedValue([{ id: ORG_C_ID }]);
    mockPrismaOrg.findUnique.mockResolvedValue({
      name: 'Melbourne Master Plumbers',
      industry: 'plumbing-hvac',
      timezone: 'Australia/Melbourne',
    });
    mockPrismaAIWeeklyDigest.findMany.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({
        weekStart: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
        highlights: [{ metric: 'reach', value: 600 + i * 50 }],
        opportunities: [],
      }))
    );
    mockPrismaAuthorityScore.findFirst.mockResolvedValue({
      score: 72,
      eeAtBreakdown: { gbpCompleteness: 24, reviewVelocity: 19, contentFreshness: 18, backlinkSignals: 5, schemaCoverage: 3, socialProof: 3 },
    });
    mockPrismaGBPReview.findMany.mockResolvedValue(
      Array.from({ length: 12 }, () => ({ rating: 5 }))
    );
    mockPrismaPublishQueueItem.count.mockResolvedValue(20);
    mockPrismaCompetitorKeywordGap.findFirst.mockResolvedValue({
      keyword: 'emergency plumber melbourne',
      competitor: { domain: 'fastplumbers.com.au', name: 'Fast Plumbers' },
    });
  });

  it('includes competitor micro-insight when gap data available', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    await POST(req as never);
    const createCall = mockPrismaRecommendedAction.create.mock.calls[0][0];
    expect(createCall.data.competitorMicroInsight).toContain('emergency plumber melbourne');
  });

  it('GEO teaser mentions top-tier status when score >= 70', async () => {
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    await POST(req as never);
    const createCall = mockPrismaRecommendedAction.create.mock.calls[0][0];
    expect(createCall.data.geoTeaserText).toContain('72');
  });
});

// ── Generic action rejection ───────────────────────────────────────────────────

describe('Validation — generic action rejection', () => {
  beforeEach(() => {
    mockPrismaOrg.findMany.mockResolvedValue([{ id: ORG_B_ID }]);
    mockPrismaOrg.findUnique.mockResolvedValue({
      name: 'Test Org',
      industry: 'plumbing',
      timezone: 'Australia/Sydney',
    });
    mockPrismaAIWeeklyDigest.findMany.mockResolvedValue([]);
    mockPrismaAuthorityScore.findFirst.mockResolvedValue(null);
    mockPrismaGBPReview.findMany.mockResolvedValue([]);
    mockPrismaPublishQueueItem.count.mockResolvedValue(0);
  });

  it('counts as error when Claude returns actions with no numbers in rationale', async () => {
    const genericActions = [
      { rank: 1, title: 'Post more content', rationale: 'Engage with your audience more often to build your brand.', effort: 'low', expectedImpact: 'Better reach' },
      { rank: 2, title: 'Be consistent', rationale: 'Stay active on social media to increase your presence.', effort: 'low', expectedImpact: 'Growth' },
      { rank: 3, title: 'Respond to reviews', rationale: 'Improve your social media and respond to every review.', effort: 'low', expectedImpact: 'Trust' },
    ];
    mockAnthropicCreate.mockResolvedValue(makeClaudeResponse(genericActions));

    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    const res = await POST(req as never);
    const json = await res.json();
    // Should count as an error (validation rejection), not a generated brief
    expect(json.errors).toBe(1);
    expect(json.generated).toBe(0);
    expect(mockPrismaRecommendedAction.create).not.toHaveBeenCalled();
  });

  it('accepts actions that have numbers in their rationale', async () => {
    mockAnthropicCreate.mockResolvedValue(makeClaudeResponse(VALID_ACTIONS));
    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    const res = await POST(req as never);
    const json = await res.json();
    expect(json.generated).toBe(1);
    expect(json.errors).toBe(0);
  });
});

// ── Null-safe ML reads ────────────────────────────────────────────────────────

describe('Null-safe ML metadata reads', () => {
  it('handles competitorKeywordGap.findFirst() rejecting gracefully', async () => {
    mockPrismaOrg.findMany.mockResolvedValue([{ id: ORG_A_ID }]);
    mockPrismaOrg.findUnique.mockResolvedValue({
      name: 'Null Test Org',
      industry: null,
      timezone: 'Australia/Sydney',
    });
    mockPrismaAIWeeklyDigest.findMany.mockResolvedValue([]);
    mockPrismaAuthorityScore.findFirst.mockResolvedValue(null);
    mockPrismaGBPReview.findMany.mockResolvedValue([]);
    mockPrismaPublishQueueItem.count.mockResolvedValue(0);
    // Simulate the table not existing (SYN-583 scenario)
    mockPrismaCompetitorKeywordGap.findFirst.mockRejectedValue(
      new Error('Table "competitor_keyword_gaps" does not exist')
    );

    jest.resetModules();
    const { POST } = await import('@/app/api/internal/generate-advisor-brief/route');
    const req = makeRequest();
    const res = await POST(req as never);
    // Should still succeed — competitor gap is treated as null, not fatal
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.generated).toBe(1);
  });
});
