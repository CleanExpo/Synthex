# Phase 87 Plan 02: AI Rewrite Pipeline Summary

**Streaming AI rewrite endpoint built — 9 tactic prompts, pro+ gated, SSE via ReadableStream.**

## Accomplishments

- Created `lib/geo/tactic-prompts.ts` — 9 tactic-specific system prompts + `buildTacticRewritePrompt()` orchestrator
  - Each prompt enforces: conservative rewriting, voice preservation, placeholder citations (not fabricated)
  - `TACTIC_LABELS` export for UI use
  - Section-scoped rewrites supported via optional `section` param
- Created `app/api/geo/rewrite/route.ts` — POST endpoint with SSE streaming:
  - Auth via `getUserIdFromRequest`
  - Rate limit: 20 req/min per IP via `RateLimiter` directly (streaming requires pre-flight check pattern)
  - Feature gate: Pro+ via `subscriptionService.getSubscription(userId)` → `isFeatureAvailable(plan, 'tacticOptimiserRewrites')`
  - Zod validation: content (50–50k chars), tactic (enum), section (optional, max 5k)
  - Temperature: 0.3 (conservative)
  - AI provider: `getAIProvider()` → `.stream()` async generator → SSE `data: {...}\n\n` chunks → `data: [DONE]\n\n`
  - Error state emitted as SSE data frame (not HTTP 500) to handle mid-stream failures gracefully

## Files Created/Modified

| File | Change |
|------|--------|
| `lib/geo/tactic-prompts.ts` | Created (153 lines) — 9 tactic prompts + buildTacticRewritePrompt() |
| `app/api/geo/rewrite/route.ts` | Created (159 lines) — POST streaming SSE endpoint |

## Decisions Made

- **Rate limiting**: Used `RateLimiter` directly instead of `aiGeneration()` wrapper — streaming endpoints return a `Response` not `NextResponse`, so the category wrapper's return type is incompatible. Manual check pattern is cleaner for streaming.
- **Plan check**: `subscriptionService.getSubscription(userId)` → `.plan ?? 'free'` — no `getUserSubscriptionPlan()` function exists, this is the correct pattern matching subscription-service API.
- **Streaming yielded strings**: `aiProvider.stream()` yields raw string tokens (already parsed from SSE frames in the provider layer), not raw OpenAI-format chunks. No `.choices[0].delta.content` extraction needed.

## Issues Encountered

None. TypeScript compiled cleanly at every stage. Both tasks completed without deviations.

## Commit Hashes

- `c56e1c5e` — feat(87-02): create tactic-prompts.ts — 9 Princeton tactic rewrite prompt templates
- `a5323d8e` — feat(87-02): create POST /api/geo/rewrite — streaming SSE AI rewrite, pro+ gated

## Next Step

Ready for 87-03-PLAN.md (Editor UI) — TacticScoreCard, GEOEditorPanel, RewriteModal, optimiser page, navigation
