---
name: client-content-studio
description: >-
  Autonomous per-client avatar+voice content engine (HeyGen + ElevenLabs) that turns a
  paying client's project activity into constant client-focused updates, published and
  measured per client through the Synthex dashboard. NEVER publish client-facing content
  without the human-approval gate. NEVER generate a HeyGen avatar without a recorded
  consent record. NEVER report fabricated client metrics (views/engagement) — only real
  or DATA_REQUIRED. ALWAYS scope per client and one-source→many-surfaces. Activate on ANY
  request to generate client video/voice updates, onboard a client to the studio, build
  the autonomous content loop, or work on the HeyGen/ElevenLabs pipeline.
metadata:
  author: synthex
  version: '1.0'
  type: orchestrator-skill
  epic: SYN-1005
  triggers:
    - client content studio
    - avatar video
    - heygen
    - elevenlabs
    - client video update
    - behind the scenes video
    - autonomous content loop
    - per-client content
    - onboard client to studio
  requires:
    - heygen-avatar
    - content-pipeline
    - video-engine
    - social-integrations
    - platform-content-adaptor
    - brand-voice-enforce
context: fork
---

# Client Content Studio

> **Visual generation (binding):** all images/video route through the grounded
> pipeline — see `.claude/rules/real-images-only.md` + the `grounded-visuals`
> skill. Direct provider calls fail CI.

## Purpose

Produce a constant stream of **client-focused** avatar+voice content (insights, updates,
knowledge, advantages, behind-the-scenes) for paying clients (RestoreAssist pilot; then
CCW, Disaster Recovery, CARSI, and others as they come online), published per client and
measured — all behind a human-approval gate. Built on what Synthex already has; it does
**not** rebuild providers.

## The loop (built — SYN-1005)

```
per-client trigger (daily cron OR ClientEngagementEvent)
  → generateScript        (content-pipeline / lib/ai/content-generator)
  → ElevenLabs voice      (lib/services/ai/voice-generation.ts — generateSpeech)
  → HeyGen avatar lip-sync (lib/marketing-agency/heygen — see heygen-avatar skill)
  → DRAFT 'awaiting_approval'        ← prepareClientUpdate()  [NOTHING PUBLISHED]
  → ★ HUMAN APPROVAL ★
  → publish one-source→many-surfaces (lib/social — 9 platforms, publish-scheduled)
  → measure (ClientEngagementEvent)  ← publishApprovedUpdate()
  → signal feeds the next topic
```

## Real modules (source of truth)

| Concern                        | File                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Voice→avatar composition       | `lib/marketing-agency/studio/avatar-video.ts` (`generateAvatarVideo`)                                 |
| Per-client loop + gate         | `lib/marketing-agency/studio/client-content-loop.ts` (`prepareClientUpdate`, `publishApprovedUpdate`) |
| Per-client config (org-driven) | `lib/marketing-agency/studio/clients.ts` (`resolveStudioClient`, `toClientStudioConfig`)              |
| Approve → schedule bridge      | `lib/marketing-agency/studio/approve-and-schedule.ts` (`approveAndScheduleStudioDraft`)               |
| HeyGen provider                | `lib/marketing-agency/heygen/client.ts` (see `heygen-avatar` skill)                                   |
| ElevenLabs TTS (existing)      | `lib/services/ai/voice-generation.ts`                                                                 |

All orchestration functions are dependency-injected (script gen, avatar gen, persist,
publish, emit) — keep them that way so the loop stays unit-testable with no network.

## Hard safety contracts (NEVER violate)

1. **NEVER publish client-facing content without `approval.approved === true`.** The gate
   lives in `publishApprovedUpdate` — it throws `NotApprovedError` and publishes nothing
   otherwise. Do not add a bypass. Clients are paying; tone and accuracy are gated by a human.
2. **NEVER render a HeyGen avatar without a consent record.** `createAvatarVideo` throws
   `HeyGenConsentError` on missing consent — keep it.
3. **NEVER publish an unrendered draft.** `publishApprovedUpdate` requires `video.videoUrl`.
4. **NEVER fabricate client metrics.** Views/engagement/reach in client reporting are real
   (from `ClientEngagementEvent` / platform APIs) or marked `DATA_REQUIRED`. No invented numbers.
5. **NEVER hard-code provider keys.** Read from env (Vercel only). No key → providers hard-block
   (consistent with the Artlist/HeyGen provider gates); mock only on explicit opt-in.
6. **ALWAYS scope per client** (`clientSlug`) and treat each client's cadence/platforms independently.

## Visual assets — REAL IMAGES ONLY mandate

1. Any non-avatar image asset for a client update (thumbnail, post image, article
   hero) is generated ONLY via `generateImage()`/`generateBatch()`
   (`lib/services/ai/image-generation.ts`) or the `generate_image` MCP tool —
   grounded-by-default on the owned reference library
   (`public/reference-library/manifest.json` + private bucket
   `reference-library-private`; client job photos ingest via
   `POST /api/admin/private-refs`). No owned references for the client's subject ⇒
   `blocked: true` — ingest real client photos first, never substitute stock or a
   direct provider call.
2. Non-avatar video generation uses `lib/services/ai/video/generation-service.ts`
   with the same grounded default (seeds from owned references,
   `GroundingBlockedError` on no coverage).
3. Carpet-cleaning (CCW) assets auto-apply the `carpet-style-v1` LoRA (trigger
   `ccwcarpet`).
4. Published/approved client videos are corpus-growth inputs — extract frames via
   the Railway media worker (`media_*` MCP tools / frame-extraction scripts) into
   the reference library.

## Encoded creator playbook (from the top-5 research)

- **Default to daily, machine-paced cadence** — the avatar removes the human bottleneck.
- **One source → many surfaces** — each topic becomes a video + GEO/SEO article + platform-native
  repurposes (use `platform-content-adaptor`).
- **Versioned, parameterised blueprints**, not one-off runs; log per-step reasoning.
- **Measure → scale winners** — A/B avatar-vs-manual + hook variants.
- **Track per-client margin** — cost-of-generation (HeyGen/ElevenLabs) vs retainer.

## Onboarding a new client

There is no code registry. The `[client]` route segment is the organisation slug and the
Studio config is derived from the `Organization` record (`resolveStudioClient`):

1. Make sure the business exists as an organisation (slug = studio client id). It is
   immediately usable in the Studio; the board reports `videoConfigured: false` until
   step 2 is done — no placeholder avatar/voice/consent is ever substituted.
2. Set `Organization.settings.studio` via `PATCH /api/organizations/[orgId]` (merged
   server-side): `displayName?`, `platforms?`, `funnelUrl?`, and for video `avatarId`,
   `voiceId`, `consent { subjectName, sourceRef, confirmedAt }`. The legacy env layer
   for the two original pilots (`RA_*` / `CARSI_*`) needs all five names:
   `_HEYGEN_AVATAR_ID`, `_ELEVENLABS_VOICE_ID`, `_CONSENT_REF`, `_PRESENTER_NAME`,
   `_CONSENT_CONFIRMED_AT`; a partial set is "not configured", with the missing names
   in the board's `warnings`.
3. Confirm the consent record is real (signed presenter consent), not a placeholder.
4. Wire the trigger (cron or event) and the dashboard surface (VS-6).

Approval in the Studio schedules a real post (g2): one `Post` per cron-schedulable
platform, scoped to the business, carrying the UTM-tagged `funnelUrl`. A draft seeded
from a campaign pack with `externalPublishingAllowed: false` is deny-by-default: each
platform's `externalPublishBlocks` must be discharged — approval (the click), credentials
(an active platform connection for the business), anything else (e.g. the final
asset-rights check) by naming it in the approve request's `clearances`. A blocked or
failed schedule hands the draft back to `awaiting_approval` (HTTP 409 / 502).

## Environment

`HEYGEN_API_KEY`, `ELEVENLABS_API_KEY` (Vercel only). Legacy per-client env layer (pilots
only; new businesses use `settings.studio`): `RA_HEYGEN_AVATAR_ID`, `RA_ELEVENLABS_VOICE_ID`,
`RA_CONSENT_REF`, `RA_PRESENTER_NAME`, `RA_CONSENT_CONFIRMED_AT` (and the `CARSI_` set).

## Status

- ✅ VS-1..VS-5 (provider clients, composition, per-client loop, approval gate, publish+measure) — PR #322, fully unit-tested.
- ⏳ VS-6 — per-client dashboard surface (needs a `StudioDraft` persistence model + migration — CEO-gated schema change).
- 🟡 Live render verifies on the preview deploy once `HEYGEN_API_KEY` is set.

## Quality gates

- Every change runs `npm run type-check && npm run lint && npm test` to 100% green before "done".
- Orchestration stays DI'd + unit-tested (no network in tests).
- The human-approval gate and consent gate must remain enforced — a test that removes them is a regression, not a passing change.

---

## Foundation & Gate Wiring (SYN-1049)

> Adopted from the senior-skill standard so every artefact this connector produces is checked against the locked foundation before it lands.

**Reads at every invocation (never cached — re-read each run):**

- `.claude/memory/ceo-foundation.md` — Aid Rule (Q3.1.1) on RestoreAssist, consent records, cross-client boundary (Phase 3.4), no fabricated client metrics.
- `.claude/memory/verification-gates.md` — gate state for any claim referenced.

**Output gate:** every client-facing artefact this connector produces routes through `brand-voice-enforce` before the CEO batched-review queue. A REJECT blocks the artefact until the quoted offending string is fixed.

**Evidence standard:** every quantitative or factual claim carries exactly one tag — `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`. Untagged = defect (`.claude/rules/fabel-evidence-standard.md`). Never state a projected result as fact.

**Spec:** see `spec.md` in this skill directory.
