# Innovation Hypothesis — Registration Template

**Task reference:** SYN-755 (Session 40 Next Action 1) — Rotation 10 Innovation Governance Arc.

Every board-authored innovation decision memo at
`board-cron/decisions/innovation-*.md` must accompany a completed copy of this
template. The template is what lets the Session 40 Sunset Review mechanism
(via SYN-734's `innovation_outcomes` table, once live) score each innovation
against a pre-registered hypothesis rather than post-hoc narrative.

Copy this file into the decision memo or append it as a block. Every field
below is mandatory unless explicitly marked optional.

---

## Required fields

### 1. `innovation_hypothesis_id`

Slug format: `SYN-XXX-<kebab-case-slug>`. The `SYN-XXX` is the Linear issue
that introduced the innovation. The slug is a short, stable identifier used
in cross-references and in the `innovation_outcomes` table.

**Example:** `SYN-680-ask-synthex-anything`

### 2. `parent_issue`

The Linear issue identifier for the board decision memo that authorised this
innovation — typically a `[Board] Innovation & New Methods — YYYY-MM-DD`
issue.

**Example:** `SYN-680`

### 3. `innovation_title`

One-line human-readable title. Matches the top-level heading in the decision
memo.

**Example:** `Ask Synthex Anything — conversational intelligence interface`

### 4. `innovation_category`

Exactly one of:

- **Intelligence Infrastructure** — foundation layers that multiple client-
  facing features depend on. Examples: Knowledge Graph, Content Performance
  Profiles, Algorithm KB, score-accuracy ledger.
- **Client Outcome Attribution** — innovations whose value is measured in
  client-side business results. Examples: Multi-touch attribution, Content
  Score, GEO Score accuracy gates.
- **Conversational Interfaces** — innovations whose surface is a conversation
  the client drives. Examples: Ask Synthex Anything, AI Advisor push briefs,
  client-context-query.
- **Measurement Governance** — innovations that change how the project
  measures itself. Examples: `innovation_outcomes` table, `client_value_scorecard`
  materialised view, Sunset Review protocol, this very template.

### 5. `rpc_delta_metric`

Target Revenue-Per-Client delta and timeframe. Must name a specific
dollar-denominated KPI, a delta direction, and a measurement window.

**Example:** `+AU$12/client/month within 90 days of full rollout`

### 6. `success_threshold_aud`

Numeric AUD threshold. An `innovation_outcomes` row **cannot** be inserted
without this field populated — the Sunset Review mechanism uses this value
as the pass/fail gate at `measurement_window_days`.

**Example:** `12` (meaning AU$12 per client per month)

### 7. `measurement_window_days`

Integer ≥ 60. Default is 90. The 90-day clock starts when all
`ship_preconditions` reach Done in Linear, not when the innovation issue
itself is opened.

**Example:** `90`

### 8. `baseline_state` — **MANDATORY**

Either a Supabase SQL snippet that produces a single-row baseline snapshot,
or an independently verifiable plain-English observation with a date stamp.
The Sunset Review compares `ninety_day_actual` against this baseline.

**Example (SQL):**

```sql
-- baseline_state captured 2026-04-05
SELECT AVG(mrr_aud) AS baseline_mrr_per_client
FROM billing_accounts
WHERE status = 'active'
  AND measured_at = DATE '2026-04-05';
-- Result: 189.42
```

**Example (plain English):**

> As of 2026-04-05, zero of 21 active clients have used a conversational
> interface inside the Synthex dashboard. Daily dashboard session count
> averages 2.3 per client (source: `client_engagement_events` weekly
> rollup, week ending 2026-04-04).

### 9. `ship_preconditions`

Ordered list of SYN-XXX issues that must reach Done before the 90-day
measurement clock starts. If any precondition is missing, the innovation
is not considered shipped and the sunset clock has not started.

**Example:**

```yaml
ship_preconditions:
  - SYN-668 # createEdgeFunctionRunner factory (blocker)
  - SYN-681 # client-context-query Edge Function
  - SYN-682 # Ask Synthex UI in AI Advisor card
  - SYN-683 # 14-day internal review period complete
```

### 10. `sunset_trigger`

An explicit, measurable condition. If the Sunset Review at
`measurement_window_days` finds the trigger condition met, the innovation
is deprecated via the process in SYN-689.

**Example:** `If actual Revenue-Per-Client delta < AU$6/month (50% of the
success_threshold_aud) across 30 consecutive days after Week 8, sunset the
conversational interface and repurpose the engine as an internal-only
diagnostic tool.`

---

## Optional fields

- `contrarian_dissent` — one-paragraph summary of the strongest objection
  raised during the board session, for post-hoc bias review.
- `linked_evidence` — URLs to Gong calls, customer emails, or dashboard
  screenshots that contributed to the hypothesis.

---

## `PENDING_SYN_734` — outcome computation stub

This section is backfilled automatically once SYN-734 (the
`innovation_outcomes` table and extended `client_value_scorecard` view)
reaches Done. SLA: 14 days after SYN-734 ships, every hypothesis registered
up to that point is retrofitted with the fields below.

```yaml
# Backfilled by SYN-734 infrastructure
ninety_day_actual:
  measured_at: null # ISO date when the window closes
  actual_aud: null # numeric AUD delta observed
  source_sql: null # the view query that produced the value
sunset_status:
  state: null # one of: shipped | met-threshold | below-threshold | sunset | deprecated
  decision_session: null # Session number of the Sunset Review
  decision_url: null # board-cron/decisions/<session>.md
```

Until SYN-734 is Done, these fields remain `null` — this is expected and
documented behaviour.

---

## Governance anchor

This template is enforced by the CI soft-warning check in
`.github/workflows/dependency-check.yml` job `innovation-hypothesis-check`.
The check fires on PRs that touch `board-cron/decisions/innovation-*.md`
files and verifies the PR description references this template path.

Bypass (for retroactive or pre-template decisions only) is via the
`ci:hypothesis-exempt` PR label. Every use of the bypass is appended to
`board-cron/logs/innovation-hypothesis-compliance.jsonl`.
