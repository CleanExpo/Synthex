---
name: nexus-viral-run
description: Human-triggered runner for the nexus-viral 1→8 short-form pipeline. Composes brief → Gate A → copy → generate_video → poll → Gate B → derive_cuts as one gated agent session over the real studio/MCP tools. Draft-first spend; every gate aborts BEFORE any paid generation. NO publish primitive — releasing cuts is a separate human-gated route (WS4). Use when a human wants to take one viral idea from brief to inert, review-ready platform cuts in a single action.
operates_in: [L6]
linear: SYN-1075
phase: nexus-viral-productionise (WS1)
stacks_on: WS3 gates (lib/video/gates)
---

# nexus-viral-run

The runner that turns one idea into 1 hero video + N inert platform cuts, with a
deterministic gate between every stage and no way to spend or publish without an
explicit human action. It is an **agent session**, not a daemon — a human triggers
it; there is no cron, no queue, no autonomous loop.

Driver: `scripts/nexus-viral-run.ts` (`runNexusViral(options, deps)`).

## When to use

- A human wants a full 1→8 run in one action: brief → gated hero generation →
  gated derivation into platform-native cuts, landing as `queued_human_gated`
  (inert, unpublished) drafts ready for the WS4 release surface.
- Trend/competitor research and hook authoring already happened (or are folded
  into the brief) — this skill is the **execution spine**, not the ideation.

Do NOT use to publish, schedule, or push anything to a platform. This skill has
no publish capability by construction (phase-1 boundary).

## Stage sequence (each gate precedes the next spend)

| # | Stage         | Backing function / tool                                             |
|---|---------------|---------------------------------------------------------------------|
| 1 | brief         | `loadBrief(orgId, topic)` — org-grounded angle + facts              |
| A | **Gate A**    | `runBriefGrill` (LLM producer) → `assertGatePassed(ref,'brief')`    |
| 2 | copy          | senior-copywriter-style producer (see resolution below)             |
| 3 | generate      | `executeStudioTool('generate_video', …)` — draft, 9:16, 6s, 1 var   |
| 4 | poll          | `executeStudioTool('get_job', { id })` until rendered/failed/timeout|
| B | **Gate B**    | `runBroadcastGrill` → `assertGatePassed(heroId,'broadcast')`        |
| 5 | derive_cuts   | `executeStudioTool('derive_cuts', …)` → `queued_human_gated` cuts   |
|   | report        | structured `NexusViralRunReport` (stages, gate verdicts, refs)      |

`generate_video`, `get_job`, `derive_cuts` are the real creative_* studio tools
(`lib/services/ai/studio-tools/index.ts`). Gate A/B are WS3
(`lib/video/gates/`): `runBriefGrill` / `runBroadcastGrill` are LLM producers
that write a `MarketingAgencyQaReport` row; `assertGatePassed` is the
deterministic, fail-closed enforcer that only resolves on a persisted `passed`
row. An agent's "8/8 verdict" is inert until that enforcer reads it.

## Gate discipline (the point of this skill)

- Gate A runs on the **brief, before any generation**. A FAIL — or a fail-closed
  `assertGatePassed` throw — aborts the run and prints `blockedReasons`. No
  `generate_video` call is made, so **no spend occurs on a failed brief**.
- Gate B runs on the **rendered hero, before derivation**. A FAIL aborts before
  `derive_cuts`; nothing is derived and nothing reaches the release surface.
- FAIL is terminal here — no auto-retry / re-judge loop. Re-running is a
  deliberate human action.

## Spend safety — the live generate STOP

`generate_video` is real provider spend (~$1.69 draft + renders, spec §13). The
driver is safe by default:

- **Default (no `--live`)** → full **dry-run**: gates + copy run, but
  `generate_video` is never called. The report terminates cleanly at `generate`.
- **`--live` without confirmation** → prints a documented **STOP** and no-ops the
  generate step. Never spends.
- **`--live --confirm-spend`** (or `NEXUS_VIRAL_CONFIRM_SPEND=1`) → the single
  real path. This is the founder's deliberate, watched morning proof — one live
  1→8 draft run. An overnight/automated agent MUST NOT set this.

```bash
# dry-run (safe, default) — exercises the whole composition, spends nothing
npx tsx scripts/nexus-viral-run.ts --org <orgId> --user <userId> --topic "…"

# live proof — human-watched, deliberate spend
npx tsx scripts/nexus-viral-run.ts --org <orgId> --user <userId> --topic "…" \
  --campaign <campaignId> --live --confirm-spend
```

## nexus-copywriter resolution ([UNCONFIRMED] → resolved)

The spec named a `nexus-copywriter` **agent** for the copy stage. **It does not
exist** — only the `senior-copywriter` skill does (verified). The copy stage
therefore delegates to a senior-copywriter-style producer over `getAIProvider()`
(the headless-callable equivalent), injected as `deps.generateCopy`. No phantom
agent is referenced. For a rich, brand-grounded human session, invoke the
`senior-copywriter` skill to author the hook/captions and feed them in.

## Boundaries (never crossed)

- No publish/schedule primitive is imported or called. Cuts land
  `queued_human_gated` and stay inert until the WS4 human release route acts.
- No autonomous loop / daemon / cron.
- Every effect is injected via `NexusViralRunDeps`, so the driver is fully
  unit-mockable with no network, DB, or paid call.

## Verification

`__tests__/nexus-viral/run.test.ts` proves: happy path threads all stages; Gate A
FAIL aborts before `generate_video`; Gate A fail-closed enforcement aborts before
spend; Gate B FAIL aborts before `derive_cuts`; default is a no-spend dry-run.
