---
name: heygen-avatar
description: >-
  HeyGen avatar-video provider reference for Synthex. Documents the real env-driven HeyGen
  v2 client and its ElevenLabs voice pairing. NEVER call createAvatarVideo without a consent
  record. NEVER hard-code HEYGEN_API_KEY (Vercel env only). NEVER silently mock a live call —
  no key hard-blocks unless allowMockFallback is explicitly set. ALWAYS prefer an ElevenLabs
  audio_url (lip-sync) over HeyGen text TTS. Activate on ANY request to generate, poll, or
  debug HeyGen avatar videos, or wire avatar+voice generation.
metadata:
  author: synthex
  version: '1.0'
  type: reference-skill
  epic: SYN-1005
  triggers:
    - heygen
    - avatar video
    - avatar lip-sync
    - generate avatar
    - video_status
    - elevenlabs voice clone
  requires: []
context: fork
---

# HeyGen Avatar Provider

## Client

`lib/marketing-agency/heygen/client.ts` → `createHeyGenClient(config?)` returns:

- `createAvatarVideo(request)` → `{ id, provider:'heygen', status }`
- `getVideoStatus(videoId)` → `{ status: queued|processing|completed|failed, videoUrl? }`
- `waitForCompletion(videoId, { timeoutMs, intervalMs, sleep? })` → final job (bounded poll)

`config`: `{ apiKey?, baseUrl?, fetchImpl?, allowMockFallback? }`. `apiKey` defaults to
`process.env.HEYGEN_API_KEY`. `fetchImpl` is injectable for tests.

## Request shape

```ts
{
  avatarId: string,
  script: string,                 // used only for the text→TTS path
  consent: HeyGenConsentMetadata, // REQUIRED — { subjectName, sourceRef, confirmedAt }
  audioUrl?: string,              // PREFERRED — ElevenLabs audio for lip-sync
  voiceId?: string,               // HeyGen voice for the text path (no audioUrl)
  dimension?: { width, height },  // default 1280×720
  title?: string,
}
```

## Voice pairing (preferred path)

ElevenLabs is the voice source (`lib/services/ai/voice-generation.ts` → `generateSpeech`
returns `audioBase64`). The composition helper
`lib/marketing-agency/studio/avatar-video.ts` (`generateAvatarVideo`) does:
`generateSpeech → upload to a public URL → createAvatarVideo({ audioUrl })`. Prefer this
(real cloned voice + lip-sync) over HeyGen's built-in text TTS.

## Hard rules (NEVER)

- **NEVER** call `createAvatarVideo` without `consent` — it throws `HeyGenConsentError` by design.
- **NEVER** hard-code the API key — `HEYGEN_API_KEY` lives in Vercel env only.
- **NEVER** make a silent mock stand in for a live call. No key → `HeyGenConfigurationError`
  (matches the Artlist provider gate). The mock job is returned **only** when
  `allowMockFallback: true` is explicitly passed (dev/preview).
- **NEVER** publish a video still in `queued`/`processing` — poll to `completed` first.

## Status mapping

HeyGen `completed|success → completed`; `failed|error → failed`; `pending|waiting|processing → processing`.

## Cost awareness

HeyGen renders + ElevenLabs synthesis are billed per use. Track cost-of-generation per
client (margin vs retainer) — see `client-content-studio`. Don't loop renders without a cap.

## Testing

Inject `fetchImpl` (and `sleep` for `waitForCompletion`) — never hit the network in unit
tests. See `tests/unit/lib/heygen-client.test.ts`.

## Anti-patterns

- ❌ Throwing away the consent gate to "simplify" — it's a legal/likeness control.
- ❌ Using HeyGen text TTS when an ElevenLabs cloned voice is available (off-brand voice).
- ❌ Blocking a serverless function on a long synchronous poll — prefer queue + status check.

---

## Foundation & Gate Wiring (SYN-1050)

> Adopted from the senior-skill standard so every artefact this skill produces is checked against the locked foundation before it lands.

**Reads at every invocation (never cached — re-read each run):**

- `.claude/memory/ceo-foundation.md` — consent records, Aid Rule (Q3.1.1) on RestoreAssist, cross-client boundary (Phase 3.4), no fabricated client metrics.
- `.claude/memory/verification-gates.md` — gate state for any claim referenced.

**Output gate:** every client-facing artefact this skill produces routes through `brand-voice-enforce` before the CEO batched-review queue. A REJECT blocks the artefact until the quoted offending string is fixed.

**Evidence standard:** every quantitative or factual claim carries exactly one tag — `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`. Untagged = defect (`.claude/rules/fabel-evidence-standard.md`). Never state a projected result as fact.

**Spec:** see `spec.md` in this skill directory.
