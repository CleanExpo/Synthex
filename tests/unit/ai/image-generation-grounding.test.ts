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

import { generateImage } from '@/lib/services/ai/image-generation';
import type { GenerationContext } from '@/lib/ai/generation-context';

jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  generateFluxImage: jest.fn(async (o: { imageUrls?: string[] }) => ({
    imageUrl: 'https://out/grounded.png',
    seed: 1,
    model: 'fal-ai/flux-2-pro',
    __refs: o.imageUrls,
  })),
}));

const ctx: GenerationContext = {
  organizationId: 'org1',
  userId: 'user1',
  traceId: 't1',
  autonomyLevel: 'manual',
};

describe('generateImage grounding', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
  beforeEach(() => {
    mockTrendFindMany.mockResolvedValue([]);
  });

  it('grounds on the carpet-cleaning set via FLUX and tags metadata', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    const r = await generateImage(
      { prompt: 'our carpet wand', referenceSet: 'carpet-cleaning' },
      ctx
    );
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.refCount).toBeGreaterThan(0);
    expect(r.metadata?.model).toBe('fal-ai/flux-2-pro');
    const arg = (generateFluxImage as jest.Mock).mock.calls[0][0];
    expect(arg.imageUrls[0]).toBe(
      'https://synthex.social/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });

  it('leaves the legacy path ungrounded when useReferences is false', async () => {
    const r = await generateImage(
      {
        prompt: 'our carpet wand',
        referenceSet: 'carpet-cleaning',
        useReferences: false,
        provider: 'gemini',
      },
      ctx
    ).catch(e => ({ success: false, grounded: false, error: String(e) }));
    expect((r as { grounded?: boolean }).grounded).not.toBe(true);
  });

  it('fails open to the legacy path when no owned references resolve (grounding miss)', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'a generic prompt with no owned refs',
        referenceSet: 'water-damage-restoration', // manifest entry has no owned subjects
        provider: 'gemini', // force the deterministic legacy path (no network call)
      },
      ctx
    );

    expect(r.grounded).not.toBe(true);
    expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
  });

  it('fails open to the legacy path when the fal/registry call throws (grounding error)', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockRejectedValueOnce(
      new Error('fal down')
    );

    const call = generateImage(
      {
        prompt: 'our carpet wand',
        referenceSet: 'carpet-cleaning',
        provider: 'gemini', // force the deterministic legacy path (no network call)
      },
      ctx
    );

    await expect(call).resolves.toBeDefined();
    const r = await call;
    expect(r.grounded).not.toBe(true);
  });
});
