# Spec — video-engine (SYN-1050 foundation uplift)

## Finish line

Every video artefact this skill helps produce (avatar, text-to-video, Remotion render, voiceover) is foundation-checked and brand-voice-gated before it lands, with every quantitative claim evidence-tagged.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — Aid Rule (Q3.1.1) on RestoreAssist content, voice tag (Q2.5.5), no fabricated metrics, verification gates for any view/engagement claim
- `.claude/memory/verification-gates.md`
- `lib/services/ai/video-generation.ts` — multi-provider generate + status service (Runway, Synthesia, D-ID, Remotion)
- `lib/services/ai/voice-generation.ts` — ElevenLabs TTS for voiceovers
- `lib/services/media-library.ts` — Supabase media asset storage
- `app/api/media/generate/video/route.ts` — video API route (POST generate, GET status, PUT batch)

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Remotion remains God-Mode only — never auto-selected, gated by `isOwnerEmail()` at `app/dashboard/admin/layout.tsx`.
- [ ] Every client-facing video/voiceover artefact routes through `brand-voice-enforce` before the CEO batched-review queue.
- [ ] No view/engagement metric is stated without a `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]` tag.

## Referenced paths (only ones VERIFIED to exist on disk)

- `lib/services/ai/video-generation.ts`
- `app/api/media/generate/video/route.ts`
- `lib/services/media-library.ts`
- `lib/services/ai/voice-generation.ts`
- `lib/remotion/Root.tsx`
- `lib/remotion/compositions/`
- `app/dashboard/admin/remotion-studio/page.tsx`
- `app/api/admin/remotion/route.ts`
- `app/dashboard/admin/layout.tsx`

## Known drift (referenced but missing on disk)

- none

## Verification

- `grep -q "ceo-foundation" .claude/skills/video-engine/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred).
- Changes to existing skill behaviour (additive only).
