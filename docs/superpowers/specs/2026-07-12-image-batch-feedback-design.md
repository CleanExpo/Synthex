# AI Images: 3-Variant Batches + Preference Feedback (Trial Slice) — Design

**Date:** 2026-07-12 · **Status:** approved (founder, 2026-07-12: "approve the spec and build it - we can only trial it")
**Base:** `origin/main` @ 854184415 · **Branch:** `feat/image-batch-feedback`
**Companion bugfix folded in:** AI Images gallery clipping below `lg` viewports.

## Goal

Every dashboard generate produces **3 variants** (distinct seeds, parallel). The founder
gives **tap-to-rank 1-2-3 + per-image ✖ reject** feedback. Every variant and every
verdict is persisted **org-scoped with full generation lineage** so the application
accumulates preference data ("starts learning"). Slice 1 consumes that data as a visible
**insights panel** only — no auto-tuning yet (trial).

## Founder decisions (locked 2026-07-12)

1. **Learning goal:** capture + insights first. Auto prompt-biasing / LoRA candidate
   flagging are later slices on real data.
2. **Batch size:** always 3 from the dashboard, no selector. Cost ~US$0.09-0.10 per
   grounded batch accepted (internal tool).
3. **Feedback UX:** tap images in preference order → ranks 1/2/3; per-image ✖ = unusable;
   "None are good" rejects the whole batch. Ranked ⇒ kept. All-state ⇒ one save call.
4. **Trial framing:** ship lean, learn from use; everything here is additive/reversible.

## Part A — Gallery clipping bugfix

`[VERIFIED]` root cause (runtime-measured clientHeight 48 vs scrollHeight 364 at 1016 CSS
px width; classes re-verified identical on main):

- `app/dashboard/ai-images/page.tsx:138` — root `h-[calc(100vh-8rem)] flex flex-col`
  (fixed height at all widths)
- `:177` — `flex-1 flex flex-col lg:flex-row overflow-hidden` (stacks below `lg`,
  clips at all widths)
- `:179` — generator panel `overflow-y-auto`
- `:184` — gallery panel `flex-1 overflow-y-auto` → flex-basis 0% in the stacked column
  ⇒ collapses to its 48px padding; document has nothing to scroll.

**Fix (one file):** make the fixed-height two-pane layout desktop-only:

- `:138` → `flex flex-col lg:h-[calc(100vh-8rem)]`
- `:177` → `overflow-hidden` → `lg:overflow-hidden`
- `:179` → `overflow-y-auto` → `lg:overflow-y-auto`
- `:184` → `flex-1 overflow-y-auto` → `lg:flex-1 lg:overflow-y-auto`

Below `lg`, the page stacks and scrolls as a normal document; at `lg`+ behaviour is
unchanged.

**Folded micro-fix `[VERIFIED]`:** `components/ai/image-preview-card.tsx` Download fires
its internal `handleDownload` AND the page-level `onDownload` — two downloads per click.
Consolidate to a single handler (internal download only when no `onDownload` prop, else
delegate).

## Part B — Batch generation

### Service layer (`lib/services/ai/image-generation.ts`)

New export:

```ts
export async function generateBatch(
  options: ImageGenerationOptions,
  ctx: GenerationContext,
  count: number = 3
): Promise<ImageGenerationResult[]>;
```

- `requireGenerationContext(ctx, 'generateBatch')`.
- `baseSeed = options.seed ?? Math.floor(Math.random() * 1_000_000)`.
- `Promise.allSettled(seeds.map(s => generateImage({ ...options, seed: baseSeed + i*1000 }, ctx)))`
  — **parallel**, no inter-call delay (contrast `generateVariations`' sequential 500ms
  loop, which is left untouched — other callers depend on it).
- Rejected/failed settlements map to `{ success: false, provider, error }` results —
  the batch succeeds if ≥1 variant succeeds (fail-open per estate pattern; per-variant
  failures observable in the response and persisted as `status: 'failed'`).
- `generateImage()` itself is untouched — its 1-call-1-image contract has 6+ consumers.

### Route (`app/api/media/generate/image/route.ts` POST — extended, back-compatible)

- Schema adds `variants: z.number().int().min(1).max(3).optional()`. Absent/1 ⇒ exact
  current behaviour + response shape (all existing consumers unaffected; MCP tools
  unchanged this slice).
- `variants: 3` (what the dashboard now sends) ⇒ route calls `generateBatch`, creates one
  `batchGroupId` (cuid), persists one `image_generations` row per variant (below), saves
  each successful variant to the media library (below), responds:

```ts
{
  success: true,               // ≥1 variant succeeded
  batchGroupId: string,
  images: Array<{
    generationId: string,      // image_generations.id — feedback key
    success: boolean,
    provider, imageBase64?, imageUrl?, metadata?, mediaAssetId?,
    grounded?, referenceSet?, refCount?, error?
  }>
}
```

- 500 `{ error, provider }` only when ALL variants fail.
- Existing auth (`AUTHENTICATED_WRITE`), rate limit, subscription gate unchanged.

### Media-library persistence gap fix (route save block)

Today `media_assets` insert is gated on `result.imageBase64` — grounded FLUX results are
URL-only and **never saved** `[VERIFIED route.ts:244]`. Fix, used by both single and
batch paths: when `saveToLibrary && !imageBase64 && imageUrl`, server-side `fetch` the
URL (15MB cap via content-length check + streamed size guard, 20s timeout), convert to
base64, insert as today. Fetch failure ⇒ non-fatal: log via `logger.warn`, row keeps
`imageUrl` only. Keepers therefore survive fal CDN retention `[UNCONFIRMED retention
window — the mitigation]`.

## Part C — Persistence model (the learning substrate)

New Prisma model, table `image_generations` — modelled on `VideoGeneration`
(schema.prisma:3337), org-scoped scalar TEXT (no DB FK — PromoCode /
studio_content_drafts precedent, org enforcement at query layer):

```prisma
model ImageGeneration {
  id             String    @id @default(cuid())
  organizationId String    @map("organization_id")
  userId         String    @map("user_id")
  batchGroupId   String    @map("batch_group_id")
  status         String    // 'completed' | 'failed'
  provider       String
  model          String?
  seed           Int?
  inputPrompt    String    @map("input_prompt")
  enhancedPrompt String?   @map("enhanced_prompt")
  style          String?
  aspectRatio    String?   @map("aspect_ratio")
  imageUrl       String?   @map("image_url")
  mediaAssetId   String?   @map("media_asset_id")
  grounded       Boolean   @default(false)
  referenceSet   String?   @map("reference_set")
  refCount       Int?      @map("ref_count")
  loraId         String?   @map("lora_id")
  loraApplied    Boolean   @default(false) @map("lora_applied")
  kept           Boolean?
  rank           Int?      // 1..3, unique within batch (app-enforced)
  feedbackAt     DateTime? @map("feedback_at")
  metadata       Json?
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  @@index([organizationId, createdAt])
  @@index([batchGroupId])
  @@index([userId])
  @@map("image_generations")
}
```

Migration `supabase/migrations/20260712100000_image_generations_feedback.sql`:
`CREATE TABLE IF NOT EXISTS` + indexes + `ENABLE ROW LEVEL SECURITY` + service-role-only
write policy and org-scoped SELECT policy following the estate's newest patterns
(20260711 migrations as reference). Fully additive; **applied out of band via Supabase
`apply_migration`** per CLAUDE.md (never `prisma db push`).

Rows are written at generation time (feedback = UPDATE, can never orphan). Grounding
lineage fields come from the service result; `referenceSubject`/`referenceVendor` ride
in `metadata` JSON (service already returns them on metadata; avoid column sprawl for a
trial).

## Part D — Feedback + insights API

Same route directory, new file `app/api/media/generate/image/feedback/route.ts`:

- **PATCH** — Zod:

```ts
{
  batchGroupId: z.string().min(1),
  verdicts: z.array(z.object({
    generationId: z.string().min(1),
    kept: z.boolean(),
    rank: z.number().int().min(1).max(3).optional(),
  })).min(1).max(3)
}
```

Rules (pure validator, unit-tested): `rank` ⇒ `kept === true`; ranks unique within
payload; every `generationId` must belong to `batchGroupId` AND to the caller's
effective org (query-layer scope check) — else 403/400. Update rows: `kept`, `rank`
(null when rejected), `feedbackAt: now()`. Response `{ success: true, updated }`.
Error shape `{ error, details? }`. Auth `AUTHENTICATED_WRITE`.

- **GET** — org-scoped insights aggregates over rows with `feedbackAt != null`:

```ts
{
  (totalBatchesRanked,
    totalKept,
    totalRejected,
    groundedWinRate, // grounded share of rank-1 picks (null if no data)
    styleWinRates, // [{ style, rank1Count }]
    topReferenceSets, // [{ referenceSet, keptCount }]
    providerAvgRank); // [{ provider, avgRank }]
}
```

Implementation: single `findMany` of feedback rows (bounded: last 500) + pure
aggregation function (unit-tested on fixtures). No new deps.

## Part E — Dashboard UI

- **Hook** (`hooks/use-image-generation.ts`): `generateBatch(options)` posting
  `variants: 3`; new `BatchResult { batchGroupId, images: ImageResult&{generationId}[] }`;
  state `batches: BatchResult[]` (prepend). Existing single-image API preserved.
- **`components/ai/batch-feedback-card.tsx`** (new): renders 3 variants
  (`grid grid-cols-3 gap-3`, reusing `ImagePreviewCard` visuals), tap-to-rank (orange
  rank badge 1/2/3 top-right), ✖ toggle per image, "None are good" button, undo-tap to
  clear a rank. When all 3 have a state → auto-PATCH feedback (single call) → card shows
  a subtle "Saved — Synthex is learning" state. Failed variants render the existing
  error card and are auto-submitted as `kept:false`.
- **`components/ai/generation-insights.tsx`** (new): small card above the gallery;
  fetches GET insights via `useApiSWR` (org-scoped key per SYN-908); hidden until
  `totalBatchesRanked >= 1`; empty state omitted (panel simply absent).
- **Page** (`app/dashboard/ai-images/page.tsx`): generate now calls `generateBatch`;
  gallery area renders insights panel + batch cards (newest first). Layout fix per
  Part A. Australian English in all copy.

## Non-goals (ledgered for later slices)

Auto prompt-biasing · LoRA candidate flagging · MCP `generate_image` batching ·
gallery persistence across reloads (beyond library saves) · dashboard LoRA picker ·
batch-size selector · media_assets org-column adoption (separate founder-gated
migration #433).

## Testing

Unit (Jest, worktree config): `generateBatch` (parallel fan-out, seed offsets, allSettled
fail-open mapping, context guard); feedback validator (rank⇒kept, duplicate ranks,
cross-batch/org rejection); insights aggregator (fixtures incl. empty/all-rejected);
URL-fetch-to-base64 helper (size cap, timeout, failure non-fatal); route Zod shapes
(variants bounds, verdicts bounds). Existing suites must stay green (route back-compat:
absent `variants` ⇒ old shape — regression test).

## Verification (gate + live)

`npm run type-check && npm run lint && npm test` with pasted tallies. Live on prod after
merge: (1) 1016px-wide window — gallery reachable by normal scroll `[the original bug's
repro]`; (2) one grounded batch of 3 from the dashboard; (3) rank 2, reject 1 → PATCH
200, DB rows show kept/rank/feedbackAt; (4) insights panel appears with real numbers;
(5) grounded variants have `mediaAssetId` set (library persistence gap closed).

## Risks / assumptions register

- `[UNCONFIRMED]` fal CDN URL retention window — mitigated by Part B library persistence.
- `[UNCONFIRMED]` provider rate limits under 3 concurrent calls (stability/dalle) —
  mitigated by allSettled fail-open; grounded path (fal) handles concurrency fine
  `[INFERENCE from training/proof runs]`.
- `[INFERENCE]` `h-[calc(100vh-8rem)]` under-accounts for header+banners on desktop —
  out of scope; Part A only fixes the stacked-layout collapse.
- media_assets lacks organization_id (draft migration, founder-gated) — feedback table
  carries its own organizationId and does not depend on it.
- Response payload 3× (base64-heavy on non-grounded paths) — accepted for trial;
  grounded paths return URLs.
