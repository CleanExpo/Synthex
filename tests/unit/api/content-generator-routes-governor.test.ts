/**
 * P5 / M10 — the content-generator routes reach their paid text provider only
 * through the AI Governor, in GOVERNOR_MODE (shadow until a human flips it).
 *
 * SEAM: the four route handlers, invoked directly. Only the boundaries are
 * faked: the database (an in-memory Prisma stand-in that records every
 * pipeline_cost_ledger row), the text provider (getAIProvider /
 * OpenRouterClient returning fixed usage), auth and the rate limiter. The
 * content generator and the Governor run for real.
 *
 * CATCHES: a provider call with no Governor receipt; a second ledger row for
 * the same generation (the generator's own recordGenerationCost left in place
 * beside the receipt); a receipt that hides the real model or token usage; a
 * shadow-mode refusal that changes the HTTP result; an enforcing refusal that
 * still reaches the provider or is reported as a generic 500.
 * MISSES: real Postgres semantics, real provider pricing, the branded-content
 * service's own provider (faked as failing so the generator path is taken).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

// --- Database boundary ---------------------------------------------------
interface Row {
  [key: string]: unknown;
}
const mockDb = {
  ledger: [] as Row[],
  overrides: {} as Record<string, Record<string, (...a: any[]) => unknown>>,
};
function mockModel(name: string) {
  return new Proxy(
    {},
    {
      get(_t, method: string) {
        const override = mockDb.overrides[name]?.[method];
        if (override) return async (...a: unknown[]) => override(...a);
        if (name === 'pipelineCostLedger' && method === 'create') {
          return async ({ data }: { data: Row }) => {
            mockDb.ledger.push(data);
            return data;
          };
        }
        if (method === 'findMany') return async () => [];
        if (method === 'count') return async () => 0;
        return async () => null;
      },
    }
  );
}
const mockPrismaClient = new Proxy(
  {},
  {
    get(_t, name: string) {
      if (name === 'then') return undefined;
      if (name === '$transaction') {
        return async (fn: unknown) =>
          typeof fn === 'function' ? fn(mockPrismaClient) : [];
      }
      return mockModel(name);
    },
  }
);
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrismaClient,
  default: mockPrismaClient,
}));

// --- Text-provider boundary ----------------------------------------------
const mockComplete = jest.fn();
const MODELS = {
  fast: 'gpt-test-fast',
  balanced: 'gpt-test-balanced',
  creative: 'gpt-test-creative',
};
jest.mock('@/lib/ai/providers', () => ({
  resolvePlatformProviderName: () => 'openai',
  getAIProvider: () => ({
    name: 'OpenAI',
    models: MODELS,
    complete: (...a: unknown[]) => mockComplete(...a),
  }),
}));
jest.mock('@/lib/ai/openrouter-client', () => ({
  OpenRouterClient: class {
    models = { ...MODELS, balanced: 'or-test-balanced' };
    complete = (...a: unknown[]) => mockComplete(...a);
  },
}));

// --- Auth, limiter, side services ----------------------------------------
jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_r: unknown, handler: (u: string) => unknown) =>
    handler('user-1'),
}));
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_r: unknown, fn: () => unknown) => fn(),
  UsageTracker: { track: async () => undefined },
}));
jest.mock('@/lib/rate-limit', () => ({
  aiGeneration: (_r: unknown, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: async () => 'user-1',
  unauthorizedResponse: () => new Response('{}', { status: 401 }),
}));
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/ai/api-credential-injector', () => ({
  getUserAICredentials: async () => null,
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org-1',
}));
jest.mock('@/lib/services/client-branded-content', () => ({
  ClientBrandedContentService: {
    generate: async () => {
      throw new Error('branded unavailable');
    },
  },
}));
jest.mock('@/lib/auth/monitoring', () => ({
  authMonitor: { trackEvent: () => undefined },
}));
jest.mock('@/lib/scoring/visibility-score', () => ({
  calculateVisibilityScore: async () => undefined,
}));
jest.mock('@/lib/obsidian/client-knowledge-base', () => ({
  buildContextForGeneration: async () => '',
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
// Autopilot collaborators that are not under test.
jest.mock('@/lib/autopilot/daily-planner', () => ({
  planDailyContent: async () => ({
    slots: [
      {
        platform: 'linkedin',
        date: new Date('2026-10-20T00:00:00Z'),
        theme: 'educational',
      },
    ],
  }),
}));
jest.mock('@/lib/autopilot/quality-gate', () => ({
  evaluateContent: () => ({ decision: 'schedule', score: 90 }),
  scoreDimensions: () => ({ engagement: 90 }),
}));
jest.mock('@/lib/ml/posting-time-predictor', () => ({
  postingTimePredictor: { getOptimalTimes: async () => null },
}));
jest.mock('@/lib/autopilot/grounded-post-image', () => ({
  attachGroundedImage: async () => ({ status: 'draft', images: [], meta: {} }),
}));

// Every provider call reports the same usage, so a generation's receipt must
// carry (calls x usage): the main call plus the two style variations.
const USAGE = { prompt_tokens: 100, completion_tokens: 50 };

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function autopilotConfig() {
  return {
    id: 'cfg-1',
    organizationId: 'org-1',
    enabled: true,
    enabledPlatforms: ['linkedin'],
    planningHorizonDays: 7,
    postsPerDayPerPlatform: 1,
    contentMix: {},
    autoApproveThreshold: 80,
    minScoreThreshold: 60,
    organization: {
      id: 'org-1',
      name: 'Acme',
      slug: 'acme',
      industry: 'restoration',
      brandDna: null,
      users: [{ id: 'user-1' }],
      teamMembers: [{ userId: 'user-1', role: 'owner' }],
    },
  };
}

beforeEach(() => {
  mockDb.ledger = [];
  mockDb.overrides = {
    user: { findUnique: () => ({ organizationId: 'org-1' }) },
    organization: { findUnique: () => ({ slug: 'acme' }) },
    platformConnection: { findMany: () => [{ platform: 'linkedin' }] },
    campaign: { findFirst: () => ({ id: 'camp-1' }) },
    post: { create: () => ({ id: 'post-1' }) },
    autopilotConfig: {
      findMany: () => [autopilotConfig()],
      update: () => ({}),
    },
    autopilotRun: { create: () => ({ id: 'run-1' }), update: () => ({}) },
  };
  mockComplete.mockReset();
  mockComplete.mockResolvedValue({
    id: 'cmpl-1',
    model: 'provider-echo',
    choices: [
      {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            posts: [{ variation: 1, content: 'Post', hashtags: [] }],
            improvementTips: ['Tip'],
          }),
        },
        finish_reason: 'stop',
      },
    ],
    usage: { ...USAGE, total_tokens: 150 },
  });
});

const profile = {
  platform: 'linkedin',
  username: 'acme',
  displayName: 'Acme',
  bio: null,
  followerCount: 10,
  followingCount: 5,
  postCount: 3,
  engagementRate: null,
  topHashtags: [],
  postingFrequencyPerWeek: null,
  audienceActivityPatterns: null,
  avatarUrl: null,
  verified: false,
  profileUrl: 'https://linkedin.com/in/acme',
};

const ROUTES = {
  'ai/generate-content POST': {
    load: () => require('@/app/api/ai/generate-content/route').POST,
    req: () =>
      createMockNextRequest({
        method: 'POST',
        body: { platform: 'linkedin', topic: 'Flood recovery' },
      }),
    runner: 'ai-generate-content',
    model: MODELS.balanced,
    calls: 3,
  },
  'posts/quick-create POST': {
    load: () => require('@/app/api/posts/quick-create/route').POST,
    req: () =>
      createMockNextRequest({ method: 'POST', body: { intent: 'Flood' } }),
    runner: 'posts-quick-create',
    model: MODELS.balanced,
    calls: 3,
  },
  'cron/autopilot GET': {
    load: () => require('@/app/api/cron/autopilot/route').GET,
    req: () =>
      createMockNextRequest({ url: 'http://localhost/api/cron/autopilot' }),
    runner: 'cron-autopilot',
    model: MODELS.balanced,
    calls: 3,
  },
  'profile-analyser/generate-content POST': {
    load: () =>
      require('@/app/api/profile-analyser/generate-content/route').POST,
    req: () => createMockNextRequest({ method: 'POST', body: { profile } }),
    runner: 'profile-analyser',
    model: 'or-test-balanced',
    calls: 1,
  },
} as const;

describe.each(Object.entries(ROUTES))('%s — shadow mode', (_name, route) => {
  it('writes exactly one Governor receipt with the real model and usage, HTTP unchanged', async () => {
    const res = await route.load()(route.req());
    await flush();

    expect(res.status).toBe(200);
    expect(mockComplete).toHaveBeenCalledTimes(route.calls);
    expect(mockDb.ledger).toEqual([
      expect.objectContaining({
        clientId: 'org-1',
        brandSlug: 'acme',
        runner: route.runner,
        model: route.model,
        inputTokens: 100 * route.calls,
        outputTokens: 50 * route.calls,
        outcome: 'completed',
        // No RunnerFlag row: shadow logs the would-be refusal, never blocks.
        provenance: expect.objectContaining({
          shadowRefusal: expect.objectContaining({
            outcome: 'refused_flag_missing',
          }),
        }),
      }),
    ]);
  });
});

describe('enforcing mode (the P9 human flip, simulated)', () => {
  function loadEnforcing(load: () => unknown) {
    let handler: any;
    jest.isolateModules(() => {
      jest.doMock('@/lib/ai/governor/mode', () => ({
        GOVERNOR_MODE: 'enforcing',
      }));
      handler = load();
    });
    jest.dontMock('@/lib/ai/governor/mode');
    return handler;
  }

  it.each([
    'ai/generate-content POST',
    'posts/quick-create POST',
    'profile-analyser/generate-content POST',
  ] as const)(
    '%s refuses honestly with a code and never reaches the provider',
    async name => {
      const route = ROUTES[name];
      const res = await loadEnforcing(route.load)(route.req());
      await flush();

      expect(mockComplete).not.toHaveBeenCalled();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(
        expect.objectContaining({ code: 'refused_flag_missing' })
      );
      expect(mockDb.ledger).toEqual([
        expect.objectContaining({ outcome: 'refused_flag_missing' }),
      ]);
    }
  );

  it('cron/autopilot records the refusal and creates no post', async () => {
    const route = ROUTES['cron/autopilot GET'];
    const createPost = jest.fn(() => ({ id: 'post-1' }));
    mockDb.overrides.post = { create: createPost };
    const res = await loadEnforcing(route.load)(route.req());
    await flush();

    expect(res.status).toBe(200);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
    // One refusal for the slot — a refusal is not retried.
    expect(mockDb.ledger).toEqual([
      expect.objectContaining({ outcome: 'refused_flag_missing' }),
    ]);
  });
});

describe('the ledger seam', () => {
  it('counts the generator self-ledger row (control: planted failure is caught)', async () => {
    // Planted duplicate: the generator called WITHOUT a Governor around it
    // writes its own row. If a route left that write in place beside the
    // receipt, the one-row assertions above would see two rows and fail.
    const { aiContentGenerator } = require('@/lib/ai/content-generator');
    await aiContentGenerator.generateContent(
      { type: 'post', platform: 'linkedin', topic: 'Flood' },
      {
        organizationId: 'org-1',
        userId: 'user-1',
        traceId: 'trace-1',
        autonomyLevel: 'manual',
      }
    );
    await flush();
    expect(mockDb.ledger).toHaveLength(1);
    expect(mockDb.ledger[0].runner).toBeUndefined();
  });
});
