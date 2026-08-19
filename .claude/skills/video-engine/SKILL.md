---
name: video-engine
description: >-
  Video generation pipeline guide for Synthex. Documents the 4-provider
  architecture (Runway, Synthesia, D-ID, Remotion), FFmpeg
  post-processing, media library integration, and God Mode gating.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - video generation
    - video pipeline
    - remotion
    - ffmpeg
    - video rendering
    - runway
    - synthesia
    - d-id
    - avatar video
    - video processing
    - media generation
context: fork
---

# Video Engine — Video Generation Pipeline Guide

## Purpose

Synthex generates videos through a multi-provider pipeline with 4 providers,
FFmpeg post-processing, ElevenLabs voice integration, and a Supabase-backed
media library. Remotion is God Mode only.

This skill documents the full pipeline, provider differences, and the
architectural decisions at each stage.

> **Visual generation (binding):** all images/video route through the grounded
> pipeline — see `.claude/rules/real-images-only.md` + the `grounded-visuals`
> skill. Direct provider calls fail CI.

> **⚠ SUBSTRATE REALITY (SYN-43 / SYN-48) — read before using any provider below.**
> Runway ML, Synthesia and D-ID are **NOT in the owned Synthex stack** and are not
> sanctioned image/video substrates. The ONLY sanctioned entry point for image
> generation is `generateImage()`/`generateBatch()` in
> `lib/services/ai/image-generation.ts` (the static guard test
> `tests/unit/ai/no-direct-image-apis.test.ts` fails CI on any direct provider call
> outside the service layer). Video generation is grounded-by-default via
> `lib/services/ai/video/generation-service.ts` — it seeds from owned references in
> `public/reference-library/` (manifest.json, 143+ subjects incl. 135 CCW products)
> and the private Supabase bucket `reference-library-private` (customer job photos,
> ingest via `POST /api/admin/private-refs`); no owned coverage ⇒
> `GroundingBlockedError` and the run is BLOCKED — "No owned references for this
> subject — add real photos to the reference library first." `useReferences: false`
> is the sole audited escape hatch (output stamped `UNGROUNDED`). Trained LoRAs
> (`lib/services/ai/image/trained-loras.json` — `carpet-style-v1`, trigger
> `ccwcarpet`) auto-apply per industry; retrain via
> `scripts/train-carpet-style-lora.ts`. Corpus growth from owned videos runs through
> the Railway media worker + `media_*` MCP tools + frame-extraction scripts. MCP
> studio tools `generate_image`/`generate_video` inherit all these defaults.
>
> Runway/Synthesia/D-ID remain **unconfigured/aspirational** text-to-video APIs: no
> `RUNWAY_API_KEY` / `SYNTHESIA_API_KEY` / `DID_API_KEY` is provisioned, so
> `lib/services/ai/video-generation.ts` gates each provider behind a key-present
> check and returns a typed `not_configured` result (the route replies **422**,
> never a 500, and fabricates no video). Standing up a real text-to-video provider
> is a **founder-gated decision** and, even then, must route through the grounded
> `generation-service.ts` path, not a direct API call. The provider code paths
> remain intact so that, if a key is ever deliberately set, they still work.

## Pipeline Flow

```
User Request (script, prompt, image, or template)
  │
  ▼
API Route: /api/media/generate/video
  │  - APISecurityChecker (JWT auth)
  │  - Zod schema validation
  │  - God Mode gate (Remotion only)
  ▼
Provider Selection (explicit or auto-select)
  │
  ├─ Runway ML ──── text-to-video, image-to-video, motion (Gen-3)
  ├─ Synthesia ──── avatar video with TTS (scripts)
  ├─ D-ID ────────── talking head from image + script
  └─ Remotion ────── programmatic React rendering (GOD MODE)
  │
  ▼
Async Processing (all providers return video_id for polling)
  │
  ▼
Status Polling: GET /api/media/generate/video?videoId=X&provider=Y
  │
  ▼
Media Library: Supabase Storage (media_assets table)
  │
  ▼
Optional: FFmpeg post-processing (fluent-ffmpeg)
  │
  ▼
Publish to platforms (YouTube, Instagram, LinkedIn, TikTok)
```

## Provider Matrix

> **Status column below is the reality, not an aspiration.** Runway/Synthesia/D-ID
> are **UNCONFIGURED** (not in stack) — calling them returns `not_configured`.

| Provider  | Types                                  | Auth Pattern   | API Base                      | Access       | Env Var             | Status                        |
| --------- | -------------------------------------- | -------------- | ----------------------------- | ------------ | ------------------- | ----------------------------- |
| Runway ML | text-to-video, image-to-video, motion  | Bearer token   | `https://api.runwayml.com/v1` | All users    | `RUNWAY_API_KEY`    | ⚠ UNCONFIGURED — not in stack |
| Synthesia | avatar (script → video)                | API key header | `https://api.synthesia.io/v2` | All users    | `SYNTHESIA_API_KEY` | ⚠ UNCONFIGURED — not in stack |
| D-ID      | avatar (image + script → talking head) | Basic auth     | `https://api.d-id.com`        | All users    | `DID_API_KEY`       | ⚠ UNCONFIGURED — not in stack |
| Remotion  | programmatic (React compositions)      | N/A (local)    | N/A                           | **God Mode** | None                | ✅ owned (God Mode only)      |

## Auto-Selection Logic

When `provider` is not specified in the request:

| Video Type            | Default Provider |
| --------------------- | ---------------- |
| `text-to-video`       | Runway ML        |
| `image-to-video`      | Runway ML        |
| `motion`              | Runway ML        |
| `avatar` (no image)   | Synthesia        |
| `avatar` (with image) | D-ID             |

Remotion is **never** auto-selected — it must be explicitly requested,
and only by owner accounts.

## God Mode Gating

### Server-Side (API Route)

God Mode gating applies to Remotion only (rendered via the admin Remotion
Studio surface). The Remotion Studio page is gated at the layout level —
see `app/dashboard/admin/remotion-studio/page.tsx` and `admin/layout.tsx`
for the `isOwnerEmail()` check.

### Client-Side (UI)

- Check `user.isMultiBusinessOwner` from `useUser()` hook
- Hide God Mode providers from dropdowns for non-owners

### Page-Level (Remotion Studio)

- `/dashboard/admin/remotion-studio` protected by `admin/layout.tsx`
- Layout calls `isOwnerEmail(user.email)` and redirects non-owners

## Key Files

| File                                           | Purpose                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `lib/services/ai/video/generation-service.ts`  | Grounded video generation (sanctioned; seeds from owned references, `GroundingBlockedError`) |
| `lib/services/ai/image-generation.ts`          | Grounded image generation (sanctioned entry point — `generateImage()`/`generateBatch()`)     |
| `lib/services/ai/video-generation.ts`          | Multi-provider service (generate + status check)                                             |
| `app/api/media/generate/video/route.ts`        | Video API route (POST generate, GET status, PUT batch)                                       |
| `lib/services/media-library.ts`                | Supabase media asset storage                                                                 |
| `lib/services/ai/voice-generation.ts`          | ElevenLabs TTS for voiceovers                                                                |
| `lib/remotion/Root.tsx`                        | Remotion composition registry                                                                |
| `lib/remotion/compositions/`                   | React video compositions (SocialReel, ExplainerVideo)                                        |
| `app/dashboard/admin/remotion-studio/page.tsx` | God Mode Remotion preview                                                                    |
| `app/api/admin/remotion/route.ts`              | Composition listing API                                                                      |

## Database Model

```prisma
model VideoGeneration {
  id                  String   @id @default(cuid())
  userId              String
  organizationId      String?
  title               String
  topic               String?
  style               String   // 'social-reel' | 'explainer' | 'how-to'
  duration            String   // '15-60s' | '2-3m' | '3-5m'
  status              String   // 'pending' | 'generating' | 'rendered' | 'published' | 'failed'
  scriptContent       Json     // { scenes, voiceover, visualDescriptions }
  videoUrl            String?
  thumbnailUrl        String?
  youtubeVideoId      String?
  scheduledPlatforms  String[] // ['youtube', 'instagram', 'linkedin']
}
```

## FFmpeg Integration

Packages installed:

- `@ffmpeg-installer/ffmpeg` — FFmpeg binary
- `@ffprobe-installer/ffprobe` — FFprobe binary
- `fluent-ffmpeg` — Node.js FFmpeg API
- `get-video-duration` — Duration extraction

Use for: overlays, watermarks, format conversion, trimming, concatenation.

## ElevenLabs Voice Integration

File: `lib/services/ai/voice-generation.ts`

9 premium voices available. Used for video voiceovers when scripts are provided.
Supports voice cloning from audio samples.

## Common Mistakes

| Mistake                                  | Why It's Wrong          | Correct Pattern                           |
| ---------------------------------------- | ----------------------- | ----------------------------------------- |
| Not checking provider env var            | Silent failure          | Each provider function checks first       |
| Rendering Remotion server-side on Vercel | 50MB limit, 60s timeout | Use client-side Player or Lambda          |
| Not polling for status                   | Videos are async        | All providers return video_id for polling |
| Skipping media library save              | Assets lost             | Default `saveToLibrary: true`             |

## Environment Variables

| Variable             | Provider   | Status / Required                                         |
| -------------------- | ---------- | --------------------------------------------------------- |
| `RUNWAY_API_KEY`     | Runway ML  | ⚠ Not provisioned — provider not in stack (founder-gated) |
| `SYNTHESIA_API_KEY`  | Synthesia  | ⚠ Not provisioned — provider not in stack (founder-gated) |
| `DID_API_KEY`        | D-ID       | ⚠ Not provisioned — provider not in stack (founder-gated) |
| `ELEVENLABS_API_KEY` | ElevenLabs | ✅ Sanctioned substrate — voice generation                |

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.

---

## Foundation & Gate Wiring (SYN-1050)

> Adopted from the senior-skill standard so every artefact this skill produces is checked against the locked foundation before it lands.

**Reads at every invocation (never cached — re-read each run):**

- `.claude/memory/ceo-foundation.md` — Aid Rule (Q3.1.1) on RestoreAssist content, voice tag (Q2.5.5), no fabricated metrics, verification gates for any view/engagement claim.
- `.claude/memory/verification-gates.md` — gate state for any claim referenced.

**Output gate:** every client-facing artefact this skill produces routes through `brand-voice-enforce` before the CEO batched-review queue. A REJECT blocks the artefact until the quoted offending string is fixed.

**Evidence standard:** every quantitative or factual claim carries exactly one tag — `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`. Untagged = defect (`.claude/rules/fabel-evidence-standard.md`). Never state a projected result as fact.

**Spec:** see `spec.md` in this skill directory.
