# SYN-731 — Journey Moments Slack Renderer Rules

**Version:** 1.0
**Status:** Active (effective from first scorecard post after merge)
**Deliverable of:** SYN-731
**Parent:** SYN-728 (Session 35 — Client Journey Optimization) · Meta-parent: SYN-767
**Authorised by:** [`cvml-journey-section-activation-gate-2026-04-25.md`](./cvml-journey-section-activation-gate-2026-04-25.md) (SYN-770)
**Implemented in:** [`scripts/cvml/build_and_post.py`](../../scripts/cvml/build_and_post.py) + [`.github/workflows/client-value-scorecard.yml`](../../.github/workflows/client-value-scorecard.yml)
**Tested in:** [`scripts/cvml/test_build_and_post.py`](../../scripts/cvml/test_build_and_post.py) (34 unit tests)

---

## 1. What This Document Pins

This is the canonical reference for what the Monday 09:00 AEDT CVML scorecard renders in its Journey Moments section, when a moment is flagged for Manual Review, and how the Manual Review subsection links to the Notion review template. Engineering may not change these rules without a corresponding Linear ticket and a CEO-acknowledged update to this file.

The rules below are the demand-side counterpart to the Session 34 Feature Engagement rules already pinned in [`cvml-journey-section-activation-gate-2026-04-25.md`](./cvml-journey-section-activation-gate-2026-04-25.md).

---

## 2. Renderer Behaviour (per row, per Monday post)

Each Journey Moment surfaces ONE row in the Slack post. The row contains:

| Element                  | Source                                                                          | Empty-state                              |
| ------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------- |
| Moment ID                | `client_value_scorecard.moment_id`                                              | Skip the row                             |
| Stage label              | `client_value_scorecard.journey_stage`                                          | `—`                                      |
| Action rate              | `act_within_72h_count / view_count` for current ISO week                        | `n/a`                                    |
| 4-week trend arrow       | Comparison of action rate at week-3 vs current week                             | `→` (with single value or no signal)     |
| Share rate               | `share_count / view_count` for current ISO week                                 | `n/a`                                    |
| Retention confidence tier | `retention_n` bucketing (see §3)                                                | `Insufficient Data (n<30)`               |
| Manual Review badge      | If both sunset conditions in §4 evaluate true                                   | Omitted                                  |

The ordering inside the section is alphabetical by `moment_id` to keep week-over-week diffs predictable for the human reader.

---

## 3. Confidence Tier Thresholds

| Tier                         | `retention_n` range | Notes                                                              |
| ---------------------------- | ------------------- | ------------------------------------------------------------------ |
| Insufficient Data (n<30)     | NULL or n < 30      | Default state for retrofitted moments at n=21 client cohort.       |
| Low Confidence (n=30–49)     | 30 ≤ n < 50         | Low-confidence band; sunset rule §4 condition (b) becomes eligible. |
| Confirmed (n≥50)             | n ≥ 50              | High-confidence band; signal is publishable.                        |

These match the SYN-679 retention correlation methodology referenced in the SYN-731 issue body. The `retention_correlation` / `retention_n` / `confidence_tier` columns on `client_value_scorecard` are NULL placeholders today (per [`20260504000001_syn730_client_value_scorecard_journey_moments.sql`](../../supabase/migrations/20260504000001_syn730_client_value_scorecard_journey_moments.sql)) until SYN-679 wires the active validation refresh function.

---

## 4. Modified Sunset Rule (Manual-Review Trigger)

A journey moment is flagged for Manual Review **only when ALL three of the following evaluate true**. Either condition (a) or (b) alone is **insufficient**.

| #   | Condition                                                                          | Source field                                       |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| a   | `action_rate < 0.10` for 4 consecutive weeks                                       | `consecutive_weeks_below_10pct ≥ 4`                |
| b   | `retention_correlation ≤ 0`                                                        | `retention_correlation`                            |
| c   | Confidence tier ≥ Low (`retention_n ≥ 30`)                                         | `retention_n`                                      |

**Rationale (preserved verbatim from SYN-731 §2):** "Either alone is insufficient." A weak action rate without a retention signal could be a measurement gap; a negative retention correlation without sustained low action could be cohort noise. Both must hold simultaneously and at credible sample size before manual attention is warranted.

---

## 5. 90-Day Manual-Review Grace Period

For the first 90 days of operation, **no auto-sunset action is taken**. Flagged moments are LISTED in the dedicated "Manual Review Required" subsection of the Slack post with a direct link to the Notion review template. Phill (or a delegated reviewer) makes the keep / variant-test / sunset call.

Day-zero reference for the 90-day window is the merge commit of SYN-731 on `main`. The exit criteria from the manual-only mode is a separate Linear ticket — this file does not auto-rollover.

---

## 6. Notion Review Template

The Manual Review subsection in the Slack post contains exactly one outbound link, to the Notion review template URL.

The template URL is read from the `NOTION_REVIEW_URL` environment variable at workflow runtime, with a placeholder fallback (`DEFAULT_NOTION_REVIEW_URL` in [`build_and_post.py`](../../scripts/cvml/build_and_post.py)). To swap to the real template URL, set the `NOTION_REVIEW_URL` repository secret on `CleanExpo/Synthex` so the GitHub Actions workflow can read it.

The Notion template MUST contain (per SYN-731 §2 done criteria):

- Moment ID
- Flagged reason (which sunset condition tripped, with values)
- Action rate trend (4-week visual)
- Retention correlation trend (when retention data is wired)
- Share rate
- Phill's decision: **Keep / Variant Test / Sunset**
- Rationale (free-text)

Authoring the Notion template is a manual founder action, not in the scope of this code-side ticket.

---

## 7. Out of Scope of This Document

The following responsibilities live elsewhere and are NOT pinned by this file:

- **First production post + manual review confirmation** (SYN-731 §4 done criteria) — operational gate; tracked separately when Sprint 6 Wk 2 lands.
- **Engagement contrarian gate Session 38 review** (SYN-731 §5) — reviewed at the Session 38 cadence; not a renderer concern.
- **Innovation Outcomes section** (SYN-735) — adds a third section below this one; rules pinned in its own decision doc when SYN-734 + SYN-735 land.
- **Feature Engagement rules** (SYN-725 baseline) — implemented in the same script but governed separately. Edits to feature rendering require a Session 34 amendment, not a Session 35 amendment.

---

## 8. Change Discipline

Changes to §2–§6 above require:

1. A Linear ticket scoping the change.
2. CEO-visible justification in the Linear ticket body.
3. Update of this file in the same PR that changes the renderer code.
4. A new dated decision doc when the change is large enough that the rules above are wholly superseded (versioning over editing).

Adding new fields to the Journey Moments row is permitted per-section in §2 with engineering judgment. Removing or reweighting the sunset conditions in §4 is a Session 35 amendment and requires CEO sign-off.
