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

## Phase 0 findings — 2026-09-03 (parked under rule 1; no campaign in flight needs these)

| #     | Finding                             | One line                                                                                               |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| P0.1  | Quality gate never fired            | No test under tests/; both runs 95/100. Needs a bad fixture before it counts as a gate.                |
| P0.2  | Done-contract verifiers missing     | scripts/verify/golden-path-live.ts + studio-client-config.mjs do not exist; they block g1/g4/g5/g6/g8. |
| P0.3  | No founder review packet format     | publishing-handoff.md is machine-facing (15 internal slugs); unreadable as a review surface.           |
| P0.4  | publish_authority unimplemented     | Directive language only; zero hits in any tree.                                                        |
| P0.5  | Studio avatar/voice IDs placeholder | HeyGen/ElevenLabs per-business IDs absent in production (g8).                                          |
| P0.6  | IMPLEMENTATION-STATUS.md falsified  | Claims Node v26.0.0; actual v24.14.1 vs "node":"22.x". Stale since 2026-05-16.                         |
| P0.7  | RichTextEditor dead code            | Orphaned component + @tiptap/\* runtime deps; in no bundle.                                            |
| P0.8  | Golden-path Done contract parked    | w_23150fa80a59 is publishing machinery; rule 2 defers it until a campaign in flight blocks on it.      |
| P0.9  | Dirty state of 3 worktrees unknown  | Worktree isolation blocks git -C; needs one non-isolated session to confirm nothing is at risk.        |
| P0.10 | Two failing launchd agents          | com.hermes.empire.cron-tick exit 126 (not executable), ai.hermes.gateway-dr exit 78.                   |
