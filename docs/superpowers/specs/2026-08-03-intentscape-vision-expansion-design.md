# IntentScape Context Field and Vision Expansion

**Issue:** SYN-1120  
**Status:** Human approval gate  
**Date:** 03/08/2026

`[STATUS] finish-line: locked — Done when Synthex can turn a multi-source situation into evidence-labelled Markdown context and genuinely competing vision hypotheses without any code path promoting the origin sentence or source type into a search query, capability selection, solution, goal or action before explicit human approval.`

`[STATUS] channel:source: done — The design is grounded in the current Synthex Constitution, route inventory, Command Centre intake, governed signal ledger, workflow execution models, private Supabase Storage pattern, structured AI output helper, evidence retriever registry and Obsidian adapter.`

`[STATUS] channel:prior-work: done — No IntentScape implementation or matching open/merged PR was found; existing CommandPacket, MarketingAgencySignal, WorkflowExecution and StepExecution patterns are reusable only after the new goal-authority seam.`

`[STATUS] channel:web: skipped — This phase adds no new external provider or API contract; vendor behaviour is not needed to decide the internal seam.`

`[STATUS] synthesis: complete — Build a new deep IntentScape module before integrating it with Command Centre or execution capabilities.`

`[STATUS] board: blocked — The documented boardroom CLI intent is unavailable and the direct board returned zero configured panellists; the two-attempt cap prevents another automatic retry.`

`[STATUS] gate: awaiting approval`

## 1. Finish line

[VERIFIED] The locked finish line is the testable sentence in the status line above. It directly implements SYN-1120 and the user's correction that the human input is a signal around which the system must form a vision, not an exact-search instruction.

## 2. Decision up front

[INFERENCE] Build one deep `IntentScapeEngine` module whose small interface owns context assembly, fixed-lens expansion, anchoring rejection, hypothesis persistence and human goal promotion. This follows the verified Synthex rule that the system controls the model and the model does not direct the system (`CONSTITUTION.md`, Agent Execution Rule 7). Command Centre packets, workflow executions, tools and specialist capabilities remain downstream and receive only an approved `GoalContract`, never `originSignal`.

[INFERENCE] Keep Markdown as the canonical knowledge artifact while storing each `.md` object in a private Supabase Storage bucket for production durability. Store only tenancy, version, hash, lineage and lookup metadata in PostgreSQL. This reconciles the user's Markdown-wiki requirement with Synthex's Vercel runtime and the existing private-bucket adapter pattern (`lib/services/ai/reference-library-private.ts`).

## 3. Goals and non-goals

### Goals

- [VERIFIED] Preserve the original human sentence verbatim as provenance-only `originSignal`.
- [VERIFIED] Combine it with organisation-scoped URLs, documents, notes, constraints, stakeholder signals, capabilities, prior attempts and source lineage.
- [VERIFIED] Run the same independent expansion lenses for every situation: evidence separation, upstream causes, downstream effects, stakeholder shifts, outside-category analogy, counterfactual and adjacent value.
- [VERIFIED] Generate at least three hypotheses that differ in causal mechanism.
- [VERIFIED] Reject exact/near-copy goals, searches and capability selections through a deterministic anchoring guard plus an independent evaluator.
- [VERIFIED] Require explicit human promotion of one hypothesis into a versioned `GoalContract` before producing any execution packet.
- [VERIFIED] Persist context, lens outputs, research gaps, hypotheses, audit, decision and goal contract as isolated Markdown wiki artifacts.
- [INFERENCE] Reuse Synthex evidence retrieval, structured-output and workflow infrastructure behind the new seam rather than inventing parallel provider plumbing.

### Non-goals

- [VERIFIED] IntentScape will not copy `originSignal` into `CommandPacket.rawText` and route it as work.
- [VERIFIED] It will not select a skill from input nouns, URL type, document name, brand category or requested deliverable.
- [VERIFIED] It will not publish, spend, send messages, alter external systems or enqueue internal task agents before goal approval.
- [VERIFIED] It will not use local Vercel filesystem writes as production storage.
- [VERIFIED] It will not introduce another authentication framework, connector vendor or npm dependency.
- [VERIFIED] It will not convert Synthex into public SaaS or add billing.

## 4. Invariants

The following transitions are structurally prohibited:

```text
goal = originSignal
searchQuery = originSignal
capability = classifyKeywords(originSignal)
solution = nearestTemplate(originSignal)
commandPacket = createCommandPacket(originSignal)
```

[VERIFIED] `originSignal` may be read only inside context assembly and vision expansion. It is not accepted by the goal-promotion or execution-packet interfaces.

[VERIFIED] Source ingestion returns evidence-labelled context; it never returns a selected capability or goal.

[VERIFIED] Capability activation accepts `GoalContractId`, not free text.

[VERIFIED] `goalAuthority = none` and `actionAuthority = none` until a named user approves a specific hypothesis version.

## 5. Module and interface

```ts
interface IntentScapeEngine {
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSnapshot>;
  addSignals(input: AddSignalsInput): Promise<ContextFieldSnapshot>;
  expandVision(input: ExpandVisionInput): Promise<VisionMapSnapshot>;
  approveGoal(input: ApproveGoalInput): Promise<GoalContractSnapshot>;
  buildWorkPacket(input: { goalContractId: string }): Promise<WorkPacket>;
}
```

[INFERENCE] This is a deep module: callers learn five operations while the implementation hides source validation, Markdown rendering, private storage, structured model output, retry limits, anchoring evaluation, versioning, audit events and organisation scoping.

[VERIFIED] The `expandVision` input contains `workspaceId` and selected context artifact versions. It contains no search query, workflow name, tool name or skill name.

[VERIFIED] The `approveGoal` input contains a hypothesis identifier/version and explicit acceptance criteria. It does not accept arbitrary mission text.

[VERIFIED] The `buildWorkPacket` input contains only an approved goal-contract identifier. The module reloads and verifies its approval state before returning a packet.

## 6. Expansion process

### Step A — Context Field

[VERIFIED] Capture every item with type, source, timestamp, evidence state, confidence, contradiction state and lineage. Human text and imported content are untrusted data, never prompt instructions.

### Step B — Fixed independent lenses

[VERIFIED] The same seven lenses run regardless of source type or prompt nouns. A website does not activate a website skill; an Instagram URL does not activate social analysis; developer documentation does not activate an integration build.

### Step C — Research branch formation

[VERIFIED] Each branch must declare the decision it could change, the context gap it tests, evidence for/against, useful distance from the origin signal and a stop condition.

[VERIFIED] Research retrieval receives the branch's causal question after the anchoring guard. It never receives the raw origin sentence as the query.

### Step D — Competing hypotheses

[VERIFIED] Produce at least three hypotheses with different causal mechanisms. Each contains affected stakeholders, supporting and weakening evidence, invalidating assumption, risk, adjacent value and decision-changing research gaps.

### Step E — Anchoring audit

[INFERENCE] Use two layers:

1. deterministic checks for exact/near-copy text, missing lens coverage, missing alternative mechanism, source-type routing and absent decision-changing justification;
2. a separately prompted structured evaluator that compares the origin signal with hypotheses/queries and fails closed when it cannot establish meaningful causal distance.

[VERIFIED] A failed audit persists its findings, creates no goal and returns the run to fixed-lens expansion. The two-round automatic retry cap in `CONSTITUTION.md` applies.

### Step F — Human goal promotion

[VERIFIED] The UI presents hypothesis diffs and evidence gaps. A human supplies/accepts desired change, stakeholder, evidence basis, constraints, exclusions, acceptance criteria, budget ceiling and authority boundaries.

[VERIFIED] Approval writes a versioned Markdown goal contract and an append-only event. Only then may the module build a downstream Work Packet.

## 7. Data model

### `IntentScapeWorkspace`

[INFERENCE] Organisation-owned container with creator, title, state, retention class and timestamps. `originSignal` is stored separately from approved-goal fields and is never exposed through an execution interface.

### `IntentScapeArtifact`

[INFERENCE] Metadata for a canonical private `.md` object: organisation, workspace, artifact kind, storage path, content hash, version, parent version, evidence state, lineage JSON, creator and timestamps. A unique `(organizationId, workspaceId, path, version)` key prevents cross-workspace overwrite.

### `IntentScapeVisionRun`

[INFERENCE] Tracks context version, model/provider identifiers, status, retry count, confidence, token/cost usage, anchoring-audit result, error and timestamps. Statuses: `pending`, `expanding`, `evaluating`, `awaiting_approval`, `blocked`, `failed`, `approved`.

### `IntentScapeHypothesis`

[INFERENCE] Versioned hypothesis rows scoped by organisation, workspace and vision run. Stores title, mechanism, affected stakeholders, evidence references, invalidating assumption, risk, adjacent value and rank.

### `IntentScapeGoalContract`

[INFERENCE] One explicitly promoted hypothesis version plus outcome, stakeholder, acceptance criteria, exclusions, authority boundary, approver and approval timestamp. Immutable after approval; revision creates a new version.

### `IntentScapeEvent`

[INFERENCE] Append-only lifecycle record for signal additions, artifact versions, expansion attempts, evaluator verdicts, approval/rejection and Work Packet creation.

[VERIFIED] All tables carry `organizationId`; every query includes it. New columns are additive/defaulted or nullable. Migration is applied through the approved Supabase migration path, never `prisma db push`.

## 8. Markdown wiki layout

```text
{organizationId}/{workspaceId}/
  README.md
  context/
    origin-signal.md
    field.md
    signal-ledger.md
    contradictions.md
  vision/
    run-{version}.md
    anchoring-audit-{version}.md
    hypotheses-{version}.md
  research/
    branch-{id}.md
  decisions/
    hypothesis-selection-{version}.md
    goal-contract-{version}.md
  execution/
    capability-activations-{version}.md
    work-packet-{version}.md
```

[VERIFIED] The origin signal, context, vision, decision and goal remain separate artifacts. This makes accidental promotion visible in both code and stored evidence.

## 9. Routes and UI

### Phase 1 — authenticated internal production surface

- [INFERENCE] `/dashboard/intentscape` uses canonical Supabase auth and active organisation scoping.
- [INFERENCE] `POST /api/intentscape/workspaces` creates a workspace and origin-signal artifact.
- [INFERENCE] `POST /api/intentscape/workspaces/[id]/signals` validates and versions the Context Field.
- [INFERENCE] `POST /api/intentscape/workspaces/[id]/expand` runs structured expansion and anchoring evaluation.
- [INFERENCE] `GET /api/intentscape/workspaces/[id]` returns the resumable projection.
- [INFERENCE] `POST /api/intentscape/workspaces/[id]/approve-goal` promotes a selected hypothesis version.
- [INFERENCE] `POST /api/intentscape/workspaces/[id]/work-packet` is hard-gated by approved goal ID.

[VERIFIED] Every mutation uses Zod validation and the repository's authenticated route policy. Every query derives the effective organisation from the signed-in user.

[INFERENCE] The UI is a visual context field, not a chat transcript: movable signals feed seven fixed lens columns, which feed distinct hypothesis cards and an explicit goal-contract approval panel. The origin signal remains visibly labelled “provenance only”.

### Phase 2 — free prospect companion

[INFERENCE] Add a separate guest-session adapter after Phase 1 passes isolation and abuse tests. Guest workspaces are pinned to a dedicated organisation, bound to an opaque hashed session token, rate/cost limited, expiry enforced and denied all internal Synthex task scopes. The UI can reuse the same IntentScapeEngine interface without exposing the internal dashboard.

[VERIFIED] Public SaaS billing, general sign-up and internal task access remain out of scope.

## 10. Security and cost guardrails

- [VERIFIED] Supabase auth only for Phase 1; effective organisation derived server-side.
- [VERIFIED] Private bucket; no public object URLs. Markdown is streamed only through authenticated, organisation-scoped routes.
- [VERIFIED] URL ingestion uses the existing evidence retriever registry and adapter-side SSRF validation.
- [VERIFIED] Imported pages and human text are delimited as untrusted evidence; embedded instructions cannot alter system policy, tools or authority.
- [VERIFIED] No credentials, access tokens, cookies or service keys are written to Markdown.
- [VERIFIED] Maximum two automatic attempts per expansion/evaluation step.
- [INFERENCE] Per-run limits: maximum source count, content bytes, model tokens, research branches and metered retrieval calls. Limits are machine-enforced and returned in the run projection.
- [VERIFIED] No action, publish, spend or internal `tasks` scope is available before goal approval; external effects keep their existing approval gates afterwards.
- [VERIFIED] Audit logs store hashes and safe metadata, not raw secrets.

## 11. Phased delivery and definitions of done

### Phase 1A — core seam and anti-anchoring evaluator

[VERIFIED] Done when unit/evaluation tests prove fixed-lens expansion, reject exact/near-copy promotion, reject source-type capability routing and block Work Packet creation without an approved goal.

### Phase 1B — durable Markdown and organisation isolation

[VERIFIED] Done when private `.md` artifacts round-trip by hash/version, cross-organisation reads/writes fail, and schema/RLS checks pass.

### Phase 1C — real model orchestration and resumable state

[VERIFIED] Done when a configured production model returns schema-valid hypotheses/evaluator output, failures/retries are durable, costs are recorded and no deterministic fake is shown as a live result.

### Phase 1D — internal production UI

[VERIFIED] Done when the full browser flow creates context, shows lens progress, presents competing hypotheses, blocks action, approves a goal, reloads/resumes and exports the Markdown wiki with no horizontal overflow or accessibility-critical errors.

### Phase 2 — public prospect boundary

[VERIFIED] Done when guest-session isolation, expiry, rate/cost caps, consent, deletion, abuse handling and zero-internal-tool exposure pass adversarial tests on a staging deployment.

## 12. Risk and assumption register

- [UNCONFIRMED] A private `intentscape-wiki` Supabase bucket does not yet exist. Creation requires an additive migration and production approval.
- [UNCONFIRMED] The preferred production model and per-run budget have not been product-locked. The engine will use the existing provider interface and expose configuration rather than hard-code vendor-specific behaviour.
- [UNCONFIRMED] Guest retention duration and dedicated guest organisation ID are not yet defined. Phase 2 cannot deploy until both are approved and configured.
- [UNCONFIRMED] Multi-model board critique is unavailable in this worktree because no boardroom panellists are configured. The human gate must not interpret the missing critique as approval.
- [INFERENCE] A model-only anchoring judge can agree with the generator. The deterministic guard and separate evaluator reduce this risk, but evaluation fixtures and observed failure rates remain required.
- [INFERENCE] Existing `CommandPacket.rawText`, `teamRoute` and `routingHints` could reintroduce input anchoring if used too early. The new seam prevents creating a Command Packet until a Goal Contract is approved.
- [VERIFIED] Local Obsidian is dev-only and disabled on Vercel, so it cannot be the sole production wiki store (`CONSTITUTION.md`, Obsidian Vault Conventions).

## 13. Open decisions for the human gate

1. [UNCONFIRMED] Approve the Phase 1 route as authenticated `/dashboard/intentscape`, with the public free companion following after production isolation evidence.
2. [UNCONFIRMED] Approve private Supabase Storage `.md` objects as the canonical production wiki, with PostgreSQL used only for metadata/indexing/audit.
3. [UNCONFIRMED] Approve the rule that no Command Packet is created until a Goal Contract is explicitly approved.

## 14. Verification plan

```bash
npx prisma validate
npm run type-check
npm run lint
npm test -- --coverage
npm run rls:adversarial
npm run security:scan
npm run e2e -- --grep "IntentScape"
npm run build:vercel
```

[VERIFIED] Targeted tests must include: exact-origin goal rejection, near-copy query rejection, source-type routing rejection, missing-lens rejection, non-distinct hypotheses, unapproved Work Packet denial, stale hypothesis approval denial, cross-organisation workspace/artifact denial, SSRF input denial, prompt-injection fixture, retry cap, hash/version round-trip, refresh/resume and guest-token isolation before Phase 2.

[VERIFIED] No passing or production claim is allowed without the real command output. Deployment remains a separate founder approval gate.
