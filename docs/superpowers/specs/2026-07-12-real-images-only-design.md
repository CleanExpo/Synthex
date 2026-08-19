# Real Images Only — Grounded-by-Default, Everywhere — Design

**Date:** 2026-07-12 · **Status:** founder-mandated ("We are not using AI invented, we are
generating from Real Images… anywhere and everywhere… as I have specifically designed it")
**No-coverage decision (founder):** **BLOCK** — no owned references ⇒ no generation.
**Input:** 3-lane exhaustive sweep of every generation pathway (28 pathways enumerated;
ledgered in `.superpowers/sdd/progress-batch-feedback.md` and the sweep workflow journal).

## The principle (inverts the previous opt-in design)

Every image/video generation resolves the **owned reference library first** and applies the
industry's trained LoRA automatically. Producing pixels without owned references is no longer
a default behaviour anywhere in the system — it requires the explicit, audited escape hatch
and is loudly stamped. When the library has nothing for a subject, generation is **refused**
with instructions to add real photos.

## Part A — Core service inversion (`lib/services/ai/image-generation.ts`)

1. **One shared gate** `shouldGround(options): boolean` = `options.useReferences !== false`
   (default TRUE), used by BOTH `generateImage` (:642) and `generateWithLora` (:454) — the
   two existing copies of the opt-in expression are replaced so they can never drift.
2. **Auto-detect always runs** on the default path (`resolveReferences({ set, prompt })`
   already does prompt→industry detection).
3. **BLOCK on no coverage:** when grounding is on (default) and references resolve to zero
   owned images, return `{ success: false, provider: 'stability', error:
'No owned references for this subject — add real photos to the reference library first.',
grounded: false, blocked: true }`. New result field `blocked?: boolean`. No provider is
   ever called.
4. **BLOCK on grounding failure too:** if references EXIST but the grounded FLUX call fails
   (fal outage, URL resolution failure), retry once; on second failure return the same
   fail-closed error (with `error` naming the real cause). The old silent fall-through to
   stability/dalle/gemini (:653, :668, :700-706) is removed. AI-invention is never a fallback.
5. **Escape hatch (audited):** `useReferences: false` explicitly skips grounding — result is
   stamped `grounded: false` and gains `warnings: ['UNGROUNDED — generated without owned
references (explicit override)']`. This is the only road to the legacy providers.
6. **Deprecated-provider enforcement:** the legacy loop (:722-745) currently hardcodes
   `['stability','dalle','gemini']` and ignores the registry's `deprecated` flags. Under the
   escape hatch, deprecated providers (stability SD3, dalle) are skipped unless explicitly
   pinned via `options.provider`; an explicit pin also requires the escape hatch (a pinned
   ungrounded provider with grounding on is a validation error).
7. **LoRA auto-apply:** new `resolveLoraForIndustry(industry)` in
   `lib/services/ai/image/trained-loras.ts` — first ACTIVE registry entry whose `industry`
   matches (carpet-cleaning → carpet-style-v1). The grounded path applies it automatically
   when the caller didn't pass `loraId` (caller's explicit `loraId` wins). Trigger token
   auto-appended per existing `generateWithLora` behaviour.
8. **LoRA failure fallback order:** unknown/failed LoRA (:581-616) now falls back to the
   **reference-grounded FLUX path** (same industry refs still resolve), NOT to the legacy
   chain. If that also fails → fail-closed per (4).
9. `generateVariations` / `generateBatch` inherit all of this automatically (they delegate
   to `generateImage`). Contract test pins it.

## Part B — Routes and MCP surfaces

- **POST /api/media/generate/image** (single + batch): no gate change needed (service
  default-on). Adds `loraId: z.string().min(1).optional()` passthrough. Batch lineage rows
  stop hardcoding `loraId: null / loraApplied: false` (:325-326) — stamp from each result.
  Blocked results map to **422** `{ error, blocked: true }` (not 500) so the UI can render
  the add-photos guidance; batch: blocked variants recorded `status:'blocked'` in lineage;
  all-blocked ⇒ 422.
- **PUT /variations:** VariationsSchema gains `referenceSet/useReferences/loraId` and threads
  them (:498-503). Grounded by default via the service.
- **POST /api/video/generate (generative):** schema gains `referenceSet/useReferences`
  (spread into `submitGenerativeVideo`).
- **Video service** (`video/generation-service.ts:33-34`): same gate inversion; add
  `resolvePrivateReferenceUrls` fallback (parity with the image path); no-coverage generative
  video ⇒ same BLOCK. Tier fallback that drops the seed (:94-106) becomes fail-closed for
  the seed: if no image-capable model exists in tier, upgrade tier or block — never silently
  ungrounded.
- **MCP `generate_image` / `generate_video`:** inherit service defaults; tool descriptions
  rewritten: grounding is the default, `useReferences:false` is an explicit audited override;
  blocked results return the block error verbatim so agents relay it.
- **POST /api/demo/image** (public lead-gen demo, raw Gemini + Picsum today): reroute through
  `generateImage` — **sanctioned exception**: passes the explicit escape hatch (arbitrary
  prospect businesses can't have owned references) and its output carries the UNGROUNDED
  stamp internally. FLAGGED TO FOUNDER for a future decision (e.g. retire the demo or
  restrict to covered industries).
- **Brand Video Studio worker** (`scripts/brand-video-worker.ts` per-beat Gemini images):
  reroute beat images through `generateImage` (grounded default + LoRA + lineage). Beats
  whose subject has no coverage will BLOCK — surfaced in the job error, consistent with the
  mandate.
- **Legacy /api/media/generate/video (Runway/Synthesia/D-ID):** add the same schema fields +
  guard test; ledger recommendation: retire route.
- **Automation rules engine** latent `generate_image` action: contract test asserting any
  future executor calls `generateImage` (default-grounded).

## Part C — The "everywhere" enforcement guard

New static test `tests/unit/ai/no-direct-image-apis.test.ts`: greps `lib/ app/ scripts/`
(excluding `lib/services/ai/image-generation.ts`, provider adapters under
`lib/services/ai/image/providers/`, and the sanctioned-exception list below) for direct
calls to image-generation endpoints (`images/generations`, `stability.ai`, `fal.run/fal-ai/flux`,
`generateContent` with image modality, `nano.banana`, Picsum). Any hit outside the service
layer fails the suite with "route through generateImage() — Real Images Only mandate".
This makes "get it out of anywhere and everywhere" permanent, not a one-time sweep.

**Sanctioned exceptions register (each carries a code comment naming this spec):**

1. `lib/video/drift-canary.ts` — monitoring smoke gen, isolated canary org.
2. `app/api/demo/image` — public demo via explicit escape hatch (flagged to founder).
3. One-off campaign scripts (`scripts/generate-ccw-openai-campaign-images.ts`,
   `generate_nano_banana.py`, `generate_imagen.py`) — **archived** to
   `.claude/archived/2026-07-12/ungrounded-scripts/` (not rewritten; recoverable).
4. HeyGen avatar proxy — different modality (talking heads); ledger item: consent/allowlist
   enforcement, separate slice.
5. `app/api/demo/analyze/route.ts` — same public demo family as (2): Picsum stock
   placeholder for arbitrary prospects; same pending founder decision. (Found by the
   Part C guard on first run.)
6. `scripts/generate-ccw-real-product-creatives.ts` — fourth ungrounded one-off script,
   missed by the initial sweep, archived with its siblings. (Found by the Part C guard.)

## Part D — Dashboard UX

- "Use my reference photos" toggle: **default ON**, copy inverted: "Generating from your real
  photos (default)" / turning it OFF requires the confirm affordance and marks results
  UNGROUNDED.
- Blocked-state UX: 422 renders "No owned references for this subject yet — add real photos
  to the reference library first" with a link to /reference-library.
- Every rendered result shows its grounding state: grounded badge (set + refCount) or a red
  UNGROUNDED stamp (escape-hatch generations only).
- Batch card + insights already carry grounded lineage; insights gains groundedShare.

## Testing

Unit: shouldGround default/off; block-on-no-coverage (resolveReferences 0-count fixture);
block-on-grounding-failure after one retry; escape-hatch stamping (grounded:false +
warnings[]); deprecated-provider skip + pinned-provider-requires-escape-hatch validation;
resolveLoraForIndustry (active/retired/none); LoRA-failure→grounded-FLUX fallback;
variations/batch inheritance; route 422 mapping incl. batch statuses; video gate inversion +
seed fail-closed; the Part C static guard itself. Existing suites updated: every test that
relied on default-ungrounded behaviour is rewritten to the new contract (expected: the
grounding suites' "legacy path byte-identical" premises change — this is the deliberate
break the mandate requires).

## Verification (gate + live)

Gate with pasted tallies. Live: (1) dashboard generate with NO toggles → grounded batch,
LoRA auto-applied (loraApplied:true in lineage); (2) prompt with no coverage ("a cartoon
spaceship") → blocked with the add-photos message; (3) MCP generate_image default → grounded;
(4) escape hatch → UNGROUNDED stamp visible; (5) insights groundedShare present.

## Risks / register

- Blocking will surface every place the estate quietly relied on ungrounded output (brand
  video beats, campaign flows) — that surfacing is the point; each block message names the
  missing subject so the library grows deliberately.
- Public demo remains ungrounded via the sanctioned escape hatch — founder decision pending.
- `[INFERENCE]` Existing sandbox/integration suites may assert old defaults — Wave gate will
  catch and rewrite.
- Prompt-only auto-detect can mis-route an abstract graphic to an industry (e.g. "carpet of
  flowers") → it grounds on carpet references rather than blocking; acceptable trial
  behaviour, observable via lineage.
