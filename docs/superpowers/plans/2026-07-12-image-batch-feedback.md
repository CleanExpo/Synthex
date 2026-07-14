# AI Images 3-Variant Batches + Preference Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard generates 3 parallel image variants per click; founder ranks/rejects them; every variant + verdict persists org-scoped with full lineage; an insights panel surfaces what wins. Plus: fix the gallery-clipping layout bug and the grounded-images-never-saved gap.

**Architecture:** Additive slice on `feat/image-batch-feedback` (off `origin/main` @ 854184415). New pure cores (`generateBatch`, feedback validator, insights aggregator, `fetchImageAsBase64`) + a new Prisma model `ImageGeneration` written ONLY via Prisma client; the existing POST route grows an optional `variants` param (back-compatible); a new feedback route (PATCH verdict transaction + GET insights); dashboard UI gains batch cards with tap-to-rank.

**Tech Stack:** Next.js 16 App Router · TypeScript 5 · Prisma 6 · Supabase (RLS) · Zod · Jest (`jest.worktree.cjs`) · Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-12-image-batch-feedback-design.md` (v2 — 17 panel findings folded). Read it before starting any task.

## Global Constraints

- Base branch `feat/image-batch-feedback`; commits `type(scope): description`.
- Australian English in ALL user-facing copy (colour, organise; "Couldn't save — tap to retry").
- Zod validation on all POST/PATCH bodies; error shape `{ error, details? }`.
- No new npm packages. No mock/stub data in product surfaces.
- `image_generations` reads/writes ONLY via Prisma client (`@default(cuid())`/`@updatedAt` are client-side). `media_assets` stays on the route's existing Supabase service-role client.
- Migration is authored in-repo, applied to prod OUT OF BAND via Supabase `apply_migration` AFTER merge — never `prisma db push`, never at build time.
- Org resolution: `getEffectiveOrganizationId(userId)` from `lib/multi-business/business-scope.ts` (returns `string | null`). Ownership scope everywhere: `row.userId === userId OR (effectiveOrg !== null AND row.organizationId === effectiveOrg)`; when `effectiveOrg` is null scope by `userId` only — NEVER filter `organizationId: null`.
- Existing single-image POST behaviour must remain byte-identical when `variants` is absent.
- Gate before PR: `npm run type-check && npm run lint && npm test` — paste real tallies.

## File map

| File                                                                | Task | Action                                           |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `app/dashboard/ai-images/page.tsx`                                  | 1, 9 | modify (layout classes; batch state wiring)      |
| `components/ai/image-preview-card.tsx`                              | 1    | modify (double-download fix)                     |
| `prisma/schema.prisma`                                              | 2    | modify (ImageGeneration model)                   |
| `supabase/migrations/20260712100000_image_generations_feedback.sql` | 2    | create                                           |
| `lib/services/ai/image-generation.ts`                               | 3    | modify (clampSeed + generateBatch)               |
| `lib/services/media/fetch-image-base64.ts`                          | 4    | create                                           |
| `app/api/media/generate/image/route.ts`                             | 5    | modify (variants, org, persistence, maxDuration) |
| `lib/services/ai/image-feedback-core.ts`                            | 6    | create (validator + aggregator, pure)            |
| `app/api/media/generate/image/feedback/route.ts`                    | 7    | create (PATCH + GET)                             |
| `app/api/media/assets/[id]/image/route.ts`                          | 8    | create (serve stored base64 as image)            |
| `hooks/use-image-generation.ts`                                     | 9    | modify (generateBatch + types)                   |
| `components/ai/image-generator.tsx`                                 | 9    | modify (onBatchGenerated)                        |
| `components/ai/batch-feedback-card.tsx`                             | 10   | create                                           |
| `components/ai/generation-insights.tsx`                             | 10   | create                                           |
| `tests/unit/ai/image-batch.test.ts`                                 | 3    | create                                           |
| `tests/unit/ai/fetch-image-base64.test.ts`                          | 4    | create                                           |
| `tests/unit/ai/image-feedback-core.test.ts`                         | 6    | create                                           |

Wave plan for subagent dispatch (disjoint files per wave): **W1** = Tasks 1, 2, 4, 6 in parallel · **W2** = Tasks 3, 8 in parallel · **W3** = Tasks 5, 7 in parallel · **W4** = Tasks 9+10 (one agent) · **W5** = Task 11 gate + review.

---

### Task 1: Gallery clipping fix + double-download fix

**Files:**

- Modify: `app/dashboard/ai-images/page.tsx:138,177,179,184`
- Modify: `components/ai/image-preview-card.tsx` (~:89-100 `handleDownload`)

No unit tests (pure Tailwind class + handler change; verified live in Task 12). Read both files first.

- [ ] **Step 1: Apply the four class edits** in `app/dashboard/ai-images/page.tsx` (exact current → new):

```
:138  "h-[calc(100vh-8rem)] flex flex-col"            → "flex flex-col lg:h-[calc(100vh-8rem)]"
:177  "flex-1 flex flex-col lg:flex-row overflow-hidden" → "flex-1 flex flex-col lg:flex-row lg:overflow-hidden"
:179  "...overflow-y-auto p-6 bg-white/[0.01]"         → "...lg:overflow-y-auto p-6 bg-white/[0.01]"
:184  "flex-1 overflow-y-auto p-6 bg-[#0a0a0a]"        → "lg:flex-1 lg:overflow-y-auto p-6 bg-[#0a0a0a]"
```

(Line numbers are from main @854184415 — locate by the quoted class strings, not blindly by number.)

- [ ] **Step 2: Fix the double download** in `components/ai/image-preview-card.tsx`. Current `handleDownload` performs an anchor download AND then calls `onDownload?.(image)` (the page's handler downloads again). Change to delegate-or-do:

```tsx
const handleDownload = () => {
  if (onDownload) {
    onDownload(image);
    return;
  }
  // no page-level handler: do the local anchor download exactly as before
  ...existing anchor logic unchanged...
};
```

- [ ] **Step 3: Type-check the touched files** — Run: `npm run type-check`. Expected: exit 0.
- [ ] **Step 4: Commit** — `git commit -m "fix(ai-images): un-clip gallery below lg + single download per click"`

---

### Task 2: ImageGeneration model + migration

**Files:**

- Modify: `prisma/schema.prisma` (append model near VideoGeneration ~:3337)
- Create: `supabase/migrations/20260712100000_image_generations_feedback.sql`

**Produces (later tasks rely on):** Prisma model `ImageGeneration`, client accessor `prisma.imageGeneration`.

- [ ] **Step 1: Add the model** to `prisma/schema.prisma` — copy VERBATIM from spec Part C (the `model ImageGeneration { ... }` block with nullable `organizationId String?`, `@@map("image_generations")`, three `@@index`es).

- [ ] **Step 2: Write the migration** — full file:

```sql
-- 20260712100000_image_generations_feedback.sql
-- Trial slice: per-variant image generation lineage + founder preference feedback.
-- Additive only. Applied out of band via Supabase apply_migration (SYN estate rule).

CREATE TABLE IF NOT EXISTS public.image_generations (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "organization_id" text,
  "user_id" text NOT NULL,
  "batch_group_id" text NOT NULL,
  "status" text NOT NULL,
  "provider" text NOT NULL,
  "model" text,
  "seed" integer,
  "input_prompt" text NOT NULL,
  "enhanced_prompt" text,
  "style" text,
  "aspect_ratio" text,
  "image_url" text,
  "media_asset_id" text,
  "grounded" boolean NOT NULL DEFAULT false,
  "reference_set" text,
  "ref_count" integer,
  "lora_id" text,
  "lora_applied" boolean NOT NULL DEFAULT false,
  "kept" boolean,
  "rank" integer,
  "feedback_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT image_generations_pkey PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS image_generations_organization_id_created_at_idx
  ON public.image_generations ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS image_generations_batch_group_id_idx
  ON public.image_generations ("batch_group_id");
CREATE INDEX IF NOT EXISTS image_generations_user_id_idx
  ON public.image_generations ("user_id");
-- Rank integrity across concurrent PATCHes (panel Major): one rank value per batch.
CREATE UNIQUE INDEX IF NOT EXISTS image_generations_batch_rank_key
  ON public.image_generations ("batch_group_id", "rank") WHERE "rank" IS NOT NULL;

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY image_generations_service_role_all ON public.image_generations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY image_generations_org_select ON public.image_generations
    FOR SELECT TO authenticated USING (public.is_team_member(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 3: Validate + regenerate client** — Run: `npx prisma validate && npx prisma generate`. Expected: both succeed.
- [ ] **Step 4: Commit** — `git commit -m "feat(db): image_generations lineage + feedback table (additive, RLS, rank-unique)"`

---

### Task 3: `generateBatch` service core

**Files:**

- Modify: `lib/services/ai/image-generation.ts` (append near `generateVariations` ~:759)
- Test: `tests/unit/ai/image-batch.test.ts`

**Interfaces — Produces:**

```ts
export function clampSeed(seed: number): number; // → [0, 2_147_480_000], floor'd
export const MAX_SEED = 2_147_480_000;
export async function generateBatch(
  options: ImageGenerationOptions,
  ctx: GenerationContext,
  count: number = 3,
  _generate: typeof generateImage = generateImage // injectable for tests
): Promise<ImageGenerationResult[]>;
```

- [ ] **Step 1: Write the failing tests** (`tests/unit/ai/image-batch.test.ts`):

```ts
import {
  clampSeed,
  generateBatch,
  MAX_SEED,
} from '@/lib/services/ai/image-generation';

const ctx = { userId: 'u1', clientId: null, autonomyLevel: 'manual' } as any;

describe('clampSeed', () => {
  it('passes through in-range ints and floors floats', () => {
    expect(clampSeed(42)).toBe(42);
    expect(clampSeed(42.9)).toBe(42);
  });
  it('clamps negatives to 0 and huge values to MAX_SEED', () => {
    expect(clampSeed(-5)).toBe(0);
    expect(clampSeed(9_999_999_999)).toBe(MAX_SEED);
  });
});

describe('generateBatch', () => {
  it('fans out count parallel calls with +1000 seed offsets', async () => {
    const seeds: number[] = [];
    const stub = jest.fn(async (o: any) => {
      seeds.push(o.seed);
      return {
        success: true,
        provider: 'stability',
        metadata: { seed: o.seed, width: 1, height: 1, model: 'm' },
      };
    });
    const out = await generateBatch(
      { prompt: 'p', seed: 100 } as any,
      ctx,
      3,
      stub as any
    );
    expect(out).toHaveLength(3);
    expect(seeds).toEqual([100, 1100, 2100]);
  });
  it('maps a rejected settlement to a failed result and keeps the batch alive', async () => {
    let i = 0;
    const stub = jest.fn(async () => {
      if (i++ === 1) throw new Error('provider exploded');
      return { success: true, provider: 'stability' };
    });
    const out = await generateBatch(
      { prompt: 'p', seed: 1 } as any,
      ctx,
      3,
      stub as any
    );
    expect(out.filter(r => r.success)).toHaveLength(2);
    expect(out[1]).toMatchObject({
      success: false,
      error: expect.stringContaining('provider exploded'),
    });
  });
  it('clamps an out-of-range base seed before offsetting', async () => {
    const seeds: number[] = [];
    const stub = jest.fn(async (o: any) => {
      seeds.push(o.seed);
      return { success: true, provider: 'x' };
    });
    await generateBatch(
      { prompt: 'p', seed: MAX_SEED + 999 } as any,
      ctx,
      2,
      stub as any
    );
    expect(seeds).toEqual([MAX_SEED, MAX_SEED + 1000]); // base clamped; offsets stay < 2^31-1
  });
  it('throws without a GenerationContext', async () => {
    await expect(
      generateBatch({ prompt: 'p' } as any, undefined as any)
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- tests/unit/ai/image-batch.test.ts`. Expected: FAIL (exports missing).
- [ ] **Step 3: Implement** in `lib/services/ai/image-generation.ts`:

```ts
export const MAX_SEED = 2_147_480_000; // Int column headroom for +2000 batch offset

export function clampSeed(seed: number): number {
  return Math.min(Math.max(Math.floor(seed), 0), MAX_SEED);
}

/**
 * Parallel N-variant fan-out (trial slice, spec 2026-07-12). Unlike
 * generateVariations (sequential, 500ms delays, legacy consumers), this runs
 * the calls concurrently and never throws on a single-variant failure — a
 * batch succeeds if any variant does.
 */
export async function generateBatch(
  options: ImageGenerationOptions,
  ctx: GenerationContext,
  count: number = 3,
  _generate: typeof generateImage = generateImage
): Promise<ImageGenerationResult[]> {
  requireGenerationContext(ctx, 'generateBatch');
  const baseSeed = clampSeed(
    options.seed ?? Math.floor(Math.random() * 1_000_000)
  );
  const settled = await Promise.allSettled(
    Array.from({ length: count }, (_, i) =>
      _generate({ ...options, seed: baseSeed + i * 1000 }, ctx)
    )
  );
  return settled.map(s =>
    s.status === 'fulfilled'
      ? s.value
      : {
          success: false,
          provider: (options.provider ??
            'unknown') as ImageGenerationResult['provider'],
          error:
            s.reason instanceof Error ? s.reason.message : String(s.reason),
        }
  );
}
```

(Match the file's existing types — read `ImageGenerationResult`'s provider type and adjust the cast to compile cleanly without `any`.)

- [ ] **Step 4: Run tests** — Expected: PASS, 6 tests.
- [ ] **Step 5: Commit** — `git commit -m "feat(ai): generateBatch — parallel seed-offset variant fan-out"`

---

### Task 4: `fetchImageAsBase64` helper (SSRF-guarded)

**Files:**

- Create: `lib/services/media/fetch-image-base64.ts`
- Test: `tests/unit/ai/fetch-image-base64.test.ts`

**Interfaces — Produces:**

```ts
export const ALLOWED_IMAGE_HOSTS: readonly string[]; // exact hosts + '.fal.media' suffix rule
export function isAllowedImageHost(url: string): boolean;
export async function fetchImageAsBase64(
  url: string,
  opts?: { timeoutMs?: number; maxBytes?: number }
): Promise<
  | { ok: true; base64: string; contentType: string }
  | { ok: false; reason: string }
>;
```

- [ ] **Step 1: Failing tests** (`tests/unit/ai/fetch-image-base64.test.ts`) — mock `global.fetch`; also mock `@/lib/security/validate-url`'s `assertExternalUrlSafe` to resolve (its DNS checks don't run in Jest):

```ts
jest.mock('@/lib/security/validate-url', () => ({
  assertExternalUrlSafe: jest.fn(async () => undefined),
}));
import {
  fetchImageAsBase64,
  isAllowedImageHost,
} from '@/lib/services/media/fetch-image-base64';

describe('isAllowedImageHost', () => {
  it.each([
    'https://v3b.fal.media/x.png',
    'https://fal.media/a.jpg',
    'https://fal.run/f/x',
  ])('allows %s', u => expect(isAllowedImageHost(u)).toBe(true));
  it.each([
    'https://evil.com/x.png',
    'https://notfal.media.evil.com/x',
    'http://fal.media/x',
    'https://xfal.media/x',
  ])('rejects %s', u => expect(isAllowedImageHost(u)).toBe(false));
});

describe('fetchImageAsBase64', () => {
  afterEach(() => jest.restoreAllMocks());
  const okResponse = (bytes: number, type = 'image/png') => ({
    ok: true,
    headers: new Headers({
      'content-type': type,
      'content-length': String(bytes),
    }),
    arrayBuffer: async () => new ArrayBuffer(bytes),
  });
  it('returns base64 for an allowed image', async () => {
    global.fetch = jest.fn(async () => okResponse(8)) as any;
    const r = await fetchImageAsBase64('https://v3b.fal.media/x.png');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.base64).toBe(Buffer.alloc(8).toString('base64'));
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toMatchObject({
      redirect: 'error',
    });
  });
  it('refuses disallowed hosts without fetching', async () => {
    global.fetch = jest.fn() as any;
    const r = await fetchImageAsBase64('https://evil.com/x.png');
    expect(r).toEqual({ ok: false, reason: expect.stringContaining('host') });
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('rejects non-image content-type', async () => {
    global.fetch = jest.fn(async () => okResponse(8, 'text/html')) as any;
    const r = await fetchImageAsBase64('https://fal.media/x');
    expect(r.ok).toBe(false);
  });
  it('rejects oversize by content-length and by streamed size', async () => {
    global.fetch = jest.fn(async () => okResponse(20 * 1024 * 1024)) as any;
    expect((await fetchImageAsBase64('https://fal.media/x')).ok).toBe(false);
    global.fetch = jest.fn(async () => ({
      ...okResponse(100),
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => new ArrayBuffer(20 * 1024 * 1024),
    })) as any;
    expect((await fetchImageAsBase64('https://fal.media/x')).ok).toBe(false);
  });
  it('maps fetch throw (timeout/redirect) to ok:false, never throws', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('redirect blocked');
    }) as any;
    await expect(
      fetchImageAsBase64('https://fal.media/x')
    ).resolves.toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: Verify failure** — module not found.
- [ ] **Step 3: Implement** (complete file):

```ts
import { assertExternalUrlSafe } from '@/lib/security/validate-url';

export const ALLOWED_IMAGE_HOSTS = ['fal.media', 'fal.run'] as const;
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

export function isAllowedImageHost(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return ALLOWED_IMAGE_HOSTS.some(
    h => u.hostname === h || u.hostname.endsWith(`.${h}`)
  );
}

/**
 * SSRF-guarded provider-image download for library persistence (spec Part B).
 * Never throws — all failures are { ok: false, reason } so callers stay
 * non-fatal (the generation row keeps its imageUrl).
 */
export async function fetchImageAsBase64(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<
  | { ok: true; base64: string; contentType: string }
  | { ok: false; reason: string }
> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  try {
    if (!isAllowedImageHost(url))
      return { ok: false, reason: `host not in image allowlist: ${url}` };
    await assertExternalUrlSafe(url);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    try {
      const res = await fetch(url, {
        redirect: 'error',
        signal: controller.signal,
      });
      if (!res.ok)
        return { ok: false, reason: `fetch failed: HTTP ${res.status}` };
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/'))
        return { ok: false, reason: `not an image: ${contentType}` };
      const declared = Number(res.headers.get('content-length') ?? '0');
      if (declared > maxBytes)
        return { ok: false, reason: `content-length ${declared} exceeds cap` };
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBytes)
        return { ok: false, reason: `body ${buf.byteLength} exceeds cap` };
      return {
        ok: true,
        base64: Buffer.from(buf).toString('base64'),
        contentType,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Run tests** — PASS (9 tests).
- [ ] **Step 5: Commit** — `git commit -m "feat(media): SSRF-guarded provider-image fetch for library persistence"`

---

### Task 5: Route POST extension (variants + org + persistence)

**Files:**

- Modify: `app/api/media/generate/image/route.ts`

**Interfaces — Consumes:** `generateBatch`, `clampSeed`, `MAX_SEED` (Task 3); `fetchImageAsBase64` (Task 4); `prisma.imageGeneration` (Task 2); `getEffectiveOrganizationId` from `@/lib/multi-business/business-scope`.
**Produces:** batch response shape (spec Part B, verbatim) consumed by Task 9.

Read the whole route first. Then:

- [ ] **Step 1: Add** `export const maxDuration = 120;` at module top (after imports).
- [ ] **Step 2: Schema changes** in `ImageGenerationSchema`: `seed: z.number().int().min(0).max(2_147_480_000).optional()` (replaces unbounded) and add `variants: z.number().int().min(1).max(3).optional()`.
- [ ] **Step 3: Library-save helper refactor.** Extract the existing media_assets insert block (route.ts ~:244-266) into a local `async function saveVariantToLibrary(...)` that (a) uses `result.imageBase64` when present, (b) else when `result.imageUrl` calls `fetchImageAsBase64(result.imageUrl)` and on `ok` inserts with `base64_data: r.base64`, on `!ok` logs `logger.warn('media save skipped', { reason })` and returns undefined (row keeps imageUrl). Single path reuses it so the grounded-gap fix applies to `variants` absent too. Keep the existing insert columns byte-identical otherwise.
- [ ] **Step 4: Batch branch.** After `validated = ImageGenerationSchema.parse(...)` and option-building, when `(validated.variants ?? 1) > 1`:

```ts
const results = await generateBatch(
  options,
  mediaGenerationContext(userId),
  validated.variants
);
const effectiveOrg = await getEffectiveOrganizationId(userId); // string | null
const batchGroupId = crypto.randomUUID();

// (1) lineage FIRST — survives any later save/timeout trouble
const rows = await prisma.$transaction(
  results.map((r, i) =>
    prisma.imageGeneration.create({
      data: {
        organizationId: effectiveOrg,
        userId,
        batchGroupId,
        status: r.success ? 'completed' : 'failed',
        provider: r.provider ?? 'unknown',
        model: r.metadata?.model,
        seed:
          r.metadata?.seed ??
          (typeof options.seed === 'number'
            ? clampSeed(options.seed) + i * 1000
            : null),
        inputPrompt: validated.prompt,
        enhancedPrompt:
          options.prompt !== validated.prompt ? options.prompt : null,
        style: validated.style ?? null,
        aspectRatio: validated.aspectRatio ?? null,
        imageUrl: r.imageUrl ?? null,
        grounded: r.grounded ?? false,
        referenceSet: r.referenceSet ?? null,
        refCount: r.refCount ?? null,
        loraId: null,
        loraApplied: false,
        metadata: r.metadata ? (r.metadata as object) : undefined,
        ...(r.success ? {} : { metadata: { error: r.error } }),
      },
    })
  )
);

// (2) library saves in parallel, non-fatal per variant
const assetIds = await Promise.allSettled(
  results.map(r =>
    r.success && validated.saveToLibrary
      ? saveVariantToLibrary(r, userId, validated)
      : Promise.resolve(undefined)
  )
);
await Promise.allSettled(
  rows.map((row, i) => {
    const a = assetIds[i];
    const id = a.status === 'fulfilled' ? a.value : undefined;
    return id
      ? prisma.imageGeneration.update({
          where: { id: row.id },
          data: { mediaAssetId: id },
        })
      : Promise.resolve(null);
  })
);

// (3) respond — NO imageBase64 (Vercel 4.5MB limit, spec Part B)
const anySuccess = results.some(r => r.success);
if (!anySuccess) {
  return NextResponse.json(
    {
      error: results[0]?.error ?? 'Image generation failed',
      provider: results[0]?.provider,
    },
    { status: 500 }
  );
}
return NextResponse.json({
  success: true,
  batchGroupId,
  images: results.map((r, i) => ({
    generationId: rows[i].id,
    success: r.success,
    provider: r.provider,
    imageUrl: r.imageUrl,
    mediaAssetId:
      assetIds[i].status === 'fulfilled'
        ? (assetIds[i] as PromiseFulfilledResult<string | undefined>).value
        : undefined,
    metadata: r.metadata,
    grounded: r.grounded,
    referenceSet: r.referenceSet,
    refCount: r.refCount,
    error: r.error,
  })),
});
```

Adapt names to the file's actual locals (`userId`, `mediaGenerationContext`, logger, prisma import — check whether the repo idiom is `import { prisma } from '@/lib/prisma'` or default import; match `lib/prisma.ts` exports). The single-image path must remain untouched apart from using `saveVariantToLibrary`.

- [ ] **Step 5: Gate the touched area** — `npm run type-check && npm test -- tests/unit/ai/image-batch.test.ts tests/unit/ai/fetch-image-base64.test.ts`. PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat(api): 3-variant batch generation — parallel fan-out, lineage rows, library persistence for URL results"`

---

### Task 6: Feedback validator + insights aggregator (pure core)

**Files:**

- Create: `lib/services/ai/image-feedback-core.ts`
- Test: `tests/unit/ai/image-feedback-core.test.ts`

**Interfaces — Produces:**

```ts
export interface Verdict {
  generationId: string;
  kept: boolean;
  rank?: number;
}
export interface BatchRowLite {
  id: string;
  status: string;
}
export function validateVerdicts(
  verdicts: Verdict[],
  batchRows: BatchRowLite[]
): { ok: true } | { ok: false; error: string };
export interface FeedbackRowLite {
  batchGroupId: string;
  status: string;
  kept: boolean | null;
  rank: number | null;
  grounded: boolean;
  style: string | null;
  referenceSet: string | null;
  provider: string;
}
export const MIN_SAMPLE_FOR_RATES = 5;
export function aggregateInsights(rows: FeedbackRowLite[]): {
  totalBatchesRanked: number;
  totalKept: number;
  totalRejected: number;
  sampleSize: number;
  groundedWinRate: number | null;
  styleWinRates: Array<{ style: string; rank1Count: number }>;
  topReferenceSets: Array<{ referenceSet: string; keptCount: number }>;
  providerAvgRank: Array<{ provider: string; avgRank: number; n: number }>;
};
```

- [ ] **Step 1: Failing tests** — cover EXACTLY these cases (write each as a real `it` with real fixtures):
  - validateVerdicts: rank without kept:true → error; duplicate generationIds → error; duplicate ranks → error; ranks {2,3} (non-contiguous) → error; ranks {1} and {1,2} → ok (subset saves); verdict referencing an id not in batchRows → error; verdict referencing a `status:'failed'` row → error; empty verdicts → error.
  - aggregateInsights: empty rows → all zeros, rates null; failed rows present → excluded from every number; 2 ranked batches (sampleSize < 5) → counts present, `groundedWinRate === null`; ≥5 ranked batches with grounded rank-1s → correct rate (e.g. 3 of 5 → 0.6); all-rejected batch counts in totalRejected and totalBatchesRanked; providerAvgRank averages only ranked rows and carries `n`.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement.** Pure functions, no imports beyond types. Notes: a "ranked batch" = distinct batchGroupId with ≥1 non-null kept; `totalKept`/`totalRejected` count rows with kept true/false; groundedWinRate = grounded rank-1 rows ÷ all rank-1 rows (null when sampleSize < MIN_SAMPLE_FOR_RATES); styleWinRates/topReferenceSets skip null keys; sort outputs desc by their count for stable UI.
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(ai): feedback verdict validator + insights aggregator (pure core)"`

---

### Task 7: Feedback route (PATCH + GET)

**Files:**

- Create: `app/api/media/generate/image/feedback/route.ts`

**Interfaces — Consumes:** Task 6 core; `prisma.imageGeneration`; `getEffectiveOrganizationId`; `withRateLimit` from `@/lib/rate-limit/rate-limiter`; the same `APISecurityChecker`/`DEFAULT_POLICIES.AUTHENTICATED_WRITE` idiom as the generate route (copy its auth prologue exactly).

- [ ] **Step 1: Implement PATCH** (structure; error shape `{ error, details? }` throughout):

```ts
const FeedbackSchema = z.object({
  batchGroupId: z.string().min(1),
  verdicts: z
    .array(
      z.object({
        generationId: z.string().min(1),
        kept: z.boolean(),
        rank: z.number().int().min(1).max(3).optional(),
      })
    )
    .min(1)
    .max(3),
  noneGoodReason: z.string().max(500).optional(), // optional "What was wrong?" → metadata
});

// after auth + zod parse:
const effectiveOrg = await getEffectiveOrganizationId(userId);
const rows = await prisma.imageGeneration.findMany({ where: { batchGroupId } });
if (rows.length === 0)
  return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
const owned = rows.every(
  r =>
    r.userId === userId ||
    (effectiveOrg !== null && r.organizationId === effectiveOrg)
);
if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
const check = validateVerdicts(
  verdicts,
  rows.map(r => ({ id: r.id, status: r.status }))
);
if (!check.ok)
  return NextResponse.json(
    { error: 'Validation error', details: check.error },
    { status: 400 }
  );

await prisma.$transaction(async tx => {
  // idempotent whole-batch replace: clear ranks first so re-ranking can never
  // trip the partial unique index or leave two rank-1 rows
  await tx.imageGeneration.updateMany({
    where: { batchGroupId },
    data: { rank: null },
  });
  for (const v of verdicts) {
    await tx.imageGeneration.update({
      where: { id: v.generationId },
      data: {
        kept: v.kept,
        rank: v.rank ?? null,
        feedbackAt: new Date(),
        ...(noneGoodReason
          ? {
              metadata: {
                ...((rows.find(r => r.id === v.generationId)
                  ?.metadata as object) ?? {}),
                noneGoodReason,
              },
            }
          : {}),
      },
    });
  }
});
return NextResponse.json({ success: true, updated: verdicts.length });
```

Wrap PATCH with `withRateLimit` exactly as the generate route wraps POST.

- [ ] **Step 2: Implement GET** — same auth + org resolution; `prisma.imageGeneration.findMany({ where: { AND: [{ feedbackAt: { not: null } }, { status: 'completed' }, effectiveOrg !== null ? { OR: [{ userId }, { organizationId: effectiveOrg }] } : { userId }] }, orderBy: { createdAt: 'desc' }, take: 500 })` → `aggregateInsights(rows)` → `NextResponse.json(insights)`.
- [ ] **Step 3: Gate** — `npm run type-check && npm test -- tests/unit/ai/image-feedback-core.test.ts`. PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat(api): batch feedback PATCH (idempotent replace) + org-scoped insights GET"`

---

### Task 8: Media-asset image serving route

**Files:**

- Create: `app/api/media/assets/[id]/image/route.ts`

Purpose: batch responses carry no base64, so base64-provider variants render via this path. `[VERIFIED]` no existing route serves `media_assets.base64_data` as an image (grep `base64_data` in `app/api` → only generate routes).

- [ ] **Step 1: Implement GET.** Auth idiom copied from the generate route (AUTHENTICATED read policy — use the estate's closest read policy, check `DEFAULT_POLICIES`). Fetch the row via the same Supabase service-role client pattern the generate route uses: select `user_id, base64_data, type` from `media_assets` where `id = params.id`. 404 when missing or `!base64_data`; 403 when `row.user_id !== userId` (media_assets is user-scoped today — #433 ledger). Return:

```ts
return new NextResponse(Buffer.from(row.base64_data, 'base64'), {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'private, max-age=3600',
  },
});
```

- [ ] **Step 2: Gate** — `npm run type-check`. PASS.
- [ ] **Step 3: Commit** — `git commit -m "feat(api): serve stored media-asset images (batch card rendering path)"`

---

### Task 9: Hook + generator + page wiring

**Files:**

- Modify: `hooks/use-image-generation.ts`
- Modify: `components/ai/image-generator.tsx`
- Modify: `app/dashboard/ai-images/page.tsx`

**Interfaces — Produces (Task 10 relies on):**

```ts
// hooks/use-image-generation.ts
export interface BatchImage extends ImageResult {
  generationId: string;
  mediaAssetId?: string;
}
export interface BatchResult {
  batchGroupId: string;
  images: BatchImage[];
}
// hook returns { ..., generateBatch: (options: ImageGenerationOptions) => Promise<BatchResult | null> }
export function mediaAssetImageSrc(mediaAssetId: string): string; // `/api/media/assets/${id}/image`
```

- [ ] **Step 1: Hook** — add `generateBatch` mirroring the existing `generate` (same endpoint, body + `variants: 3`, same error handling); parse the batch shape; export `mediaAssetImageSrc`.
- [ ] **Step 2: Generator component** — add prop `onBatchGenerated?: (batch: BatchResult) => void`. In the submit handler: when the prop is provided call `const batch = await generateBatch(options)` and `if (batch && batch.images.some((i) => i.success)) onBatchGenerated(batch)`; otherwise keep the existing single `generate()` path untouched (other consumers unaffected). Loading/error states reuse the existing ones.
- [ ] **Step 3: Page** — new state `const [batches, setBatches] = useState<BatchResult[]>([])`; pass `onBatchGenerated={(b) => setBatches((prev) => [b, ...prev])}`; render (Task 10's components) `<GenerationInsights />` once above the gallery and a `<BatchFeedbackCard batch={...} />` list (newest first) in place of the single-image prepend flow for new generations. Keep `generatedImages` rendering for anything already in that state (unchanged history behaviour).
- [ ] **Step 4: Gate** — `npm run type-check`. PASS (Task 10 components may be stubbed as minimal placeholders ONLY if Tasks 9/10 are executed by the same agent in one commit — otherwise sequence Task 10 first).
- [ ] **Step 5: Commit** — `git commit -m "feat(ai-images): batch generation wiring — hook, generator prop, page state"`

---

### Task 10: Batch feedback card + insights panel

**Files:**

- Create: `components/ai/batch-feedback-card.tsx`
- Create: `components/ai/generation-insights.tsx`

**Interfaces — Consumes:** `BatchResult`, `BatchImage`, `mediaAssetImageSrc` (Task 9); PATCH/GET `/api/media/generate/image/feedback` (Task 7 shapes).

- [ ] **Step 1: `BatchFeedbackCard`.** Props `{ batch: BatchResult }`. Local state: `verdictMap: Record<generationId, { state: 'ranked' | 'rejected'; rank?: number }>`, `saving`, `saved`, `saveError`. Behaviour (all from spec Part E — implement every rule):
  - Responsive grid `grid grid-cols-1 sm:grid-cols-3 gap-3`; image = `imageUrl ?? (mediaAssetId ? mediaAssetImageSrc(mediaAssetId) : undefined)`; failed variants render the existing error-card style and take no verdicts.
  - Tap an unranked image → next free rank (1, then 2, then 3). Tap a ranked image → clear its rank and renumber remaining ranks contiguously (preserve order). ✖ button (always visible, `min-h-[44px] min-w-[44px]`) toggles rejected. Ranking a rejected image un-rejects it.
  - "None are good" → all successful variants rejected + reveals a dismissible one-line input "What was wrong? (optional)" whose value goes into the save payload as `noneGoodReason`.
  - "Save feedback" button: enabled when ≥1 successful variant has a state; label "Save feedback"; while saving disable all taps; on 200 show "Saved — Synthex is learning" (card stays editable, re-save allowed); on failure keep state editable and show "Couldn't save — tap to retry" on the button.
  - PATCH body: `{ batchGroupId, verdicts: [{ generationId, kept: state !== 'rejected', rank }], noneGoodReason? }` — ranked ⇒ kept:true; rejected ⇒ kept:false, no rank; unstated successful variants are OMITTED (subset save).
- [ ] **Step 2: `GenerationInsights`.** On mount + after every successful save (listen via a `refreshKey` prop or a tiny event callback passed from the page), `fetch('/api/media/generate/image/feedback')`; hide entirely when `totalBatchesRanked < 1`; render raw counts row (batches ranked / kept / rejected) always; render rate stats only when non-null, each tagged "n=`sampleSize`"; below threshold show muted "Early data — keep ranking and Synthex learns what you like." Plain fetch, no SWR (org-scoped SWR keying is unavailable client-side — deviation from spec's useApiSWR, recorded in the ledger; no cross-brand cache risk this way).
- [ ] **Step 3: Gate** — `npm run type-check && npm run lint`. PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat(ai-images): tap-to-rank batch card + learning insights panel"`

---

### Task 11: Full gate + branch review

- [ ] **Step 1:** `npm run type-check && npm run lint && npm test` — paste the full `Tests: X passed` line. Fix anything red (no suppressions).
- [ ] **Step 2:** `npx prisma validate` — clean.
- [ ] **Step 3:** Whole-branch review vs the spec (orchestrator or review subagent): every spec Part A-E requirement present; back-compat: `git diff origin/main -- app/api/media/generate/image/route.ts` shows the single path only refactored into `saveVariantToLibrary` (same columns, same response keys).
- [ ] **Step 4:** Commit any review fixes; update `.superpowers/sdd/progress-batch-feedback.md` ledger.

### Task 12: Ship + prod verification (orchestrator-owned, human gates apply)

- [ ] Push branch, open PR (estate rule: opening = auto-merge → prod deploy; founder push/PR confirmation applies).
- [ ] After merge + Vercel Ready: apply `20260712100000_image_generations_feedback.sql` to prod via Supabase MCP `apply_migration` (project znyjoyjsvjotlzjppzal) — BEFORE any live feedback test.
- [ ] Live checklist (spec Verification): 1016px window scroll; grounded batch of 3 (single POST < 4.5MB); non-grounded batch renders via `/api/media/assets/[id]/image`; rank 2 + reject 1 → PATCH 200 → rows show kept/rank/feedbackAt; re-rank → still exactly one rank-1; insights panel shows counts (rates suppressed < n=5); grounded variants carry `mediaAssetId`.

## Self-review notes (done at authoring)

- Spec coverage: Parts A-E all mapped (A→T1, B→T3/T4/T5, C→T2, D→T6/T7, E→T8/T9/T10); verification→T11/T12. Insights SWR deviation documented in T10.
- Type consistency: `BatchResult`/`BatchImage` defined once (T9), consumed in T10; `Verdict`/`FeedbackRowLite` defined in T6, consumed in T7; `fetchImageAsBase64` result union consistent T4→T5.
- No placeholders; all code blocks are real. Implementers must still READ each target file first — line numbers drift.
