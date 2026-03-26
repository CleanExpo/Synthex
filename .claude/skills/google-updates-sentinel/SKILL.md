---
name: google-updates-sentinel
description: >-
  Algorithm update types, diagnosis workflows, recovery strategies, and
  proactive hardening for Google algorithm changes. Use when diagnosing traffic
  drops, responding to algorithm updates, or hardening sites against future
  updates.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - algorithm update
    - google update
    - core update
    - spam update
    - helpful content
    - ranking drop
    - traffic drop
    - penalty
    - sentinel
    - algorithm recovery
  requires:
    - google-search-console
context: fork
---

# Google Updates Sentinel — Algorithm Monitoring and Recovery

## Purpose

SYNTHEX runs a Sentinel system that monitors site health, tracks Google
algorithm updates, and alerts when performance regressions correlate with
known rollouts. This skill documents how to interpret Sentinel data,
diagnose algorithm impacts, and execute recovery strategies.

## Sentinel Architecture

| Layer          | File                                                             | Exports / Purpose                                                                                                                                     |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orchestrator   | `lib/sentinel/sentinel-agent.ts`                                 | `runSentinelCheck(userId, orgId)` — full check: seed updates, resolve site URL, check health, run alerts                                              |
|                |                                                                  | `runSentinelCheckForAllUsers()` — batch check for cron (limit 100 users)                                                                              |
| Algorithm Feed | `lib/sentinel/algorithm-feed.ts`                                 | `KNOWN_ALGORITHM_UPDATES` (12 known updates, 2024-2026), `seedAlgorithmUpdates()`, `getRecentUpdates(days)`, `getActiveRollouts()`, `getAllUpdates()` |
| Health Checker | `lib/sentinel/health-checker.ts`                                 | `checkSiteHealth(siteUrl, userId, orgId)` — score 0-100 from GSC + PSI data                                                                           |
|                |                                                                  | `getSnapshotHistory(userId, siteUrl, days)`, `getLatestSnapshot(userId, siteUrl)`                                                                     |
| Alert Engine   | `lib/sentinel/alert-engine.ts`                                   | `runAlertEngine(current, previous, recentUpdates, thresholds)` — compares snapshots, emits alerts                                                     |
| Types          | `lib/sentinel/types.ts`                                          | `CoreWebVitals`, `SiteHealthReport`, `AlertThresholds`, `DEFAULT_THRESHOLDS`, `AlertType`, `AlertSeverity`                                            |
| Cron           | `app/api/cron/sentinel/route.ts`                                 | Runs `runSentinelCheckForAllUsers()` on schedule                                                                                                      |
| Manual trigger | `POST /api/sentinel/check`                                       | Triggers sentinel check for the authenticated user                                                                                                    |
| Models         | Prisma: `AlgorithmUpdate`, `SiteHealthSnapshot`, `SentinelAlert` | Persistent storage for updates, snapshots, and alerts                                                                                                 |

## Alert Types and Thresholds

From `DEFAULT_THRESHOLDS` in `lib/sentinel/types.ts`:

| Alert Type          | Severity | Threshold                                      | Description                      |
| ------------------- | -------- | ---------------------------------------------- | -------------------------------- |
| `ranking-drop`      | warning  | Position worsens by 20%+                       | Average position declining       |
| `ranking-drop`      | critical | Position worsens by 50%+                       | Severe ranking regression        |
| `traffic-drop`      | warning  | Clicks drop by 30%+                            | Traffic volume declining         |
| `traffic-drop`      | critical | Clicks drop by 60%+                            | Major traffic loss               |
| `crawl-error-spike` | warning  | Coverage errors increase 50%+                  | Crawl error surge detected       |
| `cwv-regression`    | warning  | LCP >3.0s                                      | Largest Contentful Paint failed  |
| `cwv-regression`    | warning  | INP >300ms                                     | Interaction to Next Paint failed |
| `cwv-regression`    | warning  | CLS >0.25                                      | Cumulative Layout Shift failed   |
| `algorithm-update`  | critical | Traffic drop during active high-impact rollout | Correlated algorithm impact      |
| `algorithm-update`  | info     | First snapshot recorded                        | Baseline established             |

## Update Type Reference Guide

### Core Updates

- **What it targets**: broad quality, relevance, and authority reassessment
- **Symptoms**: gradual ranking shifts across multiple pages; can be positive or negative
- **Diagnosis**: compare GSC analytics 28 days before vs after rollout start; check page-level changes
- **Recovery**: improve content quality, demonstrate E-E-A-T, add original research; recovery typically occurs at next core update (3-6 months)
- **Timeline**: rollout 2-4 weeks; recovery at next core update cycle
- **Known updates in feed**: March 2024, August 2024, November 2024, March 2025, August 2025, November 2025, March 2026

### Spam Updates

- **What it targets**: scaled content abuse, expired domain abuse, parasite SEO, link manipulation
- **Symptoms**: sudden deindexing of affected pages; manual action in Search Console
- **Diagnosis**: check for manual actions in GSC; review content for auto-generated or scraped patterns
- **Recovery**: remove or substantially rewrite flagged content; submit reconsideration request
- **Timeline**: rollout 1-2 weeks; recovery after reconsideration (weeks to months)
- **Known updates in feed**: March 2024, December 2024, June 2025

### Helpful Content Updates

- **What it targets**: content created primarily for search engines rather than people
- **Symptoms**: site-wide classifier applied; entire domain affected, not just individual pages
- **Diagnosis**: audit for pages that add no unique value, are thin, or target keywords without genuine expertise
- **Recovery**: remove or significantly improve unhelpful pages; focus on demonstrating firsthand experience
- **Timeline**: classifier is site-wide and persistent; recovery when classifier is lifted (next HCU or core update)
- **Known updates in feed**: February 2026

### Link Spam Updates

- **What it targets**: unnatural link patterns, private blog networks (PBNs), guest post networks, paid links
- **Symptoms**: links nullified (no manual action, but rankings drop as link equity disappears)
- **Diagnosis**: audit backlink profile for unnatural patterns; check for sudden loss of referring domains
- **Recovery**: disavow toxic backlinks; focus on earning editorial links through quality content
- **Timeline**: rollout 1-2 weeks; recovery gradual as new editorial links are earned
- **Known updates in feed**: December 2025

### Product Reviews / Local Updates

- **What it targets**: review quality, firsthand experience signals, local result accuracy
- **Symptoms**: product review pages or local listings shift in rankings
- **Diagnosis**: check review content for genuine firsthand experience; verify local listing accuracy
- **Recovery**: demonstrate firsthand experience with products; ensure GBP listing is complete and accurate

## Diagnosis Workflow Decision Tree

```
Sentinel alert triggered
  |
  +--> What alert type?
         |
         +--> algorithm-update (correlated with active rollout)
         |      |
         |      +--> Identify the update type from AlgorithmUpdate.updateType
         |      |      core / spam / helpful-content / link-spam / other
         |      |
         |      +--> Follow type-specific recovery strategy (see above)
         |      |
         |      +--> Cross-reference: which pages lost the most?
         |             fetchAnalytics with dimensions: ['page']
         |             Compare 28 days before vs during rollout
         |
         +--> traffic-drop (no active rollout)
         |      |
         |      +--> Technical issue investigation:
         |      |      1. Check server errors in coverage (GSCSnapshot)
         |      |      2. Check robots.txt for accidental blocks
         |      |      3. Check for recent deploys that may have broken pages
         |      |      4. Check CWV regression (SiteHealthSnapshot.coreWebVitals)
         |      |
         |      +--> Competitive investigation:
         |             Invoke competitive-local-strategy skill
         |             Check if competitors published superior content
         |
         +--> ranking-drop
         |      |
         |      +--> Single page or site-wide?
         |      |      Use fetchAnalytics dimensions: ['page'] to identify
         |      |
         |      +--> Single page: content or technical issue with that URL
         |      +--> Site-wide: algorithm impact or domain-level issue
         |
         +--> crawl-error-spike
         |      |
         |      +--> Check coverage report details
         |      +--> Server errors: check hosting, SSL, CDN
         |      +--> Redirect errors: audit redirect chains
         |      +--> Soft 404s: fix page content or return proper 404
         |
         +--> cwv-regression
                |
                +--> Which metric failed?
                |      LCP >3.0s: check image sizes, server response, render-blocking resources
                |      INP >300ms: check JavaScript execution, main thread blocking
                |      CLS >0.25: check layout shifts from ads, images without dimensions, dynamic content
                |
                +--> Run PageSpeed Insights for detailed recommendations
                       SiteHealthReport.coreWebVitals from health-checker.ts
```

## Proactive Hardening Checklist

Protect against future algorithm impacts:

- [ ] **E-E-A-T on every page** — author bios, credentials, firsthand experience, citations
- [ ] **Core Web Vitals passing** — LCP <2.5s, INP <200ms, CLS <0.1 (good thresholds, not just passing)
- [ ] **No link schemes** — no purchased links, no PBN links, no excessive reciprocal links
- [ ] **AI content human-reviewed** — all AI-generated content edited and verified by a human
- [ ] **No fake or gated reviews** — genuine reviews only, never incentivised with discounts
- [ ] **Accurate schema markup** — LocalBusiness, FAQ, HowTo as appropriate; no misleading markup
- [ ] **Mobile parity** — mobile version has same content as desktop
- [ ] **Sentinel + GSC monitor running daily** — automated detection of regressions
- [ ] **Regular content audit** — remove or improve thin, outdated, or duplicate pages quarterly

## Health Score Interpretation

Computed by `computeHealthScore()` in `lib/sentinel/health-checker.ts`:

| Component        | Weight    | Scoring                                                      |
| ---------------- | --------- | ------------------------------------------------------------ |
| Average position | 30 points | Position 1 = 30pts, position 10 = 18pts, position 50+ = 0pts |
| Click volume     | 20 points | 1,000+ clicks = 20pts, scales linearly down                  |
| Coverage errors  | 20 points | 0 errors = 20pts, 50+ errors = 0pts                          |
| Core Web Vitals  | 30 points | 10pts each for LCP, INP, CLS passing thresholds              |

### Score Ranges

| Score  | Status           | Action                                                        |
| ------ | ---------------- | ------------------------------------------------------------- |
| 80-100 | Healthy          | Maintain current practices; monitor for changes               |
| 60-79  | Attention needed | Investigate weakest component; address before it worsens      |
| 40-59  | At risk          | Multiple components degraded; prioritise fixes immediately    |
| <40    | Critical         | Significant issues across the board; emergency audit required |

## Monitoring Cadence

| Frequency                | Mechanism                            | Purpose                                                                        |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------ |
| Daily (automated)        | Sentinel cron (`/api/cron/sentinel`) | Full health check + alert generation for all users with websites               |
| Real-time (event-driven) | `SentinelAlert` table                | Persisted alerts with severity, type, and related update ID                    |
| On-demand                | `POST /api/sentinel/check`           | Manual trigger for immediate health check                                      |
| Manual curation          | `KNOWN_ALGORITHM_UPDATES` array      | New updates added to `lib/sentinel/algorithm-feed.ts` as Google announces them |

### Adding New Algorithm Updates

When Google announces a new algorithm update:

1. Add entry to `KNOWN_ALGORITHM_UPDATES` in `lib/sentinel/algorithm-feed.ts`
2. Include: `name`, `updateType`, `announcedAt`, `rolloutStart`, `rolloutEnd` (null if ongoing), `impactLevel`, `description`, `sourceUrl`
3. The `seedAlgorithmUpdates()` function will upsert it on next cron run
4. Set `rolloutEnd` once Google confirms the rollout is complete

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.
