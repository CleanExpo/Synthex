/**
 * BUDGET-ENFORCER — org-ceiling wiring for POST /api/ai/generate-content.
 *
 * Invokes the REAL route handler AND the REAL budget-enforcer (Redis on its
 * in-memory fallback); only prisma/auth/generator seams are mocked — same
 * pattern as the SYN-MCP-003 enforcement suite.
 *
 * Pins:
 *   - enforcing policy + over ceiling → 402 BEFORE any generation (single
 *     and batch), idempotency key released so a later retry isn't stuck
 *   - log_only policy + over ceiling → 200, generation proceeds (deploy-safe)
 *   - NO policy row → byte-identical behaviour to today (200)
 *   - under ceiling → 200 and the in-flight reservation is committed back to 0
 *   - failed generation → reservation released (counter back to 0)
 */

const mockGenerateContent = jest.fn();
const mockBatchGenerate = jest.fn();
const mockBrandedGenerate = jest.fn();
const mockUsageTrack = jest.fn();
const mockUserFindUnique = jest.fn();
const mockPolicyFindUnique = jest.fn();
const mockLedgerAggregate = jest.fn();

jest.mock('@/lib/ai/content-generator', () => ({
  aiContentGenerator: {
    generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    batchGenerate: (...args: unknown[]) => mockBatchGenerate(...args),
    generateContentCalendar: jest.fn(),
  },
}));

jest.mock('@/lib/services/client-branded-content', () => ({
  ClientBrandedContentService: {
    generate: (...args: unknown[]) => mockBrandedGenerate(...args),
  },
}));

jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_req: unknown, handler: (userId: string) => unknown) =>
    handler('test-user-id'),
}));
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
  UsageTracker: { track: (...a: unknown[]) => mockUsageTrack(...a) },
}));
const mockGetUserAICredentials = jest.fn();
const mockVisibilityScore = jest.fn();

jest.mock('@/lib/ai/api-credential-injector', () => ({
  getUserAICredentials: (...a: unknown[]) => mockGetUserAICredentials(...a),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    orgBudgetPolicy: {
      findUnique: (...a: unknown[]) => mockPolicyFindUnique(...a),
    },
    pipelineCostLedger: {
      aggregate: (...a: unknown[]) => mockLedgerAggregate(...a),
      create: jest.fn().mockResolvedValue({}),
    },
  },
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    orgBudgetPolicy: {
      findUnique: (...a: unknown[]) => mockPolicyFindUnique(...a),
    },
    pipelineCostLedger: {
      aggregate: (...a: unknown[]) => mockLedgerAggregate(...a),
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('@/lib/auth/monitoring', () => ({
  authMonitor: { trackEvent: jest.fn() },
}));
jest.mock('@/lib/scoring/visibility-score', () => ({
  calculateVisibilityScore: (...a: unknown[]) => mockVisibilityScore(...a),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Import AFTER mocks are registered.
import { POST } from '@/app/api/ai/generate-content/route';
import { getOrgSpendSnapshot } from '@/lib/ai/budget-enforcer';
import { resetRedisClient } from '@/lib/redis-client';

const ORG = 'org-123';

function makeRequest(body: unknown): any {
  return {
    cookies: { get: () => ({ value: 'valid-token' }) },
    headers: { get: () => 'Bearer valid-token' },
    json: async () => body,
  };
}

function fakeGenerated(id: string) {
  return {
    id,
    content: `content-${id}`,
    platform: 'twitter',
    variations: [],
    hashtags: [],
    emojis: [],
    hooks: [],
    estimatedEngagement: 2.5,
    viralScore: 60,
    heuristicEngagement: 2.5,
    heuristicViralScore: 60,
    metadata: {
      generatedAt: new Date(),
      model: 'test-model',
      tokens: 100,
      processingTime: 5,
    },
  };
}

function setPolicy(mode: string, dailyCeilingUsd: number | null) {
  mockPolicyFindUnique.mockResolvedValue({
    id: 'pol-1',
    organizationId: ORG,
    dailyCeilingUsd,
    monthlyCeilingUsd: null,
    enforcementMode: mode,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('POST /api/ai/generate-content — BUDGET-ENFORCER org ceiling', () => {
  const originalOpenAI = process.env.OPENAI_API_KEY;
  let counter = 0;

  beforeEach(async () => {
    await resetRedisClient();
    process.env.OPENAI_API_KEY = 'sk-test-platform-key';
    delete process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD;
    delete process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD;
    mockUserFindUnique.mockResolvedValue({ organizationId: ORG });
    mockUsageTrack.mockResolvedValue(undefined);
    mockGetUserAICredentials.mockResolvedValue(null);
    mockVisibilityScore.mockResolvedValue(undefined);
    mockPolicyFindUnique.mockResolvedValue(null);
    mockLedgerAggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
    // Branded service fails → route falls through to aiContentGenerator.
    mockBrandedGenerate.mockRejectedValue(new Error('branded unavailable'));
    mockGenerateContent.mockImplementation(async () =>
      fakeGenerated(`gen-${++counter}`)
    );
    mockBatchGenerate.mockImplementation(async (reqs: unknown[]) =>
      reqs.map((_r, i) => fakeGenerated(`batch-${i}`))
    );
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalOpenAI;
  });

  it('402 fail-closed BEFORE any generation when an enforcing policy is breached (single)', async () => {
    setPolicy('enforce', 0.01); // below the single-request estimate (~0.0585)

    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'spring sale' })
    );

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('Organization budget exceeded');
    expect(json.window).toBe('daily');
    expect(json.ceilingUsd).toBe(0.01);
    expect(json.estimatedCostUsd).toBeGreaterThan(0);

    // Pre-spend: NOTHING generated or tracked; nothing left in flight.
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockBrandedGenerate).not.toHaveBeenCalled();
    expect(mockUsageTrack).not.toHaveBeenCalled();
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
  });

  it('402 fail-closed for a breaching batch (summed estimate)', async () => {
    setPolicy('enforce', 0.1); // below 5 × per-request estimate

    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: Array.from({ length: 5 }, (_x, i) => ({
          platform: 'twitter',
          topic: `t-${i}`,
        })),
      })
    );

    expect(res.status).toBe(402);
    expect(mockBatchGenerate).not.toHaveBeenCalled();
  });

  it('releases the idempotency key on a 402 so a later retry is not stuck', async () => {
    setPolicy('enforce', 0.01);
    const body = {
      platform: 'twitter',
      topic: 'spring sale',
      idempotencyKey: 'org-budget-key-0001',
    };

    const first = await POST(makeRequest(body));
    expect(first.status).toBe(402);

    // Ceiling raised → the SAME key must be usable again (not 409/pending).
    setPolicy('enforce', 10);
    const retry = await POST(makeRequest(body));
    expect(retry.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('log_only policy over ceiling → 200, generation proceeds (deploy-safe)', async () => {
    setPolicy('log_only', 0.01);

    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'spring sale' })
    );
    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('NO policy row → behaviour unchanged (200, no enforcement)', async () => {
    mockPolicyFindUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'spring sale' })
    );
    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('under ceiling → 200 and the reservation is committed (in-flight back to 0)', async () => {
    setPolicy('enforce', 10);

    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'spring sale' })
    );
    expect(res.status).toBe(200);
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
    expect(snapshot.inFlightReservedUsd.monthly).toBe(0);
  });

  it('failed generation → reservation released (in-flight back to 0)', async () => {
    setPolicy('enforce', 10);
    mockGenerateContent.mockRejectedValue(new Error('provider down'));

    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'spring sale' })
    );
    expect(res.status).toBe(500);
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
  });
});
