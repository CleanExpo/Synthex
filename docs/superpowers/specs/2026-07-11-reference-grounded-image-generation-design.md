# Design Spec — Reference-Grounded Image Generation (v1, foundational slice)

- **Date:** 2026-07-11
- **Status:** Draft for review
- **Author:** Synthex build (brainstorming → spec)
- **Related:** `public/reference-library/` (SYN reference library, committed 2026-07-11),
  `docs/equipment-servicing/manufacturer-manual-index.md`
- **Evidence tags:** `[VERIFIED]` = checked against a file/line or a cited URL this session;
  `[INFERENCE]` = reasoned from verified material; `[UNCONFIRMED]` = assumption / risk.

---

## 1. Problem & intent

Synthex generates marketing/training images from **text prompts only**, so equipment and
job-site visuals look synthetic rather than like the real gear. The founder wants generation
**grounded on real reference photos** (the owned `public/reference-library/` set — carpet
cleaning wand, upholstery tool; more to come), so outputs resemble actual Carpet Cleaners
Warehouse (CCW) products. This is **reference grounding at generation time, not model
fine-tuning.**

`[VERIFIED]` The image path is text-only today: `lib/services/ai/image-generation.ts`
`type ImageProvider = 'stability' | 'dalle' | 'gemini'` (line 24); `generateImage()` (line 420)
tries `[provider]` else falls back `['stability','dalle','gemini']` (lines 439–472); no options
field accepts an input/reference image.

## 2. Scope

### In scope (this slice)
1. **Reference resolver** — resolve owned reference images by industry/subject/prompt.
2. **Small image model registry** — data-driven catalog (mirrors the video registry) so
   reference-capable models are one entry, not a new hardcoded branch.
3. **FLUX.2 pro (fal) adapter** — the grounding model.
4. **Wire-up** in `image-generation.ts` + the shared `generate_image` studio-tool, plus a
   `list_reference_sets` read tool. Because studio-tools is the shared contract, the MCP
   server, REST route, and copilot all inherit grounded generation.

### Out of scope (later cycles, each its own spec)
- Video grounding (fal image-to-video is **already plumbed** — small follow-on).
  `[VERIFIED]` `lib/services/ai/video/generation-service.ts` passes `req.imageUrl` → `image_url` to fal.
- The orchestration/"specialised" skills that pick industry → pull refs → drive outputs.
- **GPT Image 2** as a second registry entry (16 refs; already used in CCW scripts).
- Converging the reference library with the CCW Shopify product-scrape pipeline
  (`scripts/generate-ccw-real-product-creatives.ts`).

## 3. Decisions locked (this session)

| # | Decision | Choice |
|---|---|---|
| D1 | First slice | Foundational: resolver + MCP tool + image grounding |
| D2 | Reference selection | Explicit `referenceSet` + auto-detect fallback from prompt |
| D3 | Primary grounding model | **FLUX.2 pro via fal** (fal already wired; best product/material consistency; ~$0.03/MP) |
| D4 | Architecture | **Add a small image model registry** (fix the hardcoded 3-provider switch) |
| D5 | Rights | **Owned-only**, machine-enforced in the resolver |
| D6 | Water-damage refs | Excluded until owned job-site photos exist (third-party screenshots barred) |

`[VERIFIED]` Model facts: FLUX.2 [pro] on fal — generate `fal-ai/flux-2-pro`, reference/edit
`fal-ai/flux-2-pro/edit` takes `image_urls` (list); cost $0.03 first MP + $0.015/extra MP
(fal.ai docs, 2026). Multi-reference up to 8 (API) / 10 (playground) (bfl.ai, 2026).
`[VERIFIED]` fal is already integrated: `lib/services/ai/video/fal-adapter.ts` (`FAL_API_KEY`,
`FAL_QUEUE_BASE`); video registry is all `provider: 'fal'`.

## 4. Architecture & components

### 4.1 Image model registry (NEW) — `lib/services/ai/image/registry.ts`
Mirror `lib/services/ai/video/registry.ts`. `[VERIFIED]` that pattern exists (`VIDEO_MODELS`
lines 10–95, all `provider: 'fal'`, with per-model cost).

```ts
export interface ImageModel {
  id: string;                 // e.g. 'fal-ai/flux-2-pro'
  provider: 'fal' | 'openai' | 'stability' | 'gemini';
  label: string;
  tier: 'draft' | 'standard' | 'premium';
  costPerMegapixelUsd?: number;
  capabilities: {
    referenceImages: number;  // max refs; 0 = text-only
    imageToImage: boolean;
    maxResolution: number;    // px, long edge
  };
  grounding: boolean;         // eligible for reference grounding
  deprecated?: boolean;       // stability/dalle: kept, de-prioritised
}
export const IMAGE_MODELS: ImageModel[] = [ /* flux-2-pro (built now); stability, dalle, gemini (migrated) */ ];
export function selectImageModel(opts: { needsReferences: boolean; preferred?: string }): ImageModel;
```
- **This slice implements one grounding model: `flux-2-pro`.** `gpt-image-2` is a later cycle
  (§2) — the registry shape leaves room for it but it is NOT added here.
- `flux-2-pro`: provider `fal`, grounding `true`, `referenceImages: 8`, `costPerMegapixelUsd: 0.03`.
- Existing `stability` / `dalle` migrated in as `grounding:false`, `deprecated:true` (they ignore
  refs and are banned by the `visual-content-brief` skill — this closes the doc-vs-code gap).
  `[VERIFIED]` `visual-content-brief` SKILL.md bans DALL-E/Stability/Midjourney/Imagen.
- `selectImageModel({ needsReferences:true })` → `flux-2-pro`; else preserves current behaviour.

### 4.2 FLUX.2 pro adapter (NEW) — `lib/services/ai/image/providers/flux-fal.ts`
Thin client over fal, reusing the pattern in `video/fal-adapter.ts`.
- `generateFluxImage({ prompt, imageUrls?, imageSize?, seed? })`.
- No refs → `POST fal-ai/flux-2-pro`. Refs present → `POST fal-ai/flux-2-pro/edit` with
  `image_urls: string[]`.
- Auth `Authorization: Key ${FAL_API_KEY}`. Returns `{ imageUrl, seed, model, costUsd }`.

### 4.3 Reference resolver (NEW) — `lib/services/ai/reference-library.ts`
Single source of truth over `public/reference-library/manifest.json` (read once, cached).
- `listReferenceSets()` → industries/subjects with counts + rights.
- `resolveReferences({ set?, prompt?, max = 4 })`:
  1. If `set` given → use it. Else if `prompt` given → `detectIndustry(prompt)`
     (`[VERIFIED]` `lib/demo/industry-classifier.ts`) → map to a manifest industry key.
     **Note:** the classifier returns coarse categories (e.g. `'cleaning & restoration'`),
     which are broader than the manifest keys (`carpet-cleaning`, `upholstery-cleaning`,
     `water-damage-restoration`). A small explicit mapping table (classifier category →
     manifest industry) lives in the resolver. Auto-detect resolves to **industry-level**
     references; subject-level precision requires an explicit `referenceSet`.
  2. **Owned-only guard:** return descriptors ONLY for subjects whose manifest entry is
     `rights: "owned"`. Anything third-party/manufacturer can never be injected (D5).
  3. Return `{ set, subject, imageUrls: string[], count }` — public
     `/reference-library/...` URLs for fal `image_urls`.
- `manifest.json` gets a `rights: "owned"` field per subject (add now: carpet + upholstery =
  owned; water-damage stays empty). `[INFERENCE]` current manifest marks images
  `source: "owned-equipment-photo"`; formalise as a `rights` field.

### 4.4 Wire-up — `lib/services/ai/image-generation.ts`
- Extend `ImageGenerationOptions`: `referenceSet?: string`, `useReferences?: boolean`
  (default `true`), `referenceImageUrls?: string[]`, `model?: string`.
- In `generateImage()`: resolve references (explicit set, else auto-detect; owned-only) →
  if any found, `selectImageModel({needsReferences:true})` → FLUX adapter with `image_urls`
  → grounded image. If none, the existing provider path runs unchanged.
- Result metadata gains `{ grounded: boolean, model: string, referenceSet?: string, refCount: number }`.
- `[VERIFIED]` Existing `generateWithGemini` (line 284) shows the fetch/return shape to match.

### 4.5 Tool surface — `lib/services/ai/studio-tools/index.ts`
- Extend `GenerateImageArgs` (`[VERIFIED]` line 81) with `referenceSet?`, `useReferences?`, `model?`.
- The `generate_image` tool (`[VERIFIED]` line 226) threads them into `generateImage()`; stays
  `scope:'creative'`, `riskClass:'draft'` (never publishes).
- NEW `list_reference_sets` tool: `scope:'creative'`, `riskClass:'read'`, `costClass:'free'`
  → `resolver.listReferenceSets()`.
- `[VERIFIED]` studio-tools is the shared contract for MCP + REST + copilot
  (`app/api/mcp/[transport]/route.ts` registers `toolsForScopes`), so all three inherit this.

## 5. Data flow

```
generate_image(prompt, referenceSet?, useReferences?)
  → resolveReferences({ set|prompt })          // owned-only, public URLs
  → refs? selectImageModel(needsReferences) = flux-2-pro
        → flux-fal /edit { prompt, image_urls } → grounded image
     no refs → existing generateImage path (unchanged)
  → persist to media library; return { imageUrl, grounded, model, referenceSet, refCount }
```

## 6. Governance alignment
- **Owned-only** resolver = `creative-director` REM-1 "Direct Sourcing" + CCW authority-manifest
  "real product imagery, no fake renders" as code. `[VERIFIED]`
  `lib/marketing-agency/ccw-eofy-authority-manifest.ts` declares owned-image rights + bans fake renders.
- Registry `deprecated` flag on Stability/DALL-E reconciles the skill ban with the code default.
- Nothing here publishes or spends beyond a draft-tier image; `riskClass:'draft'` preserved.

## 7. Error handling
- Missing/invalid manifest, or an industry with no owned set → **text-only fallback**, never a
  hard fail; log + `grounded:false`.
- fal error/timeout → surface the error; optional ungrounded retry via `fal-ai/flux-2-pro`
  (no refs), tagged `grounded:false`, with a warning.
- Cost: track fal spend via the existing quota-hold pattern (`[VERIFIED]`
  `lib/services/ai/video/quota.ts`); image spend is small but recorded.

## 8. Testing (jest, real patterns — no DB mocks per repo rules)
- Resolver: explicit set; auto-detect from prompt; **owned-only filter rejects a non-owned set**;
  missing manifest → empty/fallback.
- Registry: `selectImageModel({needsReferences:true})` returns a `grounding:true` model
  (flux-2-pro); never a `deprecated` one.
- FLUX adapter: contract test asserts `image_urls` sent to `/edit` when refs present, and the
  plain endpoint when absent.
- `generate_image`: grounded metadata present; refs passed only when present; no refs → legacy path.
- Rights guard: attempting to ground on a third-party/manufacturer set returns no images.
- **Live check:** `generate_image referenceSet:'carpet-cleaning'` → output visibly resembles the
  real wand; `metadata.grounded === true`, `refCount > 0`.

## 9. Risks & assumptions
- `[UNCONFIRMED]` **fal fetches `image_urls` over the public internet** → grounding works against
  deployed URLs (synthex.social); **local dev can't be reached by fal.** *Mitigation:* support a
  data-URI path (base64) for local/testing, or test against a deployed preview. Put the chosen
  mitigation in the plan.
- `[UNCONFIRMED]` FLUX.2 pro exact fal request/response schema (field names, size enum) — confirm
  against fal docs at implementation time; the adapter isolates this.
- `[UNCONFIRMED]` `FAL_API_KEY` scope covers image endpoints as well as video — verify the key
  works for `fal-ai/flux-2-pro`.
- `[INFERENCE]` Adding a `rights` field to `manifest.json` is backward-compatible (additive).

## 10. Acceptance criteria
1. `list_reference_sets` returns carpet-cleaning (18) + upholstery-cleaning (6), water-damage empty.
2. `generate_image` with `referenceSet:'carpet-cleaning'` produces an image grounded on the real
   wand via FLUX.2 pro, `metadata.grounded === true`, and lands in the media library as a draft.
3. A prompt mentioning "carpet cleaning" with no explicit set auto-attaches the carpet refs.
4. A non-owned/third-party set yields **no** injected references (rights guard).
5. With `useReferences:false` (or no matching owned set) the legacy text-only path is unchanged.
6. `npm run type-check && npm run lint && npm test` green; new unit tests included.

## 11. File change list (for the implementation plan)
- NEW `lib/services/ai/image/registry.ts`
- NEW `lib/services/ai/image/providers/flux-fal.ts`
- NEW `lib/services/ai/reference-library.ts`
- EDIT `lib/services/ai/image-generation.ts` (options + routing + metadata)
- EDIT `lib/services/ai/studio-tools/index.ts` (`generate_image` args + `list_reference_sets`)
- EDIT `public/reference-library/manifest.json` (add `rights: "owned"` per subject)
- NEW tests under `tests/unit/…` for resolver, registry, adapter, tool, rights guard
- No DB migration; no schema change.
