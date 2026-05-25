# Marketing Agency — Agent Loop (MVP)

> **Status:** Phase B feature inside Synthex (the customer-facing flagship). Adds an **agentic loop** on top of the existing Marketing Agency governance substrate. Per the user's framing, Synthex is positioned as the **Primary Marketing Agency** product — this is the feature that makes the "Agency" autonomous between gates.

## Ship status (2026-05-25)

- ✅ **In-Synthex feature merged** — PR [#295](https://github.com/CleanExpo/Synthex/pull/295), main `e7293a90`. Models, runner, API routes, UI, tier gate, sidebar entry, unit test.
- ✅ **External MCP transport merged** — [CleanExpo/synthex-mcp-app](https://github.com/CleanExpo/synthex-mcp-app) PR [#1](https://github.com/CleanExpo/synthex-mcp-app/pull/1), main `c95fed9`. Voice-friendly remote control exposing the four Agency endpoints to Claude / ChatGPT.
- ⏳ **Prisma migration** — `prisma/migrations/20260525_add_marketing_agent/migration.sql` is checked in but not yet applied to prod. Apply via:
  ```bash
  cd /Users/phillmcgurk/Synthex
  supabase db query --linked -f prisma/migrations/20260525_add_marketing_agent/migration.sql
  ```
  Idempotent (`CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS`) — safe to re-run.
- ⏳ **Phase C (Clerk OAuth + customer-facing MCP)** — separate workstream; not in this MVP's scope.

## 1. Value Proposition

The Marketing Agency substrate (9 `MarketingAgency*` Prisma models, 8 React panels, 15+ lib modules under `lib/marketing-agency/`) already exists, with a deliberately governance-first design: signals → opportunities → claims with sources → assets with licences → QA reports → export packages → outcome events. Every gate defaults to `blocked`.

Today, the workflow is human-driven between gates: someone runs the Apify intelligence command to populate signals, manually proposes claims, hunts sources, runs QA. The autonomy gap is **the work between gates**.

**This feature** adds a per-Organization **`MarketingAgent`** that, when run, does that legwork autonomously and ends each run with a `MarketingAgencyQaReport` ready for human review. Gates remain blocked-by-default. The agent never publishes, never bypasses a QA gate, never auto-approves anything.

**Target user (MVP):** Synthex customers on growth + scale tiers. Phill dogfoods first.

**Pain solved:** The substrate was unusable to non-technical operators because every step required CLI knowledge + manual gate work. The agent turns the unblocked-opportunities ledger into a usable assembly line.

## 2. Scope (MVP, this PR)

**In scope:**
- New Prisma models: `MarketingAgent`, `MarketingAgentRun`
- Agent runner (`lib/marketing-agency/agent/runner.ts`) — reads top-N unblocked opportunities, LLM-proposes claims, flags evidence/licence gaps, writes a `MarketingAgencyQaReport`, persists a `MarketingAgentRun` summary
- Manual-trigger API: `POST /api/marketing-agency/agents/[id]/run` (synchronous for MVP; queue for cadence in a follow-up)
- CRUD APIs: `GET/POST /api/marketing-agency/agents`, `GET/PATCH/DELETE /api/marketing-agency/agents/[id]`, `GET /api/marketing-agency/agents/[id]/runs`, `GET /api/marketing-agency/runs/[id]`
- UI: per-brand agent panel on existing `/dashboard/marketing-agency` page; "Create Agent", "Run Now", "View Run History"
- Tier gate: `growth` (1 agent, manual trigger) and `scale` (3 agents, manual trigger). Free/starter/pro = 0.
- Unit test for runner happy path with a stubbed LLM
- Type-check + build green
- Sidebar nav update — already has "Marketing Agency" indirectly via routes; add explicit nav item if missing

**Out of scope (deferred):**
- Scheduled / cron-driven runs (use queue + recurring enqueue; B.2)
- Asset auto-licensing via Artlist API (substrate exists, agent doesn't drive it yet)
- Claim auto-evidence via source hunting (LLM proposes claims; source linkage stays manual)
- Outcome-event feedback loop into next plan (B.3)
- MCP transport repurpose (covered by separate task MA-9; needs this PR merged first)
- Multi-step Claude Agent SDK tool registry (not needed at MVP — single LLM call per run is enough)
- New brand-voice config UI (consumes existing `Organization.settings`)

## 3. Data Model

### `MarketingAgent`
```prisma
model MarketingAgent {
  id             String  @id @default(cuid())
  organizationId String  @map("organization_id")
  createdById    String  @map("created_by_id")

  name           String   // e.g., "DR Daily Pulse", "CARSI Research Watch"
  status         String   @default("active")  // active | paused | archived
  goal           String   @db.Text             // free-text goal: "grow LinkedIn presence"
  maxClaimsPerRun Int     @default(5) @map("max_claims_per_run")
  cadence        String   @default("manual")  // manual | daily | weekly (manual only enforced MVP)
  config         Json?                          // future expansion (voice override, channel mix, etc.)

  lastRunAt      DateTime? @map("last_run_at")
  nextRunAt      DateTime? @map("next_run_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  organization Organization        @relation("MarketingAgentOrganization", fields: [organizationId], references: [id], onDelete: Cascade)
  createdBy    User                @relation("MarketingAgentCreator", fields: [createdById], references: [id], onDelete: Cascade)
  runs         MarketingAgentRun[]

  @@index([organizationId, status])
  @@index([createdById])
  @@map("marketing_agents")
}
```

### `MarketingAgentRun`
```prisma
model MarketingAgentRun {
  id             String  @id @default(cuid())
  agentId        String  @map("agent_id")
  organizationId String  @map("organization_id")
  triggeredById  String  @map("triggered_by_id")

  status         String   @default("running")  // running | completed | failed
  startedAt      DateTime @default(now()) @map("started_at")
  completedAt    DateTime? @map("completed_at")

  opportunitiesConsidered Int   @default(0) @map("opportunities_considered")
  claimsProposed          Int   @default(0) @map("claims_proposed")
  evidenceGapsFlagged     Int   @default(0) @map("evidence_gaps_flagged")
  qaReportId              String? @map("qa_report_id")

  summary        String?  @db.Text
  artifacts      Json     @default("{}")  // { claims: [...], gaps: [...], opportunityIds: [...] }
  errorMessage   String?  @db.Text @map("error_message")

  agent          MarketingAgent           @relation(fields: [agentId], references: [id], onDelete: Cascade)
  organization   Organization             @relation("MarketingAgentRunOrganization", fields: [organizationId], references: [id], onDelete: Cascade)
  triggeredBy    User                     @relation("MarketingAgentRunTriggerer", fields: [triggeredById], references: [id], onDelete: Cascade)
  qaReport       MarketingAgencyQaReport? @relation("MarketingAgentRunQaReport", fields: [qaReportId], references: [id], onDelete: SetNull)

  @@index([agentId, startedAt(sort: Desc)])
  @@index([organizationId, status])
  @@index([triggeredById])
  @@map("marketing_agent_runs")
}
```

### Existing-model edits
- `Organization`: add reverse relations `MarketingAgentOrganization` + `MarketingAgentRunOrganization`
- `User`: add reverse relations `MarketingAgentCreator` + `MarketingAgentRunTriggerer`
- `MarketingAgencyQaReport`: add reverse relation `MarketingAgentRunQaReport` (one-to-many; a QA report can be referenced by at most one agent run because each run writes its own QaReport)

## 4. Agent Runner Algorithm

`runAgent(agentId, triggeredById)` — pure async function, no HTTP coupling.

1. Load agent + verify status = `active`.
2. Create `MarketingAgentRun` with status=`running`.
3. Load top N unblocked opportunities via `listMarketingAgencyOpportunities({ organizationId, limit: maxClaimsPerRun * 2 })`. Filter to `status = 'draft'` and `approvalStatus != 'rejected'`.
4. For each opportunity (up to `maxClaimsPerRun`):
   a. LLM call (sonnet via existing OpenRouter wrapper): given opportunity title + recommendation + signal narrative, propose a single Claim statement + its `claimType` + a list of `evidenceNotes` describing what would prove or disprove it.
   b. Persist a `MarketingAgencyClaim` (status=blocked, sourceRefId=null — humans link sources after).
   c. Track each as a "claim proposed".
5. Build a `MarketingAgencyQaReport` for the agent's most-recent campaign (or create a campaign on the fly named `Agent: {agent.name} {YYYY-MM-DD}` if none exists for this brand today):
   - `status = 'blocked'`
   - `blockedReasons` = unique list of evidence gaps + missing licences (none for MVP — just claims need sources)
   - `warnings` = LLM-flagged risks
   - `checks` = array of `{ check, status, detail }` records for each opportunity processed
6. Update `MarketingAgentRun`:
   - `status = 'completed'`
   - `completedAt = now()`
   - `opportunitiesConsidered`, `claimsProposed`, `evidenceGapsFlagged` counts
   - `qaReportId` = the new report's id
   - `summary` = one-line human-readable
   - `artifacts` = JSON snapshot for the UI
7. On any throw: set `status = 'failed'`, `errorMessage = err.message.slice(0,500)`, return.

LLM call is wrapped so the runner can be unit-tested with a stub.

## 5. API Surface

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/marketing-agency/agents` | — | `{ agents: AgentSummary[] }` |
| POST | `/api/marketing-agency/agents` | `{ name, goal, maxClaimsPerRun?, cadence? }` | `{ agent }` (201) |
| GET | `/api/marketing-agency/agents/[id]` | — | `{ agent }` |
| PATCH | `/api/marketing-agency/agents/[id]` | partial agent fields | `{ agent }` |
| DELETE | `/api/marketing-agency/agents/[id]` | — | `204` |
| POST | `/api/marketing-agency/agents/[id]/run` | — | `{ run }` (synchronous; returns when complete or failed) |
| GET | `/api/marketing-agency/agents/[id]/runs` | `?limit=10` | `{ runs: RunSummary[] }` |
| GET | `/api/marketing-agency/runs/[id]` | — | `{ run }` (includes artifacts) |

All routes use `withAuth` from `@/lib/auth/with-auth`, scope everything by `clientId` (= organizationId), reject if no org. Mutations check tier limit before write.

## 6. Tier Gate

Add to `PLAN_LIMITS` in `lib/geo/feature-limits.ts`:

```ts
marketingAgents: number;  // -1 = unlimited
```

| Plan | `marketingAgents` |
|---|---|
| free | 0 |
| starter | 0 |
| pro | 0 |
| growth | 1 |
| scale | 3 |

Enforced in `POST /api/marketing-agency/agents` by counting existing agents for the org and rejecting with 402 + "Upgrade required" if at limit.

## 7. UI

`/dashboard/marketing-agency/page.tsx` — keep the existing `GovernedOpportunitiesPanel` + RestoreAssist mock section. **Add** a new `MarketingAgentsPanel` above the opportunities panel:

- Empty state: "No agents yet. Create your first agent to start automating campaign legwork." + `[Create Agent]` button → opens `<CreateAgentDialog>` (modal form: name, goal textarea, maxClaimsPerRun slider 1-10, cadence select disabled at "manual" with "more cadences coming soon" hint).
- Populated state: list of agents (card per agent), each showing: name, goal, status badge, last-run timestamp + result, `[Run Now]` button, `[View Runs]` link.
- Run history page `/dashboard/marketing-agency/runs/[runId]` — read-only summary: counts, summary text, artifacts table (opportunities considered + claims proposed + evidence gaps), link to QA report.

All components in `components/marketing-agency/agent/`.

## 8. Acceptance Criteria

- [ ] Prisma migration runs cleanly on a fresh DB
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] Jest unit test: `runAgent()` with stubbed LLM completes a run end-to-end (creates run row, claim rows, QA report)
- [ ] Tier-limit returns 402 when at cap
- [ ] Agent run from UI button works against local Synthex (manual smoke step — Phill verifies)
- [ ] Gates remain blocked-by-default — verified by inspecting the QA report's `status` after a run
- [ ] No agent action publishes anything (no writes to `social_posts`, `scheduled_posts`, or anything platform-facing)

## 9. Non-Goals (this PR)

- Customer-facing pricing-page copy (separate marketing PR)
- Backfilling a synthetic opportunity ledger for demo purposes
- Slack/email notifications when a run completes
- Multi-org parent/child agent inheritance
- Voice mode entry point (Phase C, via the MCP transport repurpose)

## 10. Related

- Existing substrate: [`lib/marketing-agency/`](../../../lib/marketing-agency/), [`components/marketing-agency/`](../../../components/marketing-agency/), Prisma models lines 3265–3555 in `schema.prisma`
- Strategic rollout context: [`Pi-CEO/skills/skybridge-rollout/SKILL.md`](../../../../Pi-CEO/skills/skybridge-rollout/SKILL.md)
- Add-on product page already live: [`app/add-ons/mcp-app-development/page.tsx`](../../add-ons/mcp-app-development/page.tsx)
- External MCP transport (to be repurposed in MA-9): [github.com/CleanExpo/synthex-mcp-app](https://github.com/CleanExpo/synthex-mcp-app)
