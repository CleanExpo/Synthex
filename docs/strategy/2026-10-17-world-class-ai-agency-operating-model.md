# From "a little idea" to a world-class AI-operated agency: the operating model

Status: draft for the founder, 2026-10-17. Written by the fleet orchestrator at the founder's request
("start with How, finish with paying, extremely happy returning clients"). This is a plan and a map,
not evidence: nothing here is built until a phase receipt says so. Evidence tags follow
`.claude/rules/fabel-evidence-standard.md`; untagged lines are the author's design judgement.

Reading guide. Section 1 is what already exists and where it contradicts itself. Section 2 distils
Matt Pocock's methodology and maps it onto this fleet. Section 3 is the role graph (Product Manager +
Product Developer on top of the Senior Board). Section 4 is the client loop from How to paying.
Section 5 is the capability frontier with dispositions. Section 6 is what is missing for the latest
models to stretch their wings. Section 7 is the replication kit for the other Unite Group products.
Section 8 lists the few decisions only the founder can make.

## 1. What exists, and where it contradicts itself

Three documents already govern Synthex and its Senior Board:

- `.claude/skills/north-star/SKILL.md` [VERIFIED]: mission (secure, reliable, client-working platform
  whose autonomous agents deliver measurable client outcomes), rules of the ship, the crew routing
  table, the six-step decision protocol.
- `docs/governance/CONSTITUTION.md` [VERIFIED]: immutable project rules.
- `.claude/memory/ceo-foundation.md`, `verification-gates.md`, `skill-orchestration-spec.md`
  [VERIFIED]: the Senior Board's canonical layer. Twelve senior skills plus one mechanical gate
  (`brand-voice-enforce`) operate across nine layers L1–L9; every skill reads the foundation at
  every invocation; `senior-strategist` is the orchestration backbone and final gate;
  `foundation-keeper` is the discipline agent that refuses unsupported gate flips.

Those are strong. The problem is not their quality but their age. The founder's decisions on
2026-10-17 (DECISIONS.md FD-1 to FD-4 and A-13) contradict the written law in five places
[VERIFIED by reading the files above against DECISIONS.md]:

| Written rule                                                                                                                                                            | Founder's current decision                                                                                                | Resolution proposed                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constitution: "Synthex is an internal application … billing out of scope … Stripe intentionally inactive"; roadmap: "Stripe / billing out of scope permanently for now" | "DONE = Ready for payments" (FD-4), paying clients, top-10 AU marketing business                                          | Constitution v2 §Identity: Synthex serves Unite Group operators **and** paying clients; billing is in scope from P10 in test mode; live keys founder-gated                                                                                                                                            |
| Constitution: "Never `git push` without explicit human confirmation"; North Star rule 2 "human gate at the waterline"; spec D2 human merge                              | "No human to push" (FD-3): fleet merges its own PRs behind hard gates                                                     | Constitution v2 §Hard limits: pushes and merges by the fleet are allowed only through `scripts/fleet/merge-phase.mjs` with exact-head checks, independent non-Claude review bound to the head, and a verified receipt; production deploy reviewer, DDL, secrets and live activation stay founder acts |
| Constitution: "2-round auto-fix cap … then escalate to human"                                                                                                           | No human in the loop                                                                                                      | Keep the cap; the escalation target becomes BACKLOG.md between the fleet markers plus a hold row in the ledger (spec stop rules), never a person                                                                                                                                                      |
| Constitution: "Prisma 6", "91 Prisma models"; control-plane rule says 201 models, Prisma 7 in package.json                                                              | —                                                                                                                         | Constitution v2 drops counts and versions (they rot); points at `package.json` and `prisma/schema.prisma`                                                                                                                                                                                             |
| Constitution: "All work traces to a Linear issue (UNI-XXXX)"                                                                                                            | Fleet units are JSON plans mirrored into `release-receipts/manifests/<phase>-units.json`; no Linear writes from the fleet | Constitution v2: a unit id in a committed manifest is an accepted trace; Linear stays the human-facing mirror                                                                                                                                                                                         |

A Constitution amendment is founder-gated under the global release law. The fleet therefore does not
edit `CONSTITUTION.md`. The proposed v2 text lives beside this document as
`docs/strategy/CONSTITUTION-v2-proposal.md` once drafted; the founder ratifies it with one word in
chat and the fleet commits it with `Fleet-Role: orchestrator` and `Protected-Change:` trailers.
Until then the fleet operates under the founder's chat ratifications as recorded in DECISIONS.md.

## 2. Matt Pocock's methodology, distilled, and where it lands here

Source: `mattpocock/skills` cloned 2026-10-17 [VERIFIED /tmp/mp-skills], plus the local copies the
estate already carries (`grill-me`, `grilling`, `grill-with-docs`, `domain-modeling`, `implement`,
`prototype`, `research`, `wayfinder`, `setup-matt-pocock-skills`) [VERIFIED ~/.claude/skills].

### 2.1 The shape of the method

1. **One main flow: idea → ship.** `grill-with-docs` sharpens the idea (stateful: GLOSSARY.md and
   ADRs accrue) → `to-spec` (synthesis, not interview) → `to-tickets` (tracer-bullet vertical slices
   with blocking edges) → `implement` per ticket or `implement-spec` for the whole graph (frontier of
   ready tickets, implementer subagents in worktrees, merger subagent, one integration branch) →
   `tdd` inside each ticket (red before green, tests only at pre-agreed seams) → `code-review`
   (two axes, Standards and Spec, as parallel sub-agents) → `pr` (smallest visual, before/after
   evidence, one-way or two-way door) → `retro` (improve the agent's environment, not the code).
2. **Two vocabulary layers run underneath everything:** `domain-modeling` (the words: glossary,
   overloaded terms, ADRs) and `codebase-design` (deep modules: small interface, lots of
   implementation, seams, adapters, "one adapter is a hypothetical seam, two is a real one").
3. **Phase boundaries are the only place to decide context moves.** Continue, `/clear`, `/handoff`,
   subagent, `/compact`, asked in that order; every move but Continue turns a primary source into a
   secondary one. Keep grill → spec → tickets in one window; start each implement fresh.
4. **Chief of staff thinks on two tracks:** tactical (finish this task) and strategic (change the
   environment so the next task goes better). Agents thrive in the "pit of success": constrained
   APIs, lint rules that force correctness, coding standards a reviewer enforces, relevant data
   sources (logs, test databases, browser), and a "no workarounds" rule.
5. **Writing for agents:** every pointer is a context pointer (what the material is, which branches
   trigger it); two loads (context load on the model, cognitive load on the human); steps end on a
   completion criterion with clarity and demand; progressive disclosure; sprawl is the failure mode.
6. **Agent briefs are durable and behavioural:** interfaces and acceptance criteria, never file
   paths or line numbers; explicit out-of-scope.
7. **Retro is about the environment:** navigation pointers, automated checks, coding standards for
   the reviewer, no-ops in steering files, tool economy, information access.

### 2.2 Where each lands in this fleet

| Pocock element                                        | Lands as                                                                                                                                                                                  | Status                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| grill-with-docs, domain-modeling                      | `GLOSSARY.md` + `docs/adr/` for Synthex, started by the P0 orchestrator commit; every unit prompt points at them                                                                          | STUDY → build in P0/P1 (no dependency) |
| to-spec / to-tickets / agent brief                    | Unit plans are agent briefs: behavioural task, interfaces, proving command, out-of-scope; `fanout.mjs` already requires a proving command; add "Key interfaces" and "Out of scope" fields | STUDY → unit schema v2 in P1           |
| implement-spec (frontier, integration branch, merger) | `run-phase.mjs` spawn → integrate → gate is the same shape; add blocking edges to units so the frontier is explicit                                                                       | STUDY → P1                             |
| tdd, code-review two axes                             | Builder prompt method lines (done, P0 commit); `adversarial-review` estate skill for the Claude-side standards axis; the independent non-Claude lane stays the release-law review         | ESTATE + done                          |
| pr skill                                              | PR body template in `run-phase.mjs release`: smallest visual, before/after evidence, door type                                                                                            | STUDY → P0                             |
| retro                                                 | Nightly automation gains a retro step writing `docs/fleet/retros/<date>.md` with environment improvements as proposals                                                                    | STUDY → P1                             |
| phase boundaries / handoff                            | `release-receipts/manifests/<phase>-handoff.md` (done, P0); phase-advance threads read it first                                                                                           | done                                   |
| chief-of-staff two tracks                             | Orchestrator rules in `scripts/fleet/automations/phase-advance.md`; a "strategic track" line: every phase ends with one environment improvement proposal                                  | STUDY → P0                             |
| wizard                                                | NO-GO: the founder chose zero human acts                                                                                                                                                  | —                                      |
| sandcastle, evalite                                   | CEO-GATED under D4; estate already carries `sandcastle-runner` for Pi-Dev-Ops                                                                                                             | —                                      |

## 3. The role graph: Product Manager + Product Developer on top of the Senior Board

The Senior Board (S1–S12 + G1) decides **what a client should get**. The fleet (orchestrator,
builders, verifier, reviewer, releaser, scheduler) decides **how the product changes**. Today the two
graphs are not connected by a contract: the Senior Board writes briefs for humans, the fleet builds
from spec phases. The missing layer is a Product Manager agent and a Product Developer agent that
turn Senior Board outcomes into tickets and ship them.

### 3.1 Roles, purpose, goal, north star, stop

| Role                                                             | Purpose                                                                                                | Goal (measurable)                                                               | North star                                          | Stop condition                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Chief of Staff (orchestrator thread or phase-advance automation) | Pursue the programme goal across sessions; protect its own context; improve the environment each phase | Every phase ends with a merged receipt and one environment improvement proposal | Spec finish line + "ready for payments"             | Phase receipt on main, handoff written        |
| Product Manager (new, durable T1 specialist)                     | Turn Senior Board recommendations and outcome-ledger signal into agent briefs with acceptance criteria | Each brief has a meter (O1–O7) it moves and a proving command                   | Paying clients' outcomes                            | Brief accepted by orchestrator (schema-valid) |
| Product Developer (builder, T2 throwaway per unit)               | Implement one brief test-first in its own sandbox                                                      | Proving command exits 0; type-check, lint, related tests green                  | Honest status, org-scoped queries, grounded visuals | UNIT-DONE line with sha                       |
| Verifier (fresh context)                                         | Re-run the gate on the integrated tree                                                                 | 4-state receipt, no fifth state                                                 | No fake green                                       | Gate manifest bound to HEAD                   |
| Independent reviewer (non-Claude lane)                           | Review diff bound to head: correctness, security, honest status, spec fidelity                         | Schema-2 report, verdict                                                        | Release law                                         | Report file on disk                           |
| Releaser                                                         | Receipt, push, PR, gated merge                                                                         | merge-phase gates all PASS                                                      | FD-3                                                | Merge row in ledger                           |
| Scheduler (Cloudroom automations)                                | Start nightly, weekly, phase-advance                                                                   | Start row every UTC day                                                         | 14-day soak                                         | —                                             |
| Senior Board S1–S12 (marketing)                                  | Decide what the client gets, per ceo-foundation                                                        | Proven/experimental tagging, 80/20, voice tags                                  | Client outcomes O1–O7                               | senior-strategist final gate                  |
| brand-voice-enforce G1                                           | Mechanical gate on every draft                                                                         | Zero off-voice copy ships                                                       | Per-business voice tag                              | Pass/fail per draft                           |

### 3.2 How they play together (hand-off rules)

1. Senior Board → Product Manager: a recommendation becomes a candidate brief only when it names the
   meter it moves (O1–O7) and whether it is proven or experimental (ceo-foundation 1.2).
2. Product Manager → Chief of Staff: briefs are JSON units with blocking edges; the orchestrator owns
   the frontier and never widens scope to compensate for a failed unit (spec stop rules).
3. Chief of Staff → Product Developer: sparse communication by context pointers (spec section,
   glossary, ADR, prior commit). Never the conversation history (Constitution token-budget rule).
4. Product Developer → Verifier: a builder's "PASS" is UNCONFIRMED until the verifier re-runs the
   gate (fabel-evidence-standard). No exceptions.
5. Verifier → Reviewer → Releaser: head-bound artefacts only; a changed head invalidates everything.
6. Durable vs throwaway: Product Manager and Senior Board specialists are durable T1 agents (one warm
   specialist per domain, resumed by pointer, per `persistent-subagents`); builders, graders and
   sweeps are T2 throwaways. Scheduled work is Cloudroom automations, never a `/loop`.
7. Any role may propose an environment improvement; only the orchestrator commits one, with a
   `Protected-Change:` trailer when it touches the containment layer (A-12).

## 4. The client loop: from How to paying, happy, returning clients

Each stage names the owning skill, the meter it must read before its actuator is allowed (spec rule:
no actuator without a meter), and what world-class looks like.

| Stage         | What happens                                                                                                                                         | Owner                                                                      | Meter before actuator                                         | World-class bar                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Discover   | A tradie or SMB owner lands from a referral, a GEO citation or a demo. Honest demo (`/api/demo/analyze`) shows their business as an AI sees it today | local-seo-geo-veteran, customer-insights-lead                              | O6 AI-answer visibility (DISABLED until a provider is chosen) | The demo output is something they screenshot and send to a mate |
| 2. Brandprint | Business DNA, voice tag, owned reference library ingest (real photos only), offer and proof assets                                                   | brand-strategist, business-dna, grounded-visuals                           | Reference library coverage per subject                        | A brand kit that looks like them, not like AI                   |
| 3. Offer      | Transparent AUD pricing, short terms, a quote before any spend (P5)                                                                                  | cro-specialist, senior-strategist                                          | J9 quote-before-spend green                                   | Price on the page; no "contact sales"                           |
| 4. Produce    | Content, images, video, voice, music: grounded, policy-checked, receipted                                                                            | senior-copywriter, creative-director, client-content-studio, motion-studio | J5/J10 script gates; judged floors (P8)                       | Owner can't tell it wasn't a studio                             |
| 5. Publish    | Held by default; owner records a policy; delegated publish with receipts and kill switch (P7)                                                        | marketing-operations-director, platform-content-adaptor                    | J8 publish safety green; check-held                           | Zero silent failures: every post has a true delivery status     |
| 6. Measure    | Calls, directions, bookings, rank, reviews, AI visibility, cost per verified lead (O1–O7)                                                            | performance-attribution-lead, analytics-lead                               | Outcome events with attribution (P6)                          | Weekly roll-up the owner reads in 60 seconds                    |
| 7. Prove      | Hash-bound run receipts the client can audit; "no fake as real" as the pitch                                                                         | foundation-keeper, verify-receipt                                          | Receipts per job                                              | Competitors report activity; we report outcomes with receipts   |
| 8. Bill       | Subscription in Stripe test mode (P10); usage receipts match the cost ledger                                                                         | billing routes, client-manager                                             | J13 billing cases green                                       | Invoice that explains itself                                    |
| 9. Delight    | Retention cohorts, intervention design, expansion; referral loop; community and merch only after NPS evidence                                        | client-retention, pr-communications-lead                                   | Cohort churn signal                                           | Clients shout from rooftops because the numbers moved           |
| 10. Replicate | The same loop installed in RestoreAssist, DR, NRPG, CARSI, Nexus, ATO                                                                                | this document, section 7                                                   | Fleet receipts per repo                                       | One week to install, not one quarter                            |

The order matters: stages 6 and 7 must be green for a synthetic organisation (spec J7, J3) before
stage 5 is ever activated for a live one. That is the spec's "meter before actuator" rule applied to
the whole business.

## 5. Capability frontier scan (external), with dispositions

Dispositions follow spec D4: ESTATE (already here), STUDY (pattern, build in-repo), CEO-GATED (new
dependency, SaaS or spend; founder decision). Licences are leads until the model card is reopened
[UNCONFIRMED where stated].

### 5.1 Generative media (what a client sees and hears)

| Capability         | Candidates (2026)                                                                                                                                  | Licence lead | Disposition                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image              | FLUX.2 klein-4B and Z-Image reported Apache 2.0; FLUX.2 dev and newer Qwen-Image reported restricted [UNCONFIRMED, secondary sources]              | mixed        | STUDY: the grounded pipeline (`generateImage`) already abstracts providers; a self-hosted Apache model behind the same seam is a P8+ experiment on the Mac Mini SSD, CEO-gated for spend |
| Video              | Wan 2.2 reported Apache 2.0; LTX-2.x native audio+video in one pass; HunyuanVideo 1.5 single-GPU [UNCONFIRMED]                                     | mixed        | STUDY: Remotion (ESTATE skills) stays the composition layer; generative clips route through `video/generation-service.ts`                                                                |
| Music              | ACE-Step 1.5 reported MIT, commercial outputs allowed, sub-2s per song on A100 [UNCONFIRMED]                                                       | MIT lead     | STUDY: music beds for client videos are the fastest "wow"; a `music-generation` seam with a stub adapter first, model later (CEO-gated GPU spend)                                        |
| Voice              | Kokoro (Apache 2.0, CPU), Chatterbox (MIT, 5-second clone, watermark), CosyVoice2, Orpheus, Dia (Apache 2.0); Fish Speech restricted [UNCONFIRMED] | permissive   | ESTATE first: ElevenLabs is wired (`feat(brand-config)` commits); an open fallback adapter is STUDY for cost and consent control (K11 consent artefact applies to any cloned voice)      |
| 3D worlds / scenes | Marble 1.1 (closed, API), Genie 3 (closed preview), HYWorld 2.0 open weights (image → Gaussian splats) [UNCONFIRMED]                               | mixed        | STUDY only after image and video are world-class; a splat walkthrough of a client's premises is a 2027 differentiator, not a 2026 one                                                    |

### 5.2 Harness and agent runtime (what the fleet runs on)

| Capability                                  | What it is                                                                                                                                                                                                                                                             | Disposition                                                                                                                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code dynamic workflows (`ultracode`) | A script orchestrates up to 16 concurrent agents (configurable to 256), 1,000 per run, resumable, with `agent()` schemas, `pipeline()`, `parallel()`; counts against the subscription [VERIFIED https://code.claude.com/docs/en/workflows.md, direct fetch 2026-10-17] | ESTATE: available on the Max plan. Use for per-phase fan-out inside a Cloudroom thread where many small agents beat few big ones (J1 route probes, P2 batch refactors). Workflows don't run from `-p` prompts, so they are an interactive-thread tool, not a scheduler |
| Routines                                    | Cloud-run prompts on a schedule, API fire or GitHub event; no permission prompts; connectors write without asking; hourly caps; Pro/Max [VERIFIED https://code.claude.com/docs/en/routines.md, direct fetch 2026-10-17]                                                | ESTATE but NG3: read-only canaries only (spec); Cloudroom automations remain the scheduler                                                                                                                                                                             |
| Managed Agents                              | Hosted sessions, sandbox, $0.08 per session-hour reported [UNCONFIRMED, secondary]                                                                                                                                                                                     | NO-GO for the development fleet (spec NG2)                                                                                                                                                                                                                             |
| MCP Apps                                    | Tools return interactive UI inside Claude, ChatGPT, VS Code, Copilot; announced January 2026 as the first official MCP extension [UNCONFIRMED, conference and vendor sources]                                                                                          | STUDY, high value: Synthex's 27 read/draft MCP tools become an **agent-native product surface**: a client asks Claude "how did my calls go this week" and gets Synthex's outcome card. Build after P5 output schemas exist                                             |
| Agentic commerce (Apps SDK + ACP)           | Checkout inside assistants                                                                                                                                                                                                                                             | CEO-GATED (new SaaS surface); watch                                                                                                                                                                                                                                    |

### 5.3 Design, interaction and taste

| Capability                                                          | Disposition                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Penpot (open-source design, AI co-pilot), Google Stitch, Figma Make | STUDY the pattern: a brand kit that is a design-system file (tokens, components) the fleet can read; Synthex already carries `design-system`, `brandprint`, `ui-ux-pro-max` skills (ESTATE) |
| Rive / Lottie interactive motion                                    | STUDY for the dashboard's "wow" moments; Remotion covers video                                                                                                                              |
| Founder rank-and-reject loop (`image_generations` insights)         | ESTATE, and the single most important taste mechanism: extend it to copy, video and music so every rejection is a training signal (section 6)                                               |

### 5.4 Market signal (why the timing is right)

Answer engines take share from Google; GEO rewards entity signals and machine-readable facts;
buyers delegate research to assistants; Australia is among the fastest AI adopters (agency blogs,
[UNCONFIRMED]). The spec's F1 finding stands: ten of fourteen competitors publish an MCP server; the
gap is receipts, outcomes and honesty, not features.

## 6. What is missing for the latest models to stretch their wings

1. **An exploration lane with a kill rule.** ceo-foundation 1.2 already allocates 20 percent to
   experiments with explicit kill thresholds. Nothing in the fleet implements it. Add an
   `exploration` unit kind: a builder may propose one experiment per phase (new seam, new model
   adapter behind an existing seam, new interaction), with a success criterion, a kill threshold and
   a ceiling; it ships as a proposal under `proposals/<phase>/exploration/` and never touches
   defaults. The weekly run reports what lived and what died.
2. **A taste loop for every medium.** The founder's rank/reject is the training signal for images
   today. Extend the same table shape (lineage, verdict, reason) to copy, video, voice and music, and
   let the judged JEV families (J5, J10) read it as calibration data. World-class is learned from
   rejections, not asserted.
3. **A creative brief contract.** One Zod schema for "brief → asset → receipt" across media, with
   the business voice tag, the owned references used, the policy version and the run id. It is the
   seam every new model adapter must satisfy, which is what makes exploration safe.
4. **A shared glossary and ADRs.** The communication barrier the founder names is a vocabulary
   problem: "campaign", "post", "approval", "policy", "outcome" each mean three things across the
   repo. `domain-modeling` fixes this cheaply: `GLOSSARY.md` plus one ADR per hard-to-reverse
   decision, pointed at from every unit prompt.
5. **Agent-native surface.** Make Synthex usable from inside the client's assistant (MCP Apps) so
   the product meets the client where they already are. Output schemas (P5) are the prerequisite.
6. **Outcome ledger as the only scoreboard.** O1–O7 per client per week, with receipts, is the
   number the whole company looks at. Vanity metrics are banned by the Constitution already; this
   makes the replacement concrete.
7. **Retro as a scheduled act.** The nightly run proposes one environment improvement (Pocock
   retro categories); the orchestrator lands at most one per phase. The environment, not the prompt,
   is where quality compounds.
8. **Senior Board ↔ fleet contract.** A Senior Board recommendation is not actionable until it is
   an agent brief with a meter. This is the Product Manager role in section 3.

## 7. Replication kit (RestoreAssist, Disaster Recovery, NRPG, CARSI, Unite-Group Nexus, ATO)

What is portable without change: `scripts/fleet/**` (policy-driven), `scripts/release/**`,
`scripts/gate`, `scripts/truth`, `scripts/jev/check-ratchet.mjs`, the five CI jobs, the phase
contract generator, the automation prompts, the four-state rule, the handoff format, the JEV harness
pattern (families with planted controls), the ceo-foundation / verification-gates / orchestration
layer, `GLOSSARY.md` + ADR convention, and this document's role graph.

Per-repo steps (one fleet phase each, no human act):

1. Copy `scripts/fleet`, `scripts/release`, `scripts/gate`, `scripts/truth`, `scripts/jev`,
   `.github/workflows/{protected-paths,jev-ratchet,openapi-drift,receipt-verify,jev-pr}.yml`;
   write `policy.json` for the repo (protected paths, phases, ceilings, mac paths); record the hash.
2. Run `check-bootstrap.mjs` and `selftest.mjs`; create the three Cloudroom automations.
3. Derive the repo's own phase table from its spec (the vibe-to-leader shape: containment → measure
   → truth → contract → principal → receipts → outcomes → delegated act → quality → drills → bill).
4. Install the Senior Board foundation files for that business (voice tag, risk posture, decision
   style) and the glossary.
5. Start phase-advance.

UG-AUTONOMY-001 already covers Unite-Group, CARSI and RestoreAssist for automatic merge under its own
stricter conditions; DR, NRPG, Nexus and ATO need the same founder ratification Synthex received
(FD-3) before their fleets may merge.

## 8. Decisions only the founder can make (one word each)

1. **Constitution v2** as proposed in section 1: "ratify" or edits.
2. **Exploration lane spend ceiling** (section 6.1), in AUD per month, for GPU time on the Mac Mini
   or a cloud box: default proposed AU$0 until P8 is green (everything runs on stubs and the Max plan).
3. **Agent-native surface** (MCP Apps) in or out of this programme: default proposed "in, after P5".
4. **Music** as the first open-model experiment: default proposed "yes, stub adapter in P8, model
   behind a CEO-gated spend line".

Everything else in this document proceeds under the spec's defaults and DECISIONS.md.

## Sources

- Matt Pocock, `mattpocock/skills` (cloned 2026-10-17); `ask-matt`, `PHASE-BOUNDARIES.md`,
  `chief-of-staff`, `writing-for-agents`, `codebase-design`, `to-tickets`, `implement-spec`, `retro`,
  `triage/AGENT-BRIEF.md`.
- Claude Code docs: https://code.claude.com/docs/en/workflows.md and
  https://code.claude.com/docs/en/routines.md (direct fetch 2026-10-17).
- Claude Managed Agents: https://claude.com/blog/claude-managed-agents,
  https://platform.claude.com/docs/en/managed-agents/ (not fetched; secondary summaries only).
- Media model leads (secondary, licences unverified): ACE-Step 1.5
  (https://arxiv.org/abs/2602.00744v2), video roundups (https://ltx.io/blog/best-open-source-video-generation-models,
  https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models), image licence matrix
  (https://invideo.io/blog/open-source-image-models-licenses/), TTS guide
  (https://tts.ai/blog/open-source-text-to-speech-guide-2026/), world models
  (https://rits.shanghai.nyu.edu/ai/world-labs-releases-marble-1-1-auto-expanding-3d-world-generation,
  https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/).
- MCP Apps: https://workos.com/blog/2026-01-27-mcp-apps,
  https://www.ai.engineer/talks/o-zkvb0iFDQ-mcp-ui-extending-frontier.
- Market: https://www.shoutdigital.com.au/blog/geo-vs-aeo-vs-seo-australian-businesses/,
  https://marketing.org.nz/resource-hub/ai-search-marketing/future-of-ai-2026.
