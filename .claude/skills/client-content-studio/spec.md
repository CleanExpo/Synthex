# Spec — client-content-studio (SYN-1049 foundation uplift)

## Finish line
Every per-client avatar+voice artefact this connector produces is foundation-checked, consent-gated, human-approved, and brand-voice-gate-passed before it is published to any client surface.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — Aid Rule (Q3.1.1) on RestoreAssist, consent records, cross-client boundary (Phase 3.4), no fabricated client metrics
- `.claude/memory/verification-gates.md`
- Per-client config from `lib/marketing-agency/studio/clients.ts` (`STUDIO_CLIENTS`, `getStudioClient` — clientSlug, avatarId, voiceId, consent, platforms)
- Per-client trigger input (daily cron OR `ClientEngagementEvent`)
- Env-only provider keys (`HEYGEN_API_KEY`, `ELEVENLABS_API_KEY`) and per-client overrides (`RA_HEYGEN_AVATAR_ID`, `RA_ELEVENLABS_VOICE_ID`, `RA_CONSENT_REF`, `RA_PRESENTER_NAME`)

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] No client-facing artefact publishes without `approval.approved === true` (gate in `publishApprovedUpdate`, throws `NotApprovedError`).
- [ ] No HeyGen avatar renders without a recorded consent record (`createAvatarVideo` throws `HeyGenConsentError`).
- [ ] Every client metric reported is real (`ClientEngagementEvent` / platform APIs) or marked `DATA_REQUIRED` — no invented numbers, every claim carries one evidence tag.
- [ ] Output routes through `brand-voice-enforce` before the CEO batched-review queue.

## Referenced paths (only ones VERIFIED to exist on disk)
- `lib/ai/content-generator.ts` (SKILL.md references `lib/ai/content-generator` without extension)
- `lib/services/ai/voice-generation.ts`
- `lib/marketing-agency/heygen/` (and `lib/marketing-agency/heygen/client.ts`)
- `lib/social/`
- `lib/marketing-agency/studio/avatar-video.ts`
- `lib/marketing-agency/studio/client-content-loop.ts`
- `lib/marketing-agency/studio/clients.ts`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)
- none (all referenced `lib/...` paths resolve; `lib/ai/content-generator` is `lib/ai/content-generator.ts`)

## Verification
- `grep -q "ceo-foundation" .claude/skills/client-content-studio/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
