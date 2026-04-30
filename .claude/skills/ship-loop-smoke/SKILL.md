---
name: ship-loop-smoke
description: Full system smoke child loop. Wraps scripts/overnight-smoke.mjs --iterations=1 to run the existing 4-layer rig (surface health + CSP hydration + API contract + fault injection) once per tick. Aggregates JSONL output into ship-loop-state.json. Lifts P0/P1 findings into ship-loop-escalations.md. "Until 100% green" = if any P0/P1 detected, sets state to red so master re-triggers next cycle. Use standalone via /loop ship-loop-smoke or wired into the master orchestrator.
type: child-loop
context: persistent
---

# ship-loop-smoke — full system smoke child loop

## Activation

- Standalone: `/loop ship-loop-smoke`
- Orchestrated: invoked by `ship-loop-master` every 60 min, after build+test+sanity all green

## Pre-condition

Read `ship-loop-state.json`. Skip if any of `build`, `test`, `sanity` are `red` (write event `{"reason":"prerequisites_red","skipped":true}`).

## Process

### Step 1: Run the existing smoke rig (single iteration)

```bash
cd D:/Synthex
node scripts/overnight-smoke.mjs --iterations=1 --target=https://synthex.social
```

The script writes to:

- `.claude/scratchpad/overnight-smoke-results.jsonl` (per-check rows)
- `.claude/scratchpad/overnight-smoke-clusters.json` (failure clustering)

Both are gitignored (per PR #142 .gitignore additions).

### Step 2: Parse the output

After the rig exits:

1. Read `overnight-smoke-results.jsonl` (last iteration only — filter by latest `iter` value)
2. Read `overnight-smoke-clusters.json`
3. Count results by check type:
   - Layer 1 (surface health): pass/fail per URL
   - Layer 2 (CSP hydration): pass/fail per surface
   - Layer 3 (API contract): pass/fail per probe (401, 400, 404, 414, 429)
   - Layer 4 (fault injection): pass/fail per fault type (random 1 fault per iter)
4. Identify P0/P1 clusters per the script's existing severity rules

### Step 3: Update state

Atomic update to `layers.smoke`:

```json
{
  "state": "green" | "red",
  "last_run": "<iso>",
  "iter": <int>,
  "details": {
    "layer_1_surface_health": { "pass": <int>, "fail": <int>, "failed_urls": [...] },
    "layer_2_csp_hydration":  { "pass": <int>, "fail": <int>, "failed_surfaces": [...] },
    "layer_3_api_contract":   { "pass": <int>, "fail": <int>, "failed_probes": [...] },
    "layer_4_fault_injection": { "fault": "<name>", "pass": true|false, "details": "..." },
    "p0_count": <int>,
    "p1_count": <int>
  }
}
```

`state === 'green'` IFF `p0_count === 0 AND p1_count === 0`.

### Step 4: Escalation lifting (NOT recovery)

Smoke layer findings escalate immediately — they reflect **production reality**, not editable local state. The loop does NOT auto-fix production.

For each P0 cluster: append to `escalations.md` as `## P0 — <cluster signature>` with the fully-formatted Linear-ready ticket body the script's `morning-task-list.md` already generates (re-use that format).

For each P1: same as P0 but with `## P1`.

### Step 5: "Until 100% green" semantics

The master loop will re-invoke `ship-loop-smoke` on its next eligibility tick (60 min) regardless of state — so a red smoke result naturally re-tests after the human has had a chance to address the escalation. There is no automatic re-run within a single tick.

If smoke state has been `red` for >4 consecutive runs: append `## P0 — Smoke layer red for 4+ consecutive runs (X minutes)` to escalations as a meta-issue (catches stuck-red situations the human missed).

## Recipe priorities for this loop

- #13 (degraded DB latency, cold-start) — auto-retry tolerated; degraded ≠ red unless persistent
- #14 (production 5xx) — escalate with Vercel deploy state check

## Verification

- Run when production is healthy; expect `state === 'green'` and zero new escalations
- Run during a known-degraded period (e.g. immediately after a Vercel deploy); expect amber tolerance per recipe #13
- Insert a synthetic failure into `overnight-smoke.mjs` (temporary `throw new Error('test')`); expect red state + escalation; revert after test

## Out of scope

- Modifying the `overnight-smoke.mjs` rig itself — that's a separate code change with its own PR
- Cross-iteration trend analysis (the rig already does clustering across N iterations; this skill takes 1 iter at a time)
- Posting smoke results to Slack/Linear automatically (escalations.md is the surface)
