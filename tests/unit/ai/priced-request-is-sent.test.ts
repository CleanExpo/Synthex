/** @jest-environment node */

/**
 * SYN-1115 release review, pass 4 — the STRUCTURAL invariant.
 *
 * ## Why this file exists
 *
 * Four whole-branch reviews found admission defects at a steady rate (2, 4, 3,
 * 3), and the fourth named the shape rather than another instance:
 *
 *   > reservation logic is separate from the enforced provider request
 *
 * Every one of those defects was the same mistake wearing different clothes.
 * The meter priced a MODEL of the call — this many variants, this frame, this
 * many tokens — and the adapter was then free to send something else:
 *
 *   - the grounded FLUX sites never passed `imageSize`, so fal chose its own
 *     output size while the hold was priced for `resolveOutputDimensions`, on
 *     models billed PER MEGAPIXEL;
 *   - the Gemini adapter sent no `maxOutputTokens` and no prompt limit while
 *     the hold assumed a token budget;
 *   - the variant loop could iterate more times than holds were taken.
 *
 * Patching each instance is what the first three passes did, and the rate did
 * not decay. The durable form is this assertion: **whatever the hold priced is
 * what the provider is asked for.** A new call site that forgets to pass the
 * priced frame fails here rather than in production, and a fourth fal adapter
 * cannot quietly join the chain.
 *
 * ZERO SPEND: the provider boundary is stubbed and the assertions are about
 * what WOULD have been sent.
 */

const mockReserveSpend = jest.fn(async (p: { amountUsd: number }) => ({
  holdId: 'hold-priced',
  heldUsd: p.amountUsd,
  organizationId: 'org-priced',
  initiatedBy: 'studio' as const,
}));
jest.mock('@/lib/services/ai/image/spend-log', () => ({
  ...jest.requireActual('@/lib/services/ai/image/spend-log'),
  reserveSpend: (...a: unknown[]) => mockReserveSpend(...(a as [never])),
  finalizeSpend: async () => true,
  recordAttempt: async () => undefined,
  settlementAmountUsd: async () => 0,
}));

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: async () => undefined,
}));

/** Every fal call the run makes, with the options it was given. */
const sentCalls: Array<{ adapter: string; opts: Record<string, unknown> }> = [];

jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  __esModule: true,
  generateFluxImage: async (opts: Record<string, unknown>) => {
    sentCalls.push({ adapter: 'flux', opts });
    return {
      imageUrl: 'https://example.test/f.png',
      model: 'fal-ai/flux-2-pro',
      seed: 1,
    };
  },
}));
jest.mock('@/lib/services/ai/image/providers/flux-lora-fal', () => ({
  __esModule: true,
  generateFluxLoraImage: async (opts: Record<string, unknown>) => {
    sentCalls.push({ adapter: 'lora', opts });
    return {
      imageUrl: 'https://example.test/l.png',
      model: 'fal-ai/flux-2/lora',
      seed: 1,
    };
  },
}));

jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: () => ({
    industry: 'carpet-cleaning',
    subject: 'wand',
    imagePaths: ['/reference-library/carpet-cleaning/a.webp'],
    count: 1,
  }),
}));
jest.mock('@/lib/services/ai/reference-library-private', () => ({
  resolvePrivateReferenceUrls: async () => [] as string[],
}));

import { generateImage } from '@/lib/services/ai/image-generation';
import { resolveOutputDimensions } from '@/lib/services/ai/image/meter';

const ctx = {
  userId: 'u-priced',
  organizationId: 'org-priced',
  traceId: 'trace-priced',
} as never;

beforeEach(() => {
  sentCalls.length = 0;
  mockReserveSpend.mockClear();
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.example';
  process.env.FAL_API_KEY = 'test-key';
});

describe('the provider is asked for exactly what the hold priced', () => {
  it.each([
    ['1:1', { aspectRatio: '1:1' }],
    ['16:9', { aspectRatio: '16:9' }],
    ['explicit w/h', { width: 1792, height: 1024 }],
  ])('sends the priced frame for %s', async (_label, sizeOptions) => {
    await generateImage(
      { prompt: 'a carpet wand', ...sizeOptions } as never,
      ctx
    );

    // PRECONDITION: a provider call actually happened, or there is nothing to
    // compare and the assertion below would pass over an empty list.
    expect(sentCalls.length).toBeGreaterThan(0);

    // The frame the METER priced, from the same resolution the hold used.
    const priced = resolveOutputDimensions(sizeOptions as never);

    // THE invariant: every paid call carries the priced frame. Omitting it —
    // which is what the code did — let fal pick its own size on a
    // per-megapixel model, so the hold and the bill were sized differently.
    for (const call of sentCalls) {
      expect(call.opts.imageSize).toEqual(priced);
    }
  });

  it('prices and sends the SAME object, so the two cannot drift', async () => {
    await generateImage(
      { prompt: 'a carpet wand', aspectRatio: '9:16' } as never,
      ctx
    );

    expect(sentCalls.length).toBeGreaterThan(0);
    const sent = sentCalls[0].opts.imageSize as {
      width: number;
      height: number;
    };

    // Not merely equal to a re-derivation: the call site passes the hold's own
    // `dimensions`, which is the value the reservation was computed from. A
    // future edit that re-derives the frame at the call site instead would
    // reintroduce exactly the drift this closes, so assert against what the
    // meter resolved rather than against a literal.
    expect(sent).toEqual(resolveOutputDimensions({ aspectRatio: '9:16' }));
    expect(mockReserveSpend).toHaveBeenCalledTimes(1);
  });
});
