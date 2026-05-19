# Synthex Pipedream Sandbox-To-Live Plan

Date: 2026-05-19
Status: Planning-mode execution packet
Scope: Synthex / Unite-Group Command Centre, Margot, Hermes, Brain-1/Wiki, Gen Media, Board input, and human-in-the-loop production.

## Technical Translation Blueprint

**User Intent:** Build the full Synthex operating dream in a controlled sequence: capture high-quality founder/Board/client inputs, ground them in Brain-1/Wiki and live Synthex data, route them through senior agents, generate plans/presentations/media/build packets, verify everything in sandbox, then move through preview and production gates without bloat or unsafe automation.

**Target Architecture:** Extend the existing Synthex surfaces: `app/api/command-centre/*`, `components/command-centre/*`, `app/unite-group`, `lib/ai/boardroom.ts`, `lib/hermes/*`, `lib/alerts/notification-channels.ts`, `lib/workflow/*`, Vision Board, Remotion, and new service modules under `lib/unite-command-center/*`.

**Token Optimisation Strategy:** Do not create a second CRM or parallel dashboard. Add a thin control plane and service contracts first, then one UI panel and one draft-only intake route. Reuse existing Command Centre APIs, Hermes cron/gateway, Brain-1 wiki, Supabase/Prisma, approval workflows, and provider gates.

**Autonomous Tool Selection:** Service Layer Pattern + Nexus Ontology + Hermes Continuous Ops + Margot Conversation Pass + Command Centre Draft Queue + Presentation QA Gate + Sandbox/Preview/Production Lifecycle.

## Current Ground Truth

### Available Now

- Brain-1 wiki exists and contains Synthex, Unite-CRM, Margot Conversation OS, AIP architecture, and autonomous Command Center authority.
- Synthex has `CLAUDE.md`, `CONSTITUTION.md`, route reference, service-layer rules, Supabase-only auth, and strict verification gates.
- Synthex Command Centre already has authenticated, organisation-scoped APIs:
  - `GET /api/command-centre/status`
  - `GET /api/command-centre/activity`
  - `GET /api/command-centre/pending`
  - `GET /api/command-centre/performance`
  - `GET /api/command-centre/stats`
  - `POST /api/command-centre/autopilot`
- Command Centre UI exists at `components/command-centre/AICommandCentre.tsx`.
- Hermes Agent is installed at `/Users/phill-mac/.hermes/hermes-agent`.
- Hermes is running through launchd with gateway PID present.
- Hermes Telegram is configured.
- Hermes has a Unite-Group plugin with portfolio health, CCW KPIs, wave status, and 6-pager summary tools.
- Synthex has Remotion, boardroom, Vision Board, alerts, Telegram notification, workflow engine, Prisma, Supabase, Vercel, Playwright, Jest, and type-check scripts.

### Not Green Yet

- `LINEAR_API_KEY` is not available in this Codex environment, so live Linear creation is blocked here. Replayable Linear packets are required until the key is available to the active tool process.
- WhatsApp is not configured in the detected Hermes status. Treat WhatsApp as a design target until configured and known-contact policy is verified.
- Pipedream credentials were not visible in this Codex environment. Pipedream remains an optional adapter, not a core dependency.
- Hermes is installed but reports it is 263 commits behind. Do not update Hermes inside this build without a separate update/backup gate.
- Synthex branch context must be checked before each implementation run; never assume `main` is current.

## Current External Docs Grounding

### Pipedream

Pipedream can be useful as an integration layer, especially for MCP-backed app connections and workflow triggers/actions. Current docs show:

- Pipedream Connect provides managed auth and lets developers make API requests on behalf of users.
- Pipedream MCP can expose many app tools to AI agents while the product keeps control of authorization and request validation.
- Pipedream components are split into sources and actions; sources can run independently and emit events, actions run inside workflows.

Use Pipedream only as an adapter if it reduces integration cost. Synthex still owns policy, approval, evidence, and user-facing state.

### Hermes

Hermes Agent is the local continuous-ops assistant layer. Current local install confirms:

- Hermes version: v0.14.0.
- Gateway service: running via launchd.
- Telegram: configured.
- WhatsApp: not configured.
- Scheduled jobs: active.
- Unite-Group plugin: installed.

Hermes should assist with continuous observation, reminders, morning briefs, portfolio checks, and Telegram input routing. Synthex remains the system of record for app workflows and client-facing state.

## Target Experience

```text
Telegram / Plaud / Meeting Notes / Manual Command Centre Input
  -> Margot cleans and classifies the input
  -> Brain-1/Wiki and Synthex data ground the context
  -> Nexus ontology links business, client, product, signal, risk, action
  -> @team routes to CEO Board, Senior Engineering, Marketing, Media, QA
  -> draft plan / live-event presentation / Gen Media brief / build packet
  -> Presentation QA and compliance gates
  -> human approval
  -> sandbox execution
  -> preview verification
  -> production release gate
  -> outcome learning
```

## Service-Layer Build

```text
lib/unite-command-center/
  intake/
    board-input.schema.ts
    board-input.service.ts
    margot-conversation-pass.service.ts
    plaud-transcript.service.ts
    telegram-intake.adapter.ts
    pipedream-intake.adapter.ts
  ontology/
    command-ontology.schema.ts
    command-ontology.service.ts
    evidence-linker.service.ts
  routing/
    team-dispatch.service.ts
    board-routing.service.ts
    margot-queue.service.ts
  generation/
    scenario-draft.service.ts
    presentation-packet.service.ts
    gen-media-brief.service.ts
  gates/
    approval-policy.service.ts
    publish-spend-policy.service.ts
    provider-readiness.service.ts
  qa/
    presentation-qa.service.ts
    sandbox-readiness.service.ts
  outcomes/
    outcome-learning.service.ts
```

Routes stay thin. Services own policy. Adapters own provider mechanics.

## Data Contracts

```ts
type BoardInputSource =
  | "telegram"
  | "plaud"
  | "meeting_notes"
  | "manual"
  | "obsidian"
  | "pipedream";

type BoardInput = {
  id: string;
  organizationId: string;
  source: BoardInputSource;
  speaker: string;
  rawText: string;
  cleanedText: string;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  capturedAt: string;
  evidenceRefs: string[];
};

type CommandPacket = {
  id: string;
  boardInputId: string;
  title: string;
  ontologyRefs: string[];
  teamRoute: string[];
  scenarioState: "draft" | "needs_evidence" | "ready_for_review" | "approved" | "blocked";
  approvalGate: "human_review" | "client_review" | "production_blocked";
  risks: string[];
  nextAction: string;
  outcomeMetric: string;
};
```

## Phased Plan

### Phase 0 — Sandbox Baseline

Goal: prove the existing repo and runtime state before new implementation.

Checks:

```bash
git status --short --branch
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package ok')"
npm run type-check
npm run lint
npx prisma validate
```

Green means: baseline is understood, not necessarily production-ready.

### Phase 1 — Control Plane Contracts

Build:

- schemas for `BoardInput`, `CommandPacket`, approval state, provider readiness
- pure services for Margot classification, ontology linking, team routing, presentation QA
- unit tests for each service

No database migration in the first pass. Use in-memory fixtures and existing models until the service contract is stable.

Green:

```bash
npm run type-check
npx jest tests/unit/unite-command-center --runInBand
```

### Phase 2 — Draft-Only Intake Route

Build:

- `POST /api/command-centre/intake`
- Zod validation
- Supabase-authenticated, org-scoped request handling
- draft-only response packet
- no external execution

Green:

```bash
npm run type-check
npx jest tests/unit/unite-command-center tests/unit/api/command-centre-intake.test.ts --runInBand
curl -i http://localhost:3008/api/command-centre/intake
```

Expected unauthenticated curl result: 401/403, proving the route is protected.

### Phase 3 — Command Centre Panel

Build:

- Board input queue
- Margot queue
- `@team` dispatch cards
- gate badges: evidence, risk, approval, provider readiness, presentation QA
- no public action buttons until policy gates exist

Green:

```bash
npm run type-check
npm run lint
npx playwright test tests/e2e/command-centre.spec.ts
```

Browser QA must check desktop and mobile reflow, no text overlap, no clipped cards, and functional tabs/buttons.

### Phase 4 — Hermes Continuous Ops

Build:

- local Hermes handoff packet generator
- morning brief source map
- Telegram-to-draft intake bridge plan
- cron/watchdog status surface in Command Centre

Do not connect Hermes to production-writing actions yet.

Green:

```bash
hermes status
hermes gateway status
hermes cron list
```

Green means Hermes is available and observed; it does not mean Synthex has delegated unsafe execution to Hermes.

### Phase 5 — Provider Adapters

Order:

1. Plaud transcript import adapter.
2. Telegram draft intake adapter.
3. Pipedream optional adapter for integration shortcuts.
4. WhatsApp only after known-contact and privacy policy are verified.

Green:

- credentials present without printing values
- provider docs checked
- mock/draft mode passes
- no secrets in logs, docs, screenshots, or commits

### Phase 6 — Presentations and Gen Media

Build:

- live-event presentation packet generator
- Gen Media brief generator
- Remotion/HyperFrames storyboard lane
- HeyGen/Artlist adapter gates where relevant
- presentation QA service before export

Green:

- generated presentation has evidence refs
- no text overflow
- mobile/desktop visual check passes
- all media has licence/consent state
- output remains draft until human approval

### Phase 7 — Preview Release

Build:

- Vercel preview only
- no production deployment
- route smoke tests
- Sentry/log review
- real browser verification

Green:

```bash
npm run type-check
npm run lint
npm test
npm run build
npx playwright test
```

Preview must show no broken core Command Centre path.

### Phase 8 — Production Gate

Production remains blocked until:

- all tests pass
- preview is verified
- security/permissions review passes
- human approval gate is explicit
- no publish/spend defaults are enabled
- rollback path exists
- Linear/GitHub issue state is current

## Hermes Use

Use Hermes for:

- continuous observations
- morning action briefs
- Telegram intake support
- portfolio health summaries
- checkpointing long-running work
- nudging stale tasks

Do not use Hermes for:

- unaudited code commits
- production deployments
- public publishing
- ad spend
- private data broadcast over Telegram
- WhatsApp until configured and policy-gated

## Pipedream Use

Pipedream is optional and adapter-gated.

Use it only when:

- the target integration is expensive to build directly
- managed OAuth saves real implementation time
- Synthex still validates every incoming event
- Synthex stores only normalized event records
- approval policy remains in Synthex, not Pipedream

Do not make Pipedream the command center brain.

## Linear Packet

Replayable packet:

```text
.planning/linear-packets/synthex-pipedream-command-center-2026-05-19.json
```

Live Linear creation is blocked in this Codex context until `LINEAR_API_KEY` is available.

## Definition Of 100% Green

100% green means all of this is true:

- repo baseline checks pass
- unit tests for new services pass
- API route auth failure and success cases pass
- browser QA passes on desktop and mobile
- presentation QA passes
- no secret leakage
- provider modes are explicit: live, mock, draft, or blocked
- Hermes status is known
- Linear/GitHub tracking exists or replay packet exists
- Vercel preview is verified
- production remains blocked until human review

It does not mean automatic production launch.

## Source Links

- Pipedream Connect overview: https://pipedream.com/docs/connect/
- Pipedream Components: https://pipedream.com/docs/components
- Pipedream MCP developers: https://pipedream.com/docs/connect/mcp/developers/
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs/
- Hermes Agent overview: https://hermesagent101.dev/about
