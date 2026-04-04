# Summary 94-01: Prisma Models + Service Layer + API Routes

**Status:** Complete
**Date:** 2026-03-11

## What Was Done

### Prisma Schema (prisma/schema.prisma)
- Added 3 new models: `AwardListing`, `DirectoryListing`, `SubmissionTracker`
- Added back-relations to `User`: `awardListings`, `directoryListings`, `submissionTrackers`
- Ran `npx prisma db push` — schema in sync

### Service Layer (lib/awards/)
- `lib/awards/types.ts` — AwardInput, DirectoryInput, NominationDraft, SubmissionSummary, UpcomingDeadline types
- `lib/awards/award-database.ts` — 18 curated award templates (10 AU, 8 global) with AwardTemplate interface
- `lib/awards/directory-database.ts` — 21 curated directory templates (7 AU, 14 global) with isAiIndexed flag
- `lib/awards/nomination-writer.ts` — AI nomination generator via OpenRouter (claude-3-haiku) + template fallback

### API Routes (8 routes)
- `app/api/awards/route.ts` — GET (list with filters) + POST (create)
- `app/api/awards/[id]/route.ts` — PATCH + DELETE
- `app/api/awards/[id]/generate-nomination/route.ts` — POST (AI nomination → saved to DB)
- `app/api/awards/templates/route.ts` — GET (filterable by country, entryFee)
- `app/api/directories/route.ts` — GET + POST
- `app/api/directories/[id]/route.ts` — PATCH + DELETE
- `app/api/directories/templates/route.ts` — GET (filterable by country, isAiIndexed, isFree)
- `app/api/submissions/route.ts` — GET (dashboard summary: totals + upcoming deadlines ≤ 90 days)

### Feature Limits (lib/geo/feature-limits.ts)
- Added `awardListings` and `directoryListings` to GEOFeatureLimits interface
- Free: awardListings=5, directoryListings=10
- Pro: awardListings=25, directoryListings=50
- Growth/Scale/Business/Custom: -1 (unlimited)
- Added FEATURE_INFO entries for both features

## Verification
- `npm run type-check` — PASSED (0 errors)
- `npx prisma db push` — PASSED (schema synced)
