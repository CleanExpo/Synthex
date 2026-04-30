---
name: ship-loop-build
description: Build + type-check + lint child loop for ship-loop-master. Runs `npm run type-check && npm run lint && npm run build`, records pass/fail per command into ship-loop-state.json, applies one recovery recipe on failure (from ship-loop-shared/recovery-recipes.md), retries once, escalates on second failure. Use standalone via /loop ship-loop-build for debugging or wired into the master orchestrator.
type: child-loop
context: persistent
---

# ship-loop-build — build/type/lint child loop

## Activation

- Standalone: `/loop ship-loop-build` (CEO debugging a single layer)
- Orchestrated: invoked by `ship-loop-master` when `layers.build.state !== 'green' OR last_run > 30 min ago`

## Process

### Step 1: Run gates in order, capture output

```bash
cd D:/Synthex
npm run type-check   # must pass first
npm run lint         # then this
npm run build        # then this
```

Record per command:

- `exit_code`
- last 100 lines of stderr+stdout (for recipe matching)
- duration

### Step 2: Update state

Atomic update to `ship-loop-state.json` `layers.build`:

```json
{
  "state": "green" | "red",
  "last_run": "<iso>",
  "retries": <int>,
  "details": {
    "type_check": { "pass": true|false, "errors": <int>, "first_error": "..." },
    "lint":       { "pass": true|false, "errors": <int>, "first_error": "..." },
    "build":      { "pass": true|false, "duration_ms": <int>, "first_error": "..." }
  }
}
```

### Step 3: Recovery sub-loop on red

If any of the three commands failed AND `layers.build.retries < 1`:

1. Match the failure stderr against `recovery-recipes.md` table (regex, top to bottom, first match wins)
2. If match found:
   - Apply the fix (run the recipe's commands; edit files if recipe is "change X to Y")
   - Increment `retries`
   - Re-run the failed gate (just that one, not all three)
   - Update state with new outcome
3. If no match OR retry also failed:
   - Append to `escalations.md`:
     ```md
     ## P1 — Build layer red after retry exhaustion

     - When: <iso>
     - Failing gate: <type-check|lint|build>
     - First error line: <verbatim>
     - Recipe attempted: <recipe # or "no match">
     - Suggested human action: <recipe's "Suggested" column or "no recipe — investigate">
     - Repro: `cd D:/Synthex && <command>`
     ```
   - Exit (master will see red state + escalation, halt accordingly)

## Recipe priorities for this loop

Most likely matches (from `recovery-recipes.md`):

- #1 (Prisma drift) — if type-check fails on `Property '<x>' does not exist on type 'PrismaClient'`
- #2 (lockfile drift) — if `Cannot find module '@sentry/react'` etc.
- #4 + #5 (Edge bundle node-builtin) — if build fails with `UnhandledSchemeError` or `Module not found: Can't resolve 'fs/promises'`

## Verification

- Run from a clean tree with stale `node_modules/.prisma/client` deleted; expect recipe #1 to match, fire `npx prisma generate`, retry, succeed
- Insert a deliberate type error (e.g. `const x: number = "string"` in any TS file); expect first run red, no recipe match, escalation written

## Out of scope

- Build ARTIFACTS validation (handled by ship-loop-smoke)
- Bundle size checking (defer to build-orchestrator)
- Source map upload (Sentry — disabled per next.config.mjs)
