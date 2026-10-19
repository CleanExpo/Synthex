/** @jest-environment node */
/**
 * P5 (spec M10) — five paid text routes run their provider call through the
 * AI Governor. The Governor itself is real; only the boundaries are faked
 * (Prisma, the provider, auth, rate limits).
 *
 * SEAM: each route's exported HTTP handler, called with a mock request. Observed
 * at the one place spend is recorded: prisma.pipelineCostLedger.create.
 * CATCHES: a route that skips the Governor (0 rows), that records twice (2 rows),
 * that changes its shadow-mode HTTP answer, or that 500s on an enforcing refusal.
 * MISSES: real provider behaviour and real Postgres; enforcing mode is only
 * reachable here by mocking the mode constant (the flip itself is a human act).
 */

const mockLedgerCreate = jest.fn();
const mockProviderComplete = jest.fn();
const mockProviderStream = jest.fn();
const mockTrackPipelineCost = jest.fn();
const mockPrisma = {
  runnerFlag: { findMany: jest.fn() },
  aPICredential: { findMany: jest.fn() },
  orgBudgetPolicy: { findUnique: jest.fn() },
  pipelineCostLedger: { groupBy: jest.fn(), create: mockLedgerCreate },
  organization: { findUnique: jest.fn() },
  sentimentAnalysis: { create: jest.fn() },
  contentComment: { update: jest.fn() },
  gBPReview: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  gBPLocation: { findMany: jest.fn() },
  brandDNA: { findUnique: jest.fn(), findMany: jest.fn() },
  blogPost: { findUnique: jest.fn(), create: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: () => 'BRAND-OWN-KEY-PLACEHOLDER',
}));
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: (...a: unknown[]) => mockTrackPipelineCost(...a),
}));
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    name: 'OpenRouter',
    models: {
      fast: 'google/gemini-2.5-flash',
      balanced: 'google/gemini-2.5-flash',
    },
    complete: (...a: unknown[]) => mockProviderComplete(...a),
    stream: (...a: unknown[]) => mockProviderStream(...a),
  }),
}));
jest.mock('@/lib/ai/openrouter-client', () => ({
  OpenRouterClient: class {
    models = { creative: 'google/gemini-2.5-flash' };
    complete(...a: unknown[]) {
      return mockProviderComplete(...a);
    }
  },
}));
jest.mock('@/lib/ai/api-credential-injector', () => ({
  hasAIAccess: async () => true,
  resolveAIProvider: async () => ({
    name: 'OpenRouter',
    models: { balanced: 'google/gemini-2.5-flash' },
    complete: (...a: unknown[]) => mockProviderComplete(...a),
  }),
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org_p5_test',
}));
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: async () => 'org_p5_test',
}));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'user_p5' } }),
    createSecureResponse: (b: unknown, status: number) =>
      Response.json(b, { status }),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {}, AUTHENTICATED_READ: {} },
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, h: () => unknown) => h(),
}));
jest.mock('@/lib/middleware/api-rate-limit', () => ({
  aiGeneration: (_req: unknown, h: () => unknown) => h(),
}));
jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_req: unknown, h: () => unknown) => h(),
}));
jest.mock('@/lib/admin/verify-admin', () => ({
  verifyAdmin: async () => ({ isAdmin: true, userId: 'user_p5' }),
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: async () => 'user_p5',
}));
jest.mock('@/lib/rate-limit', () => ({
  RateLimiter: class {
    check = async () => ({ allowed: true });
  },
}));
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: { getSubscription: async () => ({ plan: 'pro' }) },
}));
jest.mock('@/lib/geo/feature-limits', () => ({
  isFeatureAvailable: () => true,
}));
jest.mock('@/lib/geo/tactic-prompts', () => ({
  buildTacticRewritePrompt: () => ({
    system: 'sys prompt',
    user: 'user prompt',
  }),
}));
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/google/business-profile', () => ({
  getReviews: jest.fn(),
  getInsights: jest.fn(),
  starRatingToNumber: () => 5,
}));
jest.mock('@/lib/google/google-auth', () => ({
  findOAuthConnection: async () => null,
}));
jest.mock('@/lib/reviews/review-request-service', () => ({
  markReviewReceived: jest.fn(),
}));
jest.mock('@/lib/scoring/visibility-score', () => ({
  calculateVisibilityScore: jest.fn(),
}));
jest.mock('@/lib/seo/keyword-seeder', () => ({
  seedAllOrgsWithoutKeywords: async () => undefined,
}));
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: jest.fn(),
}));

import { createMockNextRequest } from '../../helpers/mock-request';

const ORG = 'org_p5_test';
const SLUG = 'acme-marketing';
const USAGE = { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 };

function completion(content: string) {
  return {
    id: 'c1',
    model: 'google/gemini-2.5-flash',
    choices: [
      { message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
    usage: USAGE,
  };
}

async function* tokens(...chunks: string[]) {
  for (const c of chunks) yield c;
}

type Handler = (req: never, ctx?: never) => Promise<Response>;

/** Load a route; 'enforcing' flips only the mode constant the route reads. */
async function loadRoute(
  file: string,
  method: 'GET' | 'POST',
  mode: 'shadow' | 'enforcing' = 'shadow'
): Promise<Handler> {
  jest.resetModules();
  jest.doMock('@/lib/ai/governor/mode', () => ({ GOVERNOR_MODE: mode }));
  const mod = await import(file);
  return mod[method] as Handler;
}

function ledgerRows(): Record<string, unknown>[] {
  return mockLedgerCreate.mock.calls.map(c => c[0].data);
}

/** The assertion every route test ends on: one provider call, one ledger row. */
function expectOneReceipt(row: Record<string, unknown> = ledgerRows()[0]) {
  expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
  expect(mockTrackPipelineCost).not.toHaveBeenCalled();
  expect(row).toMatchObject({
    clientId: ORG,
    brandSlug: SLUG,
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    outcome: 'completed',
  });
}

function allowGovernor() {
  mockPrisma.runnerFlag.findMany.mockResolvedValue([
    { runner: 'any', enabled: true, killSwitch: false },
  ]);
  // The flag lookup matches on runner name: answer for whichever runner asks.
  mockPrisma.runnerFlag.findMany.mockImplementation(
    async ({ where }: { where: { runner: { in: string[] } } }) =>
      where.runner.in
        .filter((r: string) => r !== '*')
        .map((runner: string) => ({ runner, enabled: true, killSwitch: false }))
  );
  mockPrisma.aPICredential.findMany.mockResolvedValue([
    {
      id: 'cred',
      encryptedKey: 'enc',
      isActive: true,
      revokedAt: null,
    },
  ]);
  mockPrisma.orgBudgetPolicy.findUnique.mockResolvedValue({
    dailyCeilingUsd: 1000,
    providerDailyCeilingsUsd: null,
    enforcementMode: 'enforce',
  });
}

beforeEach(() => {
  mockLedgerCreate.mockResolvedValue({ id: 'l1' });
  mockPrisma.pipelineCostLedger.groupBy.mockResolvedValue([]);
  mockPrisma.organization.findUnique.mockResolvedValue({
    slug: SLUG,
    name: 'Acme',
    industry: 'retail',
  });
  mockPrisma.sentimentAnalysis.create.mockResolvedValue({ id: 'sa1' });
  allowGovernor();
});

/** Make the Governor WOULD-refuse: no runner flag rows at all. */
function noFlags() {
  mockPrisma.runnerFlag.findMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------

describe('ai-content/sentiment', () => {
  const ROUTE = '@/app/api/ai-content/sentiment/route';
  const req = () =>
    createMockNextRequest({
      method: 'POST',
      body: { text: 'I love this', organizationId: 'org_from_body' },
    });

  it('returns the same answer and writes exactly one receipt with provider-reported tokens', async () => {
    mockProviderComplete.mockResolvedValue(
      completion('{"sentiment":"positive","score":80,"confidence":0.9}')
    );
    const POST = await loadRoute(ROUTE, 'POST');
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    expect((await res.json()).analysis.sentiment).toBe('positive');
    expectOneReceipt();
    expect(ledgerRows()[0]).toMatchObject({
      pipelineName: 'ai-content-sentiment',
      runner: 'ai-content-sentiment',
      inputTokens: 123,
      outputTokens: 45,
    });
  });

  it('shadow mode: a would-be refusal is receipted and the call still runs', async () => {
    noFlags();
    mockProviderComplete.mockResolvedValue(
      completion('{"sentiment":"neutral","score":0,"confidence":0.5}')
    );
    const POST = await loadRoute(ROUTE, 'POST');
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    expect(mockProviderComplete).toHaveBeenCalledTimes(1);
    expectOneReceipt();
    expect(
      (ledgerRows()[0].provenance as { shadowRefusal?: { outcome: string } })
        .shadowRefusal?.outcome
    ).toBe('refused_flag_missing');
  });

  it('enforcing: a refusal is a 403 with a code, the provider is not called', async () => {
    noFlags();
    const POST = await loadRoute(ROUTE, 'POST', 'enforcing');
    const res = await POST(req() as never);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('refused_flag_missing');
    expect(mockProviderComplete).not.toHaveBeenCalled();
  });
});

describe('cron/gbp-monitor', () => {
  const ROUTE = '@/app/api/cron/gbp-monitor/route';
  const reviews = ['r1', 'r2'].map(id => ({
    id,
    organizationId: ORG,
    rating: 5,
    comment: 'great',
    reviewerName: 'Sam Lee',
    location: { locationName: 'Main' },
    organization: { name: 'Acme', industry: 'retail', slug: SLUG },
  }));
  const run = async (mode: 'shadow' | 'enforcing' = 'shadow') => {
    mockPrisma.gBPLocation.findMany.mockResolvedValue([]);
    mockPrisma.gBPReview.findMany.mockResolvedValue(reviews);
    mockPrisma.brandDNA.findMany.mockResolvedValue([]);
    mockPrisma.gBPReview.update.mockResolvedValue({});
    const GET = await loadRoute(ROUTE, 'GET', mode);
    const res = await GET(createMockNextRequest({ method: 'GET' }) as never);
    // generatePendingSuggestions is fire-and-forget: let it drain.
    await new Promise(r => setTimeout(r, 50));
    return res;
  };

  it('one receipt per organisation-scoped provider call, HTTP answer unchanged', async () => {
    mockProviderComplete.mockResolvedValue(completion('Thanks Sam!'));
    const res = await run();
    expect((await res.json()).success).toBe(true);
    expect(mockProviderComplete).toHaveBeenCalledTimes(2);
    expect(mockLedgerCreate).toHaveBeenCalledTimes(2);
    expect(mockTrackPipelineCost).not.toHaveBeenCalled();
    expect(ledgerRows()[0]).toMatchObject({
      pipelineName: 'gbp-monitor-auto-suggest',
      runner: 'gbp-monitor',
      clientId: ORG,
      brandSlug: SLUG,
      inputTokens: 123,
      outputTokens: 45,
      outcome: 'completed',
    });
    expect(mockPrisma.gBPReview.update).toHaveBeenCalledTimes(2);
  });

  it('shadow mode: unflagged runner is receipted, suggestions still stored', async () => {
    noFlags();
    mockProviderComplete.mockResolvedValue(completion('Thanks Sam!'));
    await run();
    expect(mockLedgerCreate).toHaveBeenCalledTimes(2);
    expect(mockPrisma.gBPReview.update).toHaveBeenCalledTimes(2);
  });

  it('enforcing: refused reviews are skipped, not stored and not billed', async () => {
    noFlags();
    const res = await run('enforcing');
    expect(res.status).toBe(200);
    expect(mockProviderComplete).not.toHaveBeenCalled();
    expect(mockPrisma.gBPReview.update).not.toHaveBeenCalled();
  });
});

describe('geo/rewrite', () => {
  const ROUTE = '@/app/api/geo/rewrite/route';
  const req = () =>
    createMockNextRequest({
      method: 'POST',
      body: { content: 'x'.repeat(80), tactic: 'statistics' },
    });

  it('streams the same chunks and writes exactly one receipt (tokens estimated from the stream)', async () => {
    mockProviderStream.mockReturnValue(tokens('Hello ', 'world!'));
    const POST = await loadRoute(ROUTE, 'POST');
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('{"text":"Hello "}');
    expect(body).toContain('data: [DONE]');
    expectOneReceipt();
    expect(ledgerRows()[0]).toMatchObject({
      pipelineName: 'geo-rewrite',
      runner: 'geo-rewrite',
      inputTokens: 6, // 21 chars of prompt, ~4 chars a token
      outputTokens: 3, // ceil(12 / 4)
    });
  });

  it('shadow mode: a would-be refusal is receipted and the stream still flows', async () => {
    noFlags();
    mockProviderStream.mockReturnValue(tokens('ok'));
    const POST = await loadRoute(ROUTE, 'POST');
    const body = await (await POST(req() as never)).text();
    expect(body).toContain('{"text":"ok"}');
    expectOneReceipt();
  });

  it('enforcing: the stream carries a coded refusal, provider untouched', async () => {
    noFlags();
    const POST = await loadRoute(ROUTE, 'POST', 'enforcing');
    const body = await (await POST(req() as never)).text();
    expect(body).toContain('"code":"refused_flag_missing"');
    expect(mockProviderStream).not.toHaveBeenCalled();
  });
});

describe('google-business/reviews/[reviewId]/auto-reply', () => {
  const ROUTE = '@/app/api/google-business/reviews/[reviewId]/auto-reply/route';
  const setup = () => {
    mockPrisma.gBPReview.findFirst.mockResolvedValue({
      id: 'rev1',
      rating: 4,
      comment: 'nice',
      reviewerName: 'Sam Lee',
      location: { locationName: 'Main' },
    });
    mockPrisma.brandDNA.findUnique.mockResolvedValue(null);
    mockPrisma.gBPReview.update.mockResolvedValue({});
  };
  const call = async (mode: 'shadow' | 'enforcing' = 'shadow') => {
    const POST = await loadRoute(ROUTE, 'POST', mode);
    return POST(
      createMockNextRequest({ method: 'POST', body: {} }) as never,
      { params: Promise.resolve({ reviewId: 'rev1' }) } as never
    );
  };

  it('stores the suggestion as before and writes exactly one receipt', async () => {
    setup();
    mockProviderComplete.mockResolvedValue(completion(' Thanks Sam! '));
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).suggestion).toBe('Thanks Sam!');
    expectOneReceipt();
    expect(ledgerRows()[0]).toMatchObject({
      pipelineName: 'gbp-auto-reply',
      runner: 'gbp-auto-reply',
      inputTokens: 123,
      outputTokens: 45,
    });
  });

  it('shadow mode: a would-be refusal is receipted and the call still runs', async () => {
    setup();
    noFlags();
    mockProviderComplete.mockResolvedValue(completion('Thanks'));
    const res = await call();
    expect(res.status).toBe(200);
    expectOneReceipt();
  });

  it('a provider failure keeps the fallback reply and is receipted once as failed', async () => {
    setup();
    mockProviderComplete.mockRejectedValue(new Error('upstream down'));
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).suggestion).toMatch(/thank you/i);
    expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
    expect(ledgerRows()[0].outcome).toBe('failed_provider_error');
  });

  it('enforcing: refusal is a 403 with a code, never a 500', async () => {
    setup();
    noFlags();
    const res = await call('enforcing');
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('refused_flag_missing');
    expect(mockProviderComplete).not.toHaveBeenCalled();
  });
});

describe('admin/blog/generate', () => {
  const ROUTE = '@/app/api/admin/blog/generate/route';
  const post = JSON.stringify({
    title: 'T',
    slug: 't',
    excerpt: 'e',
    content: 'word '.repeat(10),
    category: 'strategy',
    tags: ['a'],
    seoTitle: 's',
    seoDescription: 'd',
  });
  const call = async (mode: 'shadow' | 'enforcing' = 'shadow') => {
    mockPrisma.blogPost.findUnique.mockResolvedValue(null);
    mockPrisma.blogPost.create.mockResolvedValue({
      id: 'p1',
      slug: 't',
      status: 'draft',
    });
    const POST = await loadRoute(ROUTE, 'POST', mode);
    return POST(
      createMockNextRequest({
        method: 'POST',
        body: { topic: 'How to market well' },
      }) as never
    );
  };

  it('creates the draft as before and writes exactly one receipt', async () => {
    mockProviderComplete.mockResolvedValue(completion(post));
    const res = await call();
    expect(res.status).toBe(201);
    expectOneReceipt();
    expect(ledgerRows()[0]).toMatchObject({
      pipelineName: 'admin-blog-generate',
      runner: 'admin-blog-generate',
      inputTokens: 123,
      outputTokens: 45,
    });
  });

  it('shadow mode: a would-be refusal is receipted and the post is still generated', async () => {
    noFlags();
    mockProviderComplete.mockResolvedValue(completion(post));
    const res = await call();
    expect(res.status).toBe(201);
    expectOneReceipt();
  });

  it('a provider failure stays a 502 and is receipted once as failed', async () => {
    mockProviderComplete.mockRejectedValue(new Error('upstream down'));
    const res = await call();
    expect(res.status).toBe(502);
    expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
    expect(ledgerRows()[0].outcome).toBe('failed_provider_error');
  });

  it('enforcing: refusal is a 403 with a code, never a 500', async () => {
    noFlags();
    const res = await call('enforcing');
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('refused_flag_missing');
    expect(mockProviderComplete).not.toHaveBeenCalled();
  });
});

describe('one-receipt assertion (control: planted failure is caught)', () => {
  it('goes red when a duplicate ledger write sits beside the governed one', async () => {
    mockProviderComplete.mockResolvedValue(
      completion('{"sentiment":"positive"}')
    );
    const POST = await loadRoute(
      '@/app/api/ai-content/sentiment/route',
      'POST'
    );
    await POST(
      createMockNextRequest({ method: 'POST', body: { text: 'good' } }) as never
    );
    // the planted defect: a second write for the same call, as trackPipelineCost would
    await mockPrisma.pipelineCostLedger.create({ data: { runId: 'dup' } });
    expect(() => expectOneReceipt()).toThrow();
  });
});
