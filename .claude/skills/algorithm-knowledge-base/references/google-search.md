---
title: Google Search Algorithm Reference
last_verified_date: 2026-04-01
applies_to: Google Search (web, local, AI Overviews)
confidence_range: CONFIRMED → INFERRED
---

# Google Search Algorithm Signals

## Overview

Google's ranking system uses 200+ signals across multiple subsystems. The 2024 Google Content Warehouse API leak provided the most complete public picture to date. Entries below note whether they come from the leak or official statements.

---

## Core Ranking Signals

### NavBoost (clickSignals) [LEAKED]
- **Category**: UB (User Behaviour)
- **Source**: Google Content Warehouse API leak — 2024-05 (arstechnica.com/tech-policy/2024/05/google-algorithm-leak)
- **Last verified**: 2026-04
- **Weight**: Critical
- **Description**: Aggregated click-through data per query–URL pair, including: `goodClicks`, `badClicks`, `lastLongestClicks`, `unsquashedClicks`. NavBoost is a dedicated ranking subsystem, not a passive signal.
- **Implication**: Titles and meta descriptions that increase CTR directly boost rankings for that query. Low CTR on a well-ranked page is a ranking risk.

### siteAuthority [LEAKED]
- **Category**: AT (Authority & Trust)
- **Source**: Google Content Warehouse API leak — 2024-05
- **Last verified**: 2026-04
- **Weight**: Critical
- **Description**: Site-level authority score derived from external link graph + domain age + brand mentions. Different from page-level PageRank. Used as a trust floor.
- **Implication**: New domains face a trust sandbox period (see `hostAge` below). Domain authority is cumulative — protect it.

### OriginalContentScore [LEAKED]
- **Category**: CQ (Content Quality)
- **Source**: Google Content Warehouse API leak — 2024-05
- **Last verified**: 2026-04
- **Weight**: Strong
- **Description**: Score for whether content adds something not found elsewhere. Duplicate / thin / scraped content scores low.
- **Implication**: Add proprietary data, original analysis, case studies, or perspectives not available on competing pages.

### Chrome User Data (CrUX) [CONFIRMED]
- **Category**: UB (User Behaviour)
- **Source**: Google Search Central — Core Web Vitals documentation (developers.google.com/search/docs/appearance/core-web-vitals)
- **Last verified**: 2026-04
- **Weight**: Strong
- **Description**: Real-user metrics collected via Chrome: LCP, FID/INP, CLS. Used as a direct ranking signal since 2021 Page Experience update. CrUX data at URL and origin level.
- **Implication**: LCP < 2.5s, INP < 200ms, CLS < 0.1 are the passing thresholds. Failing all three on mobile is a meaningful ranking penalty.

### E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) [CONFIRMED]
- **Category**: AT (Authority & Trust)
- **Source**: Google Search Quality Evaluator Guidelines — 2024 edition (static.googleusercontent.com/media/guidelines/en/qsg-0.pdf)
- **Last verified**: 2026-04
- **Weight**: Strong (indirect — shapes quality rater scores that inform algorithm training)
- **Description**: Four-dimension quality framework used by human quality raters. Not a direct algorithmic signal but shapes the training data for Google's ML ranking systems. YMYL (Your Money/Your Life) topics get extra scrutiny.
- **Implication**: For YMYL: named authors with credentials, About pages, author schema, external citations, accuracy. Experience signals matter — first-person accounts, original photos, demonstrable expertise.

### SegIndexer / Freshness Tiers [INFERRED]
- **Category**: FR (Freshness)
- **Source**: Multiple corroborating SEO analyses of Google's update cadence behaviour — 2024
- **Last verified**: 2026-04
- **Weight**: Moderate (query-dependent — high for news/trends, low for evergreen)
- **Description**: Google categorises queries by freshness sensitivity. Time-sensitive queries (news, events, product releases) heavily favour recently updated content. Evergreen content (tutorials, definitions) gets less freshness benefit.
- **Implication**: For news/trends: publish fast and use `datePublished` + `dateModified` schema. For evergreen: regular meaningful updates with updated `dateModified` signal freshness without hurting established ranking.

### hostAge / Domain Sandbox [INFERRED]
- **Category**: FR (Freshness) + AT (Authority & Trust)
- **Source**: Multiple corroborating SEO observations of new domain behaviour — 2019–2024
- **Last verified**: 2026-04
- **Weight**: Strong (new sites only)
- **Description**: New domains appear to face a "sandbox" where rankings are suppressed for 6–12 months regardless of content quality. Consistent with `siteAuthority` mechanics from leak. Older domains with strong authority rank faster for new content.
- **Implication**: New sites should build links and brand mentions aggressively from launch. Do not expect organic rankings until the sandbox period passes.

### Twiddlers (Re-ranking Adjustments) [LEAKED]
- **Category**: CQ (Content Quality) + UB (User Behaviour)
- **Source**: Google Content Warehouse API leak — 2024-05
- **Last verified**: 2026-04
- **Weight**: Moderate (applied post-primary ranking)
- **Description**: Secondary scoring adjustments applied after primary ranking. Examples include: `langsMatch` (language matching), `spamBrain` (spam detection), `safeSearch`, `exactMatch`. Twiddlers can boost or demote pages after initial retrieval.
- **Implication**: Exact-match domains still have a small Twiddler boost (diminished since 2012 EMD update). Spam signals (paid links, keyword stuffing) activate negative Twiddlers.

---

## Local Search Signals

### Google Business Profile Completeness [CONFIRMED]
- **Category**: AT (Authority & Trust)
- **Source**: Google Business Profile Help documentation
- **Last verified**: 2026-04
- **Weight**: Critical (local pack)
- **Description**: Complete GBP profiles (business name, address, phone, hours, photos, categories, attributes) rank higher in local pack and Google Maps.
- **Implication**: Fill every field. Add 10+ photos minimum. Use the correct primary category. Add service areas.

### Review Signals (quantity, recency, sentiment) [CONFIRMED]
- **Category**: EV (Engagement Velocity)
- **Source**: Google Business Profile Help documentation + multiple local SEO studies
- **Last verified**: 2026-04
- **Weight**: Critical (local pack)
- **Description**: Review count, average star rating, recency of reviews, and owner response rate all affect local pack rankings.
- **Implication**: Request reviews systematically post-service. Respond to all reviews — positive and negative. A burst of new reviews after a dry period signals active business.

---

## AI Overviews (SGE) Signals

### Citation Eligibility [INFERRED]
- **Category**: CQ (Content Quality) + AT (Authority & Trust)
- **Source**: Google SGE observed citation patterns — 2024-2025
- **Last verified**: 2026-04
- **Weight**: Unknown (AI Overviews is a separate system from web rankings)
- **Description**: AI Overviews citations tend to favour: concise direct answers to the query, structured content with clear headings, strong E-E-A-T signals, schema markup, and high siteAuthority.
- **Implication**: Add FAQ sections with direct Q&A format. Use `FAQPage` and `HowTo` schema. Short, direct sentences above the fold improve citation likelihood.

---

## Anti-Signals (What Hurts)

| Signal | Effect |
|--------|--------|
| `badClicks` in NavBoost | Direct ranking demotion for query–URL pair |
| Thin content (< 300 words without unique value) | Low OriginalContentScore |
| Missing HTTPS | Page Experience penalty |
| CLS > 0.25 | Core Web Vitals failure |
| Keyword stuffing | Activates negative Twiddlers |
| Purchased links (unnatural link graph) | SpamBrain detection |
| Missing `dateModified` on updated content | Freshness signal missed |
