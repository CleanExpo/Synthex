# Site Page Inventory

> Status: 🟡 `DATA_REQUIRED` for actual pages — no crawl or GSC page-list has been run against the
> live sites. The **projects** below are real (from the portfolio SSOT,
> `Unite-Hub/.portfolio/PORTFOLIO.yaml`). Page rows are the methodology + schema to fill once a crawl runs.

## In-scope projects (real — from portfolio registry)

| Project | Domain (registry) | Vertical | YMYL sensitivity |
|---------|-------------------|----------|------------------|
| Unite-Hub | `unite-hub.vercel.app` | Marketing CRM (B2B SaaS) | Low |
| Authority-Site (Unite-Group) | `unite-group.vercel.app` | Authority/landing | Low |
| Synthex | `synthex.social` | Marketing automation | Low |
| RestoreAssist | (registry) | Restoration | **Medium-High** (insurance/safety) |
| CARSI | (registry) | Collision-repair training | **Medium** (training claims) |
| Disaster-Recovery | (registry) | Disaster restoration | **High** (safety/insurance) |
| NRPG | (registry) | (per registry) | Medium |
| CCW / Carpet Cleaners Warehouse | (registry) | E-commerce / cleaning supplies | Low |
| Local-Lift | (registry) | Local SEO product | Low |
| AI_Guided_SaaS | (registry) | SaaS | Low |

> Confirm exact production domains from the registry before any crawl — several `canonical_path`
> entries are Windows (`D:\`) paths; the registry `vercel.production.domain` is the source of truth.

## Page inventory schema (one row per page, fill after crawl)

```yaml
- url: <full URL>
  project: <project>
  page_type: blog | service | service-area | home | faq | landing | glossary
  target_keyword: <primary>
  search_intent: informational | commercial | transactional | navigational | local
  audience: <who>
  funnel_stage: informational | consideration | transactional | navigational
  service_or_product: <what>
  # metrics — DATA_REQUIRED until GSC wired
  impressions: null
  clicks: null
  ctr: null
  avg_position: null
  months_since_update: <from CMS/git>      # auditable now
  inbound_internal_links: <from crawl>     # auditable now
  # scores (computed by scoring-models.ts)
  data_status: DATA_REQUIRED
  priority_score: null
```

## The data gate (how to populate this for real)

1. **Crawl** each production domain (Lighthouse + a link/structure crawl) → fills `page_type`,
   `months_since_update`, `inbound_internal_links`, CWV. *No third-party data needed — buildable now.*
2. **GSC** per property (the live `lib/google/search-console.ts` + `fetchAnalytics`) → fills
   impressions/clicks/ctr/position and enables decay/freshness scoring.
3. **Semrush** (if licensed) → fills `search_volume` for opportunity scoring on pages with no impressions yet.

Until step 1 runs, this file stays a methodology document — by design, not omission.

## Recommended update blocks per page (from verified claims)

When a page is selected for work, the strategist applies only the blocks justified by a verified claim:
title/meta (claim A1), CWV fixes (A2), original content + proof (A3), E-E-A-T block (B1),
meaningful freshness + `dateModified` (B2), internal links (math §6), FAQ/HowTo schema + above-the-fold
answer (D1, as `HYPOTHESIS_FOR_TESTING`), local relevance block (C1 — via `local-seo-agent`).
