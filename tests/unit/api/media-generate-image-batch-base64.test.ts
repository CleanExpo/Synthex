/** @jest-environment node */
/**
 * Batch variants that come back base64-only (the Gemini escape hatch has no
 * hosted URL) must still be displayable.
 *
 * Before: the batch response dropped imageBase64 for every variant, so such a
 * variant was reported success with imageUrl null and nothing to show; the
 * route never returns a mediaAssetId either (media_assets is not
 * provisioned), so the UI had no source at all.
 * Now: imageBase64 is included ONLY for variants without an imageUrl, so
 * URL-backed variants stay slim.
 */

const mockGenerateBatch = jest.fn();
jest.mock('@/lib/services/ai/image-generation', () => {
  const actual = jest.requireActual('@/lib/services/ai/image-generation');
  return {
    __esModule: true,
    ...actual,
    generateBatch: (...a: unknown[]) => mockGenerateBatch(...a),
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
  let n = 0;
  const client = {
    imageGeneration: { create: async () => ({ id: `row-${++n}` }) },
    $transaction: (arr: unknown[]) => Promise.all(arr),
  };
  return { __esModule: true, default: client, prisma: client };
});

import { POST } from '@/app/api/media/generate/image/route';
import { createMockNextRequest } from '../../helpers/mock-request';

it('returns imageBase64 only for variants that have no imageUrl', async () => {
  mockGenerateBatch.mockResolvedValueOnce([
    {
      success: true,
      provider: 'gemini',
      imageUrl: 'https://cdn.example/a.png',
      imageBase64: 'SHOULD-NOT-BE-SENT',
    },
    { success: true, provider: 'gemini', imageBase64: 'iVBORw0KGgoB64' },
    { success: false, provider: 'gemini', error: 'provider down' },
  ]);

  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.example/api/media/generate/image',
      body: { prompt: 'a van', variants: 3, saveToLibrary: false },
    })
  );

  expect(res.status).toBe(200);
  const { images } = await res.json();
  expect(images[0].imageUrl).toBe('https://cdn.example/a.png');
  expect(images[0].imageBase64).toBeUndefined();
  expect(images[1].imageBase64).toBe('iVBORw0KGgoB64');
  expect(images[2].imageBase64).toBeUndefined();
});
