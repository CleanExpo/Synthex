# Plan 89-01 Summary — Humanness Scorer + Prisma Model + Content Scorer Extension

## Status: Complete

## Tasks Completed

### Task 1: ContentQualityAudit Prisma Model
- Added `ContentQualityAudit` model to `prisma/schema.prisma` after the `ContentCapsule` model
- Added `contentQualityAudits ContentQualityAudit[]` back-relation to the `User` model
- Ran `npx prisma db push` — schema synced to database successfully
- Fields: `id`, `userId`, `orgId`, `contentText`, `humanessScore`, `slopDensity`, `ttr?`, `fleschScore?`, `passRate`, `slopMatchCount`, `auditResult` (Json), `createdAt`, `updatedAt`
- Indexes on `userId` and `orgId`

### Task 2: lib/quality/humanness-scorer.ts
- Created new module at `lib/quality/humanness-scorer.ts`
- Exports `HumannessResult` interface and `scoreHumanness(text, threshold?)` function
- Scoring algorithm: starts at 100, subtracts slop penalty (capped at 40), adds TTR/rhythm/readability bonuses from fingerprint
- Without fingerprint (< 200 words): caps at 85 to reflect signal uncertainty
- Generates `issues[]` and `suggestions[]` arrays from scoring results
- Grade mapping: A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F < 40

### Task 3: lib/ai/content-scorer.ts — 6th Dimension
- Imported `scoreHumanness` from `lib/quality/humanness-scorer`
- Added `writingQuality: DimensionScore` to `ScoreResult.dimensions` type
- Added `scoreWritingQuality(content)` pure function (maps HumannessResult to DimensionScore)
- Updated `DIMENSION_WEIGHTS` to include `writingQuality: 0.15`
- New weights: engagement 25%, readability 20%, platformFit 15%, clarity 15%, emotional 10%, writingQuality 15% (sum = 100%)
- Wired `writingQuality` into `score()` method computation, suggestion aggregation, and return value
- Updated module JSDoc comment to reflect new weights

## Commits

| Hash | Message |
|------|---------|
| `eb735b46` | feat(89-01): add ContentQualityAudit Prisma model |
| `6b17006a` | feat(89-01): create humanness-scorer.ts — composite AI-vs-human scoring |
| `6ba3f6f3` | feat(89-01): extend content-scorer with writingQuality 6th dimension |

## Key Decisions

- **No circular dependency**: `lib/quality/` imports from `lib/voice/` only. `lib/ai/content-scorer.ts` imports from `lib/quality/`. Neither creates a cycle.
- **85-cap without fingerprint**: Avoids giving false confidence when text is too short (< 200 words) for stylometric analysis.
- **Slop penalty cap at 40**: Prevents a single heavily-slop-dense piece from being scored 0 — the scale stays meaningful.
- **Threshold default 60**: Grade C boundary — a reasonable minimum for publishable quality.

## Deviations from Plan

None — implementation follows the plan specification exactly.

## Files Created/Modified

- `prisma/schema.prisma` — 1 model added, 1 back-relation added
- `lib/quality/humanness-scorer.ts` — NEW (185 lines)
- `lib/ai/content-scorer.ts` — MODIFIED (6th dimension, updated weights, import)
