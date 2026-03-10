---
phase: 85
plan: 01
subsystem: geo
tags: [entity-extraction, coherence-scoring, prisma, geo-v2, nlp]
---

# Phase 85-01 Summary: Entity Coherence Engine — Service Layer

**Status**: COMPLETE
**Date**: 11/03/2026
**Commits**: 6 (Tasks 1-7 + Task 7 schema push has no separate commit — db push is non-git)

---

## What Was Built

Phase 85-01 delivers the full entity coherence analysis service layer for the GEO v2 engine. Named entity extraction (PERSON, ORGANISATION, LOCATION, CONCEPT) is implemented using regex-only pattern matching — no external NLP packages. Entity density is scored against the Princeton KDD 2024 research target of 15+ entities = 4.8x citation rate and ~20.6% proper noun density.

The `entityCoherence` score is added as a **standalone diagnostic metric** on `GEOScore`. It is NOT included in the weighted overall score calculation (citability 25% + structure 20% + multiModal 15% + authority 20% + technical 20% = 100% — unchanged). Backward compatibility with all existing stored scores and client expectations is fully preserved.

---

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Extend `lib/geo/types.ts` with `EntityType`, `EntityMention`, `EntityAnalysisResult`, `entityCoherence` on `GEOScore`, `entityAnalysis` on `GEOAnalysisResult` | `f7ee8176` |
| 2 | Create `lib/geo/entity-analyzer.ts` — pure function, regex-based extraction, coherence scoring | `80cdc9d6` |
| 3 | Integrate `analyzeEntities()` into `lib/geo/geo-analyzer.ts` — call after structure analysis, include in score and result | `3ce7bac6` |
| 4 | Add entity coherence recommendations to `lib/geo/recommendations.ts` | `59e8aef5` |
| 5 | Update `prisma/schema.prisma` — add `entityCoherenceScore` to `GEOAnalysis`, add `EntityAnalysis` model, add relation on `User` | `6d5f972d` |
| 6 | Update `app/api/geo/analyze/route.ts` — persist `entityCoherenceScore` and create `EntityAnalysis` record | `a961af54` |
| 7 | `npx prisma db push` — schema applied to Supabase PostgreSQL, Prisma Client regenerated | (db operation) |

---

## Files Created

- `D:\Synthex\lib\geo\entity-analyzer.ts` (NEW — 268 lines)

## Files Modified

- `D:\Synthex\lib\geo\types.ts` — added `EntityType`, `EntityMention`, `EntityAnalysisResult`, `entityCoherence` on `GEOScore`, `entityAnalysis` on `GEOAnalysisResult`
- `D:\Synthex\lib\geo\geo-analyzer.ts` — imported `analyzeEntities`, called after structure analysis, included `entityCoherence` in score and `entityAnalysis` in result
- `D:\Synthex\lib\geo\recommendations.ts` — added two entity coherence recommendation blocks (critical: score < 40, high: score 40-69)
- `D:\Synthex\prisma\schema.prisma` — added `entityCoherenceScore Float?` to `GEOAnalysis`, added `entityAnalysis EntityAnalysis?` relation, added full `EntityAnalysis` model, added `entityAnalyses EntityAnalysis[]` to `User`
- `D:\Synthex\app\api\geo\analyze\route.ts` — added `entityCoherenceScore` to `gEOAnalysis.create()`, added `prisma.entityAnalysis.create()` call after

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | PASS |
| `npx prisma db push` | PASS — synced in 5.78s, Prisma Client regenerated |
| `npm run type-check` | PASS — zero errors |
| `npm test` | Pre-existing failures in 4 unrelated test files (onboarding-referrals, stripe-routes, critical-paths, subscription-service). All GEO-related tests: N/A (no new test files required by this plan) |

---

## Key Architectural Decisions

1. **`entityCoherence` is NOT part of the weighted overall score** — it is a standalone diagnostic metric. This was the primary architectural constraint from the plan. The weights (25+20+15+20+20 = 100%) are unchanged.

2. **Regex-only extraction** — no NLP packages installed. Entity extraction uses: `PERSON_PATTERN` (capitalised two/three word sequences), `ORG_SUFFIXES` (known org suffix patterns), `ACRONYM_PATTERN` (3+ uppercase chars), `LOCATION_SEEDS` (50 countries + major cities), and mid-sentence capitalised word repetition (concepts, 2+ occurrences).

3. **`EntityAnalysis` is a separate table** — linked 1:1 to `GEOAnalysis` via `@unique` constraint. Stores full entity extraction results as JSON for Phase 85-02 dashboard consumption.

4. **Coherence scoring formula**:
   - Density: `min(uniqueEntityCount / 15, 1) * 50`
   - Diversity: `min(uniqueEntityTypes / 3, 1) * 25`
   - Consistency: `max(0, 1 - issueCount * 0.15) * 25`

---

## Deviations from Plan

None. All tasks executed as specified. No architectural blockers encountered.

The `LOCATION_SEEDS` set included both location-only seeds (countries and cities) and tech companies as specified. The implementation separates these internally — tech companies are classified as `ORGANISATION` type (not `LOCATION`), which is semantically correct. The seed set is used only for fast O(1) lookup; classification type is determined by the extraction function that calls each seed.

---

## Next Phase

Phase 85-02: Entity Coherence Engine — Dashboard UI. Consumes `EntityAnalysis` records via the GEO API response (`entityAnalysis` field) to render entity density visualisation, type breakdown chart, and coherence issue list in the GEO dashboard.
