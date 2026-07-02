/**
 * Unit test — POST /api/posts/quick-create (the "10x" one-input post path).
 *
 * Drives the validation ladder on the real handler:
 *   401 (no key/session) → 503 (no AI key) → 400 (no brand) → 400 (bad body) → 200.
 * Plus: the branded generator is preferred, falls back to the base generator on
 * throw, and the persisted Post is a draft tagged source:'quick'.
 */

const findManyConnections = jest.fn();
const findFirstCampaign = jest.fn();
const createCampaign = jest.fn();
const createPost = jest.fn();

const mockPrisma = {
  platformConnection: {
    findMany: (...a: unknown[]) => findManyConnections(...a),
  },
  campaign: {
    findFirst: (...a: unknown[]) => findFirstCampaign(...a),
    create: (...a: unknown[]) => createCampaign(...a),
  },
  post: { create: (...a: unknown[]) => createPost(...a) },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));

// Rate limiter: pass-through wrapper + spy-able usage tracker.
const trackUsage = jest.fn();
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
  UsageTracker: { track: (...a: unknown[]) => trackUsage(...a) },
}));

// API-key gate: by default authenticate as user-1; overridable to a 401.
const requireApiKeyImpl = jest.fn();
jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (req: unknown, handler: (userId: string) => unknown) =>
    requireApiKeyImpl(req, handler),
}));

const getUserAICredentials = jest.fn();
jest.mock('@/lib/ai/api-credential-injector', () => ({
  getUserAICredentials: (...a: unknown[]) => getUserAICredentials(...a),
}));

const getEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) =>
    getEffectiveOrganizationId(...a),
}));

const brandedGenerate = jest.fn();
jest.mock('@/lib/services/client-branded-content', () => ({
  ClientBrandedContentService: {
    generate: (...a: unknown[]) => brandedGenerate(...a),
  },
}));

const baseGenerate = jest.fn();
jest.mock('@/lib/ai/content-generator', () => ({
  aiContentGenerator: {
    generateContent: (...a: unknown[]) => baseGenerate(...a),
  },
}));

const evaluateContent = jest.fn();
const scoreDimensions = jest.fn();
jest.mock('@/lib/autopilot/quality-gate', () => ({
  evaluateContent: (...a: unknown[]) => evaluateContent(...a),
  scoreDimensions: (...a: unknown[]) => scoreDimensions(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = 'sk-test';

  // Default: authenticated → handler runs as user-1.
  requireApiKeyImpl.mockImplementation(
    (_req: unknown, handler: (userId: string) => unknown) => handler('user-1')
  );
  getUserAICredentials.mockResolvedValue({ apiKey: 'sk-user' });
  getEffectiveOrganizationId.mockResolvedValue('org-1');
  findManyConnections.mockResolvedValue([{ platform: 'instagram' }]);
  findFirstCampaign.mockResolvedValue(null);
  createCampaign.mockResolvedValue({ id: 'camp-1' });
  createPost.mockResolvedValue({ id: 'post-1' });
  brandedGenerate.mockResolvedValue({
    content: 'Generated post body',
    variations: ['v1', 'v2'],
  });
  baseGenerate.mockResolvedValue({
    content: 'fallback body',
    variations: [{ id: '1', content: 'fv1', style: 'alt', score: 70 }],
  });
  scoreDimensions.mockReturnValue({
    readability: 80,
    engagement: 70,
    platformFit: 75,
    clarity: 80,
    emotional: 65,
    writingQuality: 78,
  });
  evaluateContent.mockReturnValue({
    decision: 'draft',
    score: 72,
    reason: 'held for review',
  });
});

import { POST } from '@/app/api/posts/quick-create/route';

function makeRequest(body?: unknown) {
  return {
    json: async () => body ?? {},
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/posts/quick-create', () => {
  test('no API key/session → 401 (gate short-circuits)', async () => {
    requireApiKeyImpl.mockResolvedValue({
      status: 401,
      json: async () => ({ error: 'Unauthorised' }),
    });
    const res = await POST(makeRequest({ intent: 'hi' }));
    expect(res.status).toBe(401);
    expect(createPost).not.toHaveBeenCalled();
  });

  test('no AI provider key → 503', async () => {
    getUserAICredentials.mockResolvedValue(null);
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const res = await POST(makeRequest({ intent: 'hi' }));
    expect(res.status).toBe(503);
    expect(createPost).not.toHaveBeenCalled();
  });

  test('no active brand → 400', async () => {
    getEffectiveOrganizationId.mockResolvedValue(null);
    const res = await POST(makeRequest({ intent: 'hi' }));
    expect(res.status).toBe(400);
    expect(createPost).not.toHaveBeenCalled();
  });

  test('intent over 500 chars → 400', async () => {
    const res = await POST(makeRequest({ intent: 'a'.repeat(501) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request data');
    expect(createPost).not.toHaveBeenCalled();
  });

  test('happy path → 200, draft Post tagged source:quick on an auto-publish platform', async () => {
    const res = await POST(makeRequest({ intent: 'new water-damage callout' }));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({
      postId: 'post-1',
      content: 'Generated post body',
      platform: 'instagram',
      canSchedule: true,
      score: 72,
      decision: 'draft',
    });

    const data = createPost.mock.calls[0][0].data;
    expect(data).toMatchObject({
      platform: 'instagram',
      campaignId: 'camp-1',
      status: 'draft',
      source: 'quick',
    });
    expect(data.metadata).toMatchObject({ source: 'quick', decision: 'draft' });
    expect(trackUsage).toHaveBeenCalledWith('user-1', 'ai_posts', 1);
  });

  test('branded generator throws → falls back to base generator, still 200', async () => {
    brandedGenerate.mockRejectedValue(new Error('branded down'));
    const res = await POST(makeRequest({ intent: 'hi' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toBe('fallback body');
    expect(baseGenerate).toHaveBeenCalled();
  });

  test('blank intent still produces a post (on-brand default)', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(brandedGenerate).toHaveBeenCalled();
    const data = createPost.mock.calls[0][0].data;
    expect(data.metadata.intent).toBeNull();
  });
});
