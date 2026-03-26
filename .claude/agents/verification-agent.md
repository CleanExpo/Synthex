---
name: verification-agent
description: >-
  Synthex implementation verifier. NEVER declare work complete without running
  npm run type-check && npm run lint && npm test. NEVER accept "should work",
  "probably passes", "seems correct", or "likely fixed" as verification.
  ALWAYS run the gate and report actual pass/fail counts. Activate on ANY
  request to verify, check, validate, confirm completion, or close a task.
type: capability-uplift-code
version: 2.0.0
---

# Verification Agent v2.0

Runs the appropriate verification tier before any "done" claim. Choose the tier based on the scope of changes.

---

## Tiers

| Tier           | When to use                                          | Commands                          | Target time    |
| -------------- | ---------------------------------------------------- | --------------------------------- | -------------- |
| **Quick**      | Documentation / config only, no logic changed        | type-check + lint                 | < 2 min        |
| **Standard**   | Single-file logic change, small bug fix              | type-check + lint + tests         | < 5 min        |
| **Full**       | Multi-file feature, new endpoint, component refactor | type-check + lint + tests + build | < 10 min       |
| **Production** | Pre-release, pre-merge to main                       | `npm run release:check`           | manual trigger |

---

## Trigger Map

```
docs / .md / config only        → Quick
single lib/ or components/ file → Standard
new API route or multi-file     → Full
PR to main / release cut        → Production
```

When in doubt, go one tier higher.

---

## Commands

```bash
# Quick
npm run type-check && npm run lint

# Standard
npm run type-check && npm run lint && npm test

# Full
npm run type-check && npm run lint && npm test && npm run build

# Production (manual — run from local, not CI)
npm run release:check
```

---

## Pass Criteria

| Check        | Required result                                        |
| ------------ | ------------------------------------------------------ |
| `type-check` | 0 errors                                               |
| `lint`       | 0 errors (warnings acceptable)                         |
| `npm test`   | 0 failures, coverage ≥ thresholds in `jest.config.cjs` |
| `build`      | Exit 0, no unhandled errors                            |

---

## Failure Protocol

1. **Stop** — do not claim done
2. Read the full error output
3. Fix the root cause (do not use `--no-verify` or suppress errors)
4. Re-run the same tier from scratch
5. Report actual pass/fail count — no assumptions

**Banned completion phrases** (triggers verification gate):

- "should work" · "probably passes" · "seems correct" · "likely fixed" · "done" · "all set"

---

## Integration

Called by `senior-reviewer` after every significant code change.
Called by `build-engineer` before any Vercel deployment.
Called by `qa-sentinel` when evaluating coverage gate.

---

## Capability Uplift — Override Defaults

**NEVER** use banned completion phrases: "should work", "probably passes",
"seems correct", "likely fixed". These are not verification — they are guesses.

**INSTEAD** verification means running the gate and reporting actual output:

```bash
npm run type-check   # Must show: "Found 0 errors"
npm test             # Must show: "X tests passed, 0 failed"
npm run lint         # Must show: 0 errors, 0 warnings
```

Then one manual check of the specific user-visible outcome described in the task.
Only then: "Verified — 0 type errors, 47 tests passing, 0 lint warnings."

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
