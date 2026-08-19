# ui-reference brief — media ingestion + guided AI walkthrough

> Status: DRAFT. Mobbin patterns settled; the Adaptation section is pending the codebase maps.
> Founder brief (18/08/2026): "improve the adding of video files, audio files, etc and having
> the AI assistant do the walk through and have it visible for me to follow and change anything
> if I want. But create a more automated system. there are also a lot of ways to get lost."

Per founder directive 2026-07-13, references inform original design. Steal the pattern —
hierarchy, flow, component choice, spacing rhythm. Never the pixels, never an asset, never a
competitor's branding.

## The four jobs-to-be-done

The brief is not one screen. It is four distinct jobs that must compose into one surface:

| #   | Job                                       | Platform           | Success test                                                           |
| --- | ----------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| J1  | Add a video/audio file and know it worked | web, desktop-first | Founder drops a file and never wonders whether it is still uploading   |
| J2  | Watch the AI do the work, step by step    | web                | Founder can name what the assistant is doing right now, without asking |
| J3  | Interrupt and change any step             | web                | Founder edits step 3's output and steps 4+ re-run from the edit        |
| J4  | Never get lost                            | web                | From any depth, founder can say where he is and get back in one action |

## Comparables (from the curated cache, `Wiki/mobbin-ui-library.md`)

| Job   | Comparable                                                                                                                                     | Why this one                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| J1    | Instacart — [gallery](https://mobbin.com/apps/instacart-ios-5dd8c677-b2bd-414e-a4bc-3e4f68b38048/38225df9-04ac-435e-a1b9-390bfee4d638/screens) | Long-running job with live progress the user did not have to ask for |
| J1    | Zip — [gallery](https://mobbin.com/apps/zip-ios-9c5e6faf-b117-4e52-97ca-8ab194e9d489/732a21c0-ee06-4f81-83c8-35f81d4a5903/screens)             | Progressive disclosure in a multi-step flow: one decision per screen |
| J2/J3 | Cleo AI — [gallery](https://mobbin.com/apps/cleo-ai-ios-e9061da4-d434-4d7d-8dcb-975aeeb8be9c/61ff2d0f-0198-445d-863a-9d2d52297140/screens)     | AI assistant that narrates its own reasoning in the thread           |
| J2/J3 | Genie — [gallery](https://mobbin.com/apps/genie-ios-ca2f73fe-0974-4841-8cd8-ffe7217ac82c/4ae703fe-be77-47d9-b339-cd70dba4066c/screens)         | Assistant surface where the user steers mid-task                     |
| J4    | Hulu — [gallery](https://mobbin.com/apps/hulu-ios-a2546f27-6147-4f25-b4da-0000e607f69a/72429142-e5d0-4b4a-a11a-d220237535c1/screens)           | Deep content library that stays navigable at depth                   |
| J4    | Tubi — [gallery](https://mobbin.com/apps/tubi-ios-af0e1a58-b0a3-421a-bbe8-7dfea95aa70d/c26db334-8ba2-45aa-bc6a-5e7241d15ac3/screens)           | Same job, flatter hierarchy — the counter-example to Hulu            |
| J4    | Affirm — [app page](https://mobbin.com/apps/affirm-ios-133a5e7f-7284-4989-8cf9-4f18999afdc2)                                                   | Founder pick 2026-07-14; drove the command-deck Daylight theme       |

**Cache gap, stated honestly.** The curated library has no dedicated _file-upload wizard_ or
_editable-agent-transcript_ reference. J1's pattern is therefore drawn from Instacart's
job-progress structure and Zip's step disclosure rather than from an upload screen captured in
Mobbin. J3's editability pattern is the weakest-sourced of the four. Both need a live Mobbin
pull behind the logged-in session before the design is final — flagged, not papered over.

## Pattern — what the comparables converge on

**P1 — The file is not the first step; the intent is.** Instacart and Zip both open on _what
you are trying to achieve_, then collect the inputs that serve it. Applied here: the founder
picks the outcome ("cut a 30s promo", "add these to the reference library") and the upload
becomes a step inside that, not a naked dropzone he has to interpret.

**P2 — One decision per view, with the whole path visible.** Zip never shows two choices at
once, but always shows how many remain. This is the specific move: progressive disclosure with
a persistent step rail, not a wizard that hides its own length.

**P3 — Long work reports itself.** Instacart's shopper progress is pushed, never polled by the
user. Applied to J1/J2: upload, transcode, transcribe and generate each stream their own state.
The founder never clicks refresh to learn whether something finished.

**P4 — The assistant narrates in the same surface where you can stop it.** Cleo and Genie both
put the AI's reasoning and the user's steering in one column. The anti-pattern is a progress
modal that shows steps but offers no way in. Applied to J2/J3: each step renders as a card in a
single vertical transcript, and each card carries its own edit affordance.

**P5 — Depth needs a spine.** Hulu keeps a persistent rail so depth never disorients; Tubi
instead stays flat. They disagree, which is the useful part.

## Divergence — and the side this build takes

**D1 — Hulu's persistent rail vs Tubi's flat hierarchy (J4).** Take **Tubi's flatness for the
route tree, Hulu's spine for the run surface.** Reason: the founder's complaint is "a lot of
ways to get lost", which is an IA problem, and adding a rail to a sprawling tree decorates the
sprawl instead of cutting it. Flatten the tree first; keep a persistent spine only inside a
long-running job, where depth is genuine rather than accidental.

**D2 — Zip's one-decision-per-screen vs Cleo's single scrolling thread (J1 vs J2).** Take
**the thread, with steps that collapse.** Reason: a wizard's separate screens destroy the audit
trail the founder explicitly asked for ("visible for me to follow"). A thread of collapsed step
cards gives one active decision plus full history in one scroll position.

**D3 — Automation vs control.** The brief asks for both: "more automated" and "change anything
if I want". Resolve by **defaulting to auto-run and making every completed step retroactively
editable**, rather than by pausing for approval at each step. Reason: pausing for approval at
every step is the opposite of more automated. Editing a finished step and re-running downstream
delivers control without spending the founder's attention up front.

## Adaptation

The maps came back and changed the shape of the work: most of this already exists. Full design in
`media-run-guided-walkthrough-spec-2026-08-18.md`. What each pattern maps onto:

| Pattern                             | Existing thing it maps onto                                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 intent-first                     | A run is created from an outcome, persisted as `WorkflowExecution` (`prisma/schema.prisma`)                                                                                                  |
| P2 one decision, whole path visible | `components/workflows/StepTimeline.tsx` already renders per-step status, confidence, timing and error                                                                                        |
| P3 long work reports itself         | Exists but **polls** — `lib/workflow/hooks/use-workflow-executions.ts` uses a 5s SWR interval. Hand-rolled SSE exists for chat (`app/api/ai/chat/.../messages/route.ts`) and could be reused |
| P4 narrate where you can steer      | `components/workflows/ApprovalActions.tsx` (approve, or reject with a required written reason) plus `WorkflowAuditTimeline.tsx`                                                              |
| P5 spine at depth                   | `components/onboarding/StepProgressV2.tsx` is the established linear-progress component; reuse rather than invent                                                                            |

The AI half maps onto `lib/services/ai/studio-tools/` — 10 scoped, risk-classed tools reached
through one call site, `executeStudioTool()`. It is currently wired only to the MCP route and a
cron script, so no product UI can reach it. That join is the build.

**Tokens.** Bound to `app/globals.css` and `tailwind.config.cjs`. Explicitly **not**
`docs/DESIGN-SYSTEM.md` or `docs/design-system/SYNTHEX-Design-System-Guide.md`, both of which
document utility classes that do not exist in the live CSS.

## Constraints that bind this design

- **Real images only** (`.claude/rules/real-images-only.md`). Any generated visual routes
  through `generateImage()` / `generateBatch()` in `lib/services/ai/image-generation.ts`, or
  `submitGenerativeVideo()` in `lib/services/ai/video/generation-service.ts`. No direct
  provider calls — `tests/unit/ai/no-direct-image-apis.test.ts` fails CI on violations. No
  owned references for a subject means the generation is BLOCKED by design, and the fix is
  adding real photos, never bypassing.
- **Layer rule** (`.claude/rules/development/workflow.md`): Pages → Components → Hooks → lib/
  services → Prisma. No cross-layer imports.
- **Verification gate** (`.claude/rules/verification-gate.md`): this work ships with a
  verification checklist stating where to look and what to see, not a "done" claim.
