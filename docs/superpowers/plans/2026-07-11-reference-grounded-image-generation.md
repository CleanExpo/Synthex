# Reference-Grounded Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Synthex image generation ground on the owned `public/reference-library/` photos (via FLUX.2 pro on fal) so equipment/marketing visuals match real CCW gear instead of looking synthetic.

**Architecture:** A resolver reads the reference-library manifest and returns owned-only image paths (explicit set or auto-detected from the prompt). A small data-driven image-model registry (mirroring `video/registry.ts`) selects a reference-capable model when references are present. A synchronous fal adapter calls FLUX.2 pro. `generateImage()` and the shared `generate_image` studio-tool are wired to use them, so MCP + REST + copilot all inherit grounded generation.

**Tech Stack:** TypeScript, Next.js (Node runtime), fal.ai HTTP API, Zod, Jest (`jest.worktree.cjs`).

**Spec:** `docs/superpowers/specs/2026-07-11-reference-grounded-image-generation-design.md`

## Global Constraints

- Package manager: **npm** (never pnpm). Full gate: `npm run type-check && npm run lint && npm test`.
- No `any` types; Australian English in product copy; error shape `{ error, details? }`.
- No DB migration, no schema change in this slice.
- Owned-only: references are injected ONLY for manifest subjects with `rights: "owned"`.
- New MCP tools stay `riskClass` `read` or `draft` (v1 invariant — publish/spend are rejected at load).
- fal auth header is `Authorization: Key ${FAL_API_KEY}` (verified: `lib/services/ai/video/fal-adapter.ts:38`).
- fal image endpoint is **synchronous** `https://fal.run/{modelId}` (NOT the video queue base `https://queue.fal.run`).
- Absolute reference URLs are built from `NEXT_PUBLIC_APP_URL` (verified used at `fal-adapter.ts:21`).

---

### Task 1: Reference resolver + manifest `rights` field

**Files:**
- Create: `lib/services/ai/reference-library.ts`
- Modify: `public/reference-library/manifest.json` (add `"rights": "owned"` to each populated subject)
- Test: `tests/unit/ai/reference-library.test.ts`

**Interfaces:**
- Consumes: `detectIndustry` from `@/lib/demo/industry-classifier` (verified signature: `detectIndustry(text: string): string`); the manifest JSON on disk.
- Produces:
  - `interface ReferenceSubjectSummary { key: string; label: string; count: number; rights: string }`
  - `interface ReferenceSetSummary { industry: string; label: string; subjects: ReferenceSubjectSummary[] }`
  - `function listReferenceSets(): ReferenceSetSummary[]`
  - `interface ResolvedReferences { industry: string | null; subject: string | null; imagePaths: string[]; count: number }`
  - `function resolveReferences(opts: { set?: string; prompt?: string; max?: number }): ResolvedReferences`
  - `imagePaths` are **site-relative** (`/reference-library/<industry>/<file>`). Task 4 converts to absolute.

- [ ] **Step 1: Add `rights` to the manifest subjects**

In `public/reference-library/manifest.json`, add `"rights": "owned"` as the first key inside each subject object under `industries.carpet-cleaning.subjects.carpet-cleaning-wand` and `industries.upholstery-cleaning.subjects.upholstery-hand-tool`. Example (carpet):

```json
"subjects": {
  "carpet-cleaning-wand": {
    "rights": "owned",
    "label": "Professional carpet cleaning wand (floor hot-water-extraction wand)",
```

Leave `water-damage-restoration` (empty `subjects: {}`) unchanged.

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/ai/reference-library.test.ts
import {
  listReferenceSets,
  resolveReferences,
} from '@/lib/services/ai/reference-library';

describe('reference-library resolver', () => {
  it('lists owned reference sets with counts', () => {
    const sets = listReferenceSets();
    const carpet = sets.find(s => s.industry === 'carpet-cleaning');
    expect(carpet).toBeDefined();
    const wand = carpet!.subjects.find(s => s.key === 'carpet-cleaning-wand');
    expect(wand!.count).toBe(18);
    expect(wand!.rights).toBe('owned');
  });

  it('resolves an explicit set to site-relative owned image paths', () => {
    const r = resolveReferences({ set: 'carpet-cleaning', max: 3 });
    expect(r.industry).toBe('carpet-cleaning');
    expect(r.imagePaths).toHaveLength(3);
    expect(r.imagePaths[0]).toBe(
      '/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });

  it('auto-detects the industry from a prompt via manifest keywords', () => {
    const r = resolveReferences({
      prompt: 'a technician using a carpet cleaning wand on office carpet',
      max: 2,
    });
    expect(r.industry).toBe('carpet-cleaning');
    expect(r.count).toBe(2);
  });

  it('returns nothing for an unrelated prompt (no false grounding)', () => {
    const r = resolveReferences({ prompt: 'a law firm office in Sydney' });
    expect(r.industry).toBeNull();
    expect(r.imagePaths).toEqual([]);
  });

  it('never returns references for a non-owned / unknown set (rights guard)', () => {
    const r = resolveReferences({ set: 'water-damage-restoration' });
    expect(r.imagePaths).toEqual([]);
    const r2 = resolveReferences({ set: 'does-not-exist' });
    expect(r2.imagePaths).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/unit/ai/reference-library.test.ts`
Expected: FAIL — cannot find module `@/lib/services/ai/reference-library`.

- [ ] **Step 4: Write the resolver**

```ts
// lib/services/ai/reference-library.ts
/**
 * Reference-library resolver — single source of truth over
 * public/reference-library/manifest.json. Returns OWNED-ONLY image paths for
 * grounding (creative-director REM-1 / CCW authority-manifest "no fake renders").
 * Returns site-relative paths; the caller resolves them to absolute URLs.
 */
import fs from 'fs';
import path from 'path';
import { detectIndustry } from '@/lib/demo/industry-classifier';

interface ManifestImage {
  file: string;
  width: number;
  height: number;
  source: string;
}
interface ManifestSubject {
  rights?: string;
  label: string;
  images?: ManifestImage[];
}
interface ManifestIndustry {
  label: string;
  keywords?: string[];
  subjects: Record<string, ManifestSubject>;
}
interface Manifest {
  version: number;
  industries: Record<string, ManifestIndustry>;
}

export interface ReferenceSubjectSummary {
  key: string;
  label: string;
  count: number;
  rights: string;
}
export interface ReferenceSetSummary {
  industry: string;
  label: string;
  subjects: ReferenceSubjectSummary[];
}
export interface ResolvedReferences {
  industry: string | null;
  subject: string | null;
  imagePaths: string[];
  count: number;
}

const MANIFEST_PATH = path.join(
  process.cwd(),
  'public/reference-library/manifest.json'
);

let cache: Manifest | null = null;
function loadManifest(): Manifest {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  } catch {
    cache = { version: 1, industries: {} };
  }
  return cache;
}

function ownedSubjects(
  industry: ManifestIndustry
): Array<[string, ManifestSubject]> {
  return Object.entries(industry.subjects).filter(
    ([, s]) => s.rights === 'owned' && (s.images?.length ?? 0) > 0
  );
}

export function listReferenceSets(): ReferenceSetSummary[] {
  const m = loadManifest();
  return Object.entries(m.industries).map(([industry, data]) => ({
    industry,
    label: data.label,
    subjects: Object.entries(data.subjects).map(([key, s]) => ({
      key,
      label: s.label,
      count: s.images?.length ?? 0,
      rights: s.rights ?? 'unknown',
    })),
  }));
}

/** Match a prompt to an industry key using the manifest's own keywords,
 *  gated by the coarse classifier so unrelated prompts never ground. */
function autoDetectIndustry(prompt: string, m: Manifest): string | null {
  const t = prompt.toLowerCase();
  // Gate: only attempt for cleaning/restoration prompts.
  if (detectIndustry(prompt) !== 'cleaning & restoration') return null;
  let best: { key: string; hits: number } | null = null;
  for (const [key, data] of Object.entries(m.industries)) {
    const hits = (data.keywords ?? []).filter(k =>
      t.includes(k.toLowerCase())
    ).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { key, hits };
  }
  return best?.key ?? null;
}

export function resolveReferences(opts: {
  set?: string;
  prompt?: string;
  max?: number;
}): ResolvedReferences {
  const empty: ResolvedReferences = {
    industry: null,
    subject: null,
    imagePaths: [],
    count: 0,
  };
  const m = loadManifest();
  const max = opts.max ?? 4;

  const industryKey =
    opts.set ??
    (opts.prompt ? autoDetectIndustry(opts.prompt, m) : null);
  if (!industryKey) return empty;

  const industry = m.industries[industryKey];
  if (!industry) return empty;

  const owned = ownedSubjects(industry);
  if (owned.length === 0) return empty; // rights guard: nothing owned here

  const [subjectKey, subject] = owned[0];
  const imagePaths = (subject.images ?? [])
    .slice(0, max)
    .map(img => `/reference-library/${industryKey}/${img.file}`);

  return {
    industry: industryKey,
    subject: subjectKey,
    imagePaths,
    count: imagePaths.length,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/ai/reference-library.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/services/ai/reference-library.ts tests/unit/ai/reference-library.test.ts public/reference-library/manifest.json
git commit -m "feat(ai): reference-library resolver with owned-only rights guard"
```

---

### Task 2: Image model registry

**Files:**
- Create: `lib/services/ai/image/registry.ts`
- Test: `tests/unit/ai/image-registry.test.ts`

**Interfaces:**
- Produces:
  - `interface ImageModel { id: string; provider: 'fal' | 'openai' | 'stability' | 'gemini'; label: string; tier: 'draft' | 'standard' | 'premium'; costPerMegapixelUsd?: number; capabilities: { referenceImages: number; imageToImage: boolean; maxResolution: number }; grounding: boolean; deprecated?: boolean }`
  - `const IMAGE_MODELS: ImageModel[]`
  - `function selectImageModel(opts: { needsReferences: boolean; preferred?: string }): ImageModel`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai/image-registry.test.ts
import {
  IMAGE_MODELS,
  selectImageModel,
} from '@/lib/services/ai/image/registry';

describe('image model registry', () => {
  it('includes a grounding-capable FLUX.2 pro entry on fal', () => {
    const flux = IMAGE_MODELS.find(m => m.id === 'fal-ai/flux-2-pro');
    expect(flux).toBeDefined();
    expect(flux!.provider).toBe('fal');
    expect(flux!.grounding).toBe(true);
    expect(flux!.capabilities.referenceImages).toBeGreaterThanOrEqual(1);
  });

  it('selects a grounding model when references are needed', () => {
    const m = selectImageModel({ needsReferences: true });
    expect(m.grounding).toBe(true);
    expect(m.deprecated).not.toBe(true);
    expect(m.id).toBe('fal-ai/flux-2-pro');
  });

  it('never selects a deprecated model for grounding', () => {
    const m = selectImageModel({ needsReferences: true, preferred: 'stability' });
    expect(m.grounding).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/ai/image-registry.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the registry**

```ts
// lib/services/ai/image/registry.ts
/**
 * Image model catalog — DATA. Mirrors lib/services/ai/video/registry.ts.
 * `grounding` marks reference-capable models; Stability/DALL-E are kept but
 * deprecated (they ignore references and are banned by the visual-content-brief
 * skill). Pricing verified 2026-07-11 (fal.ai / bfl.ai). Verify at deploy.
 */
export interface ImageModel {
  id: string;
  provider: 'fal' | 'openai' | 'stability' | 'gemini';
  label: string;
  tier: 'draft' | 'standard' | 'premium';
  costPerMegapixelUsd?: number;
  capabilities: {
    referenceImages: number; // max refs; 0 = text-only
    imageToImage: boolean;
    maxResolution: number; // px, long edge
  };
  grounding: boolean;
  deprecated?: boolean;
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'fal-ai/flux-2-pro',
    provider: 'fal',
    label: 'FLUX.2 pro',
    tier: 'standard',
    costPerMegapixelUsd: 0.03,
    capabilities: { referenceImages: 8, imageToImage: true, maxResolution: 4096 },
    grounding: true,
  },
  {
    id: 'gemini-2.5-flash-image',
    provider: 'gemini',
    label: 'Gemini 2.5 Flash Image',
    tier: 'draft',
    capabilities: { referenceImages: 0, imageToImage: false, maxResolution: 1792 },
    grounding: false,
  },
  {
    id: 'stable-diffusion-3',
    provider: 'stability',
    label: 'Stability SD3',
    tier: 'draft',
    capabilities: { referenceImages: 0, imageToImage: false, maxResolution: 1792 },
    grounding: false,
    deprecated: true,
  },
  {
    id: 'dall-e-3',
    provider: 'openai',
    label: 'DALL-E 3',
    tier: 'draft',
    capabilities: { referenceImages: 0, imageToImage: false, maxResolution: 1792 },
    grounding: false,
    deprecated: true,
  },
];

/** Pick a model. When references are needed, return the first grounding-capable,
 *  non-deprecated model (FLUX.2 pro today). Otherwise honour `preferred` or the
 *  first non-deprecated entry. */
export function selectImageModel(opts: {
  needsReferences: boolean;
  preferred?: string;
}): ImageModel {
  if (opts.needsReferences) {
    const grounded = IMAGE_MODELS.find(m => m.grounding && !m.deprecated);
    if (!grounded) throw new Error('no grounding-capable image model registered');
    return grounded;
  }
  if (opts.preferred) {
    const byId = IMAGE_MODELS.find(m => m.id === opts.preferred);
    if (byId) return byId;
  }
  const first = IMAGE_MODELS.find(m => !m.deprecated) ?? IMAGE_MODELS[0];
  return first;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/ai/image-registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/image/registry.ts tests/unit/ai/image-registry.test.ts
git commit -m "feat(ai): image model registry with grounding/deprecated flags"
```

---

### Task 3: FLUX.2 pro fal adapter (synchronous)

**Files:**
- Create: `lib/services/ai/image/providers/flux-fal.ts`
- Test: `tests/unit/ai/flux-fal.test.ts`

**Interfaces:**
- Consumes: `FAL_API_KEY` env; global `fetch`.
- Produces:
  - `interface FluxResult { imageUrl: string; seed?: number; model: string }`
  - `function generateFluxImage(opts: { prompt: string; imageUrls?: string[]; imageSize?: string; seed?: number }): Promise<FluxResult>`
  - Uses `https://fal.run/fal-ai/flux-2-pro/edit` when `imageUrls` non-empty (sends `image_urls`), else `https://fal.run/fal-ai/flux-2-pro`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai/flux-fal.test.ts
import { generateFluxImage } from '@/lib/services/ai/image/providers/flux-fal';

describe('flux-fal adapter', () => {
  const realFetch = global.fetch;
  const realKey = process.env.FAL_API_KEY;
  beforeEach(() => {
    process.env.FAL_API_KEY = 'test-key';
  });
  afterEach(() => {
    global.fetch = realFetch;
    process.env.FAL_API_KEY = realKey;
  });

  it('calls the /edit endpoint with image_urls when references are present', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    global.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return {
        ok: true,
        json: async () => ({ images: [{ url: 'https://out/img.png' }], seed: 42 }),
      } as Response;
    }) as unknown as typeof fetch;

    const r = await generateFluxImage({
      prompt: 'grounded wand',
      imageUrls: ['https://site/ref-1.webp'],
    });

    expect(calls[0].url).toBe('https://fal.run/fal-ai/flux-2-pro/edit');
    expect((calls[0].body as { image_urls: string[] }).image_urls).toEqual([
      'https://site/ref-1.webp',
    ]);
    expect(r.imageUrl).toBe('https://out/img.png');
    expect(r.seed).toBe(42);
  });

  it('calls the base endpoint (no image_urls) when there are no references', async () => {
    const calls: string[] = [];
    global.fetch = (async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => ({ images: [{ url: 'https://out/x.png' }] }) } as Response;
    }) as unknown as typeof fetch;

    await generateFluxImage({ prompt: 'plain' });
    expect(calls[0]).toBe('https://fal.run/fal-ai/flux-2-pro');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/ai/flux-fal.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the adapter**

```ts
// lib/services/ai/image/providers/flux-fal.ts
/**
 * FLUX.2 pro on fal — SYNCHRONOUS image generation/edit. Uses fal.run (not the
 * video queue base). Reference images are passed as `image_urls` to the /edit
 * endpoint. Auth matches the video adapter: `Authorization: Key ${FAL_API_KEY}`.
 * NOTE: fal fetches image_urls over the public internet — they must be absolute,
 * publicly reachable URLs (deployed host), not localhost.
 */
import { logger } from '@/lib/logger';

const FAL_RUN_BASE = 'https://fal.run';
const MODEL = 'fal-ai/flux-2-pro';

export interface FluxResult {
  imageUrl: string;
  seed?: number;
  model: string;
}

interface FalImagesResponse {
  images?: Array<{ url?: string }>;
  seed?: number;
}

export async function generateFluxImage(opts: {
  prompt: string;
  imageUrls?: string[];
  imageSize?: string;
  seed?: number;
}): Promise<FluxResult> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new Error('FAL_API_KEY not configured');

  const hasRefs = (opts.imageUrls?.length ?? 0) > 0;
  const url = hasRefs
    ? `${FAL_RUN_BASE}/${MODEL}/edit`
    : `${FAL_RUN_BASE}/${MODEL}`;

  const body: Record<string, unknown> = { prompt: opts.prompt };
  if (hasRefs) body.image_urls = opts.imageUrls;
  if (opts.imageSize) body.image_size = opts.imageSize;
  if (typeof opts.seed === 'number') body.seed = opts.seed;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('flux-fal generation failed', { status: res.status, text });
    throw new Error(`fal flux failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as FalImagesResponse;
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error('fal flux returned no image');
  return { imageUrl, seed: data.seed, model: MODEL };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/ai/flux-fal.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/image/providers/flux-fal.ts tests/unit/ai/flux-fal.test.ts
git commit -m "feat(ai): synchronous FLUX.2 pro fal adapter (reference-image edit)"
```

---

### Task 4: Wire grounding into `generateImage()`

**Files:**
- Modify: `lib/services/ai/image-generation.ts`
- Test: `tests/unit/ai/image-generation-grounding.test.ts`

**Interfaces:**
- Consumes: `resolveReferences` (Task 1), `selectImageModel` (Task 2), `generateFluxImage` (Task 3).
- Produces: extended `ImageGenerationOptions` with `referenceSet?: string; useReferences?: boolean; model?: string`; `ImageGenerationResult` gains `grounded?: boolean; referenceSet?: string; refCount?: number`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai/image-generation-grounding.test.ts
import { generateImage } from '@/lib/services/ai/image-generation';
import type { GenerationContext } from '@/lib/ai/generation-context';

jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  generateFluxImage: jest.fn(async (o: { imageUrls?: string[] }) => ({
    imageUrl: 'https://out/grounded.png',
    seed: 1,
    model: 'fal-ai/flux-2-pro',
    __refs: o.imageUrls,
  })),
}));

const ctx: GenerationContext = {
  organizationId: 'org1',
  userId: 'user1',
  traceId: 't1',
  autonomyLevel: 'manual',
};

describe('generateImage grounding', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it('grounds on the carpet-cleaning set via FLUX and tags metadata', async () => {
    const { generateFluxImage } = await import(
      '@/lib/services/ai/image/providers/flux-fal'
    );
    const r = await generateImage(
      { prompt: 'our carpet wand', referenceSet: 'carpet-cleaning' },
      ctx
    );
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.refCount).toBeGreaterThan(0);
    expect(r.metadata?.model).toBe('fal-ai/flux-2-pro');
    const arg = (generateFluxImage as jest.Mock).mock.calls[0][0];
    expect(arg.imageUrls[0]).toBe(
      'https://synthex.social/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });

  it('leaves the legacy path ungrounded when useReferences is false', async () => {
    const r = await generateImage(
      { prompt: 'our carpet wand', referenceSet: 'carpet-cleaning', useReferences: false, provider: 'gemini' },
      ctx
    ).catch(e => ({ success: false, grounded: false, error: String(e) }));
    expect((r as { grounded?: boolean }).grounded).not.toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/ai/image-generation-grounding.test.ts`
Expected: FAIL — `grounded`/`referenceSet` not on options/result; no FLUX routing.

- [ ] **Step 3: Extend the options + result types**

In `lib/services/ai/image-generation.ts`, add to `ImageGenerationOptions` (after `guidanceScale?`):

```ts
  /** Explicit reference set id (e.g. 'carpet-cleaning'). */
  referenceSet?: string;
  /** Default true — when refs resolve, ground via a reference-capable model. */
  useReferences?: boolean;
  /** Preferred image model id from the registry. */
  model?: string;
```

Add to `ImageGenerationResult` (after `error?`):

```ts
  grounded?: boolean;
  referenceSet?: string;
  refCount?: number;
```

- [ ] **Step 4: Add the grounding branch at the top of `generateImage()`**

In `generateImage()`, immediately AFTER `requireGenerationContext(ctx, 'generateImage');` and BEFORE the `getVisualStyleInsights` enrichment, insert:

```ts
  // Reference grounding (SYN reference-library). When owned references resolve,
  // route to a reference-capable model (FLUX.2 pro on fal) instead of the
  // text-only providers. Falls through to the legacy path on any miss/error.
  const useRefs = options.useReferences !== false;
  if (useRefs) {
    const { resolveReferences } = await import(
      '@/lib/services/ai/reference-library'
    );
    const refs = resolveReferences({
      set: options.referenceSet,
      prompt: options.prompt,
    });
    if (refs.count > 0) {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
      const imageUrls = refs.imagePaths.map(p => `${base}${p}`);
      try {
        const { selectImageModel } = await import(
          '@/lib/services/ai/image/registry'
        );
        const { generateFluxImage } = await import(
          '@/lib/services/ai/image/providers/flux-fal'
        );
        const model = selectImageModel({ needsReferences: true });
        const flux = await generateFluxImage({ prompt: options.prompt, imageUrls });
        return {
          success: true,
          provider: 'stability', // provider union unchanged; model is authoritative
          imageUrl: flux.imageUrl,
          grounded: true,
          referenceSet: refs.industry ?? undefined,
          refCount: refs.count,
          metadata: {
            seed: flux.seed,
            width: 0,
            height: 0,
            model: model.id,
          },
        };
      } catch (error: unknown) {
        logger.warn('reference grounding failed; falling back to text-only', {
          error: error instanceof Error ? error.message : String(error),
        });
        // fall through to the existing text-only path (grounded stays false)
      }
    }
  }
```

Note: `provider` stays within the existing `ImageProvider` union to avoid a wider type change this slice; `metadata.model` (`fal-ai/flux-2-pro`) is the authoritative model id. A dedicated `'fal'` provider is a later cleanup.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/ai/image-generation-grounding.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Type-check + commit**

Run: `npm run type-check`
Expected: no errors.

```bash
git add lib/services/ai/image-generation.ts tests/unit/ai/image-generation-grounding.test.ts
git commit -m "feat(ai): route generateImage to FLUX.2 grounding when owned refs resolve"
```

---

### Task 5: Studio-tools — `generate_image` args + `list_reference_sets`

**Files:**
- Modify: `lib/services/ai/studio-tools/index.ts`
- Test: `tests/unit/mcp/list-reference-sets.test.ts`

**Interfaces:**
- Consumes: `listReferenceSets` (Task 1); the extended `generateImage` (Task 4).
- Produces: `generate_image` accepts `referenceSet?`, `useReferences?`, `model?`; new tool `list_reference_sets` (scope `creative`, riskClass `read`, costClass `free`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/mcp/list-reference-sets.test.ts
import { executeStudioTool, ALL_MCP_TOOLS } from '@/lib/services/ai/studio-tools';

const ctx = { userId: 'u1', organizationId: 'o1', initiatedBy: 'studio' as const };

describe('list_reference_sets tool', () => {
  it('is registered as a read/free creative tool', () => {
    const t = ALL_MCP_TOOLS.find(x => x.name === 'list_reference_sets');
    expect(t).toBeDefined();
    expect(t!.scope).toBe('creative');
    expect(t!.riskClass).toBe('read');
  });

  it('returns the owned reference sets', async () => {
    const res = await executeStudioTool('list_reference_sets', {}, ctx);
    const sets = (res as { sets: Array<{ industry: string }> }).sets;
    expect(sets.some(s => s.industry === 'carpet-cleaning')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/mcp/list-reference-sets.test.ts`
Expected: FAIL — unknown tool `list_reference_sets`.

- [ ] **Step 3: Extend `GenerateImageArgs`**

In `lib/services/ai/studio-tools/index.ts`, add three optional fields inside the `GenerateImageArgs = z.object({ ... })` (after `platform`):

```ts
  referenceSet: z.string().min(1).optional(),
  useReferences: z.boolean().optional(),
  model: z.string().min(1).optional(),
```

- [ ] **Step 4: Thread them through the `generate_image` execute**

In the `generate_image` tool's `execute`, extend the `generateImage(...)` options object:

```ts
      const result = await generateImage(
        {
          prompt: a.prompt,
          style: a.style,
          aspectRatio: a.aspectRatio,
          platform: a.platform,
          referenceSet: a.referenceSet,
          useReferences: a.useReferences,
          model: a.model,
        },
        toGenerationContext(ctx)
      );
```

- [ ] **Step 5: Add the `list_reference_sets` tool**

Add this object to the `STUDIO_TOOLS` array (e.g. after `search_media_library`):

```ts
  {
    name: 'list_reference_sets',
    scope: 'creative',
    riskClass: 'read',
    costClass: 'free',
    description:
      'List the owned reference-image sets (industry, subjects, counts) available to ground image generation. Use to discover a referenceSet id for generate_image.',
    schema: z.object({}),
    execute: async () => {
      const { listReferenceSets } = await import(
        '@/lib/services/ai/reference-library'
      );
      return { sets: listReferenceSets() };
    },
  },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/unit/mcp/list-reference-sets.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/services/ai/studio-tools/index.ts tests/unit/mcp/list-reference-sets.test.ts
git commit -m "feat(mcp): generate_image reference args + list_reference_sets tool"
```

---

### Task 6: Full gate + spec acceptance check

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `npm run type-check && npm run lint && npm test`
Expected: type-check clean; lint 0 warnings; `Tests:` line shows all suites passing incl. the 5 new files. Paste the actual `Tests:` line.

- [ ] **Step 2: Verify acceptance criteria against the spec**

Confirm each spec §10 item is met by a test or is a manual live check:
- AC1 `list_reference_sets` → Task 5 test.
- AC2 grounded generate_image → Task 4 test (live FLUX call is a deploy-time check, see Step 3).
- AC3 auto-detect → Task 1 test.
- AC4 rights guard → Task 1 test.
- AC5 legacy path unchanged → Task 4 test.
- AC6 gate green → Step 1.

- [ ] **Step 3: Note the live-verification follow-up (do NOT fake it)**

The end-to-end FLUX call requires a **deployed** `NEXT_PUBLIC_APP_URL` (fal fetches the reference URLs over the public internet — spec §9). Record that the live check (`generate_image referenceSet:'carpet-cleaning'` → grounded image visibly resembling the real wand) must run against a preview/prod deploy, not local. If a data-URI fallback is wanted for local testing, open it as a follow-up task (out of scope here).

- [ ] **Step 4: Final commit (if any doc/notes changed)**

```bash
git add -A
git commit -m "chore(ai): reference-grounding slice — full gate green"
```

---

## Self-Review

**Spec coverage:** §4.1 registry → Task 2; §4.2 FLUX adapter → Task 3; §4.3 resolver + owned-only + rights field → Task 1; §4.4 wire-up + metadata → Task 4; §4.5 tool surface → Task 5; §6 governance (deprecated flags + owned-only) → Tasks 1–2; §7 error handling (fallback) → Task 4 Step 4 try/catch; §8 tests → each task's tests + Task 6; §9 risk (public-URL fetch) → Task 4 Step 4 note + Task 6 Step 3; §10 acceptance → Task 6 Step 2; §11 file list → Tasks 1–5. No gaps.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `resolveReferences` returns `imagePaths` (Task 1) consumed in Task 4 Step 4 as `refs.imagePaths`; `generateFluxImage({ prompt, imageUrls })` (Task 3) called with `imageUrls` in Task 4; `selectImageModel({ needsReferences })` (Task 2) called in Task 4; `listReferenceSets()` (Task 1) called in Task 5. Names align across tasks.
