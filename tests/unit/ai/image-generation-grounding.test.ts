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
  beforeEach(async () => {
    mockTrendFindMany.mockResolvedValue([]);
    // jest.worktree.cjs sets resetMocks: true, which wipes the factory-provided
    // default implementation after the first test consumes it. Reinstate it
    // before every test so later tests can still rely on a successful flux call.
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockImplementation(
      async (o: { imageUrls?: string[] }) => ({
        imageUrl: 'https://out/grounded.png',
        seed: 1,
        model: 'fal-ai/flux-2-pro',
        __refs: o.imageUrls,
      })
    );
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
    expect(r.referenceSubject).toBe('carpet-cleaning-wand');
    expect(r.referenceVendor).toBe('unite-group'); // Task 1 backfill
    const arg = (generateFluxImage as jest.Mock).mock.calls[0][0];
    expect(arg.imageUrls[0]).toBe(
      'https://synthex.social/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });

  it('does NOT ground when useReferences: false is passed alongside a referenceSet (hard override)', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'our carpet wand',
        referenceSet: 'carpet-cleaning',
        useReferences: false,
        provider: 'gemini',
      },
      ctx
    );

    expect(r.grounded).not.toBe(true);
    expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
  });

  it('does NOT ground a bare prompt with no referenceSet and no useReferences opt-in (opt-in gate)', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      { prompt: 'a carpet cleaning wand', provider: 'gemini' },
      ctx
    );

    expect(r.grounded).not.toBe(true);
    expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
  });

  it('grounds a bare cleaning prompt via auto-detect when useReferences: true opts in', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      { prompt: 'a carpet cleaning wand', useReferences: true },
      ctx
    );

    expect(generateFluxImage as jest.Mock).toHaveBeenCalled();
    expect(r.grounded).toBe(true);
  });

  it('fails open to the legacy path when no owned references resolve (grounding miss)', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'a generic prompt with no owned refs',
        // An unknown industry key is the guaranteed-empty miss case. (This test
        // previously used water-damage-restoration, which the CCW catalogue
        // ingestion legitimately populated with owned subjects.)
        referenceSet: 'no-such-industry',
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
