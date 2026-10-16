---
title: Google Search Algorithm Reference
last_verified_date: 2026-04-01
partially_reverified: 2026-10-16 (leak labelling, Core Web Vitals, local, AI features)
applies_to: Google Search (web, local, AI Overviews)
confidence_range: CONFIRMED → INFERRED
---

# Google Search Algorithm Signals

## Overview

Google's ranking system uses 200+ signals across multiple subsystems. The 2024 Google Content Warehouse API leak provided the most complete public picture to date. Entries below note whether they come from the leak or official statements.

**`[LEAKED]` means unconfirmed.** The leak exposed attribute names in internal API documentation. It does not show whether, how or how much any attribute is used in ranking, and Google has not confirmed them. Never present a `[LEAKED]` entry as verified, as a platform document, or as a direct ranking cause; phrase it as "reportedly" and test it.

---

## Core Ranking Signals

### NavBoost (clickSignals) [LEAKED]

- **Category**: UB (User Behaviour)
- **Source**: Google Content Warehouse API leak — 2024-05 (arstechnica.com/tech-policy/2024/05/google-algorithm-leak)
- **Last verified**: 2026-04
- **Weight**: Critical
- **Description**: Aggregated click-through data per query–URL pair, including: `goodClicks`, `badClicks`, `lastLongestClicks`, `unsquashedClicks`. NavBoost is a dedicated ranking subsystem, not a passive signal.
- **Implication** (hypothesis to test, not a confirmed mechanism): titles and descriptions that accurately match intent may reduce bounce-backs. Do not promise that CTR changes rankings.

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
- **Description**: Real-user metrics collected via Chrome: LCP, INP (replaced FID), CLS. Google: good Core Web Vitals, "along with other page experience aspects, aligns with what our core ranking systems seek to reward" `[VERIFIED: developers.google.com/search/docs/appearance/core-web-vitals, 16/10/2026]`.
- **Implication**: Good thresholds: LCP within 2.5 s, INP under 200 ms, CLS under 0.1. Fix them for users; do not describe failing them as a ranking penalty or promise ranking gains.

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
- **Description**: Google: "Businesses with complete and accurate info are more likely to show up in local search results." Local ranking is relevance, distance and prominence; there is no way to pay for or request a better local ranking `[VERIFIED: support.google.com/business/answer/7091, 16/10/2026]`.
- **Implication**: Fill every field accurately. Use the correct primary category. Add service areas. Photo counts, posts and geotags are not listed as ranking factors.

### Review Signals (quantity, recency, sentiment) [CONFIRMED]

- **Category**: EV (Engagement Velocity)
- **Source**: Google Business Profile Help documentation + multiple local SEO studies
- **Last verified**: 2026-04
- **Weight**: Critical (local pack)
- **Description**: Google confirms review count and rating: "More reviews and positive ratings can help your business's local ranking" `[VERIFIED: answer/7091]`. Recency and owner response rate as ranking inputs are `[UNCONFIRMED]`.
- **Implication**: Ask every customer for an honest review after the job (no incentives, no gating, no requested wording: Maps policy `[VERIFIED]`). Reply to every review because customers read replies, not as a ranking lever.

---

## AI Overviews and AI Mode

### Eligibility [CONFIRMED]

- **Category**: CQ (Content Quality) + AT (Authority & Trust)
- **Source**: Google Search Central — AI features (developers.google.com/search/docs/appearance/ai-features) and AI optimisation guide (developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- **Last verified**: 2026-10-16
- **Weight**: Unknown — Google publishes no AI-citation ranking formula
- **Description**: AI Overviews and AI Mode use the normal Search index: a page must be indexed and eligible to show a snippet. There is no special AI schema, and sites can ignore llms.txt and other special AI files or markup for Google Search. FAQ rich results are no longer shown. AI Mode launched in Australia (English) on 08/10/2025.
- **Implication**: Do the normal work: indexable, snippet-eligible pages with direct, accurate answers from real experience. Use structured data only where it matches visible content; never promise that FAQPage/HowTo or any markup earns AI citations. Measure citations per engine (Search Console generative-AI reports, Bing AI Performance) rather than assuming.

---

## Anti-Signals (What Hurts)

| Signal                                          | Effect                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `badClicks` in NavBoost `[LEAKED, unconfirmed]` | Reported demotion for a query–URL pair; not confirmed by Google                      |
| Thin content (< 300 words without unique value) | Low OriginalContentScore                                                             |
| Missing HTTPS                                   | Fails a page experience aspect (fix for users; not described by Google as a penalty) |
| CLS > 0.25                                      | Core Web Vitals failure                                                              |
| Keyword stuffing                                | Activates negative Twiddlers                                                         |
| Purchased links (unnatural link graph)          | SpamBrain detection                                                                  |
| Missing `dateModified` on updated content       | Freshness signal missed                                                              |
