# Model-agnostic media layer: design spec

**Status:** proposal (22/10/2026), not approved for build
**Client metric:** both — indirectly: CARSI course trailers and clips and RestoreAssist trial-sign-up ad video all depend on a generative video path that today runs through one vendor (fal), so a vendor shutdown stops every video brief for both businesses at once.
**Rests on:** synthex-intel-07-advantages-and-proposals (proposal 7), synthex-intel-03-ai-marketing-platforms (§2 and the build-buy-call rows for image, video, avatar and clips), synthex-intel-05-llm-vendor-docs-2026-10 (OpenAI and Google deprecation tables) and repo evidence in `lib/services/ai/image/registry.ts`, `lib/services/ai/video/*`, `lib/services/ai/video-generation.ts`, `lib/marketing-agency/heygen/client.ts`, `lib/services/ai/media-spend-gate.ts` and `tests/unit/ai/no-direct-image-apis.test.ts`.
**Relation to the fleet programme:** extends P5 (M10, "image and video quotes before spend") and G6/P8 (grounding stays on the owned library) in `2026-10-17-vibe-to-leader-design.md`; no phase covers provider swappability for video. Model IDs, retirement dates and the retired-ID lists are owned by the sibling spec `2026-10-22-model-registry-design.md` and are not repeated here.

## Finish line

Synthex has exactly one sanctioned image path (`generateImage()` / `generateBatch()`) and exactly one sanctioned video path (`submitGenerativeVideo()`), and the legacy Runway/Synthesia/D-ID service and its route are gone. The video catalogue carries a pricing shape per model in the same "unpriced means unusable" form the image registry already uses, so a model billed per output token (Gemini Omni) and one billed per second (fal, xAI, MiniMax) can sit side by side. `generation-service.ts` submits and completes jobs through a provider adapter chosen by the catalogue entry's `provider` field, not through a hard-coded `submitToFal` call, and a second provider can be added by writing one adapter file plus catalogue rows, with no change to the grounding, hold, settle or receipt code. Every image, video and avatar request can be quoted before any spend row exists (P5 quote mode). The Real Images Only guard also flags direct video and avatar provider calls outside the service layer. No new dependency has landed.

## Decision up front

**Call, do not build, every model; build only the thin seam.** Keep the two existing sanctioned entry points and extend the existing catalogues; do not add a third registry, a new facade or a router service. Slice 1 deletes the second, unmetered video service so "one interface" becomes true at HEAD. Slices 2 and 3 port the image registry's discriminated pricing union into the video catalogue and put a submit/complete adapter under `lib/services/ai/video/providers/`, with fal moved behind it first and no behaviour change. A second video vendor (Gemini Omni direct, or xAI/MiniMax) is added only in quote mode until the founder approves the key and spend. Avatars stay on the existing HeyGen client and media spend gate (call), Synthesia for CARSI stays a founder decision (call, not wired), OpusClip is a later call-as-service for owned long-form footage, and deterministic overlays stay on Remotion, which is already installed; HyperFrames is study-only so there is not a second renderer.

## Goals & non-goals

**Goals**

- G1. One sanctioned video service. Today there are two: `submitGenerativeVideo()` (fal, grounded, held) [VERIFIED lib/services/ai/video/generation-service.ts:50] and the legacy `VideoProvider = 'runway' | 'synthesia' | 'd-id'` service [VERIFIED lib/services/ai/video-generation.ts:28], reached from `app/api/media/generate/video/route.ts`, whose own header says `TODO(retire): fold this route into submitGenerativeVideo()` [VERIFIED app/api/media/generate/video/route.ts:31-32].
- G2. A video catalogue that can price more than one provider shape. `VideoModelSpec.provider` is the literal `'fal'` [VERIFIED lib/services/ai/video/types.ts:13] and price is a scalar `costPerSecondUsd` [VERIFIED lib/services/ai/video/registry.ts:20]. The image registry already has the right pattern: a discriminated `ImagePricing` union [VERIFIED lib/services/ai/image/registry.ts:108-111] and "Absent = uncostable = generation fails closed" [VERIFIED lib/services/ai/image/registry.ts:118].
- G3. A swappable submit **and** completion path. The service calls `submitToFal(model.id, …)` directly [VERIFIED lib/services/ai/video/generation-service.ts:256], and completion is fal-webhook specific (`fal-completion.ts`). Gemini Omni is a long-running operation that must be polled [INFERENCE from synthex-intel-05 §Google: "generates, edits and extends video", long-running video API]. An adapter that only abstracts submit is not swappable.
- G4. Grounding stays the default and the only path for product, brand and client surfaces [VERIFIED .claude/rules/real-images-only.md:13-31]. A new provider that cannot take an image input is never selected for a grounded request; the existing fail-closed `GroundingBlockedError` behaviour [VERIFIED lib/services/ai/video/generation-service.ts:159-170] is preserved unchanged.
- G5. Quote before spend for image, video and avatar, through the P5 quote mode, using the estimators that already exist (`estimateImageCostUsd` [VERIFIED lib/services/ai/image/registry.ts:357], video `estimateCostUsd` [VERIFIED lib/services/ai/video/registry.ts:124], HeyGen `priceAvatarVideoUsd` [VERIFIED lib/marketing-agency/heygen/client.ts:34]).
- G6. The Real Images Only guard covers video and avatar endpoints too. Today it detects OpenAI images, Stability, `fal.run/fal-ai/flux`, Picsum and Gemini image literals only [VERIFIED tests/unit/ai/no-direct-image-apis.test.ts:213-245]; a direct Gemini video, xAI video, HeyGen or OpusClip call outside the service layer would pass.

**Non-goals**

- NG1. No model-ID inventory, retirement dates or retired-ID lists: that is `2026-10-22-model-registry-design.md`. This spec consumes its `deprecated`/retired flags.
- NG2. No new registry, no `lib/services/ai/media/` facade, no gateway service (LiteLLM or similar). The two catalogues are extended in place.
- NG3. No building of avatar, clip or video models, and no self-hosted ComfyUI/GPU workers.
- NG4. No change to the escape hatch rules, the sanctioned-exceptions register or `.claude/rules/real-images-only.md` without the founder (that rule file is a protected path).
- NG5. No Governor enforcement flip. The Governor is in shadow mode [VERIFIED lib/ai/governor/mode.ts:13]; the flip is a P9 human act.
- NG6. No launch, pricing or customer-readiness framing. Cost figures here exist only to size holds and caps.

## Approach

Thinnest vertical slice first. Each slice is a separate PR, reversible by revert.

**S1. Retire the second video service (no new code paths).** Delete `lib/services/ai/video-generation.ts` and either delete `app/api/media/generate/video/route.ts` or make it a thin call into `submitGenerativeVideo()`. Every provider there is unconfigured and the module already refuses any metered call ("unmetered video provider refused — no spend hold") [VERIFIED lib/services/ai/video-generation.ts:487-544], and `git grep` finds the route as its only importer [VERIFIED command: git grep -l "services/ai/video-generation['\"]" -- app lib scripts returns app/api/media/generate/video/route.ts, 22/10/2026]. Disposition: moves nothing by itself, but it is what makes "one interface" true, costs no money and removes an unmetered surface. Recommend: build.

**S2. Pricing shape in the video catalogue.** Port the image registry pattern: add `VideoPricing = PerSecondPricing | PerOutputTokenPricing | PerVideoPricing`, make `pricing` optional on `VideoModelSpec`, and have `resolveModel` skip unpriced entries and `estimateCostUsd` throw an `UnpricedModelError`-style error for them. Keep `costPerSecondUsd` readable as a derived getter for one release so `quota.ts` and the J9 family that import `resolveModel`/`estimateCostUsd` [VERIFIED tests/eval/jev/families/j9.jev.test.ts:982-989] keep compiling. Widen `provider` from `'fal'` to a union (`'fal' | 'gemini' | 'xai' | 'minimax'`), with only `'fal'` rows present. Disposition: required before any second vendor can be costed; no spend.

**S3. Provider adapter seam (fal only, no behaviour change).** Add `lib/services/ai/video/providers/{types.ts,fal.ts}` with:

```ts
interface VideoProviderAdapter {
  provider: VideoModelSpec['provider'];
  submit(modelId: string, input: ComposedVideoInput, opts: { webhookUrl?: string }): Promise<{ providerJobId: string }>;
  completion: 'webhook' | 'poll';
  poll?(modelId: string, providerJobId: string): Promise<VideoJobStatus>;
  isRetiredError(err: unknown): boolean; // replaces the fal-specific ModelRetiredError check
}
```

`generation-service.ts` picks the adapter from `model.provider`; hold, settle, receipt and grounding stay where they are. The existing fal webhook (`fal-completion.ts`) becomes the `'webhook'` path; the video sweep cron gains a `'poll'` branch that is dead until a poll provider exists. Extend `ALLOWED_DIR_PREFIXES` in the guard [VERIFIED tests/unit/ai/no-direct-image-apis.test.ts:68-70] with `lib/services/ai/video/providers/`, and add detection patterns for direct video/avatar endpoints (Gemini video operations, `api.x.ai` video, `api.heygen.com` outside `lib/marketing-agency/heygen/`, `api.opus.pro`). That test file's header says allow-list changes need a matching entry in the Real Images Only spec register [VERIFIED tests/unit/ai/no-direct-image-apis.test.ts:15-18], so this extension needs founder sign-off.

**S4. Quote mode exposure (rides P5, not a new phase).** P5 defines "a `quote` mode on image, video and text generation returns a price and a hold amount before any spend row exists" (fleet spec, P5 detail). This spec only requires that the quote for video is computed from the S2 pricing shape for the model `resolveModel` would pick, and that `generate_image` / `generate_video` studio tools and the HeyGen route expose it. No spend, no new table.

**S5. Second video vendor, quote-only.** Add catalogue rows and an adapter for one more vendor. Candidates per synthex-intel-05: `gemini-omni-1.1-flash` (the only Gemini video model after the Veo 3.1 previews end on 22/10/2026, billed $17.50 per MTok of video output) or `grok-imagine-video-1.5` / `MiniMax-H3` (per second) [UNVERIFIED: wiki figures; confirm on the vendors' pricing pages at build time]. Ship it with the rows marked unpriced (so `resolveModel` cannot pick it) until a pricing fetch is recorded, then quote-only until the founder approves a key and spend. Disposition: insurance against the next fal or Kling retirement. It does not move a client metric until a CARSI or RestoreAssist video brief is blocked on fal; recommend build S5 only after S1-S3 and when that happens, otherwise defer.

**S6. Avatars and explainers (existing client, typed into the same quote/hold contract).** HeyGen is already wired: a client with its own price table (`HEYGEN_AVATAR_III_USD_PER_MINUTE = 0.99`) [VERIFIED lib/marketing-agency/heygen/client.ts:22], consent errors, a mock, and a media spend hold shared with images and video [VERIFIED lib/services/ai/media-spend-gate.ts:1-22]. Do not move it into the video catalogue; add an `avatar` quote path that calls `priceAvatarVideoUsd`. The blocker is data, not code: production HeyGen and ElevenLabs per-business IDs are placeholders [VERIFIED BACKLOG.md:18]. Synthesia (synthex-intel-03 recommends it for CARSI learning content) stays unwired; a key is a founder decision. Disposition: CARSI explainers could support paid enrolments, but only once real avatar IDs exist; defer beyond quote.

**S7. Clip repurposing (OpusClip, later).** Call-as-service via its Clip API or MCP (synthex-intel-03 §3, help.opus.pro, not fetched in this run). Input is owned long-form footage only (CARSI course video, webinars), so it is grounded by construction. Needs a price row, a hold through `holdMediaSpend`, and an owned-video check before submit. Disposition: defer until CARSI has long-form video in the owned library; then it is the cheapest route to CARSI shorts.

**S8. Deterministic overlays.** Captions, logos, end cards and price/claim text are rendered by Remotion, which is already a dependency (`remotion`, `@remotion/player`, `@remotion/cli`) [VERIFIED package.json:179,240,267] with compositions under `lib/remotion/` and a storyboard planner [VERIFIED lib/marketing-agency/remotion/storyboard-plan.ts:9-18]. Generative models never render text that carries a claim. HyperFrames is study-pattern only (see below). No build in this spec beyond keeping overlays out of generative prompts.

## Open-source candidates

| Project | Licence | Stars | pushed_at | What it gives us | Decision | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| [vercel/ai](https://github.com/vercel/ai) | NOASSERTION (LICENSE file: Apache-2.0) | 27436 | 2026-10-21 | `generateImage` and `experimental_generateVideo`; on main also `experimental_startVideo` / `experimental_getVideoStatus` with webhooks, and fal, Google, Kling, Luma, Replicate, xAI, ByteDance provider packages | depend (already installed, `ai` ^6) for text; study-pattern for the video adapter shape | [VERIFIED gh api repos/vercel/ai] [VERIFIED gh api repos/vercel/ai/contents/LICENSE] |
| [fal-ai/fal-js](https://github.com/fal-ai/fal-js) | MIT | 187 | 2026-10-21 | The fal client Synthex already uses for queue submit and status | depend (already installed, `@fal-ai/client` ^1.10.1) | [VERIFIED gh api repos/fal-ai/fal-js] |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | NOASSERTION (custom Remotion License) | 66040 | 2026-10-21 | Deterministic React-to-video for overlays, captions, end cards | depend (already installed, 4.x; eligibility is a founder question) | [VERIFIED gh api repos/remotion-dev/remotion] [VERIFIED gh api repos/remotion-dev/remotion/contents/LICENSE.md] |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Apache-2.0 | 69179 | 2026-10-21 | HTML/GSAP-to-video framework built for agents; hosted MCP compose/render | study-pattern | [VERIFIED gh api repos/heygen-com/hyperframes] |
| [BerriAI/litellm](https://github.com/BerriAI/litellm) | NOASSERTION (LICENSE file: MIT outside `enterprise/`) | 61751 | 2026-10-21 | Python gateway with `images` and `videos` routing modules | study-pattern | [VERIFIED gh api repos/BerriAI/litellm] [VERIFIED gh api repos/BerriAI/litellm/contents/LICENSE] |
| [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI) | GPL-3.0 | 141470 | 2026-10-21 | Self-hosted node-graph image/video pipelines | reject (defer; call-as-service at most) | [VERIFIED gh api repos/comfyanonymous/ComfyUI] |
| [FujiwaraChoki/supoclip](https://github.com/FujiwaraChoki/supoclip) | AGPL-3.0 | 1718 | 2026-10-21 | Open-source OpusClip-style long-to-short clipper | reject | [VERIFIED gh api repos/FujiwaraChoki/supoclip] |
| [replicate/replicate-javascript](https://github.com/replicate/replicate-javascript) | Apache-2.0 | 598 | 2025-11-17 | Replicate client; stale (last push more than 6 months ago) | reject | [VERIFIED gh api repos/replicate/replicate-javascript] |

All `gh api` calls above were run on 22/10/2026; none returned `archived: true`. Nothing is installed by this spec. Any dependency change (including an `ai` major bump) goes through a supply-chain review before it lands.

**vercel/ai.** Already a dependency (`"ai": "^6.0.277"`) [VERIFIED package.json:192]. At the installed tag `ai@6.0.277` the `generate-video` directory exports only the synchronous `experimental_generateVideo`; the asynchronous `experimental_startVideo` and `experimental_getVideoStatus` exist on main, whose package version is 7.0.148 [VERIFIED gh api repos/vercel/ai/contents/packages/ai/src/generate-video?ref=ai@6.0.277]. Both are `experimental_`. Synthex's hold → submit → settle → receipt invariant has to live outside the SDK, so use its `doStart` / status / webhook split as the model for `VideoProviderAdapter`, not as the runtime. Revisit as a dependency only after the API loses the `experimental_` prefix and a v7 upgrade is reviewed separately.

**Remotion.** Already installed. The licence is not OSI: it is free for "a for-profit organization with up to 3 employees" and requires a company licence above that, and it says "In Remotion 5.0, the license will slightly change" [VERIFIED gh api repos/remotion-dev/remotion/contents/LICENSE.md]. The wiki's "2-person company" reading fits only if Unite Group's headcount, as the licence counts it, is 3 or fewer. Stay on 4.x until the 5.0 terms are read.

**HyperFrames.** Apache-2.0 and very active, but it is a second HTML-to-video renderer beside Remotion, and its hosted MCP disables `compose` and `render_video` for CLI agents (per the connector's own instructions in this session) [INFERENCE]. Adopting it would create the parallel stack this spec forbids. Study its agent-authoring patterns (HTML scenes an agent can lint and diff) for the Remotion storyboard planner.

**LiteLLM.** A Python proxy that routes `images` and `videos` across vendors [VERIFIED gh api repos/BerriAI/litellm/contents/litellm]. Running it would add a service, a second spend ledger and a second set of keys beside the Governor. Study its provider-mapping tables; do not deploy.

**ComfyUI.** GPL-3.0 rules out depend or vendor. As a service it needs a GPU host, which there is no evidence of. Reject for now; reconsider only if a self-hosted LoRA video pipeline becomes a founder decision.

## Data model

None required. `VideoGeneration` already has `provider String?`, `model` (`gen_model`) and `providerJobId` columns [VERIFIED prisma/schema.prisma:3560-3562], so a second provider needs no migration; the type widening in S2 is TypeScript only. `organizationId` is already on the row [VERIFIED prisma/schema.prisma:3531] and every hold is org-scoped through the shared media spend log. One open point (not a schema change in this spec): avatar and voice holds are recorded with `mediaType 'audio'` [VERIFIED lib/services/ai/media-spend-gate.ts:24-28], so spend reports cannot separate avatar from voice; if that matters, a new `mediaType` value needs a migration under `prisma/migrations/**` (protected path, declared fleet commit or `human-required`).

## Security & cost guardrails

- **Admission before every provider call** stays the invariant [VERIFIED lib/services/ai/video/generation-service.ts:176-180]. Adapters receive a job only after the hold exists; they never take holds themselves.
- **Unpriced means unusable** extends to video (S2). A catalogue row without a recorded pricing fetch cannot be selected or quoted, so a new vendor cannot spend by accident.
- **Draft-first** stays structural (`modelTier ?? 'draft'`) [VERIFIED lib/services/ai/video/generation-service.ts:133]. A new vendor is added at a tier only by catalogue data.
- **Keys.** Each new vendor key is a founder decision and lives in Vercel env, never in source, fixtures or prompts. Brand BYOK through the Governor applies once the Governor has callers; it has no production caller today (fleet spec P5 detail) and runs in shadow [VERIFIED lib/ai/governor/mode.ts:13].
- **Real Images Only.** No provider without image input is ever eligible for a grounded request; the guard extension in S3 catches direct calls. No new escape-hatch uses. Changes to `.claude/rules/real-images-only.md` (to name video/avatar adapters) are a protected path and need a declared fleet commit or the founder's `human-required` label; the same goes for any `prisma/migrations/**` change.
- **Avatar consent.** HeyGen already refuses without consent metadata (`HeyGenConsentError`) [VERIFIED lib/marketing-agency/heygen/client.ts:47]. Synthetic presenters and testimonials need an Australian advertising-law check (ACCC/AANA) that the wiki did not research [UNVERIFIED].
- **Caps.** All media spend stays inside the one org media quota and append-only spend log the image, video, voice and HeyGen paths already share [VERIFIED lib/services/ai/media-spend-gate.ts:5-9]. No metered fallback to a second vendor on failure: a failure releases or settles the hold and returns an error; switching vendor is a catalogue change, not a runtime retry.

## Risk & assumption register

| ID | Risk or assumption | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R1 | fal retires or reprices Kling 3 Pro or Seedance 2.0 (it already retired Wan 2.5, Hailuo 2.3 and Veo 3.1) [VERIFIED lib/services/ai/video/registry.ts:3-10] | High | High: all video stops | S2-S3 make a second vendor a data-plus-adapter change; S5 kept ready in quote mode | Fleet |
| R2 | Gemini Omni pricing per output token cannot be bounded before the call | Medium | Medium: hold too small | Price the hold at the documented maximum duration and resolution; unpriced until a bound is recorded | Fleet |
| R3 | `ai` v6 `experimental_generateVideo` changes or disappears in v7 | Medium | Low: we only study it | Do not depend on it for video | Fleet |
| R4 | Unite Group exceeds Remotion's 3-employee free tier, or Remotion 5.0 terms change | Unknown | Medium: licence breach | Founder confirms headcount; pin 4.x | Founder |
| R5 | Moving `submitToFal` behind an adapter changes fal behaviour (webhook URL, retired-model detection) | Low | High | S3 is behaviour-preserving with the existing fal-adapter and video-sweep tests as the oracle | Fleet |
| R6 | Guard extension produces false positives on catalogue/data files | Medium | Low | Reuse the guard's existing comment and data-file handling; planted fixtures for each new pattern | Fleet |
| R7 | Avatar IDs stay placeholders, so S6 quotes jobs that cannot render | High | Low | Quote path checks the avatar ID resolves before quoting | Fleet |
| A1 | The wiki's vendor dates and prices (Sora shutdown 24/09/2026, Veo previews end 22/10/2026, Omni $17.50/MTok) are current | — | — | Re-fetch vendor pages at S5 build time; attributed to synthex-intel-05, not verified in this run | Fleet |
| A2 | The sibling model-registry spec will own retirement flags for both catalogues | — | — | If it does not land, S2 adds a `deprecated` flag to `VideoModelSpec` mirroring the image registry [VERIFIED lib/services/ai/image/registry.ts:128] | Fleet |

## Open questions

1. **(Founder only)** Does Unite Group, as Remotion's licence counts employees, have 3 or fewer? If not, a Remotion company licence is a spending decision.
2. **(Founder only)** Which second video vendor gets a key, and with what monthly media cap: Gemini Omni direct, xAI, or MiniMax? Until then S5 stays quote-only.
3. **(Founder only)** Is Synthesia wanted for CARSI course explainers, or is HeyGen enough for both businesses? This decides whether S6 grows a second avatar adapter.
4. **(Founder only)** Approve the Real Images Only register entry and guard allow-list extension for `lib/services/ai/video/providers/` (S3).
5. **(Founder only)** Supply real HeyGen avatar and ElevenLabs voice IDs per business (BACKLOG item 5), or confirm avatars are out of scope for the FD-10 window.
6. Should avatar spend get its own `mediaType` so reports separate it from voice? (Migration, protected path.)
7. Does OpusClip's API tier fit the volume of CARSI footage, and does its MCP accept owned uploads only? (Not fetched in this run.)

## Verification plan

Run from the worktree. Each check names how it can go red.

| Slice | Command | Expected now | Expected after | Goes red when |
| --- | --- | --- | --- | --- |
| S1 | `git grep -l "services/ai/video-generation['\"]" -- app lib scripts` | prints `app/api/media/generate/video/route.ts` | prints nothing, exit 1 | any importer of the legacy service remains |
| S1 | `test ! -e lib/services/ai/video-generation.ts && echo gone` | no output | `gone` | file still present |
| S2 | `npx jest --config config/jest/jest.worktree.cjs __tests__/video-engine/registry.test.ts` | pass | pass, with a new case asserting every `VIDEO_MODELS` row has a `pricing` shape and that `resolveModel` never returns an unpriced row | plant a row with no `pricing` in a test fixture: the case must fail (watch it red once before trusting it) |
| S2 | same file | `RETIRED_VIDEO_MODEL_IDS` contains `fal-ai/veo3.1` [VERIFIED __tests__/video-engine/registry.test.ts:9] | unchanged | a retired ID is re-added |
| S3 | `git grep -n "submitToFal" lib/services/ai/video/generation-service.ts` | line 256 | nothing | the service still calls fal directly |
| S3 | `npx jest --config config/jest/jest.worktree.cjs tests/unit/lib/services/ai/video __tests__/video-engine` | pass | pass, unchanged expectations | the adapter move changed fal behaviour |
| S3 | `npx jest --config config/jest/jest.worktree.cjs tests/unit/ai/no-direct-image-apis.test.ts` | pass | pass, with new planted-fixture cases for a Gemini video operation URL, `api.x.ai` video, `api.heygen.com` outside its client dir and `api.opus.pro` | any planted fixture is not flagged |
| S4 | J9 family (`tests/eval/jev/families/j9.jev.test.ts`) quote cases | per P5 | a video and an avatar quote return price and hold amount with zero spend rows | a quote writes a spend row or a budget-read error does not fail closed |
| S5 | `npx jest … __tests__/video-engine/registry.test.ts` | — | the second vendor's rows exist but `resolveModel` never selects them until priced | an unpriced row is selectable |
| All | `npm run type-check` | exit 0 | exit 0 | the union widening breaks a caller |
| All | `git diff origin/main -- package.json package-lock.json` | empty | empty for S1-S4 | a dependency lands without a supply-chain review |

"Green" for any slice means GitHub's required checks on the exact pushed SHA, not a local run.
