---
name: ship-loop-test
description: Jest test suite child loop. Runs `npm test` (uses jest.worktree.cjs per package.json), records pass/fail counts and failing suite paths into ship-loop-state.json. Only fires if last ship-loop-build was green. Applies one recovery recipe (jest config / mock generation / worktree cleanup) on failure, retries once, escalates. Use standalone via /loop ship-loop-test or wired into the master orchestrator.
type: child-loop
context: persistent
---

# ship-loop-test — jest test suite child loop

## Activation

- Standalone: `/loop ship-loop-test`
- Orchestrated: invoked by `ship-loop-master` when `build.state === 'green' AND (test.state !== 'green' OR test.last_run > 30 min ago)`

## Pre-condition gate

Read `ship-loop-state.json`. If `layers.build.state !== 'green'`:

- Skip this run; write event `{"reason":"build_not_green","skipped":true}`
- Return to master without changing test state

## Process

### Step 1: Run jest

```bash
cd D:/Synthex
npm test 2>&1 | tee /tmp/ship-loop-test-output.log
```

Parse output for:

- `Test Suites: X failed, Y skipped, Z passed, T total` line
- `Tests: A failed, B skipped, C todo, D passed, E total` line
- All `^FAIL ` lines (failing test file paths)
- For each failure, extract first 5 lines of error context

### Step 2: Update state

Atomic update to `layers.test`:

```json
{
  "state": "green" | "red",
  "last_run": "<iso>",
  "retries": <int>,
  "details": {
    "suites": { "passed": <int>, "failed": <int>, "skipped": <int>, "total": <int> },
    "tests": { "passed": <int>, "failed": <int>, "todo": <int>, "skipped": <int>, "total": <int> },
    "failing_suites": [
      { "path": "tests/...", "first_error": "..." }
    ]
  }
}
```

`state === 'green'` IFF `suites.failed === 0 AND tests.failed === 0`.

### Step 3: Recovery sub-loop on red

If `state === 'red'` AND `retries < 1`:

For each failing suite (process up to 3 per tick to avoid runaway):

1. Match error against `recovery-recipes.md` (priorities below)
2. If match: apply recipe, increment `retries`, re-run JUST that suite via `npx jest --config jest.worktree.cjs <path>`, update state
3. If no match OR retry-also-fails: append to `escalations.md`:
   ```md
   ## P1 — Test failure: <suite path>

   - When: <iso>
   - First error: <verbatim>
   - Recipe attempted: <# or "no match">
   - Repro: `cd D:/Synthex && npx jest --config jest.worktree.cjs <path>`
   ```

## Recipe priorities for this loop

Most likely matches:

- #3 (uncrypto/ESM) — `SyntaxError: Unexpected token 'export'`
- #6 (`fail()` deprecation) — `ReferenceError: fail is not defined`
- #7 (auth ratchet breach) — `Auth coverage ratchet breached`
- #9 (worktree pollution) — failing path starts with `.claude/worktrees/`

### Bespoke recovery: missing mock

If error matches `Cannot find module '<pkg>'` AND `<pkg>` is in `package.json` AND a similar mock exists at `tests/__mocks__/`:

- Auto-create `tests/__mocks__/<pkg>.js` with skeleton:
  ```js
  // Auto-generated mock by ship-loop-test recovery
  module.exports = {};
  module.exports.default = {};
  ```
- Re-run; if still fails, escalate (mock needs hand-curation)

## Verification

- Insert a failing test (`expect(true).toBe(false)`) in `tests/unit/foo.test.ts`; expect first run red, no recipe match, escalation written
- Add `import 'uncrypto'` to a test file and remove uncrypto from `transformIgnorePatterns`; expect recipe #3 to match, recipe applied, retry succeeds

## Out of scope

- Coverage threshold validation (defer to CI; jest config already has thresholds)
- Flaky test detection (would need re-run statistics — Phase 2 enhancement)
- E2E playwright tests (excluded per `testPathIgnorePatterns` in jest configs)
