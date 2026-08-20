# merge-gate

One command that answers one question: **is this branch safe to merge into main?**

```bash
npm run gate
```

It prints a single line, either

```
SAFE TO MERGE — feat/x @ 3c2f2cb51 merges clean with main @ 4d29e432a; Type Check, Lint, Unit Tests, Build introduce no new failures.
```

or

```
NOT SAFE — Type Check fails with 1 error(s) that main does not have. First: lib/foo.ts: error TS2322: ... Evidence: .harness/gate/feat-x
```

You do not have to read code to use it. If it says SAFE, merge. If it says NOT SAFE, do not.

## First run

Record what `main` itself currently fails, so the gate can tell _your_ breakage
apart from breakage that is already on main:

```bash
npm run gate -- --baseline
```

Re-record it whenever main moves. The gate refuses to give a comparative
verdict against a stale or missing baseline rather than guessing.

## Options

| Command                      | What it does                                                       |
| ---------------------------- | ------------------------------------------------------------------ |
| `npm run gate`               | Gate the current branch. Runs Type Check, Lint, Unit Tests, Build. |
| `npm run gate -- <branch>`   | Gate a named branch.                                               |
| `npm run gate -- --fast`     | Type Check and Lint only. Skips Build and the full suite.          |
| `npm run gate -- --baseline` | Re-record what main itself fails.                                  |

## Why it can be trusted

- **It never reads your working tree.** It builds a throwaway worktree at
  (branch merged with `origin/main`) under `.worktrees/gate` and runs there.
  A half-saved edit in your editor cannot make a broken branch look safe.
- **It pins to an exact commit.** The verdict names the SHA it judged.
- **It runs the real gates**, the same `type-check` / `lint` / `test` / `build`
  scripts CI runs. It does not re-implement them.
- **It subtracts main's own failures**, so a red main does not drown the signal.
- **It checks GitHub freshness.** If the PR's check results belong to an older
  commit than the branch head, that is reported as STALE, never as green.
- **It refuses to claim what it did not measure.** No baseline means no
  comparative verdict.

## Proving it still works

A gate that has only ever printed SAFE proves nothing. To re-verify it can
still catch a defect, plant one and confirm the gate **names it**:

```bash
git switch -c tmp/gate-check
echo 'export const _probe: number = "nope";' >> lib/profile-analyser/normalise.ts
git commit -am "test: planted defect"
npm run gate -- --fast tmp/gate-check
```

Expected: `NOT SAFE — Type Check fails with 1 error(s) that main does not have.
First: lib/profile-analyser/normalise.ts: error TS2322: ...`

A bare `NOT SAFE` that does not name the planted file is a **fail**, not a pass —
it means the gate is being pessimistic rather than perceptive. Delete the branch
afterwards.

## Evidence

Every run writes to `.harness/gate/<branch>/`:

| File                                                 | Contents                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `merge.txt`                                          | conflicting files, when the merge fails                    |
| `typecheck.txt`, `lint.txt`, `test.txt`, `build.txt` | raw output of each gate                                    |
| `verdict.json`                                       | the machine-readable verdict, SHAs, and GitHub check state |

`.harness/` and `.worktrees/` are both gitignored.
