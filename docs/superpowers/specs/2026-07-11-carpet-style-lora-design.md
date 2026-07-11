# Design Spec — Carpet-Industry Style LoRA (train + inference, slice 1)

- **Date:** 2026-07-11
- **Status:** Approved design (founder pre-approved); spec for implementation planning
- **Type:** Training script + trained-LoRA registry + inference wiring. **No DB migration, no new MCP tool, no Zod-shape change beyond one optional arg.**
- **Builds on:** the live owned corpus (310 images, full provenance) + the fal integration + the image
  registry/grounding pattern (`lib/services/ai/image/registry.ts`, `providers/flux-fal.ts`).
- **Evidence tags:** `[VERIFIED]` = checked this session (fal docs pages / repo files); `[ASSERTED]` =
  founder decision; `[UNCONFIRMED]` = assumption/risk.

---

## 1. Problem & intent

Reference grounding conditions each request with up to 4 photos — powerful, but per-request and
identity-focused. The founder wants **genuine training on the licensed corpus** so generated content
carries the _learned_ professional carpet-cleaning equipment aesthetic without needing photos
attached to every call. This slice trains ONE style LoRA on all 163 owned carpet-cleaning images and
wires it into generation — including **composing with reference grounding in a single call**.

## 2. Verified platform facts `[VERIFIED 2026-07-11 — fal.ai model pages]`

| Fact                 | Value                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trainer              | `fal-ai/flux-2-trainer-v2` — fine-tunes **FLUX.2 [dev]** LoRAs                                                                                                    |
| Cost                 | **$0.0064 × steps** ($6.40 @ default 1000; range 100–10000, step 100)                                                                                             |
| Input                | `image_data_url`: ONE zip URL; "images of a consistent style. Try to use at least 10"; per-image `ROOT.txt` caption files, else `default_caption`, else **error** |
| Other params         | `steps` (default 1000), `learning_rate` (default 0.00005), `output_lora_format` (default `"fal"`)                                                                 |
| Output               | `diffusers_lora_file` (hosted URL) + `config_file`                                                                                                                |
| LoRA inference (t2i) | `fal-ai/flux-2/lora` — `loras: [{path, scale}]` max 3; guidance 2.5 / 28 steps defaults                                                                           |
| LoRA inference (i2i) | **`fal-ai/flux-2/lora/edit` — takes `image_urls` AND `loras` together** → style LoRA + reference grounding compose                                                |
| FLUX.2 [pro]         | **No `loras` param** (zero-config by design) — LoRA inference is dev-tier only                                                                                    |
| Queue + storage      | fal queue API (existing adapter pattern); `@fal-ai/client` npm handles zip upload to fal storage + queue subscribe                                                |

**Corpus fact `[VERIFIED]`:** `public/reference-library/carpet-cleaning/` = 163 webp, 19 MB — 25
first-party (wand 18 + job photos) + ~138 CCW catalogue images across 55 products; every image owned
with provenance; per-subject labels available in the manifest for caption derivation.

## 3. Decisions locked

| #   | Decision           | Choice                                                                                                                                                                                                                                                    |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Pilot target       | **Carpet-industry STYLE LoRA** `[ASSERTED — founder chose style over wand-identity]`: all 163 carpet images as one "consistent style" set. Learns the real-equipment aesthetic, not one product. Trigger token **`ccwcarpet`**.                           |
| L2  | Slice depth        | **Train + inference wiring**: observable end-to-end (LoRA-styled generation with no reference photos attached), plus the combined LoRA+grounding call.                                                                                                    |
| L3  | Spend gate         | **Flag-gated**: script refuses without `--confirm-spend`; prints exact `steps × $0.0064` before submitting; **hard cap 2300 steps (~$14.72)** per run.                                                                                                    |
| L4  | Captions           | **Per-image captions derived from the manifest** (each image's subject label + the trigger token: `"<label>, ccwcarpet style photography"`), not a single default_caption — richer signal, free from provenance.                                          |
| L5  | LoRA metadata home | Committed **`public/reference-library/trained-loras.json`** — a derived-artefact registry with the same audit discipline as the manifest.                                                                                                                 |
| L6  | Rights lineage     | A LoRA is a **derived artefact of specific licensed images**: the registry records the exact source-image list (files + contentHashes from the manifest) so if any supplier's rights change, affected LoRAs are identifiable for retirement in one query. |

## 4. Architecture

```
manifest.json (carpet-cleaning, owned)                 [existing]
        │ derive dataset: image files + per-image captions (L4)
        ▼
scripts/lib/lora-train-core.ts        pure: dataset plan, captions, spend math, cap, registry entry
scripts/train-carpet-style-lora.ts    I/O: zip build → @fal-ai/client storage upload →
        │                             flux-2-trainer-v2 (queue, --confirm-spend gate L3)
        ▼
public/reference-library/trained-loras.json   {id, kind, industry, triggerToken, loraUrl, configUrl,
        │                                      trainedAt, steps, learningRate, costUsd, imageCount,
        │                                      sourceImages[{file, contentHash}]}          (L5, L6)
        ▼
lib/services/ai/image/registry.ts     NEW entry: fal-ai/flux-2/lora (grounding-capable, lora-capable)
lib/services/ai/image/providers/flux-lora-fal.ts   no refs → /lora  |  refs → /lora/edit (compose)
lib/services/ai/image-generation.ts   opt-in `loraId?` option → resolve from trained-loras.json
studio-tools generate_image           optional `loraId` arg (thread-through, like referenceSet)
```

## 5. Training script — `scripts/train-carpet-style-lora.ts` (+ pure core)

1. **Dataset plan (pure):** from the bundled manifest, list every owned `carpet-cleaning` image with
   its subject label → `[{file, caption: "<label>, ccwcarpet style photography", contentHash}]`.
   Zero-image or missing-file → abort before any spend.
2. **Zip build (I/O):** stage `NN-<file>` + matching `NN-<file>.txt`… **`[VERIFIED]` caption file
   naming is `ROOT.txt` for `ROOT.<ext>`** — e.g. `photo.webp` → `photo.txt`. Keep original
   filenames (unique already), one flat zip.
3. **Upload:** `@fal-ai/client` (`fal.storage.upload`) — new **devDependency** (name:
   `@fal-ai/client`; reason: fal storage upload + queue subscribe for training; zero prod-bundle
   impact — script-only import).
4. **Spend gate (L3):** compute cost; without `--confirm-spend` print the plan + cost and exit 0
   ("dry" behaviour by default). `--steps N` optional (default 1000; reject N > 2300 or N < 100).
5. **Train:** submit `fal-ai/flux-2-trainer-v2` `{image_data_url, steps, learning_rate: 0.00005}`
   via queue subscribe (logs streamed); on success write the registry entry (L5/L6) with
   `id: 'carpet-style-v1'` (id collision → `-v2` etc. by flag, never overwrite silently).
6. **Failure modes:** upload/train error → no registry write, non-zero exit; partial zip → abort
   pre-upload; the registry file is written atomically (tmp+rename).

## 6. Inference wiring

- **Registry:** add `fal-ai/flux-2/lora` to `IMAGE_MODELS` — `provider: 'fal'`, `tier: 'standard'`,
  `grounding: true`, new capability flag `loras: true` (existing entries `loras: false`;
  `flux-2-pro` remains the default grounding model when NO lora is requested — selection only
  routes to `/lora` when a `loraId` is supplied).
- **Adapter `flux-lora-fal.ts`:** `generateFluxLoraImage({prompt, loras: [{path, scale?}],
imageUrls?, seed?})` → no `imageUrls` → `POST fal.run/fal-ai/flux-2/lora`; with `imageUrls` →
  `POST fal.run/fal-ai/flux-2/lora/edit`. Same auth/error/timeout idiom as `flux-fal.ts`.
- **`generateImage` option `loraId?: string`** (opt-in, like `referenceSet`):
  - resolve from `trained-loras.json` (bundled import, same Vercel-safe pattern as the manifest
    `[VERIFIED — the manifest-bundle fix]`); unknown id → **fail-open**: log + proceed without the
    LoRA (never hard-fail a generation).
  - When both `loraId` AND references resolve → `/lora/edit` with both (the compose case).
    LoRA only → `/lora`. References only → existing `flux-2-pro` path unchanged.
  - If the prompt lacks the LoRA's `triggerToken`, log a warning (style may not activate) — do not
    mutate the prompt.
  - Result metadata gains `{loraId, triggerToken}`; existing grounding lineage unchanged.
- **`generate_image` tool:** optional `loraId: z.string().min(1).optional()` threaded through —
  no other contract change; still `riskClass:'draft'`.

## 7. Rights & audit

- Training set = **owned images only** (the dataset plan reads the same owned-filtered manifest the
  resolver enforces). The zip is built from local repo files — no third-party fetch.
- `trained-loras.json` records the full source-image list with contentHashes (L6). **Retirement
  query:** given a revoked vendorKey → manifest lists its files → any LoRA whose `sourceImages`
  intersects → retire (delete entry; regenerate LoRA from the pruned corpus if still wanted).
- The trained LoRA file lives on fal's storage (hosted URL). `[UNCONFIRMED]` fal artefact retention
  period — mitigation: registry stores the URL + config; if fal expires artefacts, re-training from
  the recorded recipe reproduces it (~$6.40). Downloading a local backup of the .safetensors into
  object storage is a named follow-on.

## 8. Testing

- **Core (pure, fixtures):** caption derivation from a synthetic manifest (label + token, webp→txt
  naming); dataset plan excludes non-owned/missing; spend math (`steps × 0.0064`), cap rejection
  (>2300, <100); registry entry shape incl. sourceImages hashes; id-collision behaviour; atomic
  write helper.
- **Adapter:** mocked fetch — `/lora` without imageUrls, `/lora/edit` with; `loras` array passed
  verbatim; error paths.
- **generateImage:** mocked adapter — `loraId` resolves and routes (lora-only, lora+refs compose,
  refs-only unchanged to flux-2-pro); unknown `loraId` fail-open; trigger-token warning; metadata.
- **Tool:** arg accepted + threaded (existing contract tests untouched — no new tool).
- **Gate:** `npm run type-check && npm run lint && npm test`.

## 9. Execution & verification runbook (founder-gated spend)

1. `npx tsx scripts/train-carpet-style-lora.ts` (no flag) → prints dataset plan (163 images, caption
   sample, steps, **exact cost $6.40**) and exits without spending.
2. `npx tsx scripts/train-carpet-style-lora.ts --confirm-spend` → zip → upload → train (~minutes on
   fal) → paste the result → `trained-loras.json` gains `carpet-style-v1` → commit.
3. Gate green → PR (auto-merge → deploy: the bundled registry ships).
4. **Proof A (pure style, no refs):** `generate_image` `{prompt: "a professional carpet cleaning
setup in a hotel corridor, ccwcarpet style", loraId: "carpet-style-v1"}` → assert the result
   carries `loraId` metadata + no error; **founder eyeballs** that the real-equipment aesthetic
   carries (style success is a judgement call — verification-gate style confirmation).
5. **Proof B (compose):** same + `referenceSet: "carpet-cleaning"` → `/lora/edit` path; assert
   grounded lineage AND lora metadata together.

## 10. Acceptance criteria

1. No-flag run spends nothing and prints the exact plan + cost.
2. Gated run produces a registry entry with loraUrl + full sourceImages (163) + costUsd.
3. Unit suites green; full gate green; no new MCP tool (contract counts untouched).
4. Post-deploy Proof A returns a lora-tagged, error-free generation; Proof B composes lora +
   grounding in one call with both lineages in the result.
5. Retirement query is demonstrable: given a vendorKey, the intersect against sourceImages
   identifies `carpet-style-v1` (documented, exercised once against the real registry file).

## 11. Out of scope / follow-ons

- Wand-identity LoRA (config change once this pipeline exists), water-damage style LoRA (corpus
  ready — 139 images), upholstery (only 8 images — below quality floor for style).
- Auto-retraining on corpus growth; local .safetensors backup to object storage; video LoRAs;
  LoRA use in the video pipeline; exposing `loraId` in the app UI.
- **Clay style**: once this LoRA exists, `grounded-visuals` can offer `ccwcarpet` + clay prompt
  treatment together — noted for that skill's spec.
