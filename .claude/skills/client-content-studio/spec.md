# Spec — client-content-studio (SYN-1049 foundation uplift)

## Finish line

Every per-client avatar+voice artefact this connector produces is foundation-checked, consent-gated, human-approved, and brand-voice-gate-passed before it is published to any client surface.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — Aid Rule (Q3.1.1) on RestoreAssist, consent records, cross-client boundary (Phase 3.4), no fabricated client metrics
- `.claude/memory/verification-gates.md`
- Per-client config derived from the `Organization` record by `lib/marketing-agency/studio/clients.ts` (`resolveStudioClient` — `settings.studio` → legacy env layer → `video: null`; never a placeholder)
- Per-client trigger input (daily cron OR `ClientEngagementEvent`)
- Env-only provider keys (`HEYGEN_API_KEY`, `ELEVENLABS_API_KEY`) and the legacy per-client env layer for the two pilots (`RA_HEYGEN_AVATAR_ID`, `RA_ELEVENLABS_VOICE_ID`, `RA_CONSENT_REF`, `RA_PRESENTER_NAME`, `RA_CONSENT_CONFIRMED_AT`; all five required, and the `CARSI_` set)

## Decisions (engineering bench, 2026-09-03)

- `organizationId` is the tenancy key; `clientSlug` is a display key copied from `Organization.slug` and may diverge after a rename. Every Studio read and write is scoped by `organizationId`.
- A Studio approval publishes on the organisation's behalf, so the approver must belong to that organisation itself; membership of the parent workspace alone reads the board but does not approve. "Belong" has exactly two forms in the schema: the user's single `User.organizationId` equals the organisation, or an active `BusinessOwnership` row names the user as its owner. A user therefore approves at most one Studio client by membership; every further client needs a `BusinessOwnership` row, which only `createChildBusiness` and onboarding write today. Before the second pilot is approved, confirm one exists for the approver (query in the PR body).
- A Studio post is gated by the organisation's publish-safety state exactly like an autopilot post: `calendarMode` must be `live` and auto-publish must not be paused, checked at approval and again by the cron at publish time. A pilot publishes nothing until its organisation is set to `live` — by `POST /api/calendar/live-mode-activate` naming the organisation, or by `scripts/cutover-studio-pilot.ts`. Pausing is a stop, not a queue: a Studio post the gate has held for more than 48 hours past its `scheduledAt` is marked `expired` by the cron and never published, so returning an organisation to `live` cannot release a backlog of dated posts.
- Drafts approved under the OLD approve route (before this branch) are `approved` with no Post and no `studioSchedule` record, unreachable by the new claim. Decision: re-open them, not retire them — they were approved by a human and should publish once re-approved. `scripts/reset-orphaned-approved-studio-drafts.ts` (dry-run default) returns them to `awaiting_approval` after the new code is live, preserving who approved them under `metadata.legacyApproval`.
- Approval is all-or-nothing across a draft's cron-eligible platforms: every one gets a Post or the claim rolls back. `externalPublishingAllowed` flips only on that commit. A rolled-back attempt persists nothing but its own record (`metadata.studioScheduleAttempt`); clearances the approver named are recorded only on commit.
- The funnel link travels in the post text unless the platform renders `linkUrl` as a card (LinkedIn, Facebook, Reddit, Pinterest) and the post has no media.

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
