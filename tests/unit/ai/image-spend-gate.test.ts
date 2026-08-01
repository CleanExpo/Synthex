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
  settleImageSpend,
  releaseImageSpend,
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
  settleQuota.mockImplementation(async () => undefined);
  releaseQuota.mockImplementation(async () => undefined);
  trackPipelineCost.mockImplementation(async () => undefined);
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
    // Worst case per image on the grounded path: 1 output MP plus the private
    // references the generator appends (round-2 review finding 1) — the dearest
    // candidate is FLUX.2 dev LoRA at 5 MP x $0.021 = $0.105. Four of them.
    expect(heldUsd).toBeCloseTo(0.42, 4);
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
  it('ignores a stale model hint and prices the chain that actually runs', async () => {
    // `model` is not how a legacy provider is selected — `provider` is. An
    // ungrounded request naming a deprecated model but pinning no provider
    // still walks the non-deprecated chain, so it must be priced at Gemini,
    // not at the named model and not at FLUX.
    const hold = await holdImageSpend(
      'org-fresh',
      'studio',
      { model: 'dall-e-3', useReferences: false },
      1
    );
    expect(hold.perImageUsd).toBe(0.134);
    // (The fail-closed case for an actual pin is covered below.)
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

describe('settlement re-prices per variant against the models that ACTUALLY ran', () => {
  it('settles a LoRA run at the LoRA price, not the estimated pro price', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 1);
    expect(hold.perImageUsd).toBe(0.03); // FLUX.2 pro estimate, no refs

    const { totalUsd, perVariantUsd } = await settleImageSpend(
      hold,
      [{ model: 'fal-ai/flux-2/lora' }],
      { runId: 'r1', organizationId: 'org-fresh' }
    );

    expect(totalUsd).toBe(0.021);
    expect(perVariantUsd).toEqual([0.021]);
    expect(trackPipelineCost.mock.calls[0][0]).toMatchObject({
      cost_usd: 0.021,
      client_id: 'org-fresh',
    });
  });

  // Review finding 5: a mixed batch must not be priced as if every successful
  // variant ran the first one's model.
  it('prices a MIXED batch per variant, not as N copies of the first model', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 3);
    const { totalUsd, perVariantUsd } = await settleImageSpend(
      hold,
      [
        { model: 'fal-ai/flux-2/lora' }, // 0.021
        { model: 'fal-ai/flux-2-pro' }, // 0.030
        { model: 'fal-ai/flux-2/lora' }, // 0.021
      ],
      { runId: 'r-mixed', organizationId: 'org-fresh' }
    );

    expect(perVariantUsd).toEqual([0.021, 0.03, 0.021]);
    expect(totalUsd).toBe(0.072); // NOT 3 x 0.021 and NOT 3 x 0.03
  });

  it('falls back to the held estimate when the model that ran is unknown', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 1);
    const { totalUsd } = await settleImageSpend(hold, [{ model: 'unknown' }], {
      runId: 'r2',
      organizationId: 'org-fresh',
    });
    expect(totalUsd).toBe(0.03);
  });

  it('settles a fully failed batch at zero and writes no ledger row', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 3);
    const { totalUsd } = await settleImageSpend(hold, [], {
      runId: 'r3',
      organizationId: 'org-fresh',
    });
    expect(totalUsd).toBe(0);
    expect(trackPipelineCost).toHaveBeenCalledTimes(0);
  });
});

// Review finding 3: `settled` used to flip BEFORE the quota mutation, so a
// transient database error left the estimate charged with every retry a silent
// no-op — an eight-image batch could consume the whole daily headroom with no
// recorded spend and no way back.
describe('settlement is safely retryable after a transient failure', () => {
  it('leaves the hold UNSETTLED when settleQuota rejects, then settles on retry', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 1);
    settleQuota.mockRejectedValueOnce(new Error('deadlock detected'));

    await expect(
      settleImageSpend(hold, [{ model: 'fal-ai/flux-2-pro' }], {
        runId: 'r-transient',
        organizationId: 'org-fresh',
      })
    ).rejects.toThrow('deadlock detected');

    // THE assertion: not consumed. A retry must still be able to settle.
    expect(hold.settled).toBe(false);

    const { totalUsd } = await settleImageSpend(
      hold,
      [{ model: 'fal-ai/flux-2-pro' }],
      { runId: 'r-transient', organizationId: 'org-fresh' }
    );
    expect(totalUsd).toBe(0.03);
    expect(hold.settled).toBe(true);
    expect(settleQuota).toHaveBeenCalledTimes(2);
  });

  it('leaves the hold UNSETTLED when releaseQuota rejects, then releases on retry', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 2);
    releaseQuota.mockRejectedValueOnce(new Error('connection reset'));

    await expect(releaseImageSpend(hold)).rejects.toThrow('connection reset');
    expect(hold.settled).toBe(false);

    await releaseImageSpend(hold);
    expect(hold.settled).toBe(true);
    expect(releaseQuota).toHaveBeenCalledTimes(2);
  });

  it('a ledger failure does NOT re-open an already-settled hold', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 1);
    trackPipelineCost.mockRejectedValueOnce(new Error('ledger down'));

    const { totalUsd } = await settleImageSpend(
      hold,
      [{ model: 'fal-ai/flux-2-pro' }],
      { runId: 'r-ledger', organizationId: 'org-fresh' }
    );

    // The quota is the money-safety record; the ledger is the audit record.
    expect(totalUsd).toBe(0.03);
    expect(hold.settled).toBe(true);
  });
});

// Review finding 1: the estimate ignored options.provider entirely.
describe('the hold prices the model that can actually run', () => {
  it('fails CLOSED on a pin to a deprecated, unpriced provider', async () => {
    for (const provider of ['dalle', 'stability']) {
      await expect(
        holdImageSpend(
          'org-fresh',
          'studio',
          { useReferences: false, provider },
          1
        )
      ).rejects.toBeInstanceOf(UnpricedModelError);
    }
    expect(holdQuota).toHaveBeenCalledTimes(0);
  });

  it('prices the ungrounded default chain at Gemini, not at FLUX', async () => {
    // The chain filters deprecated providers, leaving Gemini 3 Pro Image at
    // $0.134 — the old code held FLUX.2 pro at $0.03, a 4x under-reserve.
    const hold = await holdImageSpend(
      'org-fresh',
      'studio',
      { useReferences: false },
      1
    );
    expect(hold.perImageUsd).toBe(0.134);
  });

  it('prices a grounded run at the DEAREST candidate, never the cheapest', async () => {
    // Whether the industry LoRA resolves is unknown at estimate time, so the
    // hold must cover the dearer of the two FLUX candidates.
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 1);
    expect(hold.perImageUsd).toBe(0.03); // pro (0.03) > dev LoRA (0.021)
  });
});

// Review finding 2: reference images are INPUT megapixels on fal's
// per-megapixel models and were invisible to the ceiling on the main path.
describe('grounded estimates include reference input megapixels', () => {
  it('charges reference images as input megapixels', async () => {
    const withoutRefs = await holdImageSpend('org-fresh', 'studio', {}, 1);
    const withRefs = await holdImageSpend(
      'org-fresh',
      'studio',
      { referenceImageCount: 4 },
      1
    );
    // Worst-case selection re-ranks once references are priced in:
    //   FLUX.2 pro     = 0.03 + 4 x 0.015 = 0.090
    //   FLUX.2 dev LoRA = 5 MP x 0.021    = 0.105  <- dearer, so it wins
    // The hold must cover the dearer candidate, not the one that happened to
    // be dearest with zero references.
    expect(withoutRefs.perImageUsd).toBe(0.03);
    expect(withRefs.perImageUsd).toBe(0.105);
    expect(withRefs.perImageUsd).toBeGreaterThan(withoutRefs.perImageUsd);
  });

  it('does NOT charge references on band-priced models (Gemini is per-image)', async () => {
    const hold = await holdImageSpend(
      'org-fresh',
      'studio',
      { useReferences: false, referenceImageCount: 4 },
      1
    );
    expect(hold.perImageUsd).toBe(0.134); // unchanged by reference count
  });
});
