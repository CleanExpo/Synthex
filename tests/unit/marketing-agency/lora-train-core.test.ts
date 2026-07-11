import {
  planDataset,
  oversample,
  captionFileName,
  costUsd,
  validateSteps,
  buildRegistryEntry,
  retireLora,
  type DatasetItem,
} from '@/scripts/lib/lora-train-core';
import type {
  Manifest,
  ManifestImage,
  ManifestSubject,
} from '@/lib/services/ai/reference-library';
import {
  trainedLoraSchema,
  type TrainedLora,
  type TrainedLoraRegistry,
} from '@/lib/services/ai/image/trained-loras';

// --- fixtures ---------------------------------------------------------

const img = (file: string): ManifestImage => ({
  file,
  width: 1000,
  height: 1000,
  source: 'test',
});

/** CCW catalogue subject (rights: owned, source: ccw-shopify -> non-firstParty). */
const wandSubject: ManifestSubject = {
  rights: 'owned',
  label: 'Razorback AAM Pro Axial Air Mover',
  images: [img('wand-01.webp')],
  provenance: {
    source: 'ccw-shopify',
    vendorKey: 'razorback',
    vendorRaw: 'Razorback',
    ingestedAt: '2026-01-01T00:00:00Z',
    rightsBasis: 'ccw-own-brand',
  },
};

/** First-party subject with explicit non-ccw-shopify provenance. */
const jobPhotoSubject: ManifestSubject = {
  rights: 'owned',
  label: 'On-Site Carpet Extraction',
  images: [img('job-01.webp'), img('job-02.webp')],
  provenance: {
    source: 'first-party-manual',
    vendorKey: 'unite-group',
    vendorRaw: 'Unite Group',
    ingestedAt: '2026-01-02T00:00:00Z',
    rightsBasis: 'first-party-photo',
  },
};

/** First-party subject with NO provenance at all — still firstParty, vendorKey fallback. */
const truckSubject: ManifestSubject = {
  rights: 'owned',
  label: 'Truck Mount Unit',
  images: [img('truck-01.webp')],
};

/** Owned but zero images — must be excluded entirely. */
const emptyImagesSubject: ManifestSubject = {
  rights: 'owned',
  label: 'No Images Subject',
  images: [],
};

/** Not owned — must be excluded even though it has images. */
const notOwnedSubject: ManifestSubject = {
  rights: 'supplier-licensed',
  label: 'Licensed Only',
  images: [img('licensed-01.webp')],
};

function buildManifest(
  subjects: Record<string, ManifestSubject>,
  extraIndustries: Manifest['industries'] = {}
): Manifest {
  return {
    version: 1,
    industries: {
      'carpet-cleaning': {
        label: 'Carpet Cleaning',
        subjects,
      },
      ...extraIndustries,
    },
  };
}

const fixtureManifest = buildManifest(
  {
    wand: wandSubject,
    jobPhoto: jobPhotoSubject,
    truck: truckSubject,
    empty: emptyImagesSubject,
    notOwned: notOwnedSubject,
  },
  {
    'water-damage-restoration': {
      label: 'Water Damage Restoration',
      subjects: {
        airmover: {
          rights: 'owned',
          label: 'Air Mover',
          images: [img('airmover-01.webp')],
        },
      },
    },
  }
);

// --- planDataset --------------------------------------------------------

describe('planDataset', () => {
  it('includes only owned carpet-cleaning subjects with images', () => {
    const items = planDataset(fixtureManifest);
    const basenames = items.map(i => i.basename).sort();
    expect(basenames).toEqual(
      ['wand-01.webp', 'job-01.webp', 'job-02.webp', 'truck-01.webp'].sort()
    );
    // not-owned and empty-images subjects excluded
    expect(basenames).not.toContain('licensed-01.webp');
    // other industries never leak in
    expect(basenames).not.toContain('airmover-01.webp');
  });

  it('qualifies path as industry/<file>', () => {
    const items = planDataset(fixtureManifest);
    const wand = items.find(i => i.basename === 'wand-01.webp')!;
    expect(wand.path).toBe('carpet-cleaning/wand-01.webp');
  });

  it('captions ccw-shopify images as product photos, non-firstParty', () => {
    const items = planDataset(fixtureManifest);
    const wand = items.find(i => i.basename === 'wand-01.webp')!;
    expect(wand.caption).toBe(
      'Razorback AAM Pro Axial Air Mover, product photo on white background, ccwcarpet style'
    );
    expect(wand.firstParty).toBe(false);
    expect(wand.vendorKey).toBe('razorback');
  });

  it('captions non-ccw-shopify (explicit provenance) as on-site job photos, firstParty', () => {
    const items = planDataset(fixtureManifest);
    const job1 = items.find(i => i.basename === 'job-01.webp')!;
    expect(job1.caption).toBe(
      'On-Site Carpet Extraction, on-site job photo, ccwcarpet style'
    );
    expect(job1.firstParty).toBe(true);
    expect(job1.vendorKey).toBe('unite-group');
  });

  it('treats missing provenance as firstParty with unite-group vendorKey fallback', () => {
    const items = planDataset(fixtureManifest);
    const truck = items.find(i => i.basename === 'truck-01.webp')!;
    expect(truck.firstParty).toBe(true);
    expect(truck.vendorKey).toBe('unite-group');
    expect(truck.caption).toBe(
      'Truck Mount Unit, on-site job photo, ccwcarpet style'
    );
  });

  it('produces one item per image for multi-image subjects', () => {
    const items = planDataset(fixtureManifest);
    const jobItems = items.filter(i => i.basename.startsWith('job-'));
    expect(jobItems).toHaveLength(2);
  });

  it('throws on missing label (abort before spend)', () => {
    const manifest = buildManifest({
      bad: { rights: 'owned', label: '', images: [img('bad-01.webp')] },
    });
    expect(() => planDataset(manifest)).toThrow();
  });

  it('throws on whitespace-only label', () => {
    const manifest = buildManifest({
      bad: { rights: 'owned', label: '   ', images: [img('bad-01.webp')] },
    });
    expect(() => planDataset(manifest)).toThrow();
  });

  it('throws on undefined label', () => {
    const manifest = buildManifest({
      bad: {
        rights: 'owned',
        images: [img('bad-01.webp')],
      } as unknown as ManifestSubject,
    });
    expect(() => planDataset(manifest)).toThrow();
  });

  it('throws when the result would be empty (no carpet-cleaning industry)', () => {
    const manifest: Manifest = {
      version: 1,
      industries: {
        'water-damage-restoration': {
          label: 'Water Damage Restoration',
          subjects: {
            airmover: {
              rights: 'owned',
              label: 'Air Mover',
              images: [img('airmover-01.webp')],
            },
          },
        },
      },
    };
    expect(() => planDataset(manifest)).toThrow();
  });

  it('throws when carpet-cleaning has subjects but none owned-with-images', () => {
    const manifest = buildManifest({
      notOwned: notOwnedSubject,
      empty: emptyImagesSubject,
    });
    expect(() => planDataset(manifest)).toThrow();
  });
});

// --- oversample -----------------------------------------------------------

describe('oversample', () => {
  const firstPartyA: DatasetItem = {
    path: 'carpet-cleaning/job-01.webp',
    basename: 'job-01.webp',
    caption: 'A, on-site job photo, ccwcarpet style',
    vendorKey: 'unite-group',
    firstParty: true,
  };
  const firstPartyB: DatasetItem = {
    path: 'carpet-cleaning/job-02.webp',
    basename: 'job-02.webp',
    caption: 'B, on-site job photo, ccwcarpet style',
    vendorKey: 'unite-group',
    firstParty: true,
  };
  const catalogueItem: DatasetItem = {
    path: 'carpet-cleaning/wand-01.webp',
    basename: 'wand-01.webp',
    caption: 'C, product photo on white background, ccwcarpet style',
    vendorKey: 'razorback',
    firstParty: false,
  };

  it('default factor 3: each firstParty item appears 3x total with -dupN basenames', () => {
    const result = oversample([firstPartyA, firstPartyB]);
    // 2 originals x factor 3 = 6 total
    expect(result).toHaveLength(6);
    const basenames = result.map(i => i.basename);
    expect(basenames).toEqual([
      'job-01.webp',
      'job-02.webp',
      'job-01-dup1.webp',
      'job-01-dup2.webp',
      'job-02-dup1.webp',
      'job-02-dup2.webp',
    ]);
  });

  it('preserves captions and vendorKey on duplicates', () => {
    const result = oversample([firstPartyA]);
    const dup1 = result.find(i => i.basename === 'job-01-dup1.webp')!;
    expect(dup1.caption).toBe(firstPartyA.caption);
    expect(dup1.vendorKey).toBe(firstPartyA.vendorKey);
    expect(dup1.firstParty).toBe(true);
  });

  it('preserves the original path on duplicates (same source bytes)', () => {
    const result = oversample([firstPartyA]);
    const dup2 = result.find(i => i.basename === 'job-01-dup2.webp')!;
    expect(dup2.path).toBe(firstPartyA.path);
  });

  it('leaves non-firstParty items untouched (no duplicates)', () => {
    const result = oversample([catalogueItem, firstPartyA]);
    const catalogueCopies = result.filter(
      i => i.basename === 'wand-01.webp' || i.basename.startsWith('wand-01-dup')
    );
    expect(catalogueCopies).toHaveLength(1);
  });

  it('orders originals first, then duplicates appended', () => {
    const result = oversample([catalogueItem, firstPartyA]);
    expect(result[0].basename).toBe('wand-01.webp');
    expect(result[1].basename).toBe('job-01.webp');
    expect(result[2].basename).toBe('job-01-dup1.webp');
    expect(result[3].basename).toBe('job-01-dup2.webp');
  });

  it('respects a custom factor', () => {
    const result = oversample([firstPartyA], 2);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.basename)).toEqual([
      'job-01.webp',
      'job-01-dup1.webp',
    ]);
  });

  it('factor 1 produces no duplicates', () => {
    const result = oversample([firstPartyA], 1);
    expect(result).toHaveLength(1);
    expect(result[0].basename).toBe('job-01.webp');
  });
});

// --- captionFileName --------------------------------------------------------

describe('captionFileName', () => {
  it('replaces a simple extension', () => {
    expect(captionFileName('foo.jpg')).toBe('foo.txt');
  });

  it('replaces a webp extension', () => {
    expect(captionFileName('wand-01.webp')).toBe('wand-01.txt');
  });

  it('replaces the extension on a dup-suffixed basename', () => {
    expect(captionFileName('wand-01-dup1.webp')).toBe('wand-01-dup1.txt');
  });

  it('handles filenames with multiple dots (last dot is the extension)', () => {
    expect(captionFileName('job.v2.final.jpg')).toBe('job.v2.final.txt');
  });

  it('appends .txt when there is no extension at all', () => {
    expect(captionFileName('ROOT')).toBe('ROOT.txt');
  });
});

// --- costUsd ---------------------------------------------------------------

describe('costUsd', () => {
  it('computes cost at $0.0255/step', () => {
    expect(costUsd(1000)).toBe(25.5);
  });

  it('computes cost for the minimum step count', () => {
    expect(costUsd(100)).toBe(2.55);
  });

  it('computes cost above the cap (for validateSteps to reject)', () => {
    expect(costUsd(1100)).toBe(28.05);
  });

  it('rounds to 2 decimal places', () => {
    expect(costUsd(333)).toBe(8.49); // 333 * 0.0255 = 8.4915 -> 8.49
  });
});

// --- validateSteps -----------------------------------------------------------

describe('validateSteps', () => {
  it('accepts 1000 steps at exactly $25.50', () => {
    expect(() => validateSteps(1000)).not.toThrow();
  });

  it('accepts the minimum, 100 steps', () => {
    expect(() => validateSteps(100)).not.toThrow();
  });

  it('accepts a mid-range multiple of 100, e.g. 500', () => {
    expect(() => validateSteps(500)).not.toThrow();
  });

  it('rejects 1100 steps — exceeds both the 1000-step ceiling and the $26 cap', () => {
    expect(() => validateSteps(1100)).toThrow();
  });

  it('rejects 950 steps — not a multiple of 100', () => {
    expect(() => validateSteps(950)).toThrow();
  });

  it('rejects below the minimum, e.g. 50', () => {
    expect(() => validateSteps(50)).toThrow();
  });

  it('rejects 0 steps', () => {
    expect(() => validateSteps(0)).toThrow();
  });

  it('rejects negative steps', () => {
    expect(() => validateSteps(-100)).toThrow();
  });
});

// --- buildRegistryEntry -----------------------------------------------------

describe('buildRegistryEntry', () => {
  const baseArgs = {
    id: 'carpet-style-v1',
    steps: 1000,
    loraUrl: 'https://fal.example.com/loras/carpet-style-v1.safetensors',
    configUrl: 'https://fal.example.com/loras/carpet-style-v1.json',
    falRequestId: 'req-abc123',
    trainedAt: '2026-07-11',
    sourceImages: [
      {
        path: 'carpet-cleaning/wand-01.webp',
        sha256: 'a'.repeat(64),
        vendorKey: 'razorback',
      },
      {
        path: 'carpet-cleaning/job-01.webp',
        sha256: 'b'.repeat(64),
        vendorKey: 'unite-group',
      },
    ],
  };

  it('fills the fixed slice-1 fields', () => {
    const entry = buildRegistryEntry(baseArgs);
    expect(entry.kind).toBe('style');
    expect(entry.industry).toBe('carpet-cleaning');
    expect(entry.triggerToken).toBe('ccwcarpet');
    expect(entry.learningRate).toBe(0.00005);
    expect(entry.status).toBe('active');
  });

  it('derives costUsd from steps and imageCount from sourceImages length', () => {
    const entry = buildRegistryEntry(baseArgs);
    expect(entry.costUsd).toBe(25.5);
    expect(entry.imageCount).toBe(2);
  });

  it('carries through the caller-supplied identifying fields', () => {
    const entry = buildRegistryEntry(baseArgs);
    expect(entry.id).toBe('carpet-style-v1');
    expect(entry.loraUrl).toBe(baseArgs.loraUrl);
    expect(entry.configUrl).toBe(baseArgs.configUrl);
    expect(entry.falRequestId).toBe('req-abc123');
    expect(entry.trainedAt).toBe('2026-07-11');
    expect(entry.sourceImages).toEqual(baseArgs.sourceImages);
  });

  it('round-trips through trainedLoraSchema', () => {
    const entry = buildRegistryEntry(baseArgs);
    const parsed = trainedLoraSchema.safeParse(entry);
    expect(parsed.success).toBe(true);
  });

  it('throws if the built entry fails schema validation', () => {
    // sourceImages entries missing required fields -> schema violation.
    const badArgs = {
      ...baseArgs,
      sourceImages: [
        { path: 'x' } as unknown as (typeof baseArgs.sourceImages)[number],
      ],
    };
    expect(() => buildRegistryEntry(badArgs)).toThrow();
  });
});

// --- retireLora --------------------------------------------------------------

describe('retireLora', () => {
  const activeLora: TrainedLora = {
    id: 'carpet-style-v1',
    kind: 'style',
    industry: 'carpet-cleaning',
    triggerToken: 'ccwcarpet',
    loraUrl: 'https://fal.example.com/loras/carpet-style-v1.safetensors',
    configUrl: 'https://fal.example.com/loras/carpet-style-v1.json',
    trainedAt: '2026-07-11',
    steps: 1000,
    learningRate: 0.00005,
    costUsd: 25.5,
    imageCount: 163,
    falRequestId: 'req-abc123',
    status: 'active',
    sourceImages: [
      {
        path: 'carpet-cleaning/wand-01.webp',
        sha256: 'a'.repeat(64),
        vendorKey: 'razorback',
      },
    ],
  };
  const alreadyRetiredLora: TrainedLora = {
    ...activeLora,
    id: 'water-damage-style-v1',
    status: 'retired',
    retiredAt: '2026-01-01',
    retiredReason: 'superseded',
  };
  const registry: TrainedLoraRegistry = {
    version: 1,
    loras: [activeLora, alreadyRetiredLora],
  };

  it('flips status to retired and sets retiredAt/retiredReason', () => {
    const next = retireLora(
      registry,
      'carpet-style-v1',
      'quality regression',
      '2026-08-01'
    );
    const entry = next.loras.find(l => l.id === 'carpet-style-v1')!;
    expect(entry.status).toBe('retired');
    expect(entry.retiredAt).toBe('2026-08-01');
    expect(entry.retiredReason).toBe('quality regression');
  });

  it('keeps loraUrl and sourceImages intact (tombstone, never delete)', () => {
    const next = retireLora(
      registry,
      'carpet-style-v1',
      'quality regression',
      '2026-08-01'
    );
    const entry = next.loras.find(l => l.id === 'carpet-style-v1')!;
    expect(entry.loraUrl).toBe(activeLora.loraUrl);
    expect(entry.sourceImages).toEqual(activeLora.sourceImages);
    expect(next.loras).toHaveLength(2); // nothing deleted
  });

  it('leaves other entries untouched', () => {
    const next = retireLora(
      registry,
      'carpet-style-v1',
      'quality regression',
      '2026-08-01'
    );
    const untouched = next.loras.find(l => l.id === 'water-damage-style-v1')!;
    expect(untouched).toEqual(alreadyRetiredLora);
  });

  it('does not mutate the input registry', () => {
    const before = JSON.parse(JSON.stringify(registry));
    retireLora(registry, 'carpet-style-v1', 'quality regression', '2026-08-01');
    expect(registry).toEqual(before);
  });

  it('throws on unknown id', () => {
    expect(() =>
      retireLora(registry, 'no-such-lora', 'reason', '2026-08-01')
    ).toThrow();
  });

  it('throws on double-retire', () => {
    expect(() =>
      retireLora(
        registry,
        'water-damage-style-v1',
        'reason again',
        '2026-08-02'
      )
    ).toThrow();
  });
});
