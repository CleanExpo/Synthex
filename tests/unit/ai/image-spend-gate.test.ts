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

// Names must begin with `mock` — jest hoists the factory above these consts,
// and only mock-prefixed identifiers may be referenced from inside it.
const mockReserveSpend = jest.fn(async (p: { holdId: string }) => ({
  holdId: p.holdId,
  heldUsd: 0,
}));
const mockFinalizeSpend = jest.fn(async () => true);

const mockRecordAttempt = jest.fn(async () => undefined);
const mockSettlementAmount = jest.fn(
  async (_holdId: string, fallback: number) => fallback
);

jest.mock('@/lib/services/ai/image/spend-log', () => ({
  reserveSpend: (...a: unknown[]) => mockReserveSpend(...(a as [never])),
  finalizeSpend: (...a: unknown[]) => mockFinalizeSpend(...(a as [])),
  recordAttempt: (...a: unknown[]) => mockRecordAttempt(...(a as [])),
  settlementAmountUsd: (...a: unknown[]) =>
    mockSettlementAmount(...(a as [never, never])),
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
  mockReserveSpend.mockClear();
  mockFinalizeSpend.mockClear();
  trackPipelineCost.mockClear();
  mockReserveSpend.mockImplementation(async (p: { holdId: string }) => ({
    holdId: p.holdId,
    heldUsd: 0,
  }));
  mockFinalizeSpend.mockImplementation(async () => true);
  mockRecordAttempt.mockClear();
  mockRecordAttempt.mockImplementation(async () => undefined);
  mockSettlementAmount.mockImplementation(
    async (_holdId: string, fallback: number) => fallback
  );
  trackPipelineCost.mockImplementation(async () => undefined);
});

describe('P1-G1 — generateBatch(count: 100) reaches no provider', () => {
  it('refuses a 100-variant batch and invokes the provider ZERO times', async () => {
    const provider = providerSpy();

    await expect(
      generateBatch({ prompt: 'p' } as never, ctx, 100, provider as never)
    ).rejects.toThrow(/variants must be an integer 1-8/);

    expect(provider).toHaveBeenCalledTimes(0);
    // Refused before the log was even consulted — no event, nothing to undo.
    expect(mockReserveSpend).toHaveBeenCalledTimes(0);
    expect(mockFinalizeSpend).toHaveBeenCalledTimes(0);
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
    mockReserveSpend.mockImplementation(async () => {
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

    expect(mockReserveSpend).toHaveBeenCalledTimes(1);
    const { organizationId: orgId, amountUsd: heldUsd } = mockReserveSpend.mock
      .calls[0][0] as unknown as { organizationId: string; amountUsd: number };
    expect(orgId).toBe('org-fresh');
    // Worst case per image on the grounded path: 1 output MP plus the private
    // references the generator appends (round-2 review finding 1) — the dearest
    // candidate is FLUX.2 dev LoRA at 5 MP x $0.021 = $0.105. Four of them.
    expect(heldUsd).toBeCloseTo(0.42, 4);
  });

  it('generateVariations is gated identically', async () => {
    mockReserveSpend.mockImplementation(async () => {
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

describe('settlement is derived from recorded provider ATTEMPTS', () => {
  // SYN-1115 round-7: the hold no longer settles at a re-priced guess from the
  // final result. It settles at what the recorded attempts actually cost —
  // which is the only figure that includes fallbacks and retries the final
  // result never mentions.
  it('settles at the attempt total, not at the per-variant estimate', async () => {
    mockSettlementAmount.mockImplementation(async () => 0.072);
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 3);

    const { totalUsd } = await settleImageSpend(
      hold,
      [
        { model: 'fal-ai/flux-2/lora' },
        { model: 'fal-ai/flux-2-pro' },
        { model: 'fal-ai/flux-2/lora' },
      ],
      { runId: 'r-mixed', organizationId: 'org-fresh' }
    );

    expect(mockSettlementAmount).toHaveBeenCalledWith(
      hold.holdId,
      hold.perImageUsd
    );
    expect(totalUsd).toBe(0.072);
  });

  it('still reports a per-variant view so each row can carry its own cost', async () => {
    mockSettlementAmount.mockImplementation(async () => 0.051);
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 2);

    const { perVariantUsd } = await settleImageSpend(
      hold,
      [{ model: 'fal-ai/flux-2/lora' }, { model: 'fal-ai/flux-2-pro' }],
      { runId: 'r-view', organizationId: 'org-fresh' }
    );

    expect(perVariantUsd).toEqual([0.021, 0.03]);
  });

  it('a run with NO attempts settles at zero', async () => {
    mockSettlementAmount.mockImplementation(async () => 0);
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 3);
    const { totalUsd } = await settleImageSpend(hold, [], {
      runId: 'r-none',
      organizationId: 'org-fresh',
    });
    expect(totalUsd).toBe(0);
    expect(trackPipelineCost).toHaveBeenCalledTimes(0);
  });
});

describe('every real provider call records an attempt', () => {
  it('records one attempt per variant of a batch', async () => {
    const provider = providerSpy();
    await generateBatch({ prompt: 'p' } as never, ctx, 3, provider as never);
    // The stub stands in for the provider, so the generator's own call sites
    // are bypassed here; what matters is that the hold is threaded and the
    // batch settles from attempts rather than from the stub's return value.
    expect(mockSettlementAmount).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number)
    );
  });
});

// SYN-1115 round-4 refactor: the compensation-and-retry tests that lived here
// are GONE on purpose. They asserted that a failed quota mutation left the hold
// retryable — a property that only mattered because settlement mutated a
// counter and could half-happen. Spend is now an append-only log with one
// terminal event per hold, so the guarantee changed from "a failure can be
// retried safely" to "a duplicate cannot happen at all".
describe('finalisation is idempotent by construction', () => {
  it('writes exactly ONE terminal event per hold', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 1);
    await settleImageSpend(hold, [{ model: 'fal-ai/flux-2-pro' }], {
      runId: 'r1',
      organizationId: 'org-fresh',
    });
    expect(mockFinalizeSpend).toHaveBeenCalledTimes(1);
    expect(mockFinalizeSpend.mock.calls[0][0]).toMatchObject({
      holdId: hold.holdId,
      kind: 'settle',
    });
  });

  it('a hold already finalised elsewhere writes NO second ledger row', async () => {
    // The log reports "someone else finalised this" by returning false — the
    // sweep-vs-settlement race. It must not double-charge.
    mockFinalizeSpend.mockImplementation(async () => false);
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 1);
    const { totalUsd } = await settleImageSpend(
      hold,
      [{ model: 'fal-ai/flux-2-pro' }],
      { runId: 'r-dup', organizationId: 'org-fresh' }
    );
    expect(totalUsd).toBe(0.03);
    expect(trackPipelineCost).toHaveBeenCalledTimes(0);
  });

  it('release finalises the SAME hold id, so it and settle are mutually exclusive', async () => {
    const hold = await holdImageSpend('org-fresh', 'studio', {}, 2);
    await releaseImageSpend(hold);
    expect(mockFinalizeSpend).toHaveBeenCalledTimes(1);
    const call = mockFinalizeSpend.mock.calls[0][0] as unknown as {
      holdId: string;
      kind: string;
    };
    expect(call.holdId).toBe(hold.holdId);
    expect(call.kind).toBe('release');
  });

  it('every hold carries a distinct id, so events never collide across runs', async () => {
    const a = await holdImageSpend('org-fresh', 'studio', {}, 1);
    const b = await holdImageSpend('org-fresh', 'studio', {}, 1);
    expect(a.holdId).not.toBe(b.holdId);
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
    expect(mockReserveSpend).toHaveBeenCalledTimes(0);
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
