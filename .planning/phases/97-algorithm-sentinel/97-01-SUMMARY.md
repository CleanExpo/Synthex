# Phase 97-01 SUMMARY — Service Layer + Prisma + API Routes

**Status:** COMPLETE — 2026-03-11
**Commits:** 2

## What Was Built

### Prisma Schema
Three new models added to `prisma/schema.prisma`:

- **AlgorithmUpdate** — stores known Google algorithm updates (seeded from static list)
- **SiteHealthSnapshot** — periodic health snapshot per user site (GSC + CWV metrics)
- **SentinelAlert** — generated alerts with severity, type, metric deltas, and acknowledgement state

User back-relations added for both `SiteHealthSnapshot` and `SentinelAlert`.

`npx prisma db push` ran successfully — all 3 tables created in Supabase.

### Service Layer (`lib/sentinel/`)

| File | Purpose |
|------|---------|
| `types.ts` | Shared TypeScript types: CoreWebVitals, AlertThresholds, AlgorithmUpdateInfo, SentinelStatus |
| `algorithm-feed.ts` | Static list of 12 real Google updates (2024–2026), seedAlgorithmUpdates(), getRecentUpdates(), getActiveRollouts() |
| `health-checker.ts` | checkSiteHealth() using existing GSC + PSI integrations, getSnapshotHistory(), getLatestSnapshot() |
| `alert-engine.ts` | runAlertEngine() — compares snapshots, emits 5 alert types with configurable thresholds |
| `sentinel-agent.ts` | runSentinelCheck() orchestrator, runSentinelCheckForAllUsers() for cron |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `app/api/sentinel/status/route.ts` | GET | Current health snapshot + alert counts |
| `app/api/sentinel/alerts/route.ts` | GET | Paginated alerts with severity filter |
| `app/api/sentinel/alerts/[id]/acknowledge/route.ts` | POST | Mark alert acknowledged |
| `app/api/sentinel/updates/route.ts` | GET | Algorithm update feed |
| `app/api/sentinel/check/route.ts` | POST | Manual health check trigger |
| `app/api/cron/sentinel/route.ts` | GET/POST | Scheduled cron (CRON_SECRET auth) |

### Algorithm Update Coverage (Static Seed)
- March 2024 Core Update (+ Spam)
- August 2024 Core Update
- November 2024 Core Update
- December 2024 Spam Update
- March 2025 Core Update
- June 2025 Spam Update
- August 2025 Core Update
- November 2025 Core Update
- December 2025 Link Spam Update
- February 2026 Helpful Content Update
- March 2026 Core Update (active rollout)

### Reused Existing Integrations
- `lib/google/search-console.ts` → `getSearchAnalytics()` for GSC data
- `lib/seo/pagespeed-service.ts` → `runPageSpeedAnalysis()` for CWV data
- `lib/security/api-security-checker.ts` → authentication/authorisation
- Cron pattern from `app/api/cron/health-score/route.ts`

## Alert Thresholds
| Alert | Warning | Critical |
|-------|---------|---------|
| Ranking drop | 20% | 50% |
| Traffic drop | 30% | 60% |
| Crawl error spike | 50% | — |
| LCP | > 3.0s | — |
| INP | > 300ms | — |
| Algorithm correlation | — | active update + traffic drop |
