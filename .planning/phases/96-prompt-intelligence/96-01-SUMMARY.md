# Summary 96-01 — Service Layer + Prisma + API Routes

**Executed:** 2026-03-11
**Status:** Complete

## What Was Built

### Prisma Models (2 new)
- `PromptTracker` — tracks user-defined prompts for an entity (brand/product/service/person/location) with test results cached on the record
- `PromptResult` — individual AI test result per tracker run with full response text, brand mention position, context sentence, competitors found, and quality score
- `User.promptTrackers` back-relation added
- `npx prisma db push` — succeeded, tables created

### lib/prompts/ Service Layer (4 files)
- `types.ts` — `PromptCategory` (6 values), `PromptTemplate`, `PromptGapAnalysis`, `CompetitorVisibility`, `CATEGORY_CONFIG` colour/label map
- `prompt-generator.ts` — `generatePrompts()` producing 31 prompt templates across 6 categories via template substitution (pure TS, no API)
- `prompt-tester.ts` — `testPrompt()` via OpenRouter claude-3-5-haiku; `parseResponse()` (exported for testing) with sentence splitting, brand detection, proper noun extraction, quality scoring
- `gap-analyzer.ts` — `analyzeGaps()` + `aggregateCompetitors()` — pure computation, no DB/API calls

### API Routes (4)
- `GET/POST /api/prompts/trackers` — list (with status/category/orgId filters) + create (duplicate check)
- `POST /api/prompts/generate` — generate prompt templates (pure computation, no rate limit)
- `POST /api/prompts/test` — run prompt, save PromptResult, update tracker (10/hr rate limit via in-memory store keyed by userId)
- `GET /api/prompts/gaps` — fetch tested trackers + results, run gap analyser, return PromptGapAnalysis + CompetitorVisibility[]

### Feature Limits
- `promptTests` key added to `GEOFeatureLimits` and all 7 plan tiers:
  - free: 10, pro: 50, growth: 200, scale/business/custom/professional: -1

## Files Changed
- `prisma/schema.prisma` (+51 lines)
- `lib/prompts/types.ts` (new, 109 lines)
- `lib/prompts/prompt-generator.ts` (new, 128 lines)
- `lib/prompts/prompt-tester.ts` (new, 166 lines)
- `lib/prompts/gap-analyzer.ts` (new, 171 lines)
- `lib/geo/feature-limits.ts` (+17 lines across all tiers)
- `app/api/prompts/trackers/route.ts` (new)
- `app/api/prompts/generate/route.ts` (new)
- `app/api/prompts/test/route.ts` (new)
- `app/api/prompts/gaps/route.ts` (new)

## Commits
- `feat(96-01): Add PromptTracker + PromptResult Prisma models`
- `feat(96-01): lib/prompts/ service layer — generator, tester, gap-analyzer`

## Type Check
`npm run type-check` — 0 errors
