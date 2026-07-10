/**
 * SYN-MCP-002 — batch cost-containment contract tests for
 * POST /api/ai/generate-content.
 *
 * Defects under test (vs main @ 2bd24eb5):
 *  - route.ts:98  batchRequests was z.array(z.any()) — untyped, unbounded.
 *  - route.ts:159-166 the batch branch returned EARLY, before organisation
 *    resolution and before UsageTracker.track — batch children got no brand
 *    context and were never counted against subscription limits.
 *
 * These tests invoke the REAL route handler so the actual wiring is
 * exercised (same pattern as ai-generate-content-persona.test.ts).
 */

// --- Mocks ---------------------------------------------------------------

// NOTE: jest.worktree.cjs sets resetMocks:true, so implementations are
// (re)installed in beforeEach, not in the factories.
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

// Auth + API-key gate + rate-limit wrappers — pass straight through.
jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_req: unknown, handler: (userId: string) => unknown) =>
    handler('test-user-id'),
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

const validBatchItem = { platform: 'twitter', topic: 'spring sale' };

describe('POST /api/ai/generate-content — SYN-MCP-002 batch containment', () => {
  const originalOpenAI = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-platform-key';
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-123' });
    mockUsageTrack.mockResolvedValue(undefined);
    mockVisibilityScore.mockResolvedValue(undefined);
    mockGetUserAICredentials.mockResolvedValue(null);
    mockBatchGenerate.mockImplementation(async (reqs: unknown[]) =>
      reqs.map((_r, i) => ({ id: `generated-${i}` }))
    );
    mockBrandedGenerate.mockResolvedValue({
      content: 'branded',
      variations: [],
      model: 'm',
      metadata: { tokensUsed: 1 },
    });
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalOpenAI;
  });

  // (a) Schema: cap at 10 items.
  it('rejects a batch of 11 items with 400 and never calls the generator', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: Array.from({ length: 11 }, () => ({
          ...validBatchItem,
        })),
      })
    );

    expect(res.status).toBe(400);
    expect(mockBatchGenerate).not.toHaveBeenCalled();
    expect(mockUsageTrack).not.toHaveBeenCalled();
  });

  // (a) Schema: inner items must conform to the single-request shape.
  it('rejects non-conforming inner batch items with 400', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: [
          validBatchItem,
          { platform: 'myspace', topic: 'not a real platform' },
        ],
      })
    );

    expect(res.status).toBe(400);
    expect(mockBatchGenerate).not.toHaveBeenCalled();
  });

  it('rejects an empty batch array with 400 (min 1)', async () => {
    const res = await POST(
      makeRequest({ platform: 'twitter', batchRequests: [] })
    );
    expect(res.status).toBe(400);
    expect(mockBatchGenerate).not.toHaveBeenCalled();
  });

  // (a) Schema: accepts up to 10 valid items.
  it('accepts a batch of 10 valid items and returns per-item results', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: Array.from({ length: 10 }, (_x, i) => ({
          platform: 'twitter',
          topic: `topic ${i}`,
        })),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(10);
    expect(json.data).toHaveLength(10);
    expect(mockBatchGenerate).toHaveBeenCalledTimes(1);
  });

  // (b) Ordering: org resolution happens BEFORE batch generation, the
  // resolved org is threaded into every child, and usage is tracked with
  // the child count.
  it('resolves the org first, passes it to every batch child, and tracks per-child usage', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: [
          { platform: 'twitter', topic: 'a' },
          { platform: 'linkedin', topic: 'b' },
          { platform: 'instagram', topic: 'c' },
        ],
      })
    );

    expect(res.status).toBe(200);

    // Org resolution ran, and ran BEFORE the batch generation call.
    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    expect(mockBatchGenerate).toHaveBeenCalledTimes(1);
    expect(mockUserFindUnique.mock.invocationCallOrder[0]).toBeLessThan(
      mockBatchGenerate.mock.invocationCallOrder[0]
    );

    // Every child carries the resolved org (ContentRequest.orgId — the same
    // mechanism the single path uses).
    const children = mockBatchGenerate.mock.calls[0][0];
    expect(children).toHaveLength(3);
    for (const child of children) {
      expect(child.orgId).toBe('org-123');
    }

    // Per-child usage accounting.
    expect(mockUsageTrack).toHaveBeenCalledTimes(1);
    expect(mockUsageTrack).toHaveBeenCalledWith('test-user-id', 'ai_posts', 3);
  });

  // New optional top-level fields are accepted (recorded now, enforced in 003).
  it('accepts idempotencyKey and maxCostUsd on a batch request', async () => {
    const res = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: [validBatchItem],
        idempotencyKey: 'idem-key-12345678',
        maxCostUsd: 2.5,
      })
    );
    expect(res.status).toBe(200);
    expect(mockBatchGenerate).toHaveBeenCalledTimes(1);
  });

  it('rejects out-of-bounds idempotencyKey / maxCostUsd', async () => {
    const shortKey = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: [validBatchItem],
        idempotencyKey: 'short',
      })
    );
    expect(shortKey.status).toBe(400);

    const bigBudget = await POST(
      makeRequest({
        platform: 'twitter',
        batchRequests: [validBatchItem],
        maxCostUsd: 50,
      })
    );
    expect(bigBudget.status).toBe(400);
    expect(mockBatchGenerate).not.toHaveBeenCalled();
  });

  // Backward compatibility: the single-request path is unchanged.
  it('leaves the single-request (non-batch) path unchanged', async () => {
    const res = await POST(
      makeRequest({
        type: 'post',
        platform: 'twitter',
        topic: 'spring sale',
        tone: 'casual',
      })
    );

    expect(res.status).toBe(200);
    expect(mockBatchGenerate).not.toHaveBeenCalled();
    expect(mockBrandedGenerate).toHaveBeenCalledTimes(1);
    // Single path still tracks exactly 1.
    expect(mockUsageTrack).toHaveBeenCalledWith('test-user-id', 'ai_posts', 1);
  });
});
