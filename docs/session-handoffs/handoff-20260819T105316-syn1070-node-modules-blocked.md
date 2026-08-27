# Session Handoff — SYN-1070 node_modules install blocked by Windows Defender

**Date:** 2026-08-19T10:53  
**Branch:** `feat/campaign-concept-studio`  
**PR:** #902 (OPEN)  
**State:** WIP / BLOCKED

---

## 1. Summary

**Phase 0.5 state: WIP/BLOCKED**

This session diagnosed and attempted to resolve a broken node_modules install that was blocking the SYN-1070 gate (type-check → lint → test). All 18 SYN-1070 test fixes remain intact on the branch (committed in a prior session at 180dd31d5). The gate itself cannot run because node_modules is incomplete — Windows Defender holds file locks during npm install, causing ENOTEMPTY failures mid-installation.

**Definition-of-Done result:** FAIL

- Tests NOT run this session (node_modules incomplete; `next` not installed)
- type-check NOT run [UNCONFIRMED]
- lint NOT run [UNCONFIRMED]
- Tree is clean ✓
- PR #902 is open ✓ but not updated

---

## 2. Where it started

- Resumed from handoff `handoff-20260819T065914-syn1070-tests-fixed.md`
- Blocker B1 from that handoff: node_modules deleted to clear ENOTEMPTY locks; needed rebuild on CCS branch
- Blocker B2: type-check and lint unconfirmed
- Branch: `feat/campaign-concept-studio`, HEAD at `5dc1ffb1d`

---

## 3. Decisions locked + what shipped

**Decisions:**

- `npm ci --ignore-scripts` bypasses the `@unite-group/control-module` tsup prepare-script ordering failure (tsup not on PATH when npm runs the workspace prepare script)
- `node -e "require('fs').rmSync(...)"` + robocopy-empty-mirror is the correct delete pattern on Windows when `rm -rf` and `rename` are both EPERM-blocked
- `.npm-cache-clean/`, `.npm-cache-alt/`, `.tmp_control/` are Windows npm artifacts that land in the project root and must be gitignored, not committed

**Shipped (committed this session):**

| SHA         | Message                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `face337f2` | chore(SYN-1070): ignore stray npm cache dir from Windows install                                  |
| `cf2c144f4` | chore: ignore .tmp_control directory from contrarian review session ures (auto-committed by hook) |
| `d8d12379b` | chore: ignore .npm-cache-alt from npm install                                                     |

All three are `.gitignore`-only changes. No test code, no product code changed this session.

**Not shipped:** package.json was corrupted by an npm run (changed `@unite-group/control-module` from `github:CleanExpo/Unite-Group#control-module-v0.1.0` to `file:./.tmp_control`) and was **restored to HEAD** via `git restore package.json`. This is not committed as a change — it was a revert to the correct state.

---

## 4. Key files

| File                                                                   | Status               | Notes                                                         |
| ---------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| `.gitignore`                                                           | Modified + committed | Added `.npm-cache-clean/`, `.npm-cache-alt/`, `.tmp_control/` |
| `package.json`                                                         | Restored to HEAD     | npm corrupted it; reverted with `git restore`                 |
| `package-lock.json`                                                    | Restored to HEAD     | Partially modified by npm; reverted                           |
| `node_modules/`                                                        | Incomplete           | 1117 packages; `next` missing; `zod` present                  |
| `docs/session-handoffs/handoff-20260819T065914-syn1070-tests-fixed.md` | Read-only inspected  | Prior session handoff — starting point                        |

---

## 5. Running state

No dev server running. No background npm processes (PID 117001 was killed this session). npm ci and npm install both abort mid-way due to Windows Defender file locks.

---

## 6. Verification (commands for next session)

```bash
# 1. Confirm branch and clean tree
git branch --show-current   # expect: feat/campaign-concept-studio
git status --short           # expect: empty

# 2. Confirm node_modules is fully installed
node -e "require('next'); console.log('next ok')"
node -e "require('zod'); console.log('zod ok')"

# 3. Run the gate
npm run type-check && npm run lint && npm test

# 4. If gate passes, push and update PR
git push origin feat/campaign-concept-studio
gh pr view 902
```

Gate commands were NOT run this session. Node_modules is incomplete and will produce false type errors.

---

## 7. Deferred + open questions

**Deferred:**

| Item                                             | Owner                              | Blocking                        | Why                                                             |
| ------------------------------------------------ | ---------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Add D:\Synthex to Windows Defender exclusions    | Phill (human action required)      | YES — blocks all npm operations | Requires Windows Security UI; not doable from CLI without admin |
| `npm ci` to completion                           | Next agent (after exclusion added) | YES — blocks gate               | node_modules incomplete                                         |
| `npm run type-check && npm run lint && npm test` | Next agent                         | YES — blocks PR update          | Gate cannot run without valid node_modules                      |
| Push + update PR #902                            | Next agent                         | Yes                             | Awaits green gate                                               |

**Open questions:**

| Question                                                                             | Owner      | Blocking                                                                     |
| ------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------- |
| Does `stash@{0}` on CCS branch contain anything that should be committed?            | Phill      | No — stash is empty (git stash show returned nothing)                        |
| Does `@unite-group/control-module` tsup ordering failure affect CI (not just local)? | Next agent | Low — CI likely runs on Linux where tsup is available before prepare scripts |

---

## 8. Pick up here

**Do not redo:**

- Diagnosing the ENOTEMPTY root cause — it is Windows Defender, confirmed
- Adding the three gitignore entries — already committed
- Restoring package.json — already done

**Start here:**

1. **Phill does this first (no agent can do it):**  
   Windows Security → Virus & threat protection → Manage settings → Exclusions → Add an exclusion → Folder → `D:\Synthex`  
   Takes ~30 seconds. No admin required.

2. `git checkout feat/campaign-concept-studio` (already there, but confirm)

3. `npm ci`  
   Should complete cleanly with the Defender exclusion in place.

4. `node -e "require('next'); console.log('ok')"` — confirm node_modules complete

5. `npm run type-check && npm run lint && npm test`  
   Prior session confirmed exit 0 at 7928 tests on commit 180dd31d5. All 7 commits since then touched only .gitignore. The gate should be green.

6. On green: `git push origin feat/campaign-concept-studio` then review PR #902.

**First command to run:**  
After adding Defender exclusion → `npm ci`

---

## 9. Risk notes

- **[UNCONFIRMED]** type-check and lint. Prior session exit 0 at commit 18f0588d3. The 3 gitignore commits since then do not touch TypeScript — should still be green, but not proven.
- **[UNCONFIRMED]** npm ci will succeed after adding Defender exclusion. Tested behaviour: every npm install attempt hit ENOTEMPTY on a different package (axios, zod, d3-time). With Defender exclusion removed as the lock source, npm ci should work. Cannot verify without the exclusion set.
- **[VERIFIED]** The 18 SYN-1070 test fixes are intact at commit 180dd31d5. Not touched this session.
- **[VERIFIED]** package.json points to `github:CleanExpo/Unite-Group#control-module-v0.1.0` (confirmed via `git diff HEAD package.json` returning empty after restore).
- The `.tmp_control/` directory on disk cannot be deleted (EBUSY lock). It is gitignored. Windows will release the lock eventually and the directory can be deleted manually.

---

## 10. Handoff quality check

- [ ] Tests actually ran green — **NO** (node_modules incomplete; gate blocked)
- [x] Nothing claimed shipped without commit evidence
- [x] No running processes claimed without verification
- [x] Completed work separated from deferred work
- [x] First command for next agent is explicit

---

Handoff complete. Next safe action: Phill adds `D:\Synthex` to Windows Defender exclusions, then the next agent runs `npm ci` followed by the full gate.
