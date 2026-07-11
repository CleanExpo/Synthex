# AI Images: 3-Variant Batches + Preference Feedback (Trial Slice) — Design v2

**Date:** 2026-07-12 · **Status:** approved (founder: "approve the spec and build it - we can only trial it"); v2 folds all 17 findings from the 3-lens adversarial panel (3 Critical, 8 Major, 6 Minor)
**Base:** `origin/main` @ 854184415 · **Branch:** `feat/image-batch-feedback`
**Companion bugfix folded in:** AI Images gallery clipping below `lg` viewports.

## Goal

Every dashboard generate produces **3 variants** (distinct seeds, parallel). The founder
gives **tap-to-rank 1-2-3 + per-image ✖ reject** feedback. Every variant and every
verdict is persisted with full generation lineage so the application accumulates
preference data ("starts learning"). Slice 1 consumes that data as a visible **insights
panel** only — no auto-tuning yet (trial).

## Founder decisions (locked 2026-07-12)

1. **Learning goal:** capture + insights first. Auto prompt-biasing / LoRA candidate
   flagging are later slices on real data.
2. **Batch size:** always 3 from the dashboard, no selector. ~US$0.09-0.10 per grounded
   batch accepted (internal tool).
3. **Feedback UX:** tap images in preference order → ranks 1/2/3; per-image ✖ =
   unusable; "None are good" rejects the whole batch. Ranked ⇒ kept.
4. **Trial framing:** ship lean, learn from use; everything here is additive/reversible.

## Part A — Gallery clipping bugfix

`[VERIFIED]` root cause (runtime-measured clientHeight 48 vs scrollHeight 364 at 1016
CSS px width; classes re-verified identical on main): the page root fixes its height at
all widths (`page.tsx:138 h-[calc(100vh-8rem)]`), the content row stacks below `lg`
while keeping `overflow-hidden` (`:177`), and the gallery panel's `flex-1` (basis 0%)
collapses it to its 48px padding (`:184`).

**Fix (one file, `app/dashboard/ai-images/page.tsx`):** make the fixed-height two-pane
layout desktop-only:

- `:138` → `flex flex-col lg:h-[calc(100vh-8rem)]`
- `:177` → `overflow-hidden` → `lg:overflow-hidden`
- `:179` → `overflow-y-auto` → `lg:overflow-y-auto`
- `:184` → `flex-1 overflow-y-auto` → `lg:flex-1 lg:overflow-y-auto`

Below `lg` the page stacks and scrolls as a normal document; at `lg`+ behaviour is
unchanged.

**Folded micro-fix `[VERIFIED]`:** `components/ai/image-preview-card.tsx` Download fires
its internal `handleDownload` AND the page-level `onDownload` — two downloads per click.
Consolidate: internal download only when no `onDownload` prop, else delegate.

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
- `baseSeed = clampSeed(options.seed ?? Math.floor(Math.random() * 1_000_000))` where
  `clampSeed` bounds into `[0, 2_147_480_000]` (Int column headroom for +2000 offset).
- `Promise.allSettled(seeds.map((s) => generateImage({ ...options, seed: s }, ctx)))`
  with seeds `baseSeed + i*1000` — **parallel**, no inter-call delay
  (`generateVariations`' sequential loop is left untouched; other callers depend on it).
- Rejected/failed settlements map to `{ success: false, provider, error }` — the batch
  succeeds if ≥1 variant succeeds; failures are observable and persisted as
  `status: 'failed'`.
- `generateImage()` itself untouched (1-call-1-image contract, 6+ consumers).

### Route (`app/api/media/generate/image/route.ts` POST — extended, back-compatible)

- Add `export const maxDuration = 120` (generation ~25-30s + parallel library saves;
  panel finding — route currently has no duration config).
- Schema adds `variants: z.number().int().min(1).max(3).optional()` and tightens
  `seed` to `z.number().int().min(0).max(2_147_480_000).optional()`.
- **Org resolution (panel Critical):** the route currently has NO organisation
  resolution `[VERIFIED route.ts:52-62]`. The batch path (and both feedback endpoints)
  call `getEffectiveOrganizationId(userId)` from `lib/multi-business/business-scope.ts`
  (canonical resolver; returns `string | null`). Rows persist whatever it returns —
  nullable column, below.
- Absent/`1` ⇒ exact current behaviour + response shape (all existing consumers
  unaffected; MCP tools unchanged this slice).
- `variants: 3` ⇒ `generateBatch`, one app-generated `batchGroupId` (cuid), then IN
  ORDER: (1) insert `image_generations` rows via **Prisma** (lineage survives any later
  timeout), (2) media-library saves in PARALLEL (`Promise.allSettled`, ≤3), (3) respond.

**Batch response contains NO `imageBase64`** (panel Major: 3× base64 breaches Vercel's
4.5MB function response limit on the stability/dalle/gemini paths):

```ts
{
  success: true,               // ≥1 variant succeeded
  batchGroupId: string,
  images: Array<{
    generationId: string,      // image_generations.id — feedback key
    success: boolean,
    provider: string,
    imageUrl?: string,         // grounded/fal results
    mediaAssetId?: string,     // set when library save succeeded
    metadata?: { seed?, width?, height?, model },
    grounded?: boolean, referenceSet?: string, refCount?: number,
    error?: string
  }>
}
```

Client rendering: `imageUrl` when present, else the media-asset image path (Part E).
500 `{ error, provider }` only when ALL variants fail. Existing auth
(`AUTHENTICATED_WRITE`), rate limit, subscription gate unchanged.

### Media-library persistence gap fix (route save block)

Today the `media_assets` insert is gated on `result.imageBase64` — grounded FLUX results
are URL-only and never saved `[VERIFIED route.ts:244]`. New helper (unit-tested)
`fetchImageAsBase64(url)` used by single and batch paths when
`saveToLibrary && !imageBase64 && imageUrl`:

- **SSRF guard (panel Major):** `assertExternalUrlSafe(url)` from
  `lib/security/validate-url.ts` PLUS a host allowlist — `fal.media`,
  `*.fal.media`, `fal.run` (the only URL-returning providers today); anything else →
  logged warn, no fetch, row keeps `imageUrl` (non-fatal).
- https only, `redirect: 'error'`, response `content-type` must be `image/*`,
  15MB cap (content-length check + streamed guard), 20s timeout.
- Failure ⇒ non-fatal (`logger.warn`), row keeps `imageUrl` only.
- Persisted seed = `result.metadata?.seed ?? requestedSeed`.

## Part C — Persistence model (the learning substrate)

New Prisma model, table `image_generations`. **All reads/writes via the Prisma client**
(panel Critical — `@default(cuid())`/`@updatedAt` are client-side; the route's existing
Supabase writes don't apply to this table). Org column **nullable**, matching the
VideoGeneration precedent (schema.prisma:3352) and the PromoCode/studio_content_drafts
no-DB-FK pattern:

```prisma
model ImageGeneration {
  id             String    @id @default(cuid())
  organizationId String?   @map("organization_id")
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
  rank           Int?      // 1..k contiguous within batch (app + partial unique index)
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

Migration `supabase/migrations/20260712100000_image_generations_feedback.sql` —
additive, applied out of band via Supabase `apply_migration` (never `prisma db push`):

- `CREATE TABLE IF NOT EXISTS` with **DB-side defaults so the table is write-client
  agnostic** (panel Critical; 20260711160000 idiom):
  `"id" text NOT NULL DEFAULT (gen_random_uuid())::text`,
  `"created_at"/"updated_at" timestamptz NOT NULL DEFAULT now()`.
- Indexes as modelled PLUS the rank-integrity guard (panel Major):
  `CREATE UNIQUE INDEX IF NOT EXISTS image_generations_batch_rank_key ON
image_generations (batch_group_id, rank) WHERE rank IS NOT NULL;`
- RLS spelled out (panel Major — do NOT copy the `auth.uid()` org comparison, it's a
  dead policy for org ids): `ENABLE ROW LEVEL SECURITY`;
  `FOR ALL TO service_role USING (true) WITH CHECK (true)`;
  `FOR SELECT TO authenticated USING (public.is_team_member(organization_id))`
  (helper from 20260602055800); both in `DO $$ … duplicate_object` guards.

Rows are written at generation time (feedback = UPDATE, can never orphan).
`referenceSubject`/`referenceVendor` ride in `metadata` JSON.

## Part D — Feedback + insights API

New file `app/api/media/generate/image/feedback/route.ts`. Both methods:
`APISecurityChecker` auth as the generate route, `withRateLimit` on PATCH, org
resolution via `getEffectiveOrganizationId(userId)`.

**Scope rule (panel Critical):** rows are owned when
`row.userId === userId OR (effectiveOrg !== null AND row.organizationId === effectiveOrg)`.
When `effectiveOrg` is null, scope by `userId` ONLY — never filter
`organizationId: null`.

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

Pure validator (unit-tested): `rank` ⇒ `kept === true`; `generationId`s unique;
ranks form exactly `{1..k}` for some k ≥ 1 when any rank present (contiguity — undo
in the UI renumbers before submit); verdicts may cover a SUBSET of the batch
(partial saves allowed); verdicts must NOT reference `status: 'failed'` rows (panel
Major — technical failures are never preference signal).

**Idempotent whole-batch replace (panel Major):** inside one
`prisma.$transaction`: (1) verify every `generationId` belongs to `batchGroupId`,
is `status: 'completed'`, and passes the scope rule (else 403/400); (2)
`updateMany` reset `rank: null` on the whole batch; (3) apply the payload verdicts
(`kept`, `rank`, `feedbackAt: now()`). Resubmission/re-ranking is safe and
last-write-wins; the partial unique index backstops races.

Response `{ success: true, updated }`. Error shape `{ error, details? }`.

- **GET** — insights over the caller's scoped rows where `feedbackAt != null` AND
  `status = 'completed'` (panel Major — failures excluded from every aggregate),
  deterministic rolling window `orderBy: { createdAt: 'desc' }, take: 500`, then a
  pure aggregation function (unit-tested):

```ts
{
  (totalBatchesRanked,
    totalKept,
    totalRejected, // raw counts, always shown
    sampleSize, // ranked batches in window
    groundedWinRate, // rank-1 grounded share — null when sampleSize < 5
    styleWinRates, // [{ style, rank1Count }]
    topReferenceSets, // [{ referenceSet, keptCount }]
    providerAvgRank); // [{ provider, avgRank, n }]
}
```

Rate-style stats are null/omitted below `sampleSize 5` (panel Minor — no dishonest
percentages at N=2); the panel shows raw counts regardless. GET exposes only
aggregates, never prompts.

## Part E — Dashboard UI

- **Hook** (`hooks/use-image-generation.ts`): `generateBatch(options)` POSTs with
  `variants: 3`; `BatchResult { batchGroupId, images: BatchImage[] }` where
  `BatchImage = ImageResult & { generationId: string, mediaAssetId?: string }`.
  Existing single-image API preserved.
- **`components/ai/image-generator.tsx` (panel Critical — previously missing):** owns
  the generate call today (`generate()` at ~:237, reports via `onGenerate`). It gains
  `onBatchGenerated?: (batch: BatchResult) => void`; its submit handler calls the
  hook's `generateBatch`; success gate = ≥1 successful variant. `onGenerate` prop and
  all its other consumers untouched.
- **Image rendering for base64-provider variants:** batch responses carry no base64,
  so the card renders `imageUrl ?? mediaAssetImageSrc(mediaAssetId)`. The build task
  first locates the existing media-asset serving path (how the Content Library page
  renders `media_assets` rows); if none exists, add
  `GET /api/media/assets/[id]/image` — auth'd, owner-scoped (`user_id` match),
  returns the stored base64 as an `image/png` response. Small and additive.
- **`components/ai/batch-feedback-card.tsx`** (new): renders up to 3 variants —
  responsive grid `grid-cols-1 sm:grid-cols-3 gap-3` (panel Minor: must work below
  `lg` post-Part-A). Tap-to-rank (orange 1/2/3 badge), per-image ✖ toggle, "None are
  good" button. **Feedback affordances are always-visible taps, never hover-dependent
  (touch support), minimum 44px targets.** Undo-tap clears a rank and renumbers the
  remainder contiguously from 1. Failed variants render the existing error card,
  excluded from feedback entirely.
  **Explicit "Save feedback" button (panel Major — replaces auto-submit):** enabled
  once every SUCCESSFUL variant has a state (or on "None are good"); partial saves
  allowed via the same button after any single verdict. Taps disabled while the PATCH
  is in flight; on failure the card stays editable with "Couldn't save — tap to
  retry" (Australian English throughout); saved state renders ONLY on a 200
  ("Saved — Synthex is learning"). Card stays editable after save; re-saving reuses
  the idempotent PATCH.
  After "None are good": optional, dismissible one-line "What was wrong?" input;
  submission PATCHes the text into the rows' `metadata` JSON (non-blocking, skippable,
  no schema change).
- **`components/ai/generation-insights.tsx`** (new): small card above the gallery;
  `useApiSWR` keyed by effective org (SYN-908); hidden until `totalBatchesRanked >= 1`;
  below `sampleSize 5` shows raw counts with a muted "early data — keep ranking"
  treatment.
- **Page** (`app/dashboard/ai-images/page.tsx`): wires `onBatchGenerated` into new
  `batches` state (newest first); renders insights panel + batch cards; layout fix per
  Part A. In-memory only: a reload discards unsaved verdicts — **accepted for the
  trial** (panel Minor; partial saves mitigate).

## Non-goals (ledgered)

Auto prompt-biasing · LoRA candidate flagging · MCP `generate_image` batching · gallery
persistence across reloads (beyond library saves) · dashboard LoRA picker · batch-size
selector · media_assets org-column adoption (#433) · retention policy for feedback rows
(revisit ~12 months) · per-batch free-text beyond the "None are good" reason.

## Testing

Unit (Jest, worktree config):

- `generateBatch`: parallel fan-out, seed offsets + clamp, allSettled failure mapping,
  context guard.
- Feedback validator: rank⇒kept; duplicate generationIds; duplicate ranks;
  non-contiguous ranks (e.g. {2,3}) rejected; subset payloads accepted; failed-row
  verdicts rejected.
- PATCH transaction semantics: whole-batch rank reset then apply (mock prisma);
  cross-batch and cross-org/user rejection (403); null-org scoping by userId only.
- Insights aggregator: fixtures incl. empty, all-rejected, failed rows excluded,
  sampleSize gating (<5 ⇒ null rates), rolling-window determinism.
- `fetchImageAsBase64`: allowlist rejection, non-image content-type rejection, size
  cap, timeout, redirect refusal, failure non-fatality.
- Route shapes: `variants` bounds; seed bounds; back-compat — absent `variants` ⇒
  byte-identical single response (regression); batch response contains NO
  `imageBase64` key.

## Verification (gate + live)

`npm run type-check && npm run lint && npm test` with pasted tallies. Live on prod after
merge: (1) 1016px-wide window — gallery reachable by normal scroll; (2) grounded batch
of 3 from the dashboard (single POST, response < 4.5MB); (3) non-grounded batch
(stability path) renders via media-asset path — response < 4.5MB `[panel Major —
explicit check]`; (4) rank 2 + reject 1 → PATCH 200 → DB rows show kept/rank/feedbackAt;
re-rank → still one rank-1 (idempotent replace); (5) insights panel shows raw counts
(rates suppressed below n=5); (6) grounded variants have `mediaAssetId` set.

## Risks / assumptions register

- `[UNCONFIRMED]` fal CDN URL retention window — mitigated by library persistence.
- `[UNCONFIRMED]` provider rate limits under 3 concurrent calls (stability/dalle) —
  mitigated by allSettled fail-open.
- `[INFERENCE]` `h-[calc(100vh-8rem)]` under-accounts for header+banners on desktop —
  out of scope; Part A only fixes the stacked-layout collapse.
- media_assets lacks organization_id (draft migration #433, founder-gated) — the
  feedback table carries its own nullable organizationId and does not depend on it.
- Org-switch between generate and feedback: ownership falls back to `userId` equality,
  so the same user can always feedback their own batches (panel Critical follow-on).
- PII: prompts stored verbatim in `image_generations` under the same internal-tool
  acceptance as `media_assets.prompt`; reads gated by RLS (`is_team_member`) +
  service-role writes; insights GET returns aggregates only. Retention decision
  ledgered (prune non-kept rows > 12 months, later slice).
