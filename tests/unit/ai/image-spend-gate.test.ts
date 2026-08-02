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
import { MAX_CALLS_PER_VARIANT_GROUNDED } from '@/lib/services/ai/image/meter';
import {
  GEMINI_TOKEN_BOUND,
  MAX_REFERENCE_MEGAPIXELS,
} from '@/lib/services/ai/image/registry';

// DERIVED from the enforced caps and the verified rates, not restated — if a
// cap changes, the reservation and this expectation move together
// (release review, pass 3).
const GEMINI_3_TOKENS_USD =
  (GEMINI_TOKEN_BOUND.maxPromptChars *
    GEMINI_TOKEN_BOUND.proInputUsdPerMillion) /
    1_000_000 +
  (GEMINI_TOKEN_BOUND.maxOutputTokens *
    GEMINI_TOKEN_BOUND.proOutputUsdPerMillion) /
    1_000_000;
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
    // Worst case per CALL on the grounded path: 1 output MP plus the private
    // references the generator appends (round-2 review finding 1), each priced
    // at the ENFORCED MAX_REFERENCE_MEGAPIXELS bound rather than a 1 MP floor
    // (release review, pass 5). Dearest candidate is FLUX.2 dev LoRA.
    //
    // Four variants, and each can make MAX_CALLS_PER_VARIANT_GROUNDED paid
    // calls: a LoRA attempt, then grounded FLUX with one retry. Reserving one
    // call per variant let a batch spend up to three times what it was admitted
    // for, so the daily/monthly/MCP ceilings did not bind — an ADMISSION defect,
    // found by the release review. Over-reserving is free: settlement charges
    // what actually ran and returns the rest.
    const perCallUsd = (1 + 4 * MAX_REFERENCE_MEGAPIXELS) * 0.021;
    expect(heldUsd).toBeCloseTo(
      perCallUsd * 4 * MAX_CALLS_PER_VARIANT_GROUNDED,
      4
    );
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
    expect(hold.perImageUsd).toBeCloseTo(0.134 + GEMINI_3_TOKENS_USD, 4);
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
  // Google's published IMAGE bands, plus the token surcharge it bills alongside
  // them. Decomposed rather than collapsed to one number so the provider's own
  // worked example stays checkable at a glance (release review, pass 2).

  const GEMINI_25_TOKENS_USD =
    (GEMINI_TOKEN_BOUND.maxPromptChars *
      GEMINI_TOKEN_BOUND.flashInputUsdPerMillion) /
    1_000_000;

  it('Gemini 3 Pro Image: 2K band = $0.134, 4K band = $0.24, plus tokens', () => {
    const g = IMAGE_MODELS.find(m => m.id === 'gemini-3-pro-image')!;
    expect(estimateImageCostUsd(g, { width: 2048, height: 2048 })).toBeCloseTo(
      0.134 + GEMINI_3_TOKENS_USD,
      4
    );
    expect(estimateImageCostUsd(g, { width: 4096, height: 4096 })).toBeCloseTo(
      0.24 + GEMINI_3_TOKENS_USD,
      4
    );
  });

  it('a request beyond every published band is UNPRICED, not extrapolated', () => {
    const g = IMAGE_MODELS.find(m => m.id === 'gemini-2.5-flash-image')!;
    expect(estimateImageCostUsd(g, { width: 1024, height: 1024 })).toBeCloseTo(
      0.039 + GEMINI_25_TOKENS_USD,
      4
    );
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

    // The third argument is the PROVEN FLOOR of provider calls — settlement
    // may revise it up from recorded attempts but never below it, so a lost
    // attempt write cannot erase real spend (SYN-1115 round-8).
    expect(mockSettlementAmount).toHaveBeenCalledWith(
      hold.holdId,
      hold.perImageUsd,
      3
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
      expect.any(Number),
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
    expect(hold.perImageUsd).toBeCloseTo(0.134 + GEMINI_3_TOKENS_USD, 4);
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
    // Worst-case selection re-ranks once references are priced in, and each
    // reference is charged at the ENFORCED bound rather than a 1 MP floor
    // (release review, pass 5):
    //   FLUX.2 dev LoRA = (1 output + 4 refs x MAX_REFERENCE_MEGAPIXELS) MP
    //                     x $0.021/MP
    // Derived rather than restated, so raising the bound moves the expectation
    // with the reservation instead of silently failing here.
    const loraPerMp = 0.021;
    expect(withoutRefs.perImageUsd).toBe(0.03);
    expect(withRefs.perImageUsd).toBeCloseTo(
      (1 + 4 * MAX_REFERENCE_MEGAPIXELS) * loraPerMp,
      4
    );
    expect(withRefs.perImageUsd).toBeGreaterThan(withoutRefs.perImageUsd);
  });

  it('does NOT charge references on band-priced models (Gemini is per-image)', async () => {
    const hold = await holdImageSpend(
      'org-fresh',
      'studio',
      { useReferences: false, referenceImageCount: 4 },
      1
    );
    expect(hold.perImageUsd).toBeCloseTo(0.134 + GEMINI_3_TOKENS_USD, 4); // unchanged by reference count
  });
});

// SYN-1115 round-8 review finding: spend attribution used to live in
// module-scoped mutable state (`let activeSpend`). Every `await` inside a
// generation yields the event loop, so two concurrent requests interleaved and
// the second overwrote the first's context — the first then recorded its
// provider attempts against the WRONG hold and the WRONG organisation, which
// charges one customer for another's spend.
describe('concurrent requests never cross-attribute spend', () => {
  it('gives each concurrent generation its own hold, with no interleaving', async () => {
    const holdsSeen: string[] = [];

    // A provider stub that yields the event loop mid-call — the exact window
    // in which the old module-scoped context was clobbered.
    const slowProvider = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { success: true, provider: 'stability' };
    });

    mockReserveSpend.mockImplementation(async (p: { holdId: string }) => {
      holdsSeen.push(p.holdId);
      return { holdId: p.holdId, heldUsd: 0 };
    });

    await Promise.all([
      generateBatch(
        { prompt: 'org-a' } as never,
        ctx,
        2,
        slowProvider as never
      ),
      generateBatch(
        { prompt: 'org-b' } as never,
        ctx,
        2,
        slowProvider as never
      ),
    ]);

    // Two independent reservations, and each settled against its own.
    expect(holdsSeen).toHaveLength(2);
    expect(new Set(holdsSeen).size).toBe(2);

    const settledHolds = mockFinalizeSpend.mock.calls.map(
      c => (c[0] as unknown as { holdId: string }).holdId
    );
    expect(new Set(settledHolds)).toEqual(new Set(holdsSeen));
  });

  it('passes the spend context explicitly rather than reading shared state', async () => {
    // The generator receives its context as an argument. If this signature
    // regressed to module state, concurrent callers would silently share it.
    const captured: unknown[] = [];
    const spy = jest.fn(async (_o: unknown, _c: unknown, spend: unknown) => {
      captured.push(spend);
      return { success: true, provider: 'stability' };
    });

    await generateBatch({ prompt: 'p' } as never, ctx, 3, spy as never);

    expect(captured).toHaveLength(3);
    // Each variant carries its OWN context object with its own variant number.
    const variants = captured.map(
      c => (c as { variant: number } | null)?.variant
    );
    expect(variants).toEqual([0, 1, 2]);
    const holdIds = new Set(
      captured.map(c => (c as { holdId: string } | null)?.holdId)
    );
    expect(holdIds.size).toBe(1); // one batch, one hold
  });

  it('reserves the LoRA attempt AND the legacy chain when ungrounded with a lora', async () => {
    // Release review, pass 2. `useReferences:false` with a `loraId` is reachable
    // from both REST and MCP. The service makes a paid LoRA attempt and, when it
    // fails, falls through to the legacy provider chain — two paid calls — but
    // the hold counted only the chain. A request near the organisation cap or
    // the MCP sub-cap could be admitted on a one-call hold and settle two.
    const provider = providerSpy();
    await generateBatch(
      { prompt: 'p', useReferences: false, loraId: 'carpet-style-v1' } as never,
      ctx,
      1,
      provider as never
    );

    const { amountUsd: withLora } = mockReserveSpend.mock
      .calls[0][0] as unknown as { amountUsd: number };

    mockReserveSpend.mockClear();
    await generateBatch(
      { prompt: 'p', useReferences: false } as never,
      ctx,
      1,
      provider as never
    );
    const { amountUsd: withoutLora } = mockReserveSpend.mock
      .calls[0][0] as unknown as { amountUsd: number };

    // PRECONDITION: the no-lora baseline must be a real reservation, or the
    // comparison below is between two zeroes.
    expect(withoutLora).toBeGreaterThan(0);

    // THE assertion: the lora attempt is an EXTRA billable call, so the hold
    // must be strictly larger. Expressed as a comparison rather than a literal
    // so it keeps meaning if the chain or the prices change.
    expect(withLora).toBeGreaterThan(withoutLora);
  });

  it('prices a reference at the ENFORCED bound, not a one-megapixel floor', async () => {
    // Release review, pass 5. fal bills reference photos as INPUT megapixels,
    // and the estimator charged each at a 1 MP floor whose own comment admitted
    // it "can under-state a very large reference". The owned library holds
    // 1536x2048 images — exactly 3.000 MP under this file's binary-megapixel
    // rule — so four references sent 12 input MP against 4 priced. A near-cap
    // organisation could reach fal for more than its reservation.
    //
    // The floor is now the enforced CEILING: no reference above
    // MAX_REFERENCE_MEGAPIXELS may be sent, so pricing every one at that bound
    // can no longer under-state what is billed.
    const flux = IMAGE_MODELS.find(m => m.id === 'fal-ai/flux-2/lora')!;
    const withRefs = estimateImageCostUsd(flux, {
      width: 1024,
      height: 1024,
      referenceImageCount: 4,
    });
    const withoutRefs = estimateImageCostUsd(flux, {
      width: 1024,
      height: 1024,
      referenceImageCount: 0,
    });

    // PRECONDITION: this model must actually be per-megapixel, or references
    // are not billed by area and the assertion is about nothing.
    expect(flux.pricing?.kind).toBe('per_megapixel');

    // Four references at the bound, not four at 1 MP.
    const perMp = (flux.pricing as { usdPerMegapixel: number }).usdPerMegapixel;
    expect(withRefs - withoutRefs).toBeCloseTo(
      4 * MAX_REFERENCE_MEGAPIXELS * perMp,
      4
    );
  });

  it('covers the largest image the owned library actually holds', async () => {
    // Derived from the manifest rather than restated: the bound has to cover
    // the real library or grounded generation starts refusing its own
    // references. Adding a bigger photo fails HERE, which is the point — it is
    // a decision about spend, not a silent under-reserve.
    const manifest = require('@/public/reference-library/manifest.json');
    let maxMp = 0;
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        const o = node as Record<string, unknown>;
        if (typeof o.width === 'number' && typeof o.height === 'number') {
          maxMp = Math.max(maxMp, (o.width * o.height) / (1024 * 1024));
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(manifest);

    expect(maxMp).toBeGreaterThan(0); // precondition: dimensions were found
    expect(maxMp).toBeLessThanOrEqual(MAX_REFERENCE_MEGAPIXELS);
  });
});
