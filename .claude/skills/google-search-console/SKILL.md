---
name: google-search-console
description: >-
  GSC data interpretation, indexing triage, coverage analysis, sitemap strategy,
  and diagnostic decision trees for search performance issues. Use when working
  with Search Console data, debugging indexing problems, or analysing search
  analytics trends.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - search console
    - GSC
    - indexing issues
    - search analytics
    - coverage report
    - sitemap
    - crawl errors
    - URL inspection
  requires:
    - google-updates-sentinel
context: fork
---

# Google Search Console — Data Interpretation and Diagnostics

## Purpose

SYNTHEX connects to Google Search Console via OAuth to pull real search
analytics, inspect URLs, manage sitemaps, and request indexing. This skill
documents how to interpret the data GSC returns and how to diagnose common
search visibility problems using Synthex infrastructure.

## Infrastructure Map

| Layer           | File                                   | Exports                                                                                                                        |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Service         | `lib/google/search-console-oauth.ts`   | `listSites`, `getSearchAnalytics`, `getUrlInspection`, `getCoverageReport`, `listSitemaps`, `submitSitemap`, `requestIndexing` |
| Auth            | `lib/google/google-auth.ts`            | `getOAuthAccessToken`, `getServiceAccountAccessToken`, `findOAuthConnection`, `hasServiceAccountCredentials`                   |
| Hook (SWR)      | `hooks/useGSCProperties.ts`            | `useGSCProperties` — returns `properties`, `primaryProperty`, `syncProperties`, `refresh`                                      |
| Hook (state)    | `hooks/useSearchConsole.ts`            | `useSearchConsole` — returns `fetchAnalytics`, `checkIndexingStatus`, `fetchSitemaps`                                          |
| Cron (4 AM UTC) | `app/api/cron/gsc-monitor/route.ts`    | Snapshots metrics per GSCProperty, detects coverage regressions, creates notifications on >50% click drop                      |
| Cron (6 AM UTC) | `app/api/cron/gsc-auto-index/route.ts` | Auto-submits new published URLs to Indexing API (DAILY_QUOTA = 200/day)                                                        |
| Models          | Prisma: `GSCProperty`, `GSCSnapshot`   | Per-org property records + daily metric snapshots                                                                              |

**API Routes (7):**

| Route                                     | Method | Purpose                                      |
| ----------------------------------------- | ------ | -------------------------------------------- |
| `/api/seo/search-console/properties`      | GET    | List connected properties                    |
| `/api/seo/search-console/properties`      | POST   | Sync properties from Google                  |
| `/api/seo/search-console/analytics`       | POST   | Fetch search analytics data                  |
| `/api/seo/search-console/indexing-status` | POST   | URL Inspection API                           |
| `/api/seo/search-console/indexing`        | POST   | Request indexing (URL_UPDATED / URL_DELETED) |
| `/api/seo/search-console/sitemaps`        | GET    | List sitemaps for a property                 |
| `/api/seo/search-console/sitemaps/submit` | POST   | Submit a sitemap URL                         |

## Search Analytics Interpretation

### Dimensions

`getSearchAnalytics` supports 5 dimensions: `query`, `page`, `country`, `device`, `date`.
Default is `['query']` with 28-day range and 25-row limit.

### Position Tiers and Actions

| Avg Position | Tier       | Action                                                                                   |
| ------------ | ---------- | ---------------------------------------------------------------------------------------- |
| 1-3          | Defend     | Protect existing rankings — monitor for drops, keep content fresh                        |
| 4-10         | Optimise   | Title tag + meta description improvements, internal linking, content depth               |
| 11-20        | Quick wins | High-potential pages needing targeted work — content expansion, schema markup, backlinks |
| 21+          | Long-term  | Requires significant content investment or domain authority building                     |

### CTR Benchmarks by Position

| Position | Expected CTR Range | Notes                                         |
| -------- | ------------------ | --------------------------------------------- |
| 1        | 28-34%             | Varies by featured snippets and SERP features |
| 2        | 15-17%             |                                               |
| 3        | 10-12%             |                                               |
| 4-5      | 5-8%               |                                               |
| 6-10     | 2-5%               |                                               |
| 11-20    | 1-2%               | Page 2 — rarely clicked                       |

### Quick-Win Identification

Pattern: **high impressions + low CTR relative to position**

```
IF impressions > 500
  AND ctr < expected_ctr_for_position * 0.6
THEN
  Title tag or meta description needs improvement.
  Check: is title compelling? Does meta description contain a call to action?
  Check: are rich results (schema) available for this query type?
```

Pattern: **position 4-10 with high impressions**

```
IF position BETWEEN 4 AND 10
  AND impressions > 1000
THEN
  This query is achievable for page 1 top 3.
  Actions: expand content depth, add internal links, improve page speed.
```

## Indexing Issue Decision Tree

```
URL not appearing in search?
  |
  +--> Run URL Inspection (checkIndexingStatus)
         |
         +--> indexingState = "INDEXED"
         |      --> Not an indexing issue. Check position via analytics.
         |      --> If position > 50: content quality or authority issue.
         |
         +--> indexingState = "DISCOVERED_NOT_INDEXED"
         |      --> Google found the URL but chose not to index it.
         |      --> Causes: thin content, low E-E-A-T signals, duplicate of stronger page.
         |      --> Fix: add unique value, demonstrate expertise, ensure canonical is correct.
         |
         +--> indexingState = "CRAWLED_NOT_INDEXED"
         |      --> Google crawled but deemed page low-value.
         |      --> Causes: duplicate content, low-quality pages, crawl budget waste.
         |      --> Fix: consolidate thin pages, improve content, add internal links.
         |
         +--> robotsTxtState = "BLOCKED"
         |      --> robots.txt is preventing crawling.
         |      --> Fix: update robots.txt to allow Googlebot access.
         |
         +--> pageFetchState = "SOFT_404"
         |      --> Server returns 200 but page looks like an error page to Google.
         |      --> Fix: return proper 404 status for missing pages, or add real content.
         |
         +--> pageFetchState = "SERVER_ERROR"
                --> Server returning 5xx errors.
                --> Fix: investigate server logs, ensure page loads reliably.
```

## Coverage Report Interpretation

GSC coverage data comes from daily cron snapshots (`gsc-monitor` at 4 AM UTC).
The `getCoverageReport` function returns aggregate counts from `GSCSnapshot` records.

### Error Triage Protocol (in priority order)

1. **Server errors (5xx)** — highest priority; Google cannot access your pages at all
2. **Redirect errors** — broken redirect chains, loops, or redirects to 4xx pages
3. **Soft 404s** — pages returning 200 but appearing empty or error-like to Google
4. **Blocked by robots.txt** — unintentional blocks on important pages

### Cross-Reference with Cron Alerts

The `gsc-monitor` cron creates notifications when:

- Click count drops >50% compared to the previous snapshot
- Coverage errors spike above baseline

When investigating a coverage alert, always check:

1. Which specific URLs are affected (drill into GSC UI or use URL Inspection)
2. Whether the issue correlates with a recent deploy (check git log)
3. Whether an algorithm update is active (invoke `google-updates-sentinel` skill)

## Sitemap Strategy Checklist

Run through this checklist for any site connected to Synthex:

- [ ] Sitemap submitted to GSC? (`listSitemaps` returns empty = not submitted)
- [ ] Using sitemap index for large sites? (`isSitemapsIndex` flag)
- [ ] No errors or warnings? (`errors === 0 && warnings === 0`)
- [ ] Submitted count approximately equals indexed count? (large gap = quality issue)
- [ ] Auto-discovery via robots.txt? (robots.txt should contain `Sitemap: https://...`)
- [ ] Dynamic sitemap regenerates when new content is published?

Use `submitSitemap(siteUrl, sitemapUrl)` to submit or resubmit.

## Indexing Request Best Practices

The Indexing API (`requestIndexing`) has strict limits:

- **200 requests per day** per property (DAILY_QUOTA constant in `gsc-auto-index` cron)
- **600 URL Inspections per day** (separate limit from Indexing API)
- Supports only `URL_UPDATED` and `URL_DELETED` notification types

### When to use

- Newly published pages that need fast indexing
- Pages with significant content updates
- The `gsc-auto-index` cron automatically submits `PlatformPost` URLs that have `publicUrl` in metadata

### When NOT to use

- Pages with `noindex` directive (wastes quota)
- Duplicate or thin content pages
- URLs that 404 or redirect
- Unchanged pages (Google will ignore and may rate-limit)

## "Clicks Dropping" Diagnostic Tree

```
Clicks declining in GSC analytics?
  |
  +--> Check analytics trend (fetchAnalytics with dimensions: ['date'])
  |      Look for: gradual decline vs sudden drop
  |      Gradual: likely competitive or seasonal
  |      Sudden: likely technical or algorithmic
  |
  +--> Check for active algorithm rollout
  |      Invoke google-updates-sentinel skill
  |      If active rollout + traffic drop: follow type-specific recovery
  |
  +--> Check coverage errors (GSCSnapshot trends)
  |      Spike in errors = technical issue blocking crawling
  |
  +--> Check Core Web Vitals
  |      LCP > 2.5s, INP > 200ms, or CLS > 0.1 = ranking demotion risk
  |      Use SiteHealthSnapshot CWV data from Sentinel
  |
  +--> Check competitor activity
         Invoke competitive-local-strategy skill
         Competitor content surge can displace your rankings
```

## Domain Knowledge

- GSC search analytics data has a **2-day lag** — queries from today will not appear until ~48 hours later
- Position values are **averaged across impressions**, not clicks — a page showing at position 3 for 1,000 impressions and position 50 for 10 impressions averages to ~3.5
- URL Inspection results reflect Google's **last crawl**, not real-time state — the page may have changed since
- The `getSearchAnalytics` function defaults to `type: 'web'` — this excludes image, video, and news results
- GSC property URLs must match exactly — `https://example.com` and `https://www.example.com` are different properties
- OAuth token resolution follows a priority chain: explicit connectionId > org-level OAuth connection > service account fallback

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.
