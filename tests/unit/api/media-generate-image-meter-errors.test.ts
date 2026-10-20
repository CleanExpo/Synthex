/** @jest-environment node */
/**
 * Meter refusals on POST/PUT /api/media/generate/image map to honest statuses.
 *
 * The spend meter (lib/services/ai/image/meter.ts, spend-log.ts, registry.ts)
 * throws three refusals before any provider call: QuotaExceededError (org
 * budget cap), UnpricedModelError (deprecated/unpriced model pin) and a
 * RangeError above MAX_IMAGE_VARIANTS. They propagate out of generateImage /
 * generateBatch / generateVariations. Before this fix every one fell into the
 * generic catch and answered 500 "Internal server error".
 *
 * SEAM: the route handlers, with the three service functions mocked to throw
 * the real error classes. The meter's own throw conditions are covered at its
 * layer; this file proves only the route's HTTP mapping.
 * NOTE: the route's own schemas cap variants at 3 (POST) and count at 8 (PUT),
 * so the RangeError is reachable here only by a thrown mock.
 */

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

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: async () => undefined },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org-1',
}));

jest.mock('@/lib/prisma', () => {
  const client = {
    imageGeneration: { create: async () => ({ id: 'row-1' }) },
    $transaction: (arr: unknown[]) => Promise.all(arr),
  };
  return { __esModule: true, default: client, prisma: client };
});

import { POST, PUT } from '@/app/api/media/generate/image/route';
import { createMockNextRequest } from '../../helpers/mock-request';
import { QuotaExceededError } from '@/lib/services/ai/video/types';
import { UnpricedModelError } from '@/lib/services/ai/image/registry';

const URL_ = 'https://synthex.example/api/media/generate/image';
const single = () =>
  POST(
    createMockNextRequest({
      method: 'POST',
      url: URL_,
      body: { prompt: 'a van' },
    })
  );
const batch = () =>
  POST(
    createMockNextRequest({
      method: 'POST',
      url: URL_,
      body: { prompt: 'a van', variants: 3 },
    })
  );
const variations = () =>
  PUT(
    createMockNextRequest({
      method: 'PUT',
      url: URL_,
      body: { prompt: 'a van', count: 2 },
    })
  );

const handlers: Array<[string, () => Promise<Response>, jest.Mock]> = [
  ['POST single', single, mockGenerateImage],
  ['POST batch', batch, mockGenerateBatch],
  ['PUT variations', variations, mockGenerateVariations],
];

describe.each(handlers)('%s — meter refusals', (_name, call, service) => {
  it('QuotaExceededError → 429 naming the cap, not 500', async () => {
    service.mockRejectedValueOnce(new QuotaExceededError('daily', 20, 19.5));
    const res = await call();
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.cap).toBe('daily');
    expect(json.error).toMatch(/daily/);
    expect(json.error).not.toMatch(/video/i);
  });

  it('UnpricedModelError → 422 blocked, not 500', async () => {
    service.mockRejectedValueOnce(
      new UnpricedModelError('dall-e-3', 'no pricing entry in the registry')
    );
    const res = await call();
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/dall-e-3/);
  });

  it('meter variant RangeError → 422, not 500', async () => {
    service.mockRejectedValueOnce(
      new RangeError('image variants must be an integer 1-8 (received 9)')
    );
    const res = await call();
    expect(res.status).toBe(422);
  });

  it('an unrelated RangeError stays on the 500 path', async () => {
    service.mockRejectedValueOnce(new RangeError('Invalid array length'));
    const res = await call();
    expect(res.status).toBe(500);
  });
});
