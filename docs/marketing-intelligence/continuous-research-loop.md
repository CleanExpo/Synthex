# Continuous Research & Refresh Loop

> Status: ✅ `VERIFIED` design — grounded in the **existing** cron + skill infrastructure (the GSC/GBP
> monitors already run) and the Nexus pitch-03 `client_loops` architecture. This is how the system
> becomes a *living* operating loop rather than a one-off report.

## The loop (per client workspace)

```
   ┌──────────────────────────────────────────────────────────────┐
   │  marketing-intelligence loop_kind (new, under pitch-03)        │
   │                                                                │
   │  SCAN ──▶ collect signals (GSC, GBP, crawl, competitor, SERP)  │
   │   │                                                            │
   │   ▼                                                            │
   │  GAP  ──▶ score pages (scoring-models.ts) → decay/freshness/   │
   │   │       opportunity/GEO/E-E-A-T                              │
   │   ▼                                                            │
   │  VERIFY ─▶ any new tactic cross-checked ≥4 sources before use  │
   │   │                                                            │
   │   ▼                                                            │
   │  PROPOSE ─▶ confidence-adjusted backlog (math §12)             │
   │   │                                                            │
   │   ▼                                                            │
   │  GATE ──▶ risk≥0.7 OR data_required OR YMYL → human approval   │
   │   │                                                            │
   │   ▼                                                            │
   │  PREPARE ─▶ draft to Outcomes/synthex-content/ (NOT published) │
   │   │                                                            │
   │   ▼                                                            │
   │  APPROVE (human) ─▶ publish ─▶ MEASURE vs kill threshold ─▶ SCAN│
   └──────────────────────────────────────────────────────────────┘
```

## Data pulled per stage (and from where)

| Signal | Source | Status |
|--------|--------|--------|
| Impressions/clicks/CTR/position | GSC (`lib/google/search-console.ts`, live) | wired in-app; needs pipeline consumer (INFRA-2) |
| Local pack / GBP insights / reviews | `google-business-profile` skill + GBP API | owned by existing skill |
| Page age / structure / internal links / CWV | crawl + Lighthouse | buildable now (INFRA-1) |
| Competitor gaps | `competitive-local-strategy` skill | owned by existing skill |
| Algorithm-update risk | `google-updates-sentinel` skill | owned by existing skill |
| Keyword volume | Semrush | `DATA_REQUIRED` |
| YouTube/influencer claims | YouTube Data API | `DATA_REQUIRED` |

## Update triggers (when the loop proposes work)

- Position drop on a tracked query (GSC) → T1/T2 refresh.
- Impressions rising but CTR low (claim A1) → title/meta rewrite.
- Page age past the freshness horizon (18mo default) on a money page → T1.
- New competitor content in a cluster we should own → T3 deepen.
- New Google guidance / core update (`google-updates-sentinel` alert) → re-verify affected claims.
- Missing/weak schema or internal linking → technical ticket.
- AI-Overview now answering a tracked query → T4 GEO test.
- New verified YouTube/industry claim → re-score affected pages.

## Why this reuses, not rebuilds

The portfolio already runs `gsc-monitor`, `gsc-topic-sync`, `gsc-auto-index`, `gbp-monitor`, and a
Sentinel health check (see [automation-schedule.md](automation-schedule.md)). This loop **subscribes**
to those outputs and adds the cross-portfolio scoring + prioritisation + human-gated planning layer.
