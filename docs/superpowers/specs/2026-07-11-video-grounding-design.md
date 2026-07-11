# Design Spec — Video Grounding (v2 slice)

- **Date:** 2026-07-11
- **Status:** Draft (design approved; awaiting spec review)
- **Author:** Synthex build (brainstorming → spec)
- **Follows:** the shipped image-grounding slice
  (`docs/superpowers/specs/2026-07-11-reference-grounded-image-generation-design.md`)
- **Evidence tags:** `[VERIFIED]` = checked against a file/line this session;
  `[INFERENCE]` = reasoned from verified material; `[UNCONFIRMED]` = assumption/risk.

---

## 1. Problem & intent

Video generation is text/method-card driven, so clips of equipment look synthetic. The founder
wants clips **grounded on the real owned reference photos** (the same `public/reference-library/`
set) — the clip should start from a real CCW product and animate. This reuses the reference
resolver and the existing image-to-video (I2V) path; it is grounding, not fine-tuning.

`[VERIFIED]` The video pipeline already supports an I2V seed end-to-end:
`lib/services/ai/video/generation-service.ts` `submitGenerativeVideo(req)` reads `req.imageUrl`,
calls `resolveModel(tier, { …, requiresImage: Boolean(req.imageUrl) })` (line 43) so an
image-capable model is auto-selected, passes `image_url: req.imageUrl` to fal (line 83), and
persists `inputImageUrl` (line 106). So grounding = _fill `imageUrl` from the reference set_.

## 2. Scope

### In scope (this slice)

- Seed video generation from a **single** owned reference photo (the first image of the resolved
  set), via the existing I2V `imageUrl` path.
- Opt-in gating + owned-only rights (reuse the image-slice pattern and the existing resolver).
- Wire the `generate_video` studio-tool (and therefore MCP + REST + copilot).

### Out of scope (later cycles)

- Multi-image reference (Seedance `@Image` reference-tagging) — richer identity carry, new
  model-specific adapter wiring.
- The orchestration/"specialised" skills (brief → industry → refs → output).
- A persisted `grounded` column (grounded rides the in-memory result; `inputImageUrl` already
  records the seed).
- Live verification (needs a deployed `NEXT_PUBLIC_APP_URL` — see §9).

## 3. Decisions locked (this session)

| #   | Decision                                          | Choice                                                                                                                                        |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Ref → video mechanism                             | **Single seed image via existing I2V `imageUrl` path** (reuse; no new infra)                                                                  |
| V2  | Precedence (explicit `imageUrl` + `referenceSet`) | **Explicit `imageUrl` wins**; the reference only fills an empty seed                                                                          |
| V3  | Gating                                            | **Opt-in**, identical to image: grounded only when `useReferences` is not `false` AND (`useReferences === true` OR a `referenceSet` is given) |
| V4  | Rights                                            | **Owned-only** (resolver already enforces)                                                                                                    |
| V5  | Model when grounded                               | Reuse `resolveModel` — a seed makes `requiresImage:true`, auto-selecting an image-capable model (Seedance I2V/Kling/Veo) at the caller's tier |

## 4. Architecture & components

Reuses (no change): `reference-library.ts` resolver, `video/registry.ts`, `fal-adapter.ts`,
quota, webhook.

### 4.1 Types — `lib/services/ai/video/types.ts`

- `GenerativeVideoRequest` gains `referenceSet?: string`, `useReferences?: boolean`.
- `SubmittedJob` gains `grounded?: boolean`, `referenceSet?: string`.

### 4.2 Resolution step — `submitGenerativeVideo` (top of the function)

Compute a local `seedImageUrl` — **do not mutate `req`**:

```ts
const useRefs =
  req.useReferences !== false &&
  (req.useReferences === true || Boolean(req.referenceSet));
let grounded = false;
let groundedSet: string | null = null;
let seedImageUrl = req.imageUrl; // V2: explicit wins
if (useRefs && !seedImageUrl) {
  try {
    const { resolveReferences } =
      await import('@/lib/services/ai/reference-library');
    const refs = resolveReferences({
      set: req.referenceSet,
      prompt: req.prompt,
    });
    if (refs.count > 0) {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
      if (base) {
        seedImageUrl = `${base}${refs.imagePaths[0]}`;
        grounded = true;
        groundedSet = refs.industry;
      } else
        logger.warn(
          'video grounding skipped: NEXT_PUBLIC_APP_URL not configured'
        );
    }
  } catch (e) {
    logger.warn('video grounding failed; ungrounded', { e });
  }
}
```

**`grounded` semantics:** `grounded` means "seeded from an owned reference set." When an
explicit `req.imageUrl` is supplied, that is the caller's own seed — `grounded` stays `false`
(the reference library was not the source), even though the clip is still image-seeded.
Then replace the **four** `req.imageUrl` reads with `seedImageUrl`:
`methodCard.requiresImage && !seedImageUrl` (line 31), `requiresImage: Boolean(seedImageUrl)`
(line 43), `...(seedImageUrl ? { image_url: seedImageUrl } : {})` (line 83), and
`inputImageUrl: seedImageUrl` (line 106). The rest of the pipeline is unchanged.
Tag each returned `SubmittedJob` with `{ grounded, referenceSet: groundedSet }`.

### 4.3 Tool surface — `generate_video` (studio-tools/index.ts)

- `GenerateVideoArgs` gains `referenceSet?: z.string().min(1).optional()`,
  `useReferences?: z.boolean().optional()`.
- `[VERIFIED]` The tool already calls `submitGenerativeVideo({ ...a, ...ctx })`, so the new args
  auto-thread. Update the tool description to note grounding requires `referenceSet` or
  `useReferences:true`. Stays `riskClass:'draft'`.

## 5. Data flow

```
generate_video(prompt, referenceSet?)  →  submitGenerativeVideo
  → gate (opt-in) → seedImageUrl = req.imageUrl ?? absolute(first owned ref)
  → UNCHANGED pipeline: resolveModel(requiresImage) → holdQuota → submitToFal(image_url)
    → videoGeneration row (inputImageUrl set) → job {grounded, referenceSet}
  → poll get_job → webhook completes as today
```

## 6. Governance

- Owned-only enforced by the resolver (real photos only; no third-party/synthetic).
- Opt-in gate means existing `generate_video` callers (no `referenceSet`/`useReferences`) are
  **unchanged**.
- No new provider, no new spend surface; existing quota-hold covers the I2V model cost (an
  image-capable tier may cost more than text-to-video at the same tier — the caller's tier still
  governs).

## 7. Error handling

- Resolver miss / empty owned set / thrown error → proceed **ungrounded** (text-to-video); never
  hard-fail.
- Empty `NEXT_PUBLIC_APP_URL` → skip grounding + warn (fal can't fetch a relative seed).
- All existing failure handling (quota release on partial submit, orphaned-job logging, webhook)
  is untouched.

## 8. Testing (jest, hermetic — mock `submitToFal`, `prisma`, `holdQuota`; no fal/DB/spend)

- **Grounded seed:** `referenceSet:'carpet-cleaning'` (no `imageUrl`) → `submitToFal` receives
  `image_url` = the absolute first-ref URL; returned job `grounded:true`, `referenceSet` set.
- **Precedence:** explicit `imageUrl` + `referenceSet` → `image_url` is the explicit one and the
  job is **not** `grounded` (the library wasn't the source); assert the explicit URL is used and
  `grounded === false`.
- **Opt-in:** bare prompt, no set/flag → no `image_url`, not grounded; `useReferences:true` +
  cleaning prompt → grounded via auto-detect.
- **Hard-off:** `useReferences:false` + `referenceSet` → not grounded, no `image_url`.
- **Fail-open:** resolver throws / empty `APP_URL` → ungrounded, no throw.
- **Model selection:** with a seed, `resolveModel` is called with `requiresImage:true` (assert an
  image-capable model id is chosen).
- **Tool:** `generate_video` threads `referenceSet` into `submitGenerativeVideo`.

## 9. Risks & assumptions

- `[UNCONFIRMED]` Live grounded video needs a deployed `NEXT_PUBLIC_APP_URL` — fal fetches the
  seed over the public internet. (The webhook already requires a public URL, so video is
  inherently deploy-validated.) Local tests mock fal.
- `[INFERENCE]` `resolveModel(requiresImage:true)` always yields an image-capable model across
  all tiers — `[VERIFIED]` Seedance Fast I2V (draft), Kling 3 Pro (premium), Veo 3.1 (premium)
  carry `supportsImageInput:true`; confirm a draft-tier image-capable model exists so grounded
  draft video resolves.
- `[UNCONFIRMED]` A photo seed animates acceptably for equipment b-roll — validated at live time,
  not unit-testable.

## 10. Acceptance criteria

1. `generate_video` with `referenceSet:'carpet-cleaning'` submits an I2V job whose `image_url` is
   the absolute first carpet-wand reference URL; the job is tagged `grounded`.
2. An explicit `imageUrl` is never overridden by `referenceSet`.
3. A bare prompt (no set, no `useReferences:true`) is unchanged from today (text-to-video, not
   grounded).
4. `useReferences:false` is a hard opt-out even with a `referenceSet`.
5. Resolver miss/error or empty `APP_URL` → ungrounded, never a hard fail.
6. `npm run type-check && npm run lint && npm test` green; new unit tests included; **and the
   sandbox integration tool-count assertion is unaffected** (no new MCP tool added here).

## 11. File change list (for the plan)

- EDIT `lib/services/ai/video/types.ts` (`GenerativeVideoRequest` + `SubmittedJob` fields)
- EDIT `lib/services/ai/video/generation-service.ts` (resolution step + `seedImageUrl` swap + job tags)
- EDIT `lib/services/ai/studio-tools/index.ts` (`GenerateVideoArgs` + `generate_video` description)
- NEW `tests/unit/ai/video-grounding.test.ts`, NEW `tests/unit/ai/video-grounding-tool.test.ts`
- No new file, no new provider, no new MCP tool, no DB migration.

## 12. As-shipped deviations (from final review — 2026-07-11)

- **Standard-tier fail-open fallback.** The video registry has no image-capable `standard`-tier
  model, so an auto-grounded seed on `standard` tier made `resolveModel` throw. As shipped: when a
  seed was **auto-grounded** (not an explicit caller `imageUrl`) and the method card does not
  require an image, model-selection failure **drops the seed and proceeds ungrounded** (preserving
  fail-open). An explicit `imageUrl` or an image-requiring card still throws (legitimate
  "tier/card needs an image but has none"). Default tier is `draft`, which _does_ have an I2V
  model, so common-case grounding works. **Follow-on:** add a verified `standard`-tier Seedance
  image-to-video model to `video/registry.ts` to actually enable standard-tier grounding
  (needs the exact fal endpoint id + pricing confirmed live).
- Verified end-to-end: opt-in isolates existing callers (the REST video route's schema strips the
  ref fields), no SSRF (seed host pinned to `NEXT_PUBLIC_APP_URL` + `Object.hasOwn` manifest guard),
  quota-safe. Live grounded video deferred (needs deployed `NEXT_PUBLIC_APP_URL`).
