# Design Spec — Carpet-Industry Style LoRA (train + inference, slice 1) — v2

- **Date:** 2026-07-11 (v2 — 21 adversarial-review findings folded, 5 critical; cost corrected from fal's authoritative page)
- **Status:** Approved design (founder pre-approved; cap raised to $26/run, full 1000 steps)
- **Type:** Training script + trained-LoRA registry + inference wiring. **No DB migration, no new MCP tool; `generate_image` gains ONE optional Zod arg (schema tests updated accordingly).**
- **Evidence tags:** `[VERIFIED]` / `[ASSERTED]` / `[UNCONFIRMED]`.

---

## 1. Problem & intent

Reference grounding conditions each request with photos; the founder wants **genuine training on
the licensed corpus** so generated content carries the _learned_ professional carpet-cleaning
equipment aesthetic without photos attached per call. Slice 1 trains ONE style LoRA on all 163
owned carpet-cleaning images and wires it into generation, including the LoRA+references compose
call.

## 2. Verified platform facts `[VERIFIED 2026-07-11 — fal model pages, re-fetched]`

| Fact                 | Value                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trainer              | `fal-ai/flux-2-trainer-v2` — FLUX.2 **[dev]** LoRAs                                                                                               |
| **Cost (corrected)** | **$0.0255 × steps → $25.50 @ 1000 steps** (llms.txt authoritative; an earlier snippet showed $0.0064 — superseded). Range 100–10000, **step 100** |
| Input                | `image_data_url`: ONE zip; ≥10 images; per-image `ROOT.txt` captions (for `ROOT.<ext>`), else `default_caption`, else error                       |
| Output               | `diffusers_lora_file` (fal-hosted URL) + `config_file`                                                                                            |
| LoRA t2i             | `fal-ai/flux-2/lora` — `loras: [{path, scale}]` max 3                                                                                             |
| LoRA i2i             | `fal-ai/flux-2/lora/edit` — `image_urls` + `loras` together                                                                                       |
| FLUX.2 [pro]         | NO `loras` param — LoRA inference is dev-tier only                                                                                                |
| Upload/queue         | `@fal-ai/client` (`fal.storage.upload`, `fal.queue.*`) — docs recommend queue+webhook for long jobs; a local script may poll `queue.status`       |

**Corpus `[VERIFIED]`:** 163 webp / 19 MB in `public/reference-library/carpet-cleaning/` — 25
first-party + 138 CCW catalogue (exact; no tildes). Manifest has labels for every subject;
contentHashes exist for CCW images only — **therefore the dataset hashes are COMPUTED from the
bytes actually zipped, never copied from the manifest** (fold: hash-pinning finding).

## 3. Decisions locked

| #   | Decision      | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | Pilot         | Carpet-industry **style** LoRA, all 163 images, trigger token **`ccwcarpet`** `[ASSERTED]`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| L2  | Depth         | Train + inference wiring (incl. compose)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| L3  | Spend gate    | Flag-gated (`--confirm-spend`); prints exact `steps × $0.0255`; **cap $26.00/run** (`steps ≤ 1000` at current price — the cap is DOLLARS, steps derived); default run = 1000 steps = **$25.50** `[ASSERTED — founder raised cap]`                                                                                                                                                                                                                                                                            |
| L4  | Captions      | **Source-differentiated** (fold: style-collapse critical): CCW catalogue images → `"<label>, product photo on white background, ccwcarpet style"`; first-party job/studio photos → `"<label>, on-site job photo, ccwcarpet style"` — the white background is explained by caption text instead of absorbed into the trigger token. **First-party images are oversampled 3× in the zip** (25→75 copies; ~213 zip entries) to rebalance the 85/15 catalogue/job skew. Missing/empty label → abort before spend |
| L5  | Registry home | **`lib/services/ai/image/trained-loras.json`** — bundled import (Vercel-safe), **NOT under `public/`**: the registry holds fal-hosted LoRA URLs, and anything in `public/` is CDN-served verbatim — placing it there would publish the LoRA download URLs (fold: critical)                                                                                                                                                                                                                                   |
| L6  | Lineage       | `sourceImages` is **self-contained**: `{path (industry-qualified), sha256 (computed at zip time), vendorKey (pinned at training time)}` — the retirement query never joins through the live manifest (fold: critical)                                                                                                                                                                                                                                                                                        |
| L7  | Image format  | Zip converts webp → **JPEG q95** via sharp (trainer webp support undocumented — removes the unknown)                                                                                                                                                                                                                                                                                                                                                                                                         |

## 4. Architecture

```text
manifest.json (carpet-cleaning, owned)                    [existing, read-only]
        │ dataset plan: files + labels → captions; abort on missing label/file
        ▼
scripts/lib/lora-train-core.ts     pure: plan, captions, spend math ($/steps, cap, step-of-100),
        │                          registry entry build/validate, findLorasForVendor
scripts/train-carpet-style-lora.ts I/O: webp→jpg, zip, fal.storage.upload, queue submit
        │                          (prints request_id IMMEDIATELY), poll status, --recover <id>
        ▼
lib/services/ai/image/trained-loras.json    committed EMPTY as { "version": 1, "loras": [] } in
        │                                   THIS slice's code PR (bootstrap); the training run
        │                                   adds carpet-style-v1 in a follow-up commit (fold)
        ▼
image registry + flux-lora-fal adapter + generateImage loraId? + generate_image loraId arg
```

## 5. Training script

1. **Dataset plan (pure):** every owned carpet-cleaning image + label → caption. Missing file OR
   missing/empty label → abort (exit 1, zero spend). Prints count + 3 sample captions.
2. **Zip build (I/O):** flat zip; keep original **basenames** (oversampled first-party copies get `-dupN` suffixed basenames with matching `.txt`, preserving the ROOT rule); each `ROOT.webp` → converted
   `ROOT.jpg` + caption file `ROOT.txt` (extension **replaced**, not appended). _(Fold: the v1
   `NN-` prefix language was contradictory — deleted. One rule: original basenames.)_ Unit test
   pins the `ROOT.jpg`/`ROOT.txt` pairing.
3. **Upload:** `@fal-ai/client` — new devDependency (script-only; zero prod-bundle impact).
   `[UNCONFIRMED]` client ESM/tsx interop — verify at implementation; fallback is raw
   fetch upload per fal's HTTP docs, isolated in the CLI.
4. **Spend gate:** no `--confirm-spend` → print plan + exact cost, exit 0, zero spend.
   `--steps N`: reject N<100, N>steps-for-$26 (=1000 at $0.0255), or N not a multiple of 100.
5. **Train:** `queue.submit` → **print `request_id` FIRST**, then poll status with logs. On
   success the SCRIPT writes the registry entry (atomic tmp+rename) — no manual paste step
   (fold: contradiction resolved). On any failure after submission: registry untouched; the
   printed request_id + **`--recover <request_id>`** mode (fetch queue result → write entry)
   covers "money spent, write/commit failed" (fold).
6. **Registry entry shape (exact, Zod-validated in core):**
   ```jsonc
   {
     "version": 1,
     "loras": [
       {
         "id": "carpet-style-v1",
         "kind": "style",
         "industry": "carpet-cleaning",
         "triggerToken": "ccwcarpet",
         "loraUrl": "…",
         "configUrl": "…",
         "trainedAt": "YYYY-MM-DD",
         "steps": 1000,
         "learningRate": 0.00005,
         "costUsd": 25.5,
         "imageCount": 163,
         "falRequestId": "…",
         "status": "active",
         "sourceImages": [
           {
             "path": "carpet-cleaning/<file>.webp",
             "sha256": "…",
             "vendorKey": "…",
           },
         ],
       },
     ],
   }
   ```
   Id collision → refuse (suggest `-v2`); never overwrite.

## 6. Inference wiring

- **Registry:** `IMAGE_MODELS` gains `fal-ai/flux-2/lora` with new capability `loras: true`
  (all existing entries `loras: false`). **Selection mechanism (fold — mechanism, not outcome):**
  `selectImageModel` EXCLUDES `loras: true` entries from every default/grounding selection path;
  the `/lora` model is chosen ONLY via a new explicit call
  `selectImageModel({ needsLora: true })` which generateImage uses IFF a `loraId` resolved.
  Existing guarantees (flux-2-pro for grounding, deprecated exclusions) unchanged + regression-
  tested.
- **Adapter `flux-lora-fal.ts`:** `{prompt, loras:[{path, scale?}], imageUrls?, seed?}` →
  `/lora` (no imageUrls) | `/lora/edit` (with). `scale` omitted → fal default (fold: stated).
  Same auth/timeout/error idiom as `flux-fal.ts`.
- **`generateImage` `loraId?`:** resolved from the bundled registry. **Fail-open rule (single,
  observable — fold):** ANY resolution failure (unknown id, empty registry, malformed entry) →
  log reason + proceed without the LoRA + result carries `loraRequested: <id>, loraApplied:
false` (success carries `loraApplied: true, loraId, triggerToken`). **These lora fields are ALSO duplicated into `result.metadata`** (fold): the media route persists only the metadata spread, so top-level-only fields would be dropped from saved assets — metadata carriage gives persisted images durable LoRA lineage. Compose: loraId+refs →
  `/lora/edit` with both; loraId only → `/lora`; refs only → flux-2-pro (unchanged).
  Trigger-token-missing warning goes in the RESULT (`warnings: []`) as well as the log (fold:
  visible to MCP callers).
- **Compose honesty `[UNCONFIRMED]`:** `/lora/edit`'s `image_urls` are edit inputs, not
  identity-reference slots — whether it behaves as "grounding + style" is validated at Proof B;
  the spec does not promise equivalence with flux-2-pro grounding.
- **`generate_image` tool:** optional `loraId` arg; **the generate_image schema contract tests
  are updated for the new optional arg** (fold — schema changed even though no new tool).

## 7. Rights & audit

- Training set = owned images only; zip built from local repo files.
- **Self-contained retirement:** `findLorasForVendor(registry, vendorKey)` (pure, in core) scans
  `sourceImages[].vendorKey` directly — no manifest join (fold). Unit test runs it against the
  real registry post-training and asserts `carpet-style-v1` is found for a known CCW vendorKey.
- **Retirement contract (fold — TOMBSTONE, never delete):** retire = set `status: "retired", retiredAt, reason` ON the entry (keeping loraUrl + sourceImages as the audit record — deleting would erase the trail and the URL you are obliged to dispose of); the resolver accepts only `status === "active"`; then **redeploy**
  (bundled import means retirement takes effect only on deploy — same one-way as the corpus
  removal contract) + `fal.storage` deletion of the binary is `[UNCONFIRMED]` (fal may not expose
  delete; the URL may persist — recorded as an accepted limitation; the URL is unguessable and no
  longer referenced). Generations already made with a retired LoRA carry `loraApplied/loraId` in
  their (ephemeral) result metadata only — durable artefact-side LoRA lineage is a named follow-on
  (same status as image grounding lineage persistence).
- Registry lives OUTSIDE `public/` (L5) — LoRA URLs are not published.

## 8. Testing

- **Core:** dataset plan (labels→captions; missing label/file aborts); `ROOT.jpg`/`ROOT.txt`
  pairing; spend math at $0.0255 (cap $26 → steps ≤1000; reject non-multiples of 100, <100);
  registry entry Zod shape + id-collision refusal; `findLorasForVendor`; atomic write.
- **Adapter:** `/lora` vs `/lora/edit` routing; `loras` passed verbatim; error paths.
- **generateImage:** loraId resolves → routes + `loraApplied:true`; unknown/empty/malformed →
  fail-open + `loraApplied:false`; compose (loraId+refs → `/lora/edit` with both); refs-only →
  flux-2-pro regression; trigger-token warning in result; selection exclusion regression
  (`needsReferences` never returns the `/lora` entry).
- **Tool:** `loraId` threaded; generate_image schema tests updated.
- **Gate:** `npm run type-check && npm run lint && npm test`.

## 9. Execution runbook (founder-gated: **$25.50**)

1. Code PR ships FIRST with the **empty registry** (bootstrap — fold) + all wiring; gate green;
   deploy. (LoRA-less deploys are safe: `loraApplied:false` fail-open.)
2. `npx tsx scripts/train-carpet-style-lora.ts` → plan + cost ($25.50), zero spend.
3. `--confirm-spend` → request_id printed → training (~minutes–an hour) → registry entry written.
   **Commit gate (fold):** the follow-up PR's diff MUST contain the registry entry; a unit test
   validates every entry against the Zod schema, and the runbook checks `git status` clean.
4. Deploy → **Proof A:** `generate_image {prompt: "a professional carpet cleaning setup in a hotel
corridor, ccwcarpet style", loraId: "carpet-style-v1"}` → `loraApplied:true`, no error; founder
   eyeballs the aesthetic. **Style-collapse risk `[UNCONFIRMED]`:** ~85 % of the corpus is
   white-background catalogue shots — the style may skew clinical; if so, a job-photo-weighted
   retrain is the recorded remedy (follow-on, new run ≤$26).
5. **Proof B (compose):** + `referenceSet: "carpet-cleaning"` → `/lora/edit`; assert lora + ref
   lineage together; founder eyeballs.
6. Retirement drill: run `findLorasForVendor` against the real registry for one CCW vendorKey →
   returns `carpet-style-v1` (documented output pasted).

## 10. Acceptance criteria

1. No-flag run: zero spend, prints plan + $25.50.
2. Gated run: registry entry with loraUrl/configUrl/falRequestId + sourceImages matching the
   printed dataset-plan count, each with computed sha256 + vendorKey.
3. Full gate green; generate_image schema tests updated; no new MCP tool.
4. Proof A returns `loraApplied:true` + founder confirmation; Proof B composes with both lineages.
5. `findLorasForVendor` retirement drill passes against the real registry — INCLUDING for a vendorKey already pruned from the manifest (self-containment proof: the query reads only sourceImages).
6. Fail-open proven: unknown loraId → `loraApplied:false`, generation still succeeds.

## 11. Out of scope / follow-ons

Wand-identity LoRA; water-damage style LoRA (139 imgs ready); upholstery (8 imgs — below floor);
auto-retraining; local .safetensors backup to object storage; durable artefact-side LoRA lineage;
video LoRAs; UI exposure; clay-style treatment (grounded-visuals skill); job-photo-weighted
retrain if Proof A shows catalogue-look collapse.
