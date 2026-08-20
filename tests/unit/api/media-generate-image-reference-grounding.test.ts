/**
 * Unit test — SYN "Option B": the app image-generation route
 * (POST /api/media/generate/image) threads reference-grounding into
 * generateImage EXACTLY as the MCP generate_image tool does
 * (lib/services/ai/studio-tools/index.ts).
 *
 * The route's only job is to pass referenceSet/useReferences straight into
 * ImageGenerationOptions — it must NOT resolve URLs itself. generateImage owns
 * the site-relative → absolute URL resolution (via NEXT_PUBLIC_APP_URL) and the
 * opt-in gate; that resolution is proven at its own layer in
 * tests/unit/ai/image-generation-grounding.test.ts. Here we mock generateImage
 * and assert the OPTIONS it receives (the wiring), plus that the un-grounded
 * path is unchanged.
 */

/** @jest-environment node */

const mockGenerateImage = jest.fn();
jest.mock('@/lib/services/ai/image-generation', () => {
  const actual = jest.requireActual('@/lib/services/ai/image-generation');
  return {
    __esModule: true,
    ...actual,
    generateImage: (...a: unknown[]) => mockGenerateImage(...a),
  };
});

// Rate-limit wrapper → pass straight through to the handler.
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

// Professional-plan gate satisfied.
// Plain function (NOT jest.fn) — resetMocks: true would wipe a jest.fn's
// implementation between tests and return undefined, tripping the plan gate.
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: async () => ({ plan: 'professional' }),
  },
}));
jest.mock('@/lib/billing/plan-access', () => ({
  hasProfessionalAccess: () => true,
}));

const mockAudit = jest.fn();
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: (...a: unknown[]) => mockAudit(...a) },
}));

const mockInsert = jest.fn();
jest.mock('@/lib/platform/noop-client', () => ({
  createClient: () => ({
    from: () => ({
      insert: (...a: unknown[]) => {
        mockInsert(...a);
        return {
          select: () => ({ single: () => ({ data: null, error: null }) }),
        };
      },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
  // resetMocks: true (jest.worktree.cjs) wipes implementations each test —
  // reinstate a grounded default result (no imageBase64 → no library write).
  mockGenerateImage.mockResolvedValue({
    success: true,
    provider: 'gemini',
    imageUrl: 'https://out/grounded.png',
    grounded: true,
    referenceSet: 'carpet-cleaning',
    refCount: 2,
    metadata: { model: 'fal-ai/flux-2-pro' },
  });
});

describe('POST /api/media/generate/image — reference grounding wiring', () => {
  it('(a) threads referenceSet + useReferences into generateImage options, matching the MCP tool shape', async () => {
    const res = await post({
      prompt: 'our carpet cleaning wand on a hotel floor',
      referenceSet: 'carpet-cleaning',
      useReferences: true,
    });

    expect(res.status).toBe(200);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);

    const [options] = mockGenerateImage.mock.calls[0];
    // Same shape the MCP generate_image tool passes: referenceSet/useReferences
    // go THROUGH; generateImage resolves them to absolute URLs downstream.
    expect(options.referenceSet).toBe('carpet-cleaning');
    expect(options.useReferences).toBe(true);
    // The route must NOT pre-resolve — no imageUrls/reference URLs on options
    // (that would diverge from the MCP path; resolution is generateImage's job).
    expect(options).not.toHaveProperty('imageUrls');

    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('(a2) a referenceSet alone (no useReferences) is still threaded through (opt-in via set)', async () => {
    await post({
      prompt: 'our carpet cleaning wand',
      referenceSet: 'carpet-cleaning',
    });

    const [options] = mockGenerateImage.mock.calls[0];
    expect(options.referenceSet).toBe('carpet-cleaning');
    // .optional() with no default — undefined, exactly like the MCP tool.
    expect(options.useReferences).toBeUndefined();
  });

  it('(b) a plain POST (no grounding fields) calls generateImage with NO reference fields — unchanged behaviour', async () => {
    const res = await post({
      prompt: 'a bright product photo of a moisture meter',
    });

    expect(res.status).toBe(200);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);

    const [options] = mockGenerateImage.mock.calls[0];
    expect(options.referenceSet).toBeUndefined();
    expect(options.useReferences).toBeUndefined();
  });

  it('(c) an unknown referenceSet degrades gracefully — no crash, 200, generateImage handles the miss', async () => {
    // generateImage fails open to the text-only path on a grounding miss and
    // returns a normal (non-grounded) success — the route must not crash.
    mockGenerateImage.mockResolvedValueOnce({
      success: true,
      provider: 'gemini',
      imageBase64: undefined,
      imageUrl: 'https://out/text-only.png',
      grounded: false,
      metadata: { model: 'gemini-2.5-flash-image' },
    });

    const res = await post({
      prompt: 'a generic marketing image',
      referenceSet: 'no-such-set-exists',
      useReferences: true,
    });

    expect(res.status).toBe(200);
    const [options] = mockGenerateImage.mock.calls[0];
    // Route still threads the (unknown) set through — the resolver, not the
    // route, decides there is nothing owned to ground on.
    expect(options.referenceSet).toBe('no-such-set-exists');
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
