# JEV deterministic harness

Script-judged JEV families (spec: `docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md`, "JEV test harness").

## Layout

| Path                        | What                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `families.json`             | Family table: name, `expected_cases`, `hard_gate` (1,830 cases in total)                 |
| `known-gaps.json`           | `{"schema":"jev-known-gaps/1","gaps":{"<gap_id>":{"cases":["<case id>"],"note":"..."}}}` |
| `floors.json`               | Adopted floors (protected; changed only through a proposal)                              |
| `families/<jN>.jev.test.ts` | One Jest file per family, e.g. `families/j3.jev.test.ts`                                 |
| `runner/record.ts`          | `recordResults`, `JevResult`, `knownGap`, `classify`                                     |
| `runner/route-harness.ts`   | `invokeRoute`, `listRoutes`                                                              |
| `runner/run-det.mjs`        | `npm run jev:det [-- --family J3]`                                                       |
| `runner/aggregate.mjs`      | The verdict; `--control` runs its planted self-test                                      |
| `out/` (gitignored)         | `<FAMILY>.jsonl` results and `summary.json`                                              |

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

- `kind`: `case` or `control`. `state`: `PASS`, `FAIL`, `KNOWN_GAP` or `INCONCLUSIVE`.
- A control is a planted defect; its `state` is the detector's verdict, so `FAIL` means caught (good).
- Use `classify(id, passed, detail)` for cases: a failing case listed in `known-gaps.json` is `KNOWN_GAP`; a listed case that passes is `PASS` with detail `known gap flipped: <gap_id>`.
- A route that throws at import or in the handler (`invokeRoute` returns `status: null`) is `INCONCLUSIVE`, never `PASS`.

## Verdict (aggregate.mjs)

Per family in scope the run fails when the out file is missing, the `case` count differs from `expected_cases`, there are fewer than 3 controls, or any control is not `FAIL` (`BROKEN_CHECK`). A hard-gate family with any `FAIL` case fails the run. `KNOWN_GAP` and `INCONCLUSIVE` never fail it (the inconclusive count is reported). Non-hard-gate case reds are `RED_ADVISORY` and never fail it. The Jest exit code is not the verdict.

Every run writes `out/summary.json`. A full run (no `--family`) also writes the measured floors proposal to `proposals/P1/tests/eval/jev/floors.json`.

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
