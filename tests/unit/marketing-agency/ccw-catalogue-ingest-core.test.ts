// tests/unit/marketing-agency/ccw-catalogue-ingest-core.test.ts
import {
  vendorKeyOf,
  rightsBasisFor,
  routeProduct,
  selectImages,
  fileNameFor,
  sizedSrc,
  aspectFlagged,
  estimateBytes,
  needsIngest,
  buildSubject,
  mergeManifest,
  findSubjectIndustry,
  reconcileProduct,
  staleFilesFor,
  vendorPartition,
  removeVendor,
  retagVendor,
  type ShopifyProduct,
} from '@/scripts/lib/ccw-ingest-core';
import type {
  Manifest,
  ManifestSubject,
} from '@/lib/services/ai/reference-library';

const img = (id: number, position: number, w = 1000, h = 1000) => ({
  id,
  position,
  src: `https://cdn.shopify.com/s/files/p${id}.jpg?v=1`,
  width: w,
  height: h,
});
const product = (over: Partial<ShopifyProduct> = {}): ShopifyProduct => ({
  title: 'Razorback AAM Pro Axial Air Mover',
  handle: 'razorback-aam-pro',
  vendor: 'Razorback',
  product_type: 'DOM REST AIRMOVERS',
  images: [img(11, 1), img(12, 2)],
  ...over,
});

describe('vendorKeyOf / rightsBasisFor', () => {
  it('normalises trim+casefold', () =>
    expect(vendorKeyOf('  Razorback ')).toBe('razorback'));
  it('own-brand vendors -> ccw-own-brand', () => {
    for (const v of [
      'Carpet Cleaners Warehouse',
      'Razorback',
      'Razorback Sandia',
    ])
      expect(rightsBasisFor(vendorKeyOf(v))).toBe('ccw-own-brand');
  });
  it('any other vendor -> ccw-supplier-authorised', () =>
    expect(rightsBasisFor('dri-eaz')).toBe('ccw-supplier-authorised'));
});

describe('routeProduct', () => {
  it('maps airmovers to water-damage-restoration', () =>
    expect(routeProduct(product())).toEqual({
      industry: 'water-damage-restoration',
    }));
  it('maps truckmount access to carpet-cleaning', () =>
    expect(
      routeProduct(product({ product_type: 'IMP EQUIP TRUCKMOUNT ACCESS' }))
    ).toEqual({ industry: 'carpet-cleaning' }));
  it('re-routes upholstery titles', () =>
    expect(
      routeProduct(
        product({
          product_type: 'IMP EQUIP TRUCKMOUNT ACCESS',
          title: 'Sapphire Upholstery Pro Tool',
        })
      )
    ).toEqual({ industry: 'upholstery-cleaning' }));
  it('skips tile & grout / aircon via skiplist', () => {
    expect(
      routeProduct(product({ product_type: 'IMP EQUIP TILE & GROUT' }))
    ).toEqual({ skip: 'type-skiplist' });
    expect(
      routeProduct(product({ product_type: 'IMP EQUIP AIRCON CLEANING' }))
    ).toEqual({ skip: 'type-skiplist' });
  });
  it('unmapped types are reported, not silently dropped', () =>
    expect(
      routeProduct(product({ product_type: 'DOM CHEM RESTORATION' }))
    ).toEqual({ skip: 'unmapped' }));
});

describe('selectImages / fileNameFor / sizedSrc / aspectFlagged', () => {
  it('caps at 4 ordered by position', () => {
    const p = product({
      images: [img(5, 5), img(1, 1), img(2, 2), img(3, 3), img(4, 4)],
    });
    expect(selectImages(p).map(i => i.id)).toEqual([1, 2, 3, 4]);
  });
  it('filename embeds handle + imageId', () =>
    expect(fileNameFor('razorback-aam-pro', 11)).toBe(
      'ccw-razorback-aam-pro-11.webp'
    ));
  it('sizedSrc inserts _2048x2048 before extension, preserving query', () =>
    expect(sizedSrc('https://cdn.shopify.com/s/files/p11.jpg?v=1')).toBe(
      'https://cdn.shopify.com/s/files/p11_2048x2048.jpg?v=1'
    ));
  it('flags extreme aspect ratios', () => {
    expect(aspectFlagged(img(1, 1, 3200, 900))).toBe(true);
    expect(aspectFlagged(img(1, 1, 900, 3200))).toBe(true);
    expect(aspectFlagged(img(1, 1, 1600, 1200))).toBe(false);
  });
  it('estimateBytes = 0.25MB per image', () =>
    expect(estimateBytes(4)).toBe(1_048_576));
});

describe('needsIngest (drift-aware idempotency)', () => {
  const processed = [
    {
      image: img(11, 1),
      file: 'ccw-razorback-aam-pro-11.webp',
      width: 800,
      height: 900,
      contentHash: 'sha256:x',
    },
  ];
  const existing = buildSubject(
    product({ images: [img(11, 1)] }),
    processed,
    '2026-07-11'
  );
  it('unchanged (same image ids, files exist) -> no re-ingest', () =>
    expect(needsIngest(existing, [img(11, 1)], () => true)).toBe(false));
  it('changed image list -> re-ingest', () =>
    expect(needsIngest(existing, [img(11, 1), img(99, 2)], () => true)).toBe(
      true
    ));
  it('missing file on disk -> re-ingest', () =>
    expect(needsIngest(existing, [img(11, 1)], () => false)).toBe(true));
  it('no existing subject -> ingest', () =>
    expect(needsIngest(undefined, [img(11, 1)], () => true)).toBe(true));
});

describe('buildSubject', () => {
  it('builds owned subject with full provenance + per-image lineage', () => {
    const s = buildSubject(
      product(),
      [
        {
          image: img(11, 1),
          file: 'ccw-razorback-aam-pro-11.webp',
          width: 800,
          height: 901,
          contentHash: 'sha256:abc',
        },
      ],
      '2026-07-11'
    );
    expect(s.rights).toBe('owned');
    expect(s.provenance!.rightsBasis).toBe('ccw-own-brand');
    expect(s.provenance!.vendorKey).toBe('razorback');
    expect(s.provenance!.sourceUrl).toBe(
      'https://www.ccwonline.com.au/products/razorback-aam-pro'
    );
    expect(s.images![0]).toMatchObject({
      file: 'ccw-razorback-aam-pro-11.webp',
      width: 800,
      height: 901,
      imageId: 11,
      position: 1,
      contentHash: 'sha256:abc',
    });
  });
});

describe('mergeManifest (key order is load-bearing)', () => {
  const base: Manifest = {
    version: 1,
    industries: {
      'carpet-cleaning': {
        label: 'C',
        subjects: {
          'carpet-cleaning-wand': {
            rights: 'owned',
            label: 'Wand',
            images: [{ file: 'w.webp', width: 1, height: 1, source: 't' }],
          },
          'carpet-cleaning-extraction': {
            rights: 'owned',
            label: 'Extraction',
            images: [{ file: 'e.webp', width: 1, height: 1, source: 't' }],
          },
        },
      },
    },
  };
  it('appends new subjects AFTER existing, preserving order', () => {
    const add: ManifestSubject = { rights: 'owned', label: 'New', images: [] };
    const merged = mergeManifest(base, [
      { industry: 'carpet-cleaning', key: 'ccw-new', subject: add },
    ]);
    expect(Object.keys(merged.industries['carpet-cleaning'].subjects)).toEqual([
      'carpet-cleaning-wand',
      'carpet-cleaning-extraction',
      'ccw-new',
    ]);
  });
  it('replacing an existing ccw subject keeps its position', () => {
    const withCcw = mergeManifest(base, [
      {
        industry: 'carpet-cleaning',
        key: 'ccw-a',
        subject: { rights: 'owned', label: 'A', images: [] },
      },
    ]);
    const replaced = mergeManifest(withCcw, [
      {
        industry: 'carpet-cleaning',
        key: 'ccw-a',
        subject: { rights: 'owned', label: 'A2', images: [] },
      },
    ]);
    expect(
      Object.keys(replaced.industries['carpet-cleaning'].subjects)
    ).toEqual(['carpet-cleaning-wand', 'carpet-cleaning-extraction', 'ccw-a']);
    expect(replaced.industries['carpet-cleaning'].subjects['ccw-a'].label).toBe(
      'A2'
    );
  });
  it('does not mutate the input manifest', () => {
    mergeManifest(base, [
      {
        industry: 'carpet-cleaning',
        key: 'ccw-x',
        subject: { rights: 'owned', label: 'X', images: [] },
      },
    ]);
    expect(
      Object.keys(base.industries['carpet-cleaning'].subjects)
    ).toHaveLength(2);
  });
});

describe('findSubjectIndustry', () => {
  const m: Manifest = {
    version: 1,
    industries: {
      'carpet-cleaning': {
        label: 'C',
        subjects: {
          'ccw-a': { rights: 'owned', label: 'A', images: [] },
        },
      },
      'water-damage-restoration': {
        label: 'W',
        subjects: {
          'ccw-b': { rights: 'owned', label: 'B', images: [] },
        },
      },
    },
  };
  it('returns the owning industry when the key exists', () => {
    expect(findSubjectIndustry(m, 'ccw-a')).toBe('carpet-cleaning');
    expect(findSubjectIndustry(m, 'ccw-b')).toBe('water-damage-restoration');
  });
  it('returns null when the key exists nowhere', () =>
    expect(findSubjectIndustry(m, 'ccw-nope')).toBeNull());
});

describe('mergeManifest — cross-industry re-route (Finding 1)', () => {
  const routed: Manifest = {
    version: 1,
    industries: {
      'carpet-cleaning': {
        label: 'C',
        subjects: {
          'carpet-cleaning-wand': {
            rights: 'owned',
            label: 'Wand',
            images: [{ file: 'w.webp', width: 1, height: 1, source: 't' }],
          },
          'ccw-flip-me': {
            rights: 'owned',
            label: 'Old route',
            images: [
              { file: 'ccw-flip-me-1.webp', width: 1, height: 1, source: 't' },
            ],
          },
        },
      },
      'upholstery-cleaning': {
        label: 'U',
        subjects: {
          'upholstery-tool': {
            rights: 'owned',
            label: 'Tool',
            images: [{ file: 'u.webp', width: 1, height: 1, source: 't' }],
          },
        },
      },
    },
  };
  it('removes the stale same-key subject from the other industry, preserving untouched key order', () => {
    const merged = mergeManifest(routed, [
      {
        industry: 'upholstery-cleaning',
        key: 'ccw-flip-me',
        subject: { rights: 'owned', label: 'New route', images: [] },
      },
    ]);
    expect(Object.keys(merged.industries['carpet-cleaning'].subjects)).toEqual([
      'carpet-cleaning-wand',
    ]);
    expect(
      Object.keys(merged.industries['upholstery-cleaning'].subjects)
    ).toEqual(['upholstery-tool', 'ccw-flip-me']);
    expect(
      merged.industries['upholstery-cleaning'].subjects['ccw-flip-me'].label
    ).toBe('New route');
  });
  it('route-flip keeps exactly ONE ccw-<handle> key across all industries', () => {
    const merged = mergeManifest(routed, [
      {
        industry: 'upholstery-cleaning',
        key: 'ccw-flip-me',
        subject: { rights: 'owned', label: 'New route', images: [] },
      },
    ]);
    const occurrences = Object.values(merged.industries).filter(ind =>
      Object.hasOwn(ind.subjects, 'ccw-flip-me')
    );
    expect(occurrences).toHaveLength(1);
  });
});

describe('reconcileProduct (route-flip + same-industry drift, Gap 1)', () => {
  const existingSubject: ManifestSubject = {
    rights: 'owned',
    label: 'Old',
    images: [
      {
        file: 'ccw-flip-me-11.webp',
        width: 1,
        height: 1,
        source: 'ccw-shopify',
        imageId: 11,
        position: 1,
      },
      {
        file: 'ccw-flip-me-12.webp',
        width: 1,
        height: 1,
        source: 'ccw-shopify',
        imageId: 12,
        position: 2,
      },
    ],
  };
  const manifestWith = (industry: string): Manifest => ({
    version: 1,
    industries: {
      [industry]: { label: 'X', subjects: { 'ccw-flip-me': existingSubject } },
      'other-industry': { label: 'Y', subjects: {} },
    },
  });

  it('route flip forces mustIngest even with identical image ids + files present', () => {
    const m = manifestWith('carpet-cleaning');
    const plan = reconcileProduct(
      m,
      'flip-me',
      'upholstery-cleaning', // routed industry differs from where the subject actually lives
      [img(11, 1), img(12, 2)], // identical ids to what's stored
      () => true, // every file is present on disk
      false
    );
    expect(plan.oldIndustry).toBe('carpet-cleaning');
    expect(plan.routeChanged).toBe(true);
    expect(plan.mustIngest).toBe(true);
  });

  it('same industry, unchanged ids, files present -> mustIngest false', () => {
    const m = manifestWith('carpet-cleaning');
    const plan = reconcileProduct(
      m,
      'flip-me',
      'carpet-cleaning',
      [img(11, 1), img(12, 2)],
      () => true,
      false
    );
    expect(plan.routeChanged).toBe(false);
    expect(plan.mustIngest).toBe(false);
  });

  it('same industry, changed image ids -> mustIngest true', () => {
    const m = manifestWith('carpet-cleaning');
    const plan = reconcileProduct(
      m,
      'flip-me',
      'carpet-cleaning',
      [img(11, 1), img(99, 2)],
      () => true,
      false
    );
    expect(plan.routeChanged).toBe(false);
    expect(plan.mustIngest).toBe(true);
  });

  it('same industry, unchanged ids but a stored file is missing on disk -> mustIngest true', () => {
    const m = manifestWith('carpet-cleaning');
    const plan = reconcileProduct(
      m,
      'flip-me',
      'carpet-cleaning',
      [img(11, 1), img(12, 2)],
      (_industry, f) => f !== 'ccw-flip-me-12.webp',
      false
    );
    expect(plan.routeChanged).toBe(false);
    expect(plan.mustIngest).toBe(true);
  });

  it('forced -> mustIngest true even when nothing else changed', () => {
    const m = manifestWith('carpet-cleaning');
    const plan = reconcileProduct(
      m,
      'flip-me',
      'carpet-cleaning',
      [img(11, 1), img(12, 2)],
      () => true,
      true
    );
    expect(plan.routeChanged).toBe(false);
    expect(plan.mustIngest).toBe(true);
  });
});

describe('staleFilesFor (Gap 1)', () => {
  const existing: ManifestSubject = {
    rights: 'owned',
    label: 'Old',
    images: [
      {
        file: 'ccw-flip-me-11.webp',
        width: 1,
        height: 1,
        source: 'ccw-shopify',
      },
      {
        file: 'ccw-flip-me-12.webp',
        width: 1,
        height: 1,
        source: 'ccw-shopify',
      },
    ],
  };

  it('route-flip: ALL old files are stale, listed under the OLD industry', () => {
    const stale = staleFilesFor(
      existing,
      ['ccw-flip-me-11.webp', 'ccw-flip-me-12.webp'], // even though both files were re-processed
      'carpet-cleaning',
      'upholstery-cleaning'
    );
    expect(stale).toEqual([
      { industry: 'carpet-cleaning', file: 'ccw-flip-me-11.webp' },
      { industry: 'carpet-cleaning', file: 'ccw-flip-me-12.webp' },
    ]);
  });

  it('same-industry partial replacement: only de-referenced files are listed', () => {
    const stale = staleFilesFor(
      existing,
      ['ccw-flip-me-11.webp'],
      'carpet-cleaning',
      'carpet-cleaning'
    );
    expect(stale).toEqual([
      { industry: 'carpet-cleaning', file: 'ccw-flip-me-12.webp' },
    ]);
  });

  it('no existing subject -> empty', () => {
    expect(staleFilesFor(undefined, [], null, 'carpet-cleaning')).toEqual([]);
  });
});

describe('mergeManifest — survivor order among remaining siblings after a mid-list stale delete (Gap 1)', () => {
  const base: Manifest = {
    version: 1,
    industries: {
      'carpet-cleaning': {
        label: 'C',
        subjects: {
          'ccw-a': { rights: 'owned', label: 'A', images: [] },
          'ccw-b': { rights: 'owned', label: 'B (will flip away)', images: [] },
          'ccw-c': { rights: 'owned', label: 'C', images: [] },
        },
      },
      'upholstery-cleaning': {
        label: 'U',
        subjects: {},
      },
    },
  };
  it('preserves order of the remaining siblings when the middle one route-flips away', () => {
    const merged = mergeManifest(base, [
      {
        industry: 'upholstery-cleaning',
        key: 'ccw-b',
        subject: { rights: 'owned', label: 'B (flipped)', images: [] },
      },
    ]);
    expect(Object.keys(merged.industries['carpet-cleaning'].subjects)).toEqual([
      'ccw-a',
      'ccw-c',
    ]);
    expect(
      Object.keys(merged.industries['upholstery-cleaning'].subjects)
    ).toEqual(['ccw-b']);
  });
});

describe('vendorPartition / removeVendor / retagVendor (audit contract)', () => {
  const m: Manifest = {
    version: 1,
    industries: {
      'water-damage-restoration': {
        label: 'W',
        subjects: {
          'ccw-a': {
            rights: 'owned',
            label: 'A',
            provenance: {
              source: 'ccw-shopify',
              vendorKey: 'razorback',
              vendorRaw: 'Razorback',
              ingestedAt: 'd',
              rightsBasis: 'ccw-own-brand',
            },
            images: [
              {
                file: 'ccw-a-1.webp',
                width: 1,
                height: 1,
                source: 'ccw-shopify',
              },
            ],
          },
          'ccw-b': {
            rights: 'owned',
            label: 'B',
            provenance: {
              source: 'ccw-shopify',
              vendorKey: 'dri-eaz',
              vendorRaw: 'Dri-eaz',
              ingestedAt: 'd',
              rightsBasis: 'ccw-supplier-authorised',
            },
            images: [
              {
                file: 'ccw-b-1.webp',
                width: 1,
                height: 1,
                source: 'ccw-shopify',
              },
              {
                file: 'ccw-b-2.webp',
                width: 1,
                height: 1,
                source: 'ccw-shopify',
              },
            ],
          },
          'first-party': {
            rights: 'owned',
            label: 'FP',
            images: [{ file: 'fp.webp', width: 1, height: 1, source: 'owned' }],
          },
        },
      },
    },
  };
  it('partition is complete and disjoint over ccw files', () => {
    const part = vendorPartition(m);
    const all = [...part.values()].flat().sort();
    expect(all).toEqual(['ccw-a-1.webp', 'ccw-b-1.webp', 'ccw-b-2.webp']);
    expect(part.get('razorback')).toEqual(['ccw-a-1.webp']);
    expect(part.get('dri-eaz')).toEqual(['ccw-b-1.webp', 'ccw-b-2.webp']);
  });
  it('removeVendor removes subjects + returns their files; others untouched', () => {
    const { manifest, deletedFiles } = removeVendor(m, 'dri-eaz');
    expect(deletedFiles).toEqual(['ccw-b-1.webp', 'ccw-b-2.webp']);
    expect(
      Object.keys(manifest.industries['water-damage-restoration'].subjects)
    ).toEqual(['ccw-a', 'first-party']);
  });
  it('retagVendor rewrites rights only', () => {
    const out = retagVendor(m, 'dri-eaz', 'pending-confirmation');
    expect(
      out.industries['water-damage-restoration'].subjects['ccw-b'].rights
    ).toBe('pending-confirmation');
    expect(
      out.industries['water-damage-restoration'].subjects['ccw-a'].rights
    ).toBe('owned');
  });
});
