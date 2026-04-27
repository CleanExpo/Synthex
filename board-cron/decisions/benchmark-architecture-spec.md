# Sprint 9 Benchmark Layer — Architecture Spec

**Linear:** SYN-776 (parent: SYN-773 — Session 44 board decision)
**Author:** board-cron
**Status:** Draft for Session 45 review
**Date:** 25/04/2026
**Consumers:** `/benchmark` (SYN-779, PR #87), AI Advisor Edge Function, post attribution footer

---

## 1. Problem

`/benchmark` (live, SYN-779) currently computes claims at request time from `lib/analytics/public-benchmarks.ts` against the live cohort with a 10-minute revalidate window and a hard floor of 25 active accounts. There is no industry segmentation, no regional segmentation, no confidence interval, no historical window, and no provenance trail. Every render recomputes from raw `Post`/`PlatformMetrics` rows.

Sprint 9 needs a queryable, sourced, gated benchmark layer that:

- segments by `industry` (and later `industry × state`)
- carries percentile distributions (p25 / p50 / p75) so the advisor can say "top X%"
- is refreshed on a fixed cadence (weekly), not per-request
- gates publication on minimum sample size and signal freshness
- exposes a stable read API to the public landing page, the authed advisor, and the post attribution footer

This is **not** a Network Score (SYN-780). Network Score is the compounding cross-client signal layer; this spec is the public-facing, anonymised benchmark cohort layer that feeds it.

---

## 2. `industry_benchmarks` schema

Postgres materialized view, refreshed weekly. Columns chosen to match the SYN-776 done-criteria exactly, with the SYN-779 confidence-interval columns layered in.

```sql
CREATE MATERIALIZED VIEW industry_benchmarks AS
SELECT
  cpp.industry                                 AS industry,
  cpp.state                                    AS state,            -- NULL until Phase 2 (industry-only at launch)
  COUNT(DISTINCT cpp.user_id)                  AS client_count,
  AVG(cpp.engagement_rate)::numeric(6,4)       AS avg_engagement_rate,
  AVG(cpp.post_frequency_per_week)::numeric(6,2) AS avg_post_frequency,
  AVG(cpp.content_consistency_score)::numeric(6,2) AS avg_content_consistency_score,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY cpp.engagement_rate)::numeric(6,4) AS p25_engagement,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY cpp.engagement_rate)::numeric(6,4) AS p50_engagement,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY cpp.engagement_rate)::numeric(6,4) AS p75_engagement,
  -- 95% CI on the mean engagement rate (Welch approximation, weekly refresh)
  GREATEST(
    AVG(cpp.engagement_rate) - 1.96 * (STDDEV_SAMP(cpp.engagement_rate) / SQRT(NULLIF(COUNT(*),0))),
    0
  )::numeric(6,4)                              AS ci_low,
  (AVG(cpp.engagement_rate) + 1.96 * (STDDEV_SAMP(cpp.engagement_rate) / SQRT(NULLIF(COUNT(*),0))))::numeric(6,4) AS ci_high,
  date_trunc('week', NOW())::date              AS period_week,
  NOW() - INTERVAL '90 days'                   AS source_window_start,
  NOW()                                        AS source_window_end,
  NOW()                                        AS refreshed_at,
  NULL::jsonb                                  AS competitor_context  -- Sprint 10 Phase 2 extension point (always NULL at launch)
FROM content_performance_profiles cpp
JOIN users u ON u.id = cpp.user_id
WHERE u.is_test_account = FALSE
  AND u.deleted_at IS NULL
  AND u.benchmark_opt_out = FALSE
  AND cpp.last_post_at >= NOW() - INTERVAL '90 days'
GROUP BY cpp.industry, cpp.state;

CREATE UNIQUE INDEX industry_benchmarks_pk
  ON industry_benchmarks (industry, COALESCE(state, ''), period_week);
CREATE INDEX industry_benchmarks_industry_idx ON industry_benchmarks (industry);
```

**Refresh cadence.** `pg_cron` job, Sunday 23:00 AEDT:

```sql
SELECT cron.schedule(
  'industry_benchmarks_weekly',
  '0 23 * * 0',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY industry_benchmarks; $$
);
```

`CONCURRENTLY` requires the unique index above and keeps the view readable mid-refresh. Conflict resolution is implicit: the materialized view fully replaces its rows on `REFRESH`, so `(industry, state, period_week)` is recomputed atomically each Sunday.

**`competitor_context jsonb DEFAULT NULL`** is included at launch as a column with a NULL value on every row. Sprint 10 extends the aggregation `SELECT` to populate it; no schema migration required at that point.

---

## 3. Source signals per metric

| Metric                          | Source                                                   | Notes                                               |
| ------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `avg_engagement_rate`           | `content_performance_profiles.engagement_rate`           | Per-platform rolled to per-account before AVG       |
| `p25 / p50 / p75 engagement`    | same                                                     | `percentile_cont` over per-account values           |
| `avg_post_frequency`            | `content_performance_profiles.post_frequency_per_week`   | Computed nightly by SYN-725 CVML view               |
| `avg_content_consistency_score` | `content_performance_profiles.content_consistency_score` | 0–100, smoothed over rolling 30 days                |
| GBP review velocity (Phase 2)   | `platform_posts` where `platform = 'google'`             | Reviews/week per industry — adds in v2              |
| Lead conversion rate (Phase 2)  | `Lead` (SYN-794) joined to attribution (SYN-795)         | Gated on Lead model adoption ≥ 10 accounts/industry |

Sprint 9 launches with the four columns the ticket specifies. Lead conversion and GBP review velocity are deferred to v2 because their underlying data does not yet meet sample-size gates.

---

## 4. Computation pipeline

```
┌─────────────────────────┐    nightly     ┌──────────────────────────────┐
│ Post / PlatformMetrics  │ ─────────────▶ │ content_performance_profiles │   (SYN-725 CVML view, exists)
└─────────────────────────┘                └──────────────┬───────────────┘
                                                          │ weekly (Sun 23:00 AEDT)
                                                          ▼
                                               ┌────────────────────────┐
                                               │  industry_benchmarks   │   (this spec)
                                               └──────────┬─────────────┘
                                                          │
                       ┌──────────────────────┬───────────┴────────────┬───────────────────────────┐
                       ▼                      ▼                        ▼                           ▼
              GET /api/analytics/    public_benchmarks.ts      AI Advisor Edge Fn         post attribution footer
                  benchmarks         (SSR /benchmark page)     (4th context block)         (SYN-795 hand-off)
```

Aggregation rules:

- per-industry, per-state (state NULL at launch — Phase 2 unlocks state segmentation when each `industry × state` cell hits n ≥ 10)
- opt-in only (`users.benchmark_opt_out = FALSE`)
- test accounts and soft-deleted accounts excluded
- 90-day rolling window for source data
- a per-account row contributes once per cohort (no platform-double-counting)

---

## 5. Gating logic

Single SQL function, called by every consumer before a row is rendered:

```sql
CREATE OR REPLACE FUNCTION should_show_benchmark_row(
  p_client_id  uuid,
  p_industry   text,
  p_state      text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_count             int;
  v_advisor_open_rate numeric;
BEGIN
  SELECT client_count INTO v_count
  FROM industry_benchmarks
  WHERE industry = p_industry
    AND COALESCE(state, '') = COALESCE(p_state, '')
    AND period_week = date_trunc('week', NOW())::date;

  IF v_count IS NULL OR v_count < 10 THEN
    RETURN FALSE;
  END IF;

  -- Advisor brief open rate, 4-week rolling, from CVML view events
  SELECT COALESCE(AVG(open_rate), 0) INTO v_advisor_open_rate
  FROM cvml_feature_engagement
  WHERE feature = 'advisor_brief'
    AND event = 'view'
    AND user_id = p_client_id
    AND occurred_at >= NOW() - INTERVAL '28 days';

  IF v_advisor_open_rate < 0.20 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;
```

**Gates.**

1. `client_count ≥ 10` for the `(industry, state, period_week)` cell.
2. Advisor brief open rate `≥ 20%` over the trailing 4 weeks (CVML `view` event on `advisor_brief` feature) — earned-attention gate per Session 44.
3. Freshness: `period_week >= date_trunc('week', NOW() - INTERVAL '14 days')` (no benchmark older than 14 days is shown).

**Failed-gate fallback (progressive unlock).**

- Below `n = 10`: show enrollment count display — _"7 of 10 plumbing businesses enrolled — benchmark data coming soon."_ This is the social-proof framing called out in the ticket.
- Advisor open rate below threshold: show generic industry copy without percentile claims (the user has not earned the personalised view yet).
- Stale data: hide the row entirely; do not fall back to a cached number older than 14 days.

---

## 6. API surface

**Existing — `GET /api/analytics/benchmarks` (`app/api/analytics/benchmarks/route.ts:26`).** Today this route is authed (`getUserIdFromRequestOrCookies`), reads the user's own platform connections, computes per-platform metrics, and calls `BenchmarkService.generateReport()` with hard-coded industry averages baked into `lib/analytics/benchmark-service.ts`. It does **not** read from any benchmark table.

**Sprint 9 extension.** Same route, same auth, additive query params:

```
GET /api/analytics/benchmarks?platform=all&period=30d&industry=plumbing&state=NSW
```

Behaviour change: when `industry` is supplied, the service queries `industry_benchmarks` (via a thin Prisma raw query, the view is not modelled in Prisma) instead of the hard-coded constants, runs the `should_show_benchmark_row` gate for the calling user, and either returns the percentile row or the fallback enrollment payload. Response shape adds a `gating` block:

```jsonc
{
  "success": true,
  "data": { "overall": {...}, "byPlatform": [...], "industryRow": { "p25": ..., "p50": ..., "p75": ..., "yourPercentile": 78 } },
  "gating": { "shown": true, "reason": null, "clientCount": 14, "periodWeek": "2026-04-19" }
}
```

**Public route — `/benchmark` (SYN-779, PR #87).** Stays a Server Component. `lib/analytics/public-benchmarks.ts` is extended to read aggregate rows from `industry_benchmarks` instead of recomputing live, but only the cohort-wide aggregates (no industry breakdown on the public page). The 25-account floor stays in addition to the new view-level gating.

**No new public endpoint.** The view is read server-side only. There is no `GET /api/public/industry-benchmarks` because individual industry cells could be probed to deanonymise small cohorts.

---

## 7. Cache + freshness

| Layer                       | Strategy                               | TTL                |
| --------------------------- | -------------------------------------- | ------------------ |
| `industry_benchmarks` view  | Refreshed weekly (Sun 23:00 AEDT)      | 7 days             |
| `/benchmark` page           | Next.js `revalidate = 600`             | 10 min             |
| `/api/analytics/benchmarks` | No HTTP cache (authed, per-user)       | request-time       |
| AI Advisor context block    | In-memory per Edge Function cold start | until next refresh |

The view itself is the cache. We do not layer Redis on top: Postgres serves a materialized-view read in single-digit ms, and the data only changes weekly.

---

## 8. Privacy + sample-size protection

- Hard `client_count ≥ 10` gate enforces k-anonymity at k = 10 per published cell.
- `users.benchmark_opt_out` honoured at view-build time, not at read time, so opted-out accounts never enter the aggregation.
- Test accounts (`is_test_account = TRUE`) and soft-deleted accounts excluded.
- The view exposes only aggregates and percentiles. No individual `user_id`, `post_id`, or `connection_id` ever leaves the aggregation layer.
- Public `/benchmark` page never receives the industry breakdown — it sees cohort-wide rows only.
- `/api/analytics/benchmarks` returns the percentile row only to the calling user, gated on advisor engagement (gate #2).
- AI Advisor context injection: industry row is included only when `should_show_benchmark_row(client_id, industry, state)` returns true.

---

## 9. AI Advisor context injection

Fourth context block, injected after the Algorithm KB block:

```
[INDUSTRY BENCHMARK — week of {period_week}]
Industry: {industry}{state ? ", " + state : ""}
Cohort size: {client_count} active Synthex clients
Engagement rate (cohort): p25 {p25_engagement} | p50 {p50_engagement} | p75 {p75_engagement}
Avg posts/week (cohort): {avg_post_frequency}
Avg content consistency (cohort): {avg_content_consistency_score}/100
Your client's engagement rate: {client_engagement_rate}
Your client's percentile: {client_percentile}
```

If the gate returns false, this block is replaced by:

```
[INDUSTRY BENCHMARK — unavailable]
Reason: {n<10 | advisor_open_rate<0.20 | stale}
Do not cite percentile claims for this client this week.
```

---

## 10. Progressive unlock UI component

| Gate state     | Component                | Copy                                                                                                                | CVML event                 |
| -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Unlocked       | `<BenchmarkRow />`       | _"You are in the top X% of {industry} businesses{state ? " in " + state : ""} for content consistency this month."_ | `interact` on click/expand |
| n < 10         | `<EnrollmentRow />`      | _"{client_count} of 10 {industry} businesses enrolled — benchmark data coming soon."_                               | `view` on render           |
| Open-rate gate | `<GenericIndustryRow />` | Industry-level copy without percentile claim                                                                        | `view` on render           |
| Stale          | (hidden)                 | —                                                                                                                   | none                       |

CVML events fire through the existing `lib/analytics/cvml.ts` client. The `interact` event payload includes `{ feature: 'benchmark_row', industry, state, percentile_bucket }`.

---

## 11. Dependencies

| Issue   | Relationship                                                                               |
| ------- | ------------------------------------------------------------------------------------------ |
| SYN-725 | `content_performance_profiles` view — **required upstream** for source data                |
| SYN-794 | `Lead` model — **deferred**, lights up GBP review velocity + lead conversion in v2         |
| SYN-795 | Attribution — **deferred**, joins to `Lead` for the v2 conversion metric                   |
| SYN-779 | Public `/benchmark` page (PR #87, shipped) — **consumer**, extended to read from this view |
| SYN-780 | Network Score — **parallel layer**, see § 12                                               |
| SYN-773 | Parent (Session 44 board decision) — authority for this spec                               |

---

## 12. Relationship to SYN-780 (Network Score)

Two layers, distinct purposes, same source-of-truth.

| Layer                                 | Audience         | Granularity                    | Refresh | Privacy gate                    |
| ------------------------------------- | ---------------- | ------------------------------ | ------- | ------------------------------- |
| **`industry_benchmarks`** (this spec) | Public + advisor | Per industry (per state in v2) | Weekly  | n ≥ 10 per cell                 |
| **Network Score** (SYN-780)           | Authed client    | Per-client compounding signal  | Daily   | Per-account; no cohort exposure |

The advisor uses both: industry benchmarks anchor the _"compared to peers"_ claim; Network Score anchors the _"your trajectory"_ claim. They never overlap in a single sentence to the client. SYN-780 may read `industry_benchmarks` to scale its compounding factor, but the reverse is forbidden — Network Score data must not flow into the public benchmark cohort.

---

## 13. Phased rollout

**v1 (Sprint 9 launch).** 4 metrics × 5 industries (plumbing, electrical, landscaping, cleaning, mould remediation) × no state segmentation. Placeholder fallback wherever `n < 10`. `competitor_context` column present, NULL.

**v2 (Sprint 10).** `industry × state` cells unlock when `n ≥ 10`. `competitor_context` populated by SYN-784. Adds GBP review velocity and Lead conversion (gated on SYN-794 adoption).

**v3 (Sprint 11+).** Real-time refresh via logical replication from `content_performance_profiles` to `industry_benchmarks_live` (separate view, kept side-by-side). Weekly view stays as the public source-of-truth; live view feeds advisor only.

---

## 14. Done criteria

- [ ] `industry_benchmarks` materialized view created with all columns from § 2 (including `competitor_context jsonb DEFAULT NULL`)
- [ ] Unique index on `(industry, COALESCE(state, ''), period_week)` for `REFRESH … CONCURRENTLY`
- [ ] `pg_cron` job `industry_benchmarks_weekly` scheduled for Sunday 23:00 AEDT
- [ ] `should_show_benchmark_row(client_id, industry, state)` function deployed with all three gates (n ≥ 10, advisor open rate ≥ 20%, freshness ≤ 14 days)
- [ ] Fallback enrollment-count component shipped with social-proof copy
- [ ] AI Advisor Edge Function injects industry benchmark block as 4th context block, with gate-aware fallback copy
- [ ] CVML `interact` event fires when client clicks/expands benchmark row
- [ ] `GET /api/analytics/benchmarks` extended with `industry` and `state` query params and `gating` response block
- [ ] `/benchmark` Server Component reads from `industry_benchmarks` (cohort aggregates only)
- [ ] `users.benchmark_opt_out` boolean enforced in view source query
- [ ] Spec reviewed and accepted at Session 45

---

## 15. Open questions

- `<TBD>` Phill — confirm Sunday 23:00 AEDT refresh window (low-traffic, but verify against scheduled-report cron at 22:00 AEST so they don't contend)
- `<TBD>` architect — should `competitor_context` carry a JSON schema version tag from day one to make Sprint 10 backfill cleaner?
- `<TBD>` Phill — is the 20% advisor-open-rate gate too strict for new accounts in their first 14 days? Proposal: bypass gate #2 for accounts younger than 14 days
- `<TBD>` architect — when `n = 9` for `industry × state` but `n = 30` for `industry`, do we silently fall back to industry-only or surface the granularity loss to the advisor?
- `<TBD>` Phill — opt-out UX: where does `benchmark_opt_out` live in settings, and do we need an org-level toggle in addition to the user-level one?
- `<TBD>` architect — confirm `cvml_feature_engagement` table/view name (gating function references it; the SYN-725 CVML view may expose it under a different name)
