# Content Refresh Roadmap

> Status: 🟡 `DATA_REQUIRED` for the dated schedule — sequencing real pages needs the decay/freshness
> scores, which need GSC data. The **method** below is `VERIFIED` and runs the moment data is wired.

## How pages get onto the roadmap

```
GSC period-over-period  ──▶  content_decay score (math §2)
internal crawl (age)    ──▶  freshness_priority score (math §3)
                                      │
                                      ▼
        sort by confidence_adjusted_action (math §12)  ──▶  refresh queue
                                      │
              risk gate (≥0.7) + data gate (DATA_REQUIRED)  ──▶  blocked → human
```

## Refresh tiers (priority bands, not dates)

| Tier | Trigger | Action | Approval |
|------|---------|--------|----------|
| **T1 — Protect** | High-traffic money page losing position (decay high, commercial_value high) | Targeted refresh: intent re-match, freshen, internal links, CWV | Low-risk auto-prepare; publish needs human |
| **T2 — Recover** | Impressions steady, CTR dropped (claim A1) | Title/meta rewrite only | Auto-prepare; publish needs human |
| **T3 — Deepen** | Topical authority gap (math §4) on a cluster we should own | New supporting articles + internal links | Human gate (content volume) |
| **T4 — AEO/GEO test** | Query now answered by AI Overviews (D1) | Add above-the-fold answer + FAQ/HowTo schema as `HYPOTHESIS_FOR_TESTING` | Human gate + explicit kill threshold |
| **T5 — YMYL hardening** | RestoreAssist/CARSI/DR page making claims without credentials (R-YMYL-01) | Add author/credentials/citations/last-reviewed | **Compliance gate** |

## Every refresh ticket must carry

- The **claim_ref(s)** justifying the change (e.g. `A1`, `B2`).
- The **measurable signal** to watch (GSC CTR, position, CrUX, AI-Overview citation presence).
- A **validation window** (e.g. 28 days) and a **kill threshold** (revert if signal worsens).
- A **rollback note** (content is versioned in git / CMS history).

## Output destination

Prepared drafts land in `2nd-brain/Outcomes/synthex-content/` (the existing content-draft target) and
wait at the human-approval gate. Nothing publishes from this roadmap autonomously — see
[human-approval-gates.md](human-approval-gates.md).
