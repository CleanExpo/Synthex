# Innovation Hypothesis — Cross-Client Benchmark Intelligence Layer

**Status:** Draft for CEO review — structural skeleton, prose to be edited by Phill McGurk.
**Authored:** 2026-04-25
**Linear:** SYN-774
**Template:** `board-cron/templates/innovation-hypothesis.md` (SYN-755)
**Provenance:** Session 44 (2026-04-20) — Innovation R11.

---

## 1. `innovation_hypothesis_id`

`SYN-774-cross-client-benchmark-intelligence-layer`

## 2. `parent_issue`

`SYN-773` — Board memo authorising R11 (link to be confirmed against Session 44 record).
Related: `SYN-775` (downstream consumer — benchmark surfacing in Synthex Effect Report).

## 3. `innovation_title`

Cross-Client Benchmark Intelligence Layer — anonymised aggregation of performance signals across all Synthex client accounts to produce industry-relative benchmarks.

## 4. `innovation_category`

**Intelligence Infrastructure** — the layer is a foundation that multiple client-facing features depend on (Effect Report context, AI Advisor recommendations, Content Score normalisation).

> Note for Phill: Session 44 framed this as a "Compounding Data Asset". The template enum does not include that label. Closest fit is **Intelligence Infrastructure**. If the board prefers, a new enum value can be added via amendment to `innovation-hypothesis.md` — flagged for `<TBD by Phill>`.

## 5. `rpc_delta_metric`

`+AU$8/client/month within 90 days of full rollout`, attributable to retention lift from clients who view a benchmark badge ("you are in the top 25% of plumbers in VIC for review velocity") at least once per fortnight.

## 6. `success_threshold_aud`

`8` (AU$8 per client per month). Conservative — pricing power, not new revenue, is the primary lever.

## 7. `measurement_window_days`

`90`

## 8. `baseline_state`

Plain-English baseline (SQL to be authored once `client_engagement_events` schema for benchmark surfaces lands):

> As of 2026-04-25, zero of 21 active clients are exposed to any cross-client benchmark surface. Industry-relative framing in the Synthex Effect Report is currently absent — all metrics are presented in absolute terms only. Average client tenure is 4.1 months (source: `organizations.created_at`, snapshot 2026-04-25).

`<TBD by Phill>` — confirm tenure number against live data before lock-in.

## 9. `ship_preconditions`

```yaml
ship_preconditions:
  - SYN-773 # Board authorisation memo (Session 44 R11)
  - <TBD> # Anonymisation pipeline — k-anonymity ≥ 5 per industry/geo bucket
  - <TBD> # Minimum N = 15 active clients per industry-geo bucket before any benchmark surfaces
  - <TBD> # Opt-in coverage ≥ 80% of active clients (privacy gate)
  - <TBD> # GA4 integration baseline — at least 60% of active clients connected
  - SYN-775 # Effect Report consumer surface
```

`<TBD by Phill>` — assign Linear issue IDs to the four placeholder rows.

## 10. `sunset_trigger`

If, at the 90-day gate:

- Fewer than 60% of active clients have engaged with a benchmark surface at least once, **or**
- Cohort retention delta between benchmark-exposed clients and a holdout group is < 1 percentage point at 60 days, **or**
- Privacy incident count > 0 (any re-identification event, however minor),

then sunset the layer and repurpose the aggregation engine as an internal-only analyst tool (no client-facing surface).

---

## Hard prerequisites (expanded)

| Prerequisite                             | Threshold                               | Why it matters                                     |
| ---------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| Anonymised client count per bucket       | N ≥ 15                                  | Prevents single-client identification by inference |
| Opt-in coverage                          | ≥ 80% of active clients                 | Avoids selection bias in the benchmark itself      |
| GA4 integration baseline                 | ≥ 60% of active clients connected       | Without GA4, benchmarks are platform-metric-only   |
| k-anonymity                              | k ≥ 5 per industry × geo × month bucket | Privacy floor                                      |
| Cell suppression rule                    | Suppress any cell where N < 15 or k < 5 | Prevents leakage at the long-tail bucket level     |
| Australian Privacy Principles compliance | APP 6, APP 11 review signed off         | Legal gate — non-negotiable                        |

## Outcomes already inferred

- **Session 44 R11 (2026-04-20)** — established the layer as an Innovation Outcome Register entry, category Compounding Data Asset.
- **SYN-773** — board memo authorising the work.
- **SYN-775** — first downstream consumer (Synthex Effect Report benchmark badge).
- **Adjacent:** SYN-639 (Effect Report spec) already names "industry comparison" as a deferred section.

## Cost ceiling

| Bucket                             | Estimate                          |
| ---------------------------------- | --------------------------------- |
| Engineering (build + test)         | 18 person-days                    |
| AI compute (aggregation + scoring) | AU$120/month at 21 clients        |
| Storage (anonymised rollups)       | < AU$10/month for first 12 months |
| Privacy review (external)          | AU$2,400 one-off                  |
| **Total first-year cost ceiling**  | **AU$8,000**                      |

Trigger a cost review if any line exceeds estimate by 25%.

## First measurable signal

**Week 2 after ship:** at least one client opens an Effect Report containing a benchmark badge AND scrolls past it without dismissing. Tracked via a new event `benchmark_surface_viewed` on `client_engagement_events`. If this signal does not fire for any client by end of Week 2, the layer is shipped but unused — escalate immediately rather than waiting for the 90-day gate.

---

## Optional: `contrarian_dissent`

`<TBD by Phill>` — strongest objection from Session 44 to be transcribed here for post-hoc bias review.

## Optional: `linked_evidence`

`<TBD by Phill>` — Gong calls, customer emails, or dashboard screenshots from Session 44 that informed R11.

---

## `PENDING_SYN_734` — outcome computation stub

```yaml
ninety_day_actual:
  measured_at: null
  actual_aud: null
  source_sql: null
sunset_status:
  state: null
  decision_session: null
  decision_url: null
```

Backfilled automatically once SYN-734 ships.
