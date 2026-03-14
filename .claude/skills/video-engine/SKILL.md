---
name: video-engine
description: >-
  Video generation pipeline guide for Synthex. Documents the 5-provider
  architecture (Runway, Synthesia, D-ID, HeyGen, Remotion), FFmpeg
  post-processing, media library integration, and God Mode gating.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - video generation
    - video pipeline
    - remotion
    - heygen
    - ffmpeg
    - video rendering
    - runway
    - synthesia
    - d-id
    - avatar video
    - video processing
    - media generation
---

# Video Engine — Video Generation Pipeline Guide

## Purpose

Synthex generates videos through a multi-provider pipeline with 5 providers,
FFmpeg post-processing, ElevenLabs voice integration, and a Supabase-backed
media library. Two providers (HeyGen and Remotion) are God Mode only.

This skill documents the full pipeline, provider differences, and the
architectural decisions at each stage.

## Pipeline Flow

```
User Request (script, prompt, image, or template)
  │
  ▼
API Route: /api/media/generate/video
  │  - APISecurityChecker (JWT auth)
  │  - Zod schema validation
  │  - God Mode gate (HeyGen only)
  ▼
Provider Selection (explicit or auto-select)
  │
  ├─ Runway ML ──── text-to-video, image-to-video, motion (Gen-3)
  ├─ Synthesia ──── avatar video with TTS (scripts)
  ├─ D-ID ────────── talking head from image + script
  ├─ HeyGen ──────── avatar video, template-based (GOD MODE)
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

| Provider | Types | Auth Pattern | API Base | Access | Env Var |
|----------|-------|-------------|----------|--------|---------|
| Runway ML | text-to-video, image-to-video, motion | Bearer token | `https://api.runwayml.com/v1` | All users | `RUNWAY_API_KEY` |
| Synthesia | avatar (script → video) | API key header | `https://api.synthesia.io/v2` | All users | `SYNTHESIA_API_KEY` |
| D-ID | avatar (image + script → talking head) | Basic auth | `https://api.d-id.com` | All users | `DID_API_KEY` |
| HeyGen | avatar, template-based | x-api-key header | `https://api.heygen.com/v2` | **God Mode** | `HEYGEN_API_KEY` |
| Remotion | programmatic (React compositions) | N/A (local) | N/A | **God Mode** | None |

## Auto-Selection Logic

When `provider` is not specified in the request:

| Video Type | Default Provider |
|-----------|-----------------|
| `text-to-video` | Runway ML |
| `image-to-video` | Runway ML |
| `motion` | Runway ML |
| `avatar` (no image) | Synthesia |
| `avatar` (with image) | D-ID |
| `template` | HeyGen (must be explicit) |

HeyGen and Remotion are **never** auto-selected — they must be explicitly
requested, and only by owner accounts.

## God Mode Gating

### Server-Side (API Route)
```typescript
// After Zod validation, before generateVideo()
if (validated.provider === 'heygen') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user || !isOwnerEmail(user.email)) {
    return 403; // 'HeyGen provider requires God Mode access'
  }
}
```

### Client-Side (UI)
- Check `user.isMultiBusinessOwner` from `useUser()` hook
- Hide God Mode providers from dropdowns for non-owners

### Page-Level (Remotion Studio)
- `/dashboard/admin/remotion-studio` protected by `admin/layout.tsx`
- Layout calls `isOwnerEmail(user.email)` and redirects non-owners

## Key Files

| File | Purpose |
|------|---------|
| `lib/services/ai/video-generation.ts` | Multi-provider service (generate + status check) |
| `app/api/media/generate/video/route.ts` | Video API route (POST generate, GET status, PUT batch) |
| `lib/services/media-library.ts` | Supabase media asset storage |
| `lib/services/ai/voice-generation.ts` | ElevenLabs TTS for voiceovers |
| `lib/remotion/Root.tsx` | Remotion composition registry |
| `lib/remotion/compositions/` | React video compositions (SocialReel, ExplainerVideo) |
| `app/dashboard/admin/remotion-studio/page.tsx` | God Mode Remotion preview |
| `app/api/admin/remotion/route.ts` | Composition listing API |

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

| Mistake | Why It's Wrong | Correct Pattern |
|---------|---------------|----------------|
| Not checking provider env var | Silent failure | Each provider function checks first |
| Missing God Mode gate for HeyGen | Non-owners can access | Always check `isOwnerEmail()` |
| Auto-selecting HeyGen | Exposes God Mode feature | HeyGen requires explicit selection |
| Rendering Remotion server-side on Vercel | 50MB limit, 60s timeout | Use client-side Player or Lambda |
| Not polling for status | Videos are async | All providers return video_id for polling |
| Skipping media library save | Assets lost | Default `saveToLibrary: true` |

## Environment Variables

| Variable | Provider | Required |
|----------|----------|----------|
| `RUNWAY_API_KEY` | Runway ML | For video generation |
| `SYNTHESIA_API_KEY` | Synthesia | For avatar videos |
| `DID_API_KEY` | D-ID | For talking heads |
| `HEYGEN_API_KEY` | HeyGen | God Mode only |
| `ELEVENLABS_API_KEY` | ElevenLabs | For voice generation |
