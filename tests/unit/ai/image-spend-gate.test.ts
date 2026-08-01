/**
 * P1-G1 (SYN-1115) — the service-layer spend gate.
 *
 * The defect this locks down: `generateBatch` used to pass `count` straight
 * into `Array.from({length: count})` with no service-layer clamp and no cost
 * accounting whatsoever. The only wall was a Zod `.max(3)` on one HTTP route,
 * so any caller that did not transit that route — an MCP tool, a cron, a
 * script, the generation gateway itself — could fan out unbounded paid calls.
 *
 * The assertion that matters in every case below is the same: the provider is
 * invoked ZERO times. A gate that refuses after the first variant has already
 * been billed is not a gate.
 */
import { QuotaExceededError } from '@/lib/services/ai/video/types';

const holdQuota = jest.fn(async () => undefined);
const settleQuota = jest.fn(async () => undefined);
const releaseQuota = jest.fn(async () => undefined);

jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: (...a: unknown[]) => holdQuota(...(a as [])),
  settleQuota: (...a: unknown[]) => settleQuota(...(a as [])),
  releaseQuota: (...a: unknown[]) => releaseQuota(...(a as [])),
}));

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn(async () => undefined),
}));
const { trackPipelineCost } = jest.requireMock('@/lib/pipelines/track-cost');

import {
  generateBatch,
  generateVariations,
} from '@/lib/services/ai/image-generation';
import {
  MAX_IMAGE_VARIANTS,
  holdImageSpend,
} from '@/lib/services/ai/image/meter';
import {
  estimateImageCostUsd,
  UnpricedModelError,
  IMAGE_MODELS,
} from '@/lib/services/ai/image/registry';

const ctx = {
  organizationId: 'org-fresh',
  userId: 'u1',
  autonomyLevel: 'manual',
  traceId: 'trace-p1g1',
} as never;

/** Stands in for the provider. Any call at all is a gate failure. */
function providerSpy() {
  return jest.fn(async () => ({ success: true, provider: 'stability' }));
}

beforeEach(() => {
  holdQuota.mockClear();
  settleQuota.mockClear();
  releaseQuota.mockClear();
  trackPipelineCost.mockClear();
  holdQuota.mockImplementation(async () => undefined);
});

describe('P1-G1 — generateBatch(count: 100) reaches no provider', () => {
  it('refuses a 100-variant batch and invokes the provider ZERO times', async () => {
    const provider = providerSpy();

    await expect(
      generateBatch({ prompt: 'p' } as never, ctx, 100, provider as never)
    ).rejects.toThrow(/variants must be an integer 1-8/);

    expect(provider).toHaveBeenCalledTimes(0);
    // Refused before the quota was even consulted — nothing to release.
    expect(holdQuota).toHaveBeenCalledTimes(0);
    expect(settleQuota).toHaveBeenCalledTimes(0);
  });

  it('refuses at MAX_IMAGE_VARIANTS + 1, the exact boundary', async () => {
    const provider = providerSpy();
    await expect(
      generateBatch(
        { prompt: 'p' } as never,
        ctx,
        MAX_IMAGE_VARIANTS + 1,
        provider as never
      )
    ).rejects.toThrow(RangeError);
    expect(provider).toHaveBeenCalledTimes(0);
  });

  it('allows exactly MAX_IMAGE_VARIANTS — the clamp is off-by-one clean', async () => {
    const provider = providerSpy();
    const out = await generateBatch(
      { prompt: 'p' } as never,
      ctx,
      MAX_IMAGE_VARIANTS,
      provider as never
    );
    expect(out).toHaveLength(MAX_IMAGE_VARIANTS);
    expect(provider).toHaveBeenCalledTimes(MAX_IMAGE_VARIANTS);
  });
});

describe('P1-G1 — an over-budget org reaches no provider', () => {
  it('propagates QuotaExceededError with ZERO provider calls, even in range', async () => {
    holdQuota.mockImplementation(async () => {
      throw new QuotaExceededError('daily', 5, 4.99);
    });
    const provider = providerSpy();

    await expect(
      generateBatch({ prompt: 'p' } as never, ctx, 3, provider as never)
    ).rejects.toBeInstanceOf(QuotaExceededError);

    // THE assertion: the batch is held as one sum BEFORE the fan-out, so an
    // over-budget batch costs zero provider calls rather than 1-of-3.
    expect(provider).toHaveBeenCalledTimes(0);
    expect(trackPipelineCost).toHaveBeenCalledTimes(0);
  });

  it('holds the batch as ONE sum, not per variant', async () => {
    const provider = providerSpy();
    await generateBatch({ prompt: 'p' } as never, ctx, 4, provider as never);

    expect(holdQuota).toHaveBeenCalledTimes(1);
    const [orgId, heldUsd] = holdQuota.mock.calls[0] as unknown as [
      string,
      number,
    ];
    expect(orgId).toBe('org-fresh');
    // FLUX.2 pro at the 1024x1024 default = 1 MP = $0.03 each.
    expect(heldUsd).toBeCloseTo(0.12, 4);
  });

  it('generateVariations is gated identically', async () => {
    holdQuota.mockImplementation(async () => {
      throw new QuotaExceededError('monthly', 25, 25);
    });
    await expect(
      generateVariations({ prompt: 'p' } as never, ctx, 2)
    ).rejects.toBeInstanceOf(QuotaExceededError);
    expect(trackPipelineCost).toHaveBeenCalledTimes(0);
  });
});

describe('P1-G1 — an unpriced model reaches no provider', () => {
  it('blocks rather than costing an uncostable model at zero', async () => {
    // Reaching a deprecated model requires the audited escape hatch — the
    // grounded default path would resolve FLUX.2 pro and never see it.
    await expect(
      holdImageSpend(
        'org-fresh',
        'studio',
        { model: 'dall-e-3', useReferences: false },
        1
      )
    ).rejects.toBeInstanceOf(UnpricedModelError);
    // The refusal lands BEFORE the quota is touched: no hold to unwind.
    expect(holdQuota).toHaveBeenCalledTimes(0);
  });

  it('every deprecated registry entry is unpriced, so deprecation is enforced in code', () => {
    for (const model of IMAGE_MODELS.filter(m => m.deprecated)) {
      expect(() =>
        estimateImageCostUsd(model, { width: 1024, height: 1024 })
      ).toThrow(UnpricedModelError);
    }
  });

  it('every NON-deprecated entry IS priced — no silent free path', () => {
    for (const model of IMAGE_MODELS.filter(m => !m.deprecated)) {
      const usd = estimateImageCostUsd(model, { width: 1024, height: 1024 });
      expect(usd).toBeGreaterThan(0);
    }
  });
});

describe('pricing arithmetic reproduces the providers’ own worked examples', () => {
  const flux2Pro = IMAGE_MODELS.find(m => m.id === 'fal-ai/flux-2-pro')!;

  // fal.ai/models/fal-ai/flux-2-pro, verified 2026-08-01: "a 1024x1024 image
  // will cost $0.03, and a 1920x1080 image will cost $0.045".
  it('fal FLUX.2 pro: 1024x1024 = $0.03', () => {
    expect(estimateImageCostUsd(flux2Pro, { width: 1024, height: 1024 })).toBe(
      0.03
    );
  });
  it('fal FLUX.2 pro: 1920x1080 = $0.045', () => {
    expect(estimateImageCostUsd(flux2Pro, { width: 1920, height: 1080 })).toBe(
      0.045
    );
  });

  // ai.google.dev/gemini-api/docs/pricing, verified 2026-08-01.
  it('Gemini 3 Pro Image: 2K band = $0.134, 4K band = $0.24', () => {
    const g = IMAGE_MODELS.find(m => m.id === 'gemini-3-pro-image')!;
    expect(estimateImageCostUsd(g, { width: 2048, height: 2048 })).toBe(0.134);
    expect(estimateImageCostUsd(g, { width: 4096, height: 4096 })).toBe(0.24);
  });

  it('a request beyond every published band is UNPRICED, not extrapolated', () => {
    const g = IMAGE_MODELS.find(m => m.id === 'gemini-2.5-flash-image')!;
    expect(estimateImageCostUsd(g, { width: 1024, height: 1024 })).toBe(0.039);
    // Google publishes no band above 1024 for this model.
    expect(() =>
      estimateImageCostUsd(g, { width: 1792, height: 1024 })
    ).toThrow(UnpricedModelError);
  });
});
