# CRM mission bridge: design spec

**Status:** proposal (22/10/2026), not approved for build
**Client metric:** both — indirectly: this is the trigger and read-back path for the FD-10 missions (CARSI paid enrolments, RestoreAssist trial sign-ups) that the founder queues in Mission Control; it moves no enrolment or sign-up by itself.
**Rests on:** synthex-intel-07-advantages-and-proposals (proposal 4), synthex-intel-01-synthex-as-built (§3 Integrations), synthex-intel-04-automation-stacks (patterns 1, 2, 3 and 8), and repo evidence in Synthex (`lib/unite-group-connector.ts`, `lib/auth/agent-principal.ts`, `lib/autopilot/hold-for-review.ts`, `lib/queue/`, `DECISIONS.md` A-25) and Unite-Group. Unite-Group was read read-only with `git show origin/main:<path>` at `e4d92d8ff` because the local checkout (`03d534ea4`) is behind `origin/main`; Unite-Group tags below name that commit.
**Relation to the fleet programme:** extends P4 (machine principal) and P5 (receipts, idempotency, run id) as declared by AM-6 in `DECISIONS.md` A-25; reuses the M7 idempotency work; publish stays behind P7 and the founder switch. It is the J3 "one loop, one id" loop. It adds no phase.

## Finish line

The founder queues a mission in Unite-Group Mission Control with `agent_owner = 'synthex'` and a business key (`carsi` or `restore`). Within one poll interval a Synthex cron claims it through a lane-scoped Unite-Group endpoint, the mission timeline shows a `mission.claimed` row carrying the Synthex run id, Synthex produces a draft campaign held by `HOLD_FOR_REVIEW` with a cost quote, and Mission Control shows the mission as `awaiting_approval` with an evidence link back to the Synthex draft. Every Synthex event about that work reaches `/api/webhooks/synthex` carrying the same `missionId`, is recorded exactly once even when retried, and a failed delivery is visible in a Synthex delivery table rather than lost with a lambda. A mission for an unmapped business, or one claimed by the wrong runner, stays queued or is refused with a recorded reason, never run in the wrong organisation. Nothing is published.

## Decision up front

Build, pull-first, on what Unite-Group already has. Unite-Group already runs an atomic claim/lease plane on `cc_tasks` (`claimed_by`, `claimed_at`, conditional update on `status = 'queued'`), so slice 1 adds one lane-scoped claim route on the Unite-Group side and a Synthex poller cron; this gives duplicate protection (compare-and-set claim) and replay (re-poll) without a new table on either side. Slice 2 adds the outbox and signed webhooks the research recommends: Synthex→Unite-Group events move to a Synthex outbox signed to the Standard Webhooks spec with `webhook-id` dedup in the receiver, and an optional Unite-Group outbox sends `mission.queued` nudges so Synthex wakes early, while the pull stays the source of truth. Depend on the MIT `standardwebhooks` package for signing and verification (after supply-chain review); do not adopt a queue platform (Inngest, Trigger.dev, pg-boss, graphile-worker) or BullMQ for this, because Synthex has no persistent worker host today. Two founder decisions gate it: a separate `SYNTHEX_RUNNER_SECRET` instead of AM-6's `AGENT_EVENTS_SECRET`, and Unite-Group's own release gate for the Unite-Group route.

## Goals & non-goals

**Goals**
- G1. CRM→Synthex: a mission for lane `synthex` reaches Synthex reliably, is claimed exactly once, and survives a missed cron tick (re-poll) and a crashed run (lease resume by stable runner id).
- G2. Synthex works the mission only through its existing gates: org-scoped data, `HOLD_FOR_REVIEW` drafts, cost quote, fleet principal identity, never publish.
- G3. Synthex→CRM: every event about mission work carries `missionId`; results read-back is an evidence link plus a terminal mission status set by Synthex (`awaiting_approval`, `failed` or requeue). `done` stays Unite-Group/founder-owned.
- G4. Delivery is observable: a non-2xx is stored and surfaced, not only logged (AM-6: "non-2xx outcomes are surfaced, never dropped").
- G5. Retire the legacy SaaS event framing in the connector.

**Non-goals**
- NG1. No publishing, scheduling or ad spend from a mission. That is P7 and the founder switch.
- NG2. No change to Unite-Group's generic Nexus code-runner semantics beyond excluding Synthex missions from it.
- NG3. No new queue platform, no hosted webhook service, no persistent worker host.
- NG4. No Synthex billing, subscription or customer events. `user.signup`, `user.upgrade`, `user.churn` and `payment.received` are legacy SaaS framing (wrong framing under FD-8) and are removed, not extended.
- NG5. No CRM record writes (contacts, deals) from Synthex in this spec; that is pattern 3's approval queue and a later proposal.

## Approach

### What exists today (the constraint that decides the slices)

- **Synthex→CRM push is dormant and lossy.** `pushUniteGroupEvent` [VERIFIED lib/unite-group-connector.ts:118] POSTs to `/api/webhooks/synthex` [VERIFIED lib/unite-group-connector.ts:25] with an `x-api-key` header and an optional `missionId` [VERIFIED lib/unite-group-connector.ts:128-139]. It records only the most recent outcome "on this server instance" in a module variable [VERIFIED lib/unite-group-connector.ts:38-41], which dies with the lambda. Callers: campaigns route [VERIFIED app/api/campaigns/route.ts:385], publish cron [VERIFIED app/api/cron/publish-scheduled/route.ts:738], revenue cron [VERIFIED app/api/cron/unite-group-revenue/route.ts:98], outcomes digest [VERIFIED app/api/cron/outcomes-digest/route.ts:55] and the Stripe handlers. None I opened passes `missionId`.
- **Legacy SaaS framing is live code, not only types.** The union still names `user.churn` [VERIFIED lib/unite-group-connector.ts:51] and `payment.received` [VERIFIED lib/unite-group-connector.ts:53], and the Stripe handlers still emit `user.upgrade` [VERIFIED lib/stripe/webhook-handlers.ts:148-149], `user.churn` (line 202), `payment.received` (line 340) and `user.signup` [VERIFIED lib/stripe/webhook-handlers.ts:544-545]. Flagged as wrong framing under FD-8.
- **The Unite-Group receiver is dormant, single-key and has no dedup.** It returns 503 when `SYNTHEX_EVENTS_API_KEY` is unset [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/webhooks/synthex/route.ts:55-58], compares `x-api-key` with `timingSafeEqual` [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/webhooks/synthex/route.ts:39-43], inserts one `cc_agent_events` row per POST [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/webhooks/synthex/route.ts:91-99] and, when `missionId` names a task, appends a `comment` row to `cc_task_events` without changing `cc_tasks` status [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/webhooks/synthex/route.ts:110-132]. Its schema has no event id [VERIFIED Unite-Group e4d92d8ff apps/web/src/lib/integrations/synthex-events.ts:37-43], so a retried POST writes a second row. Retries must therefore wait for dedup (slice 2).
- **Unite-Group already has a claim plane, but Synthex cannot use it as is.** `/api/agents/runner/claim` is bearer-authed by `AGENT_EVENTS_SECRET` and dormant when unset [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/agents/runner/claim/route.ts:7-9]. Three facts block a Synthex runner there:
  1. `claimNextQueuedTask` filters only `founder_id` and `status = 'queued'` [VERIFIED Unite-Group e4d92d8ff apps/web/src/lib/command-centre/runner-claim.ts:107-118]; there is no lane filter, so a Synthex runner would take code missions and a code runner would take Synthex missions.
  2. A claim is refused unless the runner declares a kernel containment mechanism from a closed set, `job-object` on win32 or `cgroup2` on linux [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/agents/runner/claim/route.ts:155-158]. A Vercel lambda doing marketing work has no such mechanism and should not pretend to.
  3. `/release` means "done = draft PR opened" [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/agents/runner/release/route.ts:3-6], which is not Synthex's terminal state.
  "Lane `synthex`" in AM-6 [VERIFIED DECISIONS.md:50] therefore does not exist in Unite-Group's schema; the nearest field is `cc_tasks.agent_owner` [VERIFIED Unite-Group e4d92d8ff apps/web/supabase/migrations/20260604000000_cc_command_centre.sql:44].
- **The claim columns may not be applied in production.** `claimed_by`/`claimed_at` arrive in a migration marked "FOUNDER-GATED APPLY: this file is inert on merge" [VERIFIED Unite-Group e4d92d8ff apps/web/supabase/migrations/20260716010000_cc_tasks_claim.sql:7-12]. Whether production has them is UNVERIFIED.
- **Synthex has no persistent worker host.** BullMQ is configured from `REDIS_URL` [VERIFIED lib/queue/bull-queue.ts:179], but `startAllWorkers()` is deliberately not wired into any boot path [VERIFIED lib/queue/workers/autonomous-task-worker.ts:16-20], and the interim cron drain never executes agent work [VERIFIED app/api/cron/task-lifecycle/route.ts:4-5,15-16]. Vercel crons are the execution host that exists.
- **The gates the mission must run through exist.** `HOLD_FOR_REVIEW` is a typed constant `true` [VERIFIED lib/autopilot/hold-for-review.ts:23]; machine keys carry `smk_` prefix and route scopes [VERIFIED lib/auth/agent-principal.ts:26,50] stored as org-scoped `McpApiKey` rows with `scopes`, `expiresAt` and `revokedAt` [VERIFIED prisma/schema.prisma:7898-7906]. There is no `campaigns` route scope, and `POST /api/campaigns` is session-authed [VERIFIED app/api/campaigns/route.ts:212-215], so the poller calls the campaign service layer in-process rather than the REST route; the P4 key governs the REST/MCP edge, and the poller records the fleet principal id in every row it writes. (`ROUTE_SCOPES` still carries a `billing` scope for invoices [VERIFIED lib/auth/agent-principal.ts:85]; legacy framing, out of scope here, flagged.)

### Slice 1 (thinnest vertical slice): pull, claim, draft, report

One Unite-Group PR, one Synthex PR. No new table on either side, provided the 20260716 claim migration is applied in production.

1. **Unite-Group (its own release gate):** add `POST /api/agents/synthex/claim` and `POST /api/agents/synthex/report`, bearer-authed by a new `SYNTHEX_RUNNER_SECRET` (dormant when unset, `timingSafeEqual`, same pattern as the claim route [VERIFIED Unite-Group e4d92d8ff apps/web/src/app/api/agents/runner/claim/route.ts:45-57]).
   - `claim`: candidates `founder_id = FOUNDER_USER_ID AND status = 'queued' AND agent_owner = 'synthex' AND project_key IN ('carsi','restore')`, highest priority then oldest; claim by conditional update `.eq('status','queued').eq('agent_owner','synthex')` setting `status = 'running', claimed_by = runnerId, claimed_at = now()`; append a `started` `cc_task_events` row; return the task or `{ task: null }`. A runner id that already holds a `running` Synthex mission gets it back first (the `resumeOwnMission` precedent).
   - `report`: only the claimant (`claimed_by = runnerId`) may set `awaiting_approval` (with `evidence_path` = Synthex draft URL and `metadata.synthex = { runId, campaignId, quoteAud }`), `failed` (short code), or requeue (`queued`, claim cleared, attempt counter in `metadata.synthex.attempts`, capped at 3). It never sets `done`. Every report appends a `cc_task_events` row.
   - In the same PR: the generic `claimNextQueuedTask` excludes `agent_owner = 'synthex'`, so a code runner can never take a marketing mission. Hard stop (`MISSION_LANE_HARD_STOP = '1'`) is honoured by both new routes.
2. **Synthex:** add a cron route `app/api/cron/unite-group-missions/route.ts` (every 10 minutes, `verifyCronRequest`, `vercel.json` entry). Each tick: claim at most one mission with a stable `runnerId = 'synthex-vercel-1'`; map `project_key` to a Synthex `organizationId` through an explicit env map (`UNITE_GROUP_MISSION_ORGS`, JSON); unmapped key → report requeue with reason `org_unmapped` and stop (fails closed, mirrors the campaigns route's cross-brand 409 in Unite-Group); otherwise create a run id, call the campaign/draft service in-process for that org, obtain a cost quote, leave every post as `draft` via `holdAutopilotForReview`, and report `awaiting_approval` with the evidence link. A run spans ticks: state lives in the campaign and draft rows keyed by `missionId`, never in the lambda.
3. **Synthex connector:** add `mission.claimed`, `mission.drafted`, `mission.refused`, `mission.failed` event types carrying `missionId` and `runId`; every call site inside mission work passes `missionId`. Remove `user.signup`, `user.upgrade`, `user.churn` and `payment.received` from the union and their Stripe-handler emitters. Delivery stays fire-and-forget in slice 1 because the receiver has no dedup yet; the authoritative state change goes through `report`, which is synchronous and checked.

### Slice 1b: durable delivery record (Synthex only)

Add `UniteGroupDelivery` (below) and write one row per attempt with status code; surface it on the existing `app/api/unite-group/status` health probe. This closes AM-6's "surfaced, never dropped" without changing Unite-Group.

### Slice 2: outbox and signed webhooks (pattern 1)

1. **Synthex outbox.** `pushUniteGroupEvent` writes a `UniteGroupOutboxEvent` row (event id `evt_<cuid>`, payload, `missionId`) in the same transaction as the business write where one exists; a cron drain sends pending rows signed to Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256 of msg_id.timestamp.payload>`) [VERIFIED gh api repos/standard-webhooks/standard-webhooks/contents/spec/standard-webhooks.md, lines 141-143 and 211-234], with exponential backoff, a dead state after N attempts and a replay command that resends by event id.
2. **Unite-Group receiver (its release gate, founder `db push`):** verify the Standard Webhooks signature (reject timestamps outside 5 minutes), keep `x-api-key` accepted for one release as a fallback, and add a `synthex_event_receipts (founder_id, webhook_id) UNIQUE` table so a replayed `webhook-id` returns `200 { duplicate: true }` without a second `cc_agent_events` row.
3. **Optional Unite-Group outbox nudge.** When a `synthex` mission enters `queued`, Unite-Group writes an outbox row and a dispatcher POSTs a signed, contentless `mission.queued { missionId }` to a Synthex route that only triggers an early claim. The payload carries no instructions, so a forged nudge can at worst cause an extra poll. Build only if the 10-minute poll latency is shown to matter.

### Disposition test

This moves O1–O7 only through the missions it carries; by itself it is plumbing. It earns its place because FD-10 needs the founder to direct CARSI and RestoreAssist work from Mission Control, and AM-6 names this loop as J3's finish line. Slice 1 and 1b are recommended; slice 2's Unite-Group outbox nudge is deferred until poll latency is shown to cost a mission.

## Open-source candidates

| Project | Licence | Stars | pushed_at | What it gives us | Decision | Evidence |
|---|---|---|---|---|---|---|
| [standard-webhooks/standard-webhooks](https://github.com/standard-webhooks/standard-webhooks) | Apache-2.0 (JS library `standardwebhooks` 1.1.1 is MIT) | 1778 | 2026-10-15 | The signing spec (`webhook-id`/`-timestamp`/`-signature`, `msg_id.timestamp.payload`, key rotation by multiple signatures) plus a small sign/verify library in 10 languages | depend | [VERIFIED gh api repos/standard-webhooks/standard-webhooks] |
| [svix/svix-webhooks](https://github.com/svix/svix-webhooks) | MIT | 3459 | 2026-10-21 | Reference sender with retry schedule, dead-letter and replay UI; a separate Rust service to run, which is more than two endpoints need | study-pattern | [VERIFIED gh api repos/svix/svix-webhooks] |
| [timgit/pg-boss](https://github.com/timgit/pg-boss) | MIT | 4075 | 2026-10-20 | Postgres job queue using `SKIP LOCKED`; good model for claim/lease and dead-letter columns; needs a long-running process Synthex does not have | study-pattern | [VERIFIED gh api repos/timgit/pg-boss] |
| [graphile/worker](https://github.com/graphile/worker) | MIT | 2418 | 2026-10-20 | Postgres queue with `job_key` dedup; same worker-host problem and its own schema in a protected migration path | study-pattern | [VERIFIED gh api repos/graphile/worker] |
| [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | MIT | 9526 | 2026-10-21 | Already a Synthex dependency, but its workers are deliberately unwired and Redis state is not transactional with the Postgres business write, so it cannot be the outbox | reject | [VERIFIED gh api repos/taskforcesh/bullmq] |
| [inngest/inngest](https://github.com/inngest/inngest) | NOASSERTION (LICENSE.md: SSPL-1.0 with an Apache-2.0 future grant) | 5970 | 2026-10-21 | Durable steps and `waitForEvent`; SSPL server, and the `inngest/inngest-js` SDK reports GPL-3.0 (1016 stars, pushed 2026-10-21) | reject | [VERIFIED gh api repos/inngest/inngest], [VERIFIED gh api repos/inngest/inngest/contents/LICENSE.md], [VERIFIED gh api repos/inngest/inngest-js] |
| [triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev) | Apache-2.0 | 16592 | 2026-10-21 | Full durable-task platform; a new hosted service or self-host stack for a two-route bridge | reject | [VERIFIED gh api repos/triggerdotdev/trigger.dev] |
| [upstash/qstash-js](https://github.com/upstash/qstash-js) | MIT | 271 | 2026-10-20 | Hosted HTTP push with retries and dedup id that suits serverless; a new metered service, so a founder cost decision | study-pattern | [VERIFIED gh api repos/upstash/qstash-js] |

- **standard-webhooks**: the only dependency proposed. It replaces the bare `x-api-key` with a signed, timestamped, id-carrying message, and its `webhook-id` is the idempotency key the receiver needs. Synthex already has Stripe-style `t=…,v1=…` HMAC signing [VERIFIED lib/webhooks/sender.ts:139-143]; using the published spec instead lets Unite-Group verify with the same library rather than a home-grown parser. Supply-chain review (lockfile diff, maintainer and install-script check) runs before it lands; nothing is installed by this spec.
- **svix-webhooks / pg-boss / graphile-worker**: read for retry schedules, lease columns and dedup keys; the outbox is two small tables plus a cron, which is less than any of these to operate. A `gh search repos "transactional outbox"` sweep found no TypeScript/Postgres outbox library above 400 stars (top: namastack/namastack-outbox, Apache-2.0, a JVM library), which supports building the table rather than adding one.
- **BullMQ/Upstash**: BullMQ cannot carry this without a persistent host, which is an owner-gated decision already recorded in the worker header. `@upstash/redis` can hold a short-lived `webhook-id` seen-set if the Synthex inbound nudge route (slice 2.3) is built; the durable record stays in Postgres.
- **Inngest**: rejected on licence (SSPL server, GPL-3.0 SDK as reported by GitHub) and because it would be a second orchestration plane beside Unite-Group's claim plane.

## Data model

Org-scoped throughout; `organizationId` is never taken from a request body. All Synthex rows land via `prisma/migrations/**`, a protected path.

**Synthex (owned by Synthex)**
- Slice 1: none. Mission linkage lives in existing campaign `metadata` (`{ missionId, runId, source: 'unite-group' }`).
- Slice 1b: `UniteGroupDelivery { id, organizationId?, eventType, missionId?, eventId?, statusCode?, error?, attempt, createdAt }`, index `(missionId, createdAt)`.
- Slice 2: `UniteGroupOutboxEvent { id (evt_ cuid, sent as webhook-id), organizationId?, missionId?, type, payload Json, status (pending|sent|dead), attempts, nextAttemptAt, lastStatusCode?, createdAt, sentAt? }`, unique `id`, index `(status, nextAttemptAt)`. 1b's table becomes its attempt log.
- Not reused: `WebhookEndpoint` is user-scoped with a plaintext `secret` column [VERIFIED prisma/schema.prisma:449-469]; it is for client-configured endpoints and is not the place for a founder-level signing secret.

**Unite-Group (owned by Unite-Group; founder-applied `supabase db push`)**
- `cc_tasks`, `cc_task_events`, `cc_agent_events`: unchanged schema; Synthex writes only through the two new routes and the receiver. `cc_task_events.type` already allows `started`, `status_changed`, `failed`, `evidence_added` and `comment` [VERIFIED Unite-Group e4d92d8ff apps/web/supabase/migrations/20260604000000_cc_command_centre.sql:70-80].
- Slice 1 prerequisite: `20260716010000_cc_tasks_claim.sql` applied (an already-reviewed file, not a new migration).
- Slice 2: `synthex_event_receipts (id, founder_id, webhook_id, received_at, UNIQUE(founder_id, webhook_id))`, RLS forced, service-role writes; optional `cc_mission_outbox` for the nudge.

## Security & cost guardrails

- **Separate secret per plane.** `SYNTHEX_RUNNER_SECRET` arms only the two Synthex routes; arming it does not arm `/api/agents/runner/*` code execution. This deviates from AM-6, which names `AGENT_EVENTS_SECRET` [VERIFIED docs/superpowers/specs/2026-10-17-vibe-to-leader-amendments.md:19]; the founder must ratify it. Secrets are set by the founder; no agent reads or writes their values.
- **Mission text is untrusted data.** `title` and `objective` are fenced as quoted data into the brief, following the existing task-envelope boundary (`lib/tasks/task-envelope.ts`), never as instructions.
- **Fail closed on org.** Unmapped `project_key`, missing `FOUNDER_USER_ID`, or a mapping to an organisation without a brand profile leaves the mission queued with a reason; it never falls back to a default org.
- **No publish.** Drafts only; `HOLD_FOR_REVIEW` unchanged and its existing test must still pass. Re-read mission status before any irreversible step; slice 1 has none.
- **Cost.** One mission per tick, at most 3 attempts, and a P5 quote recorded before generation; a quote above the per-mission ceiling (default AUD 5, founder-set) reports `failed: over_quote` instead of spending. New infrastructure cost: none (Vercel cron and existing Postgres); QStash or Svix would be new spend and are not proposed.
- **Signature hygiene (slice 2).** 5-minute timestamp tolerance, `webhook-id` dedup, dual-signature key rotation, constant-time compare; the `x-api-key` fallback is removed one release after both sides verify.
- **Protected paths.** `prisma/migrations/**` (1b, 2) and `vercel.json` (the new cron) are protected in `scripts/fleet/policy.json`; those changes need a declared fleet commit or the founder's `human-required` label. Unite-Group changes travel through Unite-Group's own PR and release gate, and its migrations are founder-applied.

## Risk & assumption register

| ID | Risk or assumption | Likelihood | Impact | Mitigation | Evidence |
|---|---|---|---|---|---|
| R1 | The generic code runner, once armed, claims a Synthex mission and tries to run `claude` on marketing work | Medium | High | Same Unite-Group PR excludes `agent_owner = 'synthex'` from `claimNextQueuedTask`; planted-mission check in the verification plan | [VERIFIED Unite-Group e4d92d8ff apps/web/src/lib/command-centre/runner-claim.ts:107-118] |
| R2 | The claim columns are not applied in production, so slice 1 fails on first call | Medium | Medium | Founder one-line check before arming; the route returns 503 `storage_not_configured` if the column is missing | [VERIFIED Unite-Group e4d92d8ff apps/web/supabase/migrations/20260716010000_cc_tasks_claim.sql:7-12] |
| R3 | Retried Synthex events duplicate timeline rows | High if retries are added early | Low | Keep fire-and-forget until `synthex_event_receipts` lands (slice 2) | [VERIFIED Unite-Group e4d92d8ff apps/web/src/lib/integrations/synthex-events.ts:37-43] |
| R4 | A mission is drafted in the wrong organisation | Low | High | Explicit env map, fail closed, org id never from the body | [INFERENCE] |
| R5 | A lambda times out mid-run and the mission stays `running` forever | Medium | Medium | Stable runner id resumes its own mission; attempt cap 3; stale-claim sweep reports `failed: stale` after 24 h | [INFERENCE] |
| R6 | Prompt injection through mission text | Medium | Medium | Task-envelope fencing; drafts only; no tool with side effects in the mission path | [INFERENCE] |
| R7 | Unite-Group's release gate or UG-AUTONOMY-001 merges the Unite-Group half before the Synthex half is ready | Medium | Low | Both new routes are dormant until `SYNTHEX_RUNNER_SECRET` is set | [INFERENCE] |
| A1 | Founder queues Synthex missions with `agent_owner = 'synthex'` and `project_key` `carsi`/`restore` | — | — | Confirm with the founder (Q2) | [UNVERIFIED] |
| A2 | A 10-minute poll is fast enough for marketing missions | — | — | Measure claim latency for 2 weeks before building the nudge | [INFERENCE] |
| A3 | `UNITE_GROUP_EVENTS_URL`/`_API_KEY` and `SYNTHEX_EVENTS_API_KEY` are unset in production today | — | — | Read the receiver GET probe (`configured`) before slice 1 | [UNVERIFIED] |

## Open questions

1. **(Founder only)** Ratify a separate `SYNTHEX_RUNNER_SECRET` instead of AM-6's `AGENT_EVENTS_SECRET`, so arming Synthex missions does not arm the code-execution plane. Recommendation: yes.
2. **(Founder only)** Is `agent_owner = 'synthex'` plus `project_key` the way you will mark Synthex missions in Mission Control, or should Unite-Group add an explicit lane field? Recommendation: `agent_owner`, no schema change.
3. **(Founder only)** Has `20260716010000_cc_tasks_claim.sql` been applied to the production Unite-Group database? If not, it is a `supabase db push` of an already-reviewed file.
4. **(Founder only)** The per-mission spend ceiling (proposed AUD 5) and who moves a mission from `awaiting_approval` to `done`.
5. Should the Stripe handlers in Synthex be deleted outright under FD-8, or only stop emitting Unite-Group events? This spec removes only the emits.
6. Which Synthex organisation ids correspond to CARSI and RestoreAssist (needed for `UNITE_GROUP_MISSION_ORGS`)? Read from the database by the builder, not guessed.

## Verification plan

Each check names its red state. Unite-Group checks run in the Unite-Group repo under its own CI; they are listed so the Synthex side never claims them.

```bash
# Baseline reds today (Synthex worktree), each must be non-zero now and 0 after slice 1
grep -cE "user\.churn|payment\.received|user\.signup|user\.upgrade" lib/unite-group-connector.ts      # today: 5 (lines 7, 49, 50, 51, 53); expect 0
grep -nE "type: 'user\.(signup|upgrade|churn)'|payment\.received" lib/stripe/webhook-handlers.ts         # today: lines 149, 202, 338, 340, 545 match; expect no output

# Synthex slice 1 unit tests (new), each with a planted failure
npx jest tests/unit/cron/unite-group-missions.test.ts
#  - mission for project_key 'carsi' mapped -> draft created, report(awaiting_approval) called once, posts all 'draft'
#  - unmapped project_key -> report(requeue, org_unmapped), zero campaign rows   (red if any row is written)
#  - claim returns { task: null } -> no model call, no report                     (red if the generator mock is called)
#  - every pushUniteGroupEvent call in the run carries the claimed missionId      (red if one omits it)
#  - quote above ceiling -> report(failed, over_quote), generator not called
npx jest tests/unit/lib/autopilot/hold-for-review.test.ts   # existing; must still pass (HOLD_FOR_REVIEW true)
node -e "const c=require('fs').readFileSync('vercel.json','utf8');process.exit(/unite-group-missions/.test(c)?0:1)"  # red until the cron is declared

# Unite-Group slice 1 (Unite-Group repo, its CI)
#  - planted queued task agent_owner='synthex' -> generic /api/agents/runner/claim returns { task: null }   (red today: it would be claimed)
#  - same task -> /api/agents/synthex/claim returns it; a second concurrent claim returns { task: null }
#  - SYNTHEX_RUNNER_SECRET unset -> both routes 401/503 before any query
#  - report from a runner id that is not claimed_by -> 404, row unchanged; report 'done' -> 400

# Slice 2 (both repos)
#  - same webhook-id POSTed twice -> exactly one cc_agent_events row; positive control: two distinct ids -> two rows
#  - one byte changed in the body -> 401; webhook-timestamp 6 minutes old -> 401
#  - Synthex outbox row with a 500 response -> attempts=1, status pending, nextAttemptAt in the future; after N -> dead, visible on /api/unite-group/status
```

Expected finish: all Synthex checks green on the pushed SHA in GitHub CI, the Unite-Group checks green in Unite-Group's CI, and one live mission observed end to end after the founder arms the secrets. Until that live observation, the bridge is "built", not "working".
