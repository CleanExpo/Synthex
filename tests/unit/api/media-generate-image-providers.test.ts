/** @jest-environment node */
/**
 * Only usable image providers are advertised.
 *
 * lib/services/ai/image/registry.ts marks Stability (stable-diffusion-3) and
 * DALL-E 3 deprecated and unpriced, so the meter refuses any pin to them
 * (UnpricedModelError). GET /api/media/generate/image and the generator UI
 * still offered both, so choosing either always failed.
 *
 * SEAM: offeredImageProviders() against the real registry, the GET handler,
 * and the UI's providerOptions() builder.
 */

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
jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
  prisma: {},
}));

import { GET } from '@/app/api/media/generate/image/route';
import { createMockNextRequest } from '../../helpers/mock-request';
import { offeredImageProviders } from '@/lib/services/ai/image-generation';
import { IMAGE_MODELS } from '@/lib/services/ai/image/registry';
import { providerOptions } from '@/components/ai/image-generator';

const MODEL_FOR: Record<string, string> = {
  stability: 'stable-diffusion-3',
  dalle: 'dall-e-3',
  gemini: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image',
};

describe('offeredImageProviders', () => {
  it('excludes the deprecated, unpriced Stability and DALL-E providers', () => {
    const offered = offeredImageProviders();
    expect(offered).not.toContain('stability');
    expect(offered).not.toContain('dalle');
    expect(offered).toContain('gemini');
  });

  it('every offered provider maps to a non-deprecated, priced registry model', () => {
    for (const p of offeredImageProviders()) {
      const model = IMAGE_MODELS.find(m => m.id === MODEL_FOR[p]);
      expect(model).toBeDefined();
      expect(model!.deprecated).not.toBe(true);
      expect(model!.pricing).toBeDefined();
    }
  });
});

describe('GET /api/media/generate/image', () => {
  it('advertises only the offered providers', async () => {
    const res = await GET(
      createMockNextRequest({
        method: 'GET',
        url: 'https://synthex.example/api/media/generate/image',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.providers).toEqual(offeredImageProviders());
    expect(json.providers).not.toContain('stability');
    expect(json.providers).not.toContain('dalle');
  });
});

describe('image generator provider picker', () => {
  it('offers Auto plus only the providers the server advertises', () => {
    const labels = providerOptions(['gemini']).map(o => o.label);
    expect(labels).toEqual(['Auto', 'Gemini']);
  });

  it('offers only Auto before the server has answered', () => {
    expect(providerOptions([]).map(o => o.id)).toEqual(['auto']);
  });
});
