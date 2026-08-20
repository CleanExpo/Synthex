/** @jest-environment node */
/**
 * The attribution gate must fail through the route's OWN error handling.
 *
 * `getEffectiveOrganizationId` rethrows on a database failure
 * (`lib/multi-business/business-scope.ts`: catch → `throw new Error('Failed to
 * determine organization context')`). Both handlers called it ABOVE their
 * `try`, so that error escaped the structured handling entirely and the caller
 * received a raw framework error instead of an
 * `APISecurityChecker.createSecureResponse` body.
 *
 * No money is at risk here — the gate still refuses — but a route that answers
 * a transient database blip with an unshaped 500 is indistinguishable, to its
 * caller, from one that has genuinely broken. Reported by CodeRabbit on PR #820.
 */
const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: (...a: unknown[]) => mockGetEffectiveOrg(...a),
}));

jest.mock('@/lib/services/ai/image/spend-log', () => ({
  __esModule: true,
  ...jest.requireActual('../../support/mock-media-quota').mockSpendLog(),
}));

jest.mock('@/lib/pipelines/track-cost', () => ({
  __esModule: true,
  trackPipelineCost: async () => undefined,
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({
    allowed: true,
    effectivePlan: 'professional',
    requiredPlan: 'professional',
    subscription: { plan: 'professional', status: 'active' },
  }),
}));

const mockTrendFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    trendInsight: { findMany: (...a: unknown[]) => mockTrendFindMany(...a) },
  },
  prisma: {
    trendInsight: { findMany: (...a: unknown[]) => mockTrendFindMany(...a) },
  },
}));

const mockFlux = jest.fn();
jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  generateFluxImage: (...a: unknown[]) => mockFlux(...a),
}));

jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'u1' } }),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: async () => ({ plan: 'professional' }),
  },
}));
jest.mock('@/lib/billing/plan-access', () => ({
  hasProfessionalAccess: () => true,
  entitledPlan: (plan: string) => plan,
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn() },
}));

jest.mock('@/lib/platform/noop-client', () => ({
  createClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({ single: () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/media/generate/image/route';
import { NextRequest } from 'next/server';

function imageRequest(body: object): NextRequest {
  return new NextRequest('https://synthex.example/api/media/generate/image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTrendFindMany.mockResolvedValue([]);
});

describe('the image attribution gate answers in the route contract', () => {
  it('refuses with a structured 403 when no organisation resolves', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);

    const res = await POST(imageRequest({ prompt: 'a carpet wand' }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('No organisation resolved'),
    });
    expect(mockFlux).not.toHaveBeenCalled();
  });

  it('answers a RESOLVER FAILURE in the same contract, not a raw throw', async () => {
    // THE regression. The resolver rethrows on a database failure; called
    // above the try, that escaped as an unhandled rejection.
    mockGetEffectiveOrg.mockRejectedValue(
      new Error('Failed to determine organization context')
    );

    const res = await POST(imageRequest({ prompt: 'a carpet wand' }));

    // A JSON body with a status, produced by the route — not a thrown error.
    expect(res.status).toBeGreaterThanOrEqual(400);
    await expect(res.json()).resolves.toEqual(expect.any(Object));
    expect(mockFlux).not.toHaveBeenCalled();
  });

  it('does not reach a provider on either refusal path', async () => {
    // Both failure modes must cost nothing. Asserted together so a future
    // change that made one of them fall through is caught here.
    mockGetEffectiveOrg.mockResolvedValue(null);
    await POST(imageRequest({ prompt: 'a carpet wand' }));
    mockGetEffectiveOrg.mockRejectedValue(new Error('db down'));
    await POST(imageRequest({ prompt: 'a carpet wand' }));
    expect(mockFlux).not.toHaveBeenCalled();
  });
});
