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
 * ZERO SPEND: pure selection; the private store is not provisioned.
 */

import { MAX_REFERENCE_MEGAPIXELS } from '@/lib/services/ai/image/registry';
import {
  resolvePrivateReferenceUrls,
  selectPrivatePaths,
  type PrivateManifest,
} from '@/lib/services/ai/reference-library-private';

/** A private manifest whose images carry the dimensions shown. */
function manifestWith(
  images: Array<{ path: string; width?: number; height?: number }>
): PrivateManifest {
  return {
    version: 1,
    industries: {
      'carpet-cleaning': {
        subjects: { wand: { rights: 'owned', images } },
      },
    },
  };
}

const OVERSIZED = { path: 'p/huge.webp', width: 4096, height: 4096 }; // 16 MP
const WITHIN = { path: 'p/ok.webp', width: 1536, height: 2048 }; // 3 MP
const UNMEASURED = { path: 'p/unknown.webp' }; // no dimensions recorded

function select(manifest: PrivateManifest): string[] {
  return selectPrivatePaths(manifest, 'carpet-cleaning', 4);
}

describe('private references obey the priced megapixel bound', () => {
  it('selects one that is recorded within the bound', () => {
    const paths = select(manifestWith([WITHIN]));

    // PRECONDITION for the exclusion cases below: the happy path must actually
    // produce a path, or "nothing was selected" proves nothing about the bound.
    expect(paths).toEqual(['p/ok.webp']);
  });

  it('EXCLUDES one recorded above the bound', () => {
    // 16 MP against a 4 MP ceiling: billed as input megapixels, so sending it
    // would cost four times what the hold reserved for it.
    expect(select(manifestWith([OVERSIZED, WITHIN]))).toEqual(['p/ok.webp']);
  });

  it('EXCLUDES one whose dimensions were never recorded', () => {
    // Unproven is not the same as small. The private manifest records `bytes`,
    // not pixels, so an unmeasured image cannot be shown to fit the bound.
    expect(select(manifestWith([UNMEASURED, WITHIN]))).toEqual(['p/ok.webp']);
  });

  it('returns none when every private image is unprovable', () => {
    expect(select(manifestWith([OVERSIZED, UNMEASURED]))).toEqual([]);
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

describe('private reference storage is not provisioned', () => {
  it('reports the bucket unavailable and resolves no URLs', async () => {
    const { logger } = await import('@/lib/logger');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    expect(await resolvePrivateReferenceUrls('carpet-cleaning', 4)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'private reference grounding unavailable',
      expect.objectContaining({
        available: false,
        reason: expect.stringContaining('FEATURE_NOT_PROVISIONED'),
      })
    );
    warn.mockRestore();
  });
});
