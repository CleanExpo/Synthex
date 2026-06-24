# Synthex Productivity Intelligence Upgrade — spec.md

Status: PLANNING ONLY — no implementation performed
Date: 24/06/2026 10:28 AEST
Owner: Phill / Synthex Board
Workspace: /Users/phillmcgurk/Synthex

> For Hermes: this is a planning artifact only. Do not implement until Phill approves a build slice and a Linear issue exists.

## 1. Goal

Turn the newly loaded YouTube/Obsidian research, the specialised Synthex skill teams, Senior PM practice, Board review patterns, Pi-Dev-Ops advances, and Unite-Group Mission Control work into one actionable productivity upgrade plan for Synthex.

The outcome is not “more agents”. The outcome is higher safe throughput:

- fewer repeated explanations;
- cleaner context for agents;
- stronger evaluation before “done” claims;
- less generic content;
- better signal intake;
- better routing from research → spec → gated execution;
- explicit gaps before build work starts.

## 2. Evidence base inspected

### 2.1 Synthex project state

[VERIFIED] `/Users/phillmcgurk/Synthex/CONSTITUTION.md` defines Supabase-only auth, no mock data, org-scoped queries, Linear issue requirement, no push without approval, and production human gates.

[VERIFIED] `/Users/phillmcgurk/Synthex/CLAUDE.md` defines the Fabel method, evidence tags, project session protocol, and specialised skill selection.

[VERIFIED] `/Users/phillmcgurk/Synthex/docs/production-readiness/SHIPIT-PATHWAY.md` currently says Synthex is RED / not production-ready as-is, with P0 SSRF, P1 IDOR, weak real authz coverage, cron uncertainty, and DR debt.

[VERIFIED] `/Users/phillmcgurk/Synthex/docs/marketing-intelligence/README.md` and `ceo-synthesis-agentic-marketing-2026.md` show the marketing-intelligence machine exists, but the earlier run found zero YouTube sources in `/Users/phillmcgurk/2nd-brain/`.

[VERIFIED] Current git state before this spec: `main...origin/main [ahead 1, behind 168]` with many pre-existing modified/untracked files. This spec must not assume a clean tree.

### 2.2 Obsidian / YouTube source location

[VERIFIED] Canonical vault `/Users/phillmcgurk/2nd-brain/` exists.

[VERIFIED] The newly loaded YouTube-style transcript notes appear under `/Users/phillmcgurk/Unite-Group/docs/brain/2nd Brain/Sources/Completed/`, not under `/Users/phillmcgurk/2nd-brain/Sources/`.

[VERIFIED] Relevant YouTube/Obsidian source notes inspected include:

- `Stop Vibe Coding, Start Agentic Engineering – Micky.md`
- `Build Agents That Run for Hours (Without Losing the Plot) — Ash Prabaker & Andrew Wilson, Anthropic.md`
- `handoff is my new favourite skill.md`
- `How to Use /goal to Build a Self-Improving OS.md`
- `The Old SEO System Is Collapsing. Here's What Replaces It..md`
- `Real Strategies to Create Quality Content at Scale With AI.md`
- `This AI Tool Maps Any Codebase Before You Touch It (Understand-Anything).md`
- `I stopped using /grill-me for coding. Here’s what I use instead.md`
- `8 Critical Questions To Stop Your AI Agents From Lying To You.md`

### 2.3 Pi-Dev-Ops and Unite-Group advances inspected

[VERIFIED] `/Users/phillmcgurk/Pi-Dev-Ops/AGENTS.md` defines a boundary matrix, evaluator threshold, file-count ceiling, no-credentials rule, push branch discipline, and test gates.

[VERIFIED] `/Users/phillmcgurk/Pi-Dev-Ops/swarm/intake/SPEC.md` defines a Telegram → Margot → SPM → Board → production intake pipeline with locked guardrails, trusted identity, board round cap, and creator-only production approval.

[VERIFIED] `/Users/phillmcgurk/Pi-Dev-Ops/skills/product-manager/SKILL.md` defines a Senior PM product audit framework: feature completeness, journey gaps, documentation, DX, product gaps, and RICE prioritisation.

[VERIFIED] `/Users/phillmcgurk/Unite-Group/docs/superpowers/specs/2026-06-23-signal-ingestion-intake-design.md` defines the missing front-half bridge from inbound signal → proposed task, while preserving approval gates.

[VERIFIED] `/Users/phillmcgurk/Unite-Group/docs/superpowers/specs/2026-06-23-content-lane-design.md` defines idea → content generation → gated publish, reusing existing content engine rather than building a parallel system.

[VERIFIED] `/Users/phillmcgurk/Unite-Group/docs/superpowers/specs/2026-06-23-visual-campaign-studio-design.md` defines concept → pick → platform assets → lock/publish, with human-in-the-loop creative gating.

[VERIFIED] `/Users/phillmcgurk/Unite-Group/docs/superpowers/specs/2026-06-23-multi-provider-console-design.md` defines capacity-aware provider routing and visible provider health, while explicitly rejecting policy-risk token pooling.

[VERIFIED] `/Users/phillmcgurk/Unite-Group/apps/workspace/docs/swarm/ARCHITECTURE.md` defines SwarmBrief, checkpoint contracts, orchestrator routing, and greenlight gates.

## 3. Board synthesis: what the research says

### 3.1 Agentic engineering is mostly harness design, not prompting

[VERIFIED] The Micky transcript argues that the productivity jump comes from the harness around the model: tools, source-of-truth context, clean service layers, small plans, PR review loops, and best-in-class models.

[VERIFIED] The Anthropic long-running-agents transcript says the failure modes are context, planning, and judgment. It recommends planner / generator / evaluator role separation, adversarial evaluation, granular done contracts, trace reading, and file-system shared state.

[BOARD VIEW] Synthex already has many ingredients, but they are too spread out across docs, skills, PM files, and external repos. The weakness is not lack of ideas. The weakness is missing operating seams that convert research and signals into small, evaluated, gated work packets.

### 3.2 Self-evaluation is a trap

[VERIFIED] Anthropic transcript: models are poor judges of their own output. Separate evaluator context and harsh rubrics are required.

[VERIFIED] `/Users/phillmcgurk/Synthex/docs/production-readiness/SHIPIT-PATHWAY.md` proves the same locally: green tests existed, but security and authz defects still made the app RED.

[BOARD VIEW] Synthex needs adversarial evaluators attached to every meaningful build lane: security, PM completeness, UX/product, evidence quality, and content originality.

### 3.3 Context needs explicit source maps and shared language

[VERIFIED] Matt Pocock’s handoff note recommends focused markdown handoffs for separate agent sessions, using pointers not duplicated context, and keeping handoffs disposable.

[VERIFIED] Matt Pocock’s grill-with-docs note recommends `context.md` / ubiquitous language and ADRs so humans, code, and agents use the same terms.

[VERIFIED] Understand-Anything note argues that codebase maps help agents understand flows, dependencies, impact, and business meaning before making changes.

[BOARD VIEW] Synthex has abundant docs but lacks a single current `context.md` and current codebase map that says: these are the product domains, canonical flows, route owners, service boundaries, and terms. This causes repeated re-reading and agent drift.

### 3.4 Content productivity is not volume; it is viewpoint + context + proof

[VERIFIED] A. Lee Judge transcript says quality at scale = context + human viewpoints + AI for framing/organisation/clarity. Noise looks like productivity when output increases but buyers do not move.

[VERIFIED] Neil Patel transcript says search is shifting from rank/click reporting toward AI citation/share-of-voice, entity presence, third-party mentions, structured quotable claims, and digital PR/community/YouTube/forum presence.

[BOARD VIEW] Synthex’s content lane must not simply publish more AI output. It needs a viewpoint/proof capture step and an AI-citation measurement loop before scale.

### 3.5 Agent permission boundaries must be product artefacts, not assumptions

[VERIFIED] “8 Critical Questions” note defines workflow-vs-agent test, permission buckets, failure cost, reversibility/detection quadrant, tool/context audit, model/vendor portability, name test, and 10x unit economics.

[VERIFIED] Synthex CONSTITUTION and Pi-Dev-Ops AGENTS both already encode action gates.

[BOARD VIEW] Synthex needs these boundaries surfaced inside the product / operating system, not buried in agent docs. Every lane should show: Auto / Approval / Never, reversibility, detection speed, and whose name is on the action.

## 4. Weaknesses and missing elements

### W1 — Research-source mismatch

[VERIFIED] Synthex marketing-intelligence docs still say YouTube data is missing from `/Users/phillmcgurk/2nd-brain/`, but the new YouTube data is in `/Users/phillmcgurk/Unite-Group/docs/brain/2nd Brain/Sources/Completed/`.

Impact: Synthex will continue reporting `DATA_REQUIRED` for YouTube intelligence unless the source map accepts the actual imported location.

Needed element: a source registry that supports multiple vault roots and explicitly labels canonical vs imported vs mirrored sources.

### W2 — No current Synthex domain `context.md`

[INFERENCE] Synthex has CLAUDE/CONSTITUTION and many docs, but no verified current repo-root `context.md` / ubiquitous language map was found in the inspection.

Impact: agents re-derive terms like campaign, source, authority packet, content lane, agency task, workflow execution, approval, publish queue, and client loop each session.

Needed element: `docs/context/synthex-context.md` plus lightweight ADRs for surprising decisions.

### W3 — Planning/evaluation contracts are scattered

[VERIFIED] Synthex has Fabel and ShipIt docs; Unite-Group has SwarmBrief/checkpoint contracts; Anthropic transcript recommends generator/evaluator negotiated done contracts.

Impact: build tasks may start before the evaluator has agreed what “done” means.

Needed element: a standard Synthex Work Packet with: goal, scope, no-gos, done contract, evaluator rubric, proof commands, rollback, approval bucket.

### W4 — Signal intake is missing the front half

[VERIFIED] Unite-Group signal-ingestion design says the back half exists but signal → proposed task is the missing bridge.

[INFERENCE] Synthex has similar symptoms: docs/reports/research exist, but the system does not reliably convert inbound YouTube/research/cron/evidence into proposed work with dedupe and PM triage.

Needed element: signal normaliser + dedupe + proposed-task creation, with no auto-execution.

### W5 — Content scale risks generic output

[VERIFIED] Synthex has marketing/content machinery and authority packets.

[VERIFIED] Content research warns that high-volume AI content without viewpoint becomes noise.

Needed element: POET-style viewpoint/proof capture before content generation: what we believe, what we stop/start doing, what we saw work, what to measure/watch.

### W6 — GEO/AEO measurement gap

[VERIFIED] Neil Patel transcript recommends AI citation/share-of-voice and structured quotable authority, while Synthex marketing-intelligence currently prioritises INFRA-1 crawl and INFRA-2 GSC wiring.

Needed element: an “AI Citation Readiness” score that remains `HYPOTHESIS_FOR_TESTING` until first-party / approved external data exists.

### W7 — Provider/capacity health is not visible inside Synthex

[VERIFIED] Unite-Group multi-provider console spec exists and is grounded on provider-pool work.

Impact: autonomous research/build lanes can stall or degrade when one provider hits limits.

Needed element: reuse the provider-health concept as read-only Synthex ops context first; do not create new vendors or token-pooling lanes.

### W8 — Production readiness debt can poison productivity

[VERIFIED] ShipIt Pathway says Synthex is RED due to P0/P1 security/authz defects despite green tests.

Impact: adding more automation before the P0/P1 path is fixed increases blast radius.

Needed element: all new productivity lanes must be planning/read-only/draft-only until ShipIt P0/P1 gates are cleared.

### W9 — Source-of-truth codebase map is missing

[VERIFIED] Understand-Anything-style research says codebase maps help agents understand large repos before touching code.

[INFERENCE] Synthex has route refs and docs, but the current inspection did not find a single up-to-date architecture graph or flow map generated from code.

Needed element: a read-only codebase map / route-flow index before the next major refactor or agent-lane build.

### W10 — Handoff protocol is not productised

[VERIFIED] Matt Pocock handoff pattern recommends narrow handoff docs that preserve clean context and allow parallel/adversarial agents.

Needed element: Synthex should standardise task handoffs under `.claude/handoffs/` or a temp path, and use them when splitting research, prototype, review, and build lanes.

## 5. Proposed Synthex upgrade: “Research → Work Packet → Evaluated Lane”

### 5.1 System shape

```
YouTube / Obsidian / cron / repo evidence
        ↓
Source Registry + Signal Normaliser
        ↓
Senior PM triage
        ↓
Board review: value, risk, permission, 10x economics
        ↓
Synthex Work Packet
        ↓
Specialised lane: research | content | software | visual | ops
        ↓
Adversarial evaluator contract
        ↓
Draft / PR / approval queue
        ↓
Human gate before external side effect
```

### 5.2 New planning artifacts

1. `docs/productivity/source-registry.md`
   - Lists all accepted research roots.
   - Marks `/Users/phillmcgurk/Unite-Group/docs/brain/2nd Brain/Sources/Completed/` as imported YouTube transcript source.
   - Links older `/Users/phillmcgurk/2nd-brain/` as canonical operating vault.
   - Prevents “no YouTube found” false negatives.

2. `docs/context/synthex-context.md`
   - Ubiquitous language for Synthex product domains.
   - Defines content lane, marketing lane, authority packet, approval queue, publish, draft, campaign, source, citation, claim, client loop, agency task, workflow execution.
   - Cross-references actual code paths and docs.

3. `docs/productivity/work-packet-template.md`
   - One template for future tasks.
   - Contains goal, why now, exact scope, no-gos, source evidence, evaluator rubric, test/proof commands, approval bucket, rollback, handoff pointer.

4. `docs/productivity/evaluator-rubrics.md`
   - Harsh rubrics for Product, Security, Evidence, UX, Content, and Ops.
   - Uses weighted criteria like Anthropic’s design/originality/craft/functionality pattern, adapted to Synthex.

5. `docs/productivity/ai-citation-readiness.md`
   - Planning-only metric model for GEO/AEO readiness.
   - Stays `HYPOTHESIS_FOR_TESTING` until measured.
   - Avoids fabricated citation metrics.

6. `docs/productivity/signal-intake-plan.md`
   - Synthex-specific version of Unite-Group signal ingestion.
   - Converts imported YouTube/research/cron evidence into proposed tasks only.
   - No auto-execution.

## 6. Default branch / default decisions

If Phill says “go” on this spec, the default branch is:

- Branch name: `plan/synthex-productivity-intelligence-spec`
- Work mode: docs-only first slice
- No app code changes in slice 1
- No DB migrations
- No provider/vendor additions
- No production deploy
- No public publishing
- No `.env*` reads or writes
- No Git push unless Phill explicitly asks

Default decisions:

1. Use existing infrastructure only: GitHub, Linear, Supabase, Railway, Vercel, Telegram, existing Google integrations.
2. Do not use Nango or any new connector vendor.
3. Treat imported YouTube claims as `OPINION_SOURCE` until cross-verified.
4. Treat Synthex ShipIt P0/P1 as a hard gate before external automation expands.
5. Build docs and source maps before implementation.
6. Create/attach Linear issues before any future code work.
7. Prefer read-only/draft-only automation until Board signs an approval policy.

## 7. Phased plan

### Phase 0 — Planning closeout (current)

Deliverable: this `spec.md`.

Status: complete when Phill reviews and picks a slice.

No code, no push, no deploy.

### Phase 1 — Source and context hygiene (docs-only)

Objective: stop research/source drift and reduce repeated explanation.

Tasks:

1. Create `docs/productivity/source-registry.md`.
2. Create `docs/context/synthex-context.md`.
3. Patch `docs/marketing-intelligence/README.md` to say YouTube data now exists in the Unite-Group imported vault path, but remains `OPINION_SOURCE` pending verification.
4. Create `docs/productivity/work-packet-template.md`.
5. Create `docs/productivity/evaluator-rubrics.md`.

Verification:

- `git diff --check`
- `npx markdownlint-cli2 "docs/**/*.md"` if available, otherwise document unavailable command.
- Read-back of created docs.

### Phase 2 — PM/Board triage model (docs + tests if code later)

Objective: formalise how ideas become proposed work.

Tasks:

1. Adapt Unite-Group `SignalEnvelope` concept for Synthex planning.
2. Define permission buckets: Auto / Approval / Never.
3. Define failure quadrant: reversible/detectable.
4. Define 10x unit-economics check for agent actions.
5. Define Board packet shape: value, risk, cost, proof, approval.

Verification:

- Every proposed lane maps to one permission bucket.
- Every external side-effect remains approval-gated.

### Phase 3 — Content quality upgrade

Objective: make Synthex content higher-signal before scaling output.

Tasks:

1. Add POET-style input fields to content planning docs: Proof, Opinion, Experience, Trust.
2. Require one real customer/sales/operator situation per authority packet.
3. Add “quotable claim” register for GEO/AEO testing.
4. Keep all AI-citation claims `HYPOTHESIS_FOR_TESTING` until measured.

Verification:

- New content packet template rejects generic “trend summary” drafts.
- Every claim has source/proof or is labelled hypothesis/opinion.

### Phase 4 — Evaluated build lane design

Objective: attach adversarial review before future implementation.

Tasks:

1. For each future build packet, require generator/evaluator negotiated done contract.
2. Define evaluator personas: security, PM completeness, route/auth, UX, evidence.
3. Require proof commands before “done”.
4. Use handoff docs when splitting lanes.

Verification:

- Work packet includes evaluator rubric before implementation starts.
- Evaluator can fail the generator without changing scope.

### Phase 5 — Implementation only after approval

Objective: turn approved docs into product surfaces only after ShipIt P0/P1 is under control.

Potential build surfaces:

- Synthex source registry panel.
- Work packet generator.
- Signal intake route.
- Content viewpoint capture UI.
- AI citation readiness dashboard.
- Provider health read-only tile.

Gate:

- Phill approval.
- Linear issue.
- Current branch pulled/rebased from origin.
- ShipIt P0/P1 status reviewed.

## 8. Risks and mitigations

| Risk                                             | Severity | Mitigation                                                                           |
| ------------------------------------------------ | -------: | ------------------------------------------------------------------------------------ |
| Building automation while Synthex is RED         |     High | Keep phases 1–4 docs/planning/read-only; do not auto-execute external side effects   |
| Treating YouTube opinion as fact                 |     High | `OPINION_SOURCE` by default; cross-verify before scoring/action                      |
| New source registry duplicates vaults            |   Medium | Source registry points to roots; does not copy raw transcripts                       |
| More docs become more noise                      |   Medium | Each artifact must have a named consuming workflow                                   |
| Evaluators rubber-stamp                          |   Medium | Separate context, harsh rubric, evidence-only verdict format                         |
| Generic content at scale                         |   Medium | POET/viewpoint gate before AI drafting                                               |
| Provider capacity work becomes new-vendor sprawl |     High | Existing approved providers only; no Nango; no new external account without approval |

## 9. Success metrics

Within 30 days of approval:

- Every new Synthex task has a Work Packet before implementation.
- Every Work Packet has a permission bucket and evaluator rubric.
- Imported YouTube/research sources are discoverable from one source registry.
- Content packets include proof/opinion/experience/trust fields.
- No `DATA_REQUIRED` item is promoted as verified.
- No external publish/deploy/DB write happens without human gate.

Within 90 days:

- PM triage time drops because agent packets start with source evidence.
- Fewer rework loops from missing auth/route/context assumptions.
- Marketing intelligence has live crawl/GSC data or remains honestly blocked.
- Synthex has a reusable evaluated-lane pattern for software/content/visual/ops work.

## 10. Board recommendation

Approve Phase 1 as the first slice only.

Reason:

- It is docs-only and safe against the current dirty/behind git state.
- It fixes the immediate false-negative source problem.
- It gives specialised teams a clean shared language and work-packet contract before code changes.
- It does not worsen Synthex’s current ShipIt RED risks.

Do not approve product automation until Phase 1 exists and ShipIt P0/P1 status has been rechecked.

## 11. Subagent Board/PM addendum

The asynchronous specialist review completed after the first draft and added these upgrades. They are now part of this spec.

### 11.1 Decision-grade planning requirements

Every future Synthex Work Packet must include:

- entry criteria;
- exit criteria;
- accountable owner;
- dependency list;
- due date or appetite;
- “what good looks like”;
- expected CEO/team queue impact;
- WIP impact;
- blocked state: `ready`, `blocked-data`, `blocked-approval`, or `blocked-security`.

Reason: the Senior PM review flagged that Synthex has roadmap themes but not enough execution detail to prevent “done-looking” work.

### 11.2 Capacity and WIP model

Add a hard throughput model before scaling lanes:

- CEO queue target: keep at or below 6–10 h/week.
- Every proposed packet states expected review/approval minutes.
- If WIP exceeds the cap, the default action is de-scope, not add another lane.
- No task enters implementation if its approval path is undefined.

### 11.3 Unified prioritisation rubric

Every proposed item gets one comparable score:

`priority = (impact × confidence) / (risk × effort)`

Required fields:

- impact;
- confidence;
- risk;
- effort;
- blocker status;
- source evidence;
- approval bucket;
- rollback or stop rule.

This aligns Synthex product planning with the existing marketing-intelligence confidence-adjusted scoring model.

### 11.4 Cross-team handoff contracts

Each specialised team handoff must declare:

- input schema;
- output schema;
- accepted statuses;
- rejection reasons;
- evaluator rubric;
- exact next action.

This applies to strategist → copy → gate → queue → publish/measure, and to software/research/ops lanes.

### 11.5 Imported patterns from Pi-Dev-Ops and Unite-Group

Additional inspected reusable patterns:

- Skill registry as operating layer: `/Users/phillmcgurk/Pi-Dev-Ops/skills/agentskills-manifest/SKILL.md`, `/Users/phillmcgurk/Unite-Group/apps/spec-board/skills/fable-engine/SKILL.md`.
- Board/evaluator split: `/Users/phillmcgurk/Pi-Dev-Ops/docs/ship-chain/03-the-evaluator.md`, `/Users/phillmcgurk/Pi-Dev-Ops/skills/agentic-review/SKILL.md`.
- Persistent command-centre shell: `/Users/phillmcgurk/Unite-Group/apps/workspace/src/components/workspace-shell.tsx`.
- Agent/provider status abstraction: `/Users/phillmcgurk/Unite-Group/apps/workspace/src/lib/workspace-agents.ts`, `/Users/phillmcgurk/Unite-Group/apps/workspace/src/server/claude-dashboard-api.ts`.
- Live status strips: `/Users/phillmcgurk/Pi-Dev-Ops/dashboard/components/control/ActiveBuildStrip.tsx`.
- Compound learning loop: corrected path `/Users/phillmcgurk/Pi-Dev-Ops/docs/ops/compound-development-loop.md`.

Risk controls:

- Skill registry must enforce triggers/outputs/verification, not just names.
- Status visuals must be honest; “phase unknown” is better than fake progress.
- Provider abstraction must not leak into UI or introduce unapproved vendors.
- Learning loop needs a concrete destination and consuming workflow.

### 11.6 Stop/hold policy

Any proposed productivity work is automatically `blocked-security` if a current P0/P1 security, tenant-safety, or data-integrity concern would increase its blast radius.

Current known context: `docs/production-readiness/SHIPIT-PATHWAY.md` marks Synthex RED. Therefore Phase 1 remains docs-only and source/context hygiene only.

## 12. Open questions for Phill

These are decision points, not blockers for reading the spec:

1. Should the imported YouTube transcript source remain in Unite-Group, or should Synthex reference it only through a source registry?
2. Should Phase 1 docs live under `docs/productivity/` as proposed, or under `.planning/`?
3. Should the first future implementation lane be content quality, signal intake, or evaluator harness?
4. What WIP cap should Synthex use for active work packets: 3, 5, or 7?

Recommended default: keep source in place; reference it from Synthex; write Phase 1 under `docs/productivity/`; set active WIP cap to 3 until ShipIt P0/P1 is rechecked; first future implementation lane = evaluator harness + work packets before content or signal automation.
