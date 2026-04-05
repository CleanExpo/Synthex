# CRITICAL PATH — Synthex Foundations

**Last Verified:** 2026-04-05
**Next Build Verification Session:** Session 37

> **Correction (2026-04-05):** Initial document incorrectly showed 2/8 foundations done. All 8 have since been verified as Done or In Review.

---

## Build Status Checklist

| #   | Issue   | Title                             | Status                          | Est. Days |
| --- | ------- | --------------------------------- | ------------------------------- | --------- |
| 1   | SYN-589 | Content Performance Profiles      | **DONE** (2026-03-31)           | 3 days    |
| 2   | SYN-583 | ROI Attribution Engine            | **DONE** (2026-03-31)           | 4 days    |
| 3   | SYN-626 | Multi-Touch Attribution Dashboard | **DONE** (2026-04-02, PR #24)   | 2 days    |
| 4   | SYN-652 | ModelRouter 3-tier routing        | **DONE** (merged PR #32)        | 1 day     |
| 5   | SYN-669 | Score Validation Framework        | **DONE** (2026-04-04, PR #38)   | 2 days    |
| 6   | SYN-668 | createEdgeFunctionRunner          | **DONE** (2026-04-04)           | 1 day     |
| 7   | SYN-670 | Knowledge Graph Inference         | **DONE** (2026-04-04)           | 2 days    |
| 8   | SYN-687 | ClientContext unified layer       | **In Review** (PR #54)          | 2 days    |

**Foundations Done: 7 / 8 (SYN-687 In Review)**

---

## (a) Top 8 Unbuilt Foundational Issues — Dependency Order

```
SYN-589 → SYN-583 → SYN-626 → SYN-652 → SYN-669 → SYN-668 → SYN-670 → SYN-687 (ClientContext)
```

Build this sequence top-to-bottom. Each issue unlocks the next tier of features.

---

## (b) Dependency Map — Which Issues Block Which

| Issue   | Title                               | Blocks                             |
| ------- | ----------------------------------- | ---------------------------------- |
| SYN-589 | Content Performance Profiles        | SYN-622, SYN-631, SYN-681          |
| SYN-583 | ROI Attribution Engine              | SYN-622, SYN-626                   |
| SYN-626 | Multi-Touch Attribution Dashboard   | SYN-622                            |
| SYN-652 | ModelRouter 3-tier routing ✅ DONE  | SYN-681, SYN-682                   |
| SYN-669 | Score Validation Framework          | SYN-681                            |
| SYN-668 | createEdgeFunctionRunner            | SYN-681                            |
| SYN-670 | Knowledge Graph Inference           | SYN-650                            |
| SYN-687 | ClientContext unified layer ✅ DONE | SYN-681, SYN-682, SYN-674, SYN-611 |

### Downstream Issues (blocked — do not start until blockers are Done)

- **SYN-622** — blocked by SYN-589 + SYN-583 + SYN-626
- **SYN-631** — blocked by SYN-589
- **SYN-650** — blocked by SYN-670
- **SYN-681** — blocked by SYN-589 + SYN-652 + SYN-669 + SYN-668 + SYN-687
- **SYN-682** — blocked by SYN-652 + SYN-687
- **SYN-674** — blocked by SYN-687
- **SYN-611** — blocked by SYN-687

---

## (c) Build Days Per Issue

| Issue   | Est. Build Days | Cumulative |
| ------- | --------------- | ---------- |
| SYN-589 | 3 days          | 3 days     |
| SYN-583 | 4 days          | 7 days     |
| SYN-626 | 2 days          | 9 days     |
| SYN-652 | 1 day (DONE)    | 10 days    |
| SYN-669 | 2 days          | 12 days    |
| SYN-668 | 1 day           | 13 days    |
| SYN-670 | 2 days          | 15 days    |
| SYN-687 | 2 days (DONE)   | 17 days    |

**Total estimated build time (remaining):** 12 days (SYN-652 and SYN-687 already done)

---

## (d) "Do Not Start X Until Y is Done" Constraints

| Do NOT start                                  | Until these are Done                                    |
| --------------------------------------------- | ------------------------------------------------------- |
| SYN-626                                       | SYN-583                                                 |
| SYN-622                                       | SYN-589 AND SYN-583 AND SYN-626                         |
| SYN-631                                       | SYN-589                                                 |
| SYN-650                                       | SYN-670                                                 |
| SYN-681                                       | SYN-589 AND SYN-652 AND SYN-669 AND SYN-668 AND SYN-687 |
| SYN-682                                       | SYN-652 AND SYN-687                                     |
| SYN-674                                       | SYN-687                                                 |
| SYN-611                                       | SYN-687                                                 |
| **Any new feature (not in foundations list)** | **5 / 8 foundations are Done**                          |

---

## (e) Board Build Governance Protocol

### Build Verification Sessions

**Sessions 37, 41, and 45** are designated Build Verification Sessions.

At each Build Verification Session:

1. Update the **Last Verified** date at the top of this file
2. Update the **Build Status Checklist** above — mark each foundation as Done or Not Started
3. Update the **Foundations Done** count
4. Enforce the **5/8 gate** (see below)

### 5/8 Foundation Gate

> **New features cannot be started until 5 out of 8 foundations are Done.**

When 5/8 are Done, unblock the new features backlog. Until then, all sprint capacity goes to foundations.

### Session Log

| Session  | Date Verified | Foundations Done         | Gate Status          |
| -------- | ------------- | ------------------------ | -------------------- |
| (pre-37) | 2026-04-05    | 7 / 8 (SYN-687 In Review) | OPEN — gate cleared (5/8 met) |
| 37       | —             | —                        | —                    |
| 41       | —             | —                        | —                    |
| 45       | —             | —                        | —                    |

---

## Quick Reference — Current Blockers Summary

To unblock **SYN-681** (the most blocked downstream issue), you need all of:

- SYN-589 (Content Performance Profiles) — 3 days
- SYN-669 (Score Validation Framework) — 2 days
- SYN-668 (createEdgeFunctionRunner) — 1 day
- SYN-652 ✅ DONE
- SYN-687 ✅ DONE

**Recommended build order to unblock SYN-681 fastest:**

1. SYN-668 (1 day — quickest win)
2. SYN-669 (2 days)
3. SYN-589 (3 days)
4. SYN-681 now unblocked

---

_This file is updated at Build Verification Sessions (37, 41, 45). Do not edit between sessions without team sign-off._
