# Loop Backlog — Ordered Iteration List

> Each row is one loop = one session = one PR (or one human-unblock decision).
> Do not combine rows. Do not parallelise without worktree isolation verified.

## Phase A — Land the in-flight PRs

| #   | Linear  | Task                                                                                            | Depends on | Session budget |
| --- | ------- | ----------------------------------------------------------------------------------------------- | ---------- | -------------- |
| A.1 | SYN-794 | Review + merge [PR #86](https://github.com/CleanExpo/Synthex/pull/86) — Lead ground-truth model | —          | 30 min         |
| A.2 | SYN-779 | Review + merge [PR #87](https://github.com/CleanExpo/Synthex/pull/87) — benchmark page + footer | —          | 30 min         |
| A.3 | SYN-793 | Review + merge [PR #88](https://github.com/CleanExpo/Synthex/pull/88) — GA4Property model       | —          | 30 min         |

## Phase B — Attribution engine

| #   | Linear  | Task                                | Depends on       | Session budget           |
| --- | ------- | ----------------------------------- | ---------------- | ------------------------ |
| B.1 | SYN-795 | Real multi-touch attribution engine | A.1 + A.3 merged | 90 min (split if needed) |

## Phase C — Human-gated (cannot start a code loop until Phill clears)

| #   | Linear  | Unblock action                                                      |
| --- | ------- | ------------------------------------------------------------------- |
| C.1 | SYN-725 | Apply migration + pg_cron + Slack secret + dry-run                  |
| C.2 | SYN-734 | Dispatchable only after C.1 + 72h production soak                   |
| C.3 | SYN-573 | YouTube OAuth client in Vercel (HeyGen scope removed — see SYN-800) |
| C.4 | SYN-787 | AU GCP project                                                      |
| C.5 | SYN-788 | Same AU GCP project                                                 |

## Phase D — Strategy authoring (Phill-led, Claude assists)

| #   | Linear  | Task                                          |
| --- | ------- | --------------------------------------------- |
| D.1 | SYN-777 | Cross-Client Benchmark IOR table row          |
| D.2 | SYN-774 | IOR hypothesis — benchmark intelligence layer |
| D.3 | SYN-736 | Retrofit 5 innovations with hypotheses        |
| D.4 | SYN-735 | Monday scorecard innovation section           |
| D.5 | SYN-780 | Network Score architecture spec               |
| D.6 | SYN-776 | Sprint 9 benchmark layer architecture spec    |
