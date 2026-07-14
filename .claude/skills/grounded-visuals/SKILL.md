---
name: grounded-visuals
description: THE way to produce any image or video in Synthex — grounded on the founder's owned real-photo library with the industry LoRA auto-applied. Use for every visual asset request (brand, campaign, social, video seed, training material). Never call an image provider directly.
---

# Grounded Visuals — generating from Real Images

> Binding rule: `.claude/rules/real-images-only.md` (always-on, founder-mandated).
> This skill is the HOW. If any other skill's instructions conflict with this one on
> visual generation, THIS skill wins.

## The pipeline (always the same shape)

1. **Check coverage first.** Read `public/reference-library/manifest.json` (or call the
   `list_reference_sets` MCP tool) — which industries/subjects have owned images?
   `industry/subject` syntax targets a specific subject (e.g.
   `carpet-cleaning/carpet-cleaning-wand`). No coverage for the request ⇒ STOP and
   grow the library (step 5); generation will BLOCK by design.
2. **Generate through the sanctioned entry point** — nothing else:
   - Dashboard: AI Images (3-variant batch, grounding default-ON).
   - Code: `generateImage()/generateBatch()` from `lib/services/ai/image-generation.ts`
     with a `GenerationContext`.
   - Agents/MCP: `generate_image` tool (`referenceSet` optional — auto-detect works
     from the prompt; `loraId` optional — the industry LoRA auto-applies).
   - Video: `generate_video` tool / `submitGenerativeVideo()` — seeds I2V from the
     first owned reference photo.
     A bare, well-written prompt is already grounded + LoRA'd. `blocked: true` responses
     are correct behaviour — see step 5.
3. **Prompt for the real scene, and include the trigger token when styling matters.**
   The carpet LoRA's trigger is `ccwcarpet` (check `trained-loras.json` for others —
   the result carries a warning when the token is missing). For job-scene realism say
   what a real job looks like: technician operating the wand, hoses connected to the
   portable extractor, steam rising — the founder rejected batches for wrong machinery,
   disconnected hoses, no operator, no steam (2/10). Equipment identity comes from the
   references; the operating context comes from your prompt.
4. **Rank the batch (or get the founder to).** Tap-to-rank 1-2-3 / reject with reasons
   feeds `image_generations` — this learning loop is the estate's quality signal.
   Check the insights (grounded share, win rates) before asserting what works.
5. **Coverage gap? Grow the library — never bypass:**
   - Real equipment/job photos → public library (repo) or, for customer-identifiable
     job sites, the PRIVATE bucket via `POST /api/admin/private-refs`.
   - Owned job videos → frames via the Railway media worker (`media_extract_frames`
     MCP tool) or `scripts/` fal frame extractor → private bucket.
   - CCW catalogue items → `scripts/ingest-ccw-catalogue.ts` (provenance enforced).
   - Enough new images for a style/identity? Retrain: the
     `scripts/train-carpet-style-lora.ts` pattern (flag-gated spend, founder approval).

## Style options

- Default: photoreal job-photo aesthetic (that's what the corpus + LoRA encode).
- "Clay" style renders (founder-approved option): request via prompt styling on the
  grounded path — still grounded on real equipment geometry; never via ungrounded
  providers.

## Hard NOs (each is a CI failure and a founder-trust failure)

- Direct calls to Gemini/OpenAI/Stability/fal or stock/placeholder image URLs anywhere
  outside `lib/services/ai/` — the guard test will fail the build.
- `useReferences: false` in any product/brand/client surface.
- Treating a `blocked` response as an error to route around.
- Inventing equipment: if the machinery isn't in the library, photograph it or ingest
  it — don't let a model imagine it.
