# Automation Schedule

> Status: ✅ `VERIFIED` design. The **existing** crons below are real (`app/api/cron/gsc-monitor`,
> `gsc-topic-sync`, `gsc-auto-index`, plus GBP monitor + Sentinel, referenced in the `local-seo-agent`
> skill). The marketing-intelligence cadences slot on top of them. All publishing steps are gated.

## Existing crons this system subscribes to (do not duplicate)

| Cron | Approx. time | Owner | We consume |
|------|--------------|-------|-----------|
| `gsc-monitor` | ~04:00 | google-search-console | per-property performance snapshots |
| `gsc-topic-sync` | daily | google-search-console | query→topic mapping |
| `gsc-auto-index` | daily | google-search-console | indexing status |
| `gbp-monitor` | ~05:00 | google-business-profile | GBP insights + review changes |
| Sentinel health check | daily | google-updates-sentinel | algorithm-impact alerts |

## New marketing-intelligence cadences

### Daily (cheap tier, autonomous up to the GATE)
- Ingest the day's GSC/GBP/Sentinel snapshots.
- Recompute decay/freshness/opportunity for pages with fresh signals.
- Update the confidence-adjusted backlog.
- **Prepare** (never publish) any low-risk drafts to `Outcomes/synthex-content/`.
- Escalate to human anything `risk≥0.7`, `DATA_REQUIRED`, or YMYL.

### Weekly
- Topical-authority + entity-coverage pass per cluster (math §4/§5).
- Competitor-gap refresh via `competitive-local-strategy`.
- Re-verify any claim touched by a `google-updates-sentinel` alert.
- Produce a per-project scorecard (real metrics only; gaps shown as `DATA_REQUIRED`).

### Monthly
- Full page-inventory re-crawl (CWV, structure, internal links, age).
- Calibration review of `Weights` (logged decision if changed).
- Cross-portfolio prioritisation: where does the next unit of effort earn the most?
- CEO synthesis update.

### Quarterly
- Citation/NAP audit (delegated to `local-seo-agent`).
- Re-baseline GSC and re-score the whole portfolio.
- Review every `HYPOTHESIS_FOR_TESTING` outcome → promote, kill, or iterate.

## Autonomy boundaries (hard)

| May run autonomously | Requires human approval |
|----------------------|-------------------------|
| Read-only ingestion, crawling, scoring | Any live content publish |
| Backlog (re)prioritisation | Any YMYL claim change |
| Draft preparation to `synthex-content/` | Any AEO/GEO schema test (risk R-AEO-02) |
| Internal audits (E-E-A-T, links, CWV) | Bulk page generation (risk R-SEO-01) |
| Alerting / escalation | Any `Weights` change (logged decision) |

Aligns with the Nexus pitch-03 §6 approval matrix and the self-improvement charter (no self-deregulation).
