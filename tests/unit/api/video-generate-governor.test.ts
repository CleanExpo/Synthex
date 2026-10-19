/** @jest-environment node */
/**
 * /api/video/generate script mode: its paid TEXT call goes through the AI
 * Governor (P5, spec M10), in GOVERNOR_MODE (shadow), with one receipt per call.
 *
 * SEAM: the POST handler, called with a NextRequest. Faked only at the
 * boundaries: auth (APISecurityChecker), entitlement, rate limiter, the
 * database (the J9 in-memory Prisma, so the Governor's flag/BYOK/budget reads
 * and its ledger writes run for real), key decryption, and the text provider
 * returned by getAIProvider (counted).
 * CATCHES: a provider call with no ledger row, a receipt with invented model
 * or tokens, a shadow would-be refusal that blocks or changes the HTTP answer,
 * an enforcing refusal that reaches the provider or surfaces as a generic 500.
 * MISSES: real provider pricing drift (the registry owns that) and Postgres
 * semantics (J9 fake-db is in-memory).
 */
jest.mock('@/lib/prisma', () => {
  const db = jest.requireActual('../../eval/jev/families/j9/fake-db');
  const base = db.fakePrisma;
  const videoGeneration = {
    ...base.videoGeneration,
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) {
      const row = db
        .state()
        .videos.find((v: { id: string }) => v.id === where.id);
      Object.assign(row, data);
      return { createdAt: new Date(0), ...row };
    },
  };
  // The org's brand records: HermesConfig first, then the organisation slug.
  const hermesConfig = {
    findUnique: async () =>
      (globalThis as { __hermesBrand?: string }).__hermesBrand
        ? {
            brandSlug: (globalThis as { __hermesBrand?: string }).__hermesBrand,
          }
        : null,
  };
  const organization = {
    findUnique: async () => ({ slug: 'org-video-slug' }),
  };
  const prisma = { ...base, videoGeneration, hermesConfig, organization };
  return { __esModule: true, default: prisma, prisma };
});
jest.mock('@/lib/logger', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').loggerModule()
);
jest.mock('@/lib/redis-client', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').redisModule()
);
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: () => 'BRAND-OWN-KEY-PLACEHOLDER',
}));
jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'user-1' } }),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE' },
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () =>
    (globalThis as { __org?: string | null }).__org ?? null,
}));

// The text provider boundary. Plain functions: the unit profile resets jest.fn.
type Completion = {
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{ message: { content: string } }>;
};
const provider = {
  calls: [] as Array<{ model: string; apiKey?: string }>,
  fail: null as Error | null,
};
function fakeProvider(apiKey?: string) {
  return {
    name: 'Anthropic',
    models: {
      fast: 'claude-haiku-4-5',
      balanced: 'claude-sonnet-5',
      powerful: 'claude-opus-4-6',
    },
    async complete(req: { model: string }): Promise<Completion> {
      provider.calls.push({ model: req.model, apiKey });
      if (provider.fail) throw provider.fail;
      return {
        model: req.model,
        usage: {
          prompt_tokens: 321,
          completion_tokens: 654,
          total_tokens: 975,
        },
        choices: [{ message: { content: '{"title":"T","scenes":[]}' } }],
      };
    },
  };
}
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: (opts?: { apiKey?: string }) => fakeProvider(opts?.apiKey),
}));

import { NextRequest } from 'next/server';
import { resetState, state } from '../../eval/jev/families/j9/fake-db';

const ORG = 'org-video-1';
const BRAND = 'water-co';

function seedGovernor(): void {
  const s = state();
  s.runnerFlags.push({
    organizationId: ORG,
    brandSlug: BRAND,
    runner: 'video-script',
    enabled: true,
    killSwitch: false,
  });
  s.credentials.push({
    organizationId: ORG,
    provider: 'anthropic',
    id: 'cred-1',
    encryptedKey: 'encrypted-placeholder',
    isActive: true,
    revokedAt: null,
  });
  s.budgetPolicies.set(ORG, {
    dailyCeilingUsd: 100,
    providerDailyCeilingsUsd: null,
    enforcementMode: 'enforce',
  });
}

async function post(route: { POST: (r: NextRequest) => Promise<Response> }) {
  return route.POST(
    new NextRequest('https://synthex.example/api/video/generate', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'water damage drying',
        style: 'social-reel',
        duration: '15-60s',
      }),
    })
  );
}

const loadRoute = () =>
  require('@/app/api/video/generate/route') as {
    POST: (r: NextRequest) => Promise<Response>;
  };

beforeEach(() => {
  resetState();
  provider.calls = [];
  provider.fail = null;
  (globalThis as { __org?: string | null }).__org = ORG;
  (globalThis as { __hermesBrand?: string }).__hermesBrand = BRAND;
});

describe('POST /api/video/generate (script mode) through the Governor', () => {
  it('writes exactly one ledger row carrying the real model and token usage', async () => {
    seedGovernor();
    const res = await post(loadRoute());
    expect(res.status).toBe(200);
    expect(provider.calls).toHaveLength(1);
    expect(state().ledger).toEqual([
      expect.objectContaining({
        pipelineName: 'video-script',
        clientId: ORG,
        brandSlug: BRAND,
        model: 'claude-sonnet-5',
        inputTokens: 321,
        outputTokens: 654,
        outcome: 'completed',
      }),
    ]);
  });

  it('shadow mode: a would-be refusal (no runner flag) still serves 200 and is receipted', async () => {
    const res = await post(loadRoute());
    expect(res.status).toBe(200);
    expect(provider.calls).toHaveLength(1);
    expect(state().ledger).toHaveLength(1);
    expect(state().ledger[0].provenance).toEqual(
      expect.objectContaining({
        shadowRefusal: expect.objectContaining({
          outcome: 'refused_flag_missing',
        }),
      })
    );
  });

  it('a provider error keeps the route answer unchanged (500) and is receipted as failed', async () => {
    seedGovernor();
    provider.fail = new Error('upstream 529');
    const res = await post(loadRoute());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(
      'Failed to generate video script. Please check your API key configuration.'
    );
    expect(state().ledger.map(r => r.outcome)).toEqual([
      'failed_provider_error',
    ]);
  });

  it('enforcing mode: a refusal never reaches the provider and answers an honest coded 403', async () => {
    let route!: ReturnType<typeof loadRoute>;
    jest.isolateModules(() => {
      jest.doMock('@/lib/ai/governor/mode', () => ({
        GOVERNOR_MODE: 'enforcing',
      }));
      route = loadRoute();
    });
    const res = await post(route);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        success: false,
        code: 'governor_refused',
        outcome: 'refused_flag_missing',
      })
    );
    expect(provider.calls).toHaveLength(0);
  });

  it('(control: planted failure is caught) a ledger with no row fails the receipt assertion', () => {
    // The planted defect: the provider ran but nothing was receipted.
    provider.calls.push({ model: 'claude-sonnet-5' });
    expect(() =>
      expect(state().ledger).toHaveLength(provider.calls.length)
    ).toThrow();
  });
});
