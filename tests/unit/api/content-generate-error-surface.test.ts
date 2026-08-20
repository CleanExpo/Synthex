/**
 * Error-surface tests for POST/PUT /api/content/generate.
 *
 * Proves the finish-line contract:
 *  (a) missing provider key  → clear, actionable 503 (NOT a generic 500, NOT a
 *      silent blank `variations: []`)
 *  (b) transient provider error (key present, call failed) → sensible 503
 *  (c) success path is unchanged (200 with the generated content)
 *
 * These tests invoke the REAL route handlers so the actual error mapping in
 * app/api/content/generate/route.ts is exercised end to end. The provider/AI
 * boundary is mocked via the content-generator service.
 */

import {
  ProviderConfigError,
  ProviderUnavailableError,
} from '@/lib/services/content-generator';

// --- Mocks ---------------------------------------------------------------

const mockGenerateContent = jest.fn();
const mockGenerateWithAI = jest.fn();

jest.mock('@/lib/services/content-generator', () => {
  // Preserve the real error classes (needed by both the route's instanceof
  // checks and these tests) while stubbing the singleton's methods.
  const actual = jest.requireActual('@/lib/services/content-generator');
  return {
    ...actual,
    contentGenerator: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
      generateWithAI: (...args: unknown[]) => mockGenerateWithAI(...args),
    },
  };
});

// Prisma — no persona lookups exercised here (no personaId in requests).
jest.mock('@/lib/prisma', () => ({
  prisma: { persona: { findUnique: jest.fn() } },
  default: { persona: { findUnique: jest.fn() } },
}));

// Supabase client — content.create is best-effort; default to resolving.
const mockContentCreate = jest.fn().mockResolvedValue({ id: 'content-1' });
jest.mock('@/lib/platform/client', () => ({
  db: { content: { create: (...args: unknown[]) => mockContentCreate(...args) } },
  supabase: {},
}));

// Auth + rate-limit wrappers — pass straight through, attaching a userId.
jest.mock('@/lib/middleware/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => unknown) =>
    async (req: Record<string, unknown>) => {
      req.userId = 'test-user-id';
      return handler(req);
    },
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

// Logger — silence + assert no secret leakage indirectly.
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Import AFTER mocks are registered.
import { POST, PUT } from '@/app/api/content/generate/route';

function makeRequest(body: unknown): any {
  return {
    headers: { get: () => 'Bearer valid-token' },
    json: async () => body,
  };
}

const validPostBody = {
  platform: 'twitter',
  topic: 'AI trends in 2026',
  hookType: 'question',
  tone: 'professional',
  targetLength: 'medium',
};

describe('POST /api/content/generate — provider error surfacing', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockGenerateWithAI.mockReset();
    mockContentCreate.mockClear();
  });

  it('(a) missing provider key → 503 with actionable message, not a 500 and not blank', async () => {
    mockGenerateContent.mockRejectedValue(
      new ProviderConfigError(
        'AI API key not configured. Content generation requires an API key. Configure OPENAI_API_KEY in environment variables or your own key in Settings.'
      )
    );

    const res = await POST(makeRequest(validPostBody));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(res.status).not.toBe(500);
    expect(json.success).toBe(false);
    // Actionable: names the env var to configure.
    expect(json.error).toMatch(/OPENAI_API_KEY/);
    expect(json.error).toMatch(/not configured/i);
    // NOT a silent blank — there is a real error, not an empty payload.
    expect(json.content).toBeUndefined();
  });

  it('(b) transient provider error (key present, call failed) → sensible 503', async () => {
    mockGenerateContent.mockRejectedValue(
      new ProviderUnavailableError('AI generation failed: 503 upstream timeout')
    );

    const res = await POST(makeRequest(validPostBody));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe('string');
    expect(json.error.length).toBeGreaterThan(0);
    expect(json.error).toMatch(/unavailable|try again/i);
  });

  it('preserves genuine 500 for truly-unexpected (non-provider) errors', async () => {
    mockGenerateContent.mockRejectedValue(new TypeError('cannot read property of undefined'));

    const res = await POST(makeRequest(validPostBody));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/unexpected/i);
  });

  it('(c) success path unchanged → 200 with content, variations preserved', async () => {
    const generated = {
      primary: 'Main content here',
      variations: ['Variation 1', 'Variation 2', 'Variation 3'],
      metadata: { platform: 'twitter', hashtags: ['#ai'] },
    };
    mockGenerateContent.mockResolvedValue(generated);

    const res = await POST(makeRequest(validPostBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.content).toEqual(generated);
    expect(json.content.variations).toHaveLength(3);
    expect(json.userId).toBe('test-user-id');
  });

  it('still returns 400 for validation failures (contract unchanged)', async () => {
    const res = await POST(makeRequest({ platform: 'not-a-platform', topic: '' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/validation/i);
  });
});

describe('PUT /api/content/generate (AI) — provider error surfacing', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockGenerateWithAI.mockReset();
  });

  const validPutBody = { prompt: 'Write a tweet about coffee', maxTokens: 200 };

  it('(a) missing provider key → 503 with actionable message', async () => {
    mockGenerateWithAI.mockRejectedValue(
      new ProviderConfigError(
        'AI API key not configured. Content generation requires an API key. Configure OPENAI_API_KEY in environment variables or your own key in Settings.'
      )
    );

    const res = await PUT(makeRequest(validPutBody));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/OPENAI_API_KEY/);
  });

  it('(b) transient provider error → 503', async () => {
    mockGenerateWithAI.mockRejectedValue(
      new ProviderUnavailableError('AI generation failed: rate limited')
    );

    const res = await PUT(makeRequest(validPutBody));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.success).toBe(false);
  });

  it('preserves genuine 500 for unexpected errors', async () => {
    mockGenerateWithAI.mockRejectedValue(new RangeError('boom'));

    const res = await PUT(makeRequest(validPutBody));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toMatch(/unexpected/i);
  });

  it('(c) success path unchanged → 200 with content', async () => {
    mockGenerateWithAI.mockResolvedValue('A great tweet about coffee ☕');

    const res = await PUT(makeRequest(validPutBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.content).toBe('A great tweet about coffee ☕');
  });
});
