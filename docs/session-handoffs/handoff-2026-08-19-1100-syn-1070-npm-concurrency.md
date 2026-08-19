# Session Handoff — SYN-1070 / PR #902 environment repair

- **Timestamp:** 2026-08-19 ~11:00 AEST
- **Branch:** `feat/campaign-concept-studio`
- **HEAD:** `d8d12379b`
- **PR:** [#902 — feat(ccs): Campaign Concept Studio](https://github.com/CleanExpo/Synthex/pull/902) — OPEN, **mergeable: CONFLICTING**

---

## 1. Summary + state

**State: WIP — BLOCKED. This handoff is INCOMPLETE.**

No product code was written this session. The whole session went to diagnosing and repairing a
corrupted `node_modules`, and to recovering tracked source that the repair attempts destroyed.

Definition-of-Done result: **FAIL** — the Phase 0 gate has not returned. It is queued and running
(see §5). Items 2, 4 and 5 of the DoD are unmet.

| Attempted                                      | Outcome                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| Diagnose 55,353 type errors from prior session | Root-caused (§3)                                     |
| Repair `node_modules`                          | Second clean rebuild in flight (task `buwh1dv53`)    |
| Run type-check / lint / test gate              | **Ran once against a damaged tree — result VOID**    |
| Update PR #902                                 | Not started — blocked on gate, and PR is CONFLICTING |

## 2. Where it started

Resuming from `5dc1ffb1d` (SYN-1070 handoff, claimed 7928 tests passing). The stated next step was
`npm ci` + gate review. `npm ci` failed repeatedly with `ENOTEMPTY` and `EPERM` on Windows, which
earlier sessions attributed to Windows Defender real-time protection holding file handles.

## 3. Decisions locked + what shipped

**F1 — the root cause was never Windows Defender.** Multiple concurrent `npm install` / `npm ci`
processes were running against `D:\Synthex` simultaneously, orphaned from dead sessions. Each
deleted and rewrote what the others wrote. That is the true source of every `ENOTEMPTY`, `EPERM`,
and of directories vanishing between `mkdir` and `tar`.

Evidence — two separate rounds of orphans found and killed:

- Round 1: PIDs `24876`, `45532`, `47064` (all `npm install --legacy-peer-deps ... --cache ./.npm-cache-alt`).
- Round 2: PIDs `36384`, `40568` (`npm install --legacy-peer-deps --no-audit --no-fund --progress=false`),
  parent `sh.exe` shells `23700` / `8152` already dead — confirmed orphans, not a live session's work.

A reboot or a Defender exclusion would have "worked" only by killing those processes as a side effect.

**F2 — the repair attempts destroyed tracked source.** 31 committed files under
`packages/brand-config/` were deleted from disk (by a `robocopy` mirror and `fs.rmSync` workaround,
then again during npm's reify). Recovered with `git restore packages/brand-config package-lock.json`.
Verified back: 31 files on disk, 31 in HEAD, `git status` clean. **These deletions were never
committed** — confirmed: the only auto-commit in the window, `d8d12379b`, touched `.gitignore` alone.

**Shipped this session:** three `.gitignore` housekeeping commits only —
`face337f2`, `cf2c144f4`, `d8d12379b`. No product code. **23 commits are unpushed** on this branch.

**Two Git Bash traps worth keeping:**

- GNU `tar` reads a `C:\...` path as a remote host spec → pass `--force-local`.
- Git Bash rewrites robocopy's `/E` into `E:/` → prefix with `MSYS2_ARG_CONV_EXCL='*'`.

## 4. Key files

| File                                                                      | Status                                                    |
| ------------------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/brand-config/**` (31 files)                                     | **Needs review** — deleted then restored from HEAD        |
| `package-lock.json`                                                       | Restored from HEAD (npm had rewritten it)                 |
| `.gitignore`                                                              | Modified + committed (`.npm-cache-alt/`, `.tmp_control/`) |
| `node_modules/`                                                           | Rebuilding — `npm ci` in flight                           |
| `~/.claude/projects/D--Synthex/memory/project_windows_npm_concurrency.md` | Created — the F1 trap                                     |

## 5. Running state (verified)

**F3 — the first gate run is void, and the first `npm ci` did not produce a sound tree.**
`npm ci` (PID 4588) exited 0 at 10:56:55, and the seven headline packages resolved (zod, next,
typescript, jest, `@prisma/client`, eslint, webpack). But `npx prisma generate` then failed:

```
Error: Cannot find module './uniqueBy.cjs'
Require stack: node_modules/remeda/dist/index.cjs → @prisma/dev/dist/state.cjs → prisma/build/index.js
```

`remeda` has its `package.json` but is missing internal files. A package-json-presence audit
cannot see that class of damage — the first ~20 minutes of that `npm ci` overlapped the two
orphaned installs (killed ~10:40), so part of the tree is still theirs.

`npm run type-check` then returned **exit 2**, but every error was environment-caused, not code:
missing `@unite-group/control-module`, missing `@unite-group/brand-config`, `@prisma/client` with
no `Prisma`/`PrismaClient` export, missing `@supabase/supabase-js`, plus implicit-`any` errors
downstream of those missing types. **Treat that type-check result as void.**

Currently running:

- **Task `buwh1dv53`** — `<scratchpad>/gate2.sh`: a second `npm ci --ignore-scripts`, then an
  integrity spot-check (including `remeda/dist/uniqueBy.cjs`), then workspace builds →
  `prisma generate` → type-check → lint → test. Every step records a **real** exit code.
  **Log: `<scratchpad>/gate2.log`**, per-step logs `ci.log` / `ws.log` / `prisma.log` /
  `type.log` / `lint.log` / `test.log`. Scratchpad =
  `C:\Users\DISAST~1\AppData\Local\Temp\claude\D--Synthex\24af82f9-d13a-4b88-a355-fe0bcbc8502f\scratchpad`.
- Stopped deliberately: task `bn9u0otsg` and its orphaned `type-check` / `lint` / `jest`
  children (15 jest workers were running against the damaged tree).
- Unrelated and left alone: a Playwright test-server in `.claude\worktrees\fervent-edison-f5e1bb`,
  and two Playwright MCP processes.

## 6. Verification — exact commands

Before anything else, prove there is exactly one npm writer:

```bash
MSYS2_ARG_CONV_EXCL='*' wmic process where "name='node.exe'" get ProcessId,CommandLine /format:list | grep -i "npm-cli.js"
```

Then the Synthex definition-of-done gate (from `.claude/rules/development/workflow.md`):

```bash
npx prisma generate          # needed: npm ci ran with --ignore-scripts
npm run type-check
npm run lint
npm test
```

`--ignore-scripts` was used because `@unite-group/control-module`'s `prepare` script runs `tsup`
before `tsup` is on PATH, which aborted `npm ci` outright.

## 7. Deferred + open questions

**Deferred**

| Item                                       | Owner      | Blocking                  |
| ------------------------------------------ | ---------- | ------------------------- |
| Run + read the gate result                 | next agent | Yes — gate is the DoD     |
| Resolve PR #902 `CONFLICTING` merge state  | next agent | Yes — blocks merge        |
| Push the 23 unpushed commits               | next agent | Yes — after gate is green |
| Review the `packages/brand-config` restore | **Phill**  | No, but do it             |

**Open questions**

| Question                                                             | Owner      | Why                                                                                                                                              |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| What spawned the orphaned `npm install` processes?                   | Phill      | They came back once after being killed. If a hook, watcher, or second session respawns them, the corruption recurs and this repair is temporary. |
| Does `npm ci` delete `packages/brand-config` via a Windows junction? | next agent | Observed deleted mid-`npm ci`, then present again after. Mechanism unconfirmed — do not assume it is safe.                                       |
| Is `.npm-cache-alt/` still needed?                                   | next agent | Now gitignored, but it was created by an orphaned install.                                                                                       |

## 8. Pick up here

**Start here**

1. Read `<scratchpad>/gate2.log` — the gate result is the whole blocker. Check
   `integrity-missing=0` first; if it is non-zero the tree is still damaged and every
   downstream result is void.
2. Confirm exactly one npm process (command in §6). Kill orphans before anything else.
3. If the gate is green: verify `git status` clean, then push and address PR #902's conflict.
4. If the gate is red: separate environment errors (missing modules, absent `@prisma/client`
   exports) from real code errors. Only the second kind is a code defect.

**Do not redo**

- Do not add a Windows Defender exclusion. It is not the cause.
- Do not restart the machine "to fix npm". Kill the orphaned processes instead.
- Do not `rm -rf` / `robocopy`-mirror `node_modules`. That is what deleted `packages/brand-config`.
- Do not commit deletions under `packages/brand-config/` — they are collateral, always `git restore`.

**First command to run**

```bash
cat "C:/Users/DISAST~1/AppData/Local/Temp/claude/D--Synthex/24af82f9-d13a-4b88-a355-fe0bcbc8502f/scratchpad/gate2.log"
```

## 9. Risk notes

- **R1** — The gate has never been run to completion this session. Any claim about test counts on
  this branch traces to the prior handoff (`5dc1ffb1d`, "7928 tests passing"), which is
  `[UNCONFIRMED]` here.
- **R2** — `node_modules` was hand-repaired earlier by extracting 30 locked tarballs over the top,
  then rebuilt by an `npm ci` whose first ~20 minutes overlapped two orphaned installs. The tree
  is a hybrid until `buwh1dv53` proves otherwise. Rebuild from a single clean `npm ci`; never
  patch it again.
- **R2b** — **A package-json-presence audit is not an integrity check.** `remeda` passed that
  audit and was still missing `dist/uniqueBy.cjs`. Any future "node_modules looks fine" claim
  needs a deeper probe than "does `package.json` exist".
- **R3** — `packages/brand-config` was deleted twice and restored twice. If a third deletion
  appears, stop and find the mechanism before restoring again.
- **R4** — PR #902 is `CONFLICTING`. No merge is possible until that is resolved, independent of
  the gate.
- **R5** — Orphaned npm processes returned once after being killed. Treat the single-writer state
  as unproven until re-checked at pickup.
- **R6** — `npm ci` ran with `--ignore-scripts`, so all postinstall steps were skipped. Two are
  known to be required: `prisma generate`, and building the workspace packages
  (`@unite-group/control-module`, `@unite-group/brand-config`) whose absence produced TS2307.
  `gate2.sh` runs both. Others may still surface.
- **R7** — Exit codes read through a pipe report the last command, not the one that matters.
  The first runner logged `prisma-generate-exit=0` while prisma had actually crashed, because
  the code came from `tail`. `gate2.sh` captures `$?` directly. Per [[exit-code-readout-traps]].

## 10. Handoff quality check

- Tests claimed passed? **No.** The one type-check that ran returned exit 2 against a damaged
  tree and is recorded as void, not as a result.
- Anything claimed shipped? Only the `.gitignore` + handoff commits, all verified in `git log`.
- Process claimed running? Task `buwh1dv53`, verified by tool result; PID 4588 verified via
  `wmic` before it exited 0 at 10:56:55.
- Completed vs deferred separated? Yes (§1, §7).
- First command given? Yes (§8).

---

Handoff complete. Next safe action: read `<scratchpad>/gate2.log`, confirm `integrity-missing=0`,
then act on the gate result.
