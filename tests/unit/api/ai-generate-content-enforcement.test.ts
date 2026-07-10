/**
 * SYN-MCP-003 — REAL enforcement contract for POST /api/ai/generate-content:
 *
 *  - maxCostUsd budget preflight rejects 402 BEFORE any generator call
 *    (single AND batch; batch estimate = sum of children).
 *  - idempotencyKey dedupe: duplicate (same user) replays the cached
 *    envelope without a second generation; a DIFFERENT user with the same
 *    key is never deduped together (tenant scoping).
 *  - failed generation releases the key so the client can retry.
 *  - GenerationContext is server-built: body-supplied organizationId is
 *    ignored — the generator receives the org from the authed user lookup.
 *
 * Invokes the REAL route handler (same pattern as the SYN-MCP-002 batch
 * suite); the Redis idempotency store runs on its in-memory fallback.
 */

// --- Mocks ---------------------------------------------------------------
const mockGenerateContent = jest.fn();
const mockBatchGenerate = jest.fn();
const mockBrandedGenerate = jest.fn();
const mockUsageTrack = jest.fn();
const mockVisibilityScore = jest.fn();
const mockUserFindUnique = jest.fn();
const mockGetUserAICredentials = jest.fn();

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

// Mutable authed user so tenant-scoping can be exercised across "users".
let currentUserId = 'test-user-id';
jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_req: unknown, handler: (userId: string) => unknown) =>
    handler(currentUserId),
}));
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
  UsageTracker: { track: (...a: unknown[]) => mockUsageTrack(...a) },
}));

jest.mock('@/lib/ai/api-credential-injector', () => ({
  getUserAICredentials: (...a: unknown[]) => mockGetUserAICredentials(...a),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
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

describe('POST /api/ai/generate-content — SYN-MCP-003 enforcement', () => {
  const originalOpenAI = process.env.OPENAI_API_KEY;
  let generatedCounter = 0;

  beforeEach(() => {
    currentUserId = 'test-user-id';
    process.env.OPENAI_API_KEY = 'sk-test-platform-key';
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-123' });
    mockUsageTrack.mockResolvedValue(undefined);
    mockVisibilityScore.mockResolvedValue(undefined);
    mockGetUserAICredentials.mockResolvedValue(null);
    // Branded service fails so the route falls through to the (asserted)
    // aiContentGenerator path with its GenerationContext argument.
    mockBrandedGenerate.mockRejectedValue(new Error('branded unavailable'));
    mockGenerateContent.mockImplementation(async () =>
      fakeGenerated(`gen-${++generatedCounter}`)
    );
    mockBatchGenerate.mockImplementation(async (reqs: unknown[]) =>
      reqs.map((_r, i) => fakeGenerated(`batch-${i}`))
    );
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalOpenAI;
  });

  // ---------------------------------------------------------------------
  // Budget preflight (402 pre-spend)
  // ---------------------------------------------------------------------
  it('rejects an over-budget single request with 402 BEFORE any generation', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        topic: 'spring sale',
        maxCostUsd: 0.0001,
      })
    );

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('Budget exceeded');
    expect(json.estimatedCostUsd).toBeGreaterThan(json.maxCostUsd);
    expect(json.message).toMatch(/remaining request budget/);

    // Pre-spend: NOTHING was generated or tracked.
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockBrandedGenerate).not.toHaveBeenCalled();
    expect(mockBatchGenerate).not.toHaveBeenCalled();
    expect(mockUsageTrack).not.toHaveBeenCalled();
  });

  it('rejects an over-budget batch (sum of children) with 402', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: Array.from({ length: 10 }, (_x, i) => ({
          platform: 'twitter',
          topic: `t-${i}`,
        })),
        maxCostUsd: 0.05, // below 10 × per-request estimate
      })
    );

    expect(res.status).toBe(402);
    expect(mockBatchGenerate).not.toHaveBeenCalled();
  });

  it('allows a request whose estimate fits the budget', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        topic: 'spring sale',
        maxCostUsd: 5,
      })
    );
    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------
  // Idempotency (tenant-scoped replay)
  // ---------------------------------------------------------------------
  it('replays the cached envelope for a duplicate key (same user) without regenerating', async () => {
    const body = {
      platform: 'twitter',
      topic: 'spring sale',
      idempotencyKey: 'replay-key-000001',
    };

    const first = await POST(makeRequest(body));
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const second = await POST(makeRequest(body));
    expect(second.status).toBe(200);
    expect(second.headers.get('Idempotent-Replay')).toBe('true');
    const secondJson = await second.json();

    // Same envelope, no second generation.
    expect(secondJson).toEqual(firstJson);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('does NOT replay across users — a different user with the same key generates fresh', async () => {
    const body = {
      platform: 'twitter',
      topic: 'spring sale',
      idempotencyKey: 'shared-key-000002',
    };

    currentUserId = 'user-alpha';
    const first = await POST(makeRequest(body));
    expect(first.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    currentUserId = 'user-beta';
    const second = await POST(makeRequest(body));
    expect(second.status).toBe(200);
    // Header absent (test-env polyfill returns undefined; spec returns null).
    expect(second.headers.get('Idempotent-Replay')).not.toBe('true');
    // A REAL second generation happened for the second tenant.
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('releases the key after a failed generation so a retry succeeds', async () => {
    const body = {
      platform: 'twitter',
      topic: 'spring sale',
      idempotencyKey: 'retry-key-000003',
    };

    mockGenerateContent.mockRejectedValueOnce(new Error('provider down'));
    const failed = await POST(makeRequest(body));
    expect(failed.status).toBe(500);

    const retry = await POST(makeRequest(body));
    expect(retry.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------
  // Server-built GenerationContext (never from the body)
  // ---------------------------------------------------------------------
  it('builds the GenerationContext from the authed user lookup, ignoring body organizationId', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        topic: 'spring sale',
        // Injection attempt — the schema does not accept this field.
        organizationId: 'attacker-org',
      })
    );
    expect(res.status).toBe(200);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [request, ctx] = mockGenerateContent.mock.calls[0];
    expect(request.orgId).toBe('org-123');
    expect(ctx).toMatchObject({
      organizationId: 'org-123',
      userId: 'test-user-id',
      autonomyLevel: 'manual',
    });
    expect(typeof ctx.traceId).toBe('string');
  });

  it('threads the ctx into batchGenerate as well', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: [{ platform: 'twitter', topic: 'a' }],
      })
    );
    expect(res.status).toBe(200);
    const [, ctx] = mockBatchGenerate.mock.calls[0];
    expect(ctx).toMatchObject({
      organizationId: 'org-123',
      userId: 'test-user-id',
    });
  });
});
