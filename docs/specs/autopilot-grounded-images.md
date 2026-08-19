# Spec — Grounded Real-Images in Autonomous Autopilot Posts

> Status: spec + implementation (single safe increment).
> Binding rules: `.claude/rules/real-images-only.md`, `.claude/rules/verification-gate.md`,
> `.claude/rules/fabel-evidence-standard.md`. Skill: `.claude/skills/grounded-visuals`.
> Every claim below is tagged per the Fabel evidence standard.

## 1. Problem

`[VERIFIED — app/api/cron/autopilot/route.ts:301-408]` The daily Autopilot cron
generates **text-only** posts. `generateSlotContent()` creates a `Post` with
`metadata` that never populates `metadata.images`. Posts that clear the quality
gate as `schedule` are written with `status: 'scheduled'`.

`[VERIFIED — app/api/cron/publish-scheduled/route.ts:556-562]` The publish cron
already reads `metadata.images` (a `string[]` of media URLs) and forwards them as
`mediaUrls` to the platform service. So the only missing wire is: **autopilot must
populate `metadata.images` from the grounded image pipeline** before creating a
scheduled post.

`[VERIFIED — .claude/rules/real-images-only.md]` The ONLY sanctioned entry point
is `generateImage()` / `generateBatch()` in `lib/services/ai/image-generation.ts`.
It is grounded-by-default, auto-applies the industry LoRA, and returns
`{ blocked: true, success: false }` (no image) when no owned references resolve for
the subject. That block is correct behaviour and must never be bypassed.

## 2. THE DARK-SAFETY INVARIANT (non-negotiable)

> **If grounded image generation does not return a usable grounded image
> (`result.success && result.imageUrl && result.grounded === true`), the
> autonomous post MUST NOT auto-publish. It is downgraded to `status: 'draft'`
> for human pickup, and NO image is written to `metadata.images` — never a
> placeholder, stock, or ungrounded image. The `useReferences: false` escape
> hatch is never used in this autonomous path.**

Rationale: attaching a fake/stock/ungrounded image would be a "false recording"
per the founder's Real-Images-Only mandate, and auto-publishing an imageless post
would contradict the mandate's intent that autonomous posts carry real images.
`draft` is the safest resolution — a human decides, and the true fix is always to
grow the owned reference library (add real photos), never to bypass the block.

Behaviour change (flagged): an org with **no owned reference coverage** for its
subject will now have its would-be-scheduled autopilot posts land as **drafts**
instead of auto-publishing text-only. This is the mandate working as designed
(`blocked` = correct behaviour); the remedy is adding real photos, per
`grounded-visuals` step 5. `[INFERENCE — from real-images-only.md block semantics]`

## 3. Call site + subject derivation

`[VERIFIED — route.ts:301-407]` The change lives inside `generateSlotContent()`,
after the quality-gate loop determines `bestDecision`, and **only** for posts that
would be scheduled (`bestDecision === 'schedule'`). Draft/reject posts are not
image-generated — draft posts are human-reviewed and can have images added
manually; this bounds cost (see §5).

Subject/industry derivation for the image prompt uses the data already threaded
into the slot: `businessName`, `industry`, `offerings`, and the slot `theme`. A
concise real-scene prompt is built from these; `generateImage` auto-detects the
industry from the prompt text and resolves owned references (the sanctioned
default per `grounded-visuals` — "a bare, well-written prompt is already grounded

- LoRA'd"). No `referenceSet` is forced and no LoRA id is passed — the industry
  LoRA auto-applies.

## 4. Design

New helper `lib/autopilot/grounded-post-image.ts`:

```
attachGroundedImage(input, deps?) -> {
  images: string[];              // [imageUrl] on grounded success, else []
  status: 'scheduled' | 'draft'; // downgraded to 'draft' on any non-grounded outcome
  meta: {                        // merged into Post.metadata for evidence
    imageGrounded: boolean;
    imageReferenceSet?: string;
    imageRefCount?: number;
    imageBlocked?: boolean;
    imageBlockReason?: string;
    downgradeReason?: 'image-blocked';
  };
}
```

- Calls `generateImage(options, systemGenerationContext(orgId, { userId,
autonomyLevel: 'autonomous', traceId: runId }))`. The `generateImage` fn is an
  injectable dependency (`deps.generateImage`, default = the real service export)
  so the helper is unit-testable without hitting a provider — mirroring the
  existing `generateBatch(_generate = generateImage)` idiom.
- NEVER passes `useReferences` (grounded stays default-on) and NEVER passes a
  legacy `provider` pin.
- Dark-safe gate: attaches `[result.imageUrl]` ONLY when
  `result.success && !!result.imageUrl && result.grounded === true`. Any other
  outcome (blocked, failure, or a defensively-unexpected `grounded !== true`)
  returns `images: []`, `status: 'draft'`, and records the block reason.

`generateSlotContent()` wiring: for a scheduled decision, call the helper; use its
returned `status` for `Post.status` (and `scheduledAt` only when status stays
`scheduled`), spread `images` into `metadata.images`, and merge `meta`. Draft/reject
paths are unchanged.

## 5. Cost / bounding

`[VERIFIED — image-generation.ts:640]` One `generateImage` call = one grounded
image (single, not a batch). Images are generated only for scheduled-decision
posts, exactly one per post. No batch fan-out, no variations. This caps spend at
≤ 1 image per auto-published post per run.

Risk `[UNCONFIRMED]`: grounded FLUX generation adds ~25-30s per scheduled post;
the cron `maxDuration` is 300s. Orgs with many scheduled slots could approach the
ceiling. Not addressed in this increment (out of scope) — noted as a follow-up if
observed. The failure mode is safe: a timeout/throw for a slot is caught by the
existing per-slot `try/catch` and counts as rejected, not a bad publish.

## 6. Test plan (red-first)

Unit tests for `attachGroundedImage` (injected fake `generateImage`):

- (a) grounded success (`success, imageUrl, grounded:true`) → `images:[url]`,
  `status:'scheduled'`, `meta.imageGrounded === true`.
- (b) blocked (`success:false, blocked:true`) → `images:[]`, `status:'draft'`,
  `meta.imageBlocked === true`, `meta.downgradeReason === 'image-blocked'`, and
  NO url in `images` (no placeholder).
- (c) plain failure (`success:false, blocked:false`) → `images:[]`,
  `status:'draft'`, no image.
- (d) defensive: ungrounded success (`success:true, grounded:false`) is treated
  as non-grounded → `images:[]`, `status:'draft'`.
- (e) never calls a provider directly: the existing static guard
  `tests/unit/ai/no-direct-image-apis.test.ts` scans `lib/` and must stay green
  with the new file (it delegates to the sanctioned `generateImage`).

## 7. Verification

`type-check`, `eslint` on changed files, the new test file, and the guard suite
`tests/unit/ai/no-direct-image-apis.test.ts` — all green. Real Jest output pasted
in the completion report per `verification-gate.md`.
