# B5 — Dashboard Wiring

> **Status:** Scoping only (SYN-812). Implementation gated on B3 (Mailchimp)
> for marketing data and B4 (Snapshot tool) for assessment data.

## Scope

Wire the existing Synthex dashboard reporting templates to live data feeds
across the integration layer. Replace any remaining placeholder data with
real signal. Build the Hyper-Care daily snapshot pipeline.

## Foundation references

- Q3.4.4 — dashboard wiring specification
- `performance-attribution-lead` skill — depends on B5 outputs to flow
  attribution data automatically
- VG-72 — external client retainer success metric (one of the dashboard tiles)

## Data feeds to wire

| Source                   | Surface                            | Refresh cadence                                                                |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------ |
| GA4                      | Sessions, conversions, top pages   | Hourly via [SYN-793](https://linear.app/unite-group/issue/SYN-793) GA4Property |
| Search Console           | Impressions, clicks, queries       | Daily via existing GSC integration                                             |
| Shopify                  | Orders, revenue, returning rate    | Hourly (when Shopify integration ships)                                        |
| Mailchimp                | Sends, opens, clicks, unsubscribes | Webhook-driven (B3 dependency)                                                 |
| Snapshot tool            | Run count, scores, conversion rate | Daily aggregate (B4 dependency)                                                |
| `client_value_scorecard` | CVML feature engagement            | Existing Monday refresh (SYN-725)                                              |
| `platform_metrics`       | Per-platform post performance      | Existing                                                                       |
| `authority_scores`       | Authority delta per client         | Existing                                                                       |

## Hyper-Care daily snapshot pipeline

Cron: 07:00 AEST every weekday.

Steps:

1. Pull yesterday's data from each of the 8 sources above
2. Run anomaly detection (`lib/analytics/anomaly-detector.ts` — already
   shipped, table created earlier today via SYN-878 batch)
3. If anomalies fire → write to `anomalies` table, send Slack alert via
   existing CVML alert pipeline
4. Build daily Hyper-Care brief — one Markdown page per active client
5. Save brief to `monthly_stories` table (reuse existing brief storage)
6. Optional: deliver via existing `deliver-monthly-story` Edge Function
   pattern (reuse, don't fork)

## Monday weekly batched-render

Cron: Monday 03:00 AEST (matches CVML scorecard refresh cadence).

Steps:

1. Refresh `client_value_scorecard` materialised view (existing)
2. Pull weekly aggregates from all 8 sources
3. Render weekly briefing per active client + portfolio summary
4. Post portfolio summary to `#synthex-metrics` Slack at 09:00 AEST
   (existing CVML alert pipeline)
5. Email per-client briefs at 09:00 AEST via existing email infra

## Same-day incident detection

Anomaly threshold breach during the daily 07:00 run → fire incident
escalation:

1. Slack alert to `#synthex-incidents` immediately
2. SMS to on-call (currently: Phill) via existing `sms_send_audit`
   pipeline (P10 hash-only contract)
3. Auto-page if not acknowledged within 30 minutes (out of scope for v1;
   manual escalation initially)

## Smoke test plan

1. Insert a synthetic high-magnitude row into `analytics_metrics` →
   anomaly detector fires within 60 seconds → row appears in `anomalies` →
   Slack message visible in `#synthex-incidents`.
2. Force a GA4 fetch failure → daily Hyper-Care brief reports the source
   as `unhealthy` rather than silently rendering with stale data.
3. Monday 09:00 AEST → portfolio summary posts to `#synthex-metrics`;
   per-client briefs land in client inboxes.
4. Manually delete an `anomalies` row before incident escalation fires →
   verify the escalation pipeline reads the live row state and skips the
   acknowledged-or-resolved cases.
5. Performance: full daily 07:00 run completes in ≤5 minutes on the
   current 21-client dataset; ≤15 minutes at 200-client scale.

## CEO action items (must clear before engineering starts)

- [ ] B3 (Mailchimp) shipped — Mailchimp data feed depends on it
- [ ] B4 (Snapshot tool) Phase 2 shipped — Snapshot data feed depends on it
- [ ] Shopify integration credential handoff (currently no Shopify
      integration in code; might be future work)
- [ ] On-call SMS list confirmed (currently only Phill — does it stay
      that way or expand to a small team?)
- [ ] `#synthex-incidents` Slack channel exists + is monitored
- [ ] external client retainer success metric (VG-72) defined — feeds the external client
      dashboard tile

## Out of scope

- Real-time streaming dashboard — daily / hourly batches are fine for v1
- Mobile dashboard — RestoreAssist app has its own; Synthex web only
- Predictive forecasting — `forecast_models` + `forecasts` tables
  exist but populating them is a separate epic
- external client custom dashboard — uses standard tiles + the VG-72 metric tile
