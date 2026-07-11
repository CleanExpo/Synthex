# CCW Catalogue Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest CCW's Shopify equipment catalogue (~135 products, ~280–348 images) into the owned reference library with a full rights/lineage audit trail, and make the resolver subject-aware so grounding can target any one of ~145 subjects.

**Architecture:** Pure logic in `scripts/lib/ccw-ingest-core.ts` (unit-tested, no network) + a thin CLI (`scripts/ingest-ccw-catalogue.ts`) that does I/O. The resolver gains `industry/subject` syntax + prompt-scored single-subject selection. Generation results gain lineage fields. Manifest schema gains provenance (additive).

**Tech Stack:** TypeScript, `npx tsx` (present), `sharp` (promoted to explicit devDependency), Jest (`jest.worktree.cjs`), Shopify `/products.json`.

**Spec:** `docs/superpowers/specs/2026-07-11-ccw-catalogue-ingest-design.md` (v2 — 33 review findings folded; binding).

## Global Constraints

- npm only; gate = `npm run type-check && npm run lint && npm test`; no `any`; Australian English in copy.
- **No DB migration, no new MCP tool, no Zod change.**
- `rightsBasis` closed enum: `'ccw-own-brand' | 'ccw-supplier-authorised' | 'first-party-photo'`.
- Own-brand vendorKeys (casefolded): `carpet cleaners warehouse`, `razorback`, `razorback sandia`.
- Filenames: `ccw-<handle>-<shopifyImageId>.webp`. Manifest dims = sharp OUTPUT metadata.
- Manifest merge preserves existing key order; new subjects APPEND. Never sort/regenerate.
- Resolver selection: explicit subject → owned-only fail-closed; non-zero tie → first TIED subject in manifest order; zero-score/no-prompt → first owned subject (regression invariant).
- Empty-string `referenceSet` stays fail-closed and NEVER falls through to prompt auto-detect.
- Size guard 150 MB (dry-run estimate at flat 0.25 MB/img AND runtime cumulative bytes).
- All-or-nothing per product; manifest written ONCE at end via temp+rename.
- `rightsAssertionRef`: `spec:2026-07-11-ccw-catalogue-ingest-design.md#3-C1`.

---

### Task 1: Manifest types, rightsBasis enum, first-party provenance backfill

**Files:**

- Modify: `lib/services/ai/reference-library.ts` (types only, lines 16–35 region)
- Modify: `public/reference-library/manifest.json` (backfill provenance on the 9 existing subjects)
- Test: `tests/unit/ai/reference-library.test.ts` (append)

**Interfaces:**

- Produces (later tasks depend on exact names):

  ```ts
  export type RightsBasis =
    | 'ccw-own-brand'
    | 'ccw-supplier-authorised'
    | 'first-party-photo';
  export interface SubjectProvenance {
    source: string;
    vendorKey: string;
    vendorRaw: string;
    sourceUrl?: string;
    ingestedAt: string;
    rightsBasis: RightsBasis;
    rightsAssertionRef?: string;
    rightsNote?: string;
  }
  // ManifestSubject gains: provenance?: SubjectProvenance
  // ManifestImage gains:   imageId?: number; position?: number; imageSrc?: string; contentHash?: string;
  ```

- [ ] **Step 1: Write the failing test** (append inside the top-level `describe` of `tests/unit/ai/reference-library.test.ts`):

```ts
describe('provenance backfill (first-party subjects)', () => {
  it('every existing subject carries a first-party provenance block', () => {
    const sets = listReferenceSets();
    for (const s of sets) {
      for (const subj of s.subjects) {
        if (subj.count > 0) {
          expect(subj.rightsBasis).toBe('first-party-photo');
        }
      }
    }
  });
});
```

Also extend `ReferenceSubjectSummary` expectations later in Task 2 — here only `rightsBasis` is needed, so add it now to the summary type (Step 3).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/unit/ai/reference-library.test.ts`
Expected: FAIL — `rightsBasis` undefined on subject summaries.

- [ ] **Step 3: Implement** — in `lib/services/ai/reference-library.ts`:

Add after the existing interface block (before `ReferenceSubjectSummary`):

```ts
export type RightsBasis =
  | 'ccw-own-brand'
  | 'ccw-supplier-authorised'
  | 'first-party-photo';

export interface SubjectProvenance {
  source: string;
  vendorKey: string;
  vendorRaw: string;
  sourceUrl?: string;
  ingestedAt: string;
  rightsBasis: RightsBasis;
  rightsAssertionRef?: string;
  rightsNote?: string;
}
```

Extend `ManifestImage` with `imageId?: number; position?: number; imageSrc?: string; contentHash?: string;` and `ManifestSubject` with `provenance?: SubjectProvenance;`.

Extend `ReferenceSubjectSummary` with `vendor?: string; rightsBasis?: string;` and populate in `listFromManifest`:

```ts
    subjects: Object.entries(data.subjects).map(([key, s]) => ({
      key,
      label: s.label,
      count: s.images?.length ?? 0,
      rights: s.rights ?? 'unknown',
      vendor: s.provenance?.vendorRaw,
      rightsBasis: s.provenance?.rightsBasis,
    })),
```

Backfill `public/reference-library/manifest.json`: add to EVERY existing subject (9 subjects across the three industries), as the last key of each subject object:

```json
"provenance": {
  "source": "unite-group-first-party",
  "vendorKey": "unite-group",
  "vendorRaw": "Unite Group",
  "ingestedAt": "2026-07-11",
  "rightsBasis": "first-party-photo"
}
```

Do NOT reorder any existing keys or subjects.

- [ ] **Step 4: Run to verify pass** — `npm test -- tests/unit/ai/reference-library.test.ts` → all pass. `npm run type-check` → clean.

- [ ] **Step 5: Commit** — `feat(ai): manifest provenance types + rightsBasis enum + first-party backfill`

---

### Task 2: Resolver subject-aware selection + classifier hyphen tolerance + at-risk test migration

**Files:**

- Modify: `lib/services/ai/reference-library.ts` (`ResolvedReferences`, `resolveFromManifest`)
- Modify: `lib/demo/industry-classifier.ts:36` (one regex alternation)
- Test: `tests/unit/ai/reference-library.test.ts` (migrate 2 at-risk tests to synthetic manifests + add new)
- Test: `tests/unit/demo/industry-classifier-hyphen.test.ts` (new; if `tests/unit/demo/` doesn't exist, create it)

**Interfaces:**

- Consumes: Task 1's types.
- Produces: `ResolvedReferences` gains `vendorKey?: string; rightsBasis?: string;`. `resolveFromManifest(m, { set?, prompt?, max? })` accepts `set` as `industry` or `industry/subject`. Selection semantics per Global Constraints.

- [ ] **Step 1: Migrate the two at-risk tests FIRST** (they must survive ingestion):
  1. Replace the real-manifest test `never returns references for a non-owned / unknown set` — keep the `does-not-exist` assertion against the real manifest; move the empty-industry case to a synthetic manifest (an industry with `subjects: {}`).
  2. Replace the real-manifest auto-detect test (`count === 2`) with a synthetic-manifest equivalent via `resolveFromManifest` (same keywords gate applies — build the synthetic carpet industry with `keywords: ['carpet cleaning', 'carpet wand']` and one owned subject with 3 images; assert auto-detect from the prompt picks it with `max: 2` → count 2).

- [ ] **Step 2: Write the new failing tests** (append):

```ts
describe('subject-aware selection', () => {
  const img = (n: number) => ({
    file: `f${n}.webp`,
    width: 10,
    height: 10,
    source: 't',
  });
  const M: Manifest = {
    version: 1,
    industries: {
      'water-damage-restoration': {
        label: 'Water Damage Restoration',
        keywords: ['water damage', 'air mover'],
        subjects: {
          'ccw-spec-dryer': {
            rights: 'owned',
            label: 'Injectidry Spec Drying Unit',
            images: [img(1)],
          },
          'ccw-razorback-aam-pro': {
            rights: 'owned',
            label: 'Razorback AAM Pro Axial Air Mover',
            images: [img(2)],
            provenance: {
              source: 'ccw-shopify',
              vendorKey: 'razorback',
              vendorRaw: 'Razorback',
              ingestedAt: '2026-07-11',
              rightsBasis: 'ccw-own-brand',
            },
          },
          'ccw-razorback-aam-mini': {
            rights: 'owned',
            label: 'Razorback AAM Mini Axial Air Mover',
            images: [img(3)],
          },
          'not-owned': {
            rights: 'third-party',
            label: 'Dri-Eaz Velo Air Mover',
            images: [img(4)],
          },
        },
      },
    },
  };

  it('explicit industry/subject resolves exactly that owned subject with lineage', () => {
    const r = resolveFromManifest(M, {
      set: 'water-damage-restoration/ccw-razorback-aam-pro',
    });
    expect(r.subject).toBe('ccw-razorback-aam-pro');
    expect(r.imagePaths).toEqual([
      '/reference-library/water-damage-restoration/f2.webp',
    ]);
    expect(r.vendorKey).toBe('razorback');
    expect(r.rightsBasis).toBe('ccw-own-brand');
  });

  it('explicit non-owned subject fails closed (never falls back)', () => {
    const r = resolveFromManifest(M, {
      set: 'water-damage-restoration/not-owned',
    });
    expect(r.imagePaths).toEqual([]);
  });

  it('prompt scoring picks the best subject among decoys', () => {
    const r = resolveFromManifest(M, {
      set: 'water-damage-restoration',
      prompt: 'a razorback pro air mover drying',
    });
    expect(r.subject).toBe('ccw-razorback-aam-pro');
  });

  it('non-zero tie resolves to the FIRST TIED subject in manifest order', () => {
    const r = resolveFromManifest(M, {
      set: 'water-damage-restoration',
      prompt: 'razorback axial mover',
    });
    // 'razorback', 'axial', 'mover' tie pro vs mini (both labels contain all three) -> pro (earlier)
    expect(r.subject).toBe('ccw-razorback-aam-pro');
  });

  it('zero-score prompt falls back to the first owned subject (regression)', () => {
    const r = resolveFromManifest(M, {
      set: 'water-damage-restoration',
      prompt: 'zzz qqq unrelated',
    });
    expect(r.subject).toBe('ccw-spec-dryer');
  });

  it('no prompt falls back to the first owned subject (regression)', () => {
    const r = resolveFromManifest(M, { set: 'water-damage-restoration' });
    expect(r.subject).toBe('ccw-spec-dryer');
  });

  it('malformed sets fail closed and NEVER fall through to auto-detect', () => {
    for (const bad of [
      '',
      '  ',
      '/',
      '/water-damage-restoration',
      'water-damage-restoration/',
      'a/b/c',
    ]) {
      const r = resolveFromManifest(M, {
        set: bad,
        prompt: 'air mover water damage',
      });
      expect(r.imagePaths).toEqual([]);
    }
  });
});
```

- [ ] **Step 3: Run to verify fail** — `npm test -- tests/unit/ai/reference-library.test.ts` → new tests FAIL.

- [ ] **Step 4: Implement `resolveFromManifest`** (replace the existing function body; keep `ownedSubjects`, `autoDetectIndustry` as-is):

```ts
function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 3)
  );
}

export function resolveFromManifest(
  m: Manifest,
  opts: { set?: string; prompt?: string; max?: number }
): ResolvedReferences {
  const empty: ResolvedReferences = {
    industry: null,
    subject: null,
    imagePaths: [],
    count: 0,
  };
  const max = Math.max(0, opts.max ?? 4);

  let industryKey: string | null = null;
  let explicitSubject: string | null = null;

  if (opts.set !== undefined) {
    // Explicit-set path: NEVER falls through to prompt auto-detect (empty/malformed fail closed).
    const t = opts.set.trim();
    if (!t) return empty;
    const slash = t.indexOf('/');
    if (slash === -1) {
      industryKey = t;
    } else {
      industryKey = t.slice(0, slash);
      explicitSubject = t.slice(slash + 1);
      if (!industryKey || !explicitSubject) return empty;
    }
  } else {
    industryKey = opts.prompt ? autoDetectIndustry(opts.prompt, m) : null;
  }

  if (!industryKey || !Object.hasOwn(m.industries, industryKey)) return empty;
  const industry = m.industries[industryKey];
  if (!industry) return empty;

  const owned = ownedSubjects(industry);
  if (owned.length === 0) return empty; // rights guard

  let chosen: [string, ManifestSubject] | undefined;
  if (explicitSubject !== null) {
    // Owned-with-images filter enforced by searching `owned`; fail closed otherwise.
    chosen = owned.find(([k]) => k === explicitSubject);
    if (!chosen) return empty;
  } else {
    const promptTokens = opts.prompt
      ? tokenSet(opts.prompt)
      : new Set<string>();
    let best = 0;
    for (const [k, s] of owned) {
      const subjTokens = tokenSet(`${k} ${s.label}`);
      let score = 0;
      for (const tok of promptTokens) if (subjTokens.has(tok)) score++;
      // Strict '>' keeps the FIRST of any tied top scorers (deterministic).
      if (score > best) {
        best = score;
        chosen = [k, s];
      }
    }
    if (best === 0) chosen = owned[0]; // zero-score / no-prompt: today's behaviour
  }

  const [subjectKey, subject] = chosen!;
  const imagePaths = (subject.images ?? [])
    .slice(0, max)
    .map(img => `/reference-library/${industryKey}/${img.file}`);

  return {
    industry: industryKey,
    subject: subjectKey,
    imagePaths,
    count: imagePaths.length,
    vendorKey: subject.provenance?.vendorKey,
    rightsBasis: subject.provenance?.rightsBasis,
  };
}
```

Extend `ResolvedReferences` with `vendorKey?: string; rightsBasis?: string;`.

- [ ] **Step 5: Classifier hyphen tolerance** — `lib/demo/industry-classifier.ts` line 36: change the alternation `water\s+damage` → `water[-\s]+damage` (only that token; the branch already has a leading `\b` and matches as a substring of `water-damaged`). New test file:

```ts
// tests/unit/demo/industry-classifier-hyphen.test.ts
import { detectIndustry } from '@/lib/demo/industry-classifier';

describe('classifier water-damage hyphen tolerance', () => {
  it('matches hyphenated water-damaged', () => {
    expect(detectIndustry('drying a water-damaged room')).toBe(
      'cleaning & restoration'
    );
  });
  it('still matches spaced form', () => {
    expect(detectIndustry('water damage in the kitchen')).toBe(
      'cleaning & restoration'
    );
  });
  it('unrelated prompts unaffected', () => {
    expect(detectIndustry('a law firm office in Sydney')).toBe('legal');
  });
});
```

- [ ] **Step 6: Run all** — `npm test -- tests/unit/ai/reference-library.test.ts tests/unit/demo/industry-classifier-hyphen.test.ts` → PASS; `npm run type-check` clean.

- [ ] **Step 7: Commit** — `feat(ai): subject-aware reference resolution + classifier hyphen tolerance`

---

### Task 3: Lineage plumbing (image result + video job)

**Files:**

- Modify: `lib/services/ai/image-generation.ts` (grounded-result block; `ImageGenerationResult`)
- Modify: `lib/services/ai/video/types.ts` (`SubmittedJob`), `lib/services/ai/video/generation-service.ts` (grounding block + `jobs.push`)
- Test: `tests/unit/ai/image-generation-grounding.test.ts`, `tests/unit/ai/video-grounding.test.ts` (extend)

**Interfaces:**

- Consumes: `ResolvedReferences.subject/vendorKey` (Task 2).
- Produces: `ImageGenerationResult` gains `referenceSubject?: string; referenceVendor?: string;`. `SubmittedJob` gains `groundedSubject?: string; groundedVendor?: string;`.

- [ ] **Step 1: Failing tests.** In `image-generation-grounding.test.ts`, extend the grounded-success test:

```ts
expect(r.referenceSubject).toBe('carpet-cleaning-wand');
expect(r.referenceVendor).toBe('unite-group'); // Task 1 backfill
```

In `video-grounding.test.ts`, extend the CARPET fixture with `subject: 'carpet-cleaning-wand'` already present — add `vendorKey: 'unite-group'`, then in the explicit-set grounded test:

```ts
expect(jobs[0].groundedSubject).toBe('carpet-cleaning-wand');
expect(jobs[0].groundedVendor).toBe('unite-group');
```

- [ ] **Step 2: Run to verify fail** (both files).

- [ ] **Step 3: Implement.** `ImageGenerationResult` += `referenceSubject?: string; referenceVendor?: string;` and in the grounded return object add:

```ts
        referenceSubject: refs.subject ?? undefined,
        referenceVendor: refs.vendorKey,
```

`SubmittedJob` += `groundedSubject?: string; groundedVendor?: string;`. In `generation-service.ts` grounding block, beside `groundedSet`, capture `groundedSubject = refs.subject` and `groundedVendor = refs.vendorKey` (typed locals initialised `null`/`undefined`), then in `jobs.push` add `groundedSubject: groundedSubject ?? undefined, groundedVendor,`.

- [ ] **Step 4: Run both test files + type-check** → PASS/clean.
- [ ] **Step 5: Commit** — `feat(ai): grounding lineage on generation results (subject + vendor)`

---

### Task 4: Ingest core module (pure functions) + exhaustive tests

**Files:**

- Create: `scripts/lib/ccw-ingest-core.ts`
- Test: `tests/unit/marketing-agency/ccw-catalogue-ingest-core.test.ts`

**Interfaces:**

- Consumes: `Manifest`, `ManifestSubject`, `RightsBasis`, `SubjectProvenance` from `@/lib/services/ai/reference-library`.
- Produces (Task 5 depends on these exact signatures):

```ts
export interface ShopifyImage {
  id: number;
  position: number;
  src: string;
  width: number;
  height: number;
}
export interface ShopifyProduct {
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  images: ShopifyImage[];
}
export type Route =
  | { industry: string }
  | { skip: 'type-skiplist' | 'unmapped' | 'denylist' };
export function vendorKeyOf(raw: string): string;
export function rightsBasisFor(vendorKey: string): RightsBasis;
export function routeProduct(p: ShopifyProduct): Route;
export function selectImages(p: ShopifyProduct, cap?: number): ShopifyImage[];
export function fileNameFor(handle: string, imageId: number): string;
export function sizedSrc(src: string): string;
export function aspectFlagged(img: ShopifyImage): boolean;
export function estimateBytes(imageCount: number): number; // 0.25 MB * n
export function needsIngest(
  existing: ManifestSubject | undefined,
  selected: ShopifyImage[],
  fileExists: (file: string) => boolean
): boolean;
export function buildSubject(
  p: ShopifyProduct,
  processed: Array<{
    image: ShopifyImage;
    file: string;
    width: number;
    height: number;
    contentHash: string;
  }>,
  ingestedAt: string
): ManifestSubject;
export function mergeManifest(
  existing: Manifest,
  additions: Array<{ industry: string; key: string; subject: ManifestSubject }>
): Manifest;
export function vendorPartition(m: Manifest): Map<string, string[]>; // vendorKey -> files (ccw only)
export function removeVendor(
  m: Manifest,
  vendorKey: string
): { manifest: Manifest; deletedFiles: string[] };
export function retagVendor(
  m: Manifest,
  vendorKey: string,
  rights: string
): Manifest;
export const TYPE_TO_INDUSTRY: Record<string, string>;
export const SKIPPED_TYPES: ReadonlySet<string>;
export const EXCLUDED_VENDORS: readonly string[]; // vendorKeys; committed denylist
export const EXCLUDED_HANDLES: readonly string[];
export const RIGHTS_ASSERTION_REF: string;
```

- [ ] **Step 1: Write the failing tests** — one `describe` per function group. Complete test file:

```ts
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
```

- [ ] **Step 2: Run to verify fail** — module not found.

- [ ] **Step 3: Implement `scripts/lib/ccw-ingest-core.ts`** (complete):

```ts
/**
 * CCW catalogue ingestion — PURE core (no network, no fs). The CLI wrapper
 * (scripts/ingest-ccw-catalogue.ts) does all I/O. Spec:
 * docs/superpowers/specs/2026-07-11-ccw-catalogue-ingest-design.md (v2).
 */
import type {
  Manifest,
  ManifestSubject,
  RightsBasis,
} from '@/lib/services/ai/reference-library';

export interface ShopifyImage {
  id: number;
  position: number;
  src: string;
  width: number;
  height: number;
}
export interface ShopifyProduct {
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  images: ShopifyImage[];
}
export type Route =
  | { industry: string }
  | { skip: 'type-skiplist' | 'unmapped' | 'denylist' };

export const RIGHTS_ASSERTION_REF =
  'spec:2026-07-11-ccw-catalogue-ingest-design.md#3-C1';

/** Committed denylist — removed suppliers can never silently return (§6.7). */
export const EXCLUDED_VENDORS: readonly string[] = [];
export const EXCLUDED_HANDLES: readonly string[] = [];

const OWN_BRAND_VENDOR_KEYS = new Set([
  'carpet cleaners warehouse',
  'razorback',
  'razorback sandia',
]);

export const TYPE_TO_INDUSTRY: Record<string, string> = {
  'DOM EQUIP TRUCKMOUNT ACCESS': 'carpet-cleaning',
  'IMP EQUIP TRUCKMOUNT ACCESS': 'carpet-cleaning',
  'DOM EQUIP ROTARYS & SCRUBBERS': 'carpet-cleaning',
  'IMP EQUIP ROTARYS AND SRUBBERS': 'carpet-cleaning',
  'IMP EQUIP ROTARYS AND SRUBBERS CHINA': 'carpet-cleaning',
  'DOM EQUIP VACUUM CLEANERS': 'carpet-cleaning',
  'IMP EQUIP VAC CLEANERS & SPAYE': 'carpet-cleaning',
  'DOM EQUIP METH': 'carpet-cleaning',
  'DOM REST AIRMOVERS': 'water-damage-restoration',
  'IMP REST AIRMOVERS': 'water-damage-restoration',
  'IMP REST AIRMOVERS CHINA': 'water-damage-restoration',
  'IMP REST DEHUMIDIFIERS': 'water-damage-restoration',
  'DOM REST SPEC DRYING': 'water-damage-restoration',
  'IMP REST SPEC DRYING': 'water-damage-restoration',
};

export const SKIPPED_TYPES: ReadonlySet<string> = new Set([
  'DOM EQUIP TILE & GROUT',
  'IMP EQUIP TILE & GROUT',
  'IMP EQUIP AIRCON CLEANING',
]);

export function vendorKeyOf(raw: string): string {
  return raw.trim().toLowerCase();
}

export function rightsBasisFor(vendorKey: string): RightsBasis {
  return OWN_BRAND_VENDOR_KEYS.has(vendorKey)
    ? 'ccw-own-brand'
    : 'ccw-supplier-authorised';
}

export function routeProduct(p: ShopifyProduct): Route {
  if (
    EXCLUDED_VENDORS.includes(vendorKeyOf(p.vendor)) ||
    EXCLUDED_HANDLES.includes(p.handle)
  ) {
    return { skip: 'denylist' };
  }
  if (SKIPPED_TYPES.has(p.product_type)) return { skip: 'type-skiplist' };
  const industry = TYPE_TO_INDUSTRY[p.product_type];
  if (!industry) return { skip: 'unmapped' };
  if (/upholstery/i.test(p.title)) return { industry: 'upholstery-cleaning' };
  return { industry };
}

export function selectImages(p: ShopifyProduct, cap = 4): ShopifyImage[] {
  return [...p.images].sort((a, b) => a.position - b.position).slice(0, cap);
}

export function fileNameFor(handle: string, imageId: number): string {
  return `ccw-${handle}-${imageId}.webp`;
}

/** Insert Shopify's _2048x2048 fit-within variant before the extension, preserving the query. */
export function sizedSrc(src: string): string {
  const [path, query] = src.split('?');
  const dot = path.lastIndexOf('.');
  if (dot === -1) return src;
  const sized = `${path.slice(0, dot)}_2048x2048${path.slice(dot)}`;
  return query ? `${sized}?${query}` : sized;
}

/** Likely spec charts / dimension diagrams — flagged for human spot-check (§6.6). */
export function aspectFlagged(img: ShopifyImage): boolean {
  if (!img.width || !img.height) return false;
  const r = img.width / img.height;
  return r > 3 || r < 1 / 3;
}

/** Flat heuristic (§6.9) — dims-independent by design. */
export function estimateBytes(imageCount: number): number {
  return imageCount * 262_144; // 0.25 MB
}

/** Drift-aware idempotency (§6.5): image-id list equality AND files on disk. */
export function needsIngest(
  existing: ManifestSubject | undefined,
  selected: ShopifyImage[],
  fileExists: (file: string) => boolean
): boolean {
  if (!existing?.images) return true;
  const storedIds = existing.images.map(i => i.imageId ?? -1);
  const freshIds = selected.map(i => i.id);
  if (
    storedIds.length !== freshIds.length ||
    storedIds.some((id, n) => id !== freshIds[n])
  ) {
    return true;
  }
  return existing.images.some(i => !fileExists(i.file));
}

export function buildSubject(
  p: ShopifyProduct,
  processed: Array<{
    image: ShopifyImage;
    file: string;
    width: number;
    height: number;
    contentHash: string;
  }>,
  ingestedAt: string
): ManifestSubject {
  const vendorKey = vendorKeyOf(p.vendor);
  return {
    rights: 'owned',
    label: p.title,
    provenance: {
      source: 'ccw-shopify',
      vendorKey,
      vendorRaw: p.vendor,
      sourceUrl: `https://www.ccwonline.com.au/products/${p.handle}`,
      ingestedAt,
      rightsBasis: rightsBasisFor(vendorKey),
      rightsAssertionRef: RIGHTS_ASSERTION_REF,
    },
    images: processed.map(x => ({
      file: x.file,
      width: x.width,
      height: x.height,
      source: 'ccw-shopify',
      imageId: x.image.id,
      position: x.image.position,
      imageSrc: x.image.src,
      contentHash: x.contentHash,
    })),
  };
}

/** Preserve existing key order; append new; replace-in-place on same key. Never sorts (§7.5). */
export function mergeManifest(
  existing: Manifest,
  additions: Array<{ industry: string; key: string; subject: ManifestSubject }>
): Manifest {
  const out: Manifest = JSON.parse(JSON.stringify(existing)) as Manifest;
  for (const a of additions) {
    const ind = out.industries[a.industry];
    if (!ind) continue;
    ind.subjects[a.key] = a.subject; // insertion order: existing keys keep position, new keys append
  }
  return out;
}

export function vendorPartition(m: Manifest): Map<string, string[]> {
  const part = new Map<string, string[]>();
  for (const ind of Object.values(m.industries)) {
    for (const s of Object.values(ind.subjects)) {
      const vk = s.provenance?.vendorKey;
      if (!vk || s.provenance?.source !== 'ccw-shopify') continue;
      const files = (s.images ?? []).map(i => i.file);
      part.set(vk, [...(part.get(vk) ?? []), ...files]);
    }
  }
  return part;
}

export function removeVendor(
  m: Manifest,
  vendorKey: string
): { manifest: Manifest; deletedFiles: string[] } {
  const out: Manifest = JSON.parse(JSON.stringify(m)) as Manifest;
  const deletedFiles: string[] = [];
  for (const ind of Object.values(out.industries)) {
    for (const [key, s] of Object.entries(ind.subjects)) {
      if (s.provenance?.vendorKey === vendorKey) {
        deletedFiles.push(...(s.images ?? []).map(i => i.file));
        delete ind.subjects[key];
      }
    }
  }
  return { manifest: out, deletedFiles };
}

export function retagVendor(
  m: Manifest,
  vendorKey: string,
  rights: string
): Manifest {
  const out: Manifest = JSON.parse(JSON.stringify(m)) as Manifest;
  for (const ind of Object.values(out.industries)) {
    for (const s of Object.values(ind.subjects)) {
      if (s.provenance?.vendorKey === vendorKey) s.rights = rights;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run** — `npm test -- tests/unit/marketing-agency/ccw-catalogue-ingest-core.test.ts` → PASS; type-check clean.
- [ ] **Step 5: Commit** — `feat(scripts): CCW ingest pure core (routing, rights, idempotency, merge, audit partition)`

---

### Task 5: Ingest CLI + sharp devDependency

**Files:**

- Create: `scripts/ingest-ccw-catalogue.ts`
- Modify: `package.json` (add `"sharp": "^0.34.5"` to devDependencies; run `npm install --save-dev sharp@0.34.5 --legacy-peer-deps`)
- Test: `tests/unit/marketing-agency/ccw-catalogue-ingest-cli.test.ts` (arg parsing + report shaping only — the pure bits)

**Interfaces:** consumes every Task 4 export. CLI flags: `--dry-run`, `--verify`, `--remove-vendor <vendorKey>`, `--retag-vendor <vendorKey> <rights>`, `--force-refresh-handle <handle>`, `--force-refresh-vendor <vendorKey>`, `--force-size`.

- [ ] **Step 1: Failing test** for the exported pure helpers `parseArgs(argv)` and `formatReport(report)`:

```ts
// tests/unit/marketing-agency/ccw-catalogue-ingest-cli.test.ts
import { parseArgs, formatReport } from '@/scripts/ingest-ccw-catalogue';

describe('parseArgs', () => {
  it('parses modes and flags', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
    expect(parseArgs(['--remove-vendor', 'dri-eaz']).removeVendor).toBe(
      'dri-eaz'
    );
    expect(
      parseArgs(['--retag-vendor', 'dri-eaz', 'pending']).retagVendor
    ).toEqual({ vendorKey: 'dri-eaz', rights: 'pending' });
    expect(parseArgs(['--force-refresh-handle', 'x']).forceRefreshHandle).toBe(
      'x'
    );
    expect(parseArgs(['--force-refresh-vendor', 'y']).forceRefreshVendor).toBe(
      'y'
    );
    expect(parseArgs(['--verify']).verify).toBe(true);
    expect(parseArgs(['--force-size']).forceSize).toBe(true);
  });
  it('rejects unknown flags', () =>
    expect(() => parseArgs(['--nope'])).toThrow());
});

describe('formatReport', () => {
  it('renders every section, never omitting unmapped', () => {
    const text = formatReport({
      ingestable: { 'carpet-cleaning': 2 },
      perVendor: { razorback: 2 },
      perRights: { 'ccw-own-brand': 2 },
      upholsteryRerouted: ['a-tool'],
      skippedTypes: { 'IMP EQUIP TILE & GROUT': 3 },
      unmapped: { 'DOM CHEM RESTORATION': 5 },
      denylisted: 0,
      stale: ['gone-product'],
      orphans: ['ccw-old-1.webp'],
      newVendors: ['orbot'],
      aspectFlagged: ['ccw-x-9.webp'],
      imageCount: 4,
      estimatedBytes: 1_048_576,
      projectedManifestBytes: 2048,
    });
    for (const needle of [
      'unmapped',
      'DOM CHEM RESTORATION',
      'stale',
      'orphans',
      'new vendors',
      'aspect',
      'upholstery',
      '1.0 MB',
    ]) {
      expect(text.toLowerCase()).toContain(needle.toLowerCase());
    }
  });
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement the CLI** (complete — I/O orchestration around the core):

```ts
#!/usr/bin/env tsx
/**
 * CCW catalogue ingestion CLI — I/O wrapper around scripts/lib/ccw-ingest-core.
 * Spec: docs/superpowers/specs/2026-07-11-ccw-catalogue-ingest-design.md (v2).
 * Modes: default ingest | --dry-run | --verify | --remove-vendor | --retag-vendor.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type {
  Manifest,
  ManifestSubject,
} from '@/lib/services/ai/reference-library';
import {
  type ShopifyProduct,
  type ShopifyImage,
  routeProduct,
  selectImages,
  fileNameFor,
  sizedSrc,
  aspectFlagged,
  estimateBytes,
  needsIngest,
  buildSubject,
  mergeManifest,
  vendorPartition,
  removeVendor,
  retagVendor,
  vendorKeyOf,
} from './lib/ccw-ingest-core';

const ROOT = path.resolve(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'public/reference-library');
const MANIFEST_PATH = path.join(LIB_DIR, 'manifest.json');
const BASE = 'https://www.ccwonline.com.au';
const SIZE_CAP_BYTES = 150 * 1024 * 1024;

export interface CliArgs {
  dryRun: boolean;
  verify: boolean;
  forceSize: boolean;
  removeVendor?: string;
  retagVendor?: { vendorKey: string; rights: string };
  forceRefreshHandle?: string;
  forceRefreshVendor?: string;
}
export function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { dryRun: false, verify: false, forceSize: false };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f === '--dry-run') a.dryRun = true;
    else if (f === '--verify') a.verify = true;
    else if (f === '--force-size') a.forceSize = true;
    else if (f === '--remove-vendor') a.removeVendor = argv[++i];
    else if (f === '--retag-vendor')
      a.retagVendor = { vendorKey: argv[++i], rights: argv[++i] };
    else if (f === '--force-refresh-handle') a.forceRefreshHandle = argv[++i];
    else if (f === '--force-refresh-vendor') a.forceRefreshVendor = argv[++i];
    else throw new Error(`unknown flag: ${f}`);
  }
  return a;
}

export interface Report {
  ingestable: Record<string, number>;
  perVendor: Record<string, number>;
  perRights: Record<string, number>;
  upholsteryRerouted: string[];
  skippedTypes: Record<string, number>;
  unmapped: Record<string, number>;
  denylisted: number;
  stale: string[];
  orphans: string[];
  newVendors: string[];
  aspectFlagged: string[];
  imageCount: number;
  estimatedBytes: number;
  projectedManifestBytes: number;
}
export function formatReport(r: Report): string {
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  return [
    `INGESTABLE per industry: ${JSON.stringify(r.ingestable)}`,
    `per vendor: ${JSON.stringify(r.perVendor)}`,
    `per rightsBasis: ${JSON.stringify(r.perRights)}`,
    `upholstery re-routed (${r.upholsteryRerouted.length}): ${r.upholsteryRerouted.join(', ') || '-'}`,
    `skipped types: ${JSON.stringify(r.skippedTypes)}`,
    `UNMAPPED types (never silent): ${JSON.stringify(r.unmapped)}`,
    `denylisted: ${r.denylisted}`,
    `stale (in manifest, gone upstream): ${r.stale.join(', ') || '-'}`,
    `orphans (on disk, not in manifest): ${r.orphans.join(', ') || '-'}`,
    `new vendors this run: ${r.newVendors.join(', ') || '-'}`,
    `aspect-flagged (human spot-check): ${r.aspectFlagged.join(', ') || '-'}`,
    `images: ${r.imageCount}, size estimate: ${mb(r.estimatedBytes)}, projected manifest: ${mb(r.projectedManifestBytes)}`,
  ].join('\n');
}

async function fetchWithRetry(url: string, tries = 3): Promise<Response> {
  for (let n = 1; ; n++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (res.ok) return res;
    if (n >= tries || (res.status < 500 && res.status !== 429)) {
      throw new Error(`fetch failed ${res.status}: ${url}`);
    }
    await new Promise(r => setTimeout(r, 1000 * 2 ** (n - 1)));
  }
}

async function fetchCatalogue(): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= 40; page++) {
    const res = await fetchWithRetry(
      `${BASE}/products.json?limit=250&page=${page}`
    );
    const data = (await res.json()) as { products?: ShopifyProduct[] };
    if (!Array.isArray(data.products))
      throw new Error(`malformed page ${page}`);
    if (data.products.length === 0) break;
    all.push(...data.products);
  }
  return all;
}

function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}
function writeManifestAtomic(m: Manifest): void {
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
  fs.renameSync(tmp, MANIFEST_PATH);
}
function findSubject(m: Manifest, key: string): ManifestSubject | undefined {
  for (const ind of Object.values(m.industries)) {
    if (Object.hasOwn(ind.subjects, key)) return ind.subjects[key];
  }
  return undefined;
}
function listOrphans(m: Manifest): string[] {
  const known = new Set<string>();
  for (const ind of Object.values(m.industries)) {
    for (const s of Object.values(ind.subjects)) {
      for (const i of s.images ?? []) known.add(i.file);
    }
  }
  const orphans: string[] = [];
  for (const dir of fs.readdirSync(LIB_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(LIB_DIR, dir.name))) {
      if (f.startsWith('ccw-') && f.endsWith('.webp') && !known.has(f))
        orphans.push(f);
    }
  }
  return orphans;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest();

  if (args.removeVendor) {
    const { manifest: next, deletedFiles } = removeVendor(
      manifest,
      args.removeVendor
    );
    for (const ind of Object.keys(next.industries)) {
      for (const f of deletedFiles) {
        const p = path.join(LIB_DIR, ind, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    writeManifestAtomic(next);
    console.log(
      `removed vendor ${args.removeVendor}: ${deletedFiles.length} files + subjects`
    );
    return;
  }
  if (args.retagVendor) {
    writeManifestAtomic(
      retagVendor(manifest, args.retagVendor.vendorKey, args.retagVendor.rights)
    );
    console.log(
      `retagged vendor ${args.retagVendor.vendorKey} -> rights=${args.retagVendor.rights}`
    );
    return;
  }
  if (args.verify) {
    let bad = 0;
    for (const [indKey, ind] of Object.entries(manifest.industries)) {
      for (const s of Object.values(ind.subjects)) {
        for (const i of s.images ?? []) {
          if (!i.contentHash) continue;
          const p = path.join(LIB_DIR, indKey, i.file);
          if (!fs.existsSync(p)) {
            console.error(`MISSING ${i.file}`);
            bad++;
            continue;
          }
          const h = `sha256:${createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;
          if (h !== i.contentHash) {
            console.error(`HASH MISMATCH ${i.file}`);
            bad++;
          }
        }
      }
    }
    console.log(bad === 0 ? 'verify OK' : `verify FAILED: ${bad} issue(s)`);
    process.exitCode = bad === 0 ? 0 : 1;
    return;
  }

  // ── plan (shared by dry-run + ingest) ────────────────────────────────────
  const products = await fetchCatalogue();
  const report: Report = {
    ingestable: {},
    perVendor: {},
    perRights: {},
    upholsteryRerouted: [],
    skippedTypes: {},
    unmapped: {},
    denylisted: 0,
    stale: [],
    orphans: listOrphans(manifest),
    newVendors: [],
    aspectFlagged: [],
    imageCount: 0,
    estimatedBytes: 0,
    projectedManifestBytes: 0,
  };
  const knownVendors = new Set<string>();
  for (const ind of Object.values(manifest.industries)) {
    for (const s of Object.values(ind.subjects)) {
      if (s.provenance?.vendorKey) knownVendors.add(s.provenance.vendorKey);
    }
  }
  const seenHandles = new Set<string>();
  const todo: Array<{
    p: ShopifyProduct;
    industry: string;
    images: ShopifyImage[];
  }> = [];
  for (const p of products) {
    seenHandles.add(p.handle);
    const route = routeProduct(p);
    if ('skip' in route) {
      if (route.skip === 'denylist') report.denylisted++;
      else if (route.skip === 'type-skiplist')
        report.skippedTypes[p.product_type] =
          (report.skippedTypes[p.product_type] ?? 0) + 1;
      else
        report.unmapped[p.product_type] =
          (report.unmapped[p.product_type] ?? 0) + 1;
      continue;
    }
    const images = selectImages(p);
    if (images.length === 0) continue;
    const vk = vendorKeyOf(p.vendor);
    if (!knownVendors.has(vk) && !report.newVendors.includes(vk))
      report.newVendors.push(vk);
    const existing = findSubject(manifest, `ccw-${p.handle}`);
    const forced =
      args.forceRefreshHandle === p.handle || args.forceRefreshVendor === vk;
    const fileOk = (f: string) =>
      fs.existsSync(path.join(LIB_DIR, route.industry, f));
    if (!forced && !needsIngest(existing, images, fileOk)) continue;
    if (/upholstery/i.test(p.title)) report.upholsteryRerouted.push(p.handle);
    report.ingestable[route.industry] =
      (report.ingestable[route.industry] ?? 0) + 1;
    report.perVendor[vk] = (report.perVendor[vk] ?? 0) + 1;
    const rb = buildSubject(p, [], '').provenance!.rightsBasis;
    report.perRights[rb] = (report.perRights[rb] ?? 0) + 1;
    report.imageCount += images.length;
    for (const i of images)
      if (aspectFlagged(i))
        report.aspectFlagged.push(fileNameFor(p.handle, i.id));
    todo.push({ p, industry: route.industry, images });
  }
  // stale: manifest ccw subjects whose handle vanished upstream
  for (const ind of Object.values(manifest.industries)) {
    for (const key of Object.keys(ind.subjects)) {
      if (key.startsWith('ccw-') && !seenHandles.has(key.slice(4)))
        report.stale.push(key);
    }
  }
  report.estimatedBytes = estimateBytes(report.imageCount);
  report.projectedManifestBytes =
    JSON.stringify(manifest).length + todo.length * 700;

  console.log(formatReport(report));
  if (report.estimatedBytes > SIZE_CAP_BYTES && !args.forceSize) {
    console.error(
      'size estimate exceeds 150 MB cap — aborting (use --force-size to override)'
    );
    process.exitCode = 1;
    return;
  }
  if (args.dryRun) return; // zero writes, zero image downloads

  // ── ingest ───────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const additions: Array<{
    industry: string;
    key: string;
    subject: ManifestSubject;
  }> = [];
  const failures: string[] = [];
  let bytesWritten = 0;
  for (const { p, industry, images } of todo) {
    const processed: Array<{
      image: ShopifyImage;
      file: string;
      width: number;
      height: number;
      contentHash: string;
    }> = [];
    let ok = true;
    for (const image of images) {
      try {
        const res = await fetchWithRetry(sizedSrc(image.src));
        const buf = Buffer.from(await res.arrayBuffer());
        const file = fileNameFor(p.handle, image.id);
        const outPath = path.join(LIB_DIR, industry, file);
        const tmpPath = `${outPath}.tmp`;
        const info = await sharp(buf) // decode = integrity check
          .rotate()
          .resize({
            width: 2048,
            height: 2048,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 90 })
          .toFile(tmpPath);
        fs.renameSync(tmpPath, outPath);
        bytesWritten += info.size;
        const hash = `sha256:${createHash('sha256').update(fs.readFileSync(outPath)).digest('hex')}`;
        processed.push({
          image,
          file,
          width: info.width,
          height: info.height,
          contentHash: hash,
        });
      } catch (e) {
        ok = false;
        failures.push(
          `${p.handle}/${image.id}: ${e instanceof Error ? e.message : String(e)}`
        );
        break; // all-or-nothing per product (§6.4)
      }
    }
    if (!ok) continue;
    // delete de-referenced files from a previous ingest of this product (§6.5)
    const existing = findSubject(manifest, `ccw-${p.handle}`);
    for (const old of existing?.images ?? []) {
      if (!processed.some(x => x.file === old.file)) {
        const oldPath = path.join(LIB_DIR, industry, old.file);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }
    additions.push({
      industry,
      key: `ccw-${p.handle}`,
      subject: buildSubject(p, processed, today),
    });
    if (bytesWritten > SIZE_CAP_BYTES && !args.forceSize) {
      console.error(
        `runtime size cap hit after ${additions.length} products — aborting; written so far stays on disk as orphans until next run`
      );
      process.exitCode = 1;
      return; // manifest NOT written — orphan handling per §13
    }
  }
  writeManifestAtomic(mergeManifest(manifest, additions)); // written ONCE (§6.4)
  console.log(
    `ingested ${additions.length} products, ${(bytesWritten / 1024 / 1024).toFixed(1)} MB actual`
  );
  if (failures.length > 0) {
    console.error(
      `product failures (all-or-nothing skipped):\n  ${failures.join('\n  ')}`
    );
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 4:** `npm install --save-dev sharp@0.34.5 --legacy-peer-deps` (pin the already-resolving version; reason: script-time image processing; zero prod-bundle impact).
- [ ] **Step 5: Run** — CLI test file PASS; `npm run type-check` + `npm run lint` clean.
- [ ] **Step 6: Commit** — `feat(scripts): CCW catalogue ingest CLI (dry-run, verify, remove/retag, size guard)`

---

### Task 6: EXECUTE the ingestion (real data lands)

**Files:** `public/reference-library/**` (generated), `public/reference-library/README.md` (table refresh)

- [ ] **Step 1:** `npx tsx scripts/ingest-ccw-catalogue.ts --dry-run` → **paste the full report**. Sanity: ingestable 120–150 total; tile&grout ≈24 + aircon ≈6 in skippedTypes; unmapped = chemicals/meters/parts types (non-empty is fine, silent is not); estimate < 150 MB.
- [ ] **Step 2:** Human spot-check the `aspect-flagged` list; add clearly chart-like handles to `EXCLUDED_HANDLES` in the core module and re-run `--dry-run` if needed.
- [ ] **Step 3:** Real run: `npx tsx scripts/ingest-ccw-catalogue.ts` → expect exit 0 (or 2 with a short failures list — re-run once for transient CDN errors). `git status` must show ONLY `public/reference-library/**` (+ core module if Step 2 edited the denylist).
- [ ] **Step 4:** `npx tsx scripts/ingest-ccw-catalogue.ts --verify` → `verify OK`. Immediate re-run of the ingest → `ingested 0 products` and `git diff --stat` on `manifest.json` → empty (AC5).
- [ ] **Step 5:** Spot-open 3 images. Refresh the README industries table from the script's summary output.
- [ ] **Step 6: Commit** — `feat(reference-library): ingest CCW equipment catalogue (~135 products) with provenance` (this commit is large — images + manifest).

---

### Task 7: Full gate + acceptance

- [ ] **Step 1:** `npm run type-check && npm run lint && npm test` → paste the `Tests:` line; all green (the tool-registry contract tests are untouched — no new MCP tool).
- [ ] **Step 2:** Walk spec §12 AC1–AC7: AC1/AC3 from the pasted dry-run report; AC2 via a jq/grep over the manifest (every `ccw-` subject has provenance + enum rightsBasis + per-image imageId/imageSrc/contentHash); AC4 from Task 2 tests; AC5 from Task 6 Step 4; AC6 = the removal drill: `--remove-vendor <pick a small reseller>` → verify zero files/subjects for it → run the §8 video audit query shape against a dev DB or record it as documented → `git checkout` to restore; AC7 = post-deploy proof generation (founder-gated, after merge).
- [ ] **Step 3:** Commit any doc/notes deltas.

---

## Self-Review

**Spec coverage:** §5 mapping → Task 4 `TYPE_TO_INDUSTRY`/`SKIPPED_TYPES`; §6.1–6.13 → Task 5 CLI (+ core in Task 4); §7 resolver → Task 2; §8 lineage/audit → Tasks 3–4 (partition/remove/retag) + Task 7 drill; §9 tests → Tasks 1–5 test files incl. both at-risk migrations; §11 runbook → Tasks 6–7; §12 ACs → Task 7; §13 failure modes → Task 5 (retry, all-or-nothing, atomic manifest, runtime cap, orphans). No gaps found.

**Placeholder scan:** clean — every code step has complete code; commands have expected outputs.

**Type consistency:** `RightsBasis`/`SubjectProvenance` (Task 1) consumed by Task 4 imports; `ResolvedReferences.vendorKey/rightsBasis` (Task 2) consumed in Task 3; Task 5 imports match Task 4's export list verbatim; `parseArgs`/`formatReport` exported for the Task 5 tests. `needsIngest(existing, selected, fileExists)` signature identical in Tasks 4 and 5.
