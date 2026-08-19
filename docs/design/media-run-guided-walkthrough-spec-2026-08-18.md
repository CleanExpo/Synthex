# Media Run — a guided, visible, editable walkthrough

> Status: DESIGN, awaiting founder review. Nothing in this document has been built.
> Companion to `media-walkthrough-ui-reference-brief-2026-08-18.md` (the Mobbin patterns).
> Founder brief 18/08/2026: "improve the adding of video files, audio files, etc and having
> the AI assistant do the walk through and have it visible for me to follow and change
> anything if I want. But create a more automated system. there are also a lot of ways to
> get lost."

## The headline

**You already own about 80% of this.** Three separate maps of the codebase agree: there is a
working step orchestrator, a step-by-step timeline UI, an approve/reject-with-reason gate, an
audit trail, and a scoped, risk-classed AI tool registry. What is missing is not an engine. It
is three specific joins.

Building a new assistant from scratch would duplicate tested infrastructure. This spec reuses
it.

## What exists (verified, with paths)

| Capability you asked for             | Already built                                                                                                        | Where                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Named steps that run in order        | Workflow orchestrator, 2-retry cap, confidence gate                                                                  | `lib/workflow/orchestrator.ts` (`advanceWorkflow`, `evaluateGate`)                                         |
| Watch each step happen               | Vertical step timeline with per-step status, confidence, timing, error                                               | `components/workflows/StepTimeline.tsx`                                                                    |
| Change something before it continues | Approve one-click, Reject requires a written reason; rejection is non-terminal (`revision_requested`, not cancelled) | `components/workflows/ApprovalActions.tsx`, `orchestrator.ts` (`approveCurrentStep` / `rejectCurrentStep`) |
| See what the system did              | "What did the agency OS do" audit view                                                                               | `components/workflows/WorkflowAuditTimeline.tsx`                                                           |
| The AI actually doing media work     | 10 scoped tools incl. `generate_video`, `generate_image`, `search_media_library`, `derive_cuts`, `get_job`           | `lib/services/ai/studio-tools/` (`executeStudioTool`)                                                      |
| Somewhere for it all to land         | Full asset CRUD: folders, tags, favourites, search, stats                                                            | `lib/services/media-library.ts`, `app/api/media/library/route.ts`                                          |
| Step state persistence               | `WorkflowExecution`, `StepExecution` (with `waiting_approval`, `revision_requested`, `retryCount`, `approvedBy`)     | `prisma/schema.prisma`                                                                                     |

## The three gaps (this is the whole build)

**G1 — The tool registry has no in-product UI.** `lib/services/ai/studio-tools/index.ts` says in its
own header comment that "REST routes, the MCP server, and the in-app copilot are thin wrappers
over these". The in-app copilot does not exist. Outside of tests, `executeStudioTool` is called
by exactly two things: the MCP route and a cron script. So today the assistant that can generate
your video is reachable by Claude Code and not by you, in your own product.

**G2 — Steps cannot be edited after they finish.** The orchestrator can approve or reject the
_current_ step. It cannot take step 3's finished output, let you change it, and re-run 4 onward.
That is precisely "change anything if I want", and it is the one genuinely new mechanism needed.

**G3 — The media library has a backend and no browser.** Folders, tags, favourites, search and
stats are all implemented server-side with no UI that reads them. Uploaded files effectively
disappear. This is a large part of "a lot of ways to get lost".

## The surface

One route, `/dashboard/studio`, replacing the scattered generate-and-upload entry points.

```
┌──────────────────────────────────────────────────────────────┐
│  Studio                                    [ Library ]  ⌘K   │
├───────────────────────────┬──────────────────────────────────┤
│                           │                                  │
│   RUN THREAD              │   INSPECTOR                       │
│   (scrolling history)     │   (the selected step)             │
│                           │                                  │
│  ┌─────────────────────┐  │   Step 3 · Draft captions         │
│  │ You                 │  │   ───────────────────────         │
│  │ Cut a 30s promo     │  │   Model: sonnet                   │
│  │ from these two      │  │   Cost:  $0.004                   │
│  │ [clip.mov] [vo.mp3] │  │   Took:  2.1s                     │
│  └─────────────────────┘  │                                   │
│                           │   Output (editable)               │
│  ✓ 1 Probe media     ⌄    │   ┌─────────────────────────┐    │
│  ✓ 2 Derive cuts     ⌄    │   │ Water damage doesn't    │    │
│  ✓ 3 Draft captions  ⌃    │   │ wait for business hours │    │
│  ⟳ 4 Render          ...  │   └─────────────────────────┘    │
│  ○ 5 Quality gate         │                                   │
│  ○ 6 Publish   ⏸ you      │   [ Save & re-run from here ]     │
│                           │                                   │
└───────────────────────────┴──────────────────────────────────┘
```

**Left is the thread.** Collapsed step cards, newest at the bottom, full history in one scroll
position. This is divergence D2 from the reference brief, decided in favour of Cleo's single
thread over Zip's separate wizard screens, because separate screens destroy the audit trail you
asked to be able to follow.

**Right is the inspector.** Click any step, see exactly what it did, what it cost, and its
output in an editable field.

**Automation is the default, control is retroactive.** Steps run without asking. That is
divergence D3: pausing for approval at every step is the opposite of "more automated". You get
control by editing a finished step, not by babysitting each one. The only hard stop is a step
whose `riskClass` is publish or spend — and the tool registry already refuses to carry those
(`assertV1RiskInvariant`, machine-enforced by `tests/unit/mcp/namespace-tools.test.ts`).

## G2 in detail — re-run from an edited step

The one new mechanism. It needs a decision from you, so it is stated plainly rather than assumed.

When you edit step 3's output and press "Save & re-run from here":

1. Write the edited output to `StepExecution[3].output`, stamp `editedBy` and `editedAt`.
2. Mark steps 4..n `superseded` — a new status. They are kept, not deleted, so the audit trail
   still shows what the machine produced before you intervened.
3. Reset `currentStepIndex` to 4 and re-enter `advanceWorkflow`.
4. Steps 4..n re-run against your edited step 3.

Two things this deliberately does **not** do:

- It does not re-run step 3 itself. Your edit is the output; re-running would discard it.
- It does not refund the spend already settled on steps 4..n. `MediaSpendEvent` keeps both the
  original and the re-run as separate ledger rows, so a re-run costs money and the ledger says so.

**Open question Q1 for you:** should a re-run be capped, for example three re-runs per execution
before it asks? Without a cap, an edit loop on a video step can spend real money quickly.

## G3 in detail — the library browser

A grid at `/dashboard/studio/library`, reading the CRUD that already exists. Filter by type
(image / video / audio), folder, tag, favourite. Search by name. Every asset shows which run
produced it, linking back to that thread. Nothing new server-side is required.

## Information architecture

The route and navigation map is still being generated, so the IA section is deliberately
unfinished. The reference brief already decided the principle (divergence D1): flatten the route
tree first, and keep a persistent spine only inside a long-running run where depth is genuine.
Adding a navigation rail to a sprawling tree decorates the sprawl instead of cutting it.

## What binds this build

Taken from the design-system audit, because two of the design docs in this repo are stale and
would mislead:

- **Tokens come from `app/globals.css` and `tailwind.config.cjs`.** `docs/DESIGN-SYSTEM.md` and
  `docs/design-system/SYNTHEX-Design-System-Guide.md` describe utility classes that do not exist
  in the live CSS. Do not design against them.
- **Zero new `lucide-react` / `@heroicons/react` / `@fortawesome/*` imports.** The CI gate
  (`.github/scripts/design-md-lint.sh`) compares against a frozen baseline of 61 and the repo is
  sitting exactly on 61. One new icon import fails the build. Use `components/icons` or add a
  custom SVG.
- **No raw hex, nothing below `text-xs`.** ESLint `no-restricted-syntax` over `app/**` and
  `components/**`.
- **Any new mutation route needs Zod, an ownership check, and rate limiting**
  (`scripts/security/route-safety-scan.mjs`).
- **Real images only.** Visuals route through `generateImage()` / `generateBatch()` or
  `submitGenerativeVideo()`. No owned reference for a subject means BLOCKED by design, and the
  fix is adding real photos.
- **Australian English.** Nothing enforces it, so it is applied by hand.

## Sequence, smallest useful thing first

| #   | Slice                                                                | Why this order                                          | Ships something usable |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------- |
| S1  | Library browser over existing CRUD                                   | No new backend, immediately stops files vanishing       | Yes                    |
| S2  | Run thread + inspector, read-only, over existing `WorkflowExecution` | Makes runs visible before making them editable          | Yes                    |
| S3  | Wire `executeStudioTool` to a step type (G1)                         | The assistant can now actually do media work in-product | Yes                    |
| S4  | Re-run from edited step (G2)                                         | The hardest and most spend-sensitive piece, done last   | Yes                    |
| S5  | Flatten the IA, add `⌘K`                                             | Needs the route map first                               | Yes                    |

S1 and S2 touch no money and no publish path. S4 does, which is why it is last and why Q1 needs
your answer.

## Verification, per `.claude/rules/verification-gate.md`

Nothing here claims completion. When S1 ships, the checklist will be: go to
`/dashboard/studio/library`, you should see the assets you have already uploaded including any
audio, filtering by type should change the grid, and you should not see an empty state if
`media_assets` has rows.
