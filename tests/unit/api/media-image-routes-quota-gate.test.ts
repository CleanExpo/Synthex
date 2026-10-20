/** @jest-environment node */
/**
 * Media-only spending routes are gated by the fail-closed MEDIA quota, not the
 * text Governor (P5, spec M10). /api/demo/image and /api/media/generate/image
 * make no paid text call; their only spend is the image provider.
 *
 * SEAM: each route's POST handler, called with a NextRequest. Faked only at the
 * boundaries: auth, entitlement, rate limiters, the database (the J9 in-memory
 * Prisma, so the image meter and spend log run for real) and the network
 * (global fetch, counted as the image provider).
 * CATCHES: a provider request sent before the quota hold exists, and a quota
 * read error that lets a provider request through.
 * MISSES: Postgres row-lock semantics (proven in
 * tests/integration/media-spend-log.integration.test.ts) and provider pricing.
 */
jest.mock('@/lib/prisma', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').prismaModule()
);
jest.mock('@/lib/logger', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').loggerModule()
);
jest.mock('@/lib/redis-client', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').redisModule()
);
jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/rate-limit', () => ({
  aiGeneration: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: async () => undefined },
}));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'user-1' } }),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org-media-1',
}));

import { NextRequest } from 'next/server';
import { SYSTEM_ORGANIZATION_ID } from '@/lib/ai/generation-context';
import { resetState, state } from '../../eval/jev/families/j9/fake-db';
import { POST as demoPost } from '@/app/api/demo/image/route';
import { POST as imagePost } from '@/app/api/media/generate/image/route';

const ORG = 'org-media-1';

/** Every provider request, with the org's reserved holds at the moment it was sent. */
let providerRequests: Array<{ url: string; holdsAtSend: number }> = [];
let holdsFor = '';
const realFetch = global.fetch;

function reserves(org: string): number {
  return state().events.filter(
    e => e.organizationId === org && e.kind === 'reserve'
  ).length;
}

beforeAll(() => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  process.env.STABILITY_API_KEY = 'test-placeholder';
  process.env.GEMINI_API_KEY = 'test-placeholder';
  global.fetch = (async (input: unknown) => {
    providerRequests.push({
      url: String(input),
      holdsAtSend: reserves(holdsFor),
    });
    return new Response(JSON.stringify({ error: 'provider stub' }), {
      status: 503,
    });
  }) as typeof fetch;
});
afterAll(() => {
  global.fetch = realFetch;
});

beforeEach(() => {
  resetState();
  providerRequests = [];
});

const req = (url: string, body: object) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });

const routes = [
  {
    name: '/api/demo/image',
    org: SYSTEM_ORGANIZATION_ID,
    call: () =>
      demoPost(
        req('https://synthex.example/api/demo/image', {
          businessName: 'Coastal Cafe',
        })
      ),
  },
  {
    name: '/api/media/generate/image',
    org: ORG,
    call: () =>
      imagePost(
        req('https://synthex.example/api/media/generate/image', {
          prompt: 'a dehumidifier in a flooded hallway',
          useReferences: false,
          provider: 'gemini',
        })
      ),
  },
];

describe.each(routes)(
  '$name — media spend is held by the media quota',
  route => {
    beforeEach(() => {
      holdsFor = route.org;
      state().quotas.set(route.org, {
        monthlyBudgetUsd: 75,
        dailyBudgetUsd: 15,
      });
    });

    it('reserves against the org media quota before the first provider request', async () => {
      await route.call();
      expect(providerRequests.length).toBeGreaterThan(0);
      expect(providerRequests[0].holdsAtSend).toBe(1);
    });

    it('a quota read error refuses with zero provider requests', async () => {
      state().failures.add('$queryRaw');
      state().failures.add('$transaction');
      await route.call();
      expect(providerRequests).toHaveLength(0);
    });
  }
);

it('(control: planted failure is caught) a provider request sent before any hold fails the ordering check', async () => {
  holdsFor = ORG;
  await fetch('https://api.openai.com/v1/images/generations'); // planted: no reserve first
  expect(() => expect(providerRequests[0].holdsAtSend).toBe(1)).toThrow();
});
