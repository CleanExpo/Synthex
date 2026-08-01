// SYN-1115: image generation now holds against the org's shared media budget
// before any provider call, so these behaviour suites stub the quota out. The
// quota's own behaviour stays covered by its dedicated suites.
jest.mock('@/lib/services/ai/video/quota', () =>
  jest.requireActual('../../support/mock-media-quota').mockMediaQuota()
);

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
  // Real Images Only: the grounded default path auto-resolves the industry
  // LoRA — default to none here so grounding tests exercise plain FLUX.
  resolveLoraForIndustry: jest.fn(() => null),
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

    const { resolveLora, resolveLoraForIndustry } =
      await import('@/lib/services/ai/image/trained-loras');
    (resolveLora as jest.Mock).mockImplementation((id: string) =>
      id === FIXTURE_LORA.id ? FIXTURE_LORA : null
    );
    (resolveLoraForIndustry as jest.Mock).mockReturnValue(null);
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

  it('GROUNDS a bare prompt by default — auto-detect, no opt-in needed (Real Images Only inversion)', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage({ prompt: 'a carpet cleaning wand' }, ctx);

    expect(generateFluxImage as jest.Mock).toHaveBeenCalled();
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.referenceSet).toBe('carpet-cleaning');
  });

  it('a pinned provider while grounding is on (the default) is a validation error, not a generation', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      { prompt: 'a carpet cleaning wand', provider: 'gemini' },
      ctx
    );

    expect(r.success).toBe(false);
    expect(r.grounded).toBe(false);
    expect(r.blocked).toBeUndefined();
    expect(r.error).toContain('useReferences: false');
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

  it('BLOCKS when no owned references resolve — no provider is ever called (Real Images Only)', async () => {
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
      },
      ctx
    );

    expect(r.success).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.grounded).toBe(false);
    expect(r.error).toBe(
      'No owned references for this subject — add real photos to the reference library first.'
    );
    expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
  });

  it('retries the grounded FLUX call once on failure and succeeds — never falls to a legacy provider', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockRejectedValueOnce(
      new Error('fal down')
    );

    const r = await generateImage(
      { prompt: 'our carpet wand', referenceSet: 'carpet-cleaning' },
      ctx
    );

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(2); // attempt + retry
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
  });

  it('fails CLOSED (blocked) when the grounded call fails after its single retry', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxImage as jest.Mock).mockRejectedValue(new Error('fal down'));

    const r = await generateImage(
      { prompt: 'our carpet wand', referenceSet: 'carpet-cleaning' },
      ctx
    );

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(2);
    expect(r.success).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.grounded).toBe(false);
    expect(r.error).toBe('Grounded generation failed after retry: fal down');
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
    // LoRA failures now fall back to the reference-grounded FLUX path.
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
    const { resolveLora, resolveLoraForIndustry } =
      await import('@/lib/services/ai/image/trained-loras');
    (resolveLora as jest.Mock).mockImplementation((id: string) =>
      id === FIXTURE_LORA.id ? FIXTURE_LORA : null
    );
    (resolveLoraForIndustry as jest.Mock).mockReturnValue(null);
  });

  it('routes a resolved loraId through the /lora adapter, composing with auto-detected references by default; loraApplied:true lands in the result AND metadata', async () => {
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
    // Grounded by default: the LoRA call composes with owned references.
    expect(r.grounded).toBe(true);

    const arg = (generateFluxLoraImage as jest.Mock).mock.calls[0][0];
    expect(arg.loras).toEqual([{ path: FIXTURE_LORA.loraUrl }]);
    expect(arg.imageUrls).toBeDefined();
    expect(arg.imageUrls.length).toBeGreaterThan(0);
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

  it('an unknown loraId falls back to the reference-grounded FLUX path (NOT legacy): loraApplied:false + loraRequested', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxLoraImage as jest.Mock).mockClear();
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'a carpet cleaning wand', // owned coverage — grounded fallback available
        loraId: 'nonexistent-lora',
      },
      ctx
    );

    expect(generateFluxLoraImage as jest.Mock).not.toHaveBeenCalled();
    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.loraApplied).toBe(false);
    expect(r.loraRequested).toBe('nonexistent-lora');
  });

  it('a retired/unresolvable loraId falls back the same way as an unknown one', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    (generateFluxLoraImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'a carpet cleaning wand',
        loraId: 'retired-lora-id',
      },
      ctx
    );

    expect(generateFluxLoraImage as jest.Mock).not.toHaveBeenCalled();
    expect(r.loraApplied).toBe(false);
    expect(r.loraRequested).toBe('retired-lora-id');
    expect(r.grounded).toBe(true); // grounded FLUX fallback, never legacy
  });

  it('a lora adapter throw falls back to the reference-grounded FLUX path with loraApplied:false', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    (generateFluxLoraImage as jest.Mock).mockRejectedValueOnce(
      new Error('fal lora down')
    );
    (generateFluxImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'ccwcarpet style carpet cleaning job',
        loraId: FIXTURE_LORA.id,
      },
      ctx
    );

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
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

  it('useReferences: false is a hard off-switch even with a referenceSet: adapter gets no imageUrls, pure /lora compose', async () => {
    const { generateFluxLoraImage } =
      await import('@/lib/services/ai/image/providers/flux-lora-fal');
    (generateFluxLoraImage as jest.Mock).mockClear();

    const r = await generateImage(
      {
        prompt: 'a wand ccwcarpet style',
        loraId: FIXTURE_LORA.id,
        referenceSet: 'carpet-cleaning',
        useReferences: false,
      },
      ctx
    );

    expect(generateFluxLoraImage as jest.Mock).toHaveBeenCalledTimes(1);
    const arg = (generateFluxLoraImage as jest.Mock).mock.calls[0][0];
    expect(arg.imageUrls).toBeUndefined();
    expect(arg.loras).toEqual([{ path: FIXTURE_LORA.loraUrl }]);

    expect(r.loraApplied).toBe(true);
    expect(r.grounded).toBe(false);
    // The escape hatch is loudly stamped (Real Images Only, Part A item 5).
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        'UNGROUNDED — generated without owned references (explicit override)',
      ])
    );
  });
});
