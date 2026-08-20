/**
 * Unit tests — Real Images Only (spec 2026-07-12 Part B) route mapping for
 * POST/PUT /api/media/generate/image.
 *
 * The service (lib/services/ai/image-generation.ts, Task 1) is
 * grounded-by-default and returns `blocked: true` when no owned references
 * cover the subject, or the grounded call fails closed after its retry. This
 * suite pins how the ROUTE maps that onto HTTP:
 *   - single generation: blocked → 422 { error, blocked: true } (not 500)
 *   - batch: blocked variants get lineage status:'blocked' (kept/rank stay
 *     null); ALL variants blocked → 422; a mixed batch stays 200 with a
 *     per-variant `blocked` flag
 *   - loraId passthrough (single + batch, via the shared `options` object)
 *   - PUT variations: referenceSet/useReferences/loraId threaded into
 *     generateVariations' options; blocked variation items carry `blocked`
 *
 * generateImage/generateBatch/generateVariations are mocked — the service's
 * own grounding/blocking contract is proven at its layer in
 * tests/unit/ai/real-images-gate.test.ts. This file only proves the route's
 * HTTP-status and lineage mapping of whatever the service returns.
 */

/** @jest-environment node */

const mockGenerateImage = jest.fn();
const mockGenerateBatch = jest.fn();
const mockGenerateVariations = jest.fn();
jest.mock('@/lib/services/ai/image-generation', () => {
  const actual = jest.requireActual('@/lib/services/ai/image-generation');
  return {
    __esModule: true,
    ...actual,
    generateImage: (...a: unknown[]) => mockGenerateImage(...a),
    generateBatch: (...a: unknown[]) => mockGenerateBatch(...a),
    generateVariations: (...a: unknown[]) => mockGenerateVariations(...a),
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
  entitledPlan: (plan: string) => plan,
}));

// Central entitlement gate (SYN-1106) — the PUT (variations) handler now gates
// via requireEntitlement. Grant Professional. Plain function so resetMocks
// keeps the implementation between tests.
jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({
    allowed: true,
    effectivePlan: 'professional',
    requiredPlan: 'professional',
    subscription: { plan: 'professional', status: 'active' },
  }),
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
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) =>
    mockGetEffectiveOrganizationId(...a),
}));

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/prisma', () => {
  const client = {
    imageGeneration: {
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    // The route's batch path calls prisma.$transaction(array-of-promises) —
    // the array-form transaction API, not the callback form.
    $transaction: (arr: unknown[]) => Promise.all(arr),
  };
  return { __esModule: true, default: client, prisma: client };
});

import { POST, PUT } from '@/app/api/media/generate/image/route';
import { createMockNextRequest } from '../../helpers/mock-request';
import { NO_REFERENCES_BLOCK_ERROR } from '@/lib/services/ai/image-generation';

const post = (body: object) =>
  POST(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.example/api/media/generate/image',
      body,
    })
  );

const put = (body: object) =>
  PUT(
    createMockNextRequest({
      method: 'PUT',
      url: 'https://synthex.example/api/media/generate/image',
      body,
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  // resetMocks: true (jest.worktree.cjs) wipes implementations each test —
  // reinstate a plain create that echoes back an id + the data it was given.
  mockCreate.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: `row-${Math.random().toString(36).slice(2)}`,
      ...args.data,
    })
  );
  mockUpdate.mockResolvedValue({});
});

describe('POST /api/media/generate/image — single blocked mapping (422, not 500)', () => {
  it('maps a blocked result to 422 { error, blocked: true }', async () => {
    mockGenerateImage.mockResolvedValueOnce({
      success: false,
      provider: 'stability',
      grounded: false,
      blocked: true,
      error: NO_REFERENCES_BLOCK_ERROR,
    });

    const res = await post({ prompt: 'a cartoon spaceship' });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe(NO_REFERENCES_BLOCK_ERROR);
    expect(json.blocked).toBe(true);
  });

  it('leaves a non-blocked failure on the existing 500 path', async () => {
    mockGenerateImage.mockResolvedValueOnce({
      success: false,
      provider: 'stability',
      error: 'fal outage',
    });

    const res = await post({ prompt: 'anything' });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.blocked).toBeUndefined();
  });

  it('threads loraId into generateImage options', async () => {
    mockGenerateImage.mockResolvedValueOnce({
      success: true,
      provider: 'stability',
      imageUrl: 'https://out/lora.png',
      grounded: true,
      loraApplied: true,
      loraId: 'carpet-style-v1',
      metadata: { model: 'fal-ai/flux-2-pro' },
    });

    const res = await post({
      prompt: 'our carpet cleaning wand',
      loraId: 'carpet-style-v1',
      saveToLibrary: false,
    });

    expect(res.status).toBe(200);
    const [options] = mockGenerateImage.mock.calls[0];
    expect(options.loraId).toBe('carpet-style-v1');
  });
});

describe('POST /api/media/generate/image — batch blocked mapping', () => {
  it('ALL variants blocked → 422 { error, blocked: true }, lineage rows status:"blocked" with null kept/rank', async () => {
    mockGenerateBatch.mockResolvedValueOnce([
      {
        success: false,
        provider: 'stability',
        grounded: false,
        blocked: true,
        error: NO_REFERENCES_BLOCK_ERROR,
      },
      {
        success: false,
        provider: 'stability',
        grounded: false,
        blocked: true,
        error: NO_REFERENCES_BLOCK_ERROR,
      },
    ]);

    const res = await post({ prompt: 'a cartoon spaceship', variants: 2 });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe(NO_REFERENCES_BLOCK_ERROR);
    expect(json.blocked).toBe(true);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    for (const call of mockCreate.mock.calls) {
      const data = call[0].data;
      expect(data.status).toBe('blocked');
      expect(data.kept).toBeUndefined();
      expect(data.rank).toBeUndefined();
    }
  });

  it('a mixed batch (one blocked, one success) stays 200 with per-variant blocked flags and stamped loraId/loraApplied', async () => {
    mockGenerateBatch.mockResolvedValueOnce([
      {
        success: false,
        provider: 'stability',
        grounded: false,
        blocked: true,
        error: NO_REFERENCES_BLOCK_ERROR,
      },
      {
        success: true,
        provider: 'stability',
        imageUrl: 'https://out/grounded.png',
        grounded: true,
        loraApplied: true,
        loraId: 'carpet-style-v1',
        metadata: { model: 'fal-ai/flux-2-pro' },
      },
    ]);

    const res = await post({
      prompt: 'our carpet cleaning wand',
      variants: 2,
      saveToLibrary: false,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.images).toHaveLength(2);
    expect(json.images[0].blocked).toBe(true);
    expect(json.images[0].success).toBe(false);
    expect(json.images[1].blocked).toBeUndefined();
    expect(json.images[1].success).toBe(true);

    // Lineage: blocked row gets status:'blocked' + no lora stamp; the
    // successful row is stamped from the result, not hardcoded.
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const [blockedCall, successCall] = mockCreate.mock.calls;
    expect(blockedCall[0].data.status).toBe('blocked');
    expect(blockedCall[0].data.loraId).toBeNull();
    expect(blockedCall[0].data.loraApplied).toBe(false);
    expect(successCall[0].data.status).toBe('completed');
    expect(successCall[0].data.loraId).toBe('carpet-style-v1');
    expect(successCall[0].data.loraApplied).toBe(true);
  });
});

describe('PUT /api/media/generate/image — variations schema fields + blocked passthrough', () => {
  it('threads referenceSet/useReferences/loraId into generateVariations options', async () => {
    mockGenerateVariations.mockResolvedValueOnce([
      {
        success: true,
        provider: 'stability',
        imageUrl: 'https://out/v0.png',
        grounded: true,
      },
    ]);

    const res = await put({
      prompt: 'our carpet cleaning wand',
      count: 1,
      referenceSet: 'carpet-cleaning',
      useReferences: true,
      loraId: 'carpet-style-v1',
      saveToLibrary: false,
    });

    expect(res.status).toBe(200);
    const [options] = mockGenerateVariations.mock.calls[0];
    expect(options.referenceSet).toBe('carpet-cleaning');
    expect(options.useReferences).toBe(true);
    expect(options.loraId).toBe('carpet-style-v1');
  });

  it('a blocked variation item carries blocked:true in the response', async () => {
    mockGenerateVariations.mockResolvedValueOnce([
      {
        success: false,
        provider: 'stability',
        grounded: false,
        blocked: true,
        error: NO_REFERENCES_BLOCK_ERROR,
      },
    ]);

    const res = await put({
      prompt: 'a cartoon spaceship',
      count: 1,
      saveToLibrary: false,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.variations[0].blocked).toBe(true);
    expect(json.variations[0].success).toBe(false);
  });
});
