// SYN-1115: image generation reserves against the append-only spend log before
// any provider call, so these behaviour suites stub the log out. The log's own
// idempotency and ceiling semantics are proven against a real database in
// tests/integration/media-spend-log.integration.test.ts.
jest.mock('@/lib/services/ai/image/spend-log', () =>
  jest.requireActual('../../support/mock-media-quota').mockSpendLog()
);

/**
 * Real Images Only — core service inversion contract
 * (docs/superpowers/specs/2026-07-12-real-images-only-design.md, Part A).
 *
 * Pins every numbered Part A item against generateImage/generateWithLora:
 *  1. shared shouldGround gate (default ON, useReferences:false only escape)
 *  2. auto-detect always runs on the default path
 *  3. BLOCK on no coverage (blocked:true + exact founder copy)
 *  4. BLOCK on grounding failure after exactly one retry (fail-closed)
 *  5. escape hatch stamps grounded:false + exact UNGROUNDED warning
 *  6. deprecated providers skipped under the escape hatch; explicit pin
 *     bypasses the skip; a pin WITHOUT the escape hatch is a validation error
 *  7. industry LoRA auto-applied; explicit loraId wins; no active LoRA ⇒
 *     plain grounded FLUX (not a block)
 *  8. LoRA failure falls back to grounded FLUX, never the legacy chain
 *  9. generateVariations/generateBatch inherit everything via generateImage
 */

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

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: jest.fn(),
}));

jest.mock('@/lib/services/ai/reference-library-private', () => ({
  resolvePrivateReferenceUrls: jest.fn(async () => []),
}));

jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  generateFluxImage: jest.fn(),
}));

jest.mock('@/lib/services/ai/image/providers/flux-lora-fal', () => ({
  generateFluxLoraImage: jest.fn(),
}));

jest.mock('@/lib/services/ai/image/trained-loras', () => ({
  resolveLora: jest.fn(),
  resolveLoraForIndustry: jest.fn(),
}));

import { MAX_REFERENCE_MEGAPIXELS } from '@/lib/services/ai/image/registry';
import {
  generateImage,
  generateVariations,
  generateBatch,
  shouldGround,
  NO_REFERENCES_BLOCK_ERROR,
  UNGROUNDED_WARNING,
} from '@/lib/services/ai/image-generation';
import type { GenerationContext } from '@/lib/ai/generation-context';
import { resolveReferences } from '@/lib/services/ai/reference-library';
import { resolvePrivateReferenceUrls } from '@/lib/services/ai/reference-library-private';
import { generateFluxImage } from '@/lib/services/ai/image/providers/flux-fal';
import { generateFluxLoraImage } from '@/lib/services/ai/image/providers/flux-lora-fal';
import {
  resolveLora,
  resolveLoraForIndustry,
} from '@/lib/services/ai/image/trained-loras';

// Exact founder-mandated copy — pinned as literals so a constant edit that
// drifts from the spec fails this suite.
const BLOCK_COPY =
  'No owned references for this subject — add real photos to the reference library first.';
const UNGROUNDED_COPY =
  'UNGROUNDED — generated without owned references (explicit override)';

const CARPET_REFS = {
  industry: 'carpet-cleaning',
  subject: 'carpet-cleaning-wand',
  imagePaths: [
    '/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp',
  ],
  count: 1,
  vendorKey: 'unite-group',
};

const EMPTY_REFS = {
  industry: null,
  subject: null,
  imagePaths: [],
  count: 0,
};

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

// URL-aware legacy-provider fetch stub: returns the success payload shape each
// adapter expects, so escape-hatch tests are deterministic and offline.
function legacyFetchImpl(url: unknown): Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}> {
  // Hostname-parsed routing (not substring) so CodeQL's
  // incomplete-url-substring-sanitization rule is satisfied even in test code.
  const host = new URL(String(url)).hostname;
  let payload: unknown = {};
  if (host.endsWith('stability.ai')) {
    payload = { artifacts: [{ base64: 'stability-b64', seed: 5 }] };
  } else if (host === 'api.openai.com') {
    payload = { data: [{ b64_json: 'dalle-b64' }] };
  } else if (host === 'generativelanguage.googleapis.com') {
    payload = {
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: 'g-b64' } }],
          },
        },
      ],
    };
  }
  return Promise.resolve({ ok: true, json: async () => payload });
}

const mockFetch = jest.fn(legacyFetchImpl);
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  process.env.STABILITY_API_KEY = 'test-stability';
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.GEMINI_API_KEY = 'test-gemini';
  (global as { fetch: unknown }).fetch = mockFetch;
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
  (global as { fetch: unknown }).fetch = ORIGINAL_FETCH;
});

beforeEach(() => {
  // jest.worktree.cjs sets resetMocks: true — reinstate implementations.
  mockTrendFindMany.mockResolvedValue([]);
  mockFetch.mockImplementation(legacyFetchImpl);
  (resolveReferences as jest.Mock).mockReturnValue(CARPET_REFS);
  (resolvePrivateReferenceUrls as jest.Mock).mockResolvedValue([]);
  (generateFluxImage as jest.Mock).mockImplementation(
    async (o: { imageUrls?: string[] }) => ({
      imageUrl: 'https://out/grounded.png',
      seed: 1,
      model: 'fal-ai/flux-2-pro',
      __refs: o.imageUrls,
    })
  );
  (generateFluxLoraImage as jest.Mock).mockImplementation(
    async (o: { imageUrls?: string[] }) => ({
      imageUrl: 'https://out/lora.png',
      seed: 7,
      model: 'fal-ai/flux-2/lora',
      __refs: o.imageUrls,
    })
  );
  (resolveLora as jest.Mock).mockImplementation((id: string) =>
    id === FIXTURE_LORA.id ? FIXTURE_LORA : null
  );
  (resolveLoraForIndustry as jest.Mock).mockReturnValue(null);
});

describe('shouldGround — the single shared gate (Part A item 1)', () => {
  it('defaults ON when useReferences is omitted', () => {
    expect(shouldGround({})).toBe(true);
  });

  it('stays ON for explicit useReferences: true', () => {
    expect(shouldGround({ useReferences: true })).toBe(true);
  });

  it('is OFF only for the explicit escape hatch useReferences: false', () => {
    expect(shouldGround({ useReferences: false })).toBe(false);
  });
});

describe('auto-detect + grounded default (Part A item 2)', () => {
  it('a bare prompt (no flags at all) resolves references and grounds via FLUX', async () => {
    const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

    expect(resolveReferences as jest.Mock).toHaveBeenCalledWith({
      set: undefined,
      prompt: 'our carpet wand',
    });
    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.referenceSet).toBe('carpet-cleaning');
    expect(r.refCount).toBeGreaterThan(0);
    expect(r.metadata?.model).toBe('fal-ai/flux-2-pro');
    expect(mockFetch).not.toHaveBeenCalled(); // no legacy provider ever touched
  });
});

describe('BLOCK on no coverage (Part A item 3)', () => {
  it('refuses generation with blocked:true and the exact founder copy; no provider is called', async () => {
    (resolveReferences as jest.Mock).mockReturnValue(EMPTY_REFS);

    const r = await generateImage({ prompt: 'a cartoon spaceship' }, ctx);

    // SYN-1115: the spend meter stamps estimated/actual onto every result,
    // refusals included — the hold happened and was released. Asserted
    // explicitly rather than loosened to a partial matcher, so the block
    // contract stays exact.
    // Worst-case grounded estimate now includes the private references the
    // generator appends: 1 output MP + 4 private references, each priced at the
    // ENFORCED MAX_REFERENCE_MEGAPIXELS bound rather than a 1 MP floor
    // (round-2 review finding 1; bound added by release review pass 5, where a
    // 1 MP floor was found to under-price the library's real 3 MP photos).
    // Derived, so raising the bound moves this with the reservation.
    // The hold happened and was released.
    expect(r.estimatedCostUsd).toBeCloseTo(
      (1 + 4 * MAX_REFERENCE_MEGAPIXELS) * 0.021,
      4
    );
    expect(r.actualCostUsd).toBe(0); // blocked ⇒ nothing spent
    const { estimatedCostUsd: _e, actualCostUsd: _a, ...rest } = r;

    expect(rest).toEqual({
      success: false,
      provider: 'stability',
      grounded: false,
      blocked: true,
      error: BLOCK_COPY,
    });
    expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
    expect(generateFluxLoraImage as jest.Mock).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('exports the block copy verbatim (constant cannot drift from the spec)', () => {
    expect(NO_REFERENCES_BLOCK_ERROR).toBe(BLOCK_COPY);
  });
});

describe('BLOCK on grounding failure after exactly one retry (Part A item 4)', () => {
  it('retries the grounded call once, then fails closed naming the real cause', async () => {
    (generateFluxImage as jest.Mock).mockRejectedValue(new Error('fal outage'));

    const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(2); // 1 attempt + 1 retry
    expect(r.success).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.grounded).toBe(false);
    expect(r.error).toBe('Grounded generation failed after retry: fal outage');
    expect(mockFetch).not.toHaveBeenCalled(); // legacy chain unreachable while grounding is on
  });

  it('succeeds when the single retry succeeds', async () => {
    (generateFluxImage as jest.Mock).mockRejectedValueOnce(
      new Error('transient')
    );

    const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(2);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.blocked).toBeUndefined();
  });

  it('zero resolvable reference URLs (refs exist, URLs do not) also fails closed, never legacy', async () => {
    const prevBase = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL; // no public URLs; private mock returns []
    try {
      const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

      expect(r.success).toBe(false);
      expect(r.blocked).toBe(true);
      expect(r.error).toContain('Grounded generation failed after retry:');
      expect(r.error).toContain('no resolvable reference URLs');
      expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prevBase;
    }
  });
});

describe('escape hatch stamping (Part A item 5)', () => {
  it('useReferences: false skips grounding entirely and stamps grounded:false + the exact UNGROUNDED warning', async () => {
    const r = await generateImage(
      { prompt: 'a concept sketch', useReferences: false },
      ctx
    );

    expect(resolveReferences as jest.Mock).not.toHaveBeenCalled();
    expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(false);
    expect(r.warnings).toEqual([UNGROUNDED_COPY]);
  });

  it('stamps failed escape-hatch results too', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const r = await generateImage(
      { prompt: 'a concept sketch', useReferences: false },
      ctx
    );

    expect(r.success).toBe(false);
    expect(r.grounded).toBe(false);
    expect(r.warnings).toEqual([UNGROUNDED_COPY]);
    expect(r.error).toBe('All image generation providers failed');
  });

  it('exports the UNGROUNDED warning verbatim (constant cannot drift from the spec)', () => {
    expect(UNGROUNDED_WARNING).toBe(UNGROUNDED_COPY);
  });
});

describe('deprecated-provider enforcement + provider pins (Part A item 6)', () => {
  it('the default escape-hatch chain skips registry-deprecated providers (stability SD3, dalle)', async () => {
    const r = await generateImage(
      { prompt: 'a concept sketch', useReferences: false },
      ctx
    );

    expect(r.success).toBe(true);
    const hosts = mockFetch.mock.calls.map(c => new URL(String(c[0])).hostname);
    expect(hosts).toHaveLength(1);
    expect(hosts[0]).toBe('generativelanguage.googleapis.com'); // gemini only
    expect(hosts.some(h => h.endsWith('stability.ai'))).toBe(false);
    expect(hosts.some(h => h === 'api.openai.com')).toBe(false);
  });

  // SYN-1115 (founder ruling, 2026-08-01): "Pins to unpriced or deprecated
  // providers fail closed." This previously asserted that the escape hatch
  // could still REACH a deprecated provider. It can no longer: a deprecated
  // model carries no verified price, and an uncostable call cannot be held
  // against the organisation's budget, so it is refused before any request is
  // made. The deprecation flag is now enforced by the money path rather than
  // being advisory.
  it('an explicit pin to a DEPRECATED provider now fails closed, reaching nothing', async () => {
    await expect(
      generateImage(
        { prompt: 'a concept sketch', useReferences: false, provider: 'dalle' },
        ctx
      )
    ).rejects.toThrow(/cannot be costed/);

    // THE assertion: no provider was contacted.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('a pinned provider WITHOUT the escape hatch is a validation error (not a block, nothing generated)', async () => {
    const r = await generateImage(
      { prompt: 'our carpet wand', provider: 'gemini' },
      ctx
    );

    expect(r.success).toBe(false);
    expect(r.blocked).toBeUndefined();
    expect(r.grounded).toBe(false);
    expect(r.provider).toBe('gemini');
    expect(r.error).toContain('useReferences: false');
    expect(resolveReferences as jest.Mock).not.toHaveBeenCalled();
    expect(generateFluxImage as jest.Mock).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('a pin with explicit useReferences: true is equally a validation error', async () => {
    const r = await generateImage(
      { prompt: 'our carpet wand', provider: 'stability', useReferences: true },
      ctx
    );

    expect(r.success).toBe(false);
    expect(r.error).toContain('useReferences: false');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('industry LoRA auto-apply (Part A item 7)', () => {
  it('auto-applies the industry LoRA on the grounded default path when no loraId is passed', async () => {
    (resolveLoraForIndustry as jest.Mock).mockReturnValue(FIXTURE_LORA);

    const r = await generateImage(
      { prompt: 'our carpet wand, ccwcarpet style' },
      ctx
    );

    expect(resolveLoraForIndustry as jest.Mock).toHaveBeenCalledWith(
      'carpet-cleaning'
    );
    expect(generateFluxLoraImage as jest.Mock).toHaveBeenCalledTimes(1);
    const arg = (generateFluxLoraImage as jest.Mock).mock.calls[0][0];
    expect(arg.loras).toEqual([{ path: FIXTURE_LORA.loraUrl }]);
    expect(arg.imageUrls).toBeDefined(); // composed with owned references
    expect(r.success).toBe(true);
    expect(r.loraApplied).toBe(true);
    expect(r.loraId).toBe(FIXTURE_LORA.id);
    expect(r.grounded).toBe(true);
  });

  it('an explicit loraId always beats the industry auto-lookup', async () => {
    (resolveLoraForIndustry as jest.Mock).mockReturnValue({
      ...FIXTURE_LORA,
      id: 'other-auto-lora',
      loraUrl: 'https://example.com/other.safetensors',
    });

    const r = await generateImage(
      { prompt: 'our carpet wand, ccwcarpet style', loraId: FIXTURE_LORA.id },
      ctx
    );

    expect(resolveLoraForIndustry as jest.Mock).not.toHaveBeenCalled();
    const arg = (generateFluxLoraImage as jest.Mock).mock.calls[0][0];
    expect(arg.loras).toEqual([{ path: FIXTURE_LORA.loraUrl }]);
    expect(r.loraId).toBe(FIXTURE_LORA.id);
  });

  it('no active LoRA for the industry ⇒ plain grounded FLUX, NOT a block', async () => {
    (resolveLoraForIndustry as jest.Mock).mockReturnValue(null);

    const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

    expect(generateFluxLoraImage as jest.Mock).not.toHaveBeenCalled();
    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.blocked).toBeUndefined();
    expect(r.loraApplied).not.toBe(true);
  });
});

describe('LoRA failure falls back to grounded FLUX, never legacy (Part A item 8)', () => {
  it('adapter throw on an explicit loraId falls back to the reference-grounded FLUX path', async () => {
    (generateFluxLoraImage as jest.Mock).mockRejectedValue(
      new Error('fal lora down')
    );

    const r = await generateImage(
      { prompt: 'our carpet wand', loraId: FIXTURE_LORA.id },
      ctx
    );

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.loraApplied).toBe(false);
    expect(r.loraRequested).toBe(FIXTURE_LORA.id);
    expect(mockFetch).not.toHaveBeenCalled(); // legacy chain unreachable
  });

  it('an unknown loraId falls back to grounded FLUX with loraRequested stamped', async () => {
    const r = await generateImage(
      { prompt: 'our carpet wand', loraId: 'nonexistent-lora' },
      ctx
    );

    expect(generateFluxLoraImage as jest.Mock).not.toHaveBeenCalled();
    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.loraApplied).toBe(false);
    expect(r.loraRequested).toBe('nonexistent-lora');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('auto-LoRA adapter failure also falls back to grounded FLUX (loraRequested = auto id)', async () => {
    (resolveLoraForIndustry as jest.Mock).mockReturnValue(FIXTURE_LORA);
    (generateFluxLoraImage as jest.Mock).mockRejectedValue(
      new Error('fal lora down')
    );

    const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.loraRequested).toBe(FIXTURE_LORA.id);
  });

  it('LoRA failure then grounded-FLUX failure fails closed (blocked), never legacy', async () => {
    (generateFluxLoraImage as jest.Mock).mockRejectedValue(
      new Error('fal lora down')
    );
    (generateFluxImage as jest.Mock).mockRejectedValue(new Error('fal down'));

    const r = await generateImage(
      { prompt: 'our carpet wand', loraId: FIXTURE_LORA.id },
      ctx
    );

    expect(generateFluxImage as jest.Mock).toHaveBeenCalledTimes(2); // attempt + retry
    expect(r.success).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.error).toBe('Grounded generation failed after retry: fal down');
    expect(r.loraRequested).toBe(FIXTURE_LORA.id);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('generateVariations / generateBatch inheritance (Part A item 9)', () => {
  it('generateVariations inherits grounded-by-default per variant', async () => {
    const out = await generateVariations({ prompt: 'our carpet wand' }, ctx, 1);

    expect(out).toHaveLength(1);
    expect(out[0].success).toBe(true);
    expect(out[0].grounded).toBe(true);
  });

  it('generateVariations inherits the no-coverage BLOCK per variant', async () => {
    (resolveReferences as jest.Mock).mockReturnValue(EMPTY_REFS);

    const out = await generateVariations(
      { prompt: 'a cartoon spaceship' },
      ctx,
      1
    );

    expect(out[0].blocked).toBe(true);
    expect(out[0].error).toBe(BLOCK_COPY);
  });

  it('generateBatch (default _generate) inherits grounded-by-default per variant', async () => {
    const out = await generateBatch({ prompt: 'our carpet wand' }, ctx, 2);

    expect(out).toHaveLength(2);
    for (const r of out) {
      expect(r.success).toBe(true);
      expect(r.grounded).toBe(true);
    }
  });
});
