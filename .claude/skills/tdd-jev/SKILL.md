---
name: tdd-jev
description: Test-driven development for the Synthex fleet, measured by JEV. Use when building or fixing anything in app/, lib/ or services/, when adding a JEV family or case, when a reviewer asks "can this test fail", or when a builder unit carries a proving command. Red before green at a pre-agreed seam, a planted failure that proves the test can go red, four-state results, floors that only rise.
metadata:
  author: synthex-fleet
  version: '1.0'
  type: method-skill
  derived_from: mattpocock/skills engineering/tdd (seams, anti-patterns, mocking at boundaries) + spec 2026-10-17 JEV harness (planted controls, four states, ratchet)
  requires:
    - fabel-evidence-standard
---

# tdd-jev — red, green, and proven able to go red

Pocock's loop produces tests worth keeping. JEV makes the loop measurable and makes a false green
impossible to record. This skill is both, in one procedure. It binds every builder unit in the fleet
(`scripts/fleet/fanout.mjs` points here) and every JEV family under `tests/eval/jev/`.

## The rule in one line

A test that cannot fail is not coverage. Every test ships with the planted failure that turns it red,
and a family whose planted failures stay green is BROKEN_CHECK, which fails the run.

## Procedure (one slice at a time)

1. **Name the seam.** Write down the public interface under test: the route handler called through
   `createMockNextRequest` (`tests/helpers/mock-request.ts`), the exported service function, the MCP
   tool via `executeStudioTool`, the script's exit code. Tests live at seams, never against internals.
   If the seam is unclear, the module is the wrong shape; stop and reshape before testing.
   Completion: the seam is written in the test file header as `SEAM:` with what it catches and misses.
2. **Red.** Write the failing test first. Run it. Paste the failing line. If it passes before the change,
   it is tautological or aimed at the wrong seam; rewrite it.
3. **Green.** The minimal change that passes. No speculative features, no second seam.
4. **Plant the failure.** Add the control: a fixture, mutant or flag that must make the test fail
   (a route that returns 200 without auth; a writer that persists an `audio` field; a floor lowered by
   0.01). Run it; paste the red line. In a JEV family this is `control: true`; in a unit test it is a
   second test named `… (control: planted failure is caught)`.
5. **Measure.** Run the proving command the unit carries (for example `npm run jev:det -- --family J8`).
   Record the four-state result: PASS, FAIL, INCONCLUSIVE (could not run), DISABLED (lane or credential
   absent). A red case that is expected until a later phase is KNOWN_GAP with its gap id (M1…M14);
   it does not fail the run and it does not count as pass.
6. **Ratchet.** Floors in `tests/eval/jev/floors.json` only rise; the first measured values travel
   as `proposals/P1/tests/eval/jev/floors.json`. A deleted case needs a tombstone entry.
7. **Report.** Tag claims per `.claude/rules/fabel-evidence-standard.md`. "Tests pass" without the
   `Tests:` line is UNCONFIRMED. The orchestrator re-runs the gate on the integrated tree regardless.

Refactoring is not part of the loop; it belongs to review.

## What a good test is (Pocock, kept exactly)

- Behaviour through the public interface; survives internal refactors; describes WHAT, not HOW.
- One logical assertion per test; expected values are independent literals, never recomputed the way
  the code computes them.
- Verify through the interface, not a side channel (`getUser(id)` after `createUser`, not a raw SELECT).

## Anti-patterns that fail review here

| Anti-pattern                                                                         | Why it is rejected                                                    | Synthex evidence                                                                                                                          |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Blocker that cannot fire                                                             | The gate exists on paper only                                         | BACKLOG rows 0, 0a, 0b: `draft_humanness_below_60`, `draft_asset_policy_not_publish_safe`, `draft_media_plan_missing` could never trigger |
| Test with no assertion, or `expect(true)`                                            | Green by construction                                                 | K5 scanner rejects it                                                                                                                     |
| Mocking our own modules or Prisma call shapes to assert call counts                  | Implementation-coupled; breaks on refactor without a behaviour change | Pocock mocking rules                                                                                                                      |
| 2xx with empty data treated as success                                               | Honest-status defect; the spec's whole P2 exists because of it        | `lib/platform/noop-client.ts` history (SYN-1070)                                                                                          |
| Horizontal slicing (all tests first, then all code)                                  | Tests imagined shape, not behaviour                                   | —                                                                                                                                         |
| Lowering a floor, deleting a case without a tombstone, widening `exempt-routes.json` | Ratchet violations                                                    | `scripts/jev/check-ratchet.mjs`, protected paths                                                                                          |
| Reporting "passing" from a child thread                                              | Unconfirmed until the integrated gate                                 | fabel-evidence-standard                                                                                                                   |

## Mocking: boundaries only

Mock at system boundaries: Supabase auth session, external platforms (stub adapter in
`tests/eval/jev/lib/stub-platform.mjs`), payment, email, time, randomness, the network. Prefer a
local Postgres (`provision.mjs` supplies one; `tests/setup.ts` sets a local `DATABASE_URL`) over
mocking Prisma. Never mock lib modules you own. Inject dependencies at the seam so the production
adapter and the test adapter are the two adapters that make the seam real.

## JEV family contract (for harness builders)

```js
// tests/eval/jev/families/J<n>.mjs
export const family = 'J8';            // one of J1..J13
export const hardGate = true;          // J1, J2, J8, J9, J10, J11, J12 are hard gates
export function cases() {
  return [
    { id: 'J8-001', title: 'approval status honoured', kind: 'jest' | 'script', gap: undefined,
      control: false, run: async () => ({ state: 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'DISABLED', detail }) },
    { id: 'J8-C01', title: 'control: publish without approval must FAIL', control: true, run: ... },
  ];
}
```

Rules the runner enforces: at least three `control: true` cases per family and all must end FAIL in
the same run; an unknown generator model id makes a model-judged case INCONCLUSIVE; a script verdict
is final and no model may overturn it; results are written to `tests/eval/jev/runs/latest.json`.

## Judged cases (P8 onward)

Only what a script cannot decide (claim entailment, on-brief copy, image matches references) goes
to a judge. Two judges from different model families, a third breaks ties; judges run as Cloudroom
child threads on the Max plan (Sonnet 5.5, Opus 5.5 tie-break, Haiku 5.5 screen; DECISIONS.md A-18)
and are calibrated on planted-defect mutants (90 percent catch, 10 percent false-fail, kappa 0.6)
before any verdict counts. Content under judgement is JSON-encoded data, never instructions.

## Completion criterion for a unit

The proving command exits 0, the planted failure was shown red in this session, type-check and lint
exit 0, related tests pass with the `Tests:` line pasted, and the commit carries
`Fleet-Role: builder` and `Fleet-Unit: <id>`. Anything less is reported as FAIL or INCONCLUSIVE
with one line of cause, never as "should work".
