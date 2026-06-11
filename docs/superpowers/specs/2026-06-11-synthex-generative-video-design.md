# Synthex Generative Video Engine ("Hailuo-class" video generation)

**Date:** 2026-06-11
**Status:** Draft — awaiting user review
**Scope:** Sub-project 1 of the Hailuo-style capability set: text-to-video and image-to-video generation wired into Synthex's existing content pipeline.

## Context

Hailuo AI (hailuoai.video, MiniMax) offers text-to-video, image-to-video, start/end-frame control, template effects, image/audio generation, a community gallery, and credit-based monetization. Its moat is a proprietary video foundation model; everything else is an orchestration layer. Synthex cannot (and should not) train a foundation model — it should build the orchestration layer over hosted model APIs, which is what every Hailuo-class competitor does.

Synthex already has:

- `lib/services/ai/video-generation.ts` — multi-provider skeleton (Runway/Synthesia/D-ID) with a dated Runway "gen3" API shape, fire-and-poll, no persistence, no webhooks. Effectively dormant.
- `lib/video/` — a working production pipeline: `script-generator` → `video-orchestrator` → `video-processor` → `quality-gate` → `social-derivation` → `youtube-uploader`.
- `lib/remotion/` — programmatic compositions (BrandReel, SocialReel, explainer formats).
- `prisma` `VideoGeneration` model (`video_generations` table) with status lifecycle, script content, output URLs, and publish scheduling.
- `app/api/video/*` routes: list, `generate`, `[id]`, `[id]/publish`, `episodes`.
- `lib/services/media-library.ts` for asset registration; Supabase for storage.

The gap versus Hailuo is exactly one layer: **generative diffusion video** (T2V/I2V) with async job handling, prompt/template engineering, and cost metering.

Competitive grounding (2026-06-11 sweep of Hailuo, Runway, Pika, Luma, Kling, Higgsfield, Krea, OpenArt, Freepik, Canva, CapCut/Pippit, PixVerse): the market splits into model-quality studios without distribution and marketing-pipeline tools with weak generation; no product combines multi-model generation, brand asset locks, batch variants, and auto-publishing. Synthex already owns the distribution half (9-platform publishing, brand-DNA, media library, voice, image gen — all live in code), so this spec deliberately adds the 2026 table stakes (native audio, brand locks, variants) rather than bare T2V. Do not build on Sora (API sunsets 2026-09-24).

## Skills & techniques required (the "how they do it")

These are the transferable skills behind a Hailuo-class product, each mapped to where it lands in Synthex:

1. **Model API orchestration** — submit → queue → webhook/poll → fetch artifact. Hailuo-class generations take 30s–5min; the architecture must be async-first. → provider layer + webhook route.
2. **Provider abstraction & model routing** — route each request to the right model by quality tier, aspect ratio, budget. → provider registry.
3. **Prompt engineering for video** — cinematography vocabulary (camera moves, shot types, lighting, motion descriptors); LLM-assisted prompt expansion from a user's plain-language idea. → prompt enhancer using Synthex's existing OpenRouter LLM access.
4. **Template engineering** — Hailuo's "effects" (dance, transformation, style switch) are prompt scaffolds + fixed model params + an input-image slot. → JSON card registry (method cards + modifier chips).
5. **Asset pipeline** — provider CDN URLs expire; artifacts must be downloaded to owned storage and registered. → Supabase storage + media library.
6. **Cost control & metering** — per-second model billing demands per-job cost capture and a spend guard on the agency's own fal budget, with cost attributable per client org. → metering columns + quota check.
7. **Product UX for async generation** — optimistic job cards, progress states, retry, gallery. → studio page.

## Goals

- A Synthex user can generate a short video (4–10s) from a text prompt or an uploaded/library image, in 9:16, 1:1, or 16:9 — with native audio (dialogue/SFX) where the model supports it. Competitive note (2026): every leading studio ships audio-capable generation; silent-by-default is obsolete.
- A **brand card** per client org (auto-built from the existing `lib/brand-dna` engine) injects that client's colours, voice, and vertical into any generation — the agency-grade "brand lock" feature competitors (Canva Brand Kit, Freepik brand repositories, Higgsfield) charge for.
- **Batch variants**: one submit can fan out N variations (different modifiers, seeds, or brand cards) — Higgsfield Marketing Studio-style variant packs, and the mechanism for Disaster Recovery's state-specific video sets.
- Generated videos land in the media library and flow into the existing social-derivation/publish pipeline — generation + 9-platform distribution in one tool is the combination no competitor offers.
- Per-job cost is recorded; per-organization monthly spend is capped (each Unite-Group product can be metered as an internal client org).
- Method cards, modifier chips, and brand cards are data, not code — adding one is a JSON entry (brand cards derive from brand-DNA records).

## Non-goals (this sub-project)

- Training or self-hosting models (local box has a 2GB GPU; cloud GPU ops is a later, margin-driven decision).
- Standalone audio/music generation, standalone image generation, community gallery, creator program. (Native model audio IS in scope; a separate audio studio is not.)
- Any billing or credit packs — Synthex is the agency's internal tool; there are no paying end-users. Metering exists purely to control and attribute the agency's own provider spend.
- Start/end-frame control and reference-image subject consistency (Hailuo Subject Reference / Kling Elements / Higgsfield Soul ID class) — model support via fal is uneven; both are explicit roadmap items, and the card registry leaves room for them.

## Approaches considered

**A. Aggregator-first via fal.ai (chosen).** One API key, one queue/webhook contract, access to MiniMax Hailuo 2.3, Kling 3, Veo 3, Wan 2.5 and successors. Pay-as-you-go (Wan 2.5 ≈ $0.05/s; Hailuo/Kling Pro ≈ $0.22–0.28/s; Veo 3 ≈ $0.40/s — June 2026 fal pricing). Swapping/adding models is a config change. Trade-off: aggregator margin on top of provider price, and a single vendor dependency — mitigated by the provider-registry abstraction (a direct-API adapter can be added later without touching callers).

**B. Direct provider APIs (MiniMax platform, Google, Kuaishou).** Best unit economics at scale, but N integrations × N webhook contracts × N auth schemes to maintain, and several (Veo, Kling) have regional/contract friction. Right move _after_ volume proves out, as additional adapters behind the same registry.

**C. Self-hosted open models (Wan 2.x, HunyuanVideo) on rented GPUs.** Maximum margin and control, no per-generation fees, but a real MLOps burden (GPU autoscaling, cold starts, model updates) that doesn't fit current team shape. Revisit if generation volume makes aggregator costs material.

Decision: **A now, B as a follow-on adapter, C only on proven volume.**

## Architecture

```
User (Studio UI / content pipeline)
   │  POST /api/video/generate  { mode: "generative", prompt | imageUrl, methodCardId, modifierIds?, brandCardId?, audio?, variants?, modelTier, aspectRatio, duration }
   ▼
Generation service (lib/services/ai/video/)
   ├─ quota check (org monthly cap) ──► 402-style rejection if exceeded
   ├─ prompt enhancer (optional, LLM via existing OpenRouter path)
   ├─ card resolver (methodCardId + modifierIds → composed prompt + model + params)
   ├─ provider registry → FalAdapter.submit() → fal queue job id
   └─ persist VideoGeneration row (status: generating, providerJobId, estimatedCostUsd)
   ▼
fal.ai webhook ──► POST /api/video/webhook/fal  (HMAC-verified)
   ├─ success: download artifact → Supabase storage → media library entry
   │           → update row (status: rendered, videoUrl, actualCostUsd)
   └─ failure: update row (status: failed, errorMessage), refundable quota release
   ▼
Existing pipeline: social-derivation / publish / quality-gate (unchanged consumers of videoUrl)
```

A poll fallback (`GET /api/video/[id]` triggering a provider status check when a job exceeds expected latency) covers missed webhooks; a scheduled sweep marks jobs older than 30 min as failed.

## Components

### 1. Provider layer — `lib/services/ai/video/`

- `types.ts` — `GenerativeVideoRequest`, `GenerativeVideoJob`, `VideoModelSpec` (id, provider, tier, $/s, max duration, supported aspect ratios, supports image input, `supportsAudio`).
- `registry.ts` — model catalog + `resolveModel(tier, requirements)`. Tiers: `draft` (Wan 2.5), `standard` (MiniMax Hailuo 2.3), `premium` (Veo 3.1 / Kling 3 — both audio-capable; audio-on requests route to a `supportsAudio` model within the tier). Catalog is data; model churn doesn't touch code.
- `fal-adapter.ts` — submit to fal queue with webhook URL, parse webhook payloads, fetch artifacts. Single env var: `FAL_API_KEY`.
- `prompt-enhancer.ts` — optional LLM pass turning a plain idea into a cinematography-grade prompt (shot type, camera motion, lighting, subject motion). Off by default when a method card supplies the scaffold; on for the "Freeform" card (a blank-scaffold card included in the launch deck for pure prompting).
- The legacy `video-generation.ts` stays untouched this phase; its `avatar` path (HeyGen/D-ID) is orthogonal. A follow-up cleanup retires the dead Runway code.

### 2. Data model — extend `VideoGeneration` (no new table)

New nullable columns, so existing Remotion-pipeline rows are unaffected:

- `mode` (`script` default | `generative`), `provider`, `model`, `providerJobId` (indexed)
- `inputPrompt`, `enhancedPrompt`, `inputImageUrl`, `methodCardId`, `modifierIds` (String[]), `brandCardId`
- `aspectRatio`, `durationSeconds`, `audioEnabled`, `batchGroupId` (indexed), `seed`
- `estimatedCostUsd`, `actualCostUsd` (Decimal)
- New `OrganizationVideoQuota` model: `organizationId`, `monthlyBudgetUsd`, `spentUsd`, `periodStart`. At submit: reject if `spentUsd + estimatedCostUsd > monthlyBudgetUsd`, otherwise add the estimate to `spentUsd` as a hold. At completion: adjust the hold to `actualCostUsd`. On failure: subtract the hold.

### 3. API surface

- `POST /api/video/generate` — extended: `mode: "generative"` branches to the new service; existing script mode untouched. Validates against model spec (duration/aspect/audio support), caps `variants` at 8, runs the quota check on the summed batch estimate, returns the job row(s) immediately.
- `POST /api/video/webhook/fal` — new; verifies fal's webhook signature, idempotent on `providerJobId` (webhooks can repeat).
- `GET /api/video/[id]` — existing; gains lazy poll-through when status is `generating` and the job is older than its model's expected latency.
- `GET /api/video/cards` — new; serves the card registry (method cards + modifier chips).

### 4. Card registry — `lib/services/ai/video/cards/`

The placecard system (validated visually with the user, 2026-06-11) is a **hybrid deck**: one method card per generation, plus optional modifier chips. Both are data, not code.

**Method cards** (single-select): `{ id, name, description, thumbnail, model?, promptScaffold, negativePrompt?, params, requiresImage, category }`. The scaffold has a `{{subject}}` slot filled from the user's prompt. Ship ~8 launch cards in Synthex's social-content domain: product reveal, talking-product, before/after transformation, logo motion, lifestyle b-roll, stat punch-in, unboxing, seasonal hook.

**Modifier chips** (multi-select, tick any): `{ id, category, name, promptFragment, params? }` in three launch categories — **Style** (cinematic, animated, …), **Camera** (dolly-in, orbit, crash zoom, bullet time, 360 orbit, …), **Lighting/Mood** (golden hour, moody night, …). The Camera category ships deep (~15 chips at launch, growing toward a Higgsfield-style preset library — their 70+ camera presets are the proven differentiator and chips cost nothing to add). Composition order: method scaffold + subject, then modifier fragments appended by category; chip `params` (e.g., a style-specific negative prompt) shallow-merge over card params, conflicts resolved card-last.

**Brand cards** (single-select, optional): one per client org, derived automatically from the org's `lib/brand-dna` record (colour palette, brand voice, vertical, persona) — not hand-authored JSON. Selecting one appends a brand-context fragment to the prompt and tags the job for cost attribution. A "No brand" default keeps freeform work unaffected.

**Batch variants:** the submit accepts `variants: 1–8`. Each variant is its own `VideoGeneration` row (own provider job, own webhook lifecycle) sharing a `batchGroupId`; variation comes from seed changes by default, or an explicit per-variant override list (e.g., different brand cards or modifier sets — how Disaster Recovery's 8 state versions run as one submit). Quota holds the summed estimate up front.

Card thumbnails start as static images; looping video previews (generated once with the card's own scaffold) are a fast follow.

### 5. Studio UI — `app/(dashboard)/video-studio/` (single canvas)

One page, validated as mockup with the user: four zones top to bottom —

1. **Method deck** — grid of placecards with thumbnails; exactly one selected, highlighted.
2. **Modifier chips** — Style / Camera / Lighting rows; zero or more ticked. A **brand card** selector sits at the row's end (client logo avatars; "No brand" default).
3. **Prompt bar** — subject input + optional image from the media-library picker; platform presets (TikTok / Reels / Shorts / YouTube — each pre-sets aspect + duration, Higgsfield-style) alongside raw aspect-ratio and duration chips; sound on/off toggle; variants stepper (1–8); model-tier selector; live cost estimate on the Generate button (e.g., "Generate ×4 — Product Reveal · Cinematic · Orbit · ~$5.60").
4. **Recent jobs grid** — generating / rendered / failed states, retry on failed, "send to publish" on rendered; batch variants group into one expandable row.

Reuses existing dashboard components. Polls the list endpoint while any job is in flight (no websocket work this phase).

## Error handling

- Submit failures (provider 4xx/5xx, quota, invalid params): synchronous error to the caller; no row left in `generating`.
- Webhook failures or no webhook within 30 min: sweep marks job `failed` with a diagnostic; quota hold released.
- Content-policy rejections from providers surface as a distinct `errorMessage` class so the UI can say "prompt rejected" instead of "error".
- Artifact download failures retry 3× with backoff before failing the job (provider URL still stored in `metadata` for manual recovery).
- All provider calls behind the existing `logger` with `providerJobId` correlation.

## Testing

- Unit: registry resolution, template scaffold filling, quota arithmetic, webhook signature verification + idempotency (jest, existing config).
- Integration: mocked fal HTTP (submit → webhook replay → artifact download) through the API routes.
- One live smoke test against fal's cheapest model (Wan 2.5, ~$0.30 for 6s) gated behind an env flag — per proof-discipline, GREEN requires one real generation traversing submit → webhook → storage → media library on the real path, not just mocks.
- `npm run type-check` and existing jest suite must pass.

## Rollout & roadmap (later sub-projects, separate specs)

1. **This spec** — generative engine + card deck (method/modifier/brand) + batch variants + native audio + studio page, behind a feature flag while validating quality/cost. First internal consumers: RestoreAssist's YouTube/CPD curriculum, Synthex feature demos.
2. **Reference-image consistency** — 1–3 subject/product reference images held across clips (Hailuo Subject Reference / Kling Elements / Higgsfield Soul ID class, via fal where exposed). Table stakes across 2026 competitors; deferred only for integration risk.
3. **Ad Pack cards** — Higgsfield Marketing Studio / Pippit-style: one brief (or product URL) → a batch of ad-format variants (UGC, unboxing, tutorial, product reveal) pre-sized per platform. Builds directly on batch variants + brand cards.
4. **Post-generation tools** — extend, upscale, auto-captions (Whisper), and avatar/UGC presenters via fal-hosted lip-sync models (superseding the dead HeyGen stub in `lib/marketing-agency/heygen`).
5. **Direct provider adapters** — MiniMax platform API for unit-economics once volume is real.
6. **Advanced controls** — start/end frame, video-to-video restyle/editing (Runway Aleph / Luma Modify class).
7. **Client-facing exposure** — if the agency ever productizes Synthex for clients, billing becomes a new spec; nothing in this design assumes it.

## Deferred decisions (explicit defaults, not TBDs)

- Default per-client-org monthly budget: **$25** of provider spend (env-overridable per org) — a guard on the agency's own fal bill, not a billing construct.
- Prompt enhancement default: **on** for the Freeform card, **off** for all other method cards.
- Retention: generated artifacts kept in Supabase storage indefinitely this phase (volume is low; revisit with billing).
