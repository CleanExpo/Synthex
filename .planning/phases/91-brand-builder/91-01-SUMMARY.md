# Plan 91-01 Summary — Prisma Models + lib/brand/ Service Layer

**Status:** COMPLETE
**Date:** 2026-03-11
**Tasks:** 10/10

## What Was Built

### Prisma Models (3 new)
- `BrandIdentity` — Core entity profile with sameAs URLs, entity graph, consistency data, KG signals
- `BrandCredential` — Awards/certs/publications linked to a BrandIdentity (cascade delete)
- `BrandMention` — Deduplicated news mentions with @@unique([urlHash, brandId])
- User back-relation: `brandIdentities BrandIdentity[]` added to User model
- `npx prisma db push` — all 3 tables created successfully in Supabase PostgreSQL

### lib/brand/ Service Layer (8 modules)

| File | Exports | Notes |
|------|---------|-------|
| `types.ts` | All interfaces + types | BrandIdentityInput, EntityGraph, ConsistencyReport, RawMention, MentionPollResult, WikidataCheckResult, KGCheckResult, CalendarEvent, BrandCalendar |
| `entity-graph-builder.ts` | `buildEntityGraph()` | @id-connected JSON-LD — Organization, WebSite, optional Person |
| `consistency-scorer.ts` | `scoreConsistency()`, `normaliseName()` | Pure string comparison, weighted platform scoring, no HTTP |
| `mention-poller.ts` | `pollMentions()` | NewsData.io + GDELT in parallel via Promise.allSettled |
| `mention-deduplicator.ts` | `deduplicateMentions()`, `normaliseUrl()`, `urlHash()` | UTM stripping, djb2 hash for DB uniqueness |
| `wikidata-checker.ts` | `checkWikidata()` | Wikidata REST API — free, no auth, completeness scoring |
| `kg-confidence-checker.ts` | `checkKnowledgeGraph()` | Google KG API with graceful fallback if no key |
| `brand-calendar.ts` | `generateBrandCalendar()` | Pure date math, 90-day rolling calendar |

### lib/geo/feature-limits.ts (extended)
Added `brandIdentities`, `brandMentionPolls`, `consistencyAudits` to all plan tiers.

## Decisions
- `urlHash()` uses djb2 (not crypto) — deduplication is not a security use-case
- Consistency scorer does NOT fetch platform pages — scores based on declared URL slugs only (live checking is too expensive for per-request use)
- GDELT is always polled (no auth); NewsData.io is conditional on env var
- `Building2` icon for dashboard: uses `BuildingOffice2Icon` from heroicons (added to icons/index.ts in Plan 91-03)

## Type Check
`npx tsc --noEmit` — zero errors
