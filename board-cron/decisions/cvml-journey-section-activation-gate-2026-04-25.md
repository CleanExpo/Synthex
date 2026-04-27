# CVML Journey Section Activation Gate

**Version:** 1.0 (draft for CEO sign-off)
**Status:** Draft — awaiting Phill approval
**Deliverable of:** SYN-770
**Parent:** SYN-728 · Meta-parent: SYN-767
**Authorises:** SYN-730 (materialised view extension) and SYN-731 (Slack scorecard renderer extension)
**Hard prereq:** SYN-725 in production

---

## 1. Gate Purpose

The CVML Journey Section Activation Gate is the measurable threshold that authorises engineering to begin SYN-730 and SYN-731. SYN-730 extends the `client_value_scorecard` materialised view with journey moment rollups; SYN-731 extends the Monday Slack scorecard with a Journey Moments section. Both JOIN against `client_value_scorecard` produced by SYN-725. Building either against a view that has only existed for a few days produces valid SQL but meaningless governance data — every row reads `Insufficient Data` and the rollup teaches nothing. Crossing the gate confirms the base CVML view has soaked long enough to make the journey JOIN informative. Failing the gate triggers a one-week delay and a re-check the following Monday; SYN-730 and SYN-731 stay in Backlog until PASS is recorded.

---

## 2. Quantitative Gate Criteria

All four criteria below MUST evaluate to PASS for the gate to open. Any single FAIL defers the gate.

| #   | Criterion                                | Threshold                                                                                                                                                                                             | Source of truth                                                                        |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | SYN-725 production soak                  | `client_value_scorecard` view live in production for ≥ 14 calendar days                                                                                                                               | Migration timestamp in `supabase/migrations/` + production deploy log                  |
| 2   | Consecutive clean Monday scorecard posts | ≥ 2 consecutive Monday 09:00 AEDT CVML scorecards posted without errors                                                                                                                               | `#synthex-journey-review` Slack channel post history                                   |
| 3   | Feature engagement coverage per post     | Non-null Feature Engagement rows for ≥ 18 of 21 active clients (≈ 86%) on each of the 2 qualifying posts                                                                                              | Slack post payload + `client_value_scorecard` row count for the relevant `iso_week`    |
| 4   | Journey CVML event flow                  | SYN-729 merged (journey context fields live in TS emitter) AND ≥ 1 row in `client_engagement_telemetry` where `journey_moment_id IS NOT NULL` for a Monthly Story or Personalisation Activation event | `SELECT COUNT(*) FROM client_engagement_telemetry WHERE journey_moment_id IS NOT NULL` |

**Notes on thresholds:**

- 18 / 21 clients (≈ 86%) is the "clean post" floor. Below this, the base view is not stable enough to anchor a JOIN.
- The 14-day SYN-725 production soak is a hard floor (see Section 7); the consecutive-Mondays criterion is the operational signal.
- Threshold 4 ensures the journey JOIN has at least one real row to attach to on Day 1 of SYN-730 build.

---

## 3. Failure Mode Handling

| Outcome                     | Trigger                                                                                    | Action                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PASS**                    | All 4 criteria met                                                                         | Phill or Marcus posts PASS notice in `#synthex-journey-review` (format in Section 5). SYN-730 and SYN-731 move to In Progress, assigned to Sprint 5 Week 3.                                                                                |
| **PARTIAL (≥ 80%, < 100%)** | 3 of 4 criteria met, OR criterion 3 lands at 17/21 (81%) on one of the two posts           | Phill manual override permitted. Phill posts: "CVML Journey gate: OVERRIDE PASS — \[criterion that missed\] at \[actual value\]. Risk accepted." Override is logged identically to a PASS, with `override: true` flag set in the JSON log. |
| **DEFER**                   | < 80% of criteria met OR criterion 1 (production soak) fails OR criterion 4 returns 0 rows | Post DEFER notice with reason. SYN-730 and SYN-731 stay in Backlog. Re-check next Monday.                                                                                                                                                  |

Override authority sits with Phill only. Engineering may not self-override.

---

## 4. Decision Date and Cadence

| Event                               | Date                                                         | Time       |
| ----------------------------------- | ------------------------------------------------------------ | ---------- |
| First gate check                    | 2026-04-27 (Monday — second CVML scorecard post per SYN-770) | 12:00 AEDT |
| Recurring gate check (if DEFER)     | Every Monday thereafter                                      | 12:00 AEDT |
| Latest acceptable PASS for Sprint 5 | 2026-05-04                                                   | 12:00 AEDT |

If the gate has not passed by 2026-05-04, the parent ticket SYN-728 is re-scoped at the next session review.

---

## 5. Decision Logging Format

Every gate evaluation — PASS, OVERRIDE PASS, or DEFER — is logged to `board-cron/logs/cvml-journey-gate-<YYYY-MM-DD>.json` and posted to `#synthex-journey-review`.

```json
{
  "check_date": "2026-04-27",
  "check_time_aedt": "12:00",
  "checker": "phill.mcgurk@unite-group.com",
  "gate_passed": true,
  "override": false,
  "criteria_met": [
    "syn_725_production_soak_days_14_or_more",
    "consecutive_clean_monday_posts_2",
    "feature_engagement_coverage_18_of_21",
    "journey_event_rows_present"
  ],
  "criteria_failed": [],
  "metrics": {
    "syn_725_soak_days": 17,
    "clean_post_count": 2,
    "client_coverage_post_1": "20/21",
    "client_coverage_post_2": "19/21",
    "journey_event_row_count": 4
  },
  "decision": "proceed",
  "next_check_date": null,
  "syn_730_start_date": "2026-04-28",
  "notes": ""
}
```

For DEFER, set `gate_passed: false`, `decision: "delay"`, populate `criteria_failed`, and set `next_check_date` to the next Monday.

---

## 6. Pre-Flight Checklist (run before each Monday gate check)

Engineering or Phill confirms each of the following before evaluating the gate:

- [ ] `client_value_scorecard` materialised view exists in production (`SELECT 1 FROM pg_matviews WHERE matviewname = 'client_value_scorecard'`)
- [ ] View was refreshed within the last 24 hours (`SELECT MAX(refreshed_at) FROM client_value_scorecard`)
- [ ] `.github/workflows/client-value-scorecard.yml` ran successfully on the most recent Monday (GitHub Actions run history shows green)
- [ ] Most recent CVML scorecard Slack post is visible in `#synthex-journey-review` and contains no error blocks
- [ ] SYN-729 merge status confirmed via Linear or GitHub
- [ ] One row from `client_engagement_telemetry` with `journey_moment_id IS NOT NULL` has been spot-queried

If any pre-flight item fails, the gate is automatically marked DEFER for that week — do not attempt evaluation against an unhealthy base.

---

## 7. Hard Dependency on SYN-725

SYN-725 (the `client_value_scorecard` materialised view and weekly Slack scorecard GitHub Action) is the foundation this gate evaluates. SYN-725 was completed 2026-04-24. The gate cannot evaluate to PASS until:

1. SYN-725 migration has been applied to the production Supabase project (not just preview branches), AND
2. The view has soaked in production for ≥ 14 calendar days, AND
3. The weekly GitHub Action has produced ≥ 2 consecutive successful Monday posts.

The 14-day floor exists because journey moment rollups computed against fewer than two weeks of feature engagement baseline cannot produce meaningful retention correlation values. The earliest mathematically valid PASS date is therefore 14 days after SYN-725 reached production. Any earlier PASS — including via override — is rejected by this spec.

---

## 8. What This Ticket Does Not Decide

This document defines the activation gate only. It does NOT decide:

- The schema of the `journey_moment_id` discriminator column on `client_value_scorecard` (owned by SYN-730)
- The `UNION ALL` shape, refresh cadence beyond inheriting SYN-725's, or the `retention_correlation` formula (owned by SYN-730)
- The Slack Block Kit layout for the Journey Moments section (owned by SYN-731)
- The kill-candidate rules for journey moments (owned by SYN-731)
- Any change to the SYN-725 base view (out of scope; protected by production soak)

Each of those scopes has its own ticket and its own review.

---

## 9. Approval

This document is a draft for Phill McGurk's sign-off. Phill confirms:

- [ ] The four quantitative criteria in Section 2 reflect the right risk tolerance
- [ ] The 18/21 (≈ 86%) clean-post coverage threshold is acceptable
- [ ] The 14-day production soak floor for SYN-725 is acceptable
- [ ] The Phill-only override pathway in Section 3 is correctly scoped
- [ ] The first gate check date of 2026-04-27 12:00 AEDT is locked

Once approved, this spec is added to `board-cron/SKILL.md` Stage 2 as the canonical Journey Section Activation Gate reference, and CLAUDE.md ACTIVE AUTOMATIONS is updated per SYN-770 done criteria.

---

**References:** SYN-725 (production prereq, Done 2026-04-24) · SYN-728 (parent) · SYN-729 (journey context fields) · SYN-730 (materialised view extension, gated) · SYN-731 (Slack scorecard extension, gated) · SYN-767 (meta-parent)
