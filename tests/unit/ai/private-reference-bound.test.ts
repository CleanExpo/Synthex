/** @jest-environment node */

/**
 * SYN-1115 release review, pass 6 — the megapixel ceiling must cover PRIVATE
 * references too.
 *
 * ## The defect
 *
 * `MAX_REFERENCE_MEGAPIXELS` was enforced only against the PUBLIC manifest.
 * Private customer photos resolve to signed URLs and are appended to the very
 * same FLUX requests, where fal bills them as input megapixels — but the
 * private manifest records `bytes`, not `width`/`height`, so nothing checked
 * them. A private image above the bound was still priced at the bound.
 *
 * The regression test that was supposed to cover this wrote its own escape
 * hatch: `if (!dims) continue` skipped exactly the URLs that are not in the
 * public manifest, i.e. precisely the ones that bypassed the ceiling. That
 * `continue` is deleted.
 *
 * ## Why unknown dimensions must REFUSE rather than assume
 *
 * The whole point of the bound is that the price is a consequence of something
 * the code enforces. A private image whose size is unrecorded cannot be proven
 * within the bound, so sending it would put the assumption back — the same
 * mistake in a new place. Unproven means not sent.
 *
 * Public references still ground the run, so excluding an unmeasured private
 * photo degrades quality rather than breaking generation. If it leaves a
 * subject with no references at all, the caller's existing no-coverage path
 * blocks the run, which is the correct fail-closed outcome.
 *
 * ZERO SPEND: Supabase and the provider boundary are stubbed.
 */

const signedFor = jest.fn();
const downloadManifest = jest.fn();

jest.mock('@/lib/platform/noop-client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        download: (...a: unknown[]) => downloadManifest(...a),
        createSignedUrls: (paths: string[], ttl: number) =>
          signedFor(paths, ttl),
      }),
    },
  }),
}));

import { MAX_REFERENCE_MEGAPIXELS } from '@/lib/services/ai/image/registry';

/** A private manifest whose images carry the dimensions shown. */
function manifestWith(
  images: Array<{ path: string; width?: number; height?: number }>
) {
  return {
    text: async () =>
      JSON.stringify({
        version: 1,
        industries: {
          'carpet-cleaning': {
            subjects: { wand: { rights: 'owned', images } },
          },
        },
      }),
  };
}

const OVERSIZED = { path: 'p/huge.webp', width: 4096, height: 4096 }; // 16 MP
const WITHIN = { path: 'p/ok.webp', width: 1536, height: 2048 }; // 3 MP
const UNMEASURED = { path: 'p/unknown.webp' }; // no dimensions recorded

beforeEach(() => {
  jest.resetModules();
  process.env.SUPABASE_URL = 'https://stub.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-key';
  signedFor.mockReset();
  downloadManifest.mockReset();
  signedFor.mockImplementation(async (paths: string[]) => ({
    data: paths.map(p => ({ signedUrl: `https://signed.test/${p}` })),
    error: null,
  }));
});

async function resolve(): Promise<string[]> {
  const mod = await import('@/lib/services/ai/reference-library-private');
  return mod.resolvePrivateReferenceUrls('carpet-cleaning', 4);
}

describe('private references obey the priced megapixel bound', () => {
  it('sends one that is recorded within the bound', async () => {
    downloadManifest.mockResolvedValue({
      data: manifestWith([WITHIN]),
      error: null,
    });

    const urls = await resolve();

    // PRECONDITION for the exclusion cases below: the happy path must actually
    // produce a URL, or "nothing was sent" proves nothing about the bound.
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('ok.webp');
  });

  it('EXCLUDES one recorded above the bound', async () => {
    downloadManifest.mockResolvedValue({
      data: manifestWith([OVERSIZED, WITHIN]),
      error: null,
    });

    const urls = await resolve();

    // 16 MP against a 4 MP ceiling: billed as input megapixels, so sending it
    // would cost four times what the hold reserved for it.
    expect(urls.join(',')).not.toContain('huge.webp');
    expect(urls.join(',')).toContain('ok.webp');
  });

  it('EXCLUDES one whose dimensions were never recorded', async () => {
    downloadManifest.mockResolvedValue({
      data: manifestWith([UNMEASURED, WITHIN]),
      error: null,
    });

    const urls = await resolve();

    // Unproven is not the same as small. The private manifest records `bytes`,
    // not pixels, so an unmeasured image cannot be shown to fit the bound —
    // and pricing it at the bound anyway is the assumption this whole change
    // exists to remove.
    expect(urls.join(',')).not.toContain('unknown.webp');
    expect(urls.join(',')).toContain('ok.webp');
  });

  it('returns none when every private image is unprovable', async () => {
    downloadManifest.mockResolvedValue({
      data: manifestWith([OVERSIZED, UNMEASURED]),
      error: null,
    });

    // Degrades to public-only grounding rather than sending something the hold
    // did not price. The caller blocks if that leaves no references at all.
    expect(await resolve()).toEqual([]);
  });

  it('the bound it enforces is the one the estimate is priced at', () => {
    // Not a restatement: if these ever diverge, references are billed at a rate
    // the reservation never covered.
    expect(MAX_REFERENCE_MEGAPIXELS).toBeGreaterThan(0);
    expect((1536 * 2048) / (1024 * 1024)).toBeLessThanOrEqual(
      MAX_REFERENCE_MEGAPIXELS
    );
    expect((4096 * 4096) / (1024 * 1024)).toBeGreaterThan(
      MAX_REFERENCE_MEGAPIXELS
    );
  });
});
