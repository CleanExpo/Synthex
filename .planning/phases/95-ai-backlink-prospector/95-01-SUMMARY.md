# Phase 95-01 Summary — AI Backlink Prospector: Service Layer

**Status:** COMPLETE
**Completed:** 2026-03-11

## What Was Built

### Prisma Models (prisma/schema.prisma)

**BacklinkProspect** — 13 fields including:
- `targetUrl`, `targetDomain`, `domainAuthority`, `pageRank`
- `opportunityType` — resource-page | guest-post | broken-link | competitor-link | journalist-mention
- `status` — identified | contacted | published | rejected
- `pitchSent`, `pitchResponse`, `outreachEmail`, `notes`
- `discoveredAt`, `contactedAt`, `publishedAt`
- Indexes: userId, orgId, opportunityType, status

**BacklinkAnalysis** — 8 fields including:
- `sourceUrl`, `analysisResult` (Json), `linksFound`, `highValueCount`
- Index: userId, orgId

Both models added as back-relations on the User model.
`npx prisma db push` executed — schema in sync with DB.

### Service Layer (lib/backlinks/)

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces — BacklinkOpportunityType, BacklinkStatus, ScoredDomain, SearchOpportunity, AnalysisResult, OutreachDraft, MatrixFilter, OPR/CSE API shapes |
| `domain-scorer.ts` | OpenPageRank API integration (100 req/day free) + TLD-based heuristic fallback; `scoreDomain()`, `scoreDomains()`, `heuristicScore()`, `getDomainAuthorityTier()` |
| `opportunity-finder.ts` | Google Custom Search API (100 queries/day free); 5 search strategies: resource pages, guest posts, broken links, competitor links, journalist mentions |
| `outreach-templates.ts` | 4 email templates per opportunity type, pure template generation (no AI call), mirrors lib/pr/pitch-drafter.ts pattern |
| `backlink-analyzer.ts` | Main orchestrator: runs all 5 discovery strategies in parallel, scores domains, deduplicates, filters (DA >= 20), sorts by DA, returns top 50 |

### API Routes (app/api/backlinks/)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/backlinks/prospects` | GET | List prospects with pagination + filtering (orgId, status, type) |
| `/api/backlinks/prospects` | POST | Create/save a new prospect (Zod validated) |
| `/api/backlinks/analyze` | POST | Run full analysis — calls backlink-analyzer, saves BacklinkAnalysis, bulk-creates prospects |
| `/api/backlinks/analysis` | GET | List past analyses with pagination |
| `/api/backlinks/outreach` | POST | Save outreach attempt — updates status to 'contacted', sets pitchSent=true |

All routes use `getUserIdFromRequest()` from `lib/auth/jwt-utils` for auth.

### Feature Limits (lib/geo/feature-limits.ts)

Added `backlinkAnalyses` and `backlinkProspects` to all 7 plan tiers:
- free: 3 analyses, 20 prospects
- pro: 20 analyses, 200 prospects
- growth/scale/business/custom: unlimited

### Environment Variables (.env.example)

```
OPEN_PAGE_RANK_API_KEY=   # OpenPageRank.com (free 100/day)
GOOGLE_CSE_KEY=           # Google Custom Search JSON API key (100/day free)
GOOGLE_CSE_ID=            # Google Custom Search Engine ID
```

## Key Design Decisions

- **Free APIs only** — no paid backlink SaaS (Ahrefs/Moz). Google CSE (100/day) + OpenPageRank (100/day) cover typical usage
- **Graceful degradation** — both integrations degrade gracefully to heuristics/empty if API keys not set
- **Duplicate prevention** — analyze route skips prospects whose targetUrl already exists for the user
- **No mock data** — all routes return real DB data
