/**
 * End-to-end wiring test — SYN "Option B". Proves the app image route drives
 * the SAME grounding chain the MCP generate_image tool does: route →
 * generateImage → reference-library resolver → absolute reference URLs → the
 * reference-capable (FLUX/fal) provider.
 *
 * Only the fal provider is mocked (no network, no paid API). generateImage and
 * the reference-library resolver run FOR REAL against the checked-in manifest,
 * so this asserts the site-relative → absolute URL resolution end-to-end:
 * `/reference-library/carpet-cleaning/...` → `${NEXT_PUBLIC_APP_URL}/reference-library/...`,
 * identical to what image-generation-grounding.test.ts proves at the unit layer.
 */

/** @jest-environment node */

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

jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  generateFluxImage: jest.fn(async (o: { imageUrls?: string[] }) => ({
    imageUrl: 'https://out/grounded.png',
    seed: 7,
    model: 'fal-ai/flux-2-pro',
    __refs: o.imageUrls,
  })),
}));

jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

// Plain function (NOT jest.fn) — resetMocks: true would otherwise wipe the
// implementation between tests and return undefined, tripping the plan gate.
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: async () => ({ plan: 'professional' }),
  },
}));
jest.mock('@/lib/billing/plan-access', () => ({
  hasProfessionalAccess: () => true,
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
import { createMockNextRequest } from '../../helpers/mock-request';

const post = (body: object) =>
  POST(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.example/api/media/generate/image',
      body,
    })
  );

describe('POST /api/media/generate/image — grounded end-to-end (real resolver, fal mocked)', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
    mockTrendFindMany.mockResolvedValue([]);
    // resetMocks: true wipes the factory default each test — reinstate it.
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockImplementation(
      async (o: { imageUrls?: string[] }) => ({
        imageUrl: 'https://out/grounded.png',
        seed: 7,
        model: 'fal-ai/flux-2-pro',
        __refs: o.imageUrls,
      })
    );
  });

  it('resolves the carpet-cleaning set to ABSOLUTE reference URLs and grounds via fal', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');

    const res = await post({
      prompt: 'our carpet cleaning wand on a hotel floor',
      referenceSet: 'carpet-cleaning',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // The reference-library's site-relative path was resolved to an absolute
    // URL against NEXT_PUBLIC_APP_URL — the exact base/origin the MCP tool's
    // grounding uses (generateImage owns this; the route only threads the set).
    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    const fluxArg = (generateFluxImage as jest.Mock).mock.calls[0][0];
    expect(fluxArg.imageUrls[0]).toBe(
      'https://synthex.social/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });
});
