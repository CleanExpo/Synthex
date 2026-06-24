# Spec — heygen-avatar (SYN-1050 foundation uplift)

## Finish line
Every avatar-video artefact this skill produces is foundation-checked and brand-voice-gated before it lands.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — consent records, Aid Rule (Q3.1.1) on RestoreAssist, cross-client boundary (Phase 3.4), no fabricated client metrics
- `.claude/memory/verification-gates.md`
- `lib/marketing-agency/heygen/client.ts` — the env-driven HeyGen v2 client (`createHeyGenClient`, `createAvatarVideo`, `getVideoStatus`, `waitForCompletion`)
- `lib/services/ai/voice-generation.ts` — ElevenLabs `generateSpeech` (preferred voice source)
- `lib/marketing-agency/studio/avatar-video.ts` — `generateAvatarVideo` composition helper (audio_url lip-sync path)

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] No `createAvatarVideo` call is described/produced without a `consent` record (`HeyGenConsentError` gate preserved).
- [ ] `HEYGEN_API_KEY` is never hard-coded; missing key hard-blocks (`HeyGenConfigurationError`) unless `allowMockFallback: true` is explicitly set.
- [ ] ElevenLabs `audioUrl` lip-sync path is preferred over HeyGen text TTS in any produced artefact.
- [ ] No video reported as published while still `queued`/`processing` — must poll to `completed` first.

## Referenced paths (only ones VERIFIED to exist on disk)
- `lib/marketing-agency/heygen/client.ts`
- `lib/services/ai/voice-generation.ts`
- `lib/marketing-agency/studio/avatar-video.ts`
- `tests/unit/lib/heygen-client.test.ts`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)
- none

## Verification
- `grep -q "ceo-foundation" .claude/skills/heygen-avatar/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred).
- Changes to existing skill behaviour (additive only).
