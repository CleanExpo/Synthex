# JEV deterministic harness

Script-judged JEV families (spec: `docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md`, "JEV test harness").

## Layout

| Path                        | What                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `families.json`             | Family table: name, `expected_cases`, `hard_gate` (1,830 cases in total)                                                                      |
| `known-gaps/<FAMILY>.json`  | One file per family: `{"schema":"jev-known-gaps/1","family":"J1","gaps":{"<gap_id>":{"description":"...","cases":["<case id or prefix*>"]}}}` |
| `floors.json`               | Adopted floors (protected; changed only through a proposal)                                                                                   |
| `families/<jN>.jev.test.ts` | One Jest file per family, e.g. `families/j3.jev.test.ts`                                                                                      |
| `runner/record.ts`          | `recordResults`, `JevResult`, `knownGap`, `classify`                                                                                          |
| `runner/route-harness.ts`   | `invokeRoute`, `listRoutes`                                                                                                                   |
| `runner/run-det.mjs`        | `npm run jev:det [-- --family J3 [--family J8 ...]]`                                                                                          |
| `runner/aggregate.mjs`      | The verdict; `--control` runs its planted self-test                                                                                           |
| `out/` (gitignored)         | `<FAMILY>.jsonl` results and `summary.json`                                                                                                   |

## Result record

One JSON line per result in `out/<FAMILY>.jsonl`:

```json
{
  "id": "J1-0001",
  "family": "J1",
  "kind": "case",
  "state": "PASS",
  "route": "/api/posts",
  "detail": "401"
}
```

- `kind`: `case` or `control`. `state`: `PASS`, `FAIL`, `KNOWN_GAP` or `INCONCLUSIVE`. A `KNOWN_GAP` row carries its `gap_id`.
- A control is a planted defect; its `state` is the detector's verdict, so `FAIL` means caught (good).
- Use `classify(id, passed, detail)` for cases: a failing case listed in any `known-gaps/*.json` (exact id, or a prefix ending in `*`; longest prefix wins) is `KNOWN_GAP`; a listed case that passes is `PASS` with detail `known gap flipped: <gap_id>`.
- A route that throws at import or in the handler (`invokeRoute` returns `status: null`) is `INCONCLUSIVE`, never `PASS`.

## Verdict (aggregate.mjs)

Per family in scope the run fails when the out file is missing, a row is malformed or duplicated (a `KNOWN_GAP` row without `gap_id` is malformed), the `case` count differs from `expected_cases`, there are fewer than 3 controls, or any control is not `FAIL` (`BROKEN_CHECK`). A hard-gate family with any `FAIL` case fails the run, and so does any `INCONCLUSIVE` case in a hard-gate family. `KNOWN_GAP` never fails it. Non-hard-gate case reds are `RED_ADVISORY` and non-hard-gate `INCONCLUSIVE` cases are reported; neither fails it. `npm run jev:det` also fails when Jest does not exit 0 (an assertion failed, a signal, Jest missing): rows written by `afterAll` do not make a red Jest run green. Every `--family` given is in scope.

Every run writes `out/summary.json` (with `run_failures`). Only a complete full run (no `--family`) that exits 0 rewrites the measured floors proposal at `proposals/P1/tests/eval/jev/floors.json`, and only when the floors changed.

## Plugging in a family

```ts
import { classify, recordResults, type JevResult } from '../runner/record';
import { invokeRoute } from '../runner/route-harness';

const results: JevResult[] = [];
afterAll(() => recordResults('J1', results));

it('J1 cases', async () => {
  const r = await invokeRoute('app/api/posts/route.ts', 'GET');
  const id = 'J1-0001';
  if (r.status === null)
    results.push({
      id,
      family: 'J1',
      kind: 'case',
      state: 'INCONCLUSIVE',
      detail: r.error,
    });
  else
    results.push({
      id,
      family: 'J1',
      kind: 'case',
      ...classify(id, r.status === 401, `status ${r.status}`),
    });
});
// plus >= 3 planted-failure controls with kind: 'control' (not counted in expected_cases)
```

Then `npm run jev:det -- --family J1`.

## Goal sweep (`npm run jev:sweep`)

High-volume, seeded, offline cases that each measure one current goal and record its result. Separate from `jev:det`: it never reads or changes `families.json`, `floors.json` or the floors proposal, and it is not a hard gate.

| Goal | What every case measures                                                                                    | File                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G1   | Account or org creation without a valid unused invite is refused unless the invite mode is exactly `false`  | `sweep/g1.sweep.test.ts`                                 |
| G2   | Unsubscribe records or answers non-2xx; no marketing send to unsubscribed/unknown; List-Unsubscribe headers | `sweep/g2.sweep.test.ts`                                 |
| G3   | No model default resolves to a deprecated registry entry; unpriced image models are unusable                | `sweep/g3.sweep.test.ts`                                 |
| G4   | A publish is refused whenever a gate fails; a read failure never returns 2xx with empty data                | `sweep/g4.sweep.test.ts`, `sweep/g4-reads.sweep.test.ts` |
| G5   | An approved post gets published; an unapproved or rejected one never does                                   | `sweep/g5.sweep.test.ts`                                 |

```
npm run jev:sweep [-- --goal G1 ...] [--seed N] [--as-of YYYY-MM-DD] [--out-dir DIR] [--disarm-control G1-C01,...]
```

Rows go to `out/sweep/<goal>[.<part>].jsonl` (a `JevResult` plus `goal` and `criterion`; ids like `G1-000123`, controls `G1-C01`), and `out/sweep/summary.json` holds per-goal and per-criterion counts in the four states. Exit 0: all green. Exit 1: the harness is broken (a goal file missing or malformed, fewer than 3 controls, a control not caught = `BROKEN_CHECK`, Jest red). Exit 2: the harness is sound and the goals measured a FAIL or INCONCLUSIVE. `--disarm-control` runs a control without its planted defect; the run must then exit 1, which is the sweep's own self-test.
