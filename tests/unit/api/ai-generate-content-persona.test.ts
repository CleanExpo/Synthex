/**
 * Persona-forwarding contract tests for POST /api/ai/generate-content.
 *
 * The main content UI (app/dashboard/content/page.tsx) sends `personaId` when
 * the user selects a trained persona. This route previously dropped it: it was
 * absent from the Zod schema and never forwarded to any generator, so the
 * chosen voice was silently ignored.
 *
 * These tests invoke the REAL route handler so the actual wiring is exercised:
 *  (a) personaId present  → routes to the persona-aware aiContentGenerator and
 *      forwards personaId + orgId (NOT the BrandDNA-only branded service which
 *      cannot apply a specific persona).
 *  (b) personaId absent   → unchanged behaviour: branded service path when an
 *      org + topic exist.
 */

// --- Mocks ---------------------------------------------------------------

// NOTE: jest.worktree.cjs sets resetMocks:true, which strips any
// implementation passed to jest.fn(impl) before each test. So every mock
// implementation below is (re)installed in beforeEach, not in the factories.
const mockGenerateContent = jest.fn();
const mockBrandedGenerate = jest.fn();
const mockUsageTrack = jest.fn();
const mockVisibilityScore = jest.fn();

jest.mock('@/lib/ai/content-generator', () => ({
  aiContentGenerator: {
    generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    batchGenerate: jest.fn(),
  },
}));

jest.mock('@/lib/services/client-branded-content', () => ({
  ClientBrandedContentService: {
    generate: (...args: unknown[]) => mockBrandedGenerate(...args),
  },
}));

// Auth + API-key gate + rate-limit wrappers — pass straight through.
jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (
    _req: unknown,
    handler: (userId: string) => unknown
  ) => handler('test-user-id'),
}));
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
  UsageTracker: { track: (...a: unknown[]) => mockUsageTrack(...a) },
}));

// User credentials — none configured; platform key present (set below).
const mockGetUserAICredentials = jest.fn();
jest.mock('@/lib/ai/api-credential-injector', () => ({
  getUserAICredentials: (...a: unknown[]) => mockGetUserAICredentials(...a),
}));

// Prisma — user lookup resolves the org for the request.
const mockUserFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) } },
  default: { user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) } },
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

const fakeGenerated = {
  id: 'content-1',
  content: 'Generated in persona voice',
  platform: 'twitter',
  variations: [],
  hashtags: ['#a'],
  emojis: [],
  hooks: [],
  estimatedEngagement: 3,
  viralScore: 60,
  metadata: {
    generatedAt: new Date(),
    model: 'gpt-test',
    tokens: 10,
    processingTime: 5,
  },
};

describe('POST /api/ai/generate-content — persona forwarding', () => {
  const originalOpenAI = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-platform-key';
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-123' });
    mockGenerateContent.mockResolvedValue(fakeGenerated);
    mockUsageTrack.mockResolvedValue(undefined);
    mockVisibilityScore.mockResolvedValue(undefined);
    mockGetUserAICredentials.mockResolvedValue(null);
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

  it('forwards personaId + orgId to the persona-aware generator', async () => {
    const res = await POST(
      makeRequest({
        type: 'post',
        platform: 'twitter',
        topic: 'spring sale',
        tone: 'casual',
        personaId: 'persona-42',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.content).toBe('Generated in persona voice');

    // The branded (BrandDNA-only) service must NOT be used when a specific
    // persona was selected — it cannot apply that persona's voice.
    expect(mockBrandedGenerate).not.toHaveBeenCalled();

    // aiContentGenerator must receive the persona + org so the voice is applied.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const firstArg = mockGenerateContent.mock.calls[0][0];
    expect(firstArg.personaId).toBe('persona-42');
    expect(firstArg.orgId).toBe('org-123');
    expect(firstArg.platform).toBe('twitter');
    expect(firstArg.topic).toBe('spring sale');
  });

  it('uses the branded service path when no personaId is supplied', async () => {
    const res = await POST(
      makeRequest({
        type: 'post',
        platform: 'twitter',
        topic: 'spring sale',
        tone: 'casual',
      })
    );

    expect(res.status).toBe(200);
    expect(mockBrandedGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // SYN-1050 Phase 1: the branded path must score content with the real, pure
  // contentScorer — never the old `75 + Math.random()*25` mock.
  it('scores branded-path content + variations with the real scorer (deterministic, not random)', async () => {
    mockBrandedGenerate.mockResolvedValue({
      content:
        'Book a 15-min call and get your first post live this week — proven results for your business.',
      variations: [
        'Book a 15-min call and get your first post live this week.',
        'Stuff happens. Things are good. Very nice. Really.',
      ],
      model: 'm',
      metadata: { tokensUsed: 1 },
    });

    const body = {
      type: 'post',
      platform: 'linkedin',
      topic: 'spring sale',
      tone: 'casual',
    };

    const res1 = await POST(makeRequest(body));
    expect(res1.status).toBe(200);
    const j1 = (await res1.json()).data;

    // Two variations, each a real numeric score in [0,100].
    expect(j1.variations).toHaveLength(2);
    for (const v of j1.variations) {
      expect(typeof v.score).toBe('number');
      expect(v.score).toBeGreaterThanOrEqual(0);
      expect(v.score).toBeLessThanOrEqual(100);
    }
    // Engagement + viral are real derived numbers (not the old 45/60 stubs).
    expect(typeof j1.estimatedEngagement).toBe('number');
    expect(typeof j1.viralScore).toBe('number');

    // Determinism: identical input → identical scores. This is the core proof
    // the mock `Math.random()` is gone.
    const res2 = await POST(makeRequest(body));
    const j2 = (await res2.json()).data;
    expect(j2.variations.map((v: { score: number }) => v.score)).toEqual(
      j1.variations.map((v: { score: number }) => v.score)
    );
    expect(j2.viralScore).toBe(j1.viralScore);
    expect(j2.estimatedEngagement).toBe(j1.estimatedEngagement);

    // Content-derived: the specific CTA variation outscores the vague one.
    expect(j1.variations[0].score).toBeGreaterThan(j1.variations[1].score);
  });

  // SYN-1053 Phase 3: variations below the quality threshold are flagged
  // (never blocked) using the pure contentScorer — zero added AI cost.
  it('flags branded-path variations below the quality threshold (additive, never blocking)', async () => {
    mockBrandedGenerate.mockResolvedValue({
      content:
        'Book a 15-min call and get your first post live this week — proven results for your business.',
      variations: [
        'Book a 15-min call and get your first post live this week.',
        'Stuff happens. Things are good. Very nice. Really.',
      ],
      model: 'm',
      metadata: { tokensUsed: 1 },
    });

    const res = await POST(
      makeRequest({
        type: 'post',
        platform: 'linkedin',
        topic: 'spring sale',
        tone: 'casual',
      })
    );

    expect(res.status).toBe(200);
    const data = (await res.json()).data;

    // Top-level flagging metadata survives Zod validation.
    expect(data.qualityThreshold).toBe(80);
    expect(typeof data.flaggedCount).toBe('number');

    // Two variations, each carries a boolean belowThreshold flag.
    expect(data.variations).toHaveLength(2);
    for (const v of data.variations) {
      expect(typeof v.belowThreshold).toBe('boolean');
    }

    // The weak, low-quality variation is flagged below the threshold.
    expect(data.variations[1].belowThreshold).toBe(true);

    // belowThreshold is consistent with the score ordering: the weak variation
    // scores below the strong CTA one, so it is no "less flagged" than it.
    expect(data.variations[1].score).toBeLessThan(data.variations[0].score);
    // The strong variation is never MORE flagged than the weak one.
    expect(
      Number(data.variations[0].belowThreshold)
    ).toBeLessThanOrEqual(Number(data.variations[1].belowThreshold));

    // flaggedCount matches the number of belowThreshold variations and flags
    // at least the weak one.
    const flagged = data.variations.filter(
      (v: { belowThreshold?: boolean }) => v.belowThreshold
    ).length;
    expect(flagged).toBeGreaterThanOrEqual(1);
    expect(data.flaggedCount).toBe(flagged);

    // Never blocking: all variations still returned, none rejected.
    expect(data.variations.every((v: { content: string }) => v.content)).toBe(
      true
    );
  });
});
