# Real Images Only — Always-On Rule

> **Authority**: Always loaded. Applies to ALL tasks that create, plan, or discuss
> image/video generation anywhere in Synthex. Founder-mandated 2026-07-12
> ("We are not using AI invented, we are generating from Real Images — anywhere and
> everywhere"). Spec: `docs/superpowers/specs/2026-07-12-real-images-only-design.md`.
> Companion to `verification-gate.md` and `fabel-evidence-standard.md`.

## The rule

Synthex generates visuals **from the founder's owned real-photo library — never from
model imagination**. This is enforced in code, not aspiration:

- **The ONLY sanctioned entry point** for image generation is
  `generateImage()` / `generateBatch()` in `lib/services/ai/image-generation.ts`
  (video: `submitGenerativeVideo()` in `lib/services/ai/video/generation-service.ts`;
  agents/MCP: the `generate_image` / `generate_video` studio tools). A static guard —
  `tests/unit/ai/no-direct-image-apis.test.ts` — **fails CI** on any direct
  OpenAI/Gemini/Stability/fal/stock-photo call outside the service layer. Do not add
  one. Do not "just call Gemini". Do not use placeholder/stock URLs in product surfaces.
- **Grounded by default.** Every call auto-detects the industry from the prompt,
  resolves owned reference photos (public manifest + private signed URLs), and
  **auto-applies the industry's trained LoRA**. No flags needed — a bare prompt is
  already grounded.
- **No owned references ⇒ BLOCKED** (`blocked: true`, HTTP 422):
  _"No owned references for this subject — add real photos to the reference library
  first."_ This is correct behaviour, not an error to work around. The fix is always
  **add real photos**, never bypass.
- **The sole escape hatch** is `useReferences: false` — audited, and every result it
  produces is stamped `grounded: false` + an `UNGROUNDED` warning. Never use it in
  product/brand/client surfaces. Sanctioned exceptions are registered in the spec
  (public demo routes, drift canary) — additions require founder sign-off.

## The system (what exists — discover it, don't rebuild it)

| Piece                                                                                          | Where                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned reference library (manifest, 143+ subjects incl. 135 CCW products)                       | `public/reference-library/manifest.json` (+ README index)                                                                                       |
| Private customer job photos (signed URLs, never public)                                        | Supabase bucket `reference-library-private`; ingest via `POST /api/admin/private-refs`; resolver `lib/services/ai/reference-library-private.ts` |
| Reference resolver (prompt→industry auto-detect, `industry/subject` syntax)                    | `lib/services/ai/reference-library.ts`                                                                                                          |
| Trained LoRA registry (carpet-style-v1, trigger `ccwcarpet`, auto-applies for carpet-cleaning) | `lib/services/ai/image/trained-loras.json` + `trained-loras.ts`                                                                                 |
| LoRA training/retraining pipeline (flag-gated spend)                                           | `scripts/train-carpet-style-lora.ts` (pattern for new LoRAs)                                                                                    |
| 3-variant batches + tap-to-rank learning loop (lineage + insights)                             | dashboard AI Images; `image_generations` table; feedback route                                                                                  |
| Corpus growth from owned videos (frames → private bucket)                                      | Railway media worker + `media_*` MCP tools + fal frame extractor script                                                                         |
| CCW catalogue ingestion (owned/supplier-authorised, provenance)                                | `scripts/ingest-ccw-catalogue.ts`                                                                                                               |

## How this binds your work

- **Building content/brand/video features or skills:** route every visual through the
  sanctioned entry points above. A skill that says "generate an image with <provider>"
  is a defect — fix the skill.
- **A generation blocks?** Report the missing subject and grow the library (real
  photos, CCW ingestion, video frame extraction) — do not switch providers, do not
  use the escape hatch, do not stub with stock.
- **Quality is judged by the founder's rank/reject feedback loop** — keepers and
  rejections (with reasons) are the training signal for prompt templates, corpus
  gaps, and LoRA retrains. Check `image_generations` insights before guessing what
  "good" looks like.
- **Before designing anything visual**, read the library manifest and
  `list_reference_sets` — what already exists determines what can be generated.
