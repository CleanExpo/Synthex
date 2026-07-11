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

jest.mock('@/lib/services/ai/image/providers/flux-lora-fal', () => ({
  generateFluxLoraImage: jest.fn(async (o: { imageUrls?: string[] }) => ({
    imageUrl: 'https://out/lora.png',
    seed: 7,
    model: 'fal-ai/flux-2/lora',
    __refs: o.imageUrls,
  })),
}));

jest.mock('@/lib/services/ai/image/trained-loras', () => ({
  resolveLora: jest.fn(),
}));

const FIXTURE_LORA = {
  id: 'carpet-style-v1',
  kind: 'style' as const,
  industry: 'carpet-cleaning',
  triggerToken: 'ccwcarpet',
  loraUrl: 'https://private-fal.example.com/loras/carpet-style-v1.safetensors',
  configUrl: 'https://private-fal.example.com/loras/carpet-style-v1.json',
  trainedAt: '2026-07-01',
  steps: 1000,
  learningRate: 0.00005,
  costUsd: 25.5,
  imageCount: 163,
  falRequestId: 'req-abc',
  status: 'active' as const,
  sourceImages: [],
};

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

    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    (generateFluxLoraImage as jest.Mock).mockImplementation(
      async (o: { imageUrls?: string[] }) => ({
        imageUrl: 'https://out/lora.png',
        seed: 7,
        model: 'fal-ai/flux-2/lora',
        __refs: o.imageUrls,
      })
    );

    const { resolveLora } =
      await import('@/lib/services/ai/image/trained-loras');
    (resolveLora as jest.Mock).mockImplementation((id: string) =>
      id === FIXTURE_LORA.id ? FIXTURE_LORA : null
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

describe('generateImage lora (SYN carpet-style-lora, Task 3)', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
  beforeEach(async () => {
    mockTrendFindMany.mockResolvedValue([]);
    // resetMocks: true wipes factory implementations after first use — reinstate
    // (mirrors the reinstatement pattern in the grounding describe above).
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    (generateFluxLoraImage as jest.Mock).mockImplementation(
      async (o: { imageUrls?: string[] }) => ({
        imageUrl: 'https://out/lora.png',
        seed: 7,
        model: 'fal-ai/flux-2/lora',
        __refs: o.imageUrls,
      })
    );
    const { resolveLora } =
      await import('@/lib/services/ai/image/trained-loras');
    (resolveLora as jest.Mock).mockImplementation((id: string) =>
      id === FIXTURE_LORA.id ? FIXTURE_LORA : null
    );
  });

  it('routes a resolved loraId through the /lora adapter; loraApplied:true lands in the result AND metadata', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    const r = await generateImage(
      {
        prompt: 'a professional carpet cleaning setup, ccwcarpet style',
        loraId: FIXTURE_LORA.id,
      },
      ctx
    );

    expect(r.success).toBe(true);
    expect(r.loraApplied).toBe(true);
    expect(r.loraId).toBe(FIXTURE_LORA.id);
    expect(r.triggerToken).toBe(FIXTURE_LORA.triggerToken);
    expect(r.metadata?.loraApplied).toBe(true);
    expect(r.metadata?.loraId).toBe(FIXTURE_LORA.id);
    expect(r.metadata?.model).toBe('fal-ai/flux-2/lora');
    expect(r.warnings).toBeUndefined();

    const arg = (generateFluxLoraImage as jest.Mock).mock.calls[0][0];
    expect(arg.loras).toEqual([{ path: FIXTURE_LORA.loraUrl }]);
    expect(arg.imageUrls).toBeUndefined();
  });

  it('composes loraId + referenceSet: adapter receives BOTH imageUrls and loras; result carries BOTH lineages', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    const r = await generateImage(
      {
        prompt: 'our carpet wand, ccwcarpet style',
        loraId: FIXTURE_LORA.id,
        referenceSet: 'carpet-cleaning',
      },
      ctx
    );

    expect(r.success).toBe(true);
    expect(r.loraApplied).toBe(true);
    expect(r.loraId).toBe(FIXTURE_LORA.id);
    expect(r.grounded).toBe(true);
    expect(r.refCount).toBeGreaterThan(0);

    const arg = (generateFluxLoraImage as jest.Mock).mock.calls[0][0];
    expect(arg.loras).toEqual([{ path: FIXTURE_LORA.loraUrl }]);
    expect(arg.imageUrls[0]).toBe(
      'https://synthex.social/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });

  it('fails open on an unknown loraId: loraApplied:false + loraRequested, generation proceeds ungrounded-legacy', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    (generateFluxLoraImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'a generic prompt',
        loraId: 'nonexistent-lora',
        provider: 'gemini', // force the deterministic legacy path (no network call)
      },
      ctx
    );

    expect(generateFluxLoraImage as jest.Mock).not.toHaveBeenCalled();
    expect(r.loraApplied).toBe(false);
    expect(r.loraRequested).toBe('nonexistent-lora');
    expect(r.grounded).not.toBe(true);
  });

  it('fails open on a retired/unresolvable loraId the same way as an unknown one', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    (generateFluxLoraImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'a generic prompt',
        loraId: 'retired-lora-id',
        provider: 'gemini',
      },
      ctx
    );

    expect(generateFluxLoraImage as jest.Mock).not.toHaveBeenCalled();
    expect(r.loraApplied).toBe(false);
    expect(r.loraRequested).toBe('retired-lora-id');
  });

  it('fails open when the lora adapter throws: falls through to legacy generation with loraApplied:false', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    (generateFluxLoraImage as jest.Mock).mockRejectedValueOnce(
      new Error('fal lora down')
    );

    const r = await generateImage(
      {
        prompt: 'ccwcarpet style carpet job',
        loraId: FIXTURE_LORA.id,
        provider: 'gemini', // force the deterministic legacy path (no network call)
      },
      ctx
    );

    expect(r.loraApplied).toBe(false);
    expect(r.loraRequested).toBe(FIXTURE_LORA.id);
  });

  it('adds a warnings entry when the prompt is missing the lora trigger token', async () => {
    const r = await generateImage(
      {
        prompt: 'a carpet cleaning job with no trigger token',
        loraId: FIXTURE_LORA.id,
      },
      ctx
    );

    expect(r.loraApplied).toBe(true);
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(FIXTURE_LORA.triggerToken),
      ])
    );
  });

  it('omits warnings when the prompt includes the lora trigger token', async () => {
    const r = await generateImage(
      {
        prompt: `a carpet cleaning job, ${FIXTURE_LORA.triggerToken} style`,
        loraId: FIXTURE_LORA.id,
      },
      ctx
    );

    expect(r.loraApplied).toBe(true);
    expect(r.warnings).toBeUndefined();
  });
});
